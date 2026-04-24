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
      await refreshFiles()
    }
  }

  async function refreshFiles(): Promise<void> {
    if (!rootPath.value) return
    files.value = await loadDirectory(rootPath.value)
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
    await refreshFiles()
  }

  function selectFile(path: string): void {
    selectedFile.value = path
  }

  return { rootPath, files, expandedDirs, selectedFile, openFolder, refreshFiles, toggleDir, selectFile }
})
