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

  // 标签拖拽出窗口 — 开始拖拽预览
  ipcMain.on('tab-drag:start', (_event, data: { channelId: string; tabId: string }) => {
    // 校验参数格式
    if (typeof data.channelId !== 'string' || typeof data.tabId !== 'string') return
    windowManager.startDragPreview(data.channelId, data.tabId)
  })

  // 标签拖拽出窗口 — 结束拖拽，创建新窗口
  ipcMain.handle('tab-drag:end', (event) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BrowserWindow } = require('electron') as typeof import('electron')
    const sourceWindow = BrowserWindow.fromWebContents(event.sender)
    const _sourceWindowId = sourceWindow?.id
    if (!_sourceWindowId) return { success: false, error: '无法确定源窗口' }

    // 先获取拖拽状态（finalizeDragOut 会清除状态）
    const dragState = windowManager.getDragState()

    const result = windowManager.finalizeDragOut(sourceWindowId)
    if (result) {
      // 通知新窗口恢复标签页
      if (dragState.channelId) {
        result.window.webContents.send('window:restore-tab', {
          channelId: dragState.channelId,
          tabId: dragState.tabId,
          label: dragState.tabId || '对话'
        })
      }
      return {
        success: true,
        windowId: result.windowId,
        channelId: dragState.channelId,
        tabId: dragState.tabId
      }
    }
    return { success: false, error: '拖拽取消或失败' }
  })

  // 标签拖拽出窗口 — 取消拖拽
  ipcMain.on('tab-drag:cancel', () => {
    windowManager.cancelDrag()
  })
}
