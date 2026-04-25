<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useWorkspaceStore } from '../stores/workspace'
import { useExtensionStore } from '../stores/extension'

const workspace = useWorkspaceStore()
const extStore = useExtensionStore()
const version = window.api.getAppVersion()
const modelName = ref<string | null>(null)

onMounted(async () => {
  try {
    const model = await window.api.claudeGetModel()
    if (model && model !== 'default') modelName.value = model
  } catch { /* ignore */ }
})
</script>

<template>
  <div class="statusbar">
    <div class="statusbar-left">
      <span v-if="extStore.extensions.length > 0" class="status-item success">
        &#x2713; {{ extStore.extensions.length }} 个扩展已加载
      </span>
      <span v-else class="status-item">无扩展</span>
    </div>
    <div class="statusbar-right">
      <span v-if="modelName" class="status-item model-badge">{{ modelName }}</span>
      <span v-if="workspace.activePath" class="status-item">
        &#x1F4C1; {{ workspace.activePath.split(/[\\/]/).pop() }}
      </span>
      <span class="status-item">v{{ version }}</span>
    </div>
  </div>
</template>

<style scoped>
.statusbar {
  height: var(--statusbar-height);
  background: var(--accent);
  color: var(--bg-primary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  font-size: 11px;
}

.statusbar-left,
.statusbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.status-item.success {
  color: var(--bg-primary);
}

.status-item.clickable {
  cursor: pointer;
  opacity: 0.9;
}

.status-item.clickable:hover {
  opacity: 1;
  text-decoration: underline;
}

.model-badge {
  background: rgba(0, 0, 0, 0.15);
  padding: 1px 8px;
  border-radius: 3px;
  font-weight: 600;
  letter-spacing: 0.3px;
}
</style>
