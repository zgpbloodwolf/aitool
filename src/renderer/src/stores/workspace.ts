import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  isFile: boolean
  children?: FileEntry[]
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const rootPath = ref<string | null>(null)
  const files = ref<FileEntry[]>([])
  const expandedDirs = ref(new Set<string>())
  const selectedFile = ref<string | null>(null)

  async function openFolder(): Promise<void> {
    const path = await window.api.selectFolder()
    if (path) {
      rootPath.value = path
      await window.api.claudeSetCwd(path)
      expandedDirs.value.clear()
      files.value = await loadDirectory(path)
      await startWatch()
    }
  }

  async function loadDirectory(dirPath: string): Promise<FileEntry[]> {
    const entries = await window.api.readDir(dirPath)
    const result: FileEntry[] = []
    for (const entry of entries) {
      const fullPath = `${dirPath}/${entry.name}`
      const item: FileEntry = {
        name: entry.name,
        path: fullPath,
        isDirectory: entry.isDirectory,
        isFile: entry.isFile
      }
      if (entry.isDirectory && expandedDirs.value.has(fullPath)) {
        item.children = await loadDirectory(fullPath)
      }
      result.push(item)
    }
    result.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    return result
  }

  async function toggleDir(path: string): Promise<void> {
    if (expandedDirs.value.has(path)) {
      expandedDirs.value.delete(path)
    } else {
      expandedDirs.value.add(path)
    }
    // Incremental update: only reload children of the toggled directory
    await updateNodeChildren(files.value, path)
  }

  async function updateNodeChildren(nodes: FileEntry[], targetPath: string): Promise<boolean> {
    for (const node of nodes) {
      if (node.path === targetPath && node.isDirectory) {
        node.children = await loadDirectory(targetPath)
        return true
      }
      if (node.children) {
        const found = await updateNodeChildren(node.children, targetPath)
        if (found) return true
      }
    }
    return false
  }

  function selectFile(path: string): void {
    selectedFile.value = path
  }

  // 文件监听：chokidar 主进程监听文件变更，通过 IPC 通知渲染进程
  let offFileChanged: (() => void) | null = null

  async function startWatch(): Promise<void> {
    if (!rootPath.value) return
    stopWatch()
    await window.api.startFileWatch(rootPath.value)
    offFileChanged = window.api.onFileChanged(async () => {
      // 文件变更时刷新文件树
      if (rootPath.value) {
        files.value = await loadDirectory(rootPath.value)
      }
    })
  }

  function stopWatch(): void {
    if (offFileChanged) {
      offFileChanged()
      offFileChanged = null
    }
    window.api.stopFileWatch()
  }

  // 搜索过滤和收藏目录所需的基础 ref（Task 2 使用）
  const filterText = ref('')
  const favorites = ref<string[]>(JSON.parse(localStorage.getItem('aitools-favorites') || '[]'))

  return {
    rootPath,
    files,
    expandedDirs,
    selectedFile,
    filterText,
    favorites,
    openFolder,
    toggleDir,
    selectFile,
    startWatch,
    stopWatch
  }
})
