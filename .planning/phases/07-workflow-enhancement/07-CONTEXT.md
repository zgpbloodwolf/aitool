# Phase 7: 工作流增强 - Context

**Gathered:** 2026-04-26
**Status:** Ready for planning

<domain>
## Phase Boundary

增强日常使用效率：Token 用量可视化（历史统计面板）和系统级集成（Windows 右键菜单）。不涉及核心对话功能或架构变更。

</domain>

<decisions>
## Implementation Decisions

### Token 数据持久化
- **D-01:** 使用 JSON 文件持久化 Token 用量数据，存储在 userData 目录下（如 `token-usage.json`），与 `close-behavior.json` 模式一致
- **D-02:** 按天汇总结构 — 每天一个汇总对象 `{ date, sessions: [{id, cwd, inputTokens, outputTokens, timestamp}] }`
- **D-03:** 写入时机为会话结束（channel 销毁/close 时），非每次 API 调用
- **D-04:** 历史数据保留 90 天，超过后自动清理最早的记录

### 统计面板展示
- **D-05:** Token 用量统计面板嵌入 SettingsDrawer.vue，新增 "用量统计" 分组，与声音/缩放/通知/主题设置在同一入口
- **D-06:** 使用 Chart.js（+ vue-chartjs 封装）绘制每日用量趋势柱状图，MIT 协议商业友好
- **D-07:** 不实现预警线功能，仅展示数据
- **D-08:** 工作区分组统计以汇总卡片下方列表形式展示，每行显示工作区名 + token 用量，点击可展开查看该工作区趋势图

### Windows 右键菜单集成
- **D-09:** 注册方式为 NSIS 安装脚本 + 应用首次启动代码双重注册，互为保障
  - NSIS 安装脚本写入注册表（`HKCR\Directory\shell` + `HKCR\Directory\Background\shell`）
  - 应用代码在首次启动时检查注册表项是否完整，缺失则补注册
- **D-10:** 右键菜单范围：文件夹右键 + 文件夹背景右键，不含驱动器右键
- **D-11:** 右键菜单项显示应用图标（注册表中指定 exe 图标路径）

### 目录打开通信机制
- **D-12:** 使用 Electron 内置 `app.requestSingleInstanceLock()` + `second-instance` 事件接收命令行参数
- **D-13:** 已启动实例收到目录路径后，在当前窗口创建新标签页并切换到该目录，与多标签页体验一致
- **D-14:** 应用未启动时正常启动并打开该目录的标签页

### Claude's Discretion
- JSON 文件的具体字段命名和文件名
- Chart.js 柱状图的样式细节（颜色、间距、动画）
- 统计面板的布局细节（卡片排列、数字格式化）
- NSIS 安装脚本的具体注册表键名和值
- 右键菜单项的中文文案（如 "使用 AI Tools 打开" vs "在 AI Tools 中打开"）
- 工作区列表的排序方式

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Token 用量追踪（现有代码）
- `src/main/ipc/claude-webview.ts` — Channel 对象中 `totalInputTokens` / `totalOutputTokens` 追踪，`stream_event` 消息中提取 usage 数据；`claude:get-context-usage` IPC handler 返回活跃频道 token 数据
- `src/main/claude/process-manager.ts` — Claude CLI 进程管理，进程退出事件
- `src/main/claude/session-store.ts` — 会话 JSONL 存储参考，`encodeProjectPath()` 获取工作区编码路径

### 统计面板集成点
- `src/renderer/src/components/SettingsDrawer.vue` — 设置抽屉面板，需新增 "用量统计" 分组
- `src/renderer/src/stores/settings.ts` — Pinia 设置 store，可扩展但不直接存 token 数据（token 数据由 JSON 文件管理）
- `src/renderer/src/assets/main.css` — CSS 变量定义（Catppuccin Mocha/Latte），所有新 UI 必须使用

### IPC 桥接
- `src/preload/index.ts` — preload API 桥接，需新增 token 用量数据读取 IPC 通道
- `src/preload/index.d.ts` — TypeScript 类型声明

### 主进程入口与单实例
- `src/main/index.ts` — 主进程入口，需添加 `app.requestSingleInstanceLock()` 和 `second-instance` 事件处理
- `src/main/claude/webview-server.ts` — webview 服务器管理

### 打包配置
- `electron-builder.yml` — NSIS 安装器配置，需添加注册表操作脚本
- `package.json` — 项目依赖，需新增 chart.js 和 vue-chartjs

### 通知系统参考
- `src/main/notification/notification-manager.ts` — 通知管理器参考模式
- `src/main/notification/notification-registry.ts` — 单例注册模式参考

### 窗口管理
- `src/main/tray/tray-manager.ts` — 托盘管理器，`second-instance` 事件中可能需要调用 `showWindow()` 恢复窗口

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `claude-webview.ts` 中 Channel 的 `totalInputTokens` / `totalOutputTokens` — 已追踪每个频道的 token 用量，是统计数据的核心来源
- `session-store.ts` 的 `encodeProjectPath()` — 可复用获取工作区编码路径，用于按工作区分组统计
- `SettingsDrawer.vue` — 已有分组布局模式（声音/缩放/通知/自动更新），直接扩展新分组
- `close-behavior.json` 模式 — userData 目录 JSON 文件持久化的参考实现
- IPC `registerXxxHandlers()` 模式 — 新增 token 数据读取的标准方式
- `app.requestSingleInstanceLock()` — Electron 内置 API，无需额外依赖

### Established Patterns
- CSS 变量体系（Catppuccin Mocha/Latte）— 所有新 UI 必须使用 `var(--*)`
- Vue 3 Composition API + `<script setup>` 标准模式
- IPC 通信通过 `window.api.*` 调用
- 中文 UI 文本硬编码在组件中
- JSON 文件持久化使用 `app.getPath('userData')` 获取路径
- NSIS 安装器已配置（electron-builder.yml）

### Integration Points
- 统计面板：在 SettingsDrawer.vue 添加 "用量统计" 分组
- Token 数据写入：在 `handleCloseChannel()` 中汇总写入 JSON 文件
- Token 数据读取：新增 IPC handler `token-usage:get-stats`，preload 暴露 API
- 右键菜单注册：NSIS installer.nsh 脚本 + 主进程首次启动检查
- 单实例通信：`index.ts` 中 `app.requestSingleInstanceLock()` + `second-instance` 事件
- 新标签页创建：通过 IPC 通知渲染进程创建新标签页并设置工作目录

</code_context>

<specifics>
## Specific Ideas

- JSON 按天汇总结构简洁，查询 "今日/本周/本月" 可直接按日期范围读取
- Chart.js 是轻量图表方案（~65KB），柱状图展示每日趋势直观
- 工作区列表在汇总卡片下方，点击可展开趋势图，交互自然
- NSIS + 应用代码双重注册确保右键菜单在各种安装场景下都可用
- `requestSingleInstanceLock` 是 Electron 标准单实例方案，无需额外通信机制

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-workflow-enhancement*
*Context gathered: 2026-04-26*
