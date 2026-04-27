---
phase: 03-ux-enhancement
plan: 03
subsystem: process-health
tags: [health-check, crash-recovery, timeout-cleanup, global-exception-handler, tdd]
dependency_graph:
  requires: [03-01]
  provides: [process-health-check, crash-recovery-ipc, timeout-cleanup, global-exception-handler, renderer-crash-ui]
  affects: [process-manager.ts, claude-webview.ts, index.ts, ChatPanel.vue, preload]
tech_stack:
  added: []
  patterns: [TDD-red-green-refactor, process-kill-pid0-healthcheck, IPC-crash-notification, resolver-timeoutId-pattern]
key_files:
  created:
    - src/main/claude/__tests__/process-manager-healthcheck.test.ts
  modified:
    - src/main/claude/process-manager.ts
    - src/main/ipc/claude-webview.ts
    - src/main/index.ts
    - src/renderer/src/components/ChatPanel.vue
    - src/preload/index.ts
    - src/preload/index.d.ts
decisions:
  - "心跳检测使用 process.kill(pid, 0) 检查进程存活，结合 _running 状态防止误报"
  - "非 persistent channel 崩溃时不立即从 channels 中删除，保留记录用于恢复"
  - "PermissionResolver 使用 resolver 对象模式存储 timeoutId，解决 setTimeout 赋值时序问题"
  - "uncaughtException 使用 dialog.showErrorBox 弹对话框，unhandledRejection 仅记录日志"
  - "进程无响应时不在渲染进程自动重启，等待用户确认后手动触发"
metrics:
  duration: 10m51s
  completed: 2026-04-25T01:38:08Z
  tasks: 2
  files: 7
  test_cases: 8
---

# Phase 03 Plan 03: 进程健康监控与崩溃恢复 Summary

主进程心跳检测 + 崩溃自动恢复 IPC + 超时定时器清理 + 全局异常处理 + 渲染进程恢复 UI

## Changes by Task

### Task 1: 主进程心跳检测 + 崩溃恢复 IPC + 超时清理 + 全局异常处理 (D-10, D-11, D-12, D-24)

**Commit:** e7d4887 (test/RED) + 0996a4c (feat/GREEN+implementation)

**process-manager.ts:**
- `startHealthCheck(onUnresponsive, intervalMs=30000)`: 定期 `process.kill(pid, 0)` 检查进程存活
- `stopHealthCheck()`: 清除心跳定时器
- `resumeSessionId` getter: 保存启动时的 sessionId 用于崩溃恢复
- `stop()` 同时调用 `stopHealthCheck()` 防止内存泄漏

**claude-webview.ts:**
- `PermissionResolver` 接口添加 `timeoutId` 字段
- `Channel` 接口添加 `lastSessionId` 字段
- `sendToolPermissionRequest`: 使用 resolver 对象模式存储 timeoutId
- `handleCloseChannel`: 遍历 permissionResolvers 清理所有超时定时器
- `proc.on('exit')`: 非持久化频道崩溃时通知渲染进程而非直接删除
- `claude:recover-process` IPC 处理程序: 使用保存的 sessionId 重新启动频道
- 进程启动后自动调用 `startHealthCheck()`，无响应时通过 IPC 通知渲染进程

**index.ts:**
- `process.on('uncaughtException')`: 记录日志 + `dialog.showErrorBox` 弹对话框
- `process.on('unhandledRejection')`: 仅记录日志

**preload/index.ts + index.d.ts:**
- `claudeRecoverProcess(channelId)` IPC 调用
- `onProcessCrashed(callback)` 事件监听
- `onProcessUnresponsive(callback)` 事件监听

**测试:** 8 个测试用例全部通过（使用 vi.useFakeTimers + vi.spyOn）

### Task 2: 渲染进程崩溃恢复 UI + 自动重连 (D-10, D-11 渲染侧)

**Commit:** 68e76a8

**ChatPanel.vue:**
- `unresponsiveChannels` ref: 追踪无响应的频道集合
- `currentUnresponsiveChannelId` / `currentUnresponsive` computed: 判断当前活跃标签是否受影响
- `restartUnresponsiveProcess(channelId)`: 手动重启挂死进程
- `onMounted`: 注册 `onProcessCrashed` 和 `onProcessUnresponsive` 事件监听
  - 崩溃: 可恢复时自动调用 `claudeRecoverProcess`，不可恢复时显示错误
  - 无响应: 添加到 unresponsiveChannels 集合，显示状态消息
- `onBeforeUnmount`: 清理所有事件监听器
- 模板: `unresponsive-overlay` 覆盖层 + "重启进程" 按钮
- CSS: 居中半透明面板，Catppuccin Mocha 主题配色

## Deviations from Plan

None - plan executed exactly as written.

## Deferred Items

预先存在的 ESLint 错误（不在当前任务修改范围内）:
- `src/main/index.ts` line 14: `no-empty` on `catch {}`
- `src/main/ipc/claude-webview.ts`: `_done` 参数未使用

## Known Stubs

None.

## Threat Flags

No new threat surface introduced beyond what was documented in the plan's threat model.

## Self-Check: PASSED

- All 7 modified/created files exist on disk
- All 3 commits (e7d4887, 0996a4c, 68e76a8) verified in git log
- TypeScript compilation: 0 error
- Health check tests: 8/8 passed
- ESLint: 0 new errors introduced (pre-existing errors documented in Deferred Items)
