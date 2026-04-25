<script lang="ts">
import { defineComponent } from 'vue'
import { useWorkspaceStore, type FileEntry } from '../stores/workspace'

const FileTreeItem = defineComponent({
  name: 'FileTreeItem',
  props: {
    entry: { type: Object as () => FileEntry, required: true },
    depth: { type: Number, required: true }
  },
  setup() {
    const workspace = useWorkspaceStore()
    return { workspace }
  },
  template: `
    <div
      class="file-entry"
      :class="{ selected: workspace.selectedFile === entry.path }"
      :style="{ paddingLeft: (12 + depth * 16) + 'px' }"
      @click="entry.isDirectory ? workspace.toggleDir(entry.path) : workspace.selectFile(entry.path)"
    >
      <span class="icon">{{ entry.isDirectory ? (workspace.expandedDirs.has(entry.path) ? '\\u{1F4C2}' : '\\u{1F4C1}') : '\\u{1F4C4}' }}</span>
      <span class="name">{{ entry.name }}</span>
    </div>
    <template v-if="entry.isDirectory && entry.children">
      <FileTreeItem
        v-for="child in entry.children"
        :key="child.path"
        :entry="child"
        :depth="depth + 1"
      />
    </template>
  `
})

export default defineComponent({
  name: 'FileTree',
  components: { FileTreeItem },
  setup() {
    const workspace = useWorkspaceStore()

    function getIcon(entry: FileEntry): string {
      if (entry.isDirectory) return '\u{1F4C1}'
      const ext = entry.name.split('.').pop()?.toLowerCase()
      const icons: Record<string, string> = {
        ts: '\u{1F4C4}',
        tsx: '\u{2699}\u{FE0F}',
        js: '\u{1F4C4}',
        vue: '\u{1F7E2}',
        json: '\u{1F4C4}',
        css: '\u{1F3A8}',
        html: '\u{1F310}',
        md: '\u{1F4DD}'
      }
      return icons[ext ?? ''] ?? '\u{1F4C4}'
    }

    return { workspace, getIcon, FileTreeItem }
  },
  template: `
    <div class="file-tree">
      <template v-for="entry in workspace.filteredFiles" :key="entry.path">
        <div
          class="file-entry"
          :class="{ selected: workspace.selectedFile === entry.path }"
          :style="{ paddingLeft: '12px' }"
          @click="entry.isDirectory ? workspace.toggleDir(entry.path) : workspace.selectFile(entry.path)"
        >
          <span class="icon">{{ entry.isDirectory ? (workspace.expandedDirs.has(entry.path) ? '\\u{1F4C2}' : '\\u{1F4C1}') : getIcon(entry) }}</span>
          <span class="name">{{ entry.name }}</span>
        </div>
        <template v-if="entry.isDirectory && entry.children">
          <FileTreeItem
            v-for="child in entry.children"
            :key="child.path"
            :entry="child"
            :depth="1"
          />
        </template>
      </template>
      <div v-if="workspace.filteredFiles.length === 0 && workspace.filterText" class="filter-empty">
        无匹配文件
      </div>
    </div>
  `
})
</script>

<style scoped>
.file-tree {
  font-size: 13px;
  user-select: none;
}

.file-entry {
  display: flex;
  align-items: center;
  padding: 2px 8px;
  cursor: pointer;
  white-space: nowrap;
}

.file-entry:hover {
  background: var(--bg-tertiary);
}

.file-entry.selected {
  background: var(--accent);
  color: var(--bg-primary);
}

.icon {
  width: 20px;
  text-align: center;
  flex-shrink: 0;
  font-size: 14px;
}

.name {
  margin-left: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* D-19: 搜索无匹配时的空状态提示 */
.filter-empty {
  padding: 12px 16px;
  color: var(--text-muted);
  font-size: 12px;
  text-align: center;
}
</style>
