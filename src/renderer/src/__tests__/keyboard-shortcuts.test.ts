/**
 * 全局键盘快捷键单元测试 (D-05)
 *
 * 测试 handleGlobalKeydown 逻辑：
 * - Ctrl+N 创建新对话标签
 * - Ctrl+W 关闭当前标签
 * - Ctrl+B 切换侧边栏显示/隐藏
 * - Ctrl+Tab 切换到下一个标签
 * - Ctrl+Shift+Tab 切换到上一个标签
 *
 * 采用直接测试 keydown 处理逻辑的方式，避免完整 App 组件的复杂依赖。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, type Ref } from 'vue'

// 模拟 ChatPanel exposed 方法
function createMockChatPanel() {
  return {
    addNewTab: vi.fn(),
    closeTab: vi.fn(),
    switchTab: vi.fn(),
    switchToNextTab: vi.fn(),
    switchToPrevTab: vi.fn(),
    hasActiveChannels: vi.fn(),
    activeTabId: ref('tab-1') as Ref<string | null>
  }
}

// 模拟 sidebarVisible ref
function createSidebarRef() {
  return ref(true)
}

// 从 App.vue 提取的核心快捷键处理逻辑
// 与 App.vue 中 handleGlobalKeydown 逻辑保持一致
function createKeydownHandler(
  chatPanel: ReturnType<typeof createMockChatPanel>,
  sidebarVisible: Ref<boolean>
) {
  return function handleGlobalKeydown(e: KeyboardEvent): void {
    // Ctrl+Tab 必须在最前面 preventDefault
    if (e.ctrlKey && e.key === 'Tab') {
      e.preventDefault()
      if (e.shiftKey) {
        chatPanel.switchToPrevTab()
      } else {
        chatPanel.switchToNextTab()
      }
      return
    }

    // Ctrl+N: 新建对话标签
    if (e.ctrlKey && e.key === 'n') {
      e.preventDefault()
      chatPanel.addNewTab()
      return
    }

    // Ctrl+W: 关闭当前标签
    if (e.ctrlKey && e.key === 'w') {
      e.preventDefault()
      const activeId = chatPanel.activeTabId.value
      if (activeId) {
        chatPanel.closeTab(activeId)
      }
      return
    }

    // Ctrl+B: 切换侧边栏
    if (e.ctrlKey && e.key === 'b') {
      e.preventDefault()
      sidebarVisible.value = !sidebarVisible.value
      return
    }
  }
}

// 创建模拟 KeyboardEvent
function createKeyboardEvent(
  key: string,
  options: { ctrlKey?: boolean; shiftKey?: boolean } = {}
): KeyboardEvent {
  return {
    key,
    ctrlKey: options.ctrlKey ?? false,
    shiftKey: options.shiftKey ?? false,
    preventDefault: vi.fn()
  } as unknown as KeyboardEvent
}

describe('全局键盘快捷键 handleGlobalKeydown', () => {
  let chatPanel: ReturnType<typeof createMockChatPanel>
  let sidebarVisible: Ref<boolean>
  let handler: (e: KeyboardEvent) => void

  beforeEach(() => {
    chatPanel = createMockChatPanel()
    sidebarVisible = createSidebarRef()
    handler = createKeydownHandler(chatPanel, sidebarVisible)
  })

  // Ctrl+N
  it('Ctrl+N 触发 addNewTab', () => {
    const e = createKeyboardEvent('n', { ctrlKey: true })
    handler(e)
    expect(chatPanel.addNewTab).toHaveBeenCalledTimes(1)
    expect(e.preventDefault).toHaveBeenCalled()
  })

  // Ctrl+W
  it('Ctrl+W 触发 closeTab 并传入当前活跃 tabId', () => {
    chatPanel.activeTabId.value = 'tab-1'
    const e = createKeyboardEvent('w', { ctrlKey: true })
    handler(e)
    expect(chatPanel.closeTab).toHaveBeenCalledWith('tab-1')
    expect(e.preventDefault).toHaveBeenCalled()
  })

  // Ctrl+W 无活跃标签时不调用 closeTab
  it('Ctrl+W 无活跃标签时不调用 closeTab', () => {
    chatPanel.activeTabId.value = null
    const e = createKeyboardEvent('w', { ctrlKey: true })
    handler(e)
    expect(chatPanel.closeTab).not.toHaveBeenCalled()
    expect(e.preventDefault).toHaveBeenCalled()
  })

  // Ctrl+B
  it('Ctrl+B 切换侧边栏显示状态', () => {
    expect(sidebarVisible.value).toBe(true)
    const e = createKeyboardEvent('b', { ctrlKey: true })
    handler(e)
    expect(sidebarVisible.value).toBe(false)
    expect(e.preventDefault).toHaveBeenCalled()
  })

  it('Ctrl+B 连续按两次恢复原状态', () => {
    expect(sidebarVisible.value).toBe(true)
    handler(createKeyboardEvent('b', { ctrlKey: true }))
    expect(sidebarVisible.value).toBe(false)
    handler(createKeyboardEvent('b', { ctrlKey: true }))
    expect(sidebarVisible.value).toBe(true)
  })

  // Ctrl+Tab
  it('Ctrl+Tab 触发 switchToNextTab', () => {
    const e = createKeyboardEvent('Tab', { ctrlKey: true })
    handler(e)
    expect(chatPanel.switchToNextTab).toHaveBeenCalledTimes(1)
    expect(e.preventDefault).toHaveBeenCalled()
  })

  // Ctrl+Shift+Tab
  it('Ctrl+Shift+Tab 触发 switchToPrevTab', () => {
    const e = createKeyboardEvent('Tab', { ctrlKey: true, shiftKey: true })
    handler(e)
    expect(chatPanel.switchToPrevTab).toHaveBeenCalledTimes(1)
    expect(e.preventDefault).toHaveBeenCalled()
  })

  // Ctrl+Shift+N 也创建新标签（降级处理）
  it('Ctrl+Shift+N 也触发 addNewTab', () => {
    const e = createKeyboardEvent('n', { ctrlKey: true, shiftKey: true })
    handler(e)
    expect(chatPanel.addNewTab).toHaveBeenCalledTimes(1)
    expect(e.preventDefault).toHaveBeenCalled()
  })

  // 无修饰键不触发
  it('无修饰键不触发任何快捷键', () => {
    const e = createKeyboardEvent('n')
    handler(e)
    expect(chatPanel.addNewTab).not.toHaveBeenCalled()
    expect(e.preventDefault).not.toHaveBeenCalled()
  })

  // 仅 Shift 不触发
  it('仅 Shift+N 不触发 addNewTab', () => {
    const e = createKeyboardEvent('n', { shiftKey: true })
    handler(e)
    expect(chatPanel.addNewTab).not.toHaveBeenCalled()
  })

  // 不相关按键不触发
  it('Ctrl+X 不触发任何操作', () => {
    const e = createKeyboardEvent('x', { ctrlKey: true })
    handler(e)
    expect(chatPanel.addNewTab).not.toHaveBeenCalled()
    expect(chatPanel.closeTab).not.toHaveBeenCalled()
    expect(chatPanel.switchToNextTab).not.toHaveBeenCalled()
    expect(chatPanel.switchToPrevTab).not.toHaveBeenCalled()
  })

  // Ctrl+Tab 的 preventDefault 在逻辑之前调用（防止浏览器拦截）
  it('Ctrl+Tab 的 preventDefault 必须被调用', () => {
    const e = createKeyboardEvent('Tab', { ctrlKey: true })
    handler(e)
    // preventDefault 被调用确保浏览器不会切换到其他标签页
    expect(e.preventDefault).toHaveBeenCalledTimes(1)
  })
})
