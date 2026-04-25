<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useExtensionStore } from './stores/extension'
import { useWorkspaceStore } from './stores/workspace'
import TitleBar from './components/TitleBar.vue'
import Sidebar from './components/Sidebar.vue'
import ChatPanel from './components/ChatPanel.vue'
import StatusBar from './components/StatusBar.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'

const extStore = useExtensionStore()
const workspaceStore = useWorkspaceStore()
const sidebarVisible = ref(true)

// D-05: ChatPanel ref 供快捷键调用
const chatPanelRef = ref<InstanceType<typeof ChatPanel> | null>(null)

// 确认对话框状态（D-08: 工作区切换确认）
const confirmVisible = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const confirmType = ref<'danger' | 'warning' | 'info'>('info')
const pendingAction = ref<(() => void) | null>(null)

/**
 * D-08: 切换工作区确认
 * 检查是否有活跃 Claude 进程，若有则弹出确认对话框
 */
function handleOpenFolder(): void {
  if (chatPanelRef.value?.hasActiveChannels()) {
    showConfirm(
      '切换工作区',
      '当前有活跃的 Claude 对话，切换工作区将终止所有进程。',
      'warning',
      () => {
        workspaceStore.openFolder()
      }
    )
  } else {
    workspaceStore.openFolder()
  }
}

function showConfirm(
  title: string,
  message: string,
  type: 'danger' | 'warning' | 'info',
  onConfirm: () => void
): void {
  confirmTitle.value = title
  confirmMessage.value = message
  confirmType.value = type
  pendingAction.value = onConfirm
  confirmVisible.value = true
}

function handleConfirm(): void {
  confirmVisible.value = false
  if (pendingAction.value) {
    pendingAction.value()
    pendingAction.value = null
  }
}

function handleCancel(): void {
  confirmVisible.value = false
  pendingAction.value = null
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
}

onMounted(() => {
  extStore.loadExtensions()
  // D-05: 注册全局键盘快捷键
  document.addEventListener('keydown', handleGlobalKeydown)
})

onBeforeUnmount(() => {
  // D-05: 清理全局键盘快捷键
  document.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<template>
  <div class="app-layout">
    <TitleBar @toggle-sidebar="sidebarVisible = !sidebarVisible" />
    <div class="main-content">
      <Sidebar v-if="sidebarVisible" @open-folder="handleOpenFolder" />
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
    <!-- D-08: 工作区切换确认对话框 -->
    <ConfirmDialog
      :visible="confirmVisible"
      :title="confirmTitle"
      :message="confirmMessage"
      :type="confirmType"
      @confirm="handleConfirm"
      @cancel="handleCancel"
    />
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
</style>
