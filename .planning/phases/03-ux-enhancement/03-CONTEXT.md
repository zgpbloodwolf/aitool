# Phase 3: UX Enhancement - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

全面提升 AI Tools 桌面客户端的用户体验，覆盖：错误恢复机制、键盘快捷键、操作确认、进程健康监控、标签页增强、文件树增强、安全加固。不涉及新核心功能（如多模型支持、插件市场等）。

</domain>

<decisions>
## Implementation Decisions

### 错误恢复机制
- **D-01:** Webview 初始化失败时显示"重试"按钮，允许用户重新初始化而非只能切换扩展或重启应用
  - 位置：ChatPanel.vue 的 error 显示区域，添加重试按钮调用 `initWebview()`
- **D-02:** 会话删除操作添加确认弹窗，防止误删
  - 位置：`deleteSessionById()` 调用前弹出确认对话框
- **D-03:** 扩展加载失败时在 UI 显示错误提示（而非静默以空列表继续）
  - 位置：App.vue 的 `onMounted` 添加 try-catch，extStore 添加 error state
- **D-04:** 会话列表加载失败时显示错误提示（而非显示"暂无会话记录"）
  - 位置：ChatPanel.vue 的 `toggleSessionHistory()` 错误分支

### 键盘快捷键
- **D-05:** 实现完整快捷键集，与 VS Code / 浏览器习惯一致：
  - `Ctrl+N` — 新建对话标签
  - `Ctrl+W` — 关闭当前标签
  - `Ctrl+B` — 切换侧边栏
  - `Ctrl+Shift+N` — 新建窗口（可选，取决于 Electron 多窗口支持难度）
  - `Ctrl+Tab` / `Ctrl+Shift+Tab` — 切换到下一个/上一个标签
  - 实现：在 App.vue 注册全局 `keydown` 事件监听器，分发到对应组件方法

### 操作确认对话框
- **D-06:** 删除会话前弹出确认弹窗（"确定删除此会话？此操作不可撤销。"）
- **D-07:** 关闭有活跃 Claude 进程的标签前弹出确认（"此对话正在运行，关闭将终止进程。"）
  - 需要在 channelToTab 映射中判断该标签是否有活跃 channel
- **D-08:** 切换工作区（打开新文件夹）时，若有活跃 Claude 进程，弹警告提示
  - 位置：Sidebar.vue 的 `openFolder()` 调用前
- **D-09:** 确认对话框使用自定义 Vue 组件实现（非 `window.confirm`），保持 Catppuccin Mocha 主题风格

### Claude 进程健康监控与自动恢复
- **D-10:** claude.exe 崩溃后自动重连并恢复会话状态
  - 流程：检测退出 → 显示"正在恢复..." → 重新启动进程 → 注入 resumeSessionId → 恢复对话
  - 用户看到状态提示，无需手动操作
- **D-11:** 每 30 秒心跳检测 claude.exe 是否存活（检查 `process.pid` 是否存在）
  - 挂死时通知用户并提供"重启进程"按钮
  - 位置：process-manager.ts 添加 `startHealthCheck()` 方法
- **D-12:** 清理权限请求的超时定时器（修复内存泄漏）
  - 位置：channel 关闭时清除该 channel 下所有 pending 的 `setTimeout`

### 标签页体验增强
- **D-13:** 智能标签名 — 从会话摘要中提取前几个字作为标签标题
  - 数据源：`system.init` 消息中的会话摘要，或恢复会话时的 summary 字段
  - 回退：若无法获取摘要，保持"对话 N"格式
- **D-14:** 标签状态指示器 — 在标签上显示绿/黄/灰点表示运行中/等待/空闲
  - 绿色：Claude 正在处理（收到 system 消息且未收到 result）
  - 黄色：等待权限确认（有 pending 的 permission request）
  - 灰色：空闲
- **D-15:** 中键点击关闭标签页
- **D-16:** 标签拖拽排序（可选，如果复杂度过高可 defer）

### 文件树与侧边栏增强
- **D-17:** 侧边栏宽度可拖拽调整，宽度持久化存储到 localStorage
  - 实现：拖拽手柄组件 + CSS resize，localStorage 存储
- **D-18:** 文件系统监听 — 使用 `chokidar` 监听工作区变更，自动刷新文件树
  - 位置：workspace store 添加 watch/startWatch/stopWatch action
  - 需要 IPC 通道支持文件监听（主进程侧使用 chokidar）
- **D-19:** 文件搜索过滤 — 在侧边栏顶部添加搜索框，实时过滤文件/目录名
  - 实现：递归过滤文件树节点，高亮匹配文本
- **D-20:** 收藏项目目录 — 永久保存常用项目路径列表，快速切换
  - 存储：localStorage 或 electron-store
  - UI：侧边栏顶部显示收藏列表，支持添加/删除/点击切换

### 安全与健壮性修补
- **D-21:** `deleteSession` 验证 sessionId 为 UUID 格式，防止路径遍历攻击
  - 位置：`session-store.ts` 的 `deleteSession()` 方法，添加 UUID 正则校验
- **D-22:** 文件系统沙盒使用 `fs.realpath()` 解析符号链接后再检查白名单
  - 位置：`filesystem.ts` 的 `isPathAllowed()` 函数
- **D-23:** iframe sandbox 安全加固 — 移除 `allow-same-origin`（仅保留 `allow-scripts allow-forms allow-popups`），`postMessage` 使用精确 origin（`http://127.0.0.1:${port}`）
  - **必须测试兼容性**：移除 `allow-same-origin` 可能影响 webview 内部 API 调用（如 localStorage、fetch）
  - 如果不兼容，保留 `allow-same-origin` 但确保 postMessage 使用精确 origin
- **D-24:** 主进程添加全局未捕获异常处理器
  - `process.on('uncaughtException')` — 记录日志 + 显示错误对话框
  - `process.on('unhandledRejection')` — 记录日志（不退出进程）
  - 位置：`src/main/index.ts` 顶部添加

### Claude's Discretion
- 确认对话框组件的具体视觉设计（按钮布局、动画）
- 文件搜索的防抖时间和高亮样式
- 心跳检测的具体间隔（建议 30s，可调整）
- 收藏列表的最大数量限制
- 全局异常处理中哪些错误需要弹对话框、哪些仅记录日志

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 核心前端文件
- `src/renderer/src/components/ChatPanel.vue` — 多标签聊天面板（最大组件，829行）
- `src/renderer/src/components/Sidebar.vue` — 侧边栏容器
- `src/renderer/src/components/FileTree.vue` — 文件树组件（Options API）
- `src/renderer/src/components/TitleBar.vue` — 标题栏
- `src/renderer/src/components/StatusBar.vue` — 状态栏
- `src/renderer/src/App.vue` — 根布局组件

### 核心主进程文件
- `src/main/ipc/claude-webview.ts` — IPC 中心（838行），多 channel 管理
- `src/main/claude/process-manager.ts` — Claude 进程生命周期
- `src/main/claude/session-store.ts` — 会话存储
- `src/main/ipc/filesystem.ts` — 文件系统沙盒
- `src/main/index.ts` — 主进程入口

### 状态管理
- `src/renderer/src/stores/extension.ts` — 扩展 store
- `src/renderer/src/stores/workspace.ts` — 工作区 store

### 样式
- `src/renderer/src/assets/main.css` — Catppuccin Mocha 主题变量
- `src/renderer/src/assets/base.css` — 基础样式

### 类型定义
- `src/shared/types.ts` — 共享类型
- `src/preload/index.ts` — preload API 桥接
- `src/preload/index.d.ts` — TypeScript 声明

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `showStatus()` / `clearStatus()` — ChatPanel 中已有的状态消息系统，可复用于进程恢复提示
- `pendingResume` Map — 已有会话恢复的注入机制，自动重连可复用
- `channelToTab` Map — 已有 channel 到 tab 的映射关系，可用于判断标签活跃状态
- `useExtensionStore` / `useWorkspaceStore` — Pinia store 模式已建立

### Established Patterns
- Catppuccin Mocha 主题：所有新组件必须使用 CSS 变量（`var(--bg-primary)` 等），避免硬编码 hex 值
- Vue 3 Composition API + `<script setup>` 是标准模式（FileTree 除外）
- IPC 通信通过 `window.api.*` 调用，事件通过 `window.api.on*` 监听
- 中文 UI 文本硬编码在组件中（无 i18n 框架）

### Integration Points
- 键盘快捷键：注册在 App.vue 根级别，分发到 ChatPanel/Sidebar 方法
- 进程健康检查：在 process-manager.ts 中实现，通过 IPC 通知渲染进程状态
- 文件监听：需要在主进程添加 chokidar IPC handler，渲染进程通过 store 调用
- 收藏目录：需要新的 IPC 通道读写配置，或使用 localStorage

</code_context>

<specifics>
## Specific Ideas

- 用户特别提出"收藏项目目录"功能：永久保存常用项目路径，支持快速切换工作区
- 标签拖拽排序作为可选项，复杂度高时可推迟
- iframe 安全加固必须测试兼容性，特别是移除 `allow-same-origin` 后 webview 的 API 调用是否正常

</specifics>

<deferred>
## Deferred Ideas

- 上下文用量展示（状态栏显示 token 用量）— 用户未选择，可后续添加
- 深色/浅色主题切换 — 当前仅 Catppuccin Mocha 深色，暂不添加
- ARIA 无障碍属性 — 当前优先级不高，后续版本考虑
- FileTree 重构为 SFC 模式 — 重构成本高，不影响功能
- 自动更新（electron-updater）— 需要分发渠道，超出当前范围

</deferred>

---

*Phase: 03-ux-enhancement*
*Context gathered: 2026-04-24*
