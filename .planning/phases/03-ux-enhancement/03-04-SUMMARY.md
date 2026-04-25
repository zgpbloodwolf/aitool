---
phase: 03-ux-enhancement
plan: 04
subsystem: renderer-ui
tags: [tab-labels, status-indicators, middle-click-close, ux-enhancement]
dependency_graph:
  requires: [03-01]
  provides: [smart-tab-labels, tab-status-indicators, middle-click-close]
  affects: [ChatPanel.vue]
tech_stack:
  added: []
  patterns: [async-handleSystemMessage, reactive-Map-for-tab-status]
key_files:
  created: []
  modified:
    - src/renderer/src/components/ChatPanel.vue
decisions:
  - handleSystemMessage 改为 async 以支持 claudeListSessions 异步调用
  - 标签名截取前 20 字符，获取失败时保持原始"对话 N"格式
  - 状态指示器复用已有的 pulse 动画 keyframes
  - forwardToWebview 中检测 request 类型消息设置 waiting 状态
metrics:
  duration: 3m
  completed: 2026-04-25
  tasks: 1
  files: 1
---

# Phase 3 Plan 4: 智能标签名 + 状态指示器 + 中键关闭 Summary

增强标签页体验：智能标签名从会话摘要提取、运行/等待/空闲状态指示器圆点、中键点击关闭标签。

## What Changed

### Task 1: 智能标签名 + 状态指示器 + 中键关闭 (D-13, D-14, D-15)

- **D-13 智能标签名**: `handleSystemMessage` 的 `init` 分支现在会从消息中的 `summary` 字段或通过 `claudeListSessions()` API 查找 `session_id` 对应的摘要提取前 20 字符作为标签名。获取失败时保持原始"对话 N"格式
- **D-14 标签状态指示器**: 新增 `tabStatuses` 响应式 Map，在 `handleSystemMessage` 各分支更新状态（init/hook_started -> running, result -> idle, 其他 -> running）。在 `forwardToWebview` 中检测 `request` 类型消息设置为 waiting 状态。标签模板添加 6px 圆点，绿色(running)/黄色(waiting)/灰色(idle)
- **D-15 中键关闭**: `.tab-item` 元素添加 `@mousedown.middle.prevent="closeTab(tab.id)"`，复用已有 `closeTab` 方法
- **改进**: `_channelId` 参数现在被使用，消除了之前的 ESLint `no-unused-vars` 错误

## Key Decisions

1. **handleSystemMessage 改为 async**: 为了支持 `claudeListSessions()` 的异步调用而不使用 `.then()` 链式调用，将函数签名从 `function` 改为 `async function`。调用方 `forwardToWebview` 不需要 await 返回值
2. **复用已有 pulse 动画**: 文件中已存在 `@keyframes pulse` 定义（用于状态栏圆点），新标签状态圆点直接复用该动画
3. **CSS 变量带 fallback**: 使用 `var(--success, #a6e3a1)` 格式，确保即使 CSS 变量未定义也能正常显示

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

| Check | Result |
|-------|--------|
| TypeScript 编译 | PASSED (0 errors) |
| ESLint (新增代码) | PASSED (0 new errors) |
| tabStatuses ref | FOUND (line 77) |
| init 分支摘要提取 | FOUND (summary + session_id) |
| result 分支 idle 状态 | FOUND (line 164) |
| forwardToWebview waiting 状态 | FOUND (line 384) |
| 模板 tab-status-dot | FOUND (line 673) |
| 模板 mousedown.middle | FOUND (line 665) |
| CSS .tab-status-dot | FOUND (4 rules) |

## Self-Check: PASSED

- ChatPanel.vue 存在并已修改
- 提交哈希 a80c381 已验证存在
- TypeScript 编译 0 error
- ESLint 新增代码 0 new error（预存 7 个 error 均在未修改的函数上）

## Commits

| Hash | Message |
|------|---------|
| `a80c381` | feat(03-04): add smart tab labels, status indicators, and middle-click close |
