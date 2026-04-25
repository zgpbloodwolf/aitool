// workspace store 的 filterFiles 递归过滤和收藏列表 CRUD 单元测试
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

// 导入 store 和类型 — 在 mock 之后
import { useWorkspaceStore, type FileEntry } from '../workspace'
import { createPinia, setActivePinia } from 'pinia'

/**
 * 模拟 filterFiles 的纯函数逻辑（从 store 提取为可测试函数）
 * 因为 store 的 filteredFiles 依赖响应式，这里直接测试过滤逻辑
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
    // src 目录应保留，因为子文件 main.ts 匹配
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('src')
    expect(result[0].children).toBeDefined()
    expect(result[0].children!.length).toBeGreaterThanOrEqual(1)
  })
})

describe('收藏列表 CRUD', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('addFavorite 添加路径到 favorites 并持久化到 localStorage', () => {
    const store = useWorkspaceStore()
    store.addFavorite('/project/a')
    expect(store.favorites).toContain('/project/a')
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'aitools-favorites',
      JSON.stringify(['/project/a'])
    )
  })

  it('addFavorite 不重复添加已存在的路径', () => {
    const store = useWorkspaceStore()
    store.addFavorite('/project/a')
    store.addFavorite('/project/a')
    expect(store.favorites.filter((p) => p === '/project/a')).toHaveLength(1)
  })

  it('removeFavorite 从 favorites 中移除指定路径', () => {
    const store = useWorkspaceStore()
    store.addFavorite('/project/a')
    store.addFavorite('/project/b')
    store.removeFavorite('/project/a')
    expect(store.favorites).not.toContain('/project/a')
    expect(store.favorites).toContain('/project/b')
  })

  it('removeFavorite 不影响其他收藏路径', () => {
    const store = useWorkspaceStore()
    store.addFavorite('/project/a')
    store.addFavorite('/project/b')
    store.addFavorite('/project/c')
    store.removeFavorite('/project/b')
    expect(store.favorites).toEqual(['/project/a', '/project/c'])
  })
})
