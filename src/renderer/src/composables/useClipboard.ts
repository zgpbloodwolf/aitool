import { useClipboardStore } from '../stores/clipboard'

/**
 * 剪贴板操作 composable — 在用户操作时读取剪贴板并记录历史
 *
 * 不做后台轮询（per RESEARCH Pitfall 2），仅在用户明确的操作时刻
 * （如点击按钮）调用 navigator.clipboard API。
 * 必须在用户手势回调中调用（浏览器安全策略限制）。
 */
export function useClipboard() {
  const clipboardStore = useClipboardStore()

  /**
   * 读取当前剪贴板内容并记录到历史
   * 必须在用户手势回调中调用（浏览器安全策略限制）
   * @returns 剪贴板文本内容，读取失败返回 null
   */
  async function readAndRecord(): Promise<string | null> {
    try {
      const text = await navigator.clipboard.readText()
      if (text.trim()) {
        clipboardStore.addEntry(text)
      }
      return text
    } catch {
      return null
    }
  }

  /**
   * 将文本写入剪贴板并记录到历史
   * @param text - 要写入剪贴板的文本
   * @returns 写入是否成功
   */
  async function pasteText(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text)
      clipboardStore.addEntry(text)
      return true
    } catch {
      return false
    }
  }

  return { readAndRecord, pasteText }
}
