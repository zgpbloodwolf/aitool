import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { execSync } from 'child_process'
import { registerDialogHandlers } from './ipc/dialog'
import { registerFilesystemHandlers } from './ipc/filesystem'
import { registerExtensionHandlers, shutdownExtensionHost } from './ipc/extensions'
import { registerClaudeWebviewHandlers, shutdownClaude } from './ipc/claude-webview'
import { bootstrapWeChat, registerWeChatHandlers } from './ipc/wechat'
import { stopWebviewServer } from './claude/webview-server'

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

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: true,
    frame: true,
    title: 'AI 工具',
    backgroundColor: '#1e1e2e',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  // 隐藏默认的英文菜单栏
  mainWindow.setMenu(null)

  // 防止页面标题被覆盖（例如 iframe 内的 Claude Code webview 可能修改标题）
  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault()
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    mainWindow.focus()
    if (!app.isPackaged) {
      mainWindow.webContents.openDevTools({ mode: 'bottom' })
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

if (!app.isPackaged) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222')
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.aitools.desktop')

  registerDialogHandlers()
  registerFilesystemHandlers()
  registerExtensionHandlers()
  registerClaudeWebviewHandlers()
  registerWeChatHandlers()
  void bootstrapWeChat()

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', async () => {
  await shutdownClaude()
  stopWebviewServer()
  await shutdownExtensionHost()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
