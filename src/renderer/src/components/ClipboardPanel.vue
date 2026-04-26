<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { useClipboardStore } from '../stores/clipboard'
import { useSnippetStore, type Snippet } from '../stores/snippet'
import { useClipboard } from '../composables/useClipboard'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select', text: string): void
}>()

const clipboardStore = useClipboardStore()
const snippetStore = useSnippetStore()
const { readAndRecord, pasteText } = useClipboard()

// D-14: 两个 Tab
const activeTab = ref<'history' | 'snippets'>('history')

// 键盘导航状态
const selectedIndex = ref(0)
const searchQuery = ref('')
const listRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)

// 编辑片段对话框
const editingSnippet = ref<Snippet | null>(null)
const editTitle = ref('')
const editContent = ref('')
const showEditDialog = ref(false)
// 手动创建片段
const showCreateDialog = ref(false)

// 历史列表（带搜索过滤）
const filteredHistory = computed(() => {
  if (!searchQuery.value) return clipboardStore.history
  const q = searchQuery.value.toLowerCase()
  return clipboardStore.history.filter((e) => e.text.toLowerCase().includes(q))
})

// 收藏列表（带搜索过滤）
const filteredSnippets = computed(() => {
  if (!searchQuery.value) return snippetStore.snippets
  const q = searchQuery.value.toLowerCase()
  return snippetStore.snippets.filter(
    (s) => s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q)
  )
})

// 当前列表（根据 activeTab）
const currentList = computed(() =>
  activeTab.value === 'history' ? filteredHistory.value : filteredSnippets.value
)

// 打开面板时读取剪贴板并记录
watch(
  () => props.visible,
  async (newVal) => {
    if (newVal) {
      selectedIndex.value = 0
      searchQuery.value = ''
      activeTab.value = 'history'
      await readAndRecord()
      await nextTick()
      // 聚焦搜索输入框
      searchInputRef.value?.focus()
    }
  }
)

/** 键盘导航处理 */
function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    emit('close')
    return
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    selectedIndex.value = Math.min(selectedIndex.value + 1, currentList.value.length - 1)
    scrollToSelected()
    return
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
    scrollToSelected()
    return
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    selectItem(selectedIndex.value)
    return
  }
  if (event.key === 'Tab') {
    event.preventDefault()
    activeTab.value = activeTab.value === 'history' ? 'snippets' : 'history'
    selectedIndex.value = 0
    return
  }
}

/** 选中条目并关闭面板 */
function selectItem(index: number): void {
  const list = currentList.value
  if (index < 0 || index >= list.length) return
  const item = list[index]
  if (activeTab.value === 'history') {
    const text = (item as { text: string }).text
    pasteText(text)
    emit('select', text)
  } else {
    const content = (item as Snippet).content
    pasteText(content)
    emit('select', content)
  }
}

/** 滚动到选中项 */
function scrollToSelected(): void {
  nextTick(() => {
    const el = listRef.value?.querySelector(
      `.clipboard-item:nth-child(${selectedIndex.value + 1})`
    ) as HTMLElement
    el?.scrollIntoView({ block: 'nearest' })
  })
}

/** D-10: 从剪贴板历史提升为片段 */
function promoteToSnippet(text: string, event?: Event): void {
  event?.stopPropagation()
  snippetStore.promoteFromClipboard(text)
}

/** 打开编辑片段对话框 */
function openEditDialog(snippet: Snippet): void {
  editingSnippet.value = snippet
  editTitle.value = snippet.title
  editContent.value = snippet.content
  showEditDialog.value = true
}

/** 保存编辑 */
function saveEdit(): void {
  if (editingSnippet.value) {
    snippetStore.updateSnippet(editingSnippet.value.id, {
      title: editTitle.value,
      content: editContent.value
    })
  }
  showEditDialog.value = false
  editingSnippet.value = null
}

/** 打开新建片段对话框 */
function openCreateDialog(): void {
  editTitle.value = ''
  editContent.value = ''
  showCreateDialog.value = true
}

/** 保存新建片段 */
function saveCreate(): void {
  if (editTitle.value.trim() && editContent.value.trim()) {
    snippetStore.addSnippet(editTitle.value, editContent.value)
  }
  showCreateDialog.value = false
}

/** 截断文本预览 */
function truncateText(text: string, maxLen: number = 100): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen) + '...'
}

/** 格式化时间戳 */
function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin}分钟前`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}小时前`
  return d.toLocaleDateString()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="panel-fade">
      <div v-if="visible" class="clipboard-panel-backdrop" @click.self="emit('close')">
        <div class="clipboard-panel" @keydown="handleKeydown">
          <!-- 搜索框 -->
          <div class="clipboard-search">
            <input ref="searchInputRef" v-model="searchQuery" class="clipboard-search-input" placeholder="搜索..." @keydown="handleKeydown" />
          </div>

          <!-- Tab 切换 (D-14) -->
          <div class="clipboard-tabs">
            <button
              class="clipboard-tab"
              :class="{ active: activeTab === 'history' }"
              @click="() => { activeTab = 'history'; selectedIndex = 0 }"
            >
              历史
            </button>
            <button
              class="clipboard-tab"
              :class="{ active: activeTab === 'snippets' }"
              @click="() => { activeTab = 'snippets'; selectedIndex = 0 }"
            >
              收藏
            </button>
            <button
              v-if="activeTab === 'snippets'"
              class="clipboard-tab-create"
              title="新建片段"
              @click="openCreateDialog"
            >
              +
            </button>
          </div>

          <!-- 列表内容 -->
          <div ref="listRef" class="clipboard-list">
            <!-- 历史 Tab -->
            <template v-if="activeTab === 'history'">
              <div v-if="filteredHistory.length === 0" class="clipboard-empty">暂无剪贴板历史</div>
              <div
                v-for="(entry, idx) in filteredHistory"
                :key="entry.id"
                class="clipboard-item"
                :class="{ selected: idx === selectedIndex }"
                @click="selectItem(idx)"
                @mouseenter="selectedIndex = idx"
              >
                <div class="clipboard-item-content">{{ truncateText(entry.text) }}</div>
                <div class="clipboard-item-meta">
                  <span class="clipboard-item-time">{{ formatTimestamp(entry.timestamp) }}</span>
                  <button
                    class="clipboard-item-promote"
                    title="收藏"
                    @click="promoteToSnippet(entry.text, $event)"
                  >
                    ★
                  </button>
                </div>
              </div>
            </template>

            <!-- 收藏 Tab -->
            <template v-if="activeTab === 'snippets'">
              <div v-if="filteredSnippets.length === 0" class="clipboard-empty">暂无收藏片段</div>
              <div
                v-for="(snippet, idx) in filteredSnippets"
                :key="snippet.id"
                class="clipboard-item"
                :class="{ selected: idx === selectedIndex }"
                @click="selectItem(idx)"
                @mouseenter="selectedIndex = idx"
              >
                <div class="clipboard-item-title">{{ snippet.title }}</div>
                <div class="clipboard-item-content">{{ truncateText(snippet.content) }}</div>
                <div class="clipboard-item-meta">
                  <button
                    class="clipboard-item-edit"
                    title="编辑"
                    @click.stop="openEditDialog(snippet)"
                  >
                    ✎
                  </button>
                  <button
                    class="clipboard-item-delete"
                    title="删除"
                    @click.stop="snippetStore.deleteSnippet(snippet.id)"
                  >
                    🗑
                  </button>
                </div>
              </div>
            </template>
          </div>

          <!-- 底部提示 -->
          <div class="clipboard-footer">
            <span>↑↓ 导航 · Enter 选择 · Tab 切换 · Esc 关闭</span>
          </div>

          <!-- 编辑/创建片段对话框 -->
          <div
            v-if="showEditDialog || showCreateDialog"
            class="snippet-dialog-overlay"
            @click.self="() => { showEditDialog = false; showCreateDialog = false }"
          >
            <div class="snippet-dialog">
              <div class="snippet-dialog-title">
                {{ showCreateDialog ? '新建片段' : '编辑片段' }}
              </div>
              <input v-model="editTitle" class="snippet-dialog-input" placeholder="标题" />
              <textarea
                v-model="editContent"
                class="snippet-dialog-textarea"
                placeholder="内容"
                rows="5"
              />
              <div class="snippet-dialog-actions">
                <button
                  class="snippet-dialog-btn cancel"
                  @click="() => { showEditDialog = false; showCreateDialog = false }"
                >
                  取消
                </button>
                <button
                  class="snippet-dialog-btn confirm"
                  @click="showCreateDialog ? saveCreate() : saveEdit()"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.clipboard-panel-backdrop {
  position: fixed;
  inset: 0;
  background: var(--overlay-backdrop);
  z-index: 1050;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 15vh;
}

.clipboard-panel {
  width: 480px;
  max-width: 90vw;
  max-height: 60vh;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 24px var(--shadow-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.clipboard-search {
  padding: 8px;
  border-bottom: 1px solid var(--bg-tertiary);
}

.clipboard-search-input {
  width: 100%;
  padding: 8px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
}

.clipboard-search-input:focus {
  border-color: var(--accent);
}

.clipboard-tabs {
  display: flex;
  border-bottom: 1px solid var(--bg-tertiary);
  padding: 0 8px;
}

.clipboard-tab {
  padding: 8px 16px;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13px;
  border-bottom: 2px solid transparent;
}

.clipboard-tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.clipboard-tab-create {
  margin-left: auto;
  padding: 8px 12px;
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 16px;
}

.clipboard-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.clipboard-empty {
  padding: 24px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.clipboard-item {
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--bg-tertiary);
}

.clipboard-item.selected,
.clipboard-item:hover {
  background: var(--bg-tertiary);
}

.clipboard-item-title {
  font-weight: 500;
  color: var(--text-primary);
  font-size: 13px;
  margin-bottom: 2px;
}

.clipboard-item-content {
  color: var(--text-secondary);
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 60px;
  overflow: hidden;
}

.clipboard-item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.clipboard-item-time {
  color: var(--text-muted);
  font-size: 11px;
}

.clipboard-item-promote,
.clipboard-item-edit,
.clipboard-item-delete {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  padding: 2px 4px;
  opacity: 0.6;
}

.clipboard-item-promote:hover,
.clipboard-item-edit:hover,
.clipboard-item-delete:hover {
  opacity: 1;
}

.clipboard-footer {
  padding: 6px 12px;
  border-top: 1px solid var(--bg-tertiary);
  color: var(--text-muted);
  font-size: 11px;
  text-align: center;
}

/* 编辑/创建片段对话框 */
.snippet-dialog-overlay {
  position: absolute;
  inset: 0;
  background: var(--overlay-backdrop);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.snippet-dialog {
  width: 320px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.snippet-dialog-title {
  font-weight: 500;
  color: var(--text-primary);
  font-size: 14px;
}

.snippet-dialog-input,
.snippet-dialog-textarea {
  width: 100%;
  padding: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  resize: vertical;
}

.snippet-dialog-input:focus,
.snippet-dialog-textarea:focus {
  border-color: var(--accent);
}

.snippet-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.snippet-dialog-btn {
  padding: 6px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.snippet-dialog-btn.cancel {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.snippet-dialog-btn.confirm {
  background: var(--accent);
  color: white;
}

/* 动画 */
.panel-fade-enter-active,
.panel-fade-leave-active {
  transition: opacity 0.15s ease;
}
.panel-fade-enter-from,
.panel-fade-leave-to {
  opacity: 0;
}
</style>
