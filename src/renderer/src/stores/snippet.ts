import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

/** 收藏片段 */
export interface Snippet {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
}

/** localStorage 存储键名 */
const SNIPPETS_KEY = 'aitools-snippets'

/**
 * 安全解析 JSON 字符串，解析失败返回空数组
 * @param raw - JSON 字符串
 */
function safeParse(raw: string): Snippet[] {
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

/**
 * 收藏片段 store — localStorage 持久化 (per D-08)
 *
 * 支持基础 CRUD 管理 (per D-09)，以及从剪贴板历史提升 (per D-10)。
 * 深度监听 snippets 数组变化，自动写入 localStorage。
 */
export const useSnippetStore = defineStore('snippet', () => {
  // 从 localStorage 加载已有片段
  const raw = localStorage.getItem(SNIPPETS_KEY)
  const snippets = ref<Snippet[]>(raw ? safeParse(raw) : [])

  // 自动持久化：深度监听 snippets 变化，自动写入 localStorage
  watch(
    snippets,
    (newVal) => {
      localStorage.setItem(SNIPPETS_KEY, JSON.stringify(newVal))
    },
    { deep: true }
  )

  /**
   * 添加片段到列表最前面
   */
  function addSnippet(title: string, content: string): void {
    snippets.value.unshift({
      id: `snippet_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      title,
      content,
      createdAt: Date.now(),
      updatedAt: Date.now()
    })
  }

  /**
   * 从剪贴板历史提升为收藏片段 (per D-10)
   * @param text - 剪贴板文本内容
   * @param title - 可选标题，不提供时使用文本前 30 个字符
   */
  function promoteFromClipboard(text: string, title?: string): void {
    addSnippet(title || text.slice(0, 30), text)
  }

  /**
   * 按 ID 更新片段的标题和/或内容
   */
  function updateSnippet(
    id: string,
    patch: Partial<Pick<Snippet, 'title' | 'content'>>
  ): void {
    const idx = snippets.value.findIndex((s) => s.id === id)
    if (idx === -1) return
    snippets.value[idx] = {
      ...snippets.value[idx],
      ...patch,
      updatedAt: Date.now()
    }
  }

  /**
   * 按 ID 删除片段
   */
  function deleteSnippet(id: string): void {
    snippets.value = snippets.value.filter((s) => s.id !== id)
  }

  return { snippets, addSnippet, promoteFromClipboard, updateSnippet, deleteSnippet }
})
