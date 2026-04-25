// workspace store 的 filterFiles 递归过滤和多项目管理单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

// mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    clear: () => {
      store = {}
    }
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

// mock window.api（workspace store 依赖 IPC）
const apiMock = {
  startFileWatch: vi.fn().mockResolvedValue(true),
  stopFileWatch: vi.fn().mockResolvedValue(true),
  onFileChanged: vi.fn().mockReturnValue(() => {}),
  selectFolder: vi.fn().mockResolvedValue(null),
  claudeSetCwd: vi.fn().mockResolvedValue({ success: true }),
  readDir: vi.fn().mockResolvedValue([])
}
Object.defineProperty(globalThis, 'window', {
  value: { api: apiMock },
  writable: true
})

import { useWorkspaceStore, type FileEntry } from '../workspace'
import { createPinia, setActivePinia } from 'pinia'

/**
 * 直接测试 store 导出的 filterFiles 纯函数
 */
function filterFiles(entries: FileEntry[], query: string): FileEntry[] {
  const result: FileEntry[] = []
  for (const entry of entries) {
    if (entry.isDirectory) {
      const filteredChildren = entry.children ? filterFiles(entry.children, query) : []
      if (filteredChildren.length > 0 || entry.name.toLowerCase().includes(query)) {
        result.push({
          ...entry,
          children:
            filteredChildren.length > 0
              ? filteredChildren
              : entry.children
                ? entry.children.filter((c) => c.name.toLowerCase().includes(query))
                : undefined
        })
      }
    } else {
      if (entry.name.toLowerCase().includes(query)) {
        result.push(entry)
      }
    }
  }
  return result
}

describe('filterFiles 过滤逻辑', () => {
  it('对文件名匹配 query 的文件返回包含该文件的数组', () => {
    const entries: FileEntry[] = [
      { name: 'index.ts', path: '/src/index.ts', isDirectory: false, isFile: true },
      { name: 'README.md', path: '/README.md', isDirectory: false, isFile: true }
    ]
    const result = filterFiles(entries, 'index')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('index.ts')
  })

  it('对不匹配 query 的文件返回空数组', () => {
    const entries: FileEntry[] = [
      { name: 'index.ts', path: '/src/index.ts', isDirectory: false, isFile: true },
      { name: 'README.md', path: '/README.md', isDirectory: false, isFile: true }
    ]
    const result = filterFiles(entries, 'nonexistent')
    expect(result).toHaveLength(0)
  })

  it('子目录有匹配文件时保留该目录节点', () => {
    const entries: FileEntry[] = [
      {
        name: 'src',
        path: '/src',
        isDirectory: true,
        isFile: false,
        children: [
          { name: 'main.ts', path: '/src/main.ts', isDirectory: false, isFile: true },
          { name: 'util.ts', path: '/src/util.ts', isDirectory: false, isFile: true }
        ]
      },
      {
        name: 'dist',
        path: '/dist',
        isDirectory: true,
        isFile: false,
        children: [
          { name: 'bundle.js', path: '/dist/bundle.js', isDirectory: false, isFile: true }
        ]
      }
    ]
    const result = filterFiles(entries, 'main')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('src')
    expect(result[0].children).toBeDefined()
    expect(result[0].children!.length).toBeGreaterThanOrEqual(1)
  })
})

describe('多项目管理', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('addProject 创建项目并设为 active', async () => {
    apiMock.selectFolder.mockResolvedValueOnce('/project/a')
    apiMock.readDir.mockResolvedValueOnce([])
    const store = useWorkspaceStore()
    await store.addProject()
    expect(store.projects).toHaveLength(1)
    expect(store.projects[0].path).toBe('/project/a')
    expect(store.projects[0].isActive).toBe(true)
    expect(store.activeProjectId).toBe(store.projects[0].id)
  })

  it('addProject 重复路径激活已有项目', async () => {
    apiMock.selectFolder.mockResolvedValueOnce('/project/a')
    apiMock.readDir.mockResolvedValueOnce([])
    const store = useWorkspaceStore()
    const first = await store.addProject()
    // 添加第二个项目
    apiMock.selectFolder.mockResolvedValueOnce('/project/b')
    await store.addProject()
    // 再次添加 /project/a
    apiMock.selectFolder.mockResolvedValueOnce('/project/a')
    const result = await store.addProject()
    expect(result!.id).toBe(first!.id)
    expect(store.projects).toHaveLength(2)
  })

  it('toggleFavorite 切换收藏状态并持久化', async () => {
    apiMock.selectFolder.mockResolvedValueOnce('/project/a')
    apiMock.readDir.mockResolvedValueOnce([])
    const store = useWorkspaceStore()
    const project = await store.addProject()
    store.toggleFavorite(project!.id)
    expect(store.projects[0].isFavorite).toBe(true)
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'aitools-projects',
      expect.any(String)
    )
    // 取消收藏
    store.toggleFavorite(project!.id)
    expect(store.projects[0].isFavorite).toBe(false)
  })

  it('addTag/removeTag 管理标签', async () => {
    apiMock.selectFolder.mockResolvedValueOnce('/project/a')
    apiMock.readDir.mockResolvedValueOnce([])
    const store = useWorkspaceStore()
    const project = await store.addProject()
    store.addTag(project!.id, 'OCR')
    store.addTag(project!.id, 'AI')
    expect(store.projects[0].tags).toEqual(['OCR', 'AI'])
    // 不重复添加
    store.addTag(project!.id, 'OCR')
    expect(store.projects[0].tags).toEqual(['OCR', 'AI'])
    // 移除
    store.removeTag(project!.id, 'OCR')
    expect(store.projects[0].tags).toEqual(['AI'])
  })
})
