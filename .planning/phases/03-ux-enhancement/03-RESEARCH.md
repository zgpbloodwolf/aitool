# Phase 3: UX Enhancement - Research

**Researched:** 2026-04-25
**Domain:** Electron + Vue 3 + TypeScript 桌面客户端 UX 改进
**Confidence:** HIGH

## Summary

Phase 3 覆盖 24 个决策项（D-01 到 D-24），涉及 7 个能力域：错误恢复、键盘快捷键、操作确认对话框、进程健康监控、标签页增强、文件树与侧边栏增强、安全加固。所有改动在现有架构内完成，不需要引入新的进程间通信模式或架构层面的变更。

**主要建议:** 所有 24 项决策均可在现有代码库中实现，唯一需要新安装的外部依赖是 `chokidar`（文件系统监听）。标签拖拽排序（D-16）建议使用 `vue-draggable-plus` 或原生 HTML5 Drag API 实现。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Webview 初始化失败时显示"重试"按钮，调用 `initWebview()`
- **D-02:** 会话删除操作添加确认弹窗
- **D-03:** 扩展加载失败时在 UI 显示错误提示
- **D-04:** 会话列表加载失败时显示错误提示
- **D-05:** 实现完整快捷键集 (Ctrl+N/W/B, Ctrl+Shift+N, Ctrl+Tab)
- **D-06:** 删除会话前弹出确认弹窗
- **D-07:** 关闭有活跃进程的标签前弹出确认
- **D-08:** 切换工作区时有活跃进程时弹警告
- **D-09:** 确认对话框使用自定义 Vue 组件 (Catppuccin Mocha 主题)
- **D-10:** claude.exe 崩溃后自动重连并恢复会话
- **D-11:** 每 30 秒心跳检测进程存活
- **D-12:** 清理权限请求的超时定时器
- **D-13:** 智能标签名（从会话摘要提取）
- **D-14:** 标签状态指示器（绿/黄/灰）
- **D-15:** 中键点击关闭标签
- **D-16:** 标签拖拽排序（可选）
- **D-17:** 侧边栏宽度可拖拽调整
- **D-18:** 文件系统监听 (chokidar)
- **D-19:** 文件搜索过滤
- **D-20:** 收藏项目目录
- **D-21:** deleteSession 验证 UUID 格式
- **D-22:** 文件系统沙盒使用 fs.realpath 解析符号链接
- **D-23:** iframe sandbox 安全加固
- **D-24:** 全局未捕获异常处理器

### Claude's Discretion
- 确认对话框组件的具体视觉设计（按钮布局、动画）
- 文件搜索的防抖时间和高亮样式
- 心跳检测的具体间隔（建议 30s，可调整）
- 收藏列表的最大数量限制
- 全局异常处理中哪些错误需要弹对话框、哪些仅记录日志

### Deferred Ideas (OUT OF SCOPE)
- 上下文用量展示（状态栏显示 token 用量）
- 深色/浅色主题切换
- ARIA 无障碍属性
- FileTree 重构为 SFC 模式
- 自动更新（electron-updater）
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| D-01 | Webview 初始化失败时显示重试按钮 | ChatPanel.vue error 分支已有结构，添加重试按钮调用 `initWebview()` 即可 |
| D-02 | 会话删除确认弹窗 | deleteSessionById() 调用前拦截，使用自定义 ConfirmDialog 组件 |
| D-03 | 扩展加载失败 UI 提示 | extension store 添加 error ref，App.vue try-catch |
| D-04 | 会话列表加载失败提示 | toggleSessionHistory() catch 分支改为显示错误而非空列表 |
| D-05 | 全局键盘快捷键 | App.vue 注册 keydown 监听，expose 组件方法供分发 |
| D-06 | 删除确认对话框 | 复用 ConfirmDialog 组件，按钮文案调整 |
| D-07 | 关闭活跃标签确认 | 检查 channelToTab 映射判断活跃状态 |
| D-08 | 切换工作区确认 | workspace.openFolder() 前检查活跃 channel |
| D-09 | 自定义确认对话框 | 创建 Vue SFC 组件，Catppuccin Mocha 主题变量 |
| D-10 | Claude 进程崩溃自动重连 | process exit 事件 → IPC 通知渲染进程 → 自动 resumeSession |
| D-11 | 30秒心跳检测 | process-manager.ts 添加 startHealthCheck()，定时检查 pid |
| D-12 | 清理超时定时器 | channel 关闭时清除 permissionResolvers 中的 setTimeout |
| D-13 | 智能标签名 | 从 system.init 消息提取摘要，回退到"对话 N" |
| D-14 | 标签状态指示器 | 跟踪 system/result/permission 消息判断绿/黄/灰 |
| D-15 | 中键关闭标签 | @mousedown.middle 事件处理 |
| D-16 | 标签拖拽排序 | vue-draggable-plus 或 HTML5 Drag API |
| D-17 | 侧边栏可拖拽宽度 | CSS resize 或自定义拖拽手柄 + localStorage 持久化 |
| D-18 | 文件系统监听 | chokidar v5 在主进程监听，通过 IPC 通知渲染进程刷新 |
| D-19 | 文件搜索过滤 | 递归过滤 FileEntry 树，高亮匹配文本 |
| D-20 | 收藏项目目录 | localStorage 存储，Sidebar UI 展示 |
| D-21 | UUID 验证 | session-store.ts 已有 UUID_RE 正则，deleteSession 前复用 |
| D-22 | 符号链接解析 | fs.realpath() 在 isPathAllowed 中使用 |
| D-23 | iframe sandbox 加固 | 测试移除 allow-same-origin 后兼容性，否则精确化 origin |
| D-24 | 全局异常处理 | process.on('uncaughtException'/'unhandledRejection') |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 错误恢复 UI (D-01~D-04) | Browser / Renderer | — | 纯 UI 状态显示，在 Vue 组件中实现 |
| 键盘快捷键 (D-05) | Browser / Renderer | — | DOM keydown 事件监听，渲染进程级别 |
| 确认对话框 (D-06~D-09) | Browser / Renderer | — | 自定义 Vue 组件，纯前端逻辑 |
| 进程健康监控 (D-10~D-12) | API / Backend (Main) | Browser / Renderer | 主进程管理子进程生命周期，通过 IPC 通知渲染进程 |
| 标签页增强 (D-13~D-16) | Browser / Renderer | — | 标签 UI 和交互在 ChatPanel.vue 中 |
| 侧边栏可拖拽 (D-17) | Browser / Renderer | — | CSS + DOM 事件 |
| 文件监听 (D-18) | API / Backend (Main) | Browser / Renderer | chokidar 运行在主进程 Node.js 环境 |
| 文件搜索过滤 (D-19) | Browser / Renderer | — | 纯前端树过滤逻辑 |
| 收藏目录 (D-20) | Browser / Renderer | — | localStorage 存储，纯前端 |
| UUID 验证 (D-21) | API / Backend (Main) | — | 安全校验必须在主进程完成 |
| 符号链接解析 (D-22) | API / Backend (Main) | — | fs.realpath 在主进程 Node.js 环境 |
| iframe sandbox (D-23) | Browser / Renderer | — | HTML 属性修改 |
| 全局异常处理 (D-24) | API / Backend (Main) | — | Node.js process 事件 |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vue 3 | ^3.5.25 | UI 框架 | 项目已用，Composition API + `<script setup>` |
| Pinia | ^3.0.4 | 状态管理 | 项目已用，所有 store 基于此 |
| Electron | ^35.7.5 | 桌面框架 | 项目已用，主进程/渲染进程桥接 |
| electron-vite | ^2.3.0 | 构建工具 | 项目已用，HMR 和打包 |
| TypeScript | ^5.9.3 | 类型系统 | 项目已用 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| chokidar | 5.0.0 | 文件系统监听 | D-18 文件树自动刷新，主进程侧使用 |
| vue-draggable-plus | 0.6.1 (可选) | 标签拖拽排序 | D-16 若选择库方案而非原生 Drag API |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| vue-draggable-plus | 原生 HTML5 Drag and Drop API | 原生 API 零依赖但代码量大，vue-draggable-plus 封装更好但增加依赖 |
| chokidar | Node.js fs.watch | chokidar 处理了所有平台差异和递归监听的边界情况，fs.watch 在 Windows 上有已知问题 [VERIFIED: npm registry] |
| localStorage | electron-store | localStorage 对简单配置已足够，electron-store 适合复杂 schema 但增加依赖 [ASSUMED] |

**Installation (仅 chokidar):**
```bash
pnpm add chokidar
```

**Version verification:**
- chokidar: 5.0.0 [VERIFIED: npm registry, 2026-04-25]
- vue-draggable-plus: 0.6.1 [VERIFIED: npm registry, 2026-04-25]
- Pinia: 3.0.4 [VERIFIED: npm registry, 2026-04-25]
- Electron: 35.7.5 (项目锁定), registry latest 41.3.0 [VERIFIED: npm registry, 2026-04-25]

## Architecture Patterns

### System Architecture Diagram

```
用户输入 (键盘/鼠标)
  |
  v
[渲染进程 - Vue 3]
  |-- App.vue ─── 全局 keydown 监听 (D-05)
  |     |-- TitleBar.vue ─── 扩展选择
  |     |-- Sidebar.vue ─── 拖拽手柄 (D-17), 搜索过滤 (D-19), 收藏目录 (D-20)
  |     |     |-- FileTree.vue ─── 文件树渲染
  |     |-- ChatPanel.vue ─── 标签管理, iframe 容器
  |     |     |-- ConfirmDialog.vue ─── 通用确认对话框 (D-06~D-09)
  |     |     |-- 标签栏 ─── 智能名称 (D-13), 状态指示器 (D-14), 拖拽 (D-16)
  |     |     |-- iframe ─── Claude Code webview (sandbox D-23)
  |     |-- StatusBar.vue
  |
  | window.api.* (IPC invoke/send)
  |
  v
[Preload 层 - contextBridge]
  |
  | ipcRenderer.invoke / ipcRenderer.on
  |
  v
[主进程 - Electron]
  |-- index.ts ─── 全局异常处理 (D-24)
  |-- process-manager.ts ─── 心跳检测 (D-11), 崩溃恢复 (D-10)
  |-- claude-webview.ts ─── IPC 中心, channel 管理, 超时清理 (D-12)
  |-- filesystem.ts ─── 符号链接解析 (D-22)
  |-- session-store.ts ─── UUID 验证 (D-21)
  |-- file-watcher.ts (新增) ─── chokidar 文件监听 (D-18)
  |
  v
[子进程] claude.exe
```

### Recommended Project Structure

```
src/
├── renderer/src/
│   ├── components/
│   │   ├── ConfirmDialog.vue    # [新增] 通用确认对话框 (D-09)
│   │   ├── ChatPanel.vue        # [修改] 标签增强, 错误恢复
│   │   ├── Sidebar.vue          # [修改] 拖拽手柄, 搜索, 收藏
│   │   ├── FileTree.vue         # [修改] 搜索高亮
│   │   ├── App.vue              # [修改] 全局快捷键
│   │   └── ...
│   ├── stores/
│   │   ├── workspace.ts         # [修改] 文件搜索, 收藏目录
│   │   ├── extension.ts         # [修改] 错误状态
│   │   └── ...
│   └── composables/
│       └── useKeyboardShortcuts.ts  # [新增] 快捷键 composable (可选)
├── main/
│   ├── index.ts                 # [修改] 全局异常处理
│   ├── ipc/
│   │   ├── claude-webview.ts    # [修改] 超时清理, 崩溃恢复通知
│   │   ├── filesystem.ts        # [修改] 符号链接解析
│   │   └── file-watcher.ts      # [新增] chokidar IPC handler
│   ├── claude/
│   │   ├── process-manager.ts   # [修改] 心跳检测, 崩溃恢复
│   │   └── session-store.ts     # [修改] UUID 验证
│   └── ...
├── preload/
│   ├── index.ts                 # [修改] 添加文件监听 IPC API
│   └── index.d.ts               # [修改] 类型声明
└── shared/
    └── types.ts                 # [可能修改] 添加新类型
```

### Pattern 1: 确认对话框组件 (D-09)

**What:** 可复用的模态确认对话框，替代 `window.confirm()`，保持 Catppuccin Mocha 主题。

**When to use:** 所有需要用户确认的操作（删除会话、关闭活跃标签、切换工作区）。

**Example:**
```vue
<!-- ConfirmDialog.vue -->
<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  visible: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info'
}>()

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

function handleConfirm() {
  emit('confirm')
}
function handleCancel() {
  emit('cancel')
}
</script>

<template>
  <Transition name="dialog-fade">
    <div v-if="visible" class="dialog-overlay" @click.self="handleCancel">
      <div class="dialog-box">
        <h3 class="dialog-title">{{ title }}</h3>
        <p class="dialog-message">{{ message }}</p>
        <div class="dialog-actions">
          <button class="btn-cancel" @click="handleCancel">
            {{ cancelText || '取消' }}
          </button>
          <button class="btn-confirm" :class="type || 'info'" @click="handleConfirm">
            {{ confirmText || '确定' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.dialog-box {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px 24px;
  min-width: 320px;
  max-width: 420px;
}
.dialog-title {
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 8px;
}
.dialog-message {
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 20px;
}
.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.btn-cancel {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: none;
  padding: 6px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}
.btn-confirm {
  border: none;
  padding: 6px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: var(--bg-primary);
}
.btn-confirm.danger { background: var(--error); }
.btn-confirm.warning { background: var(--warning); }
.btn-confirm.info { background: var(--accent); }
.dialog-fade-enter-active, .dialog-fade-leave-active { transition: opacity 0.15s; }
.dialog-fade-enter-from, .dialog-fade-leave-to { opacity: 0; }
</style>
```

**Source:** Catppuccin Mocha CSS 变量来自 `src/renderer/src/assets/main.css` [VERIFIED: codebase]

### Pattern 2: 全局键盘快捷键注册 (D-05)

**What:** 在 App.vue 根组件注册全局 keydown 监听，分发到子组件方法。

**When to use:** 全局级快捷键（Ctrl+N/W/B/Tab），需要在组件树顶层注册。

**Example:**
```typescript
// App.vue <script setup> 中添加
import { ref, onMounted, onBeforeUnmount } from 'vue'

const chatPanelRef = ref<InstanceType<typeof ChatPanel> | null>(null)
const sidebarVisible = ref(true)

function handleGlobalKeydown(e: KeyboardEvent) {
  // Ctrl+N: 新建对话标签
  if (e.ctrlKey && !e.shiftKey && e.key === 'n') {
    e.preventDefault()
    chatPanelRef.value?.addNewTab()
  }
  // Ctrl+W: 关闭当前标签
  if (e.ctrlKey && e.key === 'w') {
    e.preventDefault()
    chatPanelRef.value?.closeActiveTab()
  }
  // Ctrl+B: 切换侧边栏
  if (e.ctrlKey && e.key === 'b') {
    e.preventDefault()
    sidebarVisible.value = !sidebarVisible.value
  }
  // Ctrl+Tab: 下一个标签
  if (e.ctrlKey && !e.shiftKey && e.key === 'Tab') {
    e.preventDefault()
    chatPanelRef.value?.switchToNextTab()
  }
  // Ctrl+Shift+Tab: 上一个标签
  if (e.ctrlKey && e.shiftKey && e.key === 'Tab') {
    e.preventDefault()
    chatPanelRef.value?.switchToPrevTab()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleGlobalKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
})
```

**关键要求:** ChatPanel 需要通过 `defineExpose` 暴露方法给父组件调用。

### Pattern 3: 进程心跳检测 (D-11)

**What:** 在主进程定期检查 claude.exe 子进程是否存活。

**When to use:** 每个 channel 启动后开启心跳，channel 关闭时停止。

**Example:**
```typescript
// process-manager.ts 中添加
private healthCheckInterval: ReturnType<typeof setInterval> | null = null

startHealthCheck(onUnresponsive: () => void, intervalMs = 30000): void {
  this.stopHealthCheck()
  this.healthCheckInterval = setInterval(() => {
    if (!this.process || !this._running) return
    try {
      // Windows 上通过检查进程是否存在来判断
      // process.pid 在进程退出后 kill(pid, 0) 会抛异常
      process.kill(this.process.pid!, 0)
    } catch {
      // 进程已死但 exit 事件未触发 → 挂死
      onUnresponsive()
    }
  }, intervalMs)
}

stopHealthCheck(): void {
  if (this.healthCheckInterval) {
    clearInterval(this.healthCheckInterval)
    this.healthCheckInterval = null
  }
}
```

**Source:** Node.js `process.kill(pid, 0)` 是标准的存在性检查方式 [ASSUMED]

### Pattern 4: chokidar 文件监听 (D-18)

**What:** 主进程使用 chokidar 监听工作区文件变更，通过 IPC 通知渲染进程刷新文件树。

**When to use:** 打开工作区时启动监听，关闭时停止。

**Example:**
```typescript
// main/ipc/file-watcher.ts (新增文件)
import chokidar from 'chokidar'
import { ipcMain, BrowserWindow } from 'electron'

let watcher: chokidar.FSWatcher | null = null

export function registerFileWatcherHandlers(): void {
  ipcMain.handle('fs:startWatch', (_event, dirPath: string) => {
    stopWatcher()
    watcher = chokidar.watch(dirPath, {
      ignored: /node_modules|\.git/,
      persistent: true,
      ignoreInitial: true,
      depth: 10
    })
    watcher.on('all', (event, path) => {
      const win = BrowserWindow.getAllWindows()[0]
      if (win) {
        win.webContents.send('fs:changed', { event, path })
      }
    })
    return true
  })

  ipcMain.handle('fs:stopWatch', () => {
    stopWatcher()
    return true
  })
}

function stopWatcher(): void {
  if (watcher) {
    watcher.close()
    watcher = null
  }
}
```

**Source:** chokidar v5 API [VERIFIED: Context7 /paulmillr/chokidar]

### Pattern 5: 侧边栏拖拽调整宽度 (D-17)

**What:** 添加拖拽手柄组件，通过 mousedown/mousemove/mouseup 实现。

**When to use:** 侧边栏右边缘添加 4px 宽的拖拽区域。

**Example:**
```vue
<!-- 在 App.vue 的 Sidebar 旁边添加拖拽手柄 -->
<template>
  <div class="main-content">
    <Sidebar v-if="sidebarVisible" :style="{ width: sidebarWidth + 'px' }" />
    <div
      v-if="sidebarVisible"
      class="resize-handle"
      @mousedown="startResize"
    />
    <div class="center-area">...</div>
  </div>
</template>

<script setup lang="ts">
const SIDEBAR_WIDTH_KEY = 'aitools-sidebar-width'
const sidebarWidth = ref(parseInt(localStorage.getItem(SIDEBAR_WIDTH_KEY) || '260'))

function startResize(e: MouseEvent) {
  const startX = e.clientX
  const startWidth = sidebarWidth.value

  function onMouseMove(e: MouseEvent) {
    const newWidth = Math.max(200, Math.min(500, startWidth + (e.clientX - startX)))
    sidebarWidth.value = newWidth
  }

  function onMouseUp() {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth.value))
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}
</script>

<style scoped>
.resize-handle {
  width: 4px;
  cursor: col-resize;
  background: transparent;
  flex-shrink: 0;
}
.resize-handle:hover {
  background: var(--accent);
}
</style>
```

### Anti-Patterns to Avoid

- **使用 `window.confirm()` / `window.alert()`:** 破坏 Catppuccin Mocha 主题一致性，无法自定义样式。必须使用自定义 Vue 组件。[CITED: CONTEXT.md D-09]
- **在渲染进程直接访问 Node.js API:** electron-vite 配置了 contextIsolation，渲染进程只能通过 preload bridge 访问 API。
- **在 preload 中暴露 fs.realpath:** 不需要。符号链接解析（D-22）在主进程 `filesystem.ts` 的 `isPathAllowed()` 中完成即可。
- **心跳检测在渲染进程执行:** 渲染进程无法直接检查 claude.exe pid。必须在主进程 process-manager.ts 中实现，通过 IPC 通知渲染进程。
- **iframe sandbox 移除 `allow-same-origin` 不做兼容性测试:** Claude Code webview 内部可能依赖 localStorage 或 fetch API（这些需要 same-origin），盲目移除会导致功能完全失效。[CITED: CONTEXT.md D-23]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 文件系统监听 | 自定义 fs.watch 递归监听 | chokidar v5 | Windows 上 fs.watch 有递归监听 bug、事件重复等问题，chokidar 处理了所有平台差异 [VERIFIED: Context7] |
| 标签拖拽排序 | 原生 Drag API + 手动数组操作 | vue-draggable-plus 或原生 Drag API | 如果选库方案，vue-draggable-plus 基于 SortableJS，已处理边界情况；如果仅标签排序，原生 Drag API 也足够简单 |
| UUID 正则 | 手写正则 | session-store.ts 已有 UUID_RE | 已验证存在：`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` [VERIFIED: codebase session-store.ts line 6] |

**Key insight:** 本 Phase 大部分工作是组合已有模式和组件，而非创造新机制。核心新增只有 chokidar 文件监听和确认对话框组件。

## Common Pitfalls

### Pitfall 1: ChatPanel defineExpose 遗漏

**What goes wrong:** App.vue 中通过 ref 调用 ChatPanel 方法（如 addNewTab）时报 undefined。
**Why it happens:** `<script setup>` 组件默认不暴露内部方法，必须显式 `defineExpose`。
**How to avoid:** ChatPanel.vue 中添加 `defineExpose({ addNewTab, closeActiveTab, switchToNextTab, switchToPrevTab })`。
**Warning signs:** 控制台出现 "chatPanelRef.value?.addNewTab is not a function"。

### Pitfall 2: Ctrl+Tab 与浏览器默认行为冲突

**What goes wrong:** Ctrl+Tab 被浏览器/Electron 默认行为拦截，无法触发自定义处理。
**Why it happens:** Ctrl+Tab 在浏览器中是内置快捷键，`e.preventDefault()` 必须在事件冒泡到浏览器之前调用。
**How to avoid:** 使用 `keydown` 事件（不是 `keyup`），且确保 `e.preventDefault()` 在最前面调用。Electron 的 `webContents.setIgnoredMenuShortcuts()` 可能也需要配置。
**Warning signs:** 快捷键在 DevTools 打开时不工作。

### Pitfall 3: iframe sandbox 移除 allow-same-origin 导致 webview 功能失效

**What goes wrong:** Claude Code webview 内部 JavaScript 使用了 `localStorage`、`fetch` 等需要 same-origin 的 API，移除后所有请求失败。
**Why it happens:** `allow-same-origin` 允许 iframe 保持其原始 origin，缺少它时所有 API 调用变成 `null` origin。
**How to avoid:** 先做兼容性测试。如果移除 `allow-same-origin` 不兼容，保留它但将 `postMessage` 的 targetOrigin 从 `'*'` 改为精确的 `http://127.0.0.1:${port}` [VERIFIED: codebase ChatPanel.vue line 262, 268, 269 当前使用 `'*'`]。
**Warning signs:** Webview 加载后空白或控制台报 SecurityError。

### Pitfall 4: chokidar 监听 node_modules 导致性能问题

**What goes wrong:** 在大型项目中，chokidar 监听 node_modules 导致大量文件事件，拖慢主进程。
**Why it happens:** 未配置 `ignored` 过滤规则。
**How to avoid:** 配置 `ignored: /node_modules|\.git/` 和合理的 `depth` 限制。
**Warning signs:** 打开工作区后 CPU 使用率飙升。

### Pitfall 5: 心跳检测的 process.kill(pid, 0) 在 Windows 上的行为

**What goes wrong:** Windows 上 `process.kill(pid, 0)` 的权限检查行为可能与 Unix 不同。
**Why it happens:** Windows 没有 Unix 信号系统，Node.js 通过 Windows API 模拟。
**How to avoid:** 备选方案 — 使用 `this.process.exitCode !== null` 或 `this.process.killed` 属性检查。在 ClaudeProcessManager 中维护 `_running` 状态，结合 exit 事件判断。
**Warning signs:** 心跳误报进程挂死。

### Pitfall 6: 权限请求超时定时器泄漏

**What goes wrong:** channel 关闭后，pending 的 permissionResolvers 中的 setTimeout 仍然在运行，尝试向已关闭的 channel 发消息。
**Why it happens:** handleCloseChannel 只调用 `process.stop()` 和 `channels.delete()`，未清理 permissionResolvers 中的定时器。
**How to avoid:** 在 handleCloseChannel 中遍历 channel.permissionResolvers，对每个条目调用 `clearTimeout`。需要将 setTimeout 的返回值存储到 PermissionResolver 结构中。
**Warning signs:** 关闭标签后控制台出现 "未知频道的 io_message" 日志。

### Pitfall 7: 侧边栏拖拽在 iframe 区域失效

**What goes wrong:** 鼠标拖拽过程中经过 iframe 区域时，mousemove 事件被 iframe 拦截，拖拽中断。
**Why it happens:** iframe 捕获了鼠标事件，父窗口无法接收。
**How to avoid:** 在 mousedown 时给 iframe 添加 `pointer-events: none`，mouseup 时恢复。或使用一个覆盖层（overlay）在拖拽期间遮挡 iframe。
**Warning signs:** 拖拽手柄只能在侧边栏区域拖动，一旦鼠标进入中心区域就停止。

### Pitfall 8: 标签状态指示器频繁更新导致性能问题

**What goes wrong:** 每个 system/result/permission 消息都触发状态更新，导致标签栏频繁重渲染。
**Why it happens:** 在 handleSystemMessage 中修改 ref 触发 Vue 响应式更新。
**How to avoid:** 使用 `Map<tabId, status>` 的响应式结构，且只在状态实际变化时更新。可使用 `shallowRef` 减少响应式追踪开销。
**Warning signs:** 标签栏闪烁或 CPU 使用率上升。

## Code Examples

### 现有可复用资产

#### 状态消息系统 (ChatPanel.vue 已有)
```typescript
// 已有 showStatus() / clearStatus() — 可复用于进程恢复提示
function showStatus(msg: string, type: 'info' | 'warning' | 'error' = 'info', duration = 0): void {
  statusMessage.value = msg
  statusType.value = type
  if (statusTimer) clearTimeout(statusTimer)
  if (duration > 0) {
    statusTimer = setTimeout(() => { statusMessage.value = null }, duration)
  }
}
```
[VERIFIED: codebase ChatPanel.vue lines 42-49]

#### UUID 正则 (session-store.ts 已有)
```typescript
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
```
[VERIFIED: codebase session-store.ts line 6]

#### Catppuccin Mocha CSS 变量 (main.css 已有)
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
}
```
[VERIFIED: codebase main.css lines 1-16]

### postMessage 精确 origin (D-23 安全加固)
```typescript
// 当前代码 (ChatPanel.vue line 262, 268)
iframe.contentWindow.postMessage({ type: 'from-extension', message: msg }, '*')

// 修改后
const origin = `http://127.0.0.1:${webviewPort}`
iframe.contentWindow.postMessage({ type: 'from-extension', message: msg }, origin)
```
**注意:** 需要在 ChatPanel 中存储 webviewPort（从 `claudeStartWebviewServer` 返回值获取）。

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Vue 2 Options API | Vue 3 Composition API + `<script setup>` | Vue 3 (2020) | FileTree.vue 仍用 Options API，新组件全部用 `<script setup>` |
| vuedraggable (Vue 2) | vue-draggable-plus (Vue 3) | 2023+ | 支持 Vue 3 Composition API，基于 SortableJS |
| Node.js fs.watch | chokidar v5 | 持续更新 | chokidar v5 是 ESM-only，但 electron-vite 主进程可以使用 |
| Electron ipcMain.on | ipcMain.handle (双向) | Electron 2+ | 项目已混用，新 IPC 建议统一用 handle |

**Deprecated/outdated:**
- `vuedraggable` (Vue 2 版本): 不兼容 Vue 3，如果需要拖拽库应使用 `vue-draggable-plus` 或 `vuedraggable-next` [ASSUMED]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | localStorage 足够存储侧边栏宽度和收藏目录，不需要 electron-store | Standard Stack | 低 — 如需更复杂存储可后续迁移 |
| A2 | Node.js `process.kill(pid, 0)` 在 Windows 上可正确检测进程存在性 | Pattern 3 | 中 — 可能需要改用 `process.exitCode` 检查 |
| A3 | 移除 `allow-same-origin` 会破坏 Claude Code webview 的 localStorage/fetch | Pitfall 3 | 高 — D-23 明确要求测试兼容性 |
| A4 | `vuedraggable` 不兼容 Vue 3 | State of the Art | 低 — 已确认 `vue-draggable-plus` 是 Vue 3 版本 |
| A5 | chokidar v5 在 electron-vite 主进程中可以正常工作 | Standard Stack | 低 — electron-vite 主进程使用 CJS/ESM 混合模式 |

## Open Questions (RESOLVED in planning)

1. **iframe sandbox `allow-same-origin` 兼容性 (D-23)**
   - What we know: 当前 iframe 使用 `sandbox="allow-scripts allow-same-origin allow-forms allow-popups"`，postMessage 目标为 `'*'`
   - What's unclear: 移除 `allow-same-origin` 后 Claude Code webview 内部的 localStorage/fetch 是否正常
   - Recommendation: 必须在实现阶段做兼容性测试。如果移除导致功能失效，保留 `allow-same-origin` 但将 postMessage 改为精确 origin

2. **Ctrl+Shift+N (新建窗口) 的实现难度 (D-05)**
   - What we know: Electron 支持 `new BrowserWindow()` 创建多窗口
   - What's unclear: 多窗口状态同步（channel 映射、session 状态共享）的复杂度
   - Recommendation: 作为可选项，如果多窗口同步复杂度过高可降级为仅打开新的标签页

3. **标签拖拽排序的实现方式 (D-16)**
   - What we know: 标签栏是简单的水平 flex 容器，tabs 数组驱动渲染
   - What's unclear: 原生 Drag API 在标签栏这种小元素上的用户体验
   - Recommendation: 先尝试原生 Drag API 实现（零依赖），如果体验不佳再引入 vue-draggable-plus

4. **全局异常处理中哪些错误弹对话框 (D-24)**
   - What we know: Claude's Discretion 区域
   - What's unclear: 用户期望的错误处理粒度
   - Recommendation: 仅对可能导致数据丢失的错误弹对话框（如 IPC 通信失败），其余仅记录日志

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 构建与运行 | YES | 24.13.0 | — |
| pnpm | 包管理 | YES | 10.32.0 | — |
| Electron | 桌面框架 | YES | ^35.7.5 (devDep) | — |
| chokidar | 文件监听 (D-18) | NO | — | 需安装：`pnpm add chokidar` |
| vue-draggable-plus | 标签拖拽 (D-16) | NO | — | 可选，可用原生 Drag API 替代 |

**Missing dependencies with no fallback:**
- chokidar — 文件监听 (D-18) 必须安装

**Missing dependencies with fallback:**
- vue-draggable-plus — 标签拖拽 (D-16) 可用原生 HTML5 Drag API 替代

## Sources

### Primary (HIGH confidence)
- Codebase 直接审查：ChatPanel.vue, App.vue, Sidebar.vue, process-manager.ts, claude-webview.ts, session-store.ts, filesystem.ts, main.css, preload/index.ts — 全部关键文件已完整阅读
- Context7 /paulmillr/chokidar — chokidar v5 API 和事件监听模式 [VERIFIED]
- Context7 /alfred-skyblue/vue-draggable-plus — Vue 3 拖拽组件用法 [VERIFIED]
- npm registry — chokidar 5.0.0, vue-draggable-plus 0.6.1, pinia 3.0.4 版本确认 [VERIFIED]

### Secondary (MEDIUM confidence)
- CONTEXT.md — 用户决策约束和代码上下文洞察
- MDN iframe sandbox 文档 — `allow-same-origin` + `allow-scripts` 安全风险 [ASSUMED]

### Tertiary (LOW confidence)
- 无

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 所有库版本已通过 npm registry 验证，项目已有代码架构完全确认
- Architecture: HIGH — 24 项决策全部映射到具体文件和代码位置，无需猜测
- Pitfalls: HIGH — 基于 829 行 ChatPanel.vue 和 838 行 claude-webview.ts 的完整代码审查

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (稳定技术栈，30 天有效期合理)

---

## Project Constraints (from CLAUDE.md)

- 运行环境 Windows，使用 Windows 支持的脚本或命令
- 提交前必须通过 lint 与编译，保持 0 warning
- 新增或修改逻辑必须配套测试
- 提交消息遵循 Conventional Commits
- 使用中文进行代码注释
- 仅允许使用商业友好的第三方库（chokidar: MIT, vue-draggable-plus: MIT — 均合规）
- 涉及安全风险须主动提示（D-21~D-24 安全相关改动需特别注意）
