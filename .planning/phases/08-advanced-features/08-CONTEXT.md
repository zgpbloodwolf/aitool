# Phase 8: 高级特性 - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

多窗口并行运行不同工作区的对话（拖拽标签页生成独立窗口），以及从任意历史消息创建分支对话并可视化分支关系。面向深度用户的高级特性。

</domain>

<decisions>
## Implementation Decisions

### 多窗口架构
- **D-01:** 多窗口同架构方案 — 每个窗口是独立的 `BrowserWindow`，加载同一个 renderer，各自拥有独立的 Pinia 状态。主进程新增 `WindowManager` 统一管理窗口生命周期、通知路由、主题同步。
- **D-02:** 窗口创建方式为拖拽标签页出窗口边界时自动创建新窗口（类似 Chrome 拖拽标签行为）。检测鼠标超出当前窗口边界时创建半透明预览窗口，松手确认后正式创建。
- **D-03:** 保持 `requestSingleInstanceLock` 单实例行为不变。多窗口是应用内部的多 `BrowserWindow` 管理，不涉及多进程。
- **D-04:** 不记忆窗口布局 — 新窗口居中显示，关闭应用后再次打开只恢复单个默认窗口。

### 多窗口状态管理
- **D-05:** 通知（回复完成、工具权限请求、错误）精准路由到目标窗口 — 每个通知发送到拥有该会话/标签页的窗口，其他窗口不受影响。
- **D-06:** 主题变更时所有窗口同步更新 — 任一窗口切换主题，其他窗口立即响应。

### 对话分支触发与展示
- **D-07:** 分支触发方式为消息旁分支按钮 — 每条用户消息右侧出现分支图标，点击后从该消息创建新分支。
- **D-08:** 分支可视化采用内联分支指示器 — 分叉点在消息流中显示"N 个分支"标签，点击展开分支列表选择切换。不占用额外面板空间。
- **D-09:** 每个分支作为独立标签页展示 — 标签上标注分支来源（如"分支 #1"），切换分支即切换标签页。

### 对话分支数据模型
- **D-10:** 新分支创建新的 Claude CLI 会话（新 session_id）— 分支点的上下文作为新会话的历史注入。与现有 CLI 集成完全兼容，不修改 JSONL 文件。
- **D-11:** 分支命名采用自动编号 + 可重命名 — 默认"分支 #1"、"分支 #2"等，用户可在标签右键菜单中重命名。
- **D-12:** 每个会话限制 N 个分支数量，超出后提示用户关闭旧分支。具体 N 值由 Claude 决定（建议 10）。

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 窗口管理（现有代码）
- `src/main/index.ts` — 主进程入口，`createWindow()` 创建 BrowserWindow，`second-instance` 事件处理，`nativeTheme` 主题同步，通知管理器初始化
- `src/main/tray/tray-manager.ts` — 托盘管理器，绑定到主窗口，多窗口时需调整
- `src/main/notification/notification-manager.ts` — 通知管理器，需扩展支持多窗口通知路由
- `src/main/notification/notification-registry.ts` — 通知单例注册模式

### 标签与频道系统（核心改造点）
- `src/main/ipc/claude-webview.ts` — IPC 中心，`Channel` 接口定义，`channels` Map 管理所有活跃 Claude 进程，消息路由逻辑
- `src/renderer/src/components/ChatPanel.vue` — 标签栏管理（`SessionTab[]`），iframe 容器，会话历史面板，上下文菜单
- `src/main/claude/process-manager.ts` — Claude CLI 进程管理

### 会话存储（分支数据基础）
- `src/main/claude/session-store.ts` — 会话 JSONL 存储和读取，`SessionInfo` 接口，`getSessionMessages()` 读取消息
- `src/shared/types.ts` — 共享类型定义

### IPC 桥接
- `src/preload/index.ts` — preload API 桥接，需扩展窗口管理相关 IPC
- `src/preload/index.d.ts` — TypeScript 类型声明

### 状态管理
- `src/renderer/src/stores/settings.ts` — Pinia 设置 store，主题设置
- `src/renderer/src/stores/workspace.ts` — 工作区 store，项目/文件管理

### 样式系统
- `src/renderer/src/assets/main.css` — CSS 变量（Catppuccin Mocha/Latte），所有新 UI 必须使用

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createWindow()` — 已有完整的 BrowserWindow 创建逻辑，可直接复用或抽取为工厂函数
- `claude-webview.ts` 的 Channel 管理 — `channels` Map 和 `launchingChannels` Set 已管理多频道生命周期，多窗口场景下需要按窗口分组
- `ChatPanel.vue` 的标签管理 — `SessionTab[]` 和 `activeTabId` 已实现标签 CRUD，拖拽和分支可在此基础上扩展
- `session-store.ts` 的 `getSessionMessages()` — 可读取历史消息，是分支点上下文注入的数据源
- IPC `registerXxxHandlers()` 模式 — 新增窗口管理 IPC 的标准方式
- `nativeTheme` 监听模式 — 已实现主题变更事件发送，多窗口只需遍历所有窗口发送

### Established Patterns
- CSS 变量体系（Catppuccin Mocha/Latte）— 所有新 UI 必须使用 `var(--*)`
- Vue 3 Composition API + `<script setup>` 标准模式
- IPC 通信通过 `window.api.*` 调用
- 中文 UI 文本硬编码在组件中
- 标签右键菜单已有模式（`ContextMenu.vue`），可扩展分支重命名等操作

### Integration Points
- WindowManager：在 `index.ts` 中初始化，管理所有 BrowserWindow 实例
- 拖拽检测：在 `ChatPanel.vue` 标签元素上添加 `dragstart`/`drag`/`dragend` 事件处理
- 分支按钮：在 webview 消息渲染中注入分支按钮（需与 webview 通信机制配合）
- 分支指示器：消息流中分叉点插入分支指示器组件
- 通知路由：`notification-manager.ts` 需根据会话/频道所属窗口定向发送
- 主题同步：`nativeTheme.on('updated')` 和 `ipcMain.on('theme:update')` 遍历所有窗口发送

</code_context>

<specifics>
## Specific Ideas

- 拖拽标签页类似 Chrome 行为 — 拖出窗口边界时创建半透明预览窗口跟随鼠标，松手确认
- 内联分支指示器不额外占空间 — 只在分叉点消息下方显示小标签，点击展开分支列表
- 每个分支 = 新标签页 + 新 CLI 会话 — 简单可靠，避免修改已有 JSONL 数据
- WindowManager 维护窗口-标签映射 — 通知路由通过查询"哪个窗口拥有该频道"实现

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-advanced-features*
*Context gathered: 2026-04-28*
