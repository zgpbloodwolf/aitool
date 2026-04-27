<script setup lang="ts">
import { useWorkspaceStore } from '../stores/workspace'
import FileTree from './FileTree.vue'

const props = defineProps<{
  activeView: 'chat' | 'wechat'
}>()

const emit = defineEmits<{
  (event: 'update:activeView', value: 'chat' | 'wechat'): void
}>()

const workspace = useWorkspaceStore()
</script>

<template>
  <div class="sidebar">
    <div class="sidebar-header">
      <span class="sidebar-title">Workspace</span>
      <button v-if="!workspace.rootPath" class="open-btn" @click="workspace.openFolder()">
        Open Folder
      </button>
    </div>
    <div class="view-switch">
      <button
        class="view-btn"
        :class="{ active: props.activeView === 'chat' }"
        @click="emit('update:activeView', 'chat')"
      >
        Chat
      </button>
      <button
        class="view-btn"
        :class="{ active: props.activeView === 'wechat' }"
        @click="emit('update:activeView', 'wechat')"
      >
        微信
      </button>
    </div>
    <div v-if="workspace.rootPath" class="sidebar-content">
      <div class="workspace-name">
        {{ workspace.rootPath.split(/[\\/]/).pop() }}
      </div>
      <FileTree />
    </div>
    <div v-else class="sidebar-empty">
      <p>No folder opened</p>
    </div>
  </div>
</template>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  min-width: 200px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-header {
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border);
}

.sidebar-title {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: 0.5px;
}

.view-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
}

.view-btn {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
}

.view-btn.active {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(137, 180, 250, 0.1);
}

.open-btn {
  background: var(--accent);
  color: var(--bg-primary);
  border: none;
  padding: 3px 10px;
  border-radius: 3px;
  font-size: 11px;
  cursor: pointer;
}

.open-btn:hover {
  background: var(--accent-hover);
}

.workspace-name {
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-muted);
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
}

.sidebar-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 12px;
}
</style>
