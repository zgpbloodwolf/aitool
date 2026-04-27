# Phase 7: 工作流增强 - Pattern Map

**Mapped:** 2026-04-26
**Files analyzed:** 12 (7 新增 + 5 修改)
**Analogs found:** 12 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/main/claude/token-usage-store.ts` | service | file-I/O | `src/main/tray/tray-manager.ts` | exact (JSON 持久化) |
| `src/main/ipc/token-usage.ts` | controller | request-response | `src/main/ipc/dialog.ts` | exact (IPC handler) |
| `src/renderer/src/components/TokenUsagePanel.vue` | component | request-response | `src/renderer/src/components/SettingsDrawer.vue` | role-match (分组 UI) |
| `src/renderer/src/composables/useTokenUsage.ts` | hook | request-response | `src/renderer/src/composables/useNotification.ts` | exact (composable) |
| `build/installer.nsh` | config | file-I/O | 无 (全新类型) | no-match |
| `src/main/ipc/claude-webview.ts` (修改) | controller | event-driven | 自身 | self |
| `src/main/index.ts` (修改) | config | event-driven | 自身 | self |
| `src/renderer/src/components/SettingsDrawer.vue` (修改) | component | request-response | 自身 | self |
| `src/preload/index.ts` (修改) | middleware | request-response | 自身 | self |
| `src/preload/index.d.ts` (修改) | config | -- | 自身 | self |
| `electron-builder.yml` (修改) | config | -- | 自身 | self |
| `package.json` (修改) | config | -- | 自身 | self |

## Pattern Assignments

### `src/main/claude/token-usage-store.ts` (service, file-I/O)

**Analog:** `src/main/tray/tray-manager.ts` -- userData JSON 持久化模式

**Imports pattern** (lines 11-13):
```typescript
import { Tray, Menu, nativeImage, BrowserWindow, ipcMain, dialog, app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
```

**JSON 文件路径定义** (line 19):
```typescript
const CLOSE_BEHAVIOR_FILE = join(app.getPath('userData'), 'close-behavior.json')
```

**数据加载模式** (lines 28-38):
```typescript
function loadCloseBehavior(): CloseBehavior {
  try {
    if (existsSync(CLOSE_BEHAVIOR_FILE)) {
      const data = JSON.parse(readFileSync(CLOSE_BEHAVIOR_FILE, 'utf-8'))
      return data.behavior || 'ask'
    }
  } catch {
    // 文件损坏或格式错误，返回默认值
  }
  return 'ask'
}
```

**数据保存模式** (lines 43-45):
```typescript
function saveCloseBehavior(behavior: CloseBehavior): void {
  writeFileSync(CLOSE_BEHAVIOR_FILE, JSON.stringify({ behavior }), 'utf-8')
}
```

**关键差异：**
- 新模块需新增"写入队列"（Promise chain），避免并发 channel 关闭时 JSON 文件写入损坏（RESEARCH Pitfall 4）
- 新增 90 天自动清理逻辑（D-04）
- 新增按天聚合逻辑（D-02）

---

### `src/main/ipc/token-usage.ts` (controller, request-response)

**Analog:** `src/main/ipc/dialog.ts` -- 独立 IPC handler 注册模式

**完整文件** (lines 1-31):
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

  // UX-07: 保存文件对话框 — 用于导出对话为 Markdown
  ipcMain.handle(
    'dialog:showSaveDialog',
    async (
      _event,
      options: { defaultPath: string; title: string }
    ) => {
      const window = BrowserWindow.getFocusedWindow()
      if (!window) return { canceled: true, filePath: '' }
      const result = await dialog.showSaveDialog(window, {
        title: options.title,
        defaultPath: options.defaultPath,
        filters: [{ name: 'Markdown', extensions: ['md'] }]
      })
      return { canceled: result.canceled, filePath: result.filePath || '' }
    }
  )
}
```

**核心模式：**
- 导出 `registerXxxHandlers()` 函数
- 函数内使用 `ipcMain.handle()` 注册请求/响应式 IPC 通道
- 在 `src/main/index.ts` 中导入并调用注册函数

---

### `src/renderer/src/components/TokenUsagePanel.vue` (component, request-response)

**Analog:** `src/renderer/src/components/SettingsDrawer.vue` -- 分组 UI + CSS 变量 + Vue 3 `<script setup>`

**Script setup 模式** (lines 1-34):
```vue
<script setup lang="ts">
import { useSettingsStore, type CloseBehavior, type ThemeMode } from '../stores/settings'

const settingsStore = useSettingsStore()

const emit = defineEmits<{
  (e: 'close'): void
}>()
```

**分组 section 结构** (lines 49-68):
```vue
<!-- 主题 (05-01) -->
<section class="settings-section">
  <h3 class="section-title">主题</h3>
  <div
    v-for="opt in themeOptions"
    :key="opt.value"
    class="setting-row radio-row"
    @click="updateTheme(opt.value)"
  >
    <!-- 单行设置项内容 -->
  </div>
</section>
```

**CSS 变量使用** (lines 244-268) -- 所有颜色必须使用 `var(--*)`:
```css
.settings-backdrop {
  background: var(--overlay-backdrop);
}
.settings-drawer {
  width: 360px;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border);
  box-shadow: -4px 0 16px var(--shadow-color);
}
.drawer-title {
  color: var(--text-primary);
}
.section-title {
  color: var(--text-secondary);
}
```

**关键差异：**
- TokenUsagePanel 作为子组件嵌入 SettingsDrawer，不需要自己的 backdrop/drawer 外壳
- 需要引入 Chart.js + vue-chartjs（见 RESEARCH.md Pattern 2 的 tree-shaking 注册模式）
- CSS 颜色值必须通过 `getComputedStyle` 获取实际值传给 Chart.js（RESEARCH Pitfall 5）

---

### `src/renderer/src/composables/useTokenUsage.ts` (hook, request-response)

**Analog:** `src/renderer/src/composables/useNotification.ts` -- composable 模式

**完整文件** (lines 1-29):
```typescript
/**
 * 通知系统渲染端集成
 * - 监听通知跳转标签页事件
 * - 监听前台时声音播放事件（D-03: 窗口在前台时不弹通知但仍播放声音）
 */
import { playSound } from './useSound'

/**
 * 注册通知相关的渲染进程事件监听
 * 必须在 App.vue onMounted 中调用
 */
export function useNotification(): void {
  // 通知点击跳转到对应标签页
  window.api.onNotificationFocusTab?.((channelId: string) => {
    window.dispatchEvent(new CustomEvent('notification:focus-tab', { detail: channelId }))
  })

  // 前台通知被抑制时仍播放声音
  window.api.onNotificationPlaySound?.((type: string) => {
    playSoundForType(type)
  })
}

function playSoundForType(type: string): void {
  if (type === 'complete') playSound('complete')
  else if (type === 'permission') playSound('permission')
  else if (type === 'error') playSound('error')
}
```

**核心模式：**
- 导出单一函数 `useXxx()`
- 通过 `window.api.*` 调用 preload 桥接的 IPC 方法
- 可使用 `ref`/`reactive` 管理响应式状态
- composable 文件位于 `src/renderer/src/composables/` 目录

---

### `src/main/ipc/claude-webview.ts` (修改: handleCloseChannel 中记录 token 用量)

**Analog:** 自身 -- 修改 `handleCloseChannel()` 函数

**当前 handleCloseChannel** (lines 492-503):
```typescript
function handleCloseChannel(channelId: string): void {
  const channel = channels.get(channelId)
  if (!channel) return
  safeLog('[ClaudeIPC] 正在关闭频道:', channelId)
  // D-12: 清理所有 pending 的超时定时器
  for (const resolver of channel.permissionResolvers.values()) {
    clearTimeout(resolver.timeoutId)
  }
  channel.permissionResolvers.clear()
  channel.process.stop()
  channels.delete(channelId)
}
```

**Token 追踪数据源** (lines 236-247) -- 已有的累计逻辑:
```typescript
// 追踪 token 用量
if (msg.type === 'stream_event') {
  const usage = (msg.event as Record<string, unknown>)?.usage as
    | { input_tokens?: number; output_tokens?: number }
    | undefined
  if (usage) {
    const ch = channels.get(channelId)
    if (ch) {
      if (usage.input_tokens) ch.totalInputTokens = usage.input_tokens
      if (usage.output_tokens) ch.totalOutputTokens = usage.output_tokens
    }
  }
}
```

**修改点：** 在 `handleCloseChannel()` 中，`channel.process.stop()` 之前，调用 token-usage-store 的 `recordTokenUsage()` 写入本次会话数据

---

### `src/main/index.ts` (修改: 单实例锁 + 注册表检查)

**Analog:** 自身 -- 在现有结构中插入新逻辑

**当前 IPC 注册模式** (lines 127-142):
```typescript
app.whenReady().then(() => {
  app.setAppUserModelId('com.aitools.desktop')

  ipcMain.on('app:version', (event) => {
    event.returnValue = app.getVersion()
  })

  registerDialogHandlers()
  registerFilesystemHandlers()
  registerExtensionHandlers()
  registerClaudeWebviewHandlers()
  registerFileWatcherHandlers()

  const mainWindow = createWindow()
  setupTray(mainWindow)
  registerTrayHandlers()
  // ...
})
```

**修改点：**
1. 在 `app.whenReady()` 之前添加 `requestSingleInstanceLock()` + `second-instance` 事件（参考 RESEARCH.md Pattern 4）
2. 在 `app.whenReady()` 回调内新增 `registerTokenUsageHandlers()` 调用
3. 在 `app.whenReady()` 回调末尾添加 `ensureContextMenuRegistered()` 调用

---

### `src/renderer/src/components/SettingsDrawer.vue` (修改: 新增用量统计分组)

**Analog:** 自身 -- 扩展现有分组结构

**现有分组插入位置** (在 "关闭窗口时" section 之后, line 237):
```vue
<!-- 托盘行为 (D-11) -->
<section class="settings-section">
  <h3 class="section-title">关闭窗口时</h3>
  <!-- ... -->
</section>
<!-- 在此处插入 "用量统计" 分组 -->
```

**修改点：** 在最后一个 `</section>` 之前新增 TokenUsagePanel 的引用：
```vue
<!-- 用量统计 (UX-09) -->
<section class="settings-section">
  <h3 class="section-title">用量统计</h3>
  <TokenUsagePanel />
</section>
```

需要在 `<script setup>` 中添加 `import TokenUsagePanel from './TokenUsagePanel.vue'`

---

### `src/preload/index.ts` (修改: 新增 IPC 桥接)

**Analog:** 自身 -- 扩展 api 对象

**现有 IPC 桥接模式** (lines 48-50) -- handle 模式:
```typescript
claudeGetContextUsage: (): Promise<
  Record<string, { inputTokens: number; outputTokens: number }>
> => ipcRenderer.invoke('claude:get-context-usage'),
```

**现有事件监听模式** (lines 118-123) -- on/removeListener 模式:
```typescript
onCloseBehaviorChanged: (callback: (behavior: string) => void): (() => void) => {
  const handler = (_event: Electron.IpcRendererEvent, behavior: string): void =>
    callback(behavior)
  ipcRenderer.on('settings:close-behavior-changed', handler)
  return () => ipcRenderer.removeListener('settings:close-behavior-changed', handler)
},
```

**需新增的方法：**
1. `getTokenUsageStats: (range: string) => Promise<TokenUsageStats>` -- handle 模式
2. `onOpenDirectory: (callback: (dirPath: string) => void) => (() => void)` -- on/removeListener 模式

---

### `src/preload/index.d.ts` (修改: 新增类型声明)

**Analog:** 自身 -- 扩展 Window.api 接口

**现有类型声明模式** (lines 27-29):
```typescript
claudeGetContextUsage: () => Promise<
  Record<string, { inputTokens: number; outputTokens: number }>
>
```

**需新增的类型声明：** 与 preload/index.ts 中新增的方法一一对应

---

### `electron-builder.yml` (修改: NSIS 配置)

**Analog:** 自身 -- 扩展 nsis 配置段

**当前 NSIS 配置** (lines 29-34):
```yaml
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  artifactName: ${name}-${version}-setup.${ext}
  shortcutName: ${productName}
  uninstallDisplayName: ${productName}
```

**修改点：** 添加 `include: build/installer.nsh` 引用自定义 NSIS 脚本

---

### `package.json` (修改: 新增依赖)

**Analog:** 自身 -- 在 dependencies 中添加

**当前依赖结构** (lines 24-30):
```json
"dependencies": {
  "@electron-toolkit/preload": "^2.0.0",
  "@electron-toolkit/utils": "^2.0.1",
  "chokidar": "^5.0.0",
  "electron-updater": "^6.8.3",
  "pinia": "^3.0.4"
}
```

**需新增：** `"chart.js": "^4.5.1"` 和 `"vue-chartjs": "^5.3.3"` 到 dependencies

---

## Shared Patterns

### userData 目录 JSON 文件持久化
**Source:** `src/main/tray/tray-manager.ts` lines 19-45
**Apply to:** `src/main/claude/token-usage-store.ts`
```typescript
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

const DATA_FILE = join(app.getPath('userData'), 'token-usage.json')

function loadData(): TokenUsageData {
  try {
    if (existsSync(DATA_FILE)) {
      return JSON.parse(readFileSync(DATA_FILE, 'utf-8'))
    }
  } catch { /* 损坏则返回默认值 */ }
  return { days: [] }
}

function saveData(data: TokenUsageData): void {
  writeFileSync(DATA_FILE, JSON.stringify(data), 'utf-8')
}
```

### IPC Handler 注册
**Source:** `src/main/ipc/dialog.ts` lines 1-31
**Apply to:** `src/main/ipc/token-usage.ts` + `src/main/index.ts` 注册调用
```typescript
// token-usage.ts
import { ipcMain } from 'electron'
import { getTokenUsageStats } from '../claude/token-usage-store'

export function registerTokenUsageHandlers(): void {
  ipcMain.handle('token-usage:get-stats', async (_event, range: string) => {
    return getTokenUsageStats(range)
  })
}

// index.ts 中调用
import { registerTokenUsageHandlers } from './ipc/token-usage'
// 在 app.whenReady() 中:
registerTokenUsageHandlers()
```

### Preload API 桥接
**Source:** `src/preload/index.ts` lines 48-50, 118-123
**Apply to:** preload/index.ts 新增方法 + preload/index.d.ts 类型声明
```typescript
// handle 模式 (请求/响应)
getTokenUsageStats: (range: string): Promise<TokenUsageStats> =>
  ipcRenderer.invoke('token-usage:get-stats', range),

// on/removeListener 模式 (事件监听)
onOpenDirectory: (callback: (dirPath: string) => void): (() => void) => {
  const handler = (_event: Electron.IpcRendererEvent, dirPath: string): void =>
    callback(dirPath)
  ipcRenderer.on('open-directory', handler)
  return () => ipcRenderer.removeListener('open-directory', handler)
},
```

### Vue 3 组件 CSS 变量
**Source:** `src/renderer/src/components/SettingsDrawer.vue` lines 244-440
**Apply to:** `src/renderer/src/components/TokenUsagePanel.vue`
```css
/* 必须使用的 CSS 变量 */
color: var(--text-primary);       /* 主文本 */
color: var(--text-secondary);     /* 次要文本 */
color: var(--text-muted);         /* 弱化文本 */
background: var(--bg-secondary);  /* 背景色 */
background: var(--bg-tertiary);   /* 三级背景 */
border: 1px solid var(--border);  /* 边框 */
color: var(--accent);             /* 强调色 */
```

### 模块级单例共享引用
**Source:** `src/main/notification/notification-registry.ts` lines 1-11
**Apply to:** token-usage-store 的导入方式（可选，如需跨模块共享）
```typescript
import type { NotificationManager } from './notification-manager'

export let notificationManager: NotificationManager | null = null

export function setNotificationManager(mgr: NotificationManager): void {
  notificationManager = mgr
}
```

### session-store 辅助函数复用
**Source:** `src/main/claude/session-store.ts` lines 17-24
**Apply to:** `src/main/claude/token-usage-store.ts` -- 按工作区分组时复用 `encodeProjectPath()`
```typescript
export function encodeProjectPath(cwd: string): string {
  const encoded = cwd.replace(/[^a-zA-Z0-9]/g, '-')
  if (encoded.length <= 200) return encoded
  const hash = Math.abs(
    Array.from(cwd).reduce((acc, ch) => ((acc << 5) - acc + ch.charCodeAt(0)) | 0, 0)
  ).toString(36)
  return `${encoded.slice(0, 200)}-${hash}`
}
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `build/installer.nsh` | config | file-I/O | 项目中尚无 NSIS 自定义脚本，属全新类型 |

**Planner 指引：** `build/installer.nsh` 应直接使用 RESEARCH.md Pattern 3 中的 NSIS 代码模板。注意以下要点：
- 使用 `$INSTDIR\ai-tools.exe`（与 `electron-builder.yml` 中 `win.executableName: ai-tools` 一致），而非 `$INSTDIR\AI Tools.exe`
- 使用 `SHCTX` 而非直接写 `HKCR`，让 NSIS 根据安装模式自动路由
- `customInstall` 和 `customUnInstall` 宏名称由 electron-builder 约定，不可更改

## Metadata

**Analog search scope:** src/main/ipc/, src/main/claude/, src/main/tray/, src/main/notification/, src/renderer/src/components/, src/renderer/src/composables/, src/preload/, build/, electron-builder.yml, package.json
**Files scanned:** 14
**Pattern extraction date:** 2026-04-26
