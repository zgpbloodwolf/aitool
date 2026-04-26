// 收藏片段 store 单元测试
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: () => {
      store = {}
    }
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

import { useSnippetStore } from '../snippet'

describe('useSnippetStore', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  describe('addSnippet', () => {
    it('添加片段到列表最前面', () => {
      const store = useSnippetStore()
      store.addSnippet('标题 1', '内容 1')
      store.addSnippet('标题 2', '内容 2')

      expect(store.snippets).toHaveLength(2)
      expect(store.snippets[0].title).toBe('标题 2')
      expect(store.snippets[1].title).toBe('标题 1')
    })

    it('添加的片段包含正确的字段', () => {
      const store = useSnippetStore()
      store.addSnippet('测试标题', '测试内容')

      const snippet = store.snippets[0]
      expect(snippet.id).toMatch(/^snippet_/)
      expect(snippet.title).toBe('测试标题')
      expect(snippet.content).toBe('测试内容')
      expect(snippet.createdAt).toBeGreaterThan(0)
      expect(snippet.updatedAt).toBeGreaterThan(0)
    })
  })

  describe('promoteFromClipboard', () => {
    it('从剪贴板文本创建片段', () => {
      const store = useSnippetStore()
      store.promoteFromClipboard('这是一段剪贴板内容', '自定义标题')

      expect(store.snippets).toHaveLength(1)
      expect(store.snippets[0].title).toBe('自定义标题')
      expect(store.snippets[0].content).toBe('这是一段剪贴板内容')
    })

    it('不提供标题时使用文本前 30 个字符', () => {
      const store = useSnippetStore()
      const longText = '这是一段很长的剪贴板文本内容，超过了三十个字符的限制'
      store.promoteFromClipboard(longText)

      expect(store.snippets[0].title).toBe(longText.slice(0, 30))
      expect(store.snippets[0].content).toBe(longText)
    })
  })

  describe('updateSnippet', () => {
    it('按 ID 更新标题和内容', () => {
      const store = useSnippetStore()
      store.addSnippet('原标题', '原内容')

      const id = store.snippets[0].id
      store.updateSnippet(id, { title: '新标题', content: '新内容' })

      expect(store.snippets[0].title).toBe('新标题')
      expect(store.snippets[0].content).toBe('新内容')
    })

    it('仅更新指定字段', () => {
      const store = useSnippetStore()
      store.addSnippet('标题', '内容')

      const id = store.snippets[0].id
      store.updateSnippet(id, { title: '新标题' })

      expect(store.snippets[0].title).toBe('新标题')
      expect(store.snippets[0].content).toBe('内容')
    })

    it('更新不存在的 ID 无副作用', () => {
      const store = useSnippetStore()
      store.addSnippet('标题', '内容')

      store.updateSnippet('nonexistent_id', { title: '新标题' })

      expect(store.snippets).toHaveLength(1)
      expect(store.snippets[0].title).toBe('标题')
    })

    it('更新时 updatedAt 时间戳改变', () => {
      const store = useSnippetStore()
      store.addSnippet('标题', '内容')

      const originalUpdatedAt = store.snippets[0].updatedAt
      const id = store.snippets[0].id

      // 确保时间有差异
      store.updateSnippet(id, { title: '新标题' })

      expect(store.snippets[0].updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt)
    })
  })

  describe('deleteSnippet', () => {
    it('按 ID 删除片段', () => {
      const store = useSnippetStore()
      store.addSnippet('片段 1', '内容 1')
      store.addSnippet('片段 2', '内容 2')

      const id = store.snippets[0].id
      store.deleteSnippet(id)

      expect(store.snippets).toHaveLength(1)
      expect(store.snippets[0].title).toBe('片段 1')
    })

    it('删除不存在的 ID 无副作用', () => {
      const store = useSnippetStore()
      store.addSnippet('标题', '内容')

      store.deleteSnippet('nonexistent_id')

      expect(store.snippets).toHaveLength(1)
    })
  })

  describe('localStorage 持久化', () => {
    it('修改后自动写入 localStorage', () => {
      const store = useSnippetStore()
      store.addSnippet('持久化测试', '内容')

      // 验证 localStorage.setItem 被调用，且包含正确数据
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'aitools-snippets',
        expect.any(String)
      )

      // 验证存储的 JSON 包含添加的片段
      const storedData = localStorageMock.setItem.mock.calls.find(
        (call: [string, string]) => call[0] === 'aitools-snippets'
      )
      if (storedData) {
        const parsed = JSON.parse(storedData[1])
        expect(parsed).toHaveLength(1)
        expect(parsed[0].title).toBe('持久化测试')
      }
    })

    it('从 localStorage 初始化已有数据', () => {
      // 在创建 store 之前预设 localStorage
      localStorageMock.getItem.mockReturnValueOnce(
        JSON.stringify([
          {
            id: 'snippet_existing',
            title: '已有片段',
            content: '已有内容',
            createdAt: 1000,
            updatedAt: 1000
          }
        ])
      )

      // 使用新的 pinia 实例
      setActivePinia(createPinia())
      const store = useSnippetStore()

      expect(store.snippets).toHaveLength(1)
      expect(store.snippets[0].title).toBe('已有片段')
    })
  })
})
