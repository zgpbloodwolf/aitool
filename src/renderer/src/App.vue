<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useExtensionStore } from './stores/extension'
import { useWorkspaceStore } from './stores/workspace'
import TitleBar from './components/TitleBar.vue'
import Sidebar from './components/Sidebar.vue'
import ChatPanel from './components/ChatPanel.vue'
import StatusBar from './components/StatusBar.vue'
import SettingsDrawer from './components/SettingsDrawer.vue'

const extStore = useExtensionStore()
const workspaceStore = useWorkspaceStore()
const sidebarVisible = ref(true)
const settingsOpen = ref(false)

// D-17: 侧边栏拖拽宽度 + 持久化
const SIDEBAR_WIDTH_KEY = 'aitools-sidebar-width'
const sidebarWidth = ref(parseInt(localStorage.getItem(SIDEBAR_WIDTH_KEY) || '260'))
const isResizing = ref(false)

function startResize(e: MouseEvent): void {
  isResizing.value = true
  const startX = e.clientX
  const startWidth = sidebarWidth.value

  // 拖拽期间禁用 iframe 指针事件（防止 iframe 拦截 mousemove）
  const iframes = document.querySelectorAll('.webview-iframe')
  iframes.forEach((iframe) => {
    ;(iframe as HTMLElement).style.pointerEvents = 'none'
  })

  function onMouseMove(e: MouseEvent): void {
    const newWidth = Math.max(200, Math.min(500, startWidth + (e.clientX - startX)))
    sidebarWidth.value = newWidth
  }

  function onMouseUp(): void {
    isResizing.value = false
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth.value))
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    // 恢复 iframe 指针事件
    iframes.forEach((iframe) => {
      ;(iframe as HTMLElement).style.pointerEvents = ''
    })
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

// D-05: ChatPanel ref 供快捷键调用
const chatPanelRef = ref<InstanceType<typeof ChatPanel> | null>(null)

/**
 * 添加项目目录 — 不影响已有 Claude 进程
 */
function handleOpenFolder(): void {
  workspaceStore.addProject()
}

/**
 * D-05: 全局键盘快捷键处理
 * Ctrl+N 新建对话, Ctrl+W 关闭标签, Ctrl+B 切换侧边栏
 * Ctrl+Tab 下一个标签, Ctrl+Shift+Tab 上一个标签
 */
function handleGlobalKeydown(e: KeyboardEvent): void {
  // Ctrl+Tab 必须在最前面 preventDefault，防止浏览器默认行为拦截
  if (e.ctrlKey && e.key === 'Tab') {
    e.preventDefault()
    if (e.shiftKey) {
      chatPanelRef.value?.switchToPrevTab()
    } else {
      chatPanelRef.value?.switchToNextTab()
    }
    return
  }

  // Ctrl+N: 新建对话标签（Ctrl+Shift+N 降级为新建标签页）
  if (e.ctrlKey && e.key === 'n') {
    e.preventDefault()
    chatPanelRef.value?.addNewTab()
    return
  }

  // Ctrl+W: 关闭当前标签
  if (e.ctrlKey && e.key === 'w') {
    e.preventDefault()
    const activeId = chatPanelRef.value?.activeTabId
    if (activeId) {
      chatPanelRef.value?.closeTab(activeId)
    }
    return
  }

  // Ctrl+B: 切换侧边栏显示/隐藏
  if (e.ctrlKey && e.key === 'b') {
    e.preventDefault()
    sidebarVisible.value = !sidebarVisible.value
    return
  }

  // Ctrl+,: 打开设置面板
  if (e.ctrlKey && e.key === ',') {
    e.preventDefault()
    settingsOpen.value = !settingsOpen.value
    return
  }
}

/** D-05: 主进程 IPC 快捷键回调 — iframe 焦点时渲染进程 keydown 不触发，由主进程 before-input-event 拦截 */
function handleShortcut(action: string): void {
  switch (action) {
    case 'new-tab':
      chatPanelRef.value?.addNewTab()
      break
    case 'close-tab': {
      const activeId = chatPanelRef.value?.activeTabId
      if (activeId) chatPanelRef.value?.closeTab(activeId)
      break
    }
    case 'toggle-sidebar':
      sidebarVisible.value = !sidebarVisible.value
      break
    case 'next-tab':
      chatPanelRef.value?.switchToNextTab()
      break
    case 'prev-tab':
      chatPanelRef.value?.switchToPrevTab()
      break
    case 'open-settings':
      settingsOpen.value = !settingsOpen.value
      break
  }
}

let offShortcut: (() => void) | null = null

onMounted(() => {
  extStore.loadExtensions()
  // 恢复持久化的收藏项目
  workspaceStore.loadPersistedProjects()
  // D-05: 注册全局键盘快捷键（文档级，iframe 焦点时无效）
  document.addEventListener('keydown', handleGlobalKeydown)
  // D-05: 注册 IPC 快捷键（主进程拦截，iframe 焦点时也生效）
  offShortcut = window.api.onShortcut(handleShortcut)
})

onBeforeUnmount(() => {
  // D-05: 清理全局键盘快捷键
  document.removeEventListener('keydown', handleGlobalKeydown)
  offShortcut?.()
})
</script>

<template>
  <div class="app-layout">
    <TitleBar
      @toggle-sidebar="sidebarVisible = !sidebarVisible"
      @open-settings="settingsOpen = !settingsOpen"
    />
    <div class="main-content">
      <Sidebar
        v-if="sidebarVisible"
        :style="{ width: sidebarWidth + 'px', minWidth: sidebarWidth + 'px' }"
        @open-folder="handleOpenFolder"
      />
      <div
        v-if="sidebarVisible"
        class="resize-handle"
        :class="{ active: isResizing }"
        @mousedown="startResize"
      />
      <div class="center-area">
        <!-- D-03: 扩展加载失败提示 -->
        <div v-if="extStore.error" class="ext-error-banner">
          <span>扩展加载失败: {{ extStore.error }}</span>
          <button class="ext-retry-btn" @click="extStore.loadExtensions()">重试</button>
        </div>
        <ChatPanel ref="chatPanelRef" class="chat-area" />
      </div>
    </div>
    <StatusBar />
    <!-- 设置面板 — 覆盖在内容区上方 -->
    <SettingsDrawer v-if="settingsOpen" @close="settingsOpen = false" />
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.center-area {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.chat-area {
  flex: 1;
  overflow: hidden;
}

/* D-03: 扩展加载错误提示 */
.ext-error-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 8px 16px;
  background: rgba(243, 139, 168, 0.15);
  border-bottom: 1px solid rgba(243, 139, 168, 0.3);
  color: var(--error);
  font-size: 13px;
}

.ext-retry-btn {
  background: var(--accent);
  color: var(--bg-primary);
  border: none;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.ext-retry-btn:hover {
  background: var(--accent-hover);
}

/* D-17: 侧边栏拖拽手柄 */
.resize-handle {
  width: 4px;
  cursor: col-resize;
  background: transparent;
  flex-shrink: 0;
  transition: background 0.15s;
}
.resize-handle:hover,
.resize-handle.active {
  background: var(--accent);
}
</style>
