// 多窗口管理器 (UX-11)
// 管理 BrowserWindow 实例生命周期、窗口-频道映射、窗口间广播

import { app, BrowserWindow, nativeTheme, screen, shell } from 'electron'
import { join } from 'path'
import { WindowChannelRegistry } from './window-registry'

/** 最大窗口数限制，防止资源耗尽 (T-08-03) */
const MAX_WINDOWS = 10

export class WindowManager {
  private windows = new Map<number, BrowserWindow>()
  private registry = new WindowChannelRegistry()
  private lastActiveWindowId: number | null = null
  private ghostWindow: BrowserWindow | null = null
  private dragTrackingInterval: ReturnType<typeof setInterval> | null = null
  private dragChannelId: string | null = null
  private dragTabId: string | null = null

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

  /** 开始拖拽预览 — 创建半透明 ghost 窗口跟随鼠标 */
  startDragPreview(channelId: string, tabId: string): void {
    // 防止重复调用
    if (this.ghostWindow) return

    this.dragChannelId = channelId
    this.dragTabId = tabId

    const cursorPos = screen.getCursorScreenPoint()

    this.ghostWindow = new BrowserWindow({
      width: 300,
      height: 200,
      x: cursorPos.x - 150,
      y: cursorPos.y - 100,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      focusable: false,
      skipTaskbar: true,
      show: false,
      opacity: 0.7,
      webPreferences: {
        sandbox: false,
        contextIsolation: false
      }
    })

    this.ghostWindow.loadURL(
      'data:text/html,<body style="margin:0;background:rgba(30,30,46,0.8);color:#cdd6f4;display:flex;align-items:center;justify-content:center;font-family:sans-serif;border-radius:8px;">拖拽以创建新窗口</body>'
    )
    this.ghostWindow.once('ready-to-show', () => {
      this.ghostWindow?.show()
    })

    // 每 16ms 跟踪鼠标位置
    this.dragTrackingInterval = setInterval(() => {
      this.updateDragPreview()
    }, 16)
  }

  /** 更新 ghost 窗口位置 */
  private updateDragPreview(): void {
    if (!this.ghostWindow || this.ghostWindow.isDestroyed()) return
    const pos = screen.getCursorScreenPoint()
    this.ghostWindow.setPosition(pos.x - 150, pos.y - 100)
  }

  /** 完成拖拽 — 创建新窗口并迁移频道 */
  finalizeDragOut(sourceWindowId: number): { windowId: number; window: BrowserWindow } | null {
    // 停止跟踪
    if (this.dragTrackingInterval) {
      clearInterval(this.dragTrackingInterval)
      this.dragTrackingInterval = null
    }

    // 销毁 ghost 窗口
    if (this.ghostWindow && !this.ghostWindow.isDestroyed()) {
      this.ghostWindow.close()
    }
    this.ghostWindow = null

    // 先保存 drag 状态到临时变量
    const channelId = this.dragChannelId
    const tabId = this.dragTabId

    if (!channelId) return null

    // 获取鼠标位置计算新窗口位置
    const cursorPos = screen.getCursorScreenPoint()
    const display = screen.getDisplayNearestPoint(cursorPos)
    const { width: screenWidth, height: screenHeight } = display.workAreaSize
    const newWidth = 1200
    const newHeight = 800
    const x = Math.max(
      display.workArea.x,
      Math.min(cursorPos.x - newWidth / 2, display.workArea.x + screenWidth - newWidth)
    )
    const y = Math.max(
      display.workArea.y,
      Math.min(cursorPos.y - newHeight / 2, display.workArea.y + screenHeight - newHeight)
    )

    try {
      const newWindow = this.createWindow({ x, y, width: newWidth, height: newHeight })
      const newWindowId = newWindow.id

      // 迁移频道到新窗口
      this.registry.migrateChannel(channelId, newWindowId)

      // 清除 drag 状态
      this.dragChannelId = null
      this.dragTabId = null

      return { windowId: newWindowId, window: newWindow }
    } catch (err) {
      // 创建窗口失败（如达到最大窗口数）
      this.dragChannelId = null
      this.dragTabId = null
      return null
    }
  }

  /** 取消拖拽 — 清理 ghost 窗口和状态 */
  cancelDrag(): void {
    if (this.dragTrackingInterval) {
      clearInterval(this.dragTrackingInterval)
      this.dragTrackingInterval = null
    }
    if (this.ghostWindow && !this.ghostWindow.isDestroyed()) {
      this.ghostWindow.close()
    }
    this.ghostWindow = null
    this.dragChannelId = null
    this.dragTabId = null
  }

  /** 获取当前拖拽状态 */
  getDragState(): { channelId: string | null; tabId: string | null } {
    return { channelId: this.dragChannelId, tabId: this.dragTabId }
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
