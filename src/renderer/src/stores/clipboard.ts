import { defineStore } from 'pinia'
import { ref } from 'vue'

/** 剪贴板历史条目 */
export interface ClipboardEntry {
  id: string
  text: string
  timestamp: number
}

/** D-06: 最大保留条目数 */
const MAX_ENTRIES = 50

/**
 * 剪贴板历史 store — 纯内存存储，关闭应用后清空 (per D-05)
 *
 * 仅记录文本内容 (per D-07)，相同文本去重并移到最前，
 * 超过 MAX_ENTRIES 时自动清除最早的记录。
 */
export const useClipboardStore = defineStore('clipboard', () => {
  /** 历史记录列表，最新的在最前面 */
  const history = ref<ClipboardEntry[]>([])

  /**
   * 添加条目
   * - 空文本不记录
   * - 相同文本去重，移到最前并更新时间戳
   * - 超过上限自动清除最早的记录
   */
  function addEntry(text: string): void {
    if (!text.trim()) return

    // 去重：相同文本移除旧条目
    const existingIdx = history.value.findIndex((e) => e.text === text)
    if (existingIdx !== -1) {
      history.value.splice(existingIdx, 1)
    }

    // 新条目插入最前面
    history.value.unshift({
      id: `clip_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      text,
      timestamp: Date.now()
    })

    // D-06: 超出上限自动清除最早的
    if (history.value.length > MAX_ENTRIES) {
      history.value = history.value.slice(0, MAX_ENTRIES)
    }
  }

  /**
   * 按 ID 删除指定条目
   */
  function removeEntry(id: string): void {
    history.value = history.value.filter((e) => e.id !== id)
  }

  /**
   * 清空所有历史记录
   */
  function clearAll(): void {
    history.value = []
  }

  return { history, addEntry, removeEntry, clearAll }
})
