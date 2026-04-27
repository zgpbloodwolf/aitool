<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useExtensionStore } from './stores/extension'
import { useWorkspaceStore } from './stores/workspace'
import { useSettingsStore } from './stores/settings'
import { loadAndApplyZoom, resetZoom, applyZoom } from './composables/useZoom'
import { useNotification } from './composables/useNotification'
import TitleBar from './components/TitleBar.vue'
import Sidebar from './components/Sidebar.vue'
import ChatPanel from './components/ChatPanel.vue'
import StatusBar from './components/StatusBar.vue'
import SettingsDrawer from './components/SettingsDrawer.vue'
import UpdatePrompt from './components/UpdatePrompt.vue'
import WeChatWorkspace from './components/wechat/WeChatWorkspace.vue'

const extStore = useExtensionStore()
const workspaceStore = useWorkspaceStore()
const sidebarVisible = ref(true)
const activeView = ref<'chat' | 'wechat'>('chat')
const settingsOpen = ref(false)

const SIDEBAR_WIDTH_KEY = 'aitools-sidebar-width'
const sidebarWidth = ref(parseInt(localStorage.getItem(SIDEBAR_WIDTH_KEY) || '260'))
const isResizing = ref(false)
const chatPanelRef = ref<InstanceType<typeof ChatPanel> | null>(null)

function startResize(e: MouseEvent): void {
  isResizing.value = true
  const startX = e.clientX
  const startWidth = sidebarWidth.value

  const iframes = document.querySelectorAll('.webview-iframe')
  iframes.forEach((iframe) => {
    ;(iframe as HTMLElement).style.pointerEvents = 'none'
  })

  function onMouseMove(event: MouseEvent): void {
    const newWidth = Math.max(200, Math.min(500, startWidth + (event.clientX - startX)))
    sidebarWidth.value = newWidth
  }

  function onMouseUp(): void {
    isResizing.value = false
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth.value))
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    iframes.forEach((iframe) => {
      ;(iframe as HTMLElement).style.pointerEvents = ''
    })
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function handleOpenFolder(): void {
  workspaceStore.addProject()
}

function handleGlobalKeydown(e: KeyboardEvent): void {
  if (e.ctrlKey && e.key === 'Tab') {
    e.preventDefault()
    if (e.shiftKey) {
      chatPanelRef.value?.switchToPrevTab()
    } else {
      chatPanelRef.value?.switchToNextTab()
    }
    return
  }

  if (e.ctrlKey && e.key === 'n') {
    e.preventDefault()
    chatPanelRef.value?.addNewTab()
    return
  }

  if (e.ctrlKey && e.key === 'w') {
    e.preventDefault()
    const activeId = chatPanelRef.value?.activeTabId
    if (activeId) {
      chatPanelRef.value?.closeTab(activeId)
    }
    return
  }

  if (e.ctrlKey && e.key === 'b') {
    e.preventDefault()
    sidebarVisible.value = !sidebarVisible.value
    return
  }

  if (e.ctrlKey && e.key === ',') {
    e.preventDefault()
    settingsOpen.value = !settingsOpen.value
  }
}

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
    case 'reset-zoom':
      resetZoom()
      break
    case 'clipboard-panel':
      chatPanelRef.value?.toggleClipboardPanel()
      break
  }
}

let offShortcut: (() => void) | null = null

onMounted(() => {
  extStore.loadExtensions()
  workspaceStore.loadPersistedProjects()
  document.addEventListener('keydown', handleGlobalKeydown)
  offShortcut = window.api.onShortcut(handleShortcut)

  loadAndApplyZoom()

  const settingsStore = useSettingsStore()
  watch(
    () => settingsStore.settings.zoomFactor,
    (newFactor) => {
      applyZoom(newFactor)
    }
  )

  useNotification()

  window.addEventListener(
    'notification:focus-tab',
    ((e: CustomEvent) => {
      const channelId = e.detail as string
      const channelToTab = (window as any).__channelToTab as Map<string, string> | undefined
      const tabId = channelToTab?.get(channelId)
      if (tabId) {
        chatPanelRef.value?.switchTab(tabId)
      }
    }) as EventListener
  )
})

onBeforeUnmount(() => {
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
        v-model:active-view="activeView"
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
        <div v-if="extStore.error" class="ext-error-banner">
          <span>扩展加载失败: {{ extStore.error }}</span>
          <button class="ext-retry-btn" @click="extStore.loadExtensions()">重试</button>
        </div>
        <ChatPanel v-if="activeView === 'chat'" ref="chatPanelRef" class="chat-area" />
        <WeChatWorkspace v-else class="chat-area" />
      </div>
    </div>
    <StatusBar />
    <SettingsDrawer v-if="settingsOpen" @close="settingsOpen = false" />
    <UpdatePrompt />
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
