# Phase 6: 知识管理 - Pattern Map

**Mapped:** 2026-04-26
**Files analyzed:** 14 (8 新增 + 6 修改)
**Analogs found:** 14 / 14

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/main/ipc/dialog.ts` | controller (修改) | request-response | 自身 + `dialog:selectFolder` | exact |
| `src/main/ipc/claude-webview.ts` | controller (修改) | request-response | 自身 + `claude:resume-session` handler | exact |
| `src/main/claude/session-store.ts` | service (修改) | CRUD | 自身 + `getSessionMessages()` | exact |
| `src/main/index.ts` | config (修改) | event-driven | 自身 + `before-input-event` 拦截 | exact |
| `src/preload/index.ts` | middleware (修改) | request-response | 自身 + 现有 IPC 桥接 | exact |
| `src/preload/index.d.ts` | config (修改) | - | 自身 + 现有类型声明 | exact |
| `src/shared/types.ts` | model (修改) | - | 自身 + `SessionInfo` 类型 | exact |
| `src/renderer/src/components/ChatPanel.vue` | component (修改) | event-driven | 自身 + session-history overlay + 标签栏 | exact |
| `src/renderer/src/components/ContextMenu.vue` | component (新增) | event-driven | `ConfirmDialog.vue` overlay 模式 | role-match |
| `src/renderer/src/components/ClipboardPanel.vue` | component (新增) | event-driven | `ChatPanel.vue` session-history overlay | exact |
| `src/renderer/src/stores/clipboard.ts` | store (新增) | CRUD (内存) | `settings.ts` Pinia composition API 模式 | exact |
| `src/renderer/src/stores/snippet.ts` | store (新增) | CRUD + localStorage | `settings.ts` watch + localStorage 持久化 | exact |
| `src/renderer/src/composables/useClipboard.ts` | hook (新增) | event-driven | `useNotification.ts` composable 模式 | role-match |
| `src/renderer/src/assets/main.css` | config (修改) | - | 自身 + Catppuccin CSS 变量体系 | exact |

## Pattern Assignments

### `src/main/ipc/dialog.ts` (controller, request-response) [修改]

**Analog:** 自身 — 在现有文件中新增 `dialog:showSaveDialog` handler

**现有 IPC handler 注册模式** (行 1-13):
```typescript
import { dialog, BrowserWindow, ipcMain } from 'electron'

export function registerDialogHandlers(): void {
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

**新增 handler 应遵循的模式:**
- 在 `registerDialogHandlers()` 函数内追加 `ipcMain.handle('dialog:showSaveDialog', ...)`
- 复用 `BrowserWindow.getFocusedWindow()` 获取窗口引用
- 使用 `dialog.showSaveDialog()` 替代 `dialog.showOpenDialog()`
- 返回 `{ canceled: boolean, filePath: string }` 结构

---

### `src/main/ipc/claude-webview.ts` (controller, request-response) [修改]

**Analog:** 自身 — `claude:resume-session` handler (行 616-637)

**IPC handler 模式** (行 616-637):
```typescript
ipcMain.handle('claude:resume-session', async (_event, channelId: string, sessionId: string) => {
  safeLog('[ClaudeIPC] 正在恢复会话:', sessionId, '频道:', channelId)
  // ... 处理逻辑 ...
  return { success: true, channelId: effectiveChannelId }
})
```

**新增 `claude:export-session` handler 应遵循的模式:**
- 在 `registerClaudeWebviewHandlers()` 函数内追加 `ipcMain.handle('claude:export-session', ...)`
- 复用 `getSessionMessages(sessionId, currentCwd)` 读取消息
- 在主进程完成 Markdown 格式化 + `writeFile`
- 返回 `{ success: boolean, error?: string }` 结构
- 使用 `safeLog` / `safeError` 记录日志

---

### `src/main/claude/session-store.ts` (service, CRUD) [修改]

**Analog:** 自身 — `getSessionMessages()` (行 127-155)

**现有数据读取模式** (行 127-155):
```typescript
export async function getSessionMessages(sessionId: string, cwd: string): Promise<unknown[]> {
  const sessionDir = getProjectSessionDir(cwd)
  if (!sessionDir) return []

  const filePath = join(sessionDir, `${sessionId}.jsonl`)
  if (!existsSync(filePath)) return []

  const messages: unknown[] = []
  try {
    const content = await readFile(filePath, 'utf8')
    for (const line of content.split('\n')) {
      if (!line.trim()) continue
      try {
        const obj = JSON.parse(line)
        if (obj.isSidechain || obj.isMeta) continue
        if (obj.type === 'user' || obj.type === 'assistant' || obj.type === 'system') {
          messages.push(obj)
        }
      } catch {
        /* skip malformed */
      }
    }
  } catch {
    safeError('[SessionStore] 读取会话文件失败:', filePath)
  }

  safeLog('[SessionStore] 已加载会话:', sessionId, '消息数:', messages.length)
  return messages
}
```

**新增辅助函数应遵循的模式:**
- 新增 `getActiveSessionId(channelId)` 辅助函数，从 `channels` Map 获取 `lastSessionId`
- 复用 `getProjectSessionDir(cwd)` 路径解析逻辑
- 复用 `safeLog` / `safeError` 日志模式
- 导出 `writeFile` from `fs/promises` 用于文件写入

---

### `src/main/index.ts` (config, event-driven) [修改]

**Analog:** 自身 — `before-input-event` 快捷键拦截 (行 87-106)

**现有快捷键拦截模式** (行 87-106):
```typescript
mainWindow.webContents.on('before-input-event', (event, input) => {
  if (!input.control && !input.meta) return
  const shortcuts: Record<string, string> = {
    'n': 'shortcut:new-tab',
    'w': 'shortcut:close-tab',
    'b': 'shortcut:toggle-sidebar',
    ',': 'shortcut:open-settings',
    '0': 'shortcut:reset-zoom'
  }
  if (input.key === 'Tab') {
    event.preventDefault()
    mainWindow.webContents.send(input.shift ? 'shortcut:prev-tab' : 'shortcut:next-tab')
    return
  }
  const channel = shortcuts[input.key.toLowerCase()]
  if (channel) {
    event.preventDefault()
    mainWindow.webContents.send(channel)
  }
})
```

**新增 Ctrl+Shift+V 拦截应遵循的模式:**
- 在 `before-input-event` 回调中添加 Ctrl+Shift+V 检测
- `input.control && input.shift && input.key.toLowerCase() === 'v'`
- `event.preventDefault()` 阻止默认粘贴行为
- `mainWindow.webContents.send('shortcut:clipboard-panel')` 转发到渲染进程

---

### `src/preload/index.ts` (middleware, request-response) [修改]

**Analog:** 自身 — 现有 IPC 桥接 API (行 1-213)

**IPC invoke 暴露模式** (行 44-47 示例):
```typescript
claudeListSessions: (): Promise<SessionInfo[]> => ipcRenderer.invoke('claude:list-sessions'),
claudeDeleteSession: (sessionId: string): Promise<boolean> =>
  ipcRenderer.invoke('claude:delete-session', sessionId),
```

**IPC on 监听模式** (行 102-114):
```typescript
onShortcut: (callback: (action: string) => void): (() => void) => {
  const channels = [
    'shortcut:new-tab', 'shortcut:close-tab', 'shortcut:toggle-sidebar',
    'shortcut:next-tab', 'shortcut:prev-tab', 'shortcut:open-settings',
    'shortcut:reset-zoom'
  ]
  const unsubscribers = channels.map((ch) => {
    const fn = (): void => callback(ch.replace('shortcut:', ''))
    ipcRenderer.on(ch, fn)
    return () => ipcRenderer.removeListener(ch, fn)
  })
  return () => unsubscribers.forEach((u) => u())
},
```

**新增 API 应遵循的模式:**
- `exportSession: (sessionId: string, title: string) => ipcRenderer.invoke('claude:export-session', sessionId, title)`
- `showSaveDialog: (options) => ipcRenderer.invoke('dialog:showSaveDialog', options)`
- 在 `onShortcut` channels 数组中追加 `'shortcut:clipboard-panel'`

---

### `src/preload/index.d.ts` (config) [修改]

**Analog:** 自身 — `Window.api` 类型声明 (行 1-67)

**类型声明模式** (行 24-26 示例):
```typescript
claudeListSessions: () => Promise<SessionInfo[]>
claudeGetModel: () => Promise<string>
claudeDeleteSession: (sessionId: string) => Promise<boolean>
```

**新增类型声明应遵循的模式:**
- 在 `api` 接口中追加 `exportSession`、`showSaveDialog` 方法签名
- 与 `preload/index.ts` 实际实现保持同步

---

### `src/shared/types.ts` (model) [修改]

**Analog:** 自身 — `SessionInfo` 接口 (行 11-17)

**类型定义模式** (行 11-17):
```typescript
export interface SessionInfo {
  id: string
  lastModified: number
  fileSize: number
  summary: string | undefined
  gitBranch: string | undefined
}
```

**新增类型应遵循的模式:**
- 新增 `ExportSessionResult` 类型: `{ success: boolean; error?: string }`
- 新增 `ClipboardEntry` 和 `Snippet` 类型（如果需要跨进程共享）
- 保持导出风格与现有类型一致

---

### `src/renderer/src/components/ChatPanel.vue` (component, event-driven) [修改]

**Analog:** 自身 — session-history overlay (行 786-827) + 标签栏 (行 722-758)

**Overlay/弹出面板模式** (行 786-827):
```vue
<!-- Session History Panel -->
<Transition name="session-slide">
  <div
    v-if="showSessionHistory"
    class="session-history-overlay"
    @click.self="closeSessionHistory"
  >
    <div class="session-history-panel">
      <div class="session-header">
        <span class="session-title">会话历史</span>
        <button class="session-close" @click="closeSessionHistory">&times;</button>
      </div>
      <!-- 列表内容 -->
    </div>
  </div>
</Transition>
```

**标签栏结构** (行 722-758):
```vue
<div class="tab-bar">
  <div class="tab-list">
    <div
      v-for="tab in tabs"
      :key="tab.id"
      class="tab-item"
      @click="switchTab(tab.id)"
      @mousedown.middle.prevent="closeTab(tab.id)"
    >
      <span class="tab-label">{{ tab.label }}</span>
      <span class="tab-close" @click.stop="closeTab(tab.id)">x</span>
    </div>
  </div>
</div>
```

**新增集成应遵循的模式:**
- 在 `tab-item` 上添加 `@contextmenu.prevent="showTabContextMenu($event, tab)"` 事件
- 在 iframe-container 同级添加 `<ClipboardPanel>` 组件
- 引入 `useClipboardStore` 和 `useSnippetStore`
- 在 `onMounted` / `onBeforeUnmount` 中注册 `shortcut:clipboard-panel` 监听
- 使用 `showStatus()` 显示导出进度反馈

**session-history overlay CSS 模式** (行 1191-1211):
```css
.session-history-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay-backdrop);
  z-index: 20;
  display: flex;
  justify-content: flex-end;
}

.session-history-panel {
  width: 360px;
  max-width: 100%;
  background: var(--bg-secondary);
  border-left: 1px solid var(--bg-tertiary);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
```

---

### `src/renderer/src/components/ContextMenu.vue` (component, event-driven) [新增]

**Analog:** `src/renderer/src/components/ConfirmDialog.vue`

**ConfirmDialog 组件结构模式** (行 1-148):
```vue
<script setup lang="ts">
defineProps<{
  visible: boolean
  title: string
  // ...
}>()

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()
</script>

<template>
  <Transition name="dialog-fade">
    <div v-if="visible" class="dialog-overlay" @click.self="handleCancel">
      <!-- 内容 -->
    </div>
  </Transition>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: var(--dialog-backdrop);
  display: flex;
  /* ... */
  z-index: 1000;
}
/* 所有颜色使用 var(--*) CSS 变量 */
</style>
```

**ContextMenu 应遵循的模式:**
- `<script setup lang="ts">` + `defineProps` + `defineEmits`
- `visible: boolean` 控制显示
- 接收 `x: number, y: number` 定位坐标
- 接收 `items: MenuItem[]` 菜单项数组
- `@click.self` 点击外部关闭
- `position: fixed` + 动态 `left/top` 定位
- 检查窗口边界防止溢出
- 使用 `var(--bg-secondary)`, `var(--border)`, `var(--text-primary)` 等 CSS 变量
- `<Transition name="context-menu">` 淡入淡出动画

---

### `src/renderer/src/components/ClipboardPanel.vue` (component, event-driven) [新增]

**Analog:** `src/renderer/src/components/ChatPanel.vue` — session-history overlay (行 786-827)

**Overlay 面板模式** (ChatPanel.vue 行 786-827):
```vue
<Transition name="session-slide">
  <div
    v-if="showSessionHistory"
    class="session-history-overlay"
    @click.self="closeSessionHistory"
  >
    <div class="session-history-panel">
      <div class="session-header">
        <span class="session-title">会话历史</span>
        <button class="session-close" @click="closeSessionHistory">&times;</button>
      </div>
      <div v-if="sessionLoading" class="session-loading">加载中...</div>
      <div v-else-if="sortedSessions.length === 0" class="session-empty">暂无会话记录</div>
      <div v-else class="session-list">
        <div v-for="s in sortedSessions" :key="s.id" class="session-item" @click="resumeSession(s.id, s.summary)">
          <!-- 内容 -->
        </div>
      </div>
    </div>
  </div>
</Transition>
```

**ClipboardPanel 应遵循的模式:**
- `<script setup lang="ts">` + `defineProps<{ visible: boolean }>` + `defineEmits`
- `<Transition name="panel-fade">` 包裹
- 内部两个 Tab 切换：`历史` / `收藏`
- 历史列表使用 `useClipboardStore`，收藏列表使用 `useSnippetStore`
- 选中后自动关闭 (`emit('select', text)`)
- VS Code 命令面板风格 — `position: fixed` 出现在输入区域附近
- 高 `z-index` (参考 session-history 的 z-index: 20)
- 所有颜色使用 `var(--*)` CSS 变量
- 列表项支持键盘上下选择 + Enter 确认

---

### `src/renderer/src/stores/clipboard.ts` (store, CRUD 内存) [新增]

**Analog:** `src/renderer/src/stores/settings.ts` — Pinia composition API 模式

**Pinia composition API store 模式** (settings.ts 行 85-199):
```typescript
import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  // 从 localStorage 加载已有设置
  const raw = localStorage.getItem(SETTINGS_KEY)
  const initial: SettingsState = raw ? { ...DEFAULTS, ...safeParse(raw) } : { ...DEFAULTS }

  // 响应式状态
  const soundEnabled = ref(initial.soundEnabled)
  // ... 其他 ref

  // 计算属性
  const isSoundEnabled = computed(() => settings.value.soundEnabled)

  // 操作方法
  function update(patch: Partial<SettingsState>): void {
    for (const [key, value] of Object.entries(patch)) {
      if (key in settings.value) {
        ;(settings.value as Record<string, unknown>)[key] = value
      }
    }
  }

  return { settings, isSoundEnabled, update, /* ... */ }
})
```

**clipboard store 应遵循的模式:**
- `defineStore('clipboard', () => { ... })` composition API 风格
- 纯内存存储 — 不使用 localStorage，不使用 watch 持久化
- `ref<ClipboardEntry[]>([])` 初始化空数组
- `MAX_ENTRIES = 50` 常量限制最大条目数
- `addEntry(text)` — 去重 + unshift + 超出上限时 slice
- `removeEntry(id)` / `clearAll()` 方法
- 导出 `{ history, addEntry, removeEntry, clearAll }`

---

### `src/renderer/src/stores/snippet.ts` (store, CRUD + localStorage) [新增]

**Analog:** `src/renderer/src/stores/settings.ts` — watch + localStorage 持久化模式

**localStorage 持久化模式** (settings.ts 行 52-53, 131-138, 205-211):
```typescript
const SETTINGS_KEY = 'aitools-settings'

// 深度监听：settings 变更自动写入 localStorage
watch(
  settings,
  (newVal) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(newVal))
  },
  { deep: true }
)

// 安全解析
function safeParse(raw: string): Partial<SettingsState> {
  try {
    return JSON.parse(raw) as Partial<SettingsState>
  } catch {
    return {}
  }
}
```

**snippet store 应遵循的模式:**
- `defineStore('snippet', () => { ... })` composition API 风格
- `const SNIPPETS_KEY = 'aitools-snippets'`
- 从 `localStorage.getItem(SNIPPETS_KEY)` 初始化
- `watch(snippets, ..., { deep: true })` 自动持久化
- `safeParse()` 安全 JSON 解析
- CRUD 方法: `addSnippet`, `promoteFromClipboard`, `updateSnippet`, `deleteSnippet`
- 生成 ID 模式: `snippet_${Date.now()}_${Math.random().toString(36).slice(2)}`

---

### `src/renderer/src/composables/useClipboard.ts` (hook, event-driven) [新增]

**Analog:** `src/renderer/src/composables/useNotification.ts`

**Composable 模式** (useNotification.ts 行 1-29):
```typescript
/**
 * 通知系统渲染端集成
 */
import { playSound } from './useSound'

export function useNotification(): void {
  // 注册事件监听
  window.api.onNotificationFocusTab?.((channelId: string) => {
    window.dispatchEvent(new CustomEvent('notification:focus-tab', { detail: channelId }))
  })
}
```

**useClipboard composable 应遵循的模式:**
- 导出 `useClipboard()` 函数
- 内部调用 `navigator.clipboard.readText()` 读取剪贴板内容
- 在用户操作回调中触发（不在后台轮询）
- 返回 `{ readAndRecord, pasteText }` 方法
- 结合 `useClipboardStore` 自动记录历史

---

### `src/renderer/src/assets/main.css` (config) [修改]

**Analog:** 自身 — Catppuccin Mocha/Latte CSS 变量体系

**现有 CSS 变量使用方式:**
所有新增 UI 必须使用 `var(--*)` 引用现有 CSS 变量，如:
- `var(--bg-primary)`, `var(--bg-secondary)`, `var(--bg-tertiary)`
- `var(--text-primary)`, `var(--text-secondary)`, `var(--text-muted)`
- `var(--border)`, `var(--accent)`, `var(--accent-hover)`
- `var(--overlay-backdrop)`, `var(--dialog-backdrop)`
- `var(--shadow-color)`

仅当现有变量不足以覆盖弹出面板需求时，才在此文件中新增变量。

---

## Shared Patterns

### IPC Handler 注册 + Preload 桥接
**Source:** `src/main/ipc/dialog.ts` + `src/preload/index.ts`
**Apply to:** 所有新增 IPC handler (`dialog:showSaveDialog`, `claude:export-session`)
```
1. 主进程: ipcMain.handle('namespace:action', async (_event, ...args) => { ... })
2. Preload: namespaceAction: (...args) => ipcRenderer.invoke('namespace:action', ...args)
3. 类型: index.d.ts 追加对应方法签名
4. 渲染进程: window.api.namespaceAction(...args)
```

### 快捷键拦截 + IPC 转发
**Source:** `src/main/index.ts` 行 87-106 + `src/preload/index.ts` 行 102-114
**Apply to:** Ctrl+Shift+V 剪贴板面板快捷键
```
1. 主进程 before-input-event: event.preventDefault() + webContents.send('shortcut:clipboard-panel')
2. Preload onShortcut: channels 数组追加 'shortcut:clipboard-panel'
3. App.vue handleShortcut: case 'clipboard-panel' → 触发面板显示
```

### Pinia Store 持久化 (localStorage)
**Source:** `src/renderer/src/stores/settings.ts` 行 85-138
**Apply to:** `snippet.ts` (localStorage 持久化), `clipboard.ts` (纯内存，不持久化)
```typescript
const STORAGE_KEY = 'aitools-xxx'
const raw = localStorage.getItem(STORAGE_KEY)
const initial = raw ? safeParse(raw) : DEFAULTS

const data = ref(initial)
watch(data, (newVal) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newVal))
}, { deep: true })
```

### Overlay/弹出面板组件
**Source:** `src/renderer/src/components/ChatPanel.vue` 行 786-827
**Apply to:** `ClipboardPanel.vue`, `ContextMenu.vue`
```vue
<Transition name="panel-fade">
  <div v-if="visible" class="overlay" @click.self="close">
    <div class="panel">
      <!-- 面板头部: 标题 + 关闭按钮 -->
      <!-- 面板内容: 列表/Tab/输入框 -->
    </div>
  </div>
</Transition>
```
CSS 规范:
- `position: fixed` 或 `position: absolute`
- `z-index` >= 20 (高于 iframe)
- 背景使用 `var(--overlay-backdrop)` / `var(--bg-secondary)`
- 边框使用 `var(--border)` / `var(--bg-tertiary)`
- 动画使用 `<Transition>` + CSS transition (0.15s~0.25s ease)

### Vue 3 组件规范
**Source:** 所有 `.vue` 文件
**Apply to:** `ContextMenu.vue`, `ClipboardPanel.vue`
- `<script setup lang="ts">` 标准模式
- `defineProps<{}>` 定义属性
- `defineEmits<{(e: 'xxx'): void}>()` 定义事件
- `<style scoped>` 局部样式
- 中文 UI 文本硬编码
- 所有颜色使用 `var(--*)` CSS 变量

### 测试文件结构
**Source:** `src/renderer/src/components/__tests__/ConfirmDialog.test.ts`
**Apply to:** 新增 store 和组件的测试文件
```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
// 或 import { useXxxStore } from '../stores/xxx'

describe('ComponentOrStoreName', () => {
  it('描述性测试名', () => {
    // Arrange → Act → Assert
  })
})
```
- 测试文件位于 `__tests__/` 子目录
- 使用 vitest + @vue/test-utils
- happy-dom 测试环境

## No Analog Found

所有文件均有项目内明确的 analog，无需回退到 RESEARCH.md 模式。

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (无) | - | - | 全部 14 个文件均有项目内 analog |

## Metadata

**Analog search scope:** `src/main/ipc/`, `src/main/claude/`, `src/main/index.ts`, `src/preload/`, `src/shared/`, `src/renderer/src/components/`, `src/renderer/src/stores/`, `src/renderer/src/composables/`
**Files scanned:** 18
**Pattern extraction date:** 2026-04-26
