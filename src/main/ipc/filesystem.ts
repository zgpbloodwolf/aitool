import { readdir, readFile, stat, realpath } from 'fs/promises'
import { ipcMain } from 'electron'
import { resolve, normalize, sep } from 'path'

const allowedRoots = new Set<string>()

export function addAllowedRoot(rootPath: string): void {
  allowedRoots.add(normalize(resolve(rootPath)))
}

async function isPathAllowed(filePath: string): Promise<boolean> {
  if (allowedRoots.size === 0) return false
  try {
    // 使用 realpath 解析符号链接后再检查白名单 (per D-22)
    const resolved = await realpath(normalize(resolve(filePath)))
    for (const root of allowedRoots) {
      if (resolved === root || resolved.startsWith(root + sep)) return true
    }
  } catch {
    // realpath 失败（文件不存在等），使用原始路径检查
    const normalized = normalize(resolve(filePath))
    for (const root of allowedRoots) {
      if (normalized === root || normalized.startsWith(root + sep)) return true
    }
  }
  return false
}

export function registerFilesystemHandlers(): void {
  ipcMain.handle('fs:readDir', async (_event, dirPath: string) => {
    if (!(await isPathAllowed(dirPath))) throw new Error('Access denied: path outside workspace')
    const entries = await readdir(dirPath, { withFileTypes: true })
    return entries
      .filter((e) => !e.name.startsWith('.'))
      .map((e) => ({ name: e.name, isDirectory: e.isDirectory(), isFile: e.isFile() }))
  })

  ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
    if (!(await isPathAllowed(filePath))) throw new Error('Access denied: path outside workspace')
    return await readFile(filePath, 'utf-8')
  })

  ipcMain.handle('fs:stat', async (_event, filePath: string) => {
    if (!(await isPathAllowed(filePath))) throw new Error('Access denied: path outside workspace')
    const s = await stat(filePath)
    return { isFile: s.isFile(), isDirectory: s.isDirectory(), size: s.size }
  })
}
