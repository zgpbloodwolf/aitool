// 文件系统监听 IPC handler — 多项目支持，按 projectId 管理多个 chokidar watcher
import chokidar from 'chokidar'
import { ipcMain, BrowserWindow } from 'electron'

const watchers = new Map<string, chokidar.FSWatcher>()

export function registerFileWatcherHandlers(): void {
  ipcMain.handle('fs:startWatch', (_event, projectId: string, dirPath: string) => {
    stopWatcher(projectId)
    const watcher = chokidar.watch(dirPath, {
      ignored: /node_modules|\.git/,
      persistent: true,
      ignoreInitial: true,
      depth: 10
    })
    watcher.on('all', () => {
      const win = BrowserWindow.getAllWindows()[0]
      if (win) {
        win.webContents.send('fs:changed', projectId)
      }
    })
    watchers.set(projectId, watcher)
    return true
  })

  ipcMain.handle('fs:stopWatch', (_event, projectId: string) => {
    stopWatcher(projectId)
    return true
  })
}

function stopWatcher(projectId: string): void {
  const watcher = watchers.get(projectId)
  if (watcher) {
    watcher.close()
    watchers.delete(projectId)
  }
}

// 应用退出时关闭所有 watcher
export function stopAllWatchers(): void {
  for (const [id, watcher] of watchers) {
    watcher.close()
    watchers.delete(id)
  }
}
