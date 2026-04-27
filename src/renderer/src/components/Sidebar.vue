<script setup lang="ts">
import { ref } from 'vue'
import { useWorkspaceStore, type Project } from '../stores/workspace'
import FileTree from './FileTree.vue'

const props = defineProps<{
  activeView: 'chat' | 'wechat'
}>()

const emit = defineEmits<{
  (e: 'update:activeView', value: 'chat' | 'wechat'): void
  (e: 'open-folder'): void
}>()

const workspace = useWorkspaceStore()
const editingTagProjectId = ref<string | null>(null)
const newTagInput = ref('')
const collapsedTags = ref(new Set<string>())

function handleOpenFolder(): void {
  emit('open-folder')
}

function handleToggleExpand(project: Project): void {
  workspace.toggleProjectExpanded(project.id)
  if (!project.isActive) {
    workspace.activateProject(project.id)
  }
}

function handleActivate(project: Project): void {
  if (!project.isActive) {
    workspace.activateProject(project.id)
  }
}

function handleClose(project: Project): void {
  workspace.removeProject(project.id)
}

function handleToggleFavorite(project: Project): void {
  workspace.toggleFavorite(project.id)
}

function handleToggleDir(projectId: string, path: string): void {
  workspace.toggleProjectDir(projectId, path)
}

function handleSelectFile(path: string): void {
  workspace.selectFile(path)
}

function toggleTagCollapse(tag: string): void {
  if (collapsedTags.value.has(tag)) {
    collapsedTags.value.delete(tag)
  } else {
    collapsedTags.value.add(tag)
  }
}

function startAddTag(projectId: string): void {
  editingTagProjectId.value = projectId
  newTagInput.value = ''
}

function confirmAddTag(): void {
  if (!editingTagProjectId.value || !newTagInput.value.trim()) return
  workspace.addTag(editingTagProjectId.value, newTagInput.value.trim())
  editingTagProjectId.value = null
  newTagInput.value = ''
}

function cancelAddTag(): void {
  editingTagProjectId.value = null
  newTagInput.value = ''
}
</script>

<template>
  <div class="sidebar">
    <div class="sidebar-header">
      <span class="sidebar-title">Workspace</span>
      <button class="add-btn" title="Add folder" @click="handleOpenFolder">+</button>
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
        WeChat
      </button>
    </div>

    <div v-if="workspace.projects.length > 0" class="search-box">
      <input
        v-model="workspace.filterText"
        type="text"
        class="search-input"
        placeholder="搜索文件..."
      />
      <button v-if="workspace.filterText" class="search-clear" @click="workspace.filterText = ''">
        &times;
      </button>
    </div>

    <div class="sidebar-content">
      <template v-if="workspace.favoriteProjects.length > 0">
        <template v-for="(tagProjects, tag) in workspace.favoritesByTag" :key="tag">
          <div class="tag-group">
            <div class="tag-header" @click="toggleTagCollapse(tag)">
              <span class="tag-arrow">{{ collapsedTags.has(tag) ? '▸' : '▾' }}</span>
              <span class="tag-name">{{ tag }}</span>
              <span class="tag-count">{{ tagProjects.length }}</span>
            </div>
            <template v-if="!collapsedTags.has(tag)">
              <div v-for="project in tagProjects" :key="project.id" class="project-section">
                <div
                  class="project-row"
                  :class="{ active: project.isActive }"
                  @click="handleActivate(project)"
                >
                  <button class="expand-btn" @click.stop="handleToggleExpand(project)">
                    {{ project.expanded ? '▾' : '▸' }}
                  </button>
                  <span class="project-name">{{ project.name }}</span>
                  <span class="project-actions">
                    <button
                      class="action-btn tag-add-btn"
                      title="添加标签"
                      @click.stop="startAddTag(project.id)"
                    >
                      #
                    </button>
                    <button
                      class="action-btn fav-btn is-fav"
                      title="取消收藏"
                      @click.stop="handleToggleFavorite(project)"
                    >
                      ★
                    </button>
                  </span>
                </div>

                <div v-if="editingTagProjectId === project.id" class="tag-edit">
                  <input
                    v-model="newTagInput"
                    class="tag-input"
                    placeholder="输入标签名"
                    @keydown.enter="confirmAddTag"
                    @keydown.escape="cancelAddTag"
                  />
                  <button class="tag-confirm" @click="confirmAddTag">✓</button>
                  <button class="tag-cancel" @click="cancelAddTag">✕</button>
                  <div v-if="project.tags.length > 0" class="tag-chips">
                    <span v-for="t in project.tags" :key="t" class="tag-chip">
                      {{ t }}
                      <button class="chip-remove" @click.stop="workspace.removeTag(project.id, t)">
                        ×
                      </button>
                    </span>
                  </div>
                </div>

                <div
                  v-if="project.tags.length > 0 && editingTagProjectId !== project.id"
                  class="tag-chips-inline"
                >
                  <span v-for="t in project.tags" :key="t" class="tag-chip-small">{{ t }}</span>
                </div>

                <div v-if="project.expanded" class="project-tree">
                  <FileTree
                    :files="workspace.filteredProjectFiles(project.id)"
                    :expanded-dirs="project.expandedDirs"
                    :selected-file="workspace.selectedFile"
                    :filter-text="workspace.filterText"
                    @toggle-dir="(path: string) => handleToggleDir(project.id, path)"
                    @select-file="handleSelectFile"
                  />
                </div>
              </div>
            </template>
          </div>
        </template>
      </template>

      <template v-if="workspace.ephemeralProjects.length > 0">
        <div class="ephemeral-section">
          <div class="section-header">未收藏</div>
          <div
            v-for="project in workspace.ephemeralProjects"
            :key="project.id"
            class="project-section"
          >
            <div
              class="project-row"
              :class="{ active: project.isActive }"
              @click="handleActivate(project)"
            >
              <button class="expand-btn" @click.stop="handleToggleExpand(project)">
                {{ project.expanded ? '▾' : '▸' }}
              </button>
              <span class="project-name">{{ project.name }}</span>
              <span class="project-actions">
                <button class="action-btn fav-btn" title="收藏" @click.stop="handleToggleFavorite(project)">
                  ★
                </button>
                <button class="action-btn close-btn" title="关闭" @click.stop="handleClose(project)">
                  ×
                </button>
              </span>
            </div>
            <div v-if="project.expanded" class="project-tree">
              <FileTree
                :files="workspace.filteredProjectFiles(project.id)"
                :expanded-dirs="project.expandedDirs"
                :selected-file="workspace.selectedFile"
                :filter-text="workspace.filterText"
                @toggle-dir="(path: string) => handleToggleDir(project.id, path)"
                @select-file="handleSelectFile"
              />
            </div>
          </div>
        </div>
      </template>

      <div v-if="workspace.projects.length === 0" class="sidebar-empty">
        <p>点击 + 添加文件夹</p>
      </div>
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

.add-btn {
  background: var(--accent);
  color: var(--bg-primary);
  border: none;
  width: 22px;
  height: 22px;
  border-radius: 3px;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-btn:hover {
  background: var(--accent-hover);
}

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

.sidebar-content {
  flex: 1;
  overflow-y: auto;
}

.tag-group {
  border-bottom: 1px solid var(--border);
}

.tag-header {
  display: flex;
  align-items: center;
  padding: 5px 10px;
  cursor: pointer;
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.tag-header:hover {
  background: var(--bg-tertiary);
}

.tag-arrow {
  font-size: 8px;
  margin-right: 4px;
}

.tag-name {
  flex: 1;
  font-weight: 600;
}

.tag-count {
  font-size: 10px;
  opacity: 0.6;
}

.ephemeral-section {
  border-bottom: 1px solid var(--border);
}

.section-header {
  padding: 5px 10px;
  font-size: 11px;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: 0.3px;
  font-weight: 600;
}

.project-section {
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

.project-row {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
}

.project-row:hover {
  background: var(--bg-tertiary);
}

.project-row.active {
  border-left: 2px solid var(--accent);
  padding-left: 6px;
}

.expand-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 9px;
  cursor: pointer;
  padding: 0 3px;
  width: 16px;
  flex-shrink: 0;
}

.project-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-left: 2px;
}

.project-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s;
}

.project-row:hover .project-actions {
  opacity: 1;
}

.action-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  padding: 0 3px;
  line-height: 1;
}

.action-btn:hover {
  color: var(--text-primary);
}

.fav-btn.is-fav {
  color: var(--accent);
}

.close-btn:hover {
  color: var(--error);
}

.tag-edit {
  display: flex;
  align-items: center;
  padding: 3px 10px 3px 32px;
  gap: 3px;
  flex-wrap: wrap;
}

.tag-input {
  background: var(--bg-tertiary);
  border: 1px solid var(--accent);
  border-radius: 3px;
  color: var(--text-primary);
  font-size: 11px;
  padding: 2px 6px;
  outline: none;
  width: 80px;
}

.tag-confirm,
.tag-cancel {
  background: none;
  border: none;
  font-size: 12px;
  cursor: pointer;
  padding: 0 2px;
}

.tag-confirm {
  color: var(--accent);
}

.tag-cancel {
  color: var(--text-muted);
}

.tag-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  width: 100%;
  margin-top: 2px;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  background: var(--bg-tertiary);
  border-radius: 3px;
  font-size: 10px;
  padding: 1px 5px;
  color: var(--accent);
  gap: 2px;
}

.chip-remove {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 10px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.chip-remove:hover {
  color: var(--error);
}

.tag-chips-inline {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  padding: 0 10px 3px 32px;
}

.tag-chip-small {
  font-size: 9px;
  background: var(--bg-tertiary);
  border-radius: 3px;
  padding: 0 4px;
  color: var(--text-muted);
}

.project-tree {
  border-top: 1px solid rgba(255, 255, 255, 0.03);
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
