# Phase 5: 主题个性化 - Context

**Gathered:** 2026-04-26
**Status:** Ready for planning

<domain>
## Phase Boundary

支持多种视觉主题，用户可根据环境切换外观风格。三种预设主题：暗色(Catppuccin Mocha) / 亮色(Catppuccin Latte) / 跟随 Windows 系统。所有 UI 元素（包括 webview）样式一致。

</domain>

<decisions>
## Implementation Decisions

### 亮色主题配色
- **D-01:** 亮色主题使用 Catppuccin Latte 配色，与现有 Mocha 暗色同系列
  - 语义变量名一一对应（如 `--bg-primary` 暗色 `#1e1e2e` → 亮色 `#eff1f5`）
  - 无需新增 CSS 变量名，只需在不同主题下提供不同值
  - accent 颜色：暗色 `#89b4fa` → 亮色 `#1e66f5`

### Webview 主题同步
- **D-02:** 通过 IPC 通知 + 参数化生成方案同步 webview 主题
  - 渲染进程切换主题时通过 IPC 通知主进程
  - 主进程存储当前主题值
  - `webview-server.ts` 的 `generateHostHTML()` 接收主题参数，动态生成对应颜色的 CSS 和 `--vscode-*` 变量覆盖
  - 已打开的 webview 需刷新才能应用新主题（可接受，主题切换不频繁）

### 硬编码颜色迁移
- **D-03:** 全面迁移所有硬编码颜色到 CSS 变量
  - ChatPanel.vue 约 30 处硬编码 hex → 替换为 `var(--xxx)` 引用
  - ConfirmDialog.vue hover 颜色 → CSS 变量
  - notification/index.html → CSS 变量或参数化
  - webview-server.ts 内联 CSS → 参数化生成
  - 可能需新增少量辅助变量（如 `--bg-hover`, `--border-hover`）

### 系统主题检测
- **D-04:** 使用 Electron nativeTheme API + CSS prefers-color-scheme 双重检测
  - 主进程监听 `nativeTheme.on('updated')` 事件
  - 通过 IPC 通知渲染进程切换主题
  - 渲染进程用 CSS `@media (prefers-color-scheme)` 作为后备
  - 主进程同步更新 BrowserWindow 背景色

### 主题切换机制
- **D-05:** CSS 变量切换方案 — 在 `<html>` 元素上添加 `data-theme` 属性
  - `data-theme="dark"` — Catppuccin Mocha
  - `data-theme="light"` — Catppuccin Latte
  - `data-theme="system"` — 根据 nativeTheme 检测结果应用 dark 或 light
  - `main.css` 中使用 `[data-theme="dark"]` 和 `[data-theme="light"]` 选择器定义两套变量值
- **D-06:** 设置 store 新增 `theme: 'dark' | 'light' | 'system'` 字段，持久化到 localStorage
  - 复用现有 `settings.ts` 的 `update(patch)` 方法
- **D-07:** SettingsDrawer.vue 添加主题切换区域（三个选项：暗色/亮色/跟随系统）

### Claude's Discretion
- Catppuccin Latte 与 Mocha 之间具体变量值的微调
- 通知窗口主题同步的具体实现方式
- 主题切换时的过渡动画（是否需要平滑过渡）
- 硬编码颜色迁移时新增辅助变量的命名

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 样式系统
- `src/renderer/src/assets/main.css` — CSS 变量定义（需扩展双主题），全局样式
- `src/renderer/src/assets/base.css` — electron-vite 脚手架默认样式（未使用，可忽略）
- `src/renderer/src/webview/vscode-theme.css` — VSCode 主题变量映射（当前未使用，仅暗色）

### 需迁移硬编码颜色的组件
- `src/renderer/src/components/ChatPanel.vue` — 约 30 处硬编码 hex 颜色
- `src/renderer/src/components/ConfirmDialog.vue` — 2 处 hover 颜色硬编码

### 设置系统
- `src/renderer/src/stores/settings.ts` — Pinia 设置 store，需新增 theme 字段
- `src/renderer/src/components/SettingsDrawer.vue` — 设置面板 UI，需添加主题切换区

### Webview 主题同步
- `src/main/claude/webview-server.ts` — generateHostHTML() 需参数化，接收主题值
- `src/main/ipc/claude-webview.ts` — IPC 中心，可能需要新增主题相关 IPC 通道

### 系统主题检测
- `src/main/index.ts` — 主进程入口，注册 nativeTheme 监听，BrowserWindow 背景色需动态化

### 通知窗口
- `src/notification/index.html` — 通知窗口 HTML，硬编码暗色需参数化

### 入口与桥接
- `src/renderer/index.html` — HTML 入口，需添加 `data-theme` 属性
- `src/renderer/src/main.ts` — 渲染进程入口，导入 main.css
- `src/preload/index.ts` — preload API 桥接，可能需要新增 IPC 通道

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `settings.ts` 的 `update(patch)` 方法 — 直接扩展 theme 字段，无需新建 store
- `SettingsDrawer.vue` — 已有分组布局（声音/缩放/通知/自动更新），添加主题分组即可
- CSS 变量体系已建立（14 个变量）— 只需新增 `[data-theme]` 选择器提供第二套值
- IPC 注册模式 — `registerXxxHandlers()` 标准方式

### Established Patterns
- Catppuccin Mocha 主题 CSS 变量：所有新组件必须使用 CSS 变量
- Vue 3 Composition API + `<script setup>` 标准模式
- IPC 通信通过 `window.api.*` 调用
- localStorage 持久化（key `aitools-settings`）
- 中文 UI 文本硬编码

### Integration Points
- 主题切换入口：SettingsDrawer.vue 添加主题选择器
- CSS 变量生效：main.css 用 `[data-theme]` 选择器切换变量值
- 主进程同步：nativeTheme 监听 + BrowserWindow backgroundColor 更新
- Webview 同步：IPC 通知主进程当前主题 → webview-server.ts 参数化生成 HTML
- 通知窗口同步：通知创建时读取当前主题，应用对应颜色

</code_context>

<specifics>
## Specific Ideas

- Catppuccin Latte 是 Catppuccin 家族官方亮色方案，与现有 Mocha 暗色风格统一
- 主题切换后已打开的 webview 需刷新才能生效，这是可接受的（主题切换不频繁）
- 通知窗口也需要跟随主题变化

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-theme-personalization*
*Context gathered: 2026-04-26*
