<script setup lang="ts">
/**
 * 更新提示组件 — 发现新版本时显示模态对话框
 *
 * D-14: 三按钮设计：立即更新 / 稍后提醒 / 跳过此版本
 * D-15: 完整流程：提示 → 下载进度 → 下载完成 → 重启安装
 * 跳过版本记录到 settings store，不再重复提示
 */

import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useSettingsStore } from '../stores/settings'

const settingsStore = useSettingsStore()

const visible = ref(false)
const version = ref('')
const releaseNotes = ref('')
const downloading = ref(false)
const progress = ref(0)
const downloadComplete = ref(false)
const hasError = ref(false)
const errorMessage = ref('')

let offAvailable: (() => void) | null = null
let offProgress: (() => void) | null = null
let offDownloaded: (() => void) | null = null
let offError: (() => void) | null = null

onMounted(() => {
  // 监听：发现新版本
  offAvailable = window.api.onUpdaterAvailable((info) => {
    // D-14: 检查是否已跳过此版本
    if (settingsStore.settings.skippedVersion === info.version) return
    version.value = info.version
    releaseNotes.value = formatReleaseNotes(info.releaseNotes)
    visible.value = true
    downloading.value = false
    downloadComplete.value = false
    hasError.value = false
  })

  // 监听：下载进度
  offProgress = window.api.onUpdaterProgress((data) => {
    progress.value = data.percent
  })

  // 监听：下载完成
  offDownloaded = window.api.onUpdaterDownloaded(() => {
    downloading.value = false
    downloadComplete.value = true
  })

  // 监听：更新错误
  offError = window.api.onUpdaterError((data) => {
    downloading.value = false
    hasError.value = true
    errorMessage.value = data.message
  })
})

onBeforeUnmount(() => {
  offAvailable?.()
  offProgress?.()
  offDownloaded?.()
  offError?.()
})

/** 点击"立即更新"或"重启并安装" */
function handleUpdateNow(): void {
  if (downloadComplete.value) {
    // 已下载完成，执行安装
    window.api.updaterInstall()
  } else {
    // 开始下载
    downloading.value = true
    hasError.value = false
    window.api.updaterDownload()
  }
}

/** 点击"稍后提醒" — 关闭对话框 */
function handleLater(): void {
  visible.value = false
}

/** 点击"跳过此版本" — 记录到 settings store */
function handleSkip(): void {
  settingsStore.update({ skippedVersion: version.value })
  visible.value = false
}

/**
 * 格式化发布说明
 * electron-updater 的 releaseNotes 可能是字符串或数组
 */
function formatReleaseNotes(
  notes: string | Array<{ version: string; note: string }> | undefined
): string {
  if (!notes) return '暂无更新说明'
  if (typeof notes === 'string') return notes
  if (Array.isArray(notes)) return notes.map((n) => n.note).join('\n')
  return '暂无更新说明'
}
</script>

<template>
  <Transition name="modal">
    <div v-if="visible" class="update-overlay" @click.self="handleLater">
      <div class="update-dialog">
        <h3 class="update-title">发现新版本</h3>
        <p class="update-version">v{{ version }}</p>

        <!-- 错误状态 -->
        <div v-if="hasError" class="update-error">
          <p>更新失败: {{ errorMessage }}</p>
        </div>

        <!-- 下载中进度条 -->
        <div v-else-if="downloading" class="update-progress">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: progress + '%' }" />
          </div>
          <p class="progress-text">{{ progress }}%</p>
        </div>

        <!-- 下载完成提示 -->
        <div v-else-if="downloadComplete" class="update-complete">
          <p>下载完成，需要重启应用以安装更新。</p>
        </div>

        <!-- 更新说明 -->
        <div v-else class="update-notes">
          <p class="notes-label">更新内容：</p>
          <pre class="notes-text">{{ releaseNotes }}</pre>
        </div>

        <!-- 操作按钮 -->
        <div class="update-actions">
          <button
            v-if="!hasError && !downloading"
            class="btn-primary"
            @click="handleUpdateNow"
          >
            {{ downloadComplete ? '重启并安装' : '立即更新' }}
          </button>
          <button
            v-if="!downloading && !downloadComplete"
            class="btn-secondary"
            @click="handleLater"
          >
            稍后提醒
          </button>
          <button
            v-if="!downloading && !downloadComplete && !hasError"
            class="btn-ghost"
            @click="handleSkip"
          >
            跳过此版本
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.update-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}

.update-dialog {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 24px;
  max-width: 480px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.update-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 4px 0;
}

.update-version {
  font-size: 14px;
  color: var(--accent);
  margin: 0 0 16px 0;
  font-weight: 500;
}

/* 错误提示 */
.update-error {
  background: rgba(243, 139, 168, 0.1);
  border: 1px solid rgba(243, 139, 168, 0.3);
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 16px;
}

.update-error p {
  color: var(--error);
  font-size: 13px;
}

/* 下载进度 */
.update-progress {
  margin-bottom: 16px;
}

.progress-bar {
  height: 4px;
  background: var(--bg-tertiary);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.progress-text {
  text-align: center;
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 8px;
}

/* 下载完成提示 */
.update-complete {
  background: rgba(166, 227, 161, 0.1);
  border: 1px solid rgba(166, 227, 161, 0.3);
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 16px;
}

.update-complete p {
  color: var(--success);
  font-size: 13px;
}

/* 更新说明 */
.update-notes {
  margin-bottom: 16px;
}

.notes-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.notes-text {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 12px;
  font-size: 12px;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
  font-family: 'Segoe UI', system-ui, sans-serif;
  margin: 0;
}

/* 按钮区域 */
.update-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.btn-primary {
  background: var(--accent);
  color: var(--bg-primary);
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.15s;
}

.btn-primary:hover {
  background: var(--accent-hover);
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-secondary:hover {
  background: var(--border);
}

.btn-ghost {
  background: transparent;
  color: var(--text-muted);
  border: none;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: color 0.15s;
}

.btn-ghost:hover {
  color: var(--text-primary);
}

/* 模态框过渡动画 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
