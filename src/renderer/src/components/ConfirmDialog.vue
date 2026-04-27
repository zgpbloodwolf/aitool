<!--
  ConfirmDialog - 通用确认对话框组件

  使用 Catppuccin Mocha 主题 CSS 变量，
  支持 danger / warning / info 三种确认按钮样式。
  所有需要用户确认的操作（删除会话、关闭活跃标签、切换工作区）统一使用此组件。
-->
<script setup lang="ts">
defineProps<{
  visible: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info'
}>()

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

function handleConfirm(): void {
  emit('confirm')
}

function handleCancel(): void {
  emit('cancel')
}
</script>

<template>
  <Transition name="dialog-fade">
    <div v-if="visible" class="dialog-overlay" @click.self="handleCancel">
      <div class="confirm-dialog">
        <h3 class="dialog-title">{{ title }}</h3>
        <p class="dialog-message">{{ message }}</p>
        <div class="dialog-actions">
          <button class="btn-cancel" @click="handleCancel">
            {{ cancelText || '取消' }}
          </button>
          <button class="btn-confirm" :class="type || 'info'" @click="handleConfirm">
            {{ confirmText || '确定' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: var(--dialog-backdrop);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.confirm-dialog {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px 24px;
  min-width: 320px;
  max-width: 420px;
}

.dialog-title {
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 8px;
}

.dialog-message {
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 20px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn-cancel {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: none;
  padding: 6px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.btn-cancel:hover {
  background: var(--border);
}

.btn-confirm {
  border: none;
  padding: 6px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: var(--bg-primary);
}

.btn-confirm.danger {
  background: var(--error);
}

.btn-confirm.warning {
  background: var(--warning);
}

.btn-confirm.info {
  background: var(--accent);
}

.btn-confirm.danger:hover {
  background: var(--error-hover);
}

.btn-confirm.warning:hover {
  background: var(--warning-hover);
}

.btn-confirm.info:hover {
  background: var(--accent-hover);
}

/* 淡入淡出动画 */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.15s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}
</style>
