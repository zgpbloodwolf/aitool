# Phase 6: 知识管理 - Research

**Researched:** 2026-04-26
**Domain:** Electron + Vue 3 — 对话导出、剪贴板历史、收藏片段
**Confidence:** HIGH

## Summary

Phase 6 为 AI Tools 桌面客户端添加三个功能：对话导出为 Markdown 文件、剪贴板历史记录（内存 + 会话级）、收藏片段管理（localStorage 持久化）。这些功能均为渲染进程或 IPC 层的新增功能，不涉及核心架构变更。

**主要技术发现：**

1. **数据源已就绪** — `session-store.ts` 的 `getSessionMessages()` 已经能从 JSONL 读取 user/assistant/system 消息，导出功能可直接复用，仅需在主进程新增 `dialog:showSaveDialog` IPC handler 和 Markdown 格式化逻辑。
2. **IPC 模式成熟** — 项目已有完善的 `registerXxxHandlers()` + preload 桥接模式，新增导出和剪贴板相关 IPC 只需遵循现有约定。
3. **Pinia + localStorage 持久化模式可复用** — `settings.ts` 和 `workspace.ts` 展示了标准的 Pinia store + localStorage 持久化模式，收藏片段 store 可完全复用此模式。

**Primary recommendation:** 按三个功能模块分层实现——导出 IPC + 标签右键菜单（主进程 + ChatPanel）、剪贴板历史 store + 弹出面板（渲染进程新组件）、收藏片段 store + CRUD 管理（渲染进程新 store + UI）。所有新 UI 必须使用现有 CSS 变量体系。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 导出范围仅包含用户消息 + 助手回复，过滤掉 system 消息和工具调用细节
- **D-02:** 文件头部包含会话标题 + 导出日期（如 `# 对话标题\n> 导出于 2026-04-26`）
- **D-03:** 保留原始 Markdown 代码块和语言标识（```python...```），不做额外处理
- **D-04:** 默认文件名为「会话标题+日期」（如 `Claude-Code-对话-2026-04-26.md`），用户可在保存对话框中修改
- **D-05:** 存储策略为内存 + 会话内有效，关闭应用后清空
- **D-06:** 最大保留最近 50 条，超出后自动清除最早的记录
- **D-07:** 仅记录文本内容，不记录图片
- **D-08:** 使用 localStorage 存储收藏片段，复用现有 localStorage 模式
- **D-09:** 基础 CRUD 管理：创建、编辑（标题+内容）、删除、列表展示
- **D-10:** 片段来源：从剪贴板历史记录点「收藏」按钮提升，同时提供手动创建入口
- **D-11:** 「导出对话」仅通过标签右键菜单触发（右键标签 → 「导出对话」）
- **D-12:** 剪贴板面板快捷键 Ctrl+Shift+V 唤起，在设置中可配置快捷键
- **D-13:** 剪贴板面板为弹出面板形式（类似 VS Code 命令面板），出现在输入区域附近，选中后自动关闭
- **D-14:** 弹出面板内两个 Tab 切换：「历史」和「收藏」，统一入口

### Claude's Discretion
- 弹出面板的具体定位和动画效果
- 剪贴板历史记录的列表项预览截断长度
- 收藏片段的编辑对话框 UI 设计
- 标签右键菜单的视觉风格
- 导出进度的反馈方式（小 toast 或直接保存）

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UX-07 | 对话导出为 Markdown 格式 | 主进程 `session-store.ts` 已提供 `getSessionMessages()` 数据源，需新增 `dialog:showSaveDialog` IPC + Markdown 格式化逻辑（见架构模式 P1） |
| UX-08 | 剪贴板增强（历史记录 + 收藏片段） | 渲染进程新增 `useClipboardStore`（内存）和 `useSnippetStore`（localStorage），弹出面板组件参考 ConfirmDialog.vue 的 overlay + 动画模式 |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| JSONL 消息读取 + Markdown 格式化 | API / Backend (主进程) | — | `session-store.ts` 已在主进程，`writeFile` 需要 Node.js API |
| 保存文件对话框 | API / Backend (主进程) | — | Electron `dialog.showSaveDialog` 只能在主进程调用 |
| 标签右键菜单 | Browser / Client (渲染进程) | — | DOM `@contextmenu` 事件在 `ChatPanel.vue` 标签元素上 |
| 剪贴板历史存储 | Browser / Client (渲染进程) | — | 内存数据 + `navigator.clipboard` API，不需要主进程 |
| 收藏片段持久化 | Browser / Client (渲染进程) | — | localStorage 在渲染进程直接可用 |
| 剪贴板弹出面板 UI | Browser / Client (渲染进程) | — | 纯前端组件，类似 VS Code 命令面板 |
| 快捷键注册 | API / Backend (主进程) | Browser / Client (渲染进程) | Ctrl+Shift+V 需在主进程 `before-input-event` 拦截，通过 IPC 转发到渲染进程 |
| 导出快捷键 IPC | API / Backend (主进程) | Browser / Client (渲染进程) | 新增 `claude:export-session` IPC handler，从渲染进程触发 |

## Standard Stack

### Core — 无新增依赖

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| electron | 35.7.5 | `dialog.showSaveDialog`, `fs.writeFile` | 已有依赖，无新增 [VERIFIED: package.json] |
| vue | 3.5.25 | 组件、Composition API、`<script setup>` | 项目标准框架 [VERIFIED: package.json] |
| pinia | 3.0.4 | 剪贴板历史 store、收藏片段 store | 项目状态管理标准 [VERIFIED: package.json] |
| typescript | 5.9.3 | 类型安全 | 项目标准 [VERIFIED: package.json] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 2.1.9 | 单元测试 | 新增 store 和工具函数的测试 [VERIFIED: package.json] |
| @vue/test-utils | 2.4.8 | 组件测试 | 弹出面板组件测试 [VERIFIED: package.json] |
| happy-dom | 20.9.0 | 测试 DOM 环境 | vitest 配置使用 [VERIFIED: package.json] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 手写 Markdown 格式化 | markdown-it 等库渲染 | 不需要——消息内容本身已是 Markdown，只需拼接 |
| IndexedDB 存储片段 | localStorage | localStorage 简单够用，片段数据量小（50 条文本），不需要 IndexedDB 的异步复杂性 |
| Electron clipboard API | navigator.clipboard | navigator.clipboard 在渲染进程可直接用，无需 IPC 桥接 |

**Installation:** 无需安装新依赖。

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         渲染进程 (Vue 3)                          │
│                                                                  │
│  ┌────────────────────────────────────────────┐                  │
│  │           ChatPanel.vue                     │                  │
│  │  ┌──────────┐    ┌─────────────────────┐   │                  │
│  │  │ 标签栏    │    │  剪贴板弹出面板      │   │                  │
│  │  │@contextmenu──→│  ┌─────┐ ┌────────┐ │   │                  │
│  │  │ → 右键菜单│    │  │历史 │ │ 收藏   │ │   │                  │
│  │  └──────────┘    │  │Tab  │ │ Tab    │ │   │                  │
│  │                   │  └─────┘ └────────┘ │   │                  │
│  │                   └─────────────────────┘   │                  │
│  └────────────────────────────────────────────┘                  │
│           │                        │                             │
│           │ IPC: export-session    │ Pinia stores (内存/localStorage) │
│           ▼                        ▼                             │
│  ┌─────────────────┐   ┌───────────────────┐                    │
│  │ preload API 桥接  │   │ useClipboardStore │ (内存, 50条上限)   │
│  └────────┬────────┘   │ useSnippetStore   │ (localStorage)     │
│           │            └───────────────────┘                    │
└───────────┼──────────────────────────────────────────────────────┘
            │ IPC invoke/send
┌───────────▼──────────────────────────────────────────────────────┐
│                      主进程 (Electron)                            │
│                                                                  │
│  ┌──────────────────────┐   ┌───────────────────────────┐       │
│  │ dialog.ts            │   │ session-store.ts           │       │
│  │ + showSaveDialog()   │   │ getSessionMessages()      │       │
│  └──────────┬───────────┘   │ → 读取 JSONL              │       │
│             │               └───────────┬───────────────┘       │
│             ▼                           │                       │
│  ┌──────────────────────┐               │                       │
│  │ fs.writeFile         │◄──────────────┘                       │
│  │ → 保存 .md 文件       │  格式化: 过滤 system/tool_use → MD    │
│  └──────────────────────┘                                       │
│                                                                  │
│  ┌──────────────────────┐                                        │
│  │ index.ts             │                                        │
│  │ + before-input-event │                                        │
│  │   Ctrl+Shift+V       │──→ IPC: shortcut:clipboard-panel      │
│  └──────────────────────┘                                        │
└──────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── main/
│   ├── ipc/
│   │   ├── dialog.ts           # [修改] 新增 dialog:showSaveDialog handler
│   │   └── claude-webview.ts   # [修改] 新增 claude:export-session handler
│   ├── claude/
│   │   └── session-store.ts    # [修改] 新增 getActiveSessionId() 辅助函数
│   └── index.ts                # [修改] 注册 Ctrl+Shift+V 快捷键拦截
├── preload/
│   ├── index.ts                # [修改] 新增 exportSession + showSaveDialog API
│   └── index.d.ts              # [修改] 同步类型声明
├── shared/
│   └── types.ts                # [修改] 新增 ExportSessionResult 类型
├── renderer/src/
│   ├── components/
│   │   ├── ChatPanel.vue       # [修改] 标签右键菜单 + 剪贴板面板集成
│   │   ├── ContextMenu.vue     # [新增] 通用右键菜单组件
│   │   └── ClipboardPanel.vue  # [新增] 剪贴板弹出面板（历史+收藏 Tab）
│   ├── stores/
│   │   ├── clipboard.ts        # [新增] 剪贴板历史 store（内存，50 条上限）
│   │   └── snippet.ts          # [新增] 收藏片段 store（localStorage）
│   ├── composables/
│   │   └── useClipboard.ts     # [新增] 剪贴板监听 composable
│   └── assets/
│       └── main.css            # [修改] 新增弹出面板相关 CSS 变量（如需要）
```

### Pattern 1: IPC Handler 注册模式
**What:** 主进程注册 IPC handler，preload 暴露 API，渲染进程通过 `window.api.*` 调用
**When to use:** 所有需要主进程能力的操作（文件保存、系统对话框等）
**Example:**
```typescript
// src/main/ipc/dialog.ts — 参考现有 dialog:selectFolder
ipcMain.handle('dialog:showSaveDialog', async (_event, options: {
  defaultPath: string
  title: string
}) => {
  const window = BrowserWindow.getFocusedWindow()
  if (!window) return { canceled: true, filePath: '' }
  const result = await dialog.showSaveDialog(window, {
    title: options.title,
    defaultPath: options.defaultPath,
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  })
  return { canceled: result.canceled, filePath: result.filePath || '' }
})

// src/preload/index.ts — 暴露 API
exportSession: (sessionId: string, title: string): Promise<{ success: boolean; error?: string }> =>
  ipcRenderer.invoke('claude:export-session', sessionId, title),
showSaveDialog: (options: { defaultPath: string; title: string }): Promise<{ canceled: boolean; filePath: string }> =>
  ipcRenderer.invoke('dialog:showSaveDialog', options),
```
**Source:** [VERIFIED: src/main/ipc/dialog.ts 现有 selectFolder handler 模式]

### Pattern 2: Pinia Store + localStorage 持久化
**What:** Pinia composition API store，深度 watch 自动写入 localStorage
**When to use:** 收藏片段等需要持久化的渲染进程状态
**Example:**
```typescript
// src/renderer/src/stores/snippet.ts — 复用 settings.ts 的模式
const SNIPPETS_KEY = 'aitools-snippets'

export const useSnippetStore = defineStore('snippet', () => {
  const raw = localStorage.getItem(SNIPPETS_KEY)
  const initial: Snippet[] = raw ? safeParse(raw) : []

  const snippets = ref<Snippet[]>(initial)

  watch(snippets, (newVal) => {
    localStorage.setItem(SNIPPETS_KEY, JSON.stringify(newVal))
  }, { deep: true })

  // CRUD: addSnippet, updateSnippet, deleteSnippet, getSnippet
  // ...
})
```
**Source:** [VERIFIED: src/renderer/src/stores/settings.ts 第 130-138 行 watch + localStorage 模式]

### Pattern 3: 全局快捷键拦截模式
**What:** 主进程 `before-input-event` 拦截快捷键，通过 IPC 发送到渲染进程
**When to use:** 需要 iframe 焦点时也能触发的快捷键
**Example:**
```typescript
// src/main/index.ts — 参考现有快捷键拦截（第 87-106 行）
mainWindow.webContents.on('before-input-event', (event, input) => {
  // Ctrl+Shift+V — 剪贴板面板
  if (input.control && input.shift && input.key.toLowerCase() === 'v') {
    event.preventDefault()
    mainWindow.webContents.send('shortcut:clipboard-panel')
    return
  }
  // ... 其他快捷键
})

// src/preload/index.ts — 渲染进程监听
onShortcut: (callback: (action: string) => void): (() => void) => {
  const channels = [
    'shortcut:new-tab', 'shortcut:close-tab', 'shortcut:toggle-sidebar',
    'shortcut:next-tab', 'shortcut:prev-tab', 'shortcut:open-settings',
    'shortcut:reset-zoom', 'shortcut:clipboard-panel'  // 新增
  ]
  // ...
}
```
**Source:** [VERIFIED: src/main/index.ts 第 87-106 行 before-input-event 模式]

### Pattern 4: Overlay/弹出面板组件模式
**What:** 使用 `<Transition>` + fixed 定位实现弹出面板，参考现有 session-history 和 ConfirmDialog
**When to use:** 剪贴板弹出面板、右键菜单等临时 UI
**Example:**
```vue
<!-- 参考现有 session-history-overlay 模式 -->
<Transition name="panel-fade">
  <div v-if="clipboardPanelVisible" class="clipboard-panel-overlay">
    <div class="clipboard-panel">
      <!-- Tab 切换：历史 / 收藏 -->
      <!-- 列表内容 -->
    </div>
  </div>
</Transition>
```
**Source:** [VERIFIED: src/renderer/src/components/ChatPanel.vue 第 786-827 行 session-history 面板]

### Anti-Patterns to Avoid

- **在渲染进程直接写文件**：Electron 安全模型要求文件操作在主进程完成，渲染进程通过 IPC 触发
- **剪贴板历史用 localStorage 持久化**：D-05 明确指定内存 + 会话级，关闭后清空，不要画蛇添足
- **硬编码颜色值**：所有新增 UI 必须使用 `var(--*)` CSS 变量体系，遵循 Catppuccin Mocha/Latte 双主题
- **在 ChatPanel.vue 中堆砌所有逻辑**：剪贴板面板和右键菜单应拆分为独立组件，ChatPanel 只负责集成
- **忽略 iframe 焦点问题**：Ctrl+Shift+V 必须在主进程拦截（参考 D-05 的 before-input-event 模式），渲染进程 keydown 事件在 iframe 焦点时不会触发

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 文件保存对话框 | 自定义文件选择 UI | Electron `dialog.showSaveDialog()` | 系统原生对话框，用户熟悉，支持文件路径/覆盖确认 |
| 消息格式化 | 自定义模板引擎 | 简单字符串拼接 | JSONL 消息内容已是 Markdown，只需过滤 + 拼接 |
| 剪贴板监听 | 轮询 clipboard | `navigator.clipboard.readText()` + 用户操作触发 | 浏览器安全模型限制后台读取剪贴板，应在用户操作时记录 |
| 拖拽排序 | 自定义拖拽库 | HTML5 Drag & Drop API | 项目已有拖拽排序实现（D-16 tab 拖拽），无新依赖 |

**Key insight:** 这个阶段的所有功能都可以用 Electron 内置 API + Vue 3 + Pinia 实现，无需引入任何新的第三方依赖。

## Common Pitfalls

### Pitfall 1: JSONL 消息中 assistant content 包含 tool_use block
**What goes wrong:** 直接拼接 `content` 所有 block 的 text 会包含工具调用的 JSON 数据
**Why it happens:** assistant 消息的 content 是数组，包含 `text`、`tool_use`、`thinking` 等多种 block 类型
**How to avoid:** D-01 要求过滤工具调用细节，遍历 content 数组时只处理 `type === 'text'` 的 block，跳过 `tool_use` 和 `thinking`
**Warning signs:** 导出的 Markdown 中出现大量 JSON 格式的工具调用参数

### Pitfall 2: navigator.clipboard 在无用户手势时拒绝读取
**What goes wrong:** 尝试后台监听剪贴板变化失败，`navigator.clipboard.readText()` 返回 reject
**Why it happens:** 浏览器安全策略要求剪贴板读取必须在用户手势（click/keydown）的回调中
**How to avoid:** 不做后台剪贴板监听，而是在用户明确的操作时刻（如 Ctrl+C 复制文本后、或在面板中点击粘贴按钮）记录到历史
**Warning signs:** `DOMException: Document is not focused` 或 `NotAllowedError`

### Pitfall 3: 标签右键菜单定位不准确
**What goes wrong:** 自定义右键菜单位置偏移或超出屏幕
**Why it happens:** 使用 `event.clientX/Y` 未考虑菜单自身尺寸和窗口边界
**How to avoid:** 计算菜单位置时检查 `window.innerWidth/innerHeight`，超出边界时反转方向
**Warning signs:** 右键标签时菜单显示不全或超出可视区域

### Pitfall 4: 导出大量消息时 UI 卡顿
**What goes wrong:** 会话包含数百条消息，格式化和写入文件时渲染进程卡死
**Why it happens:** IPC invoke 是异步的，但主进程的 `getSessionMessages` + 格式化 + `writeFile` 是同步操作链
**How to avoid:** 主进程端处理所有繁重操作（格式化 + 写文件），渲染进程只显示简单的 loading 状态。对于异常大的会话（>1000 条），可以考虑在导出时显示进度反馈
**Warning signs:** 导出操作时 UI 短暂冻结

### Pitfall 5: 剪贴板弹出面板被 iframe 遮挡
**What goes wrong:** 弹出面板的 z-index 低于 iframe，或 iframe 拦截了键盘事件
**Why it happens:** iframe 有独立的文档层级，且会捕获键盘事件
**How to avoid:** 弹出面板使用 `position: fixed` + 高 `z-index`（参考 session-history 的 z-index: 20），且快捷键在主进程 before-input-event 拦截
**Warning signs:** Ctrl+Shift+V 有时触发有时不触发（取决于焦点在 iframe 内还是外）

### Pitfall 6: 导出时的 sessionId 获取
**What goes wrong:** 无法确定当前标签对应的会话 ID
**Why it happens:** 标签的 tabId 是前端生成的 `session-${Date.now()}-N`，与 JSONL 文件的 sessionId（UUID）不同
**How to avoid:** 从 `channelToTab` 映射反向查找 channelId，然后从 channel 的 `lastSessionId` 获取。或者通过 `update_session_state` 中的 `session_id` 字段提取。需要新增 IPC 或在 ChatPanel 中跟踪 sessionId
**Warning signs:** 导出时找不到对应的 JSONL 文件

## Code Examples

### 对话导出 Markdown 格式化
```typescript
// 来源: 基于 session-store.ts getSessionMessages() 返回结构分析
// [VERIFIED: session-store.ts + claude-webview.ts 消息处理逻辑]

interface JsonlMessage {
  type: 'user' | 'assistant' | 'system'
  isSidechain?: boolean
  isMeta?: boolean
  message?: {
    role: string
    content?: Array<{
      type: 'text' | 'tool_use' | 'thinking' | 'tool_result'
      text?: string
      name?: string
      input?: unknown
    }>
  }
}

function formatMessagesAsMarkdown(
  messages: JsonlMessage[],
  title: string,
  date: string
): string {
  const lines: string[] = []
  // D-02: 文件头
  lines.push(`# ${title}`)
  lines.push(`> 导出于 ${date}`)
  lines.push('')

  for (const msg of messages) {
    // D-01: 过滤 system 消息
    if (msg.type === 'system') continue
    if (msg.isSidechain || msg.isMeta) continue

    const content = msg.message?.content
    if (!Array.isArray(content)) continue

    if (msg.type === 'user') {
      lines.push('## 用户')
      lines.push('')
      for (const block of content) {
        // D-01: 只保留 text block
        if (block.type === 'text' && block.text) {
          lines.push(block.text)
        }
      }
      lines.push('')
    } else if (msg.type === 'assistant') {
      lines.push('## 助手')
      lines.push('')
      for (const block of content) {
        // D-01: 过滤 tool_use 和 thinking
        if (block.type === 'text' && block.text) {
          // D-03: 保留原始 Markdown 代码块
          lines.push(block.text)
        }
        // tool_use block 跳过（D-01）
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}
```

### 剪贴板历史 Store（内存 + 50 条上限）
```typescript
// 来源: 参考 settings.ts 的 Pinia composition API 模式
// [VERIFIED: src/renderer/src/stores/settings.ts]

interface ClipboardEntry {
  id: string
  text: string
  timestamp: number
}

export const useClipboardStore = defineStore('clipboard', () => {
  // D-05: 内存存储，关闭后清空
  const history = ref<ClipboardEntry[]>([])
  // D-06: 最大 50 条
  const MAX_ENTRIES = 50

  function addEntry(text: string): void {
    // D-07: 仅记录文本
    if (!text.trim()) return
    // 去重：相同文本不重复添加
    const existing = history.value.findIndex(e => e.text === text)
    if (existing !== -1) {
      history.value.splice(existing, 1)
    }
    history.value.unshift({
      id: `clip_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      text,
      timestamp: Date.now()
    })
    // D-06: 超出上限自动清除最早的
    if (history.value.length > MAX_ENTRIES) {
      history.value = history.value.slice(0, MAX_ENTRIES)
    }
  }

  function removeEntry(id: string): void {
    history.value = history.value.filter(e => e.id !== id)
  }

  function clearAll(): void {
    history.value = []
  }

  return { history, addEntry, removeEntry, clearAll }
})
```

### 收藏片段 Store（localStorage 持久化）
```typescript
// 来源: 复用 settings.ts 的 localStorage + watch 模式
// [VERIFIED: src/renderer/src/stores/settings.ts 第 130-138 行]

interface Snippet {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
}

const SNIPPETS_KEY = 'aitools-snippets'

export const useSnippetStore = defineStore('snippet', () => {
  const raw = localStorage.getItem(SNIPPETS_KEY)
  const snippets = ref<Snippet[]>(raw ? safeParse(raw) : [])

  // 自动持久化
  watch(snippets, (newVal) => {
    localStorage.setItem(SNIPPETS_KEY, JSON.stringify(newVal))
  }, { deep: true })

  function addSnippet(title: string, content: string): void {
    snippets.value.unshift({
      id: `snippet_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      title,
      content,
      createdAt: Date.now(),
      updatedAt: Date.now()
    })
  }

  // D-10: 从剪贴板历史提升
  function promoteFromClipboard(text: string, title?: string): void {
    addSnippet(title || text.slice(0, 30), text)
  }

  function updateSnippet(id: string, patch: Partial<Pick<Snippet, 'title' | 'content'>>): void {
    const idx = snippets.value.findIndex(s => s.id === id)
    if (idx === -1) return
    snippets.value[idx] = {
      ...snippets.value[idx],
      ...patch,
      updatedAt: Date.now()
    }
  }

  function deleteSnippet(id: string): void {
    snippets.value = snippets.value.filter(s => s.id !== id)
  }

  function safeParse(raw: string): Snippet[] {
    try { return JSON.parse(raw) } catch { return [] }
  }

  return { snippets, addSnippet, promoteFromClipboard, updateSnippet, deleteSnippet }
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Electron `remote` 模块 | IPC + contextBridge | Electron 14+ (2021) | 所有主进程操作必须通过 IPC，渲染进程不能直接调用 Node.js API |
| Options API Store | Composition API + `<script setup>` | Vue 3 (2020) | 本项目统一使用 Composition API |
| Vuex | Pinia | Vue 3 生态标准 (2022+) | 本项目已使用 Pinia 3.x |

**Deprecated/outdated:**
- Electron `remote` 模块: 安全风险，已被废弃。文件对话框必须通过 IPC
- `document.execCommand('copy')`: 已废弃，使用 `navigator.clipboard.writeText()`

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | JSONL 中 assistant 消息的 content 数组仅包含 `text`、`tool_use`、`thinking` 三种 block type | 导出格式化 | 可能遗漏其他 block type，导致导出内容不完整 |
| A2 | 标签对应的 sessionId 可通过 channel 的 `lastSessionId` 或 `update_session_state` 中的 `session_id` 获取 | 导出功能 | 如果无法获取 sessionId，导出功能无法定位 JSONL 文件 |
| A3 | `navigator.clipboard.readText()` 在 Electron 渲染进程中有用户手势时可用 | 剪贴板历史 | 如果 Electron 限制了此 API，需要改用 Electron clipboard API 通过 IPC |
| A4 | 当前 `getSessionMessages()` 返回的 user/assistant 消息中 `message.content` 始终是数组 | 导出格式化 | 某些消息可能 content 为字符串或其他格式 |

## Open Questions

1. **如何获取当前活跃标签的 sessionId？**
   - What we know: `channelToTab` 映射 channelId → tabId，但 tabId ≠ sessionId。channel 对象有 `lastSessionId` 但仅在主进程可访问。
   - What's unclear: 渲染进程如何获取当前标签对应的 JSONL sessionId。
   - Recommendation: 两种方案——(a) 新增 IPC handler `claude:get-active-session-id` 让渲染进程查询主进程；(b) 从 webview 的 `update_session_state` 消息中提取 `session_id` 并在 ChatPanel 中缓存。方案 (a) 更可靠。

2. **剪贴板内容何时记录到历史？**
   - What we know: D-07 仅记录文本，D-05 会话级有效。
   - What's unclear: 触发时机——是在用户复制时自动记录，还是用户打开面板时记录？
   - Recommendation: 在用户明确的复制操作时记录（如用户在面板中粘贴后自动捕获，或通过菜单按钮手动添加）。由于 `clipboardchange` 事件浏览器兼容性有限，建议在面板打开时调用 `navigator.clipboard.readText()` 读取当前剪贴板内容作为快捷入口。

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Electron | 文件对话框、clipboard | ✓ | 35.7.5 | — |
| Node.js fs | 写入 Markdown 文件 | ✓ | — | — |
| Vue 3 | 组件、Composition API | ✓ | 3.5.25 | — |
| Pinia | 状态管理 | ✓ | 3.0.4 | — |
| vitest | 单元测试 | ✓ | 2.1.9 | — |
| navigator.clipboard | 剪贴板读取 | ✓ | Electron 35.x 支持 | — |

**Missing dependencies with no fallback:** 无

**Missing dependencies with fallback:** 无

## Sources

### Primary (HIGH confidence)
- 代码审查: `src/main/ipc/dialog.ts` — 现有 IPC handler 注册模式
- 代码审查: `src/main/claude/session-store.ts` — getSessionMessages() 数据结构和 JSONL 读取逻辑
- 代码审查: `src/renderer/src/stores/settings.ts` — Pinia + localStorage 持久化模式
- 代码审查: `src/main/index.ts` — 全局快捷键拦截 before-input-event 模式
- 代码审查: `src/renderer/src/components/ChatPanel.vue` — 标签栏结构、iframe 容器、现有 overlay 面板模式
- 代码审查: `package.json` — 所有依赖版本确认

### Secondary (MEDIUM confidence)
- 代码审查: `src/renderer/src/components/ConfirmDialog.vue` — 模态对话框组件模式参考
- 代码审查: `src/renderer/src/stores/workspace.ts` — localStorage 持久化 + 数据迁移模式参考
- 代码审查: `src/renderer/src/App.vue` — 全局快捷键处理和 ChatPanel ref 模式

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 无新增依赖，全部使用项目已有技术栈
- Architecture: HIGH — 所有模式均有项目内现有代码参考
- Pitfalls: HIGH — 基于代码实际结构分析得出，特别是 JSONL 消息格式和 iframe 焦点问题

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 (Electron/Vue API 稳定，30 天有效期)
