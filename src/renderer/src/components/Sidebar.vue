<script setup lang="ts">
import { useWorkspaceStore } from '../stores/workspace'
import FileTree from './FileTree.vue'

const workspace = useWorkspaceStore()

// D-08: 通过 emit 触发 App.vue 的工作区切换确认流程
const emit = defineEmits<{
  (e: 'open-folder'): void
}>()

function handleOpenFolder(): void {
  emit('open-folder')
}
</script>

<template>
  <div class="sidebar">
    <div class="sidebar-header">
      <span class="sidebar-title">资源管理器</span>
      <button v-if="!workspace.rootPath" class="open-btn" @click="handleOpenFolder()">
        打开文件夹
      </button>
    </div>
    <!-- D-19: 搜索框 — 实时过滤文件树 -->
    <div v-if="workspace.rootPath" class="search-box">
      <input
        type="text"
        class="search-input"
        placeholder="搜索文件..."
        v-model="workspace.filterText"
      />
      <button
        v-if="workspace.filterText"
        class="search-clear"
        @click="workspace.filterText = ''"
      >&times;</button>
    </div>
    <!-- D-20: 收藏目录列表 -->
    <div v-if="workspace.favorites.length > 0" class="favorites-section">
      <div class="favorites-header">
        <span class="favorites-title">收藏</span>
      </div>
      <div
        v-for="fav in workspace.favorites"
        :key="fav"
        class="favorite-item"
        :class="{ active: workspace.rootPath === fav }"
        @click="workspace.openFavorite(fav)"
      >
        <span class="fav-icon">&#x2B50;</span>
        <span class="fav-name">{{ fav.split(/[\\/]/).pop() }}</span>
        <span class="fav-path">{{ fav }}</span>
        <button class="fav-remove" @click.stop="workspace.removeFavorite(fav)">&times;</button>
      </div>
    </div>
    <div v-if="workspace.rootPath" class="sidebar-content">
      <div class="workspace-actions">
        <span class="workspace-name">
          {{ workspace.rootPath.split(/[\\/]/).pop() }}
        </span>
        <button
          class="fav-add-btn"
          title="收藏此目录"
          @click="workspace.addFavorite(workspace.rootPath)"
        >&#x2B50;</button>
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

/* D-19: 搜索框样式 */
.search-box {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border);
}

.search-input {
  flex: 1;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--text-primary);
  font-size: 12px;
  padding: 4px 8px;
  outline: none;
}

.search-input::placeholder {
  color: var(--text-muted);
}

.search-input:focus {
  border-color: var(--accent);
}

.search-clear {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.search-clear:hover {
  color: var(--text-primary);
}

/* D-20: 收藏目录样式 */
.favorites-section {
  border-bottom: 1px solid var(--border);
}

.favorites-header {
  padding: 6px 12px;
  display: flex;
  align-items: center;
}

.favorites-title {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: 0.5px;
}

.favorite-item {
  display: flex;
  align-items: center;
  padding: 4px 12px;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-secondary);
}

.favorite-item:hover {
  background: var(--bg-tertiary);
}

.favorite-item.active {
  background: var(--accent);
  color: var(--bg-primary);
}

.fav-icon {
  flex-shrink: 0;
  font-size: 11px;
  margin-right: 6px;
}

.fav-name {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fav-path {
  flex: 1;
  margin-left: 8px;
  font-size: 10px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.favorite-item.active .fav-path {
  color: var(--bg-primary);
  opacity: 0.7;
}

.fav-remove {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 14px;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
  flex-shrink: 0;
  visibility: hidden;
}

.favorite-item:hover .fav-remove {
  visibility: visible;
}

.fav-remove:hover {
  color: var(--error);
}

.workspace-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
}

.workspace-name {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-muted);
}

.fav-add-btn {
  background: none;
  border: none;
  font-size: 12px;
  cursor: pointer;
  padding: 0 4px;
  opacity: 0.5;
}

.fav-add-btn:hover {
  opacity: 1;
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
