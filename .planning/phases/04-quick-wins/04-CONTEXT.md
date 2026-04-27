# Phase 4: Quick Wins - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

用最少代码实现用户可感知的体验提升：交互式通知、托盘常驻、声音反馈、全局缩放、自动更新。不涉及核心架构变更或新核心功能。

</domain>

<decisions>
## Implementation Decisions

### 交互式通知系统 (F1)
- **D-01:** 使用纯自定义 BrowserWindow 通知窗口（非系统通知），完全控制 UI 和交互能力
  - 主题风格：Catppuccin Mocha，与应用一致
  - 定位：屏幕右下角，`always-on-top` + 无边框 + 透明背景
  - 支持动画滑入/滑出
- **D-02:** 堆叠显示多条通知，同时最多显示 3 条，新通知从下方滑入，旧通知自动消失
  - 不漏掉任何通知事件
- **D-03:** 智能触发 — 窗口在前台且对应标签页可见时不发通知，只在最小化/后台/其他标签页时发送
- **D-04:** 完整交互式通知能力：
  - **回复完成**：通知显示摘要，点击跳转到对应标签页
  - **权限请求**：通知带「允许/拒绝」按钮，直接在通知上操作
  - **方案选择**：通知显示方案摘要 +「查看方案」按钮，点击跳转到应用内查看详情
  - **文本回复**：通知嵌入文本输入框，用户可直接回复
  - **异常错误**：通知显示错误信息，点击查看详情

### 设置管理架构
- **D-05:** 设置页面以侧边抽屉面板形式从右侧打开（不离开当前页面，类似 VS Code 设置面板）
  - 覆盖内容区，不创建新窗口
- **D-06:** 设置数据存储使用 localStorage，与现有 sidebar width / favorites 一致
  - 无需新增 IPC 通道或外部依赖
- **D-07:** 设置入口为标题栏右侧齿轮图标，点击打开设置抽屉
  - 额外支持 Ctrl+, 快捷键打开

### 声音提示 (F3)
- **D-08:** 使用轻量级自定义音效文件，存放在 `resources/sounds/`（已配置 ASAR-unpacked）
  - 事件音效：回复完成、工具权限请求、错误
  - 默认关闭，设置页面按事件类型单独控制开关
  - 音量可调

### 全局缩放 (F5)
- **D-09:** 缩放仅通过设置面板滑块控制（80%~200%，步进 10%），不实现 Ctrl+滚轮缩放
  - Ctrl+0 重置到 100%
  - 缩放比例持久化到 localStorage
- **D-10:** Shell UI 使用 `webFrame.setZoomFactor()` 缩放，webview iframe 使用 CSS `zoom` 属性同步缩放
  - 两者使用同一个缩放值，确保全局体验一致
  - CSS `zoom` 在 Chromium 中表现稳定，不会导致文字模糊

### 托盘图标 (F2)
- **D-11:** Windows 系统托盘常驻图标
  - 首次关闭窗口时询问：最小化到托盘 or 退出应用，记住用户选择
  - 右键菜单：新建对话 / 显示窗口 / 退出
  - 双击托盘图标恢复窗口

### 自动更新 (F6)
- **D-12:** 从 GitHub Releases 检查新版本，仓库为 public，使用 electron-updater 标准方案
  - `electron-builder.yml` 添加 `publish` provider 配置指向 GitHub
  - 添加 `electron-updater` 为生产依赖
- **D-13:** 应用启动时检查一次新版本
- **D-14:** 更新是可选的，不强制更新，跳过后仍可正常使用
  - 提示框三按钮：「立即更新」「稍后提醒」「跳过此版本」
  - 跳过版本记录到 localStorage，该版本不再提示
- **D-15:** 发现新版本 → 提示框（显示版本号和更新内容）→ 用户确认后下载 → 显示下载进度 → 下载完成提示重启安装

### Claude's Discretion
- 通知窗口的具体动画效果（滑入速度、消失延迟）
- 通知的最大堆叠数量（建议 3）
- 设置面板的具体布局和分组
- 声音文件的具体来源（需使用商业友好的音效）
- 托盘图标的图标资源
- 自动更新的 changelog 展示格式

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 核心前端文件
- `src/renderer/src/components/ChatPanel.vue` — 多标签聊天面板，通知触发逻辑集成点
- `src/renderer/src/components/TitleBar.vue` — 标题栏，设置齿轮图标添加位置
- `src/renderer/src/components/Sidebar.vue` — 侧边栏容器
- `src/renderer/src/App.vue` — 根布局组件，设置抽屉集成点

### 核心主进程文件
- `src/main/index.ts` — 主进程入口，Tray 注册、autoUpdater 初始化、通知窗口管理
- `src/main/ipc/claude-webview.ts` — IPC 中心，通知事件触发点（权限请求、回复完成、错误）

### 状态管理
- `src/renderer/src/stores/workspace.ts` — 现有 localStorage 模式参考

### 样式
- `src/renderer/src/assets/main.css` — Catppuccin Mocha 主题变量，通知窗口需复用
- `src/renderer/src/assets/base.css` — 基础样式

### 配置
- `electron-builder.yml` — 需添加 `publish` provider
- `package.json` — 需添加 `electron-updater` 依赖

### 类型与桥接
- `src/preload/index.ts` — preload API 桥接，新增 IPC 通道注册点
- `src/preload/index.d.ts` — TypeScript 声明

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `showStatus()` / `clearStatus()` — ChatPanel 中已有的状态消息系统，可复用于通知触发
- `channelToTab` Map — 已有 channel 到 tab 的映射关系，可用于通知跳转
- `useExtensionStore` / `useWorkspaceStore` — Pinia store 模式已建立，设置 store 可参考
- `localStorage` 持久化模式 — sidebar width 和 favorites 的读写模式可直接复用
- IPC `registerXxxHandlers()` 模式 — 新 IPC 通道注册的标准方式
- `resources/**` ASAR-unpacked — 声音文件放入此目录可直接访问

### Established Patterns
- Catppuccin Mocha 主题：所有新组件必须使用 CSS 变量（`var(--bg-primary)` 等）
- Vue 3 Composition API + `<script setup>` 是标准模式
- IPC 通信通过 `window.api.*` 调用，事件通过 `window.api.on*` 监听
- 中文 UI 文本硬编码在组件中（无 i18n 框架）
- 无菜单栏（`setMenu(null)`），设置入口需添加到标题栏

### Integration Points
- 通知触发：在 `claude-webview.ts` 的消息处理逻辑中检测事件类型（权限请求、回复完成、错误）
- 设置齿轮：在 `TitleBar.vue` 右侧按钮区添加
- 设置抽屉：在 `App.vue` 添加全屏覆盖层 + 右侧面板
- 托盘图标：在 `src/main/index.ts` 的 `app.whenReady()` 中创建
- 自动更新：在 `src/main/index.ts` 中初始化 `autoUpdater`
- 缩放：在 renderer 入口调用 `webFrame.setZoomFactor()`，在 iframe 容器应用 CSS `zoom`

</code_context>

<specifics>
## Specific Ideas

- 用户特别提到：如果 Windows 系统通知无法满足交互需求，可创建自定义通知窗口 — 最终选择了纯自定义方案
- 用户明确：缩放不需要鼠标滚轮操作，只在设置面板中通过滑块控制
- 用户明确：更新是可选的，跳过后不影响使用
- 用户要求：堆叠显示通知，不要漏掉任何通知事件

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-quick-wins*
*Context gathered: 2026-04-25*
