<script setup lang="ts">
import { useExtensionStore } from '../stores/extension'

const emit = defineEmits<{
  (e: 'toggle-sidebar'): void
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

.hint-text {
  color: var(--text-muted);
  font-size: 12px;
}
</style>
