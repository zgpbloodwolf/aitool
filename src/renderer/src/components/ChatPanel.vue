<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import { useExtensionStore } from '../stores/extension'
import ConfirmDialog from './ConfirmDialog.vue'
import type { SessionInfo } from '../../../shared/types'

interface SessionTab {
  id: string
  label: string
}

const extStore = useExtensionStore()
const webviewUrl = ref<string | null>(null)
// D-23: 存储 webview 端口，用于 postMessage 精确 origin
const webviewPort = ref<number>(0)
const loading = ref(false)
const error = ref<string | null>(null)
const tabs = ref<SessionTab[]>([])
const activeTabId = ref<string | null>(null)
const iframeRefs = ref<Map<string, HTMLIFrameElement>>(new Map())

// Session history panel
const showSessionHistory = ref(false)
const sessionList = ref<SessionInfo[]>([])
const sessionLoading = ref(false)
const sessionError = ref<string | null>(null)

// 确认对话框状态
const confirmVisible = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const confirmType = ref<'danger' | 'warning' | 'info'>('info')
const pendingAction = ref<(() => void) | null>(null)

/**
 * 显示确认对话框
 * @param title 对话框标题
 * @param message 对话框消息
 * @param type 对话框类型 (danger/warning/info)
 * @param onConfirm 确认后的回调
 */
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

// Status messages from claude.exe
const statusMessage = ref<string | null>(null)
const statusType = ref<'info' | 'warning' | 'error'>('info')
let statusTimer: ReturnType<typeof setTimeout> | null = null

// Map channelId (from webview launch_claude) → tabId (for routing responses)
const channelToTab = new Map<string, string>()

// D-14: 标签状态指示器 — running(运行中) / waiting(等待权限) / idle(空闲)
const tabStatuses = ref<Map<string, 'running' | 'waiting' | 'idle'>>(new Map())

// Pending resume: tabId → sessionId (injected into launch_claude when webview sends it)
const pendingResume = new Map<string, string>()

let offWebviewMessage: (() => void) | null = null
let offProcessCrashed: (() => void) | null = null
let offProcessUnresponsive: (() => void) | null = null
let tabCounter = 0

// D-11: 无响应的 channel 集合，用于显示重启按钮
const unresponsiveChannels = ref<Set<string>>(new Set())

function generateTabId(): string {
  return `session-${Date.now()}-${++tabCounter}`
}

function showStatus(msg: string, type: 'info' | 'warning' | 'error' = 'info', duration = 0): void {
  statusMessage.value = msg
  statusType.value = type
  if (statusTimer) clearTimeout(statusTimer)
  if (duration > 0) {
    statusTimer = setTimeout(() => {
      statusMessage.value = null
    }, duration)
  }
}

function clearStatus(): void {
  statusMessage.value = null
  if (statusTimer) {
    clearTimeout(statusTimer)
    statusTimer = null
  }
}

async function handleSystemMessage(msg: Record<string, unknown>, _channelId: string): Promise<void> {
  const subtype = msg.subtype as string
  const tabId = channelToTab.get(_channelId)

  switch (subtype) {
    case 'init': {
      showStatus('Claude 会话已就绪', 'info', 2000)
      // D-14: init 事件表示 Claude 开始运行
      if (tabId) tabStatuses.value.set(tabId, 'running')

      // D-13: 提取智能标签名
      let newLabel: string | null = null
      if (typeof msg.summary === 'string' && msg.summary.trim()) {
        newLabel = msg.summary.trim().slice(0, 20)
      } else if (typeof msg.session_id === 'string') {
        try {
          const sessions = await window.api.claudeListSessions()
          const match = sessions.find(s => s.id === msg.session_id)
          if (match?.summary) {
            newLabel = match.summary.trim().slice(0, 20)
          }
        } catch { /* 获取失败不影响流程 */ }
      }
      if (newLabel && tabId) {
        const tab = tabs.value.find(t => t.id === tabId)
        if (tab) tab.label = newLabel
      }
      break
    }
    case 'hook_started':
      showStatus('正在运行启动钩子...', 'info')
      // D-14: hook 启动表示 Claude 正在运行
      if (tabId) tabStatuses.value.set(tabId, 'running')
      break
    case 'hook_response':
      clearStatus()
      break
    case 'api_retry': {
      const attempt = msg.attempt as number
      const maxRetries = msg.max_retries as number
      const delay = Math.round((msg.retry_delay_ms as number) / 1000)
      const reason = msg.error as string
      showStatus(
        `API ${reason === 'rate_limit' ? '速率限制' : reason}，正在重试 (${attempt}/${maxRetries})，${delay}秒后...`,
        'warning'
      )
      break
    }
    case 'result':
      clearStatus()
      if (tabId) tabStatuses.value.set(tabId, 'idle')
      break
    default:
      // D-14: 其他 system 消息表示正在处理中
      if (tabId) tabStatuses.value.set(tabId, 'running')
      break
  }
}

let webviewReady = false

/** D-01: 重试 webview 初始化 */
function resetAndRetry(): void {
  webviewReady = false
  error.value = null
  initWebview()
}

async function initWebview() {
  if (!extStore.activeExtensionId || extStore.activeExtensionId !== 'anthropic.claude-code') {
    webviewUrl.value = null
    return
  }

  // 防止重复初始化
  if (webviewReady) return
  webviewReady = true

  loading.value = true
  error.value = null

  try {
    const extPath = await window.api.claudeGetExtensionPath()
    if (!extPath) {
      error.value = '未找到 Claude Code 扩展路径'
      loading.value = false
      webviewReady = false
      return
    }

    const port = await window.api.claudeStartWebviewServer(extPath)
    webviewPort.value = port // D-23: 保存端口用于 postMessage 精确 origin
    webviewUrl.value = `http://127.0.0.1:${port}/`
    loading.value = false

    // Create initial tab
    addNewTab()
  } catch (e) {
    console.error('[聊天面板] 初始化 webview 出错:', e)
    error.value = String(e)
    loading.value = false
    webviewReady = false
  }
}

function addNewTab() {
  const id = generateTabId()
  tabs.value.push({ id, label: `对话 ${tabs.value.length + 1}` })
  activeTabId.value = id
}

function switchTab(id: string) {
  activeTabId.value = id
}

async function toggleSessionHistory() {
  if (showSessionHistory.value) {
    showSessionHistory.value = false
    return
  }

  showSessionHistory.value = true
  sessionLoading.value = true
  sessionError.value = null
  try {
    sessionList.value = await window.api.claudeListSessions()
  } catch (e) {
    console.error('[聊天面板] 列出会话失败:', e)
    sessionError.value = '加载会话列表失败，请重试。'
    sessionList.value = []
  }
  sessionLoading.value = false
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin}分钟前`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}小时前`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}天前`
  return d.toLocaleDateString()
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

async function resumeSession(sessionId: string, summary?: string): Promise<void> {
  showSessionHistory.value = false

  // Find channelId for the active tab
  let activeChannelId: string | null = null
  if (activeTabId.value) {
    for (const [chId, tabId] of channelToTab) {
      if (tabId === activeTabId.value) {
        activeChannelId = chId
        break
      }
    }
  }

  showStatus('正在恢复会话...', 'info')
  const result = await window.api.claudeResumeSession(activeChannelId, sessionId)

  if (result.success && activeTabId.value && result.channelId) {
    // Remove old mapping and add new one
    for (const [chId, tabId] of channelToTab) {
      if (tabId === activeTabId.value) channelToTab.delete(chId)
    }
    channelToTab.set(result.channelId, activeTabId.value)
    // D-13: 恢复会话后用摘要更新标签名
    if (summary?.trim()) {
      const tab = tabs.value.find(t => t.id === activeTabId.value)
      if (tab) tab.label = summary.trim().slice(0, 20)
    }
    showStatus('会话已恢复', 'info', 2000)
  } else if (!result.success) {
    showStatus('恢复失败: ' + (result.error || '未知错误'), 'error', 3000)
  }
}

function closeSessionHistory(): void {
  showSessionHistory.value = false
}

/** D-02/D-06: 删除会话（带确认弹窗） */
async function deleteSessionById(sessionId: string): Promise<void> {
  showConfirm('删除会话', '确定删除此会话？此操作不可撤销。', 'danger', async () => {
    try {
      const ok = await window.api.claudeDeleteSession(sessionId)
      if (ok) {
        sessionList.value = sessionList.value.filter((s) => s.id !== sessionId)
      }
    } catch {
      /* ignore */
    }
  })
}

const sortedSessions = computed(() => {
  return [...sessionList.value].sort((a, b) => b.lastModified - a.lastModified)
})

/** D-07: 关闭标签（活跃标签需确认） */
function closeTab(id: string): void {
  // 检查是否有活跃 channel
  let hasActiveChannel = false
  for (const [, tabId] of channelToTab) {
    if (tabId === id) {
      hasActiveChannel = true
      break
    }
  }

  if (hasActiveChannel) {
    showConfirm('关闭对话', '此对话正在运行，关闭将终止进程。', 'warning', () => {
      doCloseTab(id)
    })
  } else {
    doCloseTab(id)
  }
}

/** 实际执行关闭标签操作 */
function doCloseTab(id: string): void {
  const idx = tabs.value.findIndex((t) => t.id === id)
  if (idx === -1) return

  // 查找并关闭该 tab 关联的 channel
  for (const [channelId, tabId] of channelToTab) {
    if (tabId === id) {
      window.api.claudeWebviewFromWebview({ type: 'close_channel', channelId })
      channelToTab.delete(channelId)
    }
  }

  tabs.value.splice(idx, 1)
  iframeRefs.value.delete(id)

  if (tabs.value.length === 0) {
    addNewTab()
  } else if (activeTabId.value === id) {
    const newIdx = Math.min(idx, tabs.value.length - 1)
    activeTabId.value = tabs.value[newIdx].id
  }
}

// Set iframe ref when mounted
function setIframeRef(tabId: string, el: HTMLIFrameElement | null) {
  if (el) {
    iframeRefs.value.set(tabId, el)
  } else {
    iframeRefs.value.delete(tabId)
  }
}

// Forward messages FROM main process TO the correct webview iframe
function forwardToWebview(msg: unknown) {
  const m = msg as { channelId?: string; type?: string; message?: Record<string, unknown> }

  // Intercept system messages from claude.exe for status display
  if (m?.message?.type === 'system' && m.channelId) {
    handleSystemMessage(m.message as Record<string, unknown>, m.channelId)
  }

  // D-14: 检测权限请求消息，设置 waiting 状态
  if (m?.message?.type === 'request' && m.channelId) {
    const reqTabId = channelToTab.get(m.channelId)
    if (reqTabId) tabStatuses.value.set(reqTabId, 'waiting')
  }

  // D-14: result → idle
  if (m?.message?.type === 'result' && m.channelId) {
    const resultTabId = channelToTab.get(m.channelId)
    if (resultTabId) tabStatuses.value.set(resultTabId, 'idle')
  }

  if (m?.channelId) {
    // Route to the iframe that owns this channelId
    const tabId = channelToTab.get(m.channelId)
    if (tabId) {
      const iframe = iframeRefs.value.get(tabId)
      if (iframe?.contentWindow) {
        // D-23: 使用精确 origin 替代通配符 '*'，限制消息接收方
        const origin = `http://127.0.0.1:${webviewPort.value}`
        iframe.contentWindow.postMessage({ type: 'from-extension', message: msg }, origin)
      }
    }
  } else {
    // No channelId (e.g. init response) — broadcast to all iframes
    // D-23: 使用精确 origin 替代通配符 '*'
    const origin = `http://127.0.0.1:${webviewPort.value}`
    for (const iframe of iframeRefs.value.values()) {
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage({ type: 'from-extension', message: msg }, origin)
      }
    }
  }
}

// Forward messages FROM webview iframe TO main process
function handleIframeMessage(event: MessageEvent) {
  if (!event.data) return
  if (event.data.type === 'claude-webview-message') {
    // Find which iframe sent this message
    let sourceTabId: string | null = null
    for (const [tabId, iframe] of iframeRefs.value) {
      if (iframe.contentWindow === event.source) {
        sourceTabId = tabId
        break
      }
    }

    const message = event.data.message as Record<string, unknown>

    // D-13: 从用户发送的消息中提取标签名
    if (sourceTabId) {
      const tab = tabs.value.find(t => t.id === sourceTabId)
      if (tab && tab.label.startsWith('对话')) {
        let userText = ''
        if (message?.type === 'io_message') {
          const inner = message.message as Record<string, unknown> | undefined
          if (inner?.type === 'user') {
            const msgContent = inner.message
            if (typeof msgContent === 'string') {
              userText = msgContent
            } else if (typeof msgContent === 'object' && msgContent !== null) {
              const content = (msgContent as Record<string, unknown>).content
              if (Array.isArray(content)) {
                const textBlock = content.find((b: Record<string, unknown>) =>
                  b.type === 'text' && typeof b.text === 'string')
                if (textBlock) userText = (textBlock as { text: string }).text
              }
            }
          }
        }
        if (userText.trim()) {
          tab.label = userText.trim().replace(/\n/g, ' ').slice(0, 20)
        }
      }
    }

    // D-13: 从 webview 的 update_session_state 提取标题（更可靠）
    if (message?.type === 'request') {
      const req = message.request as Record<string, unknown> | undefined
      if (req?.type === 'update_session_state' && typeof req.title === 'string') {
        const cid = req.channelId as string | undefined
        const tabId = cid ? channelToTab.get(cid) : null
        if (tabId) {
          const tab = tabs.value.find(t => t.id === tabId)
          if (tab && req.title.trim()) {
            tab.label = String(req.title).trim().slice(0, 20)
          }
        }
      }
    }

    // Track channelId → tabId mapping from launch_claude
    if (message?.type === 'launch_claude' && message.channelId && sourceTabId) {
      channelToTab.set(message.channelId as string, sourceTabId)

      // Inject resumeSessionId if this tab has a pending resume
      const pendingSessionId = pendingResume.get(sourceTabId)
      if (pendingSessionId) {
        message.resumeSessionId = pendingSessionId
        pendingResume.delete(sourceTabId)
      }
    }

    window.api.claudeWebviewFromWebview(event.data.message)
  }
}

onMounted(() => {
  window.addEventListener('message', handleIframeMessage)
  offWebviewMessage = window.api.onClaudeWebviewMessage((msg) => {
    forwardToWebview(msg)
  })

  // D-10: 进程崩溃自动恢复
  offProcessCrashed = window.api.onProcessCrashed(async (data) => {
    const { channelId, canRecover } = data
    const tabId = channelToTab.get(channelId)
    if (!tabId) return

    if (canRecover) {
      showStatus('进程已崩溃，正在恢复...', 'warning')
      try {
        const result = await window.api.claudeRecoverProcess(channelId)
        if (result.success) {
          showStatus('已恢复对话', 'success', 3000)
        } else {
          showStatus('恢复失败: ' + (result.error || '未知错误'), 'error')
        }
      } catch (e) {
        showStatus('恢复失败: ' + String(e), 'error')
      }
    } else {
      showStatus('进程已崩溃，无法自动恢复', 'error')
    }
  })

  // D-11: 进程无响应 — 显示重启按钮
  offProcessUnresponsive = window.api.onProcessUnresponsive(async (data) => {
    const { channelId } = data
    const tabId = channelToTab.get(channelId)
    if (!tabId) return

    unresponsiveChannels.value.add(channelId)
    showStatus('进程无响应，可能已挂死', 'error')
  })

  initWebview()
})

onBeforeUnmount(() => {
  window.removeEventListener('message', handleIframeMessage)
  if (offWebviewMessage) {
    offWebviewMessage()
    offWebviewMessage = null
  }
  if (offProcessCrashed) {
    offProcessCrashed()
    offProcessCrashed = null
  }
  if (offProcessUnresponsive) {
    offProcessUnresponsive()
    offProcessUnresponsive = null
  }
})

watch(
  () => extStore.activeExtensionId,
  () => {
    tabs.value = []
    iframeRefs.value.clear()
    channelToTab.clear()
    webviewReady = false
    initWebview()
  }
)

/** 切换到下一个标签（循环） */
function switchToNextTab(): void {
  if (tabs.value.length <= 1) return
  const idx = tabs.value.findIndex((t) => t.id === activeTabId.value)
  if (idx === -1) return
  const nextIdx = (idx + 1) % tabs.value.length
  activeTabId.value = tabs.value[nextIdx].id
}

/** 切换到上一个标签（循环） */
function switchToPrevTab(): void {
  if (tabs.value.length <= 1) return
  const idx = tabs.value.findIndex((t) => t.id === activeTabId.value)
  if (idx === -1) return
  const prevIdx = (idx - 1 + tabs.value.length) % tabs.value.length
  activeTabId.value = tabs.value[prevIdx].id
}

// D-16: 标签拖拽排序状态
const draggedTabId = ref<string | null>(null)
const dragOverTabId = ref<string | null>(null)

/** D-16: 拖拽开始 */
function onDragStart(e: DragEvent, tabId: string): void {
  draggedTabId.value = tabId
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
  }
}

/** D-16: 拖拽经过 */
function onDragOver(e: DragEvent): void {
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
}

/** D-16: 拖拽进入目标标签 */
function onDragEnter(tabId: string): void {
  dragOverTabId.value = tabId
}

/** D-16: 拖拽离开目标标签 */
function onDragLeave(tabId: string): void {
  if (dragOverTabId.value === tabId) {
    dragOverTabId.value = null
  }
}

/** D-16: 拖拽放置 — 执行标签数组重排 */
function onDrop(_e: DragEvent, targetTabId: string): void {
  if (!draggedTabId.value || draggedTabId.value === targetTabId) {
    onDragEnd()
    return
  }
  const fromIdx = tabs.value.findIndex((t) => t.id === draggedTabId.value)
  const toIdx = tabs.value.findIndex((t) => t.id === targetTabId)
  if (fromIdx === -1 || toIdx === -1) {
    onDragEnd()
    return
  }
  // 从原位置移除并插入到目标位置
  const [moved] = tabs.value.splice(fromIdx, 1)
  tabs.value.splice(toIdx, 0, moved)
  onDragEnd()
}

/** D-16: 拖拽结束 — 清除状态 */
function onDragEnd(): void {
  draggedTabId.value = null
  dragOverTabId.value = null
}

/** 检查是否有活跃 channel */
function hasActiveChannels(): boolean {
  return channelToTab.size > 0
}

// D-10/D-11: 进程崩溃和无响应处理

/** 当前活跃 tab 是否有无响应的 channel */
const currentUnresponsiveChannelId = computed(() => {
  for (const channelId of unresponsiveChannels.value) {
    if (channelToTab.get(channelId) === activeTabId.value) {
      return channelId
    }
  }
  return null
})
const currentUnresponsive = computed(() => !!currentUnresponsiveChannelId.value)

/** 手动重启挂死进程 */
async function restartUnresponsiveProcess(channelId: string): Promise<void> {
  showStatus('正在重启进程...', 'warning')
  try {
    const result = await window.api.claudeRecoverProcess(channelId)
    if (result.success) {
      unresponsiveChannels.value.delete(channelId)
      showStatus('进程已重启', 'success', 3000)
    } else {
      showStatus('重启失败: ' + (result.error || '未知错误'), 'error')
    }
  } catch (e) {
    showStatus('重启失败: ' + String(e), 'error')
  }
}

/** 暴露方法给父组件（快捷键和标签操作需要） */
defineExpose({
  addNewTab,
  closeTab,
  switchTab,
  switchToNextTab,
  switchToPrevTab,
  hasActiveChannels,
  activeTabId
})
</script>

<template>
  <div class="chat-panel">
    <div v-if="!extStore.activeExtensionId" class="chat-empty">
      <div class="empty-content">
        <div class="empty-icon">&#x1F916;</div>
        <h2>欢迎使用 AI 工具</h2>
        <p>从标题栏选择扩展开始对话</p>
        <p class="hint">支持：Claude Code、Codex</p>
      </div>
    </div>
    <div v-else-if="loading" class="chat-empty">
      <div class="empty-content">
        <p>正在加载 Claude Code...</p>
      </div>
    </div>
    <div v-else-if="error" class="chat-empty">
      <div class="empty-content">
        <p class="error">{{ error }}</p>
        <button class="retry-btn" @click="resetAndRetry">重试</button>
      </div>
    </div>
    <div v-else-if="webviewUrl" class="chat-active">
      <!-- Tab Bar -->
      <div class="tab-bar">
        <div class="tab-list">
          <div
            v-for="tab in tabs"
            :key="tab.id"
            class="tab-item"
            :class="{
              active: tab.id === activeTabId,
              dragging: draggedTabId === tab.id,
              'drag-over': dragOverTabId === tab.id
            }"
            draggable="true"
            @click="switchTab(tab.id)"
            @mousedown.middle.prevent="closeTab(tab.id)"
            @dragstart="onDragStart($event, tab.id)"
            @dragover.prevent="onDragOver($event)"
            @dragenter.prevent="onDragEnter(tab.id)"
            @dragleave="onDragLeave(tab.id)"
            @drop="onDrop($event, tab.id)"
            @dragend="onDragEnd"
          >
            <span class="tab-status-dot" :class="tabStatuses.get(tab.id) || 'idle'" />
            <span class="tab-label">{{ tab.label }}</span>
            <span class="tab-close" @click.stop="closeTab(tab.id)">×</span>
          </div>
        </div>
        <button
          class="tab-history"
          @click="toggleSessionHistory"
          :class="{ active: showSessionHistory }"
          title="会话历史"
        >
          &#x1F552;
        </button>
        <button class="tab-add" @click="addNewTab" title="新建对话">+</button>
      </div>

      <!-- Iframes - all loaded but only active one visible -->
      <div class="iframe-container">
        <iframe
          v-for="tab in tabs"
          :key="tab.id"
          :ref="(el: any) => setIframeRef(tab.id, el as HTMLIFrameElement | null)"
          :src="webviewUrl"
          class="webview-iframe"
          :class="{ hidden: tab.id !== activeTabId }"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          allow="clipboard-read; clipboard-write"
        />
      </div>

      <!-- D-11: 进程无响应覆盖层 -->
      <div v-if="currentUnresponsive" class="unresponsive-overlay">
        <p class="unresponsive-text">进程无响应</p>
        <button
          class="retry-btn"
          @click="restartUnresponsiveProcess(currentUnresponsiveChannelId!)"
        >
          重启进程
        </button>
      </div>

      <!-- Session History Panel -->
      <Transition name="session-slide">
        <div
          v-if="showSessionHistory"
          class="session-history-overlay"
          @click.self="closeSessionHistory"
        >
          <div class="session-history-panel">
            <div class="session-header">
              <span class="session-title">会话历史</span>
              <button class="session-close" @click="closeSessionHistory">&times;</button>
            </div>
            <div v-if="sessionLoading" class="session-loading">加载中...</div>
            <div v-else-if="sessionError" class="session-error">
              <p>{{ sessionError }}</p>
              <button class="retry-btn" @click="toggleSessionHistory">重试</button>
            </div>
            <div v-else-if="sortedSessions.length === 0" class="session-empty">暂无会话记录</div>
            <div v-else class="session-list">
              <div
                v-for="s in sortedSessions"
                :key="s.id"
                class="session-item"
                @click="resumeSession(s.id, s.summary)"
              >
                <div class="session-summary">{{ s.summary || '(无摘要)' }}</div>
                <div class="session-meta">
                  <span class="session-time">{{ formatDate(s.lastModified) }}</span>
                  <span v-if="s.gitBranch" class="session-branch">{{ s.gitBranch }}</span>
                  <span class="session-size">{{ formatSize(s.fileSize) }}</span>
                  <button
                    class="session-delete"
                    title="删除会话"
                    @click.stop="deleteSessionById(s.id)"
                  >
                    &#x1F5D1;
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Status bar overlay -->
      <Transition name="status-slide">
        <div v-if="statusMessage" class="status-overlay" :class="statusType">
          <span class="status-dot" />
          <span class="status-text">{{ statusMessage }}</span>
        </div>
      </Transition>

      <!-- 确认对话框 -->
      <ConfirmDialog
        :visible="confirmVisible"
        :title="confirmTitle"
        :message="confirmMessage"
        :type="confirmType"
        @confirm="handleConfirm"
        @cancel="handleCancel"
      />
    </div>
  </div>
</template>

<style scoped>
.chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
}

.chat-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.empty-content {
  text-align: center;
  color: var(--text-secondary);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-content h2 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.empty-content p {
  margin-bottom: 4px;
}

.hint {
  color: var(--text-muted);
  font-size: 12px;
}

.error {
  color: var(--error);
}

/* D-01: 重试按钮 */
.retry-btn {
  margin-top: 12px;
  background: var(--accent);
  color: var(--bg-primary);
  border: none;
  padding: 6px 20px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
}

.retry-btn:hover {
  background: var(--accent-hover);
}

/* D-04: 会话列表错误提示 */
.session-error {
  padding: 32px 16px;
  text-align: center;
  color: var(--error);
  font-size: 13px;
}

.chat-active {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Tab Bar */
.tab-bar {
  display: flex;
  align-items: center;
  height: 32px;
  min-height: 32px;
  background: #181825;
  border-bottom: 1px solid #313244;
  padding: 0 4px;
  user-select: none;
}

.tab-list {
  display: flex;
  flex: 1;
  overflow-x: auto;
  gap: 1px;
}

.tab-list::-webkit-scrollbar {
  height: 0;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  height: 28px;
  border-radius: 4px 4px 0 0;
  background: transparent;
  color: #a6adc8;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  max-width: 160px;
}

.tab-item:hover {
  background: #1e1e2e;
  color: #cdd6f4;
}

.tab-item.active {
  background: #1e1e2e;
  color: #cdd6f4;
  border-bottom: 2px solid #89b4fa;
}

/* D-16: 拖拽排序样式 */
.tab-item.dragging {
  opacity: 0.5;
}

.tab-item.drag-over {
  border-left: 2px solid var(--accent, #89b4fa);
}

.tab-label {
  overflow: hidden;
  text-overflow: ellipsis;
}

/* D-14: 标签状态指示器圆点 */
.tab-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tab-status-dot.running {
  background: var(--success, #a6e3a1);
  animation: pulse 1.5s ease-in-out infinite;
}

.tab-status-dot.waiting {
  background: var(--warning, #fab387);
  animation: pulse 1.5s ease-in-out infinite;
}

.tab-status-dot.idle {
  background: var(--text-muted, #6c7086);
}

.tab-close {
  font-size: 14px;
  line-height: 1;
  opacity: 0.5;
  padding: 0 2px;
}

.tab-close:hover {
  opacity: 1;
  color: #f38ba8;
}

.tab-add {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: #a6adc8;
  font-size: 18px;
  cursor: pointer;
  border-radius: 4px;
  flex-shrink: 0;
}

.tab-history {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: #a6adc8;
  font-size: 14px;
  cursor: pointer;
  border-radius: 4px;
  flex-shrink: 0;
}

.tab-history:hover {
  background: #1e1e2e;
  color: #cdd6f4;
}

.tab-history.active {
  background: #313244;
  color: #89b4fa;
}

.tab-add:hover {
  background: #1e1e2e;
  color: #cdd6f4;
}

/* Iframe Container */
.iframe-container {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.webview-iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: none;
  background: #1e1e2e;
}

.webview-iframe.hidden {
  visibility: hidden;
  pointer-events: none;
}

/* D-11: 进程无响应覆盖层 */
.unresponsive-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px 48px;
  background: rgba(24, 24, 37, 0.95);
  border: 1px solid #313244;
  border-radius: 8px;
  z-index: 15;
}

.unresponsive-text {
  color: #f38ba8;
  font-size: 15px;
  font-weight: 600;
  margin: 0;
}

/* Status Overlay */
.status-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  font-size: 12px;
  z-index: 10;
  backdrop-filter: blur(4px);
}

.status-overlay.info {
  background: rgba(137, 180, 250, 0.15);
  color: #89b4fa;
  border-top: 1px solid rgba(137, 180, 250, 0.3);
}

.status-overlay.warning {
  background: rgba(249, 226, 175, 0.15);
  color: #f9e2af;
  border-top: 1px solid rgba(249, 226, 175, 0.3);
}

.status-overlay.error {
  background: rgba(243, 139, 168, 0.15);
  color: #f38ba8;
  border-top: 1px solid rgba(243, 139, 168, 0.3);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  animation: pulse 1.5s ease-in-out infinite;
}

.info .status-dot {
  background: #89b4fa;
}
.warning .status-dot {
  background: #f9e2af;
}
.error .status-dot {
  background: #f38ba8;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

.status-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-slide-enter-active,
.status-slide-leave-active {
  transition: all 0.2s ease;
}
.status-slide-enter-from,
.status-slide-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

/* Session History Panel */
.session-history-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 20;
  display: flex;
  justify-content: flex-end;
}

.session-history-panel {
  width: 360px;
  max-width: 100%;
  background: #181825;
  border-left: 1px solid #313244;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.session-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #313244;
  flex-shrink: 0;
}

.session-title {
  font-size: 14px;
  font-weight: 600;
  color: #cdd6f4;
}

.session-close {
  background: none;
  border: none;
  color: #6c7086;
  font-size: 20px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.session-close:hover {
  color: #f38ba8;
}

.session-loading,
.session-empty {
  padding: 32px 16px;
  text-align: center;
  color: #6c7086;
  font-size: 13px;
}

.session-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.session-list::-webkit-scrollbar {
  width: 6px;
}

.session-list::-webkit-scrollbar-track {
  background: transparent;
}

.session-list::-webkit-scrollbar-thumb {
  background: #45475a;
  border-radius: 3px;
}

.session-item {
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
  margin-bottom: 2px;
}

.session-item:hover {
  background: #1e1e2e;
}

.session-summary {
  font-size: 13px;
  color: #cdd6f4;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  margin-bottom: 6px;
}

.session-meta {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: #6c7086;
  align-items: center;
}

.session-branch {
  background: #313244;
  padding: 1px 6px;
  border-radius: 3px;
  color: #a6adc8;
  font-family: monospace;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-delete {
  margin-left: auto;
  background: none;
  border: none;
  color: #6c7086;
  font-size: 12px;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  opacity: 0;
  transition:
    opacity 0.15s,
    color 0.15s;
}

.session-item:hover .session-delete {
  opacity: 1;
}

.session-delete:hover {
  color: #f38ba8;
  background: rgba(243, 139, 168, 0.1);
}

.session-slide-enter-active,
.session-slide-leave-active {
  transition: opacity 0.2s ease;
}

.session-slide-enter-from,
.session-slide-leave-to {
  opacity: 0;
}
</style>
