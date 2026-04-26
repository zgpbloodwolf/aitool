/**
 * 通知管理器 — 自定义 BrowserWindow 通知系统
 * D-01: 纯自定义通知窗口，Catppuccin Mocha 风格
 * D-02: 最多 3 条堆叠，超出移除最旧
 * D-03: 智能触发，窗口前台且对应标签可见时不弹通知
 * D-04: 交互式按钮（允许/拒绝/查看/回复）
 */
import { BrowserWindow, screen, ipcMain, app } from 'electron'
import { join } from 'path'

interface NotificationEntry {
  window: BrowserWindow
  id: string
  channelId?: string
  height: number
  timeout: ReturnType<typeof setTimeout>
}

interface ShowNotificationOptions {
  type: 'complete' | 'permission' | 'plan' | 'reply' | 'error'
  title: string
  body: string
  channelId?: string
  requestId?: string
  toolName?: string
}

const MAX_NOTIFICATIONS = 3
const NOTIFICATION_WIDTH = 360
const MARGIN = 10
const DEFAULT_TIMEOUT = 5000

const activeNotifications: NotificationEntry[] = []

export class NotificationManager {
  private mainWindow: BrowserWindow

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
    this.registerIpcHandlers()
  }

  private registerIpcHandlers(): void {
    // 通知窗口按钮点击处理
    ipcMain.on('notification:action', (_event, data: {
      notificationId: string
      action: string // 'allow' | 'deny' | 'click' | 'view' | 'reply'
      replyText?: string
    }) => {
      const entry = activeNotifications.find(n => n.id === data.notificationId)
      if (!entry) return

      switch (data.action) {
        case 'allow':
        case 'deny':
          // 转发权限响应到渲染进程（由 ChatPanel 处理）
          this.mainWindow.webContents.send('notification:permission-response', {
            allowed: data.action === 'allow'
          })
          break
        case 'click':
        case 'view':
        case 'reply':
          // 跳转到对应标签页
          if (entry.channelId) {
            this.mainWindow.show()
            this.mainWindow.focus()
            this.mainWindow.webContents.send('notification:focus-tab', entry.channelId)
          }
          break
      }
      this.dismiss(data.notificationId)
    })
  }

  /**
   * D-03 智能触发：检查窗口是否在前台且对应标签页可见
   * 使用 executeJavaScript 在渲染进程中查询标签页可见性
   */
  async shouldShowNotification(channelId?: string): Promise<boolean> {
    // 窗口不在前台或不可见 → 一定显示通知
    if (!this.mainWindow.isFocused() || !this.mainWindow.isVisible()) {
      return true
    }

    // 窗口在前台 → 检查对应标签页是否可见
    if (channelId) {
      try {
        // T-04-13: channelId 是内部 UUID，清除非字母数字字符防止注入
        const safeChannelId = channelId.replace(/[^a-zA-Z0-9_-]/g, '')
        const isVisible = await this.mainWindow.webContents.executeJavaScript(
          `(() => {
            const channelToTab = window.__channelToTab;
            const activeTabId = window.__activeTabId;
            if (!channelToTab || activeTabId == null) return false;
            const tabId = channelToTab.get('${safeChannelId}');
            return tabId === activeTabId;
          })()`
        )
        return !isVisible
      } catch {
        // 查询失败 → 默认显示通知
        return true
      }
    }

    // 窗口在前台但无 channelId 信息 → 不显示通知
    return false
  }

  /**
   * 从渲染进程读取通知设置，检查对应事件类型是否允许通知
   * 设置存储在 localStorage，主进程通过 executeJavaScript 读取
   */
  private async isNotificationEnabled(type: string): Promise<boolean> {
    try {
      const enabled = await this.mainWindow.webContents.executeJavaScript(
        `(() => {
          try {
            const raw = localStorage.getItem('aitools-settings');
            if (!raw) return true; // 无设置 → 默认显示
            const settings = JSON.parse(raw);
            if (!settings.notifyEnabled) return false; // 全局通知开关
            const toggleMap = {
              complete: settings.notifyComplete,
              permission: settings.notifyPermission,
              plan: settings.notifyPlan,
              reply: settings.notifyReply,
              error: settings.notifyError
            };
            return toggleMap['${type}'] !== false;
          } catch { return true; }
        })()`
      )
      return enabled !== false
    } catch {
      return true // 查询失败 → 默认显示
    }
  }

  async show(options: ShowNotificationOptions): Promise<void> {
    // 检查通知设置开关
    const enabled = await this.isNotificationEnabled(options.type)
    if (!enabled) return

    // D-03: 窗口在前台且对应标签页可见时不弹通知，但仍播放声音
    const shouldShow = await this.shouldShowNotification(options.channelId)
    if (!shouldShow) {
      // 只触发声音，不显示通知窗口
      this.mainWindow.webContents.send('notification:play-sound', options.type)
      return
    }

    // 超过上限时移除最旧的通知
    while (activeNotifications.length >= MAX_NOTIFICATIONS) {
      this.dismiss(activeNotifications[0].id)
    }

    const { width: screenWidth, height: screenHeight } =
      screen.getPrimaryDisplay().workAreaSize

    // 计算堆叠位置
    const yOffset = activeNotifications.reduce(
      (acc, n) => acc + n.height + MARGIN, 0
    )

    // 根据通知类型决定窗口高度
    const notifHeight = options.type === 'permission' ? 160
      : options.type === 'reply' ? 160
      : options.type === 'error' ? 120
      : 100

    const x = screenWidth - NOTIFICATION_WIDTH - MARGIN
    const y = screenHeight - notifHeight - MARGIN - yOffset

    const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2)}`

    const win = new BrowserWindow({
      width: NOTIFICATION_WIDTH,
      height: notifHeight,
      x, y,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      focusable: false,
      show: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: false,
        sandbox: false
      }
    })

    // 通知 HTML 通过 URL 查询参数传递数据（T-04-07: HTML 端使用 escapeHtml 防止 XSS）
    const params = new URLSearchParams({
      id,
      type: options.type,
      title: options.title,
      body: options.body,
      toolName: options.toolName || ''
    })

    // 开发模式和生产模式使用不同路径
    const htmlPath = !app.isPackaged
      ? join(__dirname, '../../src/notification/index.html')
      : join(__dirname, '../notification/index.html')

    win.loadFile(htmlPath, { query: Object.fromEntries(params) })

    // 显示时触发 CSS 滑入动画
    win.once('ready-to-show', () => {
      win.show()
      this.repositionAll()
    })

    // 自动关闭超时
    const timeout = setTimeout(() => {
      this.dismiss(id)
    }, DEFAULT_TIMEOUT)

    activeNotifications.push({ window: win, id, channelId: options.channelId, height: notifHeight, timeout })
  }

  dismiss(id: string): void {
    const idx = activeNotifications.findIndex(n => n.id === id)
    if (idx === -1) return
    const entry = activeNotifications[idx]
    clearTimeout(entry.timeout)
    entry.window.close()
    activeNotifications.splice(idx, 1)
    this.repositionAll()
  }

  private repositionAll(): void {
    const { width: screenWidth, height: screenHeight } =
      screen.getPrimaryDisplay().workAreaSize

    let yOffset = 0
    for (const entry of activeNotifications) {
      const x = screenWidth - NOTIFICATION_WIDTH - MARGIN
      const y = screenHeight - entry.height - MARGIN - yOffset
      entry.window.setBounds({ x, y, width: NOTIFICATION_WIDTH, height: entry.height })
      yOffset += entry.height + MARGIN
    }
  }

  dismissAll(): void {
    for (const entry of activeNotifications) {
      clearTimeout(entry.timeout)
      entry.window.close()
    }
    activeNotifications.length = 0
  }
}
