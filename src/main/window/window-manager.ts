// 多窗口管理器 (UX-11)
// 管理 BrowserWindow 实例生命周期、窗口-频道映射、窗口间广播

import { app, BrowserWindow, nativeTheme, shell } from 'electron'
import { join } from 'path'
import { WindowChannelRegistry } from './window-registry'

/** 最大窗口数限制，防止资源耗尽 (T-08-03) */
const MAX_WINDOWS = 10

export class WindowManager {
  private windows = new Map<number, BrowserWindow>()
  private registry = new WindowChannelRegistry()
  private lastActiveWindowId: number | null = null

  /** 创建初始主窗口，等同于原 createWindow() 行为 */
  createMainWindow(): BrowserWindow {
    const win = this.createBrowserWindow({
      devTools: true
    })
    return win
  }

  /** 创建额外窗口（拖拽/分支用） */
  createWindow(options?: { x?: number; y?: number; width?: number; height?: number }): BrowserWindow {
    return this.createBrowserWindow({
      x: options?.x,
      y: options?.y,
      width: options?.width,
      height: options?.height,
      devTools: false
    })
  }

  /** 窗口关闭处理 */
  handleWindowClose(windowId: number): void {
    this.registry.unregisterWindow(windowId)
    this.windows.delete(windowId)
  }

  /** 通过频道 ID 查找所属窗口 */
  getWindowByChannel(channelId: string): BrowserWindow | undefined {
    const windowId = this.registry.getWindowIdByChannel(channelId)
    if (windowId === undefined) return undefined
    const win = this.windows.get(windowId)
    if (win && !win.isDestroyed()) return win
    return undefined
  }

  /** 获取最后活跃窗口 */
  getLastActiveWindow(): BrowserWindow | undefined {
    if (this.lastActiveWindowId !== null) {
      const win = this.windows.get(this.lastActiveWindowId)
      if (win && !win.isDestroyed()) return win
    }
    // 降级：返回第一个可用窗口
    for (const win of this.windows.values()) {
      if (!win.isDestroyed()) return win
    }
    return undefined
  }

  /** 获取所有非销毁窗口 */
  getAllWindows(): BrowserWindow[] {
    const result: BrowserWindow[] = []
    for (const win of this.windows.values()) {
      if (!win.isDestroyed()) result.push(win)
    }
    return result
  }

  /** 广播消息到所有窗口 */
  broadcastToAll(channel: string, data: unknown): void {
    for (const win of this.windows.values()) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, data)
      }
    }
  }

  /** 暴露 registry 供其他模块使用 */
  getRegistry(): WindowChannelRegistry {
    return this.registry
  }

  /** 当前窗口数量 */
  getWindowCount(): number {
    return this.windows.size
  }

  /** 内部：创建 BrowserWindow 实例并注册生命周期 */
  private createBrowserWindow(opts: {
    x?: number
    y?: number
    width?: number
    height?: number
    devTools?: boolean
  }): BrowserWindow {
    if (this.windows.size >= MAX_WINDOWS) {
      throw new Error(`已达到最大窗口数限制 (${MAX_WINDOWS})`)
    }

    const win = new BrowserWindow({
      width: opts.width ?? 1200,
      height: opts.height ?? 800,
      x: opts.x,
      y: opts.y,
      minWidth: 800,
      minHeight: 600,
      show: true,
      frame: true,
      title: 'AI 工具',
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#1e1e2e' : '#eff1f5',
      webPreferences: {
        preload: join(__dirname, '../../preload/index.js'),
        sandbox: false,
        contextIsolation: true
      }
    })

    const windowId = win.id
    this.windows.set(windowId, win)
    this.registry.registerWindow(windowId)
    this.lastActiveWindowId = windowId

    // 隐藏默认菜单栏
    win.setMenu(null)

    // 阻止页面标题被覆盖
    win.on('page-title-updated', (event) => {
      event.preventDefault()
    })

    // 窗口就绪后显示
    win.once('ready-to-show', () => {
      win.show()
      win.focus()
      if (opts.devTools && !app.isPackaged) {
        win.webContents.openDevTools({ mode: 'bottom' })
      }
    })

    // 拦截新窗口打开为外部浏览器
    win.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    // 快捷键拦截 — 解决 iframe 获取焦点后渲染进程收不到键盘事件的问题
    win.webContents.on('before-input-event', (event, input) => {
      if (!input.control && !input.meta) return
      // Ctrl+Shift+V — 剪贴板面板
      if (input.control && input.shift && input.key.toLowerCase() === 'v') {
        event.preventDefault()
        win.webContents.send('shortcut:clipboard-panel')
        return
      }
      const shortcuts: Record<string, string> = {
        'n': 'shortcut:new-tab',
        'w': 'shortcut:close-tab',
        'b': 'shortcut:toggle-sidebar',
        ',': 'shortcut:open-settings',
        '0': 'shortcut:reset-zoom'
      }
      if (input.key === 'Tab') {
        event.preventDefault()
        win.webContents.send(input.shift ? 'shortcut:prev-tab' : 'shortcut:next-tab')
        return
      }
      const channel = shortcuts[input.key.toLowerCase()]
      if (channel) {
        event.preventDefault()
        win.webContents.send(channel)
      }
    })

    // 跟踪最后活跃窗口
    win.on('focus', () => {
      if (!win.isDestroyed()) {
        this.lastActiveWindowId = windowId
      }
    })

    // 窗口关闭时清理
    win.on('closed', () => {
      this.handleWindowClose(windowId)
    })

    // 加载页面
    if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
      win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      win.loadFile(join(__dirname, '../../renderer/index.html'))
    }

    return win
  }
}
