import { dialog, BrowserWindow, ipcMain } from 'electron'

export function registerDialogHandlers(): void {
  ipcMain.handle('dialog:selectFolder', async () => {
    const window = BrowserWindow.getFocusedWindow()
    if (!window) return null

    const result = await dialog.showOpenDialog(window, {
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0] ?? null
  })

  // UX-07: 保存文件对话框 — 用于导出对话为 Markdown
  ipcMain.handle(
    'dialog:showSaveDialog',
    async (
      _event,
      options: { defaultPath: string; title: string }
    ) => {
      const window = BrowserWindow.getFocusedWindow()
      if (!window) return { canceled: true, filePath: '' }
      const result = await dialog.showSaveDialog(window, {
        title: options.title,
        defaultPath: options.defaultPath,
        filters: [{ name: 'Markdown', extensions: ['md'] }]
      })
      return { canceled: result.canceled, filePath: result.filePath || '' }
    }
  )
}
