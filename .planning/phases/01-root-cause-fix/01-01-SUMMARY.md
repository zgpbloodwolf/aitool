---
phase: 01-root-cause-fix
plan: 01-01
status: complete
started: "2026-04-24"
completed: "2026-04-24"
---

# Plan 01-01: 移除 modelUsage/total_cost_usd 注入

## Objective

移除 `result` 消息中的 `modelUsage` 和 `total_cost_usd` 注入，修复 429 速率限制错误。

## What Was Built

从 `src/main/ipc/claude-webview.ts` 中删除了 14 行注入代码（原第 201-214 行）。该代码在每个 `result` 消息上设置 `total_cost_usd = 0` 和 `modelUsage` 对象，激活了 Claude Code webview 中休眠的用量追踪代码路径，与智谱 AI 的严格并发限制冲突导致 429 错误。

## Changes Made

| File | Change |
|------|--------|
| `src/main/ipc/claude-webview.ts` | 移除 `result` 消息注入块（14 行） |

## Preserved

- Token 追踪（`stream_event` 处理器）
- `get_context_usage` IPC 处理器
- `get_context_usage` webview 请求处理器
- Badge 脚本（`webview-server.ts`，独立从 `stream_event` 读取）

## Acceptance Results

| Check | Result |
|-------|--------|
| `total_cost_usd = 0` not in file | ✓ |
| `result.modelUsage =` not in file | ✓ |
| `注入 modelUsage` not in file | ✓ |
| `stream_event` handler preserved | ✓ |
| `get_context_usage` handlers preserved | ✓ |
| TypeScript compilation | ✓ |

## Self-Check: PASSED

All acceptance criteria met. No deviations.

## Manual Verification Needed

运行 `pnpm dev`，发送消息，确认：
1. 不再出现 429 错误
2. Badge 仍显示 token 使用量百分比
