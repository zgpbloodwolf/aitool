# Phase 8: 高级特性 - Research

**Researched:** 2026-04-28
**Domain:** Electron 多窗口管理 + 对话分支系统
**Confidence:** MEDIUM

## Summary

Phase 8 需要在现有 Electron 单窗口架构上构建两个独立但相关的功能：(1) 多窗口支持（拖拽标签页出窗口边界创建新窗口），(2) 对话分支（从任意历史消息创建分支对话，每个分支作为新标签页）。当前代码库采用单 `BrowserWindow` 架构，所有频道状态集中在 `claude-webview.ts` 的 `channels` Map 中，所有 webview iframe 在单一渲染进程内通过 `ChatPanel.vue` 管理。

多窗口实现需要引入 `WindowManager` 模块，将 `createWindow()` 重构为工厂模式，并在主进程中维护窗口-频道-标签页的映射关系。核心挑战在于：(a) 拖拽标签页出窗口边界需要通过 `screen.getCursorScreenPoint()` 追踪鼠标全局位置，(b) webview iframe 无法直接跨窗口迁移（每个窗口有自己的渲染进程），需要通过新建频道和 webview 实例并重放历史消息来实现状态迁移。

对话分支实现需要：读取 JSONL 会话历史到分支点，创建新的 Claude CLI 进程并注入分支点上下文，在 webview 中通过 `postMessage` 注入分支按钮 UI，并维护分支关系元数据。由于 webview 是 Claude Code VS Code 扩展的内部渲染（通过 iframe 加载），分支按钮需要通过 DOM 注入 + `postMessage` 通信模式实现。

**Primary recommendation:** 将多窗口和分支作为两个独立子系统实现，通过 `WindowManager` 和 `BranchManager` 两个主进程模块分别管理，共享一个统一的 `WindowChannelRegistry` 数据结构来维护窗口-频道-标签页的映射。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 多窗口同架构方案 -- 每个窗口是独立的 `BrowserWindow`，加载同一个 renderer，各自拥有独立的 Pinia 状态。主进程新增 `WindowManager` 统一管理窗口生命周期、通知路由、主题同步。
- **D-02:** 窗口创建方式为拖拽标签页出窗口边界时自动创建新窗口（类似 Chrome 拖拽标签行为）。检测鼠标超出当前窗口边界时创建半透明预览窗口，松手确认后正式创建。
- **D-03:** 保持 `requestSingleInstanceLock` 单实例行为不变。多窗口是应用内部的多 `BrowserWindow` 管理，不涉及多进程。
- **D-04:** 不记忆窗口布局 -- 新窗口居中显示，关闭应用后再次打开只恢复单个默认窗口。
- **D-05:** 通知精准路由到目标窗口 -- 每个通知发送到拥有该会话/标签页的窗口，其他窗口不受影响。
- **D-06:** 主题变更时所有窗口同步更新 -- 任一窗口切换主题，其他窗口立即响应。
- **D-07:** 分支触发方式为消息旁分支按钮 -- 每条用户消息右侧出现分支图标，点击后从该消息创建新分支。
- **D-08:** 分支可视化采用内联分支指示器 -- 分叉点在消息流中显示"N 个分支"标签，点击展开分支列表选择切换。不占用额外面板空间。
- **D-09:** 每个分支作为独立标签页展示 -- 标签上标注分支来源（如"分支 #1"），切换分支即切换标签页。
- **D-10:** 新分支创建新的 Claude CLI 会话（新 session_id）-- 分支点的上下文作为新会话的历史注入。与现有 CLI 集成完全兼容，不修改 JSONL 文件。
- **D-11:** 分支命名采用自动编号 + 可重命名 -- 默认"分支 #1"、"分支 #2"等，用户可在标签右键菜单中重命名。
- **D-12:** 每个会话限制 N 个分支数量，超出后提示用户关闭旧分支。N 值由 Claude 决定（建议 10）。

### Claude's Discretion
- WindowManager 的具体 API 设计和内部状态结构
- 拖拽检测的实现细节（鼠标移动阈值、预览窗口样式）
- 分支按钮的视觉样式（图标、悬停效果）
- 内联分支指示器的展开/收起动画
- 分支点上下文注入到新 CLI 会话的具体格式
- 标签页上分支来源信息的展示格式
- 窗口间主题同步的 IPC 通信细节
- 半透明预览窗口的具体样式和位置
- N 值的具体取值（建议 10）

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UX-11 | 多窗口支持（拖拽标签页创建新窗口） | 见"多窗口实现方案"和"标签拖拽出窗口检测" |
| UX-12 | 对话分支（从任意消息创建分支、分支指示器、独立标签页） | 见"对话分支数据模型"和"分支 UI 实现方案" |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 窗口生命周期管理 | Main Process | -- | BrowserWindow 创建/销毁是主进程职责 |
| 窗口-频道映射 | Main Process | -- | 跨窗口通知路由需要主进程作为中介 |
| 拖拽出窗口检测 | Main Process | Renderer Process | 渲染进程检测 dragstart/dragleave，主进程追踪全局鼠标坐标 |
| 预览窗口管理 | Main Process | -- | 半透明 BrowserWindow 由主进程创建 |
| 主题同步广播 | Main Process | -- | nativeTheme 监听 + 遍历所有窗口发送 |
| 通知路由 | Main Process | -- | 根据频道归属查询目标窗口发送 |
| 标签页 CRUD | Renderer Process | -- | ChatPanel.vue 已有标签管理逻辑 |
| 分支按钮 UI | Webview (iframe 内) | Main Process | 通过 DOM 注入 + postMessage 实现 |
| 分支元数据存储 | Main Process | -- | 分支关系需要持久化，跨窗口共享 |
| 频道/CLI 进程管理 | Main Process | -- | ClaudeProcessManager 已在主进程 |
| 分支上下文注入 | Main Process | -- | 读取 JSONL + 构造历史消息 |
| 内联分支指示器 | Webview (iframe 内) | -- | DOM 注入到 webview 消息流中 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron | ^35.7.5 | 桌面应用框架 | 项目已有依赖，支持 BrowserWindow 多实例 |
| Vue 3 | ^3.5.25 | UI 框架 | 项目已有依赖，Composition API |
| Pinia | ^3.0.4 | 状态管理 | 项目已有依赖，每窗口独立 store |
| TypeScript | ^5.9.3 | 类型安全 | 项目已有依赖 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| electron/screen API | 内置 | 全局鼠标坐标追踪 | 拖拽标签出窗口时获取鼠标屏幕位置 |
| electron/nativeTheme | 内置 | 系统主题检测 | 主题变更时广播到所有窗口 |
| Node.js fs | 内置 | 分支元数据持久化 | 存储分支关系到 JSON 文件 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 自定义 WindowManager | electron-windows-state 第三方库 | 第三方库增加依赖，且本项目不需要记忆窗口布局（D-04），自制更灵活 |
| JSON 文件存储分支元数据 | SQLite | 项目不需要关系查询，JSON 文件足够简单可靠 |
| UUID 分支 ID | 自增数字 ID | UUID 避免跨窗口冲突，且与 session_id 格式一致 |

**Installation:**
```bash
# 无需安装新依赖 — 所有功能基于 Electron 内置 API 和现有依赖实现
```

## Architecture Patterns

### System Architecture Diagram

```
                    ┌──────────────────────────────────────────────────┐
                    │                   Main Process                    │
                    │                                                    │
                    │  ┌──────────────┐   ┌─────────────────────────┐  │
                    │  │ WindowManager│   │ WindowChannelRegistry   │  │
                    │  │              │   │                         │  │
                    │  │ - windows    │   │ windowId → channelId[]  │  │
                    │  │ - create()   │   │ channelId → windowId    │  │
                    │  │ - close()    │   │ tabId → channelId       │  │
                    │  └──────┬───────┘   └──────────┬──────────────┘  │
                    │         │                      │                  │
                    │         │    ┌─────────────────┘                  │
                    │         │    │                                     │
                    │  ┌──────▼────▼─────┐   ┌──────────────────────┐  │
                    │  │  claude-webview  │   │   BranchManager      │  │
                    │  │  (channels Map)  │   │                      │  │
                    │  │                  │   │ - branchMeta JSON    │  │
                    │  │  sendToWebview() │   │ - createBranch()     │  │
                    │  │  → route by      │   │ - injectContext()    │  │
                    │  │    windowId      │   │ - getBranches()      │  │
                    │  └──────────────────┘   └──────────────────────┘  │
                    │           │                         │              │
                    └───────────┼─────────────────────────┼──────────────┘
                                │ IPC                      │ IPC
                 ┌──────────────┼──────────────────────────┼────────────┐
                 │              │                          │            │
        ┌────────▼───────┐    ┌▼───────────────┐   ┌──────▼──────────┐ │
        │  Window 1      │    │  Window 2      │   │  Ghost Window   │ │
        │  (BrowserWin)  │    │  (BrowserWin)  │   │  (预览窗口)     │ │
        │                │    │                │   │                  │ │
        │  ChatPanel.vue │    │  ChatPanel.vue │   │  半透明跟随鼠标  │ │
        │  ┌─Tab1 ─┐    │    │  ┌─Tab3 ─┐    │   └──────────────────┘ │
        │  │iframe │    │    │  │iframe │    │                         │
        │  └───────┘    │    │  └───────┘    │                         │
        │  ┌─Tab2 ─┐    │    └────────────────┘                         │
        │  │iframe │    │                                                │
        │  └───────┘    │                                                │
        └────────────────┘                                                │
                                                                          │
        数据流：                                                            │
        1. 拖拽 Tab2 → mouseleave → 主进程轮询 screen.getCursorScreenPoint │
        2. 创建 ghost window 跟随鼠标                                       │
        3. mouseup → 销毁 ghost → 创建新 BrowserWindow                     │
        4. 迁移 Tab2 的频道到新窗口（关闭旧频道 + 新窗口创建新频道）          │
        5. 新频道用 --resume 恢复会话（保持上下文连续）                      │
```

### Recommended Project Structure
```
src/
├── main/
│   ├── window/
│   │   ├── window-manager.ts      # WindowManager 类 — 窗口生命周期管理
│   │   └── window-registry.ts     # WindowChannelRegistry — 窗口-频道映射
│   ├── claude/
│   │   ├── branch-manager.ts      # BranchManager — 分支创建、元数据、上下文注入
│   │   ├── branch-store.ts        # 分支元数据持久化（JSON 文件）
│   │   ├── session-store.ts       # (已有) 会话 JSONL 读取
│   │   └── process-manager.ts     # (已有) CLI 进程管理
│   ├── ipc/
│   │   ├── claude-webview.ts      # (改造) sendToWebview 按 windowId 路由
│   │   └── window-handlers.ts     # 新增窗口管理 IPC（创建/关闭/拖拽状态）
│   ├── notification/
│   │   └── notification-manager.ts # (改造) 多窗口通知路由
│   └── index.ts                    # (改造) createWindow → WindowManager
├── renderer/
│   └── src/
│       └── components/
│           ├── ChatPanel.vue       # (改造) 拖拽出窗口检测 + 分支标签
│           └── BranchIndicator.vue # 新增 — 内联分支指示器组件
├── preload/
│   └── index.ts                    # (扩展) 窗口管理 + 分支相关 IPC
└── shared/
    └── types.ts                    # (扩展) 分支相关类型定义
```

### Pattern 1: WindowManager 工厂模式
**What:** 将 `createWindow()` 重构为 `WindowManager` 类方法，统一管理所有 BrowserWindow 实例。
**When to use:** 创建新窗口（初始窗口 + 拖拽创建 + 分支创建）。
**Example:**
```typescript
// src/main/window/window-manager.ts
class WindowManager {
  private windows = new Map<number, BrowserWindow>()
  private registry: WindowChannelRegistry

  constructor() {
    this.registry = new WindowChannelRegistry()
  }

  /** 创建新窗口（通用工厂方法） */
  createWindow(options?: { x?: number; y?: number; width?: number; height?: number }): BrowserWindow {
    const win = new BrowserWindow({
      width: options?.width ?? 1200,
      height: options?.height ?? 800,
      x: options?.x,
      y: options?.y,
      // ... 复用现有 createWindow 的 webPreferences
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: true
      }
    })
    this.windows.set(win.id, win)
    this.registry.registerWindow(win.id)

    // 窗口关闭时清理
    win.on('closed', () => {
      this.handleWindowClosed(win.id)
    })

    return win
  }

  /** 获取拥有指定频道的窗口 */
  getWindowByChannel(channelId: string): BrowserWindow | undefined {
    const windowId = this.registry.getWindowIdByChannel(channelId)
    if (windowId == null) return undefined
    return this.windows.get(windowId)
  }

  /** 广播消息到所有窗口 */
  broadcastToAll(channel: string, data: unknown): void {
    for (const win of this.windows.values()) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, data)
      }
    }
  }
}
```

### Pattern 2: 拖拽出窗口检测
**What:** 渲染进程检测标签拖拽离开窗口边界，通知主进程追踪全局鼠标。
**When to use:** 用户拖拽标签页时。
**Example:**
```typescript
// 渲染进程 — ChatPanel.vue
// 检测鼠标离开窗口边界
function onDragOver(e: DragEvent): void {
  // 检查鼠标是否接近窗口边缘
  const margin = 20
  const nearEdge = e.clientX < margin || e.clientX > window.innerWidth - margin ||
                   e.clientY < margin || e.clientY > window.innerHeight - margin
  if (nearEdge && draggedTabId.value) {
    // 通知主进程开始全局鼠标追踪
    window.api.send('tab-drag:start', {
      tabId: draggedTabId.value,
      channelId: getChannelIdByTabId(draggedTabId.value)
    })
  }
}

// 主进程 — window-manager.ts
ipcMain.on('tab-drag:start', (_event, data) => {
  startDragTracking(data.tabId, data.channelId)
})

function startDragTracking(tabId: string, channelId: string): void {
  // 创建半透明预览窗口
  const ghost = new BrowserWindow({
    width: 300, height: 200,
    transparent: true, opacity: 0.7,
    frame: false, alwaysOnTop: true,
    focusable: false, skipTaskbar: true
  })
  ghost.loadURL('about:blank')

  // 轮询全局鼠标位置
  const tracker = setInterval(() => {
    const point = screen.getCursorScreenPoint()
    ghost.setPosition(point.x - 150, point.y - 20)
  }, 16) // ~60fps

  // 全局 mouseup 检测 — 通过 ghost 窗口捕获
  // 实际在 Windows 上使用全局钩子或轮询 mouse button 状态
  // 简化方案：检测鼠标按钮释放
  const buttonTracker = setInterval(() => {
    // screen 没有直接检测鼠标按钮的 API
    // 替代方案：在 ghost 窗口监听 mouseup 事件
  }, 50)
}
```
**注意：** Windows 上检测全局 mouseup 的可靠方案是在 ghost 窗口设置 `setIgnoreMouseEvents(false)` 并监听 `mouse-up` 事件，或者使用 `win.hookWindowMessage` 捕获系统级鼠标事件。 [ASSUMED]

### Pattern 3: 分支上下文注入
**What:** 读取 JSONL 会话历史到分支点，构造用户/助手消息序列，注入新 CLI 会话。
**When to use:** 用户点击消息旁的分支按钮时。
**Example:**
```typescript
// src/main/claude/branch-manager.ts
async function createBranchFromMessage(
  parentSessionId: string,
  branchPointMessageIndex: number,
  cwd: string
): Promise<{ channelId: string; branchId: string }> {
  // 1. 读取父会话所有消息
  const messages = await getSessionMessages(parentSessionId, cwd)

  // 2. 截取到分支点（包含分支点消息）
  const branchMessages = messages.slice(0, branchPointMessageIndex + 1)

  // 3. 创建新频道和 CLI 进程
  const channelId = `ch_${Date.now()}_${Math.random().toString(36).slice(2)}`
  await handleLaunchClaude(channelId, cwd, 'default', '')

  // 4. 等待 CLI 初始化完成后，逐条注入历史消息
  // 不通过 stdin 发送（会触发 CLI 处理），而是直接重放到 webview
  // 然后让用户从分支点继续对话
  for (const msg of branchMessages) {
    sendToWebview({ type: 'io_message', channelId, message: msg })
  }

  // 5. 记录分支元数据
  const branchId = saveBranchMeta({
    parentSessionId,
    branchPointIndex: branchPointMessageIndex,
    channelId,
    createdAt: Date.now(),
    label: `分支 #${getNextBranchNumber(parentSessionId)}`
  })

  return { channelId, branchId }
}
```

### Anti-Patterns to Avoid
- **直接跨窗口传递 webview iframe:** BrowserWindow 的渲染进程是隔离的，iframe 不能从一个窗口的 DOM 移到另一个窗口。必须在新窗口创建新的 iframe 和频道。
- **修改 JSONL 文件注入分支数据:** D-10 明确要求不修改 JSONL 文件。分支元数据必须存储在独立文件中。
- **在渲染进程管理全局窗口状态:** 窗口映射和频道路由必须在主进程，渲染进程无法直接访问其他窗口。
- **使用 `BrowserWindow.getAllWindows()[0]` 硬编码:** 当前代码多处使用此模式获取"主窗口"，多窗口场景下必须改为根据 channelId 查询目标窗口。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 全局鼠标位置追踪 | 自定义 native addon 或 Windows API 调用 | `electron.screen.getCursorScreenPoint()` | Electron 内置 API，跨平台，无需额外编译 |
| 窗口-频道映射查询 | 遍历所有窗口的所有标签 | `WindowChannelRegistry` 哈希映射 | O(1) 查询，避免线性搜索 |
| 分支元数据存储 | 自定义二进制格式或数据库 | JSON 文件 (userData/branches.json) | 简单、可读、与项目现有 JSON 持久化模式一致 |
| 分支上下文注入 | 直接写入 JSONL 文件 | `getSessionMessages()` 读取 + webview 消息重放 | 不修改原始数据，与现有 session-store 模式一致 |

**Key insight:** 多窗口和分支功能都可以完全基于 Electron 内置 API 和现有代码模式实现，不需要引入新的第三方依赖。

## Common Pitfalls

### Pitfall 1: sendToWebview 硬编码单一窗口
**What goes wrong:** `claude-webview.ts` 第 129 行 `sendToWebview()` 使用 `BrowserWindow.getAllWindows()[0]` 发送消息，多窗口时消息只会发到第一个窗口。
**Why it happens:** 原始代码假设只有一个窗口。
**How to avoid:** 重构 `sendToWebview()` 接受 `channelId` 参数，通过 `WindowChannelRegistry` 查找目标窗口，调用 `targetWindow.webContents.send()`。
**Warning signs:** 多窗口时，第二个窗口的 webview 收不到消息。

### Pitfall 2: Ghost 窗口无法检测全局 mouseup
**What goes wrong:** 拖拽创建新窗口时，鼠标松手时渲染进程可能已经失去焦点，无法检测 mouseup 事件。
**Why it happens:** Electron 的渲染进程事件只在窗口内有效，鼠标离开窗口后事件不再触发。
**How to avoid:** 使用 `screen.getCursorScreenPoint()` 轮询 + 在 ghost 窗口（半透明跟随窗口）上监听 mouseup 事件，或使用 `win.webContents.on('before-input-event')` 在 ghost 窗口捕获鼠标事件。也可在 ghost 窗口加载的 HTML 中监听 `mouseup` 并通过 IPC 通知主进程。
**Warning signs:** 拖拽标签出窗口后松手，没有创建新窗口。

### Pitfall 3: iframe 状态丢失
**What goes wrong:** 拖拽标签到新窗口后，iframe 内的 webview 重新加载，用户看到的对话进度丢失。
**Why it happens:** iframe 不能跨窗口移动，新窗口必须创建新的 iframe 实例。
**How to avoid:** 新窗口的 iframe 加载后，通过 `sendToWebview()` 重放该频道的历史消息（从 session-store 读取 JSONL）。或者，使用 `--resume` 参数恢复 CLI 会话，让 webview 自动加载历史。
**Warning signs:** 拖拽后新窗口显示空白对话。

### Pitfall 4: 通知管理器绑定单一窗口
**What goes wrong:** `NotificationManager` 构造时接收 `mainWindow: BrowserWindow`，所有通知操作（`shouldShowNotification`、`executeJavaScript` 查询标签可见性）都针对单一窗口。
**Why it happens:** 原始设计未考虑多窗口。
**How to avoid:** 改造 `NotificationManager` 接受 `WindowManager` 引用而非单一 `BrowserWindow`。`shouldShowNotification()` 通过 `WindowChannelRegistry` 查询目标窗口后在该窗口上执行检查。
**Warning signs:** 通知在错误窗口弹出，或根本不弹。

### Pitfall 5: Tray Manager 绑定单一窗口
**What goes wrong:** `setupTray(mainWindow)` 只关联一个窗口，双击托盘只能恢复第一个窗口。
**Why it happens:** 原始设计未考虑多窗口。
**How to avoid:** 托盘的"显示窗口"应恢复最后活跃的窗口（由 WindowManager 追踪）。"新建对话"应在新窗口或最后一个活跃窗口创建标签。
**Warning signs:** 关闭第二个窗口后无法通过托盘恢复。

### Pitfall 6: 分支按钮注入时机
**What goes wrong:** 注入到 webview 的分支按钮在 React 虚拟 DOM 重新渲染后被移除。
**Why it happens:** Claude Code webview 使用 React 渲染，DOM 更新会覆盖外部注入的元素。
**How to avoid:** 使用 MutationObserver 持续监听 DOM 变化，在用户消息元素出现时重新注入分支按钮。这与现有的 badge 注入模式（`setInterval` 轮询）一致。
**Warning signs:** 分支按钮出现后消失，或在对话滚动后消失。

### Pitfall 7: second-instance 事件只通知第一个窗口
**What goes wrong:** 右键菜单"使用 AI Tools 打开"传递的目录路径只发送到 `BrowserWindow.getAllWindows()[0]`。
**Why it happens:** 原始代码使用数组第一个窗口。
**How to avoid:** 改为发送到最后活跃窗口，或创建新窗口。
**Warning signs:** 从右键菜单打开目录时，总是出现在第一个窗口而非用户期望的窗口。

## Code Examples

### 示例 1: WindowChannelRegistry 核心数据结构
```typescript
// src/main/window/window-registry.ts
/** 窗口-频道-标签页 映射注册表 */
export class WindowChannelRegistry {
  // 窗口 ID → 频道 ID 列表
  private windowChannels = new Map<number, Set<string>>()
  // 频道 ID → 窗口 ID
  private channelWindow = new Map<string, number>()

  registerWindow(windowId: number): void {
    this.windowChannels.set(windowId, new Set())
  }

  unregisterWindow(windowId: number): void {
    this.windowChannels.delete(windowId)
    // 清理该窗口所有频道的映射
    for (const [chId, winId] of this.channelWindow) {
      if (winId === windowId) this.channelWindow.delete(chId)
    }
  }

  /** 注册频道到窗口（渲染进程通知主进程时调用） */
  registerChannel(windowId: number, channelId: string): void {
    this.channelWindow.set(channelId, windowId)
    this.windowChannels.get(windowId)?.add(channelId)
  }

  /** 迁移频道到新窗口 */
  migrateChannel(channelId: string, newWindowId: number): void {
    const oldWindowId = this.channelWindow.get(channelId)
    if (oldWindowId != null) {
      this.windowChannels.get(oldWindowId)?.delete(channelId)
    }
    this.channelWindow.set(channelId, newWindowId)
    this.windowChannels.get(newWindowId)?.add(channelId)
  }

  /** 查询频道所属窗口 ID */
  getWindowIdByChannel(channelId: string): number | undefined {
    return this.channelWindow.get(channelId)
  }

  /** 查询窗口的所有频道 */
  getChannelsByWindow(windowId: number): string[] {
    return [...(this.windowChannels.get(windowIdId) ?? [])]
  }
}
```

### 示例 2: 多窗口 sendToWebview 路由改造
```typescript
// 改造前 (claude-webview.ts 第 128-134 行):
function sendToWebview(msg: unknown): void {
  const window = BrowserWindow.getAllWindows()[0]  // 硬编码第一个窗口
  if (window) {
    window.webContents.send('claude-webview:to-webview', msg)
  }
}

// 改造后:
function sendToWebview(msg: unknown, targetChannelId?: string): void {
  if (targetChannelId) {
    // 定向发送到拥有该频道的窗口
    const win = windowManager.getWindowByChannel(targetChannelId)
    if (win && !win.isDestroyed()) {
      win.webContents.send('claude-webview:to-webview', msg)
    }
  } else {
    // 无目标频道（如 init response）— 广播到所有窗口
    windowManager.broadcastToAll('claude-webview:to-webview', msg)
  }
}
```

### 示例 3: 主题同步广播
```typescript
// 改造前 (index.ts 第 173-180 行):
nativeTheme.on('updated', () => {
  const resolved = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  currentResolvedTheme = resolved
  mainWindow.webContents.send('theme:system-changed', resolved)
  mainWindow.setBackgroundColor(...)
  setWebviewTheme(resolved)
})

// 改造后:
nativeTheme.on('updated', () => {
  const resolved = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  currentResolvedTheme = resolved
  setWebviewTheme(resolved)
  // 广播到所有窗口
  windowManager.broadcastToAll('theme:system-changed', resolved)
  // 更新所有窗口背景色
  for (const win of windowManager.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.setBackgroundColor(resolved === 'dark' ? '#1e1e2e' : '#eff1f5')
    }
  }
})
```

### 示例 4: 分支元数据存储格式
```json
// userData/branches.json
{
  "branches": {
    "branch_001": {
      "id": "branch_001",
      "parentSessionId": "550e8400-e29b-41d4-a716-446655440000",
      "branchPointIndex": 5,
      "channelId": "ch_1745856000000_abc123",
      "label": "分支 #1",
      "createdAt": 1745856000000
    }
  },
  "sessionBranchCount": {
    "550e8400-e29b-41d4-a716-446655440000": 1
  }
}
```

### 示例 5: webview 内分支按钮注入（webview-server.ts 中扩展）
```typescript
// 在 generateHostHTML() 的 <script> 块中添加分支按钮注入逻辑
// 注入时机：MutationObserver 监听用户消息节点
(function() {
  var branchButtonStyle = document.createElement('style');
  branchButtonStyle.textContent = `
    .branch-btn {
      position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
      width: 24px; height: 24px; border-radius: 4px; border: none;
      background: transparent; cursor: pointer; opacity: 0;
      transition: opacity 0.15s, background 0.15s;
      display: flex; align-items: center; justify-content: center;
      color: var(--text-muted); font-size: 14px;
    }
    .branch-btn:hover { background: var(--bg-tertiary); opacity: 1; }
    /* 父元素 hover 时显示分支按钮 */
    [data-message-role="user"]:hover .branch-btn { opacity: 0.6; }
  `;
  document.head.appendChild(branchButtonStyle);

  // MutationObserver 持续监听 DOM 变化，注入分支按钮
  var observer = new MutationObserver(function() {
    injectBranchButtons();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  function injectBranchButtons() {
    // 找到所有用户消息容器（Claude Code webview 的消息结构）
    var userMessages = document.querySelectorAll('[data-message-role="user"]:not(.branch-processed)');
    userMessages.forEach(function(msg) {
      msg.classList.add('branch-processed');
      msg.style.position = 'relative';
      var btn = document.createElement('button');
      btn.className = 'branch-btn';
      btn.innerHTML = '&#x1F500;'; // 分支图标
      btn.title = '从此消息创建分支';
      var msgIndex = getMessageBoxIndex(msg);
      btn.onclick = function() {
        // 通过 postMessage 通知父页面
        window.parent.postMessage({
          type: 'claude-webview-message',
          message: {
            type: 'branch:create',
            messageIndex: msgIndex
          }
        }, '*');
      };
      msg.appendChild(btn);
    });
  }
})();
```
**注意：** 上述注入代码中的 `data-message-role` 选择器需要根据 Claude Code webview 的实际 DOM 结构调整。具体选择器需要在实现阶段通过开发者工具检查 webview DOM 确定。[ASSUMED]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `BrowserView` | `WebContentsView` | Electron 35+ | 官方推荐的多视图方案，但本项目使用 iframe 而非 BrowserView |
| `remote` 模块 | `ipcMain`/`ipcRenderer` + contextBridge | Electron 14+ | 项目已使用推荐模式 |
| 全局单窗口 | 多 BrowserWindow 管理 | 本 Phase | 需要引入 WindowManager 模式 |

**Deprecated/outdated:**
- `BrowserView`: 已废弃，Electron 35+ 使用 `WebContentsView`。本项目使用 iframe 方案，不受影响。

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Ghost 窗口可以通过监听 `mouseup` 事件检测全局鼠标松手 | 标签拖拽出窗口检测 | 需要在 Windows 上验证 ghost 窗口能否在透明/无焦点状态下接收 mouseup；替代方案是使用 `setInterval` 轮询鼠标按钮状态 |
| A2 | Claude Code webview 的用户消息元素有特定的 `data-*` 属性或类名可用于选择器注入 | 分支 UI 实现方案 | 选择器可能随 webview 版本更新而变化；需要在实现阶段检查实际 DOM 结构 |
| A3 | `--resume` 参数可以恢复完整的对话上下文到 webview | 对话分支数据模型 | 如果 `--resume` 只恢复 CLI 侧的上下文而不在 webview 中显示历史，则需要额外重放消息到 webview |
| A4 | `screen.getCursorScreenPoint()` 在 Windows 10 上工作正常 | 标签拖拽出窗口检测 | 已知在某些 Linux 发行版有 bug，但 Windows 应正常工作 |
| A5 | `NotificationManager` 的 `executeJavaScript` 查询可以在多窗口场景下对任意窗口执行 | 通知路由 | 需要确认 `webContents.executeJavaScript()` 对非焦点窗口的行为 |

## Open Questions

1. **webview DOM 结构如何识别用户消息？**
   - What we know: webview 是 Claude Code VS Code 扩展的 webview，使用 React 渲染
   - What's unclear: 用户消息的具体 DOM 结构和属性名
   - Recommendation: 在实现阶段用 DevTools 检查 webview iframe 内的 DOM，确定选择器

2. **Ghost 窗口在 Windows 上能否可靠检测 mouseup？**
   - What we know: Electron 的 `screen` API 不提供鼠标按钮状态查询
   - What's unclear: 半透明窗口是否能可靠捕获 mouseup 事件
   - Recommendation: 实现时先尝试 ghost 窗口 mouseup，如果不工作则改用 `setInterval` 轮询 + 检测鼠标是否静止

3. **分支上下文注入：是用 `--resume` 还是消息重放？**
   - What we know: `--resume` 可以恢复 CLI 会话上下文，`getSessionMessages()` 可以读取历史
   - What's unclear: `--resume` 恢复后 webview 是否自动显示历史消息
   - Recommendation: 先用 `--resume` 测试，如果 webview 不显示历史则改为消息重放

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Electron | 多窗口 | ✓ | ^35.7.5 | -- |
| Node.js fs | 分支元数据存储 | ✓ | 内置 | -- |
| screen API | 全局鼠标追踪 | ✓ | Electron 内置 | -- |
| nativeTheme API | 主题同步 | ✓ | Electron 内置 | -- |
| Claude CLI | 分支会话创建 | ✓ | 已有 binary-resolver | -- |

**Missing dependencies with no fallback:**
- 无 — 所有功能基于现有依赖

**Missing dependencies with fallback:**
- 无

## Sources

### Primary (HIGH confidence)
- 代码库直接阅读 — 所有架构文件已完整分析
- Electron API 文档 — BrowserWindow, screen, nativeTheme, ipcMain/ipcRenderer
- 项目现有模式 — registerXxxHandlers, ContextMenu, ConfirmDialog 等可复用组件

### Secondary (MEDIUM confidence)
- [Stack Overflow: Electron drag tab into another open window](https://stackoverflow.com/questions/50828059/electron-drag-tab-into-another-open-window) — 拖拽标签出窗口的技术方案
- [Atomic Object: Multiple Windows in Electron App](https://spin.atomicobject.com/multiple-windows-electron-app/) — WindowManager 模式
- [Electron Docs: Inter-Process Communication](https://electronjs.org/docs/latest/tutorial/ipc) — IPC 通信模式
- [MDN: Window.postMessage()](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) — iframe 通信基础

### Tertiary (LOW confidence)
- [Reddit r/electronjs: Tear off a tab](https://www.reddit.com/r/electronjs/comments/ykpe24/tear_off_a_tab_with_electron/) — 社区方案参考
- [pietrasiak.com: Multi-Window Electron with React Portals](https://pietrasiak.com/creating-multi-window-electron-apps-using-react-portals) — 多窗口架构参考

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 所有依赖均为项目已有，无需新增
- Architecture: MEDIUM — 基于代码库完整分析，但拖拽检测和 webview 注入的具体实现细节需要在开发阶段验证
- Pitfalls: HIGH — 基于代码库直接阅读发现的具体问题点（sendToWebview 硬编码、NotificationManager 单窗口绑定等）

**Research date:** 2026-04-28
**Valid until:** 2026-05-28（稳定 — 基于项目代码库分析，不依赖快速变化的外部 API）
