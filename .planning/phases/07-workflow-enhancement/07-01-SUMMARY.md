---
phase: 07-workflow-enhancement
plan: 01
subsystem: token-usage
tags: [persistence, ipc, data-pipeline]
dependency_graph:
  requires: [claude-webview Channel token tracking]
  provides: [token-usage-store, token-usage IPC, preload bridge]
  affects: [src/main/ipc/claude-webview.ts, src/main/index.ts, src/preload/index.ts]
tech_stack:
  added: [chart.js@^4.5.1, vue-chartjs@^5.3.3]
  patterns: [JSON file persistence, IPC handler registration, write queue]
key_files:
  created:
    - src/main/claude/token-usage-store.ts
    - src/main/ipc/token-usage.ts
  modified:
    - src/main/ipc/claude-webview.ts
    - src/main/index.ts
    - src/preload/index.ts
    - src/preload/index.d.ts
    - package.json
decisions:
  - 写入队列使用 Promise chain 串行化，防止并发 JSON 写入损坏
  - range 参数验证在 getTokenUsageStats 内部完成，非法值降级为 week
  - preload 层使用 Promise<unknown> 避免主进程类型泄漏到渲染进程
metrics:
  duration: 7min
  completed: 2026-04-27
  tasks: 3
  files: 6
---

# Phase 07 Plan 01: Token 用量数据管线 Summary

Token 用量 JSON 持久化模块 + IPC 通道 + preload 桥接，为统计面板提供后端数据基础

## Changes Made

### Task 1: 创建 token-usage-store 持久化模块
- **Commit:** a05e4a1
- 创建 `src/main/claude/token-usage-store.ts`
  - DayRecord + SessionRecord 接口（按天汇总结构 D-02）
  - `recordTokenUsage()` -- Channel 关闭时记录 token 数据
  - `getTokenUsageStats()` -- 按时间范围聚合，按工作区分组
  - 写入队列（Promise chain）防止并发写入损坏
  - 90 天自动清理逻辑（D-04）
  - range 参数验证，非法值降级为 'week'（T-07-01）
- `package.json` 添加 chart.js 和 vue-chartjs 依赖

### Task 2: 创建 Token IPC handlers + 修改 handleCloseChannel
- **Commit:** c668045
- 创建 `src/main/ipc/token-usage.ts` -- 注册 `token-usage:get-stats` IPC 通道
- 修改 `src/main/ipc/claude-webview.ts`:
  - Channel 接口新增 `cwd: string` 字段
  - `channels.set` 中记录 `cwd: cwd || process.cwd()`
  - `handleCloseChannel` 中在 `channel.process.stop()` 前调用 `recordTokenUsage`
- 修改 `src/main/index.ts` -- 注册 `registerTokenUsageHandlers()`

### Task 3: 扩展 preload IPC 桥接
- **Commit:** fc3160c
- `src/preload/index.ts`:
  - 新增 `getTokenUsageStats` (handle 模式)
  - 新增 `onOpenDirectory` (on/removeListener 模式，为 UX-10 预留)
- `src/preload/index.d.ts`:
  - 添加 `getTokenUsageStats` 完整类型声明
  - 添加 `onOpenDirectory` 类型声明

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 解决 stash 合并冲突**
- **Found during:** Task 1 提交前
- **Issue:** `src/renderer/src/env.d.ts` 和 `src/renderer/src/stores/settings.ts` 存在未合并的冲突标记，阻塞 git commit
- **Fix:** 手动合并冲突内容，保留两边完整代码
- **Files modified:** src/renderer/src/env.d.ts, src/renderer/src/stores/settings.ts
- **Commit:** a05e4a1

## Verification Results

1. `recordTokenUsage` 在 handleCloseChannel 中被正确调用
2. `getTokenUsageStats` 在 preload 中通过 IPC 桥接暴露
3. `token-usage:get-stats` IPC handler 已注册
4. chart.js 和 vue-chartjs 依赖已添加到 package.json
5. Channel 接口新增 cwd 字段，handleLaunchClaude 中记录 cwd

## Self-Check: PASSED

- [x] src/main/claude/token-usage-store.ts -- FOUND
- [x] src/main/ipc/token-usage.ts -- FOUND
- [x] a05e4a1 -- FOUND
- [x] c668045 -- FOUND
- [x] fc3160c -- FOUND
