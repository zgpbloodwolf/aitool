---
phase: 07b-stop-button-fix
plan: 01
status: complete
started: 2026-04-27
completed: 2026-04-27
---

## What Was Built

用 stdin 控制消息替代 SIGINT 信号实现停止按钮中断功能。分析了 VSCode Claude Code 插件源码，发现其通过 stdin 管道发送 `{type: "control_request", request: {subtype: "interrupt"}}` 控制消息实现中断，而非依赖平台相关的进程信号。

## Changes

### src/main/claude/process-manager.ts
- **interrupt() 方法**: 完全重写 — 通过 stdin 管道发送 `control_request` 控制消息，不再使用 `process.kill(pid, 'SIGINT')`
- 消息格式: `{request_id, type: "control_request", request: {subtype: "interrupt"}}`，与 VSCode 插件一致
- 复用已有的 `send()` 方法写入 stdin 管道

### src/main/ipc/claude-webview.ts
- **handleInterrupt 函数**: 简化为统一路径 — 移除 `process.platform !== 'win32'` 分支判断
- 移除合成 result 消息（CLI 会自己输出包含 `[Request interrupted by user]` 的 result 消息）
- 添加 5 秒超时回退机制 — 如果 CLI 未响应控制消息，回退到 kill-and-resume 路径
- 保留 `channel.interrupted` 标记和 `resumeChannelAndSendMessage`（回退路径使用）

## Key Files

- modified: src/main/claude/process-manager.ts
- modified: src/main/ipc/claude-webview.ts

## Verification

- [x] TypeScript 编译零错误
- [x] `control_request` 存在于 process-manager.ts
- [x] `SIGINT` 不再作为代码逻辑（仅在注释中提到）
- [x] `detached` 不存在于 process-manager.ts
- [x] `process.platform` 不存在于 handleInterrupt 中
- [x] 超时回退逻辑存在于 handleInterrupt
- [x] send()、stop()、start() 方法未被修改
- [x] resumeChannelAndSendMessage 和 handleIoMessage 未被修改

## Self-Check

**Status:** PASSED

- interrupt() 通过 this.send() 发送控制消息
- handleInterrupt 无平台分支判断
- 5 秒超时回退到 kill-and-resume
- 诊断日志保留
- TypeScript 编译通过

## Notes

- 消息格式与 VSCode Claude Code 插件 `Query.interrupt()` → `request({subtype: "interrupt"})` 完全一致
- CLI 使用 `--input-format stream-json` 启动，stdin 天然支持接收此类消息
- 功能验证需手动测试: `pnpm dev` → 发送消息 → 点击停止按钮 → 观察控制台日志

## Issues

None.
