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
}
