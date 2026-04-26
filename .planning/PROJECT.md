# AI Tools - Bug Fix: 消息无响应 (429)

## What This Is

基于 Electron + Vue 3 + TypeScript 的 AI 编程助手桌面客户端，集成 Claude Code CLI。通过本地 HTTP 服务器托管 Claude Code VS Code 扩展的 webview，以 iframe 形式嵌入 Electron 窗口中，提供独立的桌面端体验。

当前使用智谱 AI (open.bigmodel.cn) 的 API 代理，模型为 GLM-5.1。

## Core Value

用户能在桌面客户端中正常与 Claude Code 交互——发送消息并收到回复，不出现 429 速率限制错误。

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Electron 桌面客户端框架（窗口管理、IPC 通信）
- ✓ Claude Code webview 嵌入（通过本地 HTTP 服务器托管）
- ✓ 多标签对话管理（创建/切换/关闭标签页）
- ✓ 会话历史管理与恢复
- ✓ 工作区文件浏览器
- ✓ 工具权限请求/响应流程
- ✓ Token 用量追踪与上下文进度显示
- ✓ 状态栏消息显示（系统消息、重试状态等）
- ✓ 主题个性化 — 暗色/亮色/跟随系统三种主题 (Phase 5)

### Active

<!-- Current scope. Building toward these. -->

- [ ] 知识管理 — 对话导出、剪贴板增强 (Phase 6)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- 新功能开发 — 已扩展为 UX 增强项目，不再仅限 bug 修复
- 跨平台适配 — 仅关注 Windows
- 官方 Anthropic API 支持 — 当前使用智谱 AI 代理

## Context

- **技术栈**: Electron 35 + electron-vite + Vue 3 + Pinia + TypeScript
- **CLI 集成**: 通过 `child_process.spawn` 启动 `claude.exe`，使用 `stream-json` 输入输出格式
- **Webview**: 托管 Claude Code VS Code 扩展的 webview 文件，模拟 VS Code 扩展宿主环境
- **API 代理**: 智谱 AI (open.bigmodel.cn/api/anthropic)，模型 GLM-5.1
- **认证**: `ANTHROPIC_AUTH_TOKEN` 配置在 `~/.claude/settings.json`

### 问题描述

发送消息后完全无响应，最终报 "API Error: Request rejected (429) - 您的账户已达到速率限制"。VS Code 中的 Claude Code 插件可以正常使用。

### 根因线索

- 问题出现在添加 "context 使用量显示" 功能之后（commit `e452bd0` 和 `d7f382b`）
- 改动包括：追踪 `stream_event` 的 token 用量、向 `result` 消息注入 `modelUsage`（`contextWindow: 128000`）、webview 内 `setInterval` 每 2 秒重插 badge
- 之前可以正常使用

## Constraints

- **Tech stack**: 不能改变现有架构，只修 bug
- **API**: 受限于智谱 AI 的速率限制策略
- **CLI**: 依赖 Claude Code CLI (`claude.exe`)，不能修改其内部逻辑

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 使用智谱 AI API 代理 | 用户环境配置 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-26 after Phase 5 completion*
