import { app, BrowserWindow, ipcMain, dialog, nativeTheme } from 'electron'
import { execSync } from 'child_process'
import { registerDialogHandlers } from './ipc/dialog'
import { registerFilesystemHandlers } from './ipc/filesystem'
import { registerExtensionHandlers } from './ipc/extensions'
import { registerClaudeWebviewHandlers, shutdownClaude, setWindowManager } from './ipc/claude-webview'
import { bootstrapWeChat, registerWeChatHandlers } from './ipc/wechat'
import { registerTokenUsageHandlers } from './ipc/token-usage'
import { registerFileWatcherHandlers, stopAllWatchers } from './ipc/file-watcher'
import { stopWebviewServer, setWebviewTheme } from './claude/webview-server'
import { setupTray, registerTrayHandlers } from './tray/tray-manager'
import { NotificationManager } from './notification/notification-manager'
import { setNotificationManager } from './notification/notification-registry'
import { setupAutoUpdater } from './updater/auto-updater'
import { WindowManager } from './window/window-manager'
import { registerWindowHandlers } from './ipc/window-handlers'

// 设置 Windows 控制台代码页为 UTF-8，防止中文日志乱码
if (process.platform === 'win32') {
  try {
    execSync('chcp 65001', { stdio: 'pipe' })
  } catch {}
}

// Guard against EPIPE when parent process exits (stdout pipe breaks)
process.stdout.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') process.exit(0)
})
process.stderr.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') process.exit(0)
})

// D-24: 全局未捕获异常处理器 — 防止主进程静默崩溃
process.on('uncaughtException', (err) => {
  console.error('[主进程] 未捕获异常:', err)
  // 对可能导致数据丢失的错误弹出对话框
  const win = windowManager?.getLastActiveWindow() ?? BrowserWindow.getAllWindows()[0]
  if (win) {
    dialog.showErrorBox('应用错误', '发生意外错误，请查看日志或重启应用。\n' + String(err))
  }
})

// D-24: 未处理的 Promise 拒绝 — 仅记录日志，不退出进程
process.on('unhandledRejection', (reason) => {
  console.error('[主进程] 未处理的 Promise 拒绝:', reason)
})

// D-04: 当前 resolved 主题状态（模块级别，供 getCurrentTheme 导出使用）
let currentResolvedTheme: 'dark' | 'light' = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'

// WindowManager 实例 — 管理所有 BrowserWindow
let windowManager: WindowManager

// D-12: 单实例锁 + 右键菜单通信 (UX-10)
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv, _workingDirectory) => {
    // 从命令行参数中提取目录路径
    const dirPath = argv.find((arg) =>
      /^[A-Z]:\\/i.test(arg) && !arg.endsWith('.exe')
    )
    const lastActive = windowManager?.getLastActiveWindow()
    if (lastActive) {
      lastActive.show()
      lastActive.focus()
      if (dirPath) {
        lastActive.webContents.send('open-directory', dirPath)
      }
    }
  })
}

if (!app.isPackaged && process.env['ELECTRON_DEBUG']) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222')
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.aitools.desktop')

  ipcMain.on('app:version', (event) => {
    event.returnValue = app.getVersion()
  })

  registerDialogHandlers()
  registerFilesystemHandlers()
  registerExtensionHandlers()
  registerClaudeWebviewHandlers()
  registerTokenUsageHandlers()
  registerWeChatHandlers()
  registerFileWatcherHandlers()
  void bootstrapWeChat()

  // WindowManager 初始化 — 替代独立 createWindow()
  windowManager = new WindowManager()
  const mainWindow = windowManager.createMainWindow()
  setWindowManager(windowManager)
  registerWindowHandlers(windowManager)
  setupTray(mainWindow, windowManager)
  registerTrayHandlers()

  // D-04: 系统主题检测 — 监听 Windows 明暗设置变化，广播到所有窗口
  nativeTheme.on('updated', () => {
    const resolved = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    currentResolvedTheme = resolved
    setWebviewTheme(resolved)
    windowManager.broadcastToAll('theme:system-changed', resolved)
    for (const win of windowManager.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.setBackgroundColor(resolved === 'dark' ? '#1e1e2e' : '#eff1f5')
      }
    }
  })

  // 渲染进程通知主进程主题变更 — 广播到所有窗口
  ipcMain.on('theme:update', (_event, _mode: string, resolved?: string) => {
    if (resolved === 'dark' || resolved === 'light') {
      currentResolvedTheme = resolved
      setWebviewTheme(resolved)
      windowManager.broadcastToAll('theme:system-changed', resolved)
      for (const win of windowManager.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.setBackgroundColor(resolved === 'dark' ? '#1e1e2e' : '#eff1f5')
        }
      }
    }
  })

  // 通知管理器初始化 — 接收 WindowManager
  const notifMgr = new NotificationManager(windowManager)
  setNotificationManager(notifMgr)

  // D-12: 自动更新初始化（检查 GitHub Releases）
  setupAutoUpdater(mainWindow)

  // D-09: 首次启动检查右键菜单注册表 (UX-10)
  ensureContextMenuRegistered()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      windowManager.createMainWindow()
    }
  })
})

app.on('before-quit', async () => {
  stopAllWatchers()
  await shutdownClaude()
  stopWebviewServer()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

/** 获取当前 resolved 主题（供通知管理器等模块使用） */
export function getCurrentTheme(): 'dark' | 'light' {
  return currentResolvedTheme
}

/** 检查并补注册右键菜单（D-09 双重注册保障） */
function ensureContextMenuRegistered(): void {
  if (!app.isPackaged) return // 开发模式不注册

  const exePath = app.getPath('exe')
  const regCheckCmd = 'reg query "HKCU\\Software\\Classes\\Directory\\shell\\ai-tools" /ve 2>nul'

  try {
    execSync(regCheckCmd, { stdio: 'pipe' })
    // 键已存在，无需操作
  } catch {
    // 键不存在，补注册
    const regKey = 'HKCU\\Software\\Classes\\Directory\\shell\\ai-tools'
    execSync(`reg add "${regKey}" /ve /d "使用 AI Tools 打开" /f`, { stdio: 'pipe' })
    execSync(`reg add "${regKey}" /v Icon /d "${exePath}" /f`, { stdio: 'pipe' })
    execSync(`reg add "${regKey}\\command" /ve /d "\\"${exePath}\\" \\"%V\\"" /f`, {
      stdio: 'pipe'
    })

    const bgKey = 'HKCU\\Software\\Classes\\Directory\\Background\\shell\\ai-tools'
    execSync(`reg add "${bgKey}" /ve /d "使用 AI Tools 打开当前目录" /f`, { stdio: 'pipe' })
    execSync(`reg add "${bgKey}" /v Icon /d "${exePath}" /f`, { stdio: 'pipe' })
    execSync(`reg add "${bgKey}\\command" /ve /d "\\"${exePath}\\" \\"%V\\"" /f`, {
      stdio: 'pipe'
    })
  }
}
