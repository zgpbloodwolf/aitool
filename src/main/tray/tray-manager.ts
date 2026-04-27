/**
 * 系统托盘管理器
 *
 * 实现 Windows 系统托盘常驻图标（D-11）：
 * - 右键菜单：新建对话 / 显示窗口 / 退出
 * - 双击托盘图标恢复窗口
 * - 首次关闭窗口时询问：最小化到托盘 or 退出应用，记住用户选择
 * - 关闭行为通过 JSON 文件持久化（主进程无法访问 localStorage）
 */

import { Tray, Menu, nativeImage, BrowserWindow, ipcMain, dialog, app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

// 模块级引用，防止 Tray 实例被 V8 垃圾回收（Pitfall #2）
let tray: Tray | null = null

// 关闭行为偏好文件路径 — 存储在用户数据目录
const CLOSE_BEHAVIOR_FILE = join(app.getPath('userData'), 'close-behavior.json')

// 关闭行为类型：minimize=最小化到托盘, quit=退出应用, ask=首次询问
type CloseBehavior = 'minimize' | 'quit' | 'ask'

/**
 * 从 JSON 文件加载关闭行为偏好
 * 默认返回 'ask'（首次使用时弹出询问对话框）
 */
function loadCloseBehavior(): CloseBehavior {
  try {
    if (existsSync(CLOSE_BEHAVIOR_FILE)) {
      const data = JSON.parse(readFileSync(CLOSE_BEHAVIOR_FILE, 'utf-8'))
      return data.behavior || 'ask'
    }
  } catch {
    // 文件损坏或格式错误，返回默认值
  }
  return 'ask'
}

/**
 * 保存关闭行为偏好到 JSON 文件
 */
function saveCloseBehavior(behavior: CloseBehavior): void {
  writeFileSync(CLOSE_BEHAVIOR_FILE, JSON.stringify({ behavior }), 'utf-8')
}

/**
 * 初始化系统托盘
 *
 * 创建托盘图标、上下文菜单、双击恢复行为，并管理窗口关闭逻辑。
 * 必须在 app.whenReady() 后调用。
 *
 * @param mainWindow - 主窗口实例，用于控制窗口显示/隐藏
 */
export function setupTray(mainWindow: BrowserWindow): void {
  // 解析图标路径 — 开发和生产环境均使用相对路径
  // __dirname 在开发模式指向 out/main/，生产模式也指向同一位置
  const iconPath = join(__dirname, '../../build/icon.ico')
  const icon = nativeImage.createFromPath(iconPath)

  tray = new Tray(icon)
  tray.setToolTip('AI 工具')

  // 右键上下文菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '新建对话',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
        mainWindow.webContents.send('shortcut:new-tab')
      }
    },
    { type: 'separator' },
    {
      label: '显示窗口',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  // 双击托盘图标恢复窗口
  tray.on('double-click', () => {
    mainWindow.show()
    mainWindow.focus()
  })

  // 关闭行为管理
  let isQuitting = false

  app.on('before-quit', () => {
    isQuitting = true
  })

  mainWindow.on('close', (e) => {
    // 用户通过托盘「退出」或 before-quit 触发时，允许正常关闭
    if (isQuitting) return

    const behavior = loadCloseBehavior()

    if (behavior === 'ask') {
      // 首次关闭 — 询问用户并记住选择
      e.preventDefault()
      dialog
        .showMessageBox(mainWindow, {
          type: 'question',
          title: '关闭确认',
          message: '关闭窗口时您希望执行什么操作？',
          buttons: ['最小化到托盘', '退出应用'],
          defaultId: 0,
          noLink: true
        })
        .then(({ response }) => {
          const chosen: CloseBehavior = response === 0 ? 'minimize' : 'quit'
          saveCloseBehavior(chosen)

          // 同步关闭行为到渲染进程的 settings store
          mainWindow.webContents.send('settings:close-behavior-changed', chosen)

          if (chosen === 'minimize') {
            mainWindow.hide()
          } else {
            app.quit()
          }
        })
    } else if (behavior === 'minimize') {
      // 用户选择最小化到托盘
      e.preventDefault()
      mainWindow.hide()
    }
    // behavior === 'quit' — 允许默认关闭行为（app.quit）
  })
}

/**
 * 注册托盘相关 IPC 处理器
 *
 * 渲染进程（SettingsDrawer）通过此通道更新关闭行为偏好。
 * 当用户在设置面板中更改关闭行为时，同步写入 JSON 文件。
 */
export function registerTrayHandlers(): void {
  ipcMain.on('settings:update-close-behavior', (_event, behavior: CloseBehavior) => {
    saveCloseBehavior(behavior)
  })
}
