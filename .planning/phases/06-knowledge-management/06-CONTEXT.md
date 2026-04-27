# Phase 6: 知识管理 - Context

**Gathered:** 2026-04-26
**Status:** Ready for planning

<domain>
## Phase Boundary

让对话内容可导出复用（Markdown 格式），剪贴板操作更高效（历史记录 + 收藏片段）。不涉及新的对话功能或核心架构变更。

</domain>

<decisions>
## Implementation Decisions

### 对话导出格式与内容
- **D-01:** 导出范围仅包含用户消息 + 助手回复，过滤掉 system 消息和工具调用细节
- **D-02:** 文件头部包含会话标题 + 导出日期（如 `# 对话标题\n> 导出于 2026-04-26`）
- **D-03:** 保留原始 Markdown 代码块和语言标识（```python...```），不做额外处理
- **D-04:** 默认文件名为「会话标题+日期」（如 `Claude-Code-对话-2026-04-26.md`），用户可在保存对话框中修改

### 剪贴板历史管理
- **D-05:** 存储策略为内存 + 会话内有效，关闭应用后清空
- **D-06:** 最大保留最近 50 条，超出后自动清除最早的记录
- **D-07:** 仅记录文本内容，不记录图片

### 收藏片段系统
- **D-08:** 使用 localStorage 存储收藏片段，复用现有 localStorage 模式
- **D-09:** 基础 CRUD 管理：创建、编辑（标题+内容）、删除、列表展示
- **D-10:** 片段来源：从剪贴板历史记录点「收藏」按钮提升，同时提供手动创建入口

### 触发与交互方式
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 对话数据源
- `src/main/claude/session-store.ts` — 会话存储，`getSessionMessages()` 读取 JSONL 并过滤 user/assistant 消息，导出的核心数据源
- `src/shared/types.ts` — 共享类型定义（SessionInfo 等）

### 消息路由与标签系统
- `src/renderer/src/components/ChatPanel.vue` — 标签栏、消息路由、iframe 宿主。标签右键菜单和剪贴板面板的集成点
- `src/main/ipc/claude-webview.ts` — IPC 中心，消息处理逻辑

### IPC 桥接
- `src/preload/index.ts` — preload API 桥接，需新增 `dialog:showSaveDialog` 和可能的剪贴板相关 IPC 通道
- `src/preload/index.d.ts` — TypeScript 类型声明，需同步更新

### 文件对话框
- `src/main/ipc/dialog.ts` — 现有 `dialog:selectFolder` 处理器，需新增 `dialog:showSaveDialog` 处理器

### 状态管理
- `src/renderer/src/stores/settings.ts` — Pinia 设置 store，可扩展剪贴板和片段相关设置
- `src/renderer/src/stores/workspace.ts` — 现有 localStorage 持久化模式参考

### 样式系统
- `src/renderer/src/assets/main.css` — CSS 变量定义（Catppuccin Mocha/Latte 双主题），弹出面板必须使用

### 设置面板
- `src/renderer/src/components/SettingsDrawer.vue` — 设置抽屉面板，可扩展快捷键配置

### 主进程入口
- `src/main/index.ts` — 全局快捷键注册点

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `session-store.ts` 的 `getSessionMessages()` — 已能读取并过滤 JSONL 中的 user/assistant 消息，是导出功能的直接数据源
- `settings.ts` 的 `update(patch)` 方法 — 可直接扩展剪贴板/片段设置字段
- `SettingsDrawer.vue` — 已有分组布局，可扩展快捷键配置
- IPC `registerXxxHandlers()` 模式 — 新增 `dialog:showSaveDialog` 的标准方式
- `dialog.ts` — 已有 `dialog:selectFolder` 处理器，新增保存对话框结构类似
- `localStorage` 持久化模式 — 收藏片段可直接复用

### Established Patterns
- CSS 变量体系（Catppuccin Mocha/Latte）— 所有新 UI 必须使用 `var(--*)`
- Vue 3 Composition API + `<script setup>` 标准模式
- IPC 通信通过 `window.api.*` 调用
- 中文 UI 文本硬编码在组件中
- 全局快捷键通过主进程注册，渲染进程监听 `shortcut:*` IPC 事件

### Integration Points
- 标签右键菜单：在 `ChatPanel.vue` 标签元素上添加 `@contextmenu` 事件处理器
- 剪贴板面板弹出：在 `ChatPanel.vue` 中添加弹出面板组件，通过快捷键或按钮控制显示
- 保存对话框：在 `dialog.ts` 中新增 `dialog:showSaveDialog` IPC handler
- 剪贴板监听：渲染进程使用 `navigator.clipboard` API 或监听 `clipboardchange` 事件
- 收藏片段存储：新增 Pinia store 或扩展现有 store，localStorage key `aitools-snippets`

</code_context>

<specifics>
## Specific Ideas

- 弹出面板类似 VS Code 命令面板风格——轻量、出现在输入区域附近、选中后自动关闭
- 收藏片段既可从剪贴板历史提升，也可手动创建——两个入口都要支持
- 剪贴板历史仅文本、仅内存、50 条上限——保持轻量
- 快捷键可在设置中配置——用户个性化需求

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-knowledge-management*
*Context gathered: 2026-04-26*
