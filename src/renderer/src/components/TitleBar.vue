<script setup lang="ts">
import { useExtensionStore } from '../stores/extension'

const emit = defineEmits<{
  (e: 'toggle-sidebar'): void
  (e: 'open-settings'): void
}>()

const extStore = useExtensionStore()
</script>

<template>
  <div class="titlebar drag-region">
    <div class="titlebar-left no-drag">
      <button class="icon-btn" @click="emit('toggle-sidebar')" title="切换侧边栏">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 3h12v1H2zm0 4h12v1H2zm0 4h12v1H2z" />
        </svg>
      </button>
      <span class="app-title">AI 工具</span>
      <select v-model="extStore.activeExtensionId" class="extension-select no-drag">
        <option disabled value="">选择扩展</option>
        <option v-for="ext in extStore.extensions" :key="ext.id" :value="ext.id">
          {{ ext.name }}
        </option>
      </select>
    </div>
    <div class="titlebar-center">
      <span v-if="extStore.extensions.length === 0" class="hint-text">未加载扩展</span>
    </div>
    <div class="titlebar-right no-drag">
      <button class="icon-btn" @click="emit('open-settings')" title="设置 (Ctrl+,)">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM8 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8z" />
          <path d="M6.87 1.24l-.28.95a5.49 5.49 0 0 0-1.34.77l-.93-.36-.64 1.1.7.7a5.48 5.48 0 0 0 0 1.55l-.7.7.64 1.1.93-.36c.4.31.85.57 1.34.77l.28.95h1.26l.28-.95a5.49 5.49 0 0 0 1.34-.77l.93.36.64-1.1-.7-.7a5.48 5.48 0 0 0 0-1.55l.7-.7-.64-1.1-.93.36a5.49 5.49 0 0 0-1.34-.77l-.28-.95H6.87z" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.titlebar {
  height: var(--titlebar-height);
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  border-bottom: 1px solid var(--border);
}

.titlebar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-title {
  font-weight: 600;
  font-size: 12px;
  color: var(--text-secondary);
}

.extension-select {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 12px;
  outline: none;
  cursor: pointer;
}

.extension-select:focus {
  border-color: var(--accent);
}

.icon-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
}

.icon-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.titlebar-center {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.titlebar-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.hint-text {
  color: var(--text-muted);
  font-size: 12px;
}
</style>
