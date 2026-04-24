import { readdir, readFile, stat } from 'fs/promises'
import { ipcMain } from 'electron'
import { resolve, normalize, sep } from 'path'

const allowedRoots = new Set<string>()

export function addAllowedRoot(rootPath: string): void {
  allowedRoots.add(normalize(resolve(rootPath)))
}

function isPathAllowed(filePath: string): boolean {
  if (allowedRoots.size === 0) return false
  const normalized = normalize(resolve(filePath))
  for (const root of allowedRoots) {
    if (normalized === root || normalized.startsWith(root + sep)) return true
  }
  return false
}

export function registerFilesystemHandlers(): void {
  ipcMain.handle('fs:readDir', async (_event, dirPath: string) => {
    if (!isPathAllowed(dirPath)) throw new Error('Access denied: path outside workspace')
    const entries = await readdir(dirPath, { withFileTypes: true })
    return entries
      .filter((e) => !e.name.startsWith('.'))
      .map((e) => ({ name: e.name, isDirectory: e.isDirectory(), isFile: e.isFile() }))
  })

  ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
    if (!isPathAllowed(filePath)) throw new Error('Access denied: path outside workspace')
    return await readFile(filePath, 'utf-8')
  })

  ipcMain.handle('fs:stat', async (_event, filePath: string) => {
    if (!isPathAllowed(filePath)) throw new Error('Access denied: path outside workspace')
    const s = await stat(filePath)
    return { isFile: s.isFile(), isDirectory: s.isDirectory(), size: s.size }
  })
}
