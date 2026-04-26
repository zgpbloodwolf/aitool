import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { execSync } from 'child_process'
import { registerDialogHandlers } from './ipc/dialog'
import { registerFilesystemHandlers } from './ipc/filesystem'
import { registerExtensionHandlers } from './ipc/extensions'
import { registerClaudeWebviewHandlers, shutdownClaude } from './ipc/claude-webview'
import { registerFileWatcherHandlers, stopAllWatchers } from './ipc/file-watcher'
import { stopWebviewServer } from './claude/webview-server'
import { setupTray, registerTrayHandlers } from './tray/tray-manager'

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
  const win = BrowserWindow.getAllWindows()[0]
  if (win) {
    dialog.showErrorBox('应用错误', '发生意外错误，请查看日志或重启应用。\n' + String(err))
  }
})

// D-24: 未处理的 Promise 拒绝 — 仅记录日志，不退出进程
process.on('unhandledRejection', (reason) => {
  console.error('[主进程] 未处理的 Promise 拒绝:', reason)
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

  // D-05: 在主进程拦截快捷键，解决 iframe 获取焦点后渲染进程收不到键盘事件的问题
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (!input.control && !input.meta) return
    const shortcuts: Record<string, string> = {
      'n': 'shortcut:new-tab',
      'w': 'shortcut:close-tab',
      'b': 'shortcut:toggle-sidebar',
      ',': 'shortcut:open-settings',
      '0': 'shortcut:reset-zoom'
    }
    if (input.key === 'Tab') {
      event.preventDefault()
      mainWindow.webContents.send(input.shift ? 'shortcut:prev-tab' : 'shortcut:next-tab')
      return
    }
    const channel = shortcuts[input.key.toLowerCase()]
    if (channel) {
      event.preventDefault()
      mainWindow.webContents.send(channel)
    }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
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
  registerFileWatcherHandlers()

  const mainWindow = createWindow()
  setupTray(mainWindow)
  registerTrayHandlers()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
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
