// 剪贴板历史 store 单元测试
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// mock localStorage（clipboard store 不使用 localStorage，但全局 mock 以防万一）
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

import { useClipboardStore } from '../clipboard'

describe('useClipboardStore', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  describe('addEntry', () => {
    it('添加文本到历史记录最前面', () => {
      const store = useClipboardStore()
      store.addEntry('第一条')
      store.addEntry('第二条')

      expect(store.history).toHaveLength(2)
      expect(store.history[0].text).toBe('第二条')
      expect(store.history[1].text).toBe('第一条')
    })

    it('相同文本不重复，移到最前并更新时间戳', () => {
      const store = useClipboardStore()
      store.addEntry('重复文本')

      // 确保时间戳差异
      const firstTimestamp = store.history[0].timestamp
      expect(firstTimestamp).toBeGreaterThan(0)

      // 再次添加相同文本
      store.addEntry('重复文本')

      expect(store.history).toHaveLength(1)
      expect(store.history[0].text).toBe('重复文本')
      // 时间戳应被更新（新的 ID 和 timestamp）
      expect(store.history[0].timestamp).toBeGreaterThanOrEqual(firstTimestamp)
    })

    it('空文本不记录', () => {
      const store = useClipboardStore()
      store.addEntry('')
      store.addEntry('   ')
      store.addEntry('\t\n')

      expect(store.history).toHaveLength(0)
    })

    it('超过 50 条时自动清除最早的记录', () => {
      const store = useClipboardStore()

      // 添加 52 条不同文本
      for (let i = 0; i < 52; i++) {
        store.addEntry(`文本 ${i}`)
      }

      expect(store.history).toHaveLength(50)
      // 最前面应该是最后添加的
      expect(store.history[0].text).toBe('文本 51')
      // 最早的记录已被清除
      expect(store.history.find(e => e.text === '文本 0')).toBeUndefined()
    })
  })

  describe('removeEntry', () => {
    it('按 ID 删除指定条目', () => {
      const store = useClipboardStore()
      store.addEntry('保留')
      store.addEntry('删除')

      const targetId = store.history[0].id
      store.removeEntry(targetId)

      expect(store.history).toHaveLength(1)
      expect(store.history[0].text).toBe('保留')
    })

    it('删除不存在的 ID 无副作用', () => {
      const store = useClipboardStore()
      store.addEntry('内容')

      store.removeEntry('nonexistent_id')

      expect(store.history).toHaveLength(1)
    })
  })

  describe('clearAll', () => {
    it('清空所有历史', () => {
      const store = useClipboardStore()
      store.addEntry('条目 1')
      store.addEntry('条目 2')
      store.addEntry('条目 3')

      store.clearAll()

      expect(store.history).toHaveLength(0)
    })
  })
})
