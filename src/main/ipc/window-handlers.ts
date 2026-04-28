// 窗口管理 IPC 处理器 (UX-11)
// 注册窗口-频道映射、标签激活等 IPC

import { ipcMain } from 'electron'
import type { WindowManager } from '../window/window-manager'

export function registerWindowHandlers(windowManager: WindowManager): void {
  const registry = windowManager.getRegistry()

  // 渲染进程通知主进程某频道属于当前窗口
  ipcMain.on('window:register-channel', (event, channelId: string) => {
    // 校验 channelId 格式，防止注入 (T-08-01)
    if (typeof channelId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(channelId)) {
      return
    }
    const senderWebContentsId = event.sender.id
    for (const win of windowManager.getAllWindows()) {
      if (win.webContents.id === senderWebContentsId) {
        registry.registerChannel(win.id, channelId)
        return
      }
    }
  })

  // 标签激活通知
  ipcMain.on('window:tab-activated', (event, _channelId: string) => {
    const senderWebContentsId = event.sender.id
    for (const win of windowManager.getAllWindows()) {
      if (win.webContents.id === senderWebContentsId) {
        // 更新最后活跃窗口 ID（focus 事件已处理，此处为辅助）
        return
      }
    }
  })

  // 返回当前窗口 ID
  ipcMain.handle('window:get-window-id', (event) => {
    return event.sender.id
  })
}
