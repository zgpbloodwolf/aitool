<script setup lang="ts">
import { useWorkspaceStore } from '../stores/workspace'
import FileTree from './FileTree.vue'

const workspace = useWorkspaceStore()
</script>

<template>
  <div class="sidebar">
    <div class="sidebar-header">
      <span class="sidebar-title">资源管理器</span>
      <button v-if="!workspace.rootPath" class="open-btn" @click="workspace.openFolder()">
        打开文件夹
      </button>
    </div>
    <div v-if="workspace.rootPath" class="sidebar-content">
      <div class="workspace-name">
        {{ workspace.rootPath.split(/[\\/]/).pop() }}
      </div>
      <FileTree />
    </div>
    <div v-else class="sidebar-empty">
      <p>未打开文件夹</p>
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
