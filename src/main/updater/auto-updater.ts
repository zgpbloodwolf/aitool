/**
 * 自动更新模块 — 基于 electron-updater + GitHub Releases
 *
 * D-12: 使用 electron-updater 标准方案，通过 GitHub Releases 分发更新
 * D-13: 应用启动时检查一次新版本
 * D-15: 完整流程：检测 → 提示 → 确认 → 下载进度 → 提示重启
 *
 * 安全：开发模式（未打包）自动跳过更新检查，避免报错
 */

import { autoUpdater, UpdateInfo } from 'electron-updater'
import { BrowserWindow, app, ipcMain } from 'electron'

/**
 * 初始化自动更新器
 *
 * @param mainWindow - 主窗口实例，用于向渲染进程发送更新事件
 */
export function setupAutoUpdater(mainWindow: BrowserWindow): void {
  // 开发模式下不检查更新（未打包时 electron-updater 无法工作）
  if (!app.isPackaged) {
    console.log('[Updater] 开发模式，跳过更新检查')
    return
  }

  // D-14: 不自动下载，让用户选择是否更新
  autoUpdater.autoDownload = false
  // 退出时自动安装已下载的更新
  autoUpdater.autoInstallOnAppQuit = true

  // 发现新版本 — 发送到渲染进程显示提示框
  autoUpdater.on('update-available', (info: UpdateInfo) => {
    console.log('[Updater] 发现新版本:', info.version)
    mainWindow.webContents.send('updater:available', {
      version: info.version,
      releaseNotes: info.releaseNotes
    })
  })

  // 已是最新版本
  autoUpdater.on('update-not-available', () => {
    console.log('[Updater] 已是最新版本')
  })

  // 下载进度 — 转发百分比到渲染进程
  autoUpdater.on('download-progress', (progress) => {
    mainWindow.webContents.send('updater:progress', {
      percent: Math.round(progress.percent),
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total
    })
  })

  // 更新下载完成 — 提示用户重启安装
  autoUpdater.on('update-downloaded', () => {
    console.log('[Updater] 更新已下载完成')
    mainWindow.webContents.send('updater:downloaded')
  })

  // 更新错误 — 通知渲染进程
  autoUpdater.on('error', (err) => {
    console.error('[Updater] 更新错误:', err)
    mainWindow.webContents.send('updater:error', { message: String(err) })
  })

  // IPC: 手动检查更新
  ipcMain.handle('updater:check', async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      return { version: result?.updateInfo?.version || null }
    } catch (e) {
      return { error: String(e) }
    }
  })

  // IPC: 开始下载更新
  ipcMain.on('updater:download', () => {
    autoUpdater.downloadUpdate()
  })

  // IPC: 退出并安装更新
  ipcMain.on('updater:install', () => {
    autoUpdater.quitAndInstall()
  })

  // D-13: 应用启动时自动检查一次新版本
  autoUpdater.checkForUpdates().catch((err) => {
    console.error('[Updater] 启动检查失败:', err)
  })
}
