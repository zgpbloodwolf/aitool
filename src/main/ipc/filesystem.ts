import { readdir, readFile, stat } from 'fs/promises'
import { ipcMain } from 'electron'

export function registerFilesystemHandlers(): void {
  ipcMain.handle('fs:readDir', async (_event, dirPath: string) => {
    const entries = await readdir(dirPath, { withFileTypes: true })
    return entries
      .filter((e) => !e.name.startsWith('.'))
      .map((e) => ({ name: e.name, isDirectory: e.isDirectory(), isFile: e.isFile() }))
  })

  ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
    return await readFile(filePath, 'utf-8')
  })

  ipcMain.handle('fs:stat', async (_event, filePath: string) => {
    const s = await stat(filePath)
    return { isFile: s.isFile(), isDirectory: s.isDirectory(), size: s.size }
  })
}
