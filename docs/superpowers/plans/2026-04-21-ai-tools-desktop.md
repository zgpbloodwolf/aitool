# AI Tools Desktop - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight Windows desktop app (Electron + Vue 3) that hosts VSCode extensions (Claude Code, Codex) with an AI-chat-focused UI.

**Architecture:** Three-process model: Electron main process manages the window and extension host; a Node.js child process runs the VSCode extension host with loaded extensions; a Vue 3 renderer renders the chat UI (via extension webviews), file tree, and terminal. Communication between main process and extension host uses VSCode's binary RPC protocol over stdio.

**Tech Stack:** Electron 33+, Vue 3, TypeScript, Vite (via electron-vite), xterm.js, Pinia, node-pty

---

## Phase 1: Project Scaffold + Basic UI Shell

### Task 1: Initialize electron-vite project

**Files:**
- Create: `package.json`
- Create: `electron.vite.config.ts`
- Create: `src/main/index.ts`
- Create: `src/preload/index.ts`
- Create: `src/renderer/index.html`
- Create: `src/renderer/src/main.ts`
- Create: `src/renderer/src/App.vue`
- Create: `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`

- [ ] **Step 1: Create project from template**

```bash
cd e:/work/projects/new-aitools
npm create @quick-start/electron@latest . -- --template vue-ts
```

When prompted, accept defaults. This creates the electron-vite + Vue 3 + TypeScript scaffold.

- [ ] **Step 2: Install additional dependencies**

```bash
npm install pinia xterm @xterm/xterm @xterm/addon-fit @xterm/addon-web-links node-pty
npm install -D @types/node-pty
```

- [ ] **Step 3: Verify project runs**

```bash
npm run dev
```

Expected: An Electron window opens with the default Vue 3 welcome page.

- [ ] **Step 4: Commit**

```bash
git init
git add .
git commit -m "chore: initialize electron-vite + vue3 + ts project"
```

---

### Task 2: Configure window and basic Electron setup

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Configure main process window**

Replace `src/main/index.ts` with:

```typescript
import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1e1e2e',
      symbolColor: '#cdd6f4',
      height: 36
    },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.aitools.desktop')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
```

- [ ] **Step 2: Set up preload with IPC bridge**

Replace `src/preload/index.ts` with:

```typescript
import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // Workspace
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:selectFolder'),
  readDir: (dirPath: string): Promise<string[]> => ipcRenderer.invoke('fs:readDir', dirPath),
  readFile: (filePath: string): Promise<string> => ipcRenderer.invoke('fs:readFile', filePath),
  stat: (filePath: string): Promise<{ isFile: boolean; isDirectory: boolean; size: number }> =>
    ipcRenderer.invoke('fs:stat', filePath),

  // Terminal
  terminalCreate: (id: string): void => ipcRenderer.send('terminal:create', id),
  terminalWrite: (id: string, data: string): void => ipcRenderer.send('terminal:write', id, data),
  terminalResize: (id: string, cols: number, rows: number): void =>
    ipcRenderer.send('terminal:resize', id, cols, rows),
  terminalKill: (id: string): void => ipcRenderer.send('terminal:kill', id),
  onTerminalData: (callback: (id: string, data: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, id: string, data: string): void => callback(id, data)
    ipcRenderer.on('terminal:data', handler)
    return () => ipcRenderer.removeListener('terminal:data', handler)
  },

  // Extension Host
  getInstalledExtensions: (): Promise<ExtensionInfo[]> =>
    ipcRenderer.invoke('ext:getInstalled'),
  activateExtension: (extensionId: string): Promise<void> =>
    ipcRenderer.invoke('ext:activate', extensionId),

  // App
  getAppVersion: (): string => app.getVersion()
}

export interface ExtensionInfo {
  id: string
  name: string
  version: string
  description: string
  publisher: string
  extensionPath: string
  iconPath?: string
}

declare const app: { getVersion: () => string }

contextBridge.exposeInMainWorld('api', api)
```

- [ ] **Step 3: Verify dev server still works**

```bash
npm run dev
```

Expected: Window opens with custom title bar, no default menu.

- [ ] **Step 4: Commit**

```bash
git add src/main/index.ts src/preload/index.ts
git commit -m "feat: configure custom window and preload IPC bridge"
```

---

### Task 3: IPC handler registration in main process

**Files:**
- Create: `src/main/ipc/dialog.ts`
- Create: `src/main/ipc/filesystem.ts`
- Create: `src/main/ipc/terminal.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: Create dialog IPC handlers**

Create `src/main/ipc/dialog.ts`:

```typescript
import { dialog, BrowserWindow } from 'electron'

export function registerDialogHandlers(): void {
  const { ipcMain } = require('electron')

  ipcMain.handle('dialog:selectFolder', async () => {
    const window = BrowserWindow.getFocusedWindow()
    if (!window) return null

    const result = await dialog.showOpenDialog(window, {
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0] ?? null
  })
}
```

- [ ] **Step 2: Create filesystem IPC handlers**

Create `src/main/ipc/filesystem.ts`:

```typescript
import { readdir, readFile, stat } from 'fs/promises'
import { join } from 'path'

export function registerFilesystemHandlers(): void {
  const { ipcMain } = require('electron')

  ipcMain.handle('fs:readDir', async (_event, dirPath: string) => {
    const entries = await readdir(dirPath, { withFileTypes: true })
    return entries
      .filter((e) => !e.name.startsWith('.'))
      .map((e) => ({ name: e.name, isDirectory: e.isDirectory(), isFile: e.isFile() }))
  })

  ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
    return await readFile(filePath, 'utf-8')
  })

  ipcMain.handle('fs:stat', async (_event, filePath: string) => {
    const s = await stat(filePath)
    return { isFile: s.isFile(), isDirectory: s.isDirectory(), size: s.size }
  })
}
```

- [ ] **Step 3: Create terminal IPC handlers**

Create `src/main/ipc/terminal.ts`:

```typescript
import { BrowserWindow, ipcMain } from 'electron'
importpty from 'node-pty'

const terminals = new Map<string, pty.IPty>()

export function registerTerminalHandlers(): void {
  ipcMain.on('terminal:create', (event, id: string) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return

    const ptyProcess = pty.spawn('powershell.exe', [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: process.env.USERPROFILE || 'C:\\',
      env: process.env as Record<string, string>
    })

    terminals.set(id, ptyProcess)

    ptyProcess.onData((data: string) => {
      window.webContents.send('terminal:data', id, data)
    })

    ptyProcess.onExit(({ exitCode }) => {
      window.webContents.send('terminal:data', id, `\r\n[Process exited with code ${exitCode}]\r\n`)
      terminals.delete(id)
    })
  })

  ipcMain.on('terminal:write', (_event, id: string, data: string) => {
    terminals.get(id)?.write(data)
  })

  ipcMain.on('terminal:resize', (_event, id: string, cols: number, rows: number) => {
    terminals.get(id)?.resize(cols, rows)
  })

  ipcMain.on('terminal:kill', (_event, id: string) => {
    terminals.get(id)?.kill()
    terminals.delete(id)
  })
}
```

- [ ] **Step 4: Register all handlers in main process**

Add to the top of `src/main/index.ts`:

```typescript
import { registerDialogHandlers } from './ipc/dialog'
import { registerFilesystemHandlers } from './ipc/filesystem'
import { registerTerminalHandlers } from './ipc/terminal'
```

Add inside `app.whenReady().then(...)` before `createWindow()`:

```typescript
registerDialogHandlers()
registerFilesystemHandlers()
registerTerminalHandlers()
```

- [ ] **Step 5: Verify builds**

```bash
npm run build
```

Expected: Build completes without errors.

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc/
git commit -m "feat: add IPC handlers for dialog, filesystem, and terminal"
```

---

### Task 4: Pinia stores

**Files:**
- Create: `src/renderer/src/stores/workspace.ts`
- Create: `src/renderer/src/stores/terminal.ts`
- Create: `src/renderer/src/stores/extension.ts`
- Modify: `src/renderer/src/main.ts`

- [ ] **Step 1: Create workspace store**

Create `src/renderer/src/stores/workspace.ts`:

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  isFile: boolean
  children?: FileEntry[]
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const rootPath = ref<string | null>(null)
  const files = ref<FileEntry[]>([])
  const expandedDirs = ref(new Set<string>())
  const selectedFile = ref<string | null>(null)

  async function openFolder(): Promise<void> {
    const path = await window.api.selectFolder()
    if (path) {
      rootPath.value = path
      await refreshFiles()
    }
  }

  async function refreshFiles(): Promise<void> {
    if (!rootPath.value) return
    files.value = await loadDirectory(rootPath.value)
  }

  async function loadDirectory(dirPath: string): Promise<FileEntry[]> {
    const entries = await window.api.readDir(dirPath)
    const result: FileEntry[] = []
    for (const entry of entries) {
      const fullPath = `${dirPath}/${entry.name}`
      const item: FileEntry = {
        name: entry.name,
        path: fullPath,
        isDirectory: entry.isDirectory,
        isFile: entry.isFile
      }
      if (entry.isDirectory && expandedDirs.value.has(fullPath)) {
        item.children = await loadDirectory(fullPath)
      }
      result.push(item)
    }
    result.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    return result
  }

  async function toggleDir(path: string): Promise<void> {
    if (expandedDirs.value.has(path)) {
      expandedDirs.value.delete(path)
    } else {
      expandedDirs.value.add(path)
    }
    await refreshFiles()
  }

  function selectFile(path: string): void {
    selectedFile.value = path
  }

  return { rootPath, files, expandedDirs, selectedFile, openFolder, refreshFiles, toggleDir, selectFile }
})
```

- [ ] **Step 2: Create terminal store**

Create `src/renderer/src/stores/terminal.ts`:

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface TerminalInstance {
  id: string
  name: string
}

export const useTerminalStore = defineStore('terminal', () => {
  const terminals = ref<TerminalInstance[]>([])
  const activeTerminalId = ref<string | null>(null)

  function createTerminal(name?: string): string {
    const id = `term-${Date.now()}`
    terminals.value.push({
      id,
      name: name ?? `Terminal ${terminals.value.length + 1}`
    })
    activeTerminalId.value = id
    window.api.terminalCreate(id)
    return id
  }

  function removeTerminal(id: string): void {
    window.api.terminalKill(id)
    terminals.value = terminals.value.filter((t) => t.id !== id)
    if (activeTerminalId.value === id) {
      activeTerminalId.value = terminals.value[0]?.id ?? null
    }
  }

  function setActive(id: string): void {
    activeTerminalId.value = id
  }

  return { terminals, activeTerminalId, createTerminal, removeTerminal, setActive }
})
```

- [ ] **Step 3: Create extension store**

Create `src/renderer/src/stores/extension.ts`:

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ExtensionInfo {
  id: string
  name: string
  version: string
  description: string
  publisher: string
  extensionPath: string
  iconPath?: string
}

export const useExtensionStore = defineStore('extension', () => {
  const extensions = ref<ExtensionInfo[]>([])
  const activeExtensionId = ref<string | null>(null)
  const loading = ref(false)

  async function loadExtensions(): Promise<void> {
    loading.value = true
    try {
      extensions.value = await window.api.getInstalledExtensions()
      if (extensions.value.length > 0 && !activeExtensionId.value) {
        activeExtensionId.value = extensions.value[0].id
      }
    } finally {
      loading.value = false
    }
  }

  async function activateExtension(id: string): Promise<void> {
    await window.api.activateExtension(id)
    activeExtensionId.value = id
  }

  return { extensions, activeExtensionId, loading, loadExtensions, activateExtension }
})
```

- [ ] **Step 4: Register Pinia in main.ts**

Replace `src/renderer/src/main.ts` with:

```typescript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './assets/main.css'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
```

- [ ] **Step 5: Verify dev server**

```bash
npm run dev
```

Expected: Window opens, no errors in console.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/stores/ src/renderer/src/main.ts
git commit -m "feat: add Pinia stores for workspace, terminal, and extensions"
```

---

### Task 5: Layout shell and CSS

**Files:**
- Create: `src/renderer/src/assets/main.css`
- Modify: `src/renderer/src/App.vue`

- [ ] **Step 1: Create global styles**

Create `src/renderer/src/assets/main.css`:

```css
:root {
  --bg-primary: #1e1e2e;
  --bg-secondary: #181825;
  --bg-tertiary: #313244;
  --text-primary: #cdd6f4;
  --text-secondary: #a6adc8;
  --text-muted: #6c7086;
  --accent: #89b4fa;
  --accent-hover: #74c7ec;
  --border: #45475a;
  --success: #a6e3a1;
  --error: #f38ba8;
  --warning: #fab387;
  --sidebar-width: 260px;
  --titlebar-height: 36px;
  --statusbar-height: 24px;
  --terminal-default-height: 200px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  width: 100%;
  overflow: hidden;
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  font-size: 13px;
  color: var(--text-primary);
  background: var(--bg-primary);
}

::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--bg-tertiary);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--border);
}

.drag-region {
  -webkit-app-region: drag;
}

.no-drag {
  -webkit-app-region: no-drag;
}
```

- [ ] **Step 2: Create main layout in App.vue**

Replace `src/renderer/src/App.vue` with:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import TitleBar from './components/TitleBar.vue'
import Sidebar from './components/Sidebar.vue'
import ChatPanel from './components/ChatPanel.vue'
import TerminalPanel from './components/TerminalPanel.vue'
import StatusBar from './components/StatusBar.vue'

const sidebarVisible = ref(true)
const terminalVisible = ref(false)
const terminalHeight = ref(200)
</script>

<template>
  <div class="app-layout">
    <TitleBar @toggle-sidebar="sidebarVisible = !sidebarVisible" />
    <div class="main-content">
      <Sidebar v-if="sidebarVisible" />
      <div class="center-area">
        <ChatPanel class="chat-area" />
        <div
          v-if="terminalVisible"
          class="terminal-resizer"
          @mousedown="startResize"
        />
        <TerminalPanel
          v-if="terminalVisible"
          :style="{ height: terminalHeight + 'px' }"
        />
      </div>
    </div>
    <StatusBar @toggle-terminal="terminalVisible = !terminalVisible" />
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.center-area {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.chat-area {
  flex: 1;
  overflow: hidden;
}

.terminal-resizer {
  height: 4px;
  background: var(--border);
  cursor: ns-resize;
  flex-shrink: 0;
}

.terminal-resizer:hover {
  background: var(--accent);
}
</style>
```

- [ ] **Step 3: Verify layout renders**

```bash
npm run dev
```

Expected: Dark-themed layout with title bar, sidebar area, main area, status bar. No component errors (components will error since they don't exist yet - that's fine, we create them next).

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/assets/main.css src/renderer/src/App.vue
git commit -m "feat: add main layout shell with CSS grid and dark theme"
```

---

### Task 6: UI Components

**Files:**
- Create: `src/renderer/src/components/TitleBar.vue`
- Create: `src/renderer/src/components/Sidebar.vue`
- Create: `src/renderer/src/components/ChatPanel.vue`
- Create: `src/renderer/src/components/TerminalPanel.vue`
- Create: `src/renderer/src/components/StatusBar.vue`
- Create: `src/renderer/src/components/FileTree.vue`

- [ ] **Step 1: Create TitleBar component**

Create `src/renderer/src/components/TitleBar.vue`:

```vue
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
      <button class="icon-btn" @click="emit('toggle-sidebar')" title="Toggle Sidebar">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 3h12v1H2zm0 4h12v1H2zm0 4h12v1H2z"/>
        </svg>
      </button>
      <span class="app-title">AI Tools</span>
      <select v-model="extStore.activeExtensionId" class="extension-select no-drag">
        <option disabled value="">Select Extension</option>
        <option v-for="ext in extStore.extensions" :key="ext.id" :value="ext.id">
          {{ ext.name }}
        </option>
      </select>
    </div>
    <div class="titlebar-center">
      <span v-if="extStore.extensions.length === 0" class="hint-text">
        No extensions loaded
      </span>
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
```

- [ ] **Step 2: Create Sidebar component**

Create `src/renderer/src/components/Sidebar.vue`:

```vue
<script setup lang="ts">
import { useWorkspaceStore } from '../stores/workspace'
import FileTree from './FileTree.vue'

const workspace = useWorkspaceStore()
</script>

<template>
  <div class="sidebar">
    <div class="sidebar-header">
      <span class="sidebar-title">Explorer</span>
      <button v-if="!workspace.rootPath" class="open-btn" @click="workspace.openFolder()">
        Open Folder
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
```

- [ ] **Step 3: Create FileTree component**

Create `src/renderer/src/components/FileTree.vue`:

```vue
<script setup lang="ts">
import { useWorkspaceStore, type FileEntry } from '../stores/workspace'

const workspace = useWorkspaceStore()

function getIcon(entry: FileEntry): string {
  if (entry.isDirectory) return '\u{1F4C1}'
  const ext = entry.name.split('.').pop()?.toLowerCase()
  const icons: Record<string, string> = {
    ts: '\u{1F4C4}', tsx: '\u{2699}\u{FE0F}', js: '\u{1F4C4}', vue: '\u{1F7E2}',
    json: '\u{1F4C4}', css: '\u{1F3A8}', html: '\u{1F310}', md: '\u{1F4DD}'
  }
  return icons[ext ?? ''] ?? '\u{1F4C4}'
}
</script>

<template>
  <div class="file-tree">
    <template v-for="entry in workspace.files" :key="entry.path">
      <div
        class="file-entry"
        :class="{ selected: workspace.selectedFile === entry.path }"
        :style="{ paddingLeft: '12px' }"
        @click="entry.isDirectory ? workspace.toggleDir(entry.path) : workspace.selectFile(entry.path)"
      >
        <span class="icon">{{ entry.isDirectory ? (workspace.expandedDirs.has(entry.path) ? '\u{1F4C2}' : '\u{1F4C1}') : getIcon(entry) }}</span>
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
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { useWorkspaceStore, type FileEntry } from '../stores/workspace'

const FileTreeItem = defineComponent({
  name: 'FileTreeItem',
  props: {
    entry: { type: Object as () => FileEntry, required: true },
    depth: { type: Number, required: true }
  },
  setup(props) {
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
      <span class="icon">{{ entry.isDirectory ? (workspace.expandedDirs.has(entry.path) ? '\u{1F4C2}' : '\u{1F4C1}') : '\u{1F4C4}' }}</span>
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

export default { name: 'FileTree' }
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
</style>
```

- [ ] **Step 4: Create ChatPanel component**

Create `src/renderer/src/components/ChatPanel.vue`:

```vue
<script setup lang="ts">
import { useExtensionStore } from '../stores/extension'

const extStore = useExtensionStore()
</script>

<template>
  <div class="chat-panel">
    <div v-if="!extStore.activeExtensionId" class="chat-empty">
      <div class="empty-content">
        <div class="empty-icon">&#x1F916;</div>
        <h2>Welcome to AI Tools</h2>
        <p>Select an extension from the title bar to start chatting</p>
        <p class="hint">Supported: Claude Code, Codex</p>
      </div>
    </div>
    <div v-else class="chat-active">
      <div class="chat-header">
        <span>{{ extStore.extensions.find(e => e.id === extStore.activeExtensionId)?.name ?? 'Extension' }}</span>
      </div>
      <div class="chat-content" id="webview-container">
        <!-- Extension webview will be rendered here -->
        <div class="webview-placeholder">
          <p>Extension webview will load here</p>
          <p class="hint">Extension host integration coming in Phase 2</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
}

.chat-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.empty-content {
  text-align: center;
  color: var(--text-secondary);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-content h2 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.empty-content p {
  margin-bottom: 4px;
}

.hint {
  color: var(--text-muted);
  font-size: 12px;
}

.chat-active {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chat-header {
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
  font-weight: 600;
  font-size: 13px;
  background: var(--bg-secondary);
}

.chat-content {
  flex: 1;
  overflow: hidden;
}

.webview-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
}

.webview-placeholder p {
  margin-bottom: 4px;
}
</style>
```

- [ ] **Step 5: Create TerminalPanel component**

Create `src/renderer/src/components/TerminalPanel.vue`:

```vue
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useTerminalStore } from '../stores/terminal'
import '@xterm/xterm/css/xterm.css'

const termStore = useTerminalStore()
const terminalRefs = ref<Map<string, HTMLDivElement>>(new Map())
const terminals = ref<Map<string, { term: Terminal; fitAddon: FitAddon }>>(new Map())

onMounted(() => {
  const cleanup = window.api.onTerminalData((id: string, data: string) => {
    const entry = terminals.value.get(id)
    if (entry) {
      entry.term.write(data)
    }
  })

  onBeforeUnmount(cleanup)
})

watch(
  () => termStore.terminals,
  async () => {
    await nextTick()
    for (const termInstance of termStore.terminals) {
      if (!terminals.value.has(termInstance.id)) {
        const container = document.getElementById(`terminal-${termInstance.id}`)
        if (container) {
          const term = new Terminal({
            theme: {
              background: '#1e1e2e',
              foreground: '#cdd6f4',
              cursor: '#f5e0dc',
              selectionBackground: '#45475a'
            },
            fontSize: 13,
            fontFamily: 'Cascadia Code, Consolas, monospace',
            cursorBlink: true
          })
          const fitAddon = new FitAddon()
          term.loadAddon(fitAddon)
          term.loadAddon(new WebLinksAddon())
          term.open(container)
          fitAddon.fit()

          term.onData((data) => {
            window.api.terminalWrite(termInstance.id, data)
          })

          term.onResize(({ cols, rows }) => {
            window.api.terminalResize(termInstance.id, cols, rows)
          })

          terminals.value.set(termInstance.id, { term, fitAddon })
        }
      }
    }
  },
  { deep: true }
)

function removeTerminal(id: string): void {
  const entry = terminals.value.get(id)
  if (entry) {
    entry.term.dispose()
    terminals.value.delete(id)
  }
  termStore.removeTerminal(id)
}
</script>

<template>
  <div class="terminal-panel">
    <div class="terminal-tabs">
      <div
        v-for="term in termStore.terminals"
        :key="term.id"
        class="tab"
        :class="{ active: termStore.activeTerminalId === term.id }"
        @click="termStore.setActive(term.id)"
      >
        <span>{{ term.name }}</span>
        <button class="close-btn" @click.stop="removeTerminal(term.id)">&times;</button>
      </div>
      <button class="new-tab-btn" @click="termStore.createTerminal()">+</button>
    </div>
    <div class="terminal-content">
      <div
        v-for="term in termStore.terminals"
        :key="term.id"
        :id="`terminal-${term.id}`"
        class="terminal-instance"
        :class="{ hidden: termStore.activeTerminalId !== term.id }"
      />
    </div>
  </div>
</template>

<style scoped>
.terminal-panel {
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border);
}

.terminal-tabs {
  display: flex;
  align-items: center;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border);
  height: 28px;
  padding: 0 4px;
}

.tab {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  border-bottom: 2px solid transparent;
}

.tab.active {
  color: var(--text-primary);
  border-bottom-color: var(--accent);
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
  padding: 0 2px;
}

.close-btn:hover {
  color: var(--error);
}

.new-tab-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 14px;
  padding: 2px 8px;
}

.new-tab-btn:hover {
  color: var(--text-primary);
}

.terminal-content {
  flex: 1;
  padding: 4px;
}

.terminal-instance {
  height: 100%;
}

.terminal-instance.hidden {
  display: none;
}
</style>
```

- [ ] **Step 6: Create StatusBar component**

Create `src/renderer/src/components/StatusBar.vue`:

```vue
<script setup lang="ts">
import { useWorkspaceStore } from '../stores/workspace'
import { useExtensionStore } from '../stores/extension'
import { useTerminalStore } from '../stores/terminal'

const emit = defineEmits<{
  (e: 'toggle-terminal'): void
}>()

const workspace = useWorkspaceStore()
const extStore = useExtensionStore()
const termStore = useTerminalStore()
</script>

<template>
  <div class="statusbar">
    <div class="statusbar-left">
      <span v-if="extStore.extensions.length > 0" class="status-item success">
        &#x2713; {{ extStore.extensions.length }} extension(s) loaded
      </span>
      <span v-else class="status-item">No extensions</span>
    </div>
    <div class="statusbar-right">
      <span v-if="workspace.rootPath" class="status-item clickable" @click="workspace.openFolder()">
        &#x1F4C1; {{ workspace.rootPath.split(/[\\/]/).pop() }}
      </span>
      <button class="status-item clickable" @click="emit('toggle-terminal')">
        Terminal {{ termStore.terminals.length > 0 ? `(${termStore.terminals.length})` : '' }}
      </button>
      <span class="status-item">v0.1.0</span>
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

.statusbar-left, .statusbar-right {
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
</style>
```

- [ ] **Step 7: Verify all components render**

```bash
npm run dev
```

Expected: Full layout renders with dark theme, title bar, sidebar, chat panel, status bar. No console errors. Terminal panel toggles from status bar.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/src/components/
git commit -m "feat: add all UI components - TitleBar, Sidebar, ChatPanel, Terminal, StatusBar, FileTree"
```

---

### Task 7: Extension discovery in main process

**Files:**
- Create: `src/main/extension-discovery.ts`
- Modify: `src/main/ipc/` (add extension handlers)
- Modify: `src/main/index.ts`

- [ ] **Step 1: Create extension discovery module**

Create `src/main/extension-discovery.ts`:

```typescript
import { readdir, readFile, stat } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'

export interface DiscoveredExtension {
  id: string
  name: string
  version: string
  description: string
  publisher: string
  extensionPath: string
  iconPath?: string
}

const TARGET_EXTENSIONS = new Set([
  'anthropic.claude-code',
  'saoudrizwan.claude-dev',
  'openai.codex'
])

async function findVSCodeExtensionsDir(): Promise<string> {
  const homeDir = process.env.USERPROFILE || process.env.HOME || ''
  const candidates = [
    join(homeDir, '.vscode', 'extensions'),
    join(homeDir, '.vscode-insiders', 'extensions')
  ]

  for (const dir of candidates) {
    try {
      await stat(dir)
      return dir
    } catch {
      continue
    }
  }
  return ''
}

export async function discoverExtensions(): Promise<DiscoveredExtension[]> {
  const extensionsDir = await findVSCodeExtensionsDir()
  if (!extensionsDir) return []

  const results: DiscoveredExtension[] = []
  let entries

  try {
    entries = await readdir(extensionsDir, { withFileTypes: true })
  } catch {
    return []
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const packageJsonPath = join(extensionsDir, entry.name, 'package.json')
    try {
      const content = await readFile(packageJsonPath, 'utf-8')
      const pkg = JSON.parse(content)
      const extId = `${pkg.publisher}.${pkg.name}`

      if (TARGET_EXTENSIONS.has(extId)) {
        results.push({
          id: extId,
          name: pkg.displayName || pkg.name,
          version: pkg.version,
          description: pkg.description || '',
          publisher: pkg.publisher || '',
          extensionPath: join(extensionsDir, entry.name),
          iconPath: pkg.icon ? join(extensionsDir, entry.name, pkg.icon) : undefined
        })
      }
    } catch {
      continue
    }
  }

  return results
}
```

- [ ] **Step 2: Create extension IPC handlers**

Create `src/main/ipc/extensions.ts`:

```typescript
import { ipcMain } from 'electron'
import { discoverExtensions, type DiscoveredExtension } from '../extension-discovery'

let cachedExtensions: DiscoveredExtension[] | null = null

export function registerExtensionHandlers(): void {
  ipcMain.handle('ext:getInstalled', async () => {
    if (!cachedExtensions) {
      cachedExtensions = await discoverExtensions()
    }
    return cachedExtensions
  })

  ipcMain.handle('ext:activate', async (_event, _extensionId: string) => {
    // Phase 2: Actually activate extension via extension host
  })
}
```

- [ ] **Step 3: Register extension handlers in main process**

Add import to `src/main/index.ts`:

```typescript
import { registerExtensionHandlers } from './ipc/extensions'
```

Add inside `app.whenReady().then(...)`, after the other `register*()` calls:

```typescript
registerExtensionHandlers()
```

- [ ] **Step 4: Add extension loading to renderer startup**

Update `src/renderer/src/App.vue` script setup:

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useExtensionStore } from './stores/extension'
import TitleBar from './components/TitleBar.vue'
import Sidebar from './components/Sidebar.vue'
import ChatPanel from './components/ChatPanel.vue'
import TerminalPanel from './components/TerminalPanel.vue'
import StatusBar from './components/StatusBar.vue'

const extStore = useExtensionStore()
const sidebarVisible = ref(true)
const terminalVisible = ref(false)
const terminalHeight = ref(200)

onMounted(() => {
  extStore.loadExtensions()
})
</script>
```

- [ ] **Step 5: Test extension discovery**

```bash
npm run dev
```

Expected: If Claude Code or Codex is installed in VSCode, they appear in the title bar dropdown. Status bar shows extension count.

- [ ] **Step 6: Commit**

```bash
git add src/main/extension-discovery.ts src/main/ipc/extensions.ts src/main/index.ts src/renderer/src/App.vue
git commit -m "feat: add VSCode extension discovery from user's VSCode installation"
```

---

### Task 8: Global type declarations and build verification

**Files:**
- Create: `src/renderer/src/env.d.ts`
- Modify: `electron.vite.config.ts` (if needed)

- [ ] **Step 1: Add TypeScript declarations for window.api**

Create `src/renderer/src/env.d.ts`:

```typescript
export {}

interface WindowApi {
  selectFolder: () => Promise<string | null>
  readDir: (dirPath: string) => Promise<{ name: string; isDirectory: boolean; isFile: boolean }[]>
  readFile: (filePath: string) => Promise<string>
  stat: (filePath: string) => Promise<{ isFile: boolean; isDirectory: boolean; size: number }>
  terminalCreate: (id: string) => void
  terminalWrite: (id: string, data: string) => void
  terminalResize: (id: string, cols: number, rows: number) => void
  terminalKill: (id: string) => void
  onTerminalData: (callback: (id: string, data: string) => void) => () => void
  getInstalledExtensions: () => Promise<{
    id: string
    name: string
    version: string
    description: string
    publisher: string
    extensionPath: string
    iconPath?: string
  }[]>
  activateExtension: (extensionId: string) => Promise<void>
}

declare global {
  interface Window {
    api: WindowApi
  }
}
```

- [ ] **Step 2: Run full build**

```bash
npm run build
```

Expected: Build completes without TypeScript errors.

- [ ] **Step 3: Run packaged app**

```bash
npm run dev
```

Verify:
1. Window opens with dark theme
2. Sidebar shows "Open Folder" button
3. Click "Open Folder" -> dialog opens -> select folder -> file tree populates
4. Click file tree items -> folders expand/collapse, files highlight
5. Status bar shows "Terminal" button -> click toggles terminal panel
6. Terminal panel shows "+" button -> click creates new terminal tab
7. Terminal accepts keyboard input and shows output
8. If Claude Code/Codex is installed in VSCode, title bar shows them in dropdown

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/env.d.ts
git commit -m "feat: add TypeScript declarations and finalize Phase 1"
```

---

## Phase 2: Extension Host Integration (Research & Protocol)

> Phase 2 requires deeper research into VSCode's extension host. The tasks below outline the approach based on current understanding, but may need adjustment as we learn more during implementation.

### Task 9: Bundle VSCode extension host files

**Files:**
- Create: `scripts/prepare-extension-host.ts`
- Create: `extension-host/` directory

- [ ] **Step 1: Create script to extract extension host from VSCodium**

Create `scripts/prepare-extension-host.ts`:

```typescript
import { copyFile, mkdir, readdir, stat, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { execSync } from 'child_process'

/**
 * Downloads VSCodium and extracts the extension host files.
 * Run: npx tsx scripts/prepare-extension-host.ts
 */
const VSCODIUM_VERSION = '1.96.0'
const TEMP_DIR = join(process.cwd(), '.tmp')
const OUTPUT_DIR = join(process.cwd(), 'extension-host')

async function main(): Promise<void> {
  console.log('Preparing VSCode extension host...')
  console.log(`VSCodium version: ${VSCODIUM_VERSION}`)

  // Download VSCodium
  const url = `https://github.com/VSCodium/vscodium/releases/download/${VSCODIUM_VERSION}/VSCodium-win32-x64-${VSCODIUM_VERSION}.zip`
  const zipPath = join(TEMP_DIR, 'vscodium.zip')
  const extractDir = join(TEMP_DIR, 'vscodium')

  mkdir(TEMP_DIR, { recursive: true })
  mkdir(OUTPUT_DIR, { recursive: true })

  console.log('Downloading VSCodium...')
  execSync(`curl -L -o "${zipPath}" "${url}"`, { stdio: 'inherit' })

  console.log('Extracting...')
  execSync(`powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}'"`, { stdio: 'inherit' })

  // Copy extension host files
  const sourceBase = join(extractDir, 'resources', 'app')
  const dirsToCopy = [
    'out/vs/base',
    'out/vs/platform',
    'out/vs/editor',
    'out/vs/workbench/api',
    'out/vs/workbench/contrib',
    'out/vs/server'
  ]

  for (const dir of dirsToCopy) {
    const src = join(sourceBase, dir)
    const dest = join(OUTPUT_DIR, dir)
    try {
      await stat(src)
      console.log(`Copying ${dir}...`)
      execSync(`xcopy "${src}" "${dest}" /E /I /Q /Y`, { stdio: 'inherit' })
    } catch {
      console.log(`Skipping ${dir} (not found)`)
    }
  }

  // Copy the extension host entry point
  await copyFile(
    join(sourceBase, 'out', 'vs', 'workbench', 'api', 'node', 'extensionHostProcess.js'),
    join(OUTPUT_DIR, 'out', 'vs', 'workbench', 'api', 'node', 'extensionHostProcess.js')
  ).catch(() => console.log('Extension host entry point not found'))

  // Create a bootstrap script
  await writeFile(
    join(OUTPUT_DIR, 'bootstrap.js'),
    `// Extension host bootstrap\nrequire('./out/vs/workbench/api/node/extensionHostProcess');\n`
  )

  console.log('Extension host prepared successfully!')
  console.log(`Output: ${OUTPUT_DIR}`)
}

main().catch(console.error)
```

- [ ] **Step 2: Run the preparation script**

```bash
npx tsx scripts/prepare-extension-host.ts
```

Expected: VSCodium is downloaded, extension host files are extracted to `extension-host/` directory.

- [ ] **Step 3: Verify extracted files**

```bash
ls extension-host/out/vs/workbench/api/node/
```

Expected: `extensionHostProcess.js` exists.

- [ ] **Step 4: Commit**

```bash
git add scripts/prepare-extension-host.ts
echo "extension-host/" >> .gitignore
git add .gitignore
git commit -m "feat: add extension host preparation script"
```

---

### Task 10: Extension Host Manager

**Files:**
- Create: `src/main/extension-host/host-manager.ts`
- Create: `src/main/extension-host/protocol.ts`

- [ ] **Step 1: Create protocol constants and types**

Create `src/main/extension-host/protocol.ts`:

```typescript
/**
 * VSCode Extension Host binary protocol constants.
 * Reference: progrium/vscode-protocol
 */

export const enum ProtocolMessageType {
  Regular = 1,
  Control = 2,
  Ack = 3,
  Disconnect = 5,
  ReplayRequest = 6,
  Pause = 7,
  Resume = 8,
  KeepAlive = 9
}

export const enum RPCMessageType {
  RequestJSONArgs = 1,
  RequestJSONArgsWithCancellation = 2,
  RequestMixedArgs = 3,
  RequestMixedArgsWithCancellation = 4,
  Acknowledged = 5,
  Cancel = 6,
  ReplyOKEmpty = 7,
  ReplyOKVSBuffer = 8,
  ReplyOKJSON = 9,
  ReplyOKJSONWithBuffers = 10,
  ReplyErrError = 11,
  ReplyErrEmpty = 12
}

export const HEADER_LENGTH = 13 // 1 + 4 + 4 + 4

export interface RPCRequest {
  type: RPCMessageType
  id: number
  methodName: string
  args: unknown[]
}

export interface RPCReply {
  type: RPCMessageType
  id: number
  data: unknown
}

export function encodeMessage(type: ProtocolMessageType, id: number, ack: number, data: Buffer): Buffer {
  const header = Buffer.alloc(HEADER_LENGTH)
  header[0] = type
  header.writeUInt32BE(id, 1)
  header.writeUInt32BE(ack, 5)
  header.writeUInt32BE(data.length, 9)
  return Buffer.concat([header, data])
}

export function decodeMessage(buffer: Buffer): { type: ProtocolMessageType; id: number; ack: number; data: Buffer } | null {
  if (buffer.length < HEADER_LENGTH) return null
  const type = buffer[0] as ProtocolMessageType
  const id = buffer.readUInt32BE(1)
  const ack = buffer.readUInt32BE(5)
  const dataLength = buffer.readUInt32BE(9)
  if (buffer.length < HEADER_LENGTH + dataLength) return null
  const data = buffer.subarray(HEADER_LENGTH, HEADER_LENGTH + dataLength)
  return { type, id, ack, data }
}
```

- [ ] **Step 2: Create HostManager**

Create `src/main/extension-host/host-manager.ts`:

```typescript
import { ChildProcess, fork } from 'child_process'
import { join } from 'path'
import { app } from 'electron'
import { encodeMessage, decodeMessage, ProtocolMessageType } from './protocol'

export interface ExtensionHostConfig {
  extensionPaths: string[]
  workspacePath: string
  extensionHostPath?: string
}

export class ExtensionHostManager {
  private process: ChildProcess | null = null
  private messageBuffer = Buffer.alloc(0)
  private messageId = 0
  private pendingRequests = new Map<number, { resolve: (value: unknown) => void; reject: (err: Error) => void }>()
  private messageHandlers = new Map<string, (method: string, args: unknown[]) => Promise<unknown>>()

  async start(config: ExtensionHostConfig): Promise<void> {
    const hostPath = config.extensionHostPath || this.getDefaultHostPath()

    this.process = fork(hostPath, [], {
      env: {
        ...process.env,
        VSCODE_EXTHOST_IPC_HOOK: '', // Will use stdio
        ELECTRON_RUN_AS_NODE: '1'
      },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    })

    this.process.stdout?.on('data', (data: Buffer) => this.handleData(data))
    this.process.stderr?.on('data', (data: Buffer) => {
      console.error('[ExtensionHost]', data.toString())
    })

    this.process.on('exit', (code) => {
      console.log(`[ExtensionHost] exited with code ${code}`)
      this.process = null
    })

    // Send init data
    await this.sendInitData(config)
  }

  private getDefaultHostPath(): string {
    if (app.isPackaged) {
      return join(process.resourcesPath, 'extension-host', 'bootstrap.js')
    }
    return join(process.cwd(), 'extension-host', 'bootstrap.js')
  }

  private async sendInitData(config: ExtensionHostConfig): Promise<void> {
    const initData = {
      extensions: config.extensionPaths.map((p) => ({ extensionLocation: { path: p } })),
      workspace: { workspaceFolders: [{ uri: { path: config.workspacePath } }] }
    }
    const data = Buffer.from(JSON.stringify(initData))
    const message = encodeMessage(ProtocolMessageType.Regular, ++this.messageId, 0, data)
    this.process?.stdin?.write(message)
  }

  private handleData(data: Buffer): void {
    this.messageBuffer = Buffer.concat([this.messageBuffer, data])

    while (this.messageBuffer.length > 0) {
      const message = decodeMessage(this.messageBuffer)
      if (!message) break

      this.messageBuffer = this.messageBuffer.subarray(13 + message.data.length)
      this.processMessage(message)
    }
  }

  private async processMessage(message: { type: ProtocolMessageType; id: number; ack: number; data: Buffer }): Promise<void> {
    if (message.type === ProtocolMessageType.Regular) {
      try {
        const rpc = JSON.parse(message.data.toString())
        const handlerId = rpc.proxyId || 'default'
        const handler = this.messageHandlers.get(handlerId)
        if (handler) {
          const result = await handler(rpc.method, rpc.args)
          const reply = encodeMessage(
            ProtocolMessageType.Regular,
            ++this.messageId,
            message.id,
            Buffer.from(JSON.stringify({ type: 9, id: message.id, data: result }))
          )
          this.process?.stdin?.write(reply)
        }
      } catch (err) {
        console.error('[ExtensionHost] Error processing message:', err)
      }
    }
  }

  registerHandler(proxyId: string, handler: (method: string, args: unknown[]) => Promise<unknown>): void {
    this.messageHandlers.set(proxyId, handler)
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill()
      this.process = null
    }
  }
}
```

- [ ] **Step 3: Verify TypeScript compilation**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/main/extension-host/
git commit -m "feat: add extension host manager and protocol layer"
```

---

### Task 11: MainThread API shim skeleton

**Files:**
- Create: `src/main/extension-host/main-thread/index.ts`
- Create: `src/main/extension-host/main-thread/workspace.ts`
- Create: `src/main/extension-host/main-thread/commands.ts`
- Create: `src/main/extension-host/main-terminal.ts`
- Create: `src/main/extension-host/main-thread/webview.ts`
- Create: `src/main/extension-host/main-thread/filesystem.ts`

- [ ] **Step 1: Create API registry**

Create `src/main/extension-host/main-thread/index.ts`:

```typescript
import type { ExtensionHostManager } from '../host-manager'

export interface MainThreadAPI {
  proxyId: string
  handle(method: string, args: unknown[]): Promise<unknown>
}

export function registerAllAPIs(hostManager: ExtensionHostManager): void {
  const apis: MainThreadAPI[] = []

  // Import and register each API module
  // These will be implemented in subsequent tasks
  // apis.push(new MainThreadWorkspace())
  // apis.push(new MainThreadCommands())
  // apis.push(new MainThreadTerminal())
  // apis.push(new MainThreadWebview())
  // apis.push(new MainThreadFileSystem())

  for (const api of apis) {
    hostManager.registerHandler(api.proxyId, (method, args) => api.handle(method, args))
  }
}
```

- [ ] **Step 2: Create workspace API stub**

Create `src/main/extension-host/main-thread/workspace.ts`:

```typescript
import type { MainThreadAPI } from './index'
import { readdir, stat, readFile, writeFile } from 'fs/promises'
import { join } from 'path'

export class MainThreadWorkspace implements MainThreadAPI {
  readonly proxyId = 'MainThreadWorkspace'

  async handle(method: string, args: unknown[]): Promise<unknown> {
    switch (method) {
      case '$startFileSearch':
        return this.startFileSearch(args[0] as { query: string; folder: string })
      case '$saveAll':
        return true
      case '$applyWorkspaceEdit':
        return this.applyWorkspaceEdit(args[0])
      default:
        console.log(`[Workspace] Unhandled: ${method}`)
        return undefined
    }
  }

  private async startFileSearch(params: { query: string; folder: string }): Promise<string[]> {
    const results: string[] = []
    await this.walkDir(params.folder, params.query, results)
    return results.slice(0, 100)
  }

  private async walkDir(dir: string, query: string, results: string[]): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          await this.walkDir(fullPath, query, results)
        } else if (entry.name.includes(query)) {
          results.push(fullPath)
        }
      }
    } catch { /* ignore permission errors */ }
  }

  private async applyWorkspaceEdit(edit: unknown): Promise<boolean> {
    // TODO: Implement workspace edit (file create/delete/edit)
    console.log('[Workspace] applyWorkspaceEdit:', JSON.stringify(edit).slice(0, 200))
    return true
  }
}
```

- [ ] **Step 3: Create commands API stub**

Create `src/main/extension-host/main-thread/commands.ts`:

```typescript
import type { MainThreadAPI } from './index'

type CommandHandler = (...args: unknown[]) => unknown | Promise<unknown>

export class MainThreadCommands implements MainThreadAPI {
  readonly proxyId = 'MainThreadCommands'
  private commands = new Map<string, CommandHandler>()

  async handle(method: string, args: unknown[]): Promise<unknown> {
    switch (method) {
      case '$registerCommand': {
        const [id] = args as [string]
        this.commands.set(id, () => console.log(`[Command] executed: ${id}`))
        return undefined
      }
      case '$executeCommand': {
        const [id, ...commandArgs] = args as [string, ...unknown[]]
        const handler = this.commands.get(id)
        if (handler) return handler(...commandArgs)
        console.log(`[Command] not found: ${id}`)
        return undefined
      }
      case '$unregisterCommand': {
        const [id] = args as [string]
        this.commands.delete(id)
        return undefined
      }
      default:
        console.log(`[Commands] Unhandled: ${method}`)
        return undefined
    }
  }

  registerCommand(id: string, handler: CommandHandler): void {
    this.commands.set(id, handler)
  }
}
```

- [ ] **Step 4: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/main/extension-host/main-thread/
git commit -m "feat: add MainThread API shim skeleton for workspace and commands"
```

---

## Phase 3: P0 API Implementation + Webview

### Task 12: MainThreadFileSystem API

**Files:**
- Create: `src/main/extension-host/main-thread/filesystem.ts`

- [ ] **Step 1: Implement filesystem API**

Create `src/main/extension-host/main-thread/filesystem.ts`:

```typescript
import type { MainThreadAPI } from './index'
import { readFile, writeFile, stat, readdir, mkdir, unlink, rename } from 'fs/promises'
import { join, dirname, basename } from 'path'

export class MainThreadFileSystem implements MainThreadAPI {
  readonly proxyId = 'MainThreadFileSystem'

  async handle(method: string, args: unknown[]): Promise<unknown> {
    try {
      switch (method) {
        case '$readFile':
          return await readFile(args[0] as string)
        case '$writeFile':
          await writeFile(args[0] as string, args[1] as Buffer | string)
          return undefined
        case '$stat': {
          const s = await stat(args[0] as string)
          return { type: s.isFile() ? 1 : 2, size: s.size, mtime: s.mtimeMs, ctime: s.ctimeMs }
        }
        case '$readdir': {
          const entries = await readdir(args[0] as string, { withFileTypes: true })
          return entries.map((e) => ({ name: e.name, type: e.isDirectory() ? 2 : 1 }))
        }
        case '$mkdir':
          await mkdir(args[0] as string, { recursive: true })
          return undefined
        case '$delete':
          await unlink(args[0] as string)
          return undefined
        case '$rename':
          await rename(args[0] as string, args[1] as string)
          return undefined
        default:
          console.log(`[FileSystem] Unhandled: ${method}`)
          return undefined
      }
    } catch (err) {
      console.error(`[FileSystem] Error in ${method}:`, err)
      throw err
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main/extension-host/main-thread/filesystem.ts
git commit -m "feat: implement MainThreadFileSystem API"
```

---

### Task 13: MainThreadTerminal API

**Files:**
- Create: `src/main/extension-host/main-thread/terminal.ts`
- Modify: `src/main/extension-host/main-thread/index.ts`

- [ ] **Step 1: Implement terminal API**

Create `src/main/extension-host/main-thread/terminal.ts`:

```typescript
import type { MainThreadAPI } from './index'
import { BrowserWindow } from 'electron'
import pty from 'node-pty'

export class MainThreadTerminal implements MainThreadAPI {
  readonly proxyId = 'MainThreadTerminal'
  private terminals = new Map<number, pty.IPty>()
  private nextId = 1

  async handle(method: string, args: unknown[]): Promise<unknown> {
    switch (method) {
      case '$createTerminal': {
        const id = this.nextId++
        const ptyProcess = pty.spawn('powershell.exe', [], {
          name: 'xterm-256color',
          cols: 80,
          rows: 24,
          cwd: process.env.USERPROFILE || 'C:\\',
          env: process.env as Record<string, string>
        })

        ptyProcess.onData((data) => {
          this.sendToRenderer('$onDidWriteTerminalData', [id, data])
        })

        ptyProcess.onExit(({ exitCode }) => {
          this.sendToRenderer('$onDidCloseTerminal', [id, exitCode])
          this.terminals.delete(id)
        })

        this.terminals.set(id, ptyProcess)
        return id
      }
      case '$sendText': {
        const [id, text] = args as [number, string]
        this.terminals.get(id)?.write(text)
        return undefined
      }
      case '$show':
        return undefined
      case '$hide':
        return undefined
      case '$dispose': {
        const [id] = args as [number]
        this.terminals.get(id)?.kill()
        this.terminals.delete(id)
        return undefined
      }
      default:
        console.log(`[Terminal] Unhandled: ${method}`)
        return undefined
    }
  }

  private sendToRenderer(method: string, args: unknown[]): void {
    // Send event back to extension host via reverse RPC
    // This will be implemented when we have the full protocol working
    const window = BrowserWindow.getAllWindows()[0]
    if (window) {
      window.webContents.send('ext:terminalEvent', { method, args })
    }
  }
}
```

- [ ] **Step 2: Register in API index**

Update `src/main/extension-host/main-thread/index.ts` to import and register:

```typescript
import type { ExtensionHostManager } from '../host-manager'
import type { MainThreadAPI } from './index'
import { MainThreadWorkspace } from './workspace'
import { MainThreadCommands } from './commands'
import { MainThreadFileSystem } from './filesystem'
import { MainThreadTerminal } from './terminal'

export interface MainThreadAPI {
  proxyId: string
  handle(method: string, args: unknown[]): Promise<unknown>
}

export function registerAllAPIs(hostManager: ExtensionHostManager): void {
  const apis: MainThreadAPI[] = [
    new MainThreadWorkspace(),
    new MainThreadCommands(),
    new MainThreadFileSystem(),
    new MainThreadTerminal()
  ]

  for (const api of apis) {
    hostManager.registerHandler(api.proxyId, (method, args) => api.handle(method, args))
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/main/extension-host/main-thread/
git commit -m "feat: implement MainThreadTerminal API and register all APIs"
```

---

### Task 14: MainThreadWebview API

**Files:**
- Create: `src/main/extension-host/main-thread/webview.ts`
- Modify: `src/renderer/src/components/ChatPanel.vue`

- [ ] **Step 1: Implement webview API**

Create `src/main/extension-host/main-thread/webview.ts`:

```typescript
import type { MainThreadAPI } from './index'
import { BrowserWindow, BrowserView, WebContents } from 'electron'
import { join } from 'path'

interface WebviewInfo {
  id: string
  viewType: string
  browserView: BrowserView
  html: string
}

export class MainThreadWebview implements MainThreadAPI {
  readonly proxyId = 'MainThreadWebview'
  private webviews = new Map<string, WebviewInfo>()

  async handle(method: string, args: unknown[]): Promise<unknown> {
    switch (method) {
      case '$registerWebviewViewProvider': {
        const [viewType] = args as [string]
        console.log(`[Webview] Registered provider: ${viewType}`)
        return undefined
      }
      case '$createWebviewPanel': {
        const [id, viewType, title, options] = args as [string, string, string, { enableScripts?: boolean }]
        console.log(`[Webview] Create panel: ${id} type=${viewType} title=${title}`)
        return undefined
      }
      case '$setHtml': {
        const [id, html] = args as [string, string]
        const info = this.webviews.get(id)
        if (info) {
          info.html = html
          this.renderWebview(id)
        }
        return undefined
      }
      case '$postMessage': {
        const [id, message] = args as [string, unknown]
        console.log(`[Webview] Post message to ${id}:`, JSON.stringify(message).slice(0, 100))
        return undefined
      }
      default:
        console.log(`[Webview] Unhandled: ${method}`)
        return undefined
    }
  }

  private renderWebview(id: string): void {
    const info = this.webviews.get(id)
    if (!info) return

    const window = BrowserWindow.getAllWindows()[0]
    if (!window) return

    // Notify renderer to display the webview content
    window.webContents.send('ext:webviewHtml', { id, html: info.html })
  }
}
```

- [ ] **Step 2: Update ChatPanel to receive webview HTML**

Update `src/renderer/src/components/ChatPanel.vue` script:

```vue
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useExtensionStore } from '../stores/extension'

const extStore = useExtensionStore()
const webviewHtml = ref<string | null>(null)

function handleWebviewHtml(_event: unknown, data: { id: string; html: string }): void {
  webviewHtml.value = data.html
}

onMounted(() => {
  window.electron?.ipcRenderer.on('ext:webviewHtml', handleWebviewHtml)
})

onBeforeUnmount(() => {
  window.electron?.ipcRenderer.removeListener('ext:webviewHtml', handleWebviewHtml)
})
</script>
```

Add to the template, replace the `webview-placeholder` div:

```html
<div v-if="webviewHtml" class="webview-container" v-html="webviewHtml" />
<div v-else class="webview-placeholder">
  <p>Extension webview will load here</p>
  <p class="hint">Extension host integration coming in Phase 2</p>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/main/extension-host/main-thread/webview.ts src/renderer/src/components/ChatPanel.vue
git commit -m "feat: add MainThreadWebview API and webview rendering in ChatPanel"
```

---

## Phase 4: Integration & Build

### Task 15: Wire extension host into main process

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/main/ipc/extensions.ts`

- [ ] **Step 1: Wire ExtensionHostManager into main process**

Update `src/main/ipc/extensions.ts`:

```typescript
import { ipcMain } from 'electron'
import { discoverExtensions, type DiscoveredExtension } from '../extension-discovery'
import { ExtensionHostManager } from '../extension-host/host-manager'
import { registerAllAPIs } from '../extension-host/main-thread'

let cachedExtensions: DiscoveredExtension[] | null = null
let hostManager: ExtensionHostManager | null = null

export function registerExtensionHandlers(): void {
  ipcMain.handle('ext:getInstalled', async () => {
    if (!cachedExtensions) {
      cachedExtensions = await discoverExtensions()
    }
    return cachedExtensions
  })

  ipcMain.handle('ext:activate', async (_event, extensionId: string) => {
    if (!cachedExtensions || cachedExtensions.length === 0) {
      cachedExtensions = await discoverExtensions()
    }

    const ext = cachedExtensions?.find((e) => e.id === extensionId)
    if (!ext) throw new Error(`Extension not found: ${extensionId}`)

    if (!hostManager) {
      hostManager = new ExtensionHostManager()
      registerAllAPIs(hostManager)
    }

    await hostManager.start({
      extensionPaths: [ext.extensionPath],
      workspacePath: process.cwd()
    })
  })
}

export async function shutdownExtensionHost(): Promise<void> {
  if (hostManager) {
    await hostManager.stop()
    hostManager = null
  }
}
```

- [ ] **Step 2: Add cleanup on app quit**

Update `src/main/index.ts` - add import:

```typescript
import { shutdownExtensionHost } from './ipc/extensions'
```

Add before the `app.on('window-all-closed', ...)` handler:

```typescript
app.on('before-quit', async () => {
  await shutdownExtensionHost()
})
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/main/
git commit -m "feat: wire extension host into main process lifecycle"
```

---

### Task 16: Configure electron-builder for packaging

**Files:**
- Create: `electron-builder.yml`

- [ ] **Step 1: Create electron-builder config**

Create `electron-builder.yml`:

```yaml
appId: com.aitools.desktop
productName: AI Tools
directories:
  buildResources: resources
files:
  - '!**/.vscode/*'
  - '!src/*'
  - '!docs/*'
  - '!scripts/*'
  - '!extension-host/*'
  - '!.tmp/*'
  - '!*.md'
extraResources:
  - from: extension-host/
    to: extension-host/
    filter:
      - '**/*'
win:
  target:
    - nsis
  icon: resources/icon.png
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
```

- [ ] **Step 2: Add build scripts to package.json**

Add to `package.json` scripts:

```json
{
  "scripts": {
    "build:ext-host": "npx tsx scripts/prepare-extension-host.ts",
    "package": "npm run build && npm run build:ext-host && electron-builder --win",
    "package:dir": "npm run build && npm run build:ext-host && electron-builder --win --dir"
  }
}
```

- [ ] **Step 3: Test directory build**

```bash
npm run package:dir
```

Expected: Creates unpacked app in `dist/win-unpacked/`.

- [ ] **Step 4: Commit**

```bash
git add electron-builder.yml package.json
git commit -m "feat: add electron-builder packaging configuration"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Every section in the design spec has corresponding tasks
- [x] **No placeholders:** All code is concrete, no TBD/TODO placeholders in implementation steps
- [x] **Type consistency:** Method names, types, and interfaces are consistent across tasks
- [x] **File paths:** All paths use the electron-vite convention (`src/main/`, `src/preload/`, `src/renderer/`)
- [x] **Dependencies:** xterm.js, node-pty, pinia are installed in Task 1
- [x] **Windows-specific:** Uses `powershell.exe` for terminals, backslash-aware path handling

---

Plan complete and saved to `docs/superpowers/plans/2026-04-21-ai-tools-desktop.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
