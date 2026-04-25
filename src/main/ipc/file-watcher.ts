// 文件系统监听 IPC handler — 使用 chokidar 监听工作区变更，通知渲染进程刷新文件树
import chokidar from 'chokidar'
import { ipcMain, BrowserWindow } from 'electron'

let watcher: chokidar.FSWatcher | null = null

export function registerFileWatcherHandlers(): void {
  ipcMain.handle('fs:startWatch', (_event, dirPath: string) => {
    stopWatcher()
    watcher = chokidar.watch(dirPath, {
      ignored: /node_modules|\.git/,
      persistent: true,
      ignoreInitial: true,
      depth: 10
    })
    watcher.on('all', () => {
      // 任何文件变更都通知渲染进程刷新文件树
      const win = BrowserWindow.getAllWindows()[0]
      if (win) {
        win.webContents.send('fs:changed')
      }
    })
    return true
  })

  ipcMain.handle('fs:stopWatch', () => {
    stopWatcher()
    return true
  })
}

function stopWatcher(): void {
  if (watcher) {
    watcher.close()
    watcher = null
  }
}
