---
phase: 08-advanced-features
plan: 03
subsystem: multi-window
tags: [drag-out, tab, window, ghost-preview, ipc]
dependency_graph:
  requires: [08-01-PLAN]
  provides: [tab-drag-out, ghost-window-preview, window-restore-tab]
  affects: [ChatPanel.vue, window-manager.ts, window-handlers.ts]
tech-stack:
  added: [screen API, ghost BrowserWindow, setInterval cursor tracking]
  patterns: [edge-detection, drag-state-machine, async drag lifecycle]
key-files:
  created: []
  modified:
    - src/main/window/window-manager.ts
    - src/main/ipc/window-handlers.ts
    - src/renderer/src/components/ChatPanel.vue
decisions:
  - ghost window uses transparent + frameless + alwaysOnTop for drag preview
  - cursor tracking via setInterval 16ms instead of mouse events (main process)
  - drag state saved to temp variables before createWindow to prevent state corruption
  - onDragEnd changed from sync to async to support tabDragEnd IPC invoke
metrics:
  duration: 4min
  completed: 2026-04-28
  tasks: 2
  files: 3
---

# Phase 8 Plan 03: 标签拖拽出窗口交互 Summary

实现标签页拖拽到窗口边缘时创建新窗口的完整交互链路，包括 ghost 预览窗口、边缘检测、频道迁移和标签页恢复。

## 完成的任务

### Task 1: WindowManager 拖拽预览窗口方法 + IPC

**Commit:** 1ef9c87

在 WindowManager 中新增 5 个方法：

- `startDragPreview(channelId, tabId)` -- 创建半透明 ghost 窗口跟随鼠标，每 16ms 更新位置
- `updateDragPreview()` -- 更新 ghost 窗口位置到当前光标处
- `finalizeDragOut(sourceWindowId)` -- 销毁 ghost 窗口，在光标位置创建新 BrowserWindow，迁移频道注册
- `cancelDrag()` -- 销毁 ghost 窗口并清理所有拖拽状态
- `getDragState()` -- 返回当前 dragChannelId/dragTabId 给 IPC handler

在 window-handlers.ts 中新增 3 个 IPC：

- `tab-drag:start` (on) -- 接收渲染进程拖拽开始通知
- `tab-drag:end` (handle) -- 完成拖拽创建新窗口，发送 `window:restore-tab` 给新窗口
- `tab-drag:cancel` (on) -- 取消拖拽

### Task 2: ChatPanel.vue 拖拽检测

**Commit:** 1ef9c87 (同一提交)

在 ChatPanel.vue 中：

- 新增 `isDraggingOut`、`dragOutThreshold`、`dragOutNotified` 状态变量
- 新增 `checkDragOutWindow(e)` 边缘检测函数（20px 阈值）
- 修改 `onDragOver` 调用 `checkDragOutWindow`
- 重写 `onDragEnd` 为 async，处理拖出成功/失败/取消三种路径
- 在 `launch_claude` 处注册 `windowRegisterChannel`
- 在 `onMounted` 中监听 `onWindowRestoreTab` 事件恢复标签页
- 在 `onBeforeUnmount` 中清理事件监听

## Deviations from Plan

None -- 计划完全按设计执行。

Preload 桥接层（tabDragStart/tabDragEnd/tabDragCancel/onWindowRestoreTab）已由 Plan 02 预先铺设，无需重复添加。

## Verification

- TypeScript 编译通过（`npx tsc --noEmit` 零错误）
- 所有 IPC 类型声明已同步（index.d.ts）
- ghost 窗口使用 transparent + frameless + alwaysOnTop + skipTaskbar 配置
- 新窗口位置使用 workArea 边界约束防止超出屏幕

## Known Stubs

None.

## Threat Flags

None.
