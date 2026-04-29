---
phase: 08-advanced-features
plan: 01
subsystem: multi-window
tags: [electron, window-manager, channel-registry, notification-routing, tray, theme-broadcast]

# Dependency graph
requires: []
provides:
  - "WindowManager 类 — 窗口生命周期管理"
  - "WindowChannelRegistry — 窗口-频道双向映射"
  - "sendToWebview 定向路由（按 channelId）"
  - "主题变更广播到所有窗口"
  - "通知精准发送到目标窗口"
  - "托盘双击恢复最后活跃窗口"
affects: [main-process, ipc, notification, tray, preload]

# Tech tracking
tech-stack:
  added: [window-manager.ts, window-registry.ts, window-handlers.ts]
  patterns: [window-channel-registry, broadcast-to-all, last-active-tracking]

key-files:
  created:
    - src/main/window/window-manager.ts
    - src/main/window/window-registry.ts
    - src/main/ipc/window-handlers.ts
  modified:
    - src/main/index.ts
    - src/main/ipc/claude-webview.ts
    - src/main/notification/notification-manager.ts
    - src/main/tray/tray-manager.ts
    - src/preload/index.ts
    - src/preload/index.d.ts

key-decisions:
  - "sendToWebview 无 channelId 时广播，有 channelId 时定向发送"
  - "WindowManager 通过构造函数注入到 claude-webview，避免循环依赖"
  - "nativeTheme 变更通过 broadcastToAll 同步到所有窗口"
  - "NotificationManager 构造函数改为接受 WindowManager 而非 BrowserWindow"

patterns-established:
  - "窗口-频道双向映射（WindowChannelRegistry）"
  - "IPC 定向路由（sendToWebview + channelId）"
  - "主题广播（broadcastToAll）"

requirements-completed: [UX-11]

# Metrics
duration: 8min
completed: 2026-04-28
---

# Phase 8 Plan 01: WindowManager + WindowChannelRegistry + 多窗口路由

创建多窗口基础设施：WindowManager 管理窗口生命周期，WindowChannelRegistry 维护窗口-频道双向映射，改造 sendToWebview 支持按 channelId 定向路由。

## 性能

- **持续时间:** 约 8 分钟（含 2 次修复提交）
- **修改文件:** 9
- **新增代码:** +452 行
- **删除代码:** -148 行

## 成果

- 创建 WindowChannelRegistry 类，维护窗口ID-频道ID双向映射，支持注册、注销、迁移、查询
- 创建 WindowManager 类，管理所有 BrowserWindow 实例的生命周期和焦点跟踪
- 重构 sendToWebview 支持定向路由（按 channelId）和广播模式
- NotificationManager 从接受 BrowserWindow 改为接受 WindowManager，实现通知精准路由
- TrayManager 双击恢复最后活跃窗口而非固定第一个窗口
- nativeTheme 变更广播到所有窗口并同步背景色
- 移除所有 BrowserWindow.getAllWindows()[0] 硬编码引用
- 新增 window:register-channel / window:tab-activated IPC 桥接

## 任务提交

1. **主实现** - `f812c7c` feat(window): add WindowManager and multi-window routing infrastructure
2. **ESLint 修复** - `1f6cab3` fix: resolve eslint errors in new multi-window modules
3. **路径修复** - `246de2d` fix(window): correct preload and renderer paths for Vite flat bundle

## 修改的文件

- `src/main/window/window-manager.ts` (新建) - WindowManager 类，窗口生命周期管理
- `src/main/window/window-registry.ts` (新建) - WindowChannelRegistry 窗口-频道映射
- `src/main/ipc/window-handlers.ts` (新建) - 窗口管理 IPC 注册
- `src/main/index.ts` - 使用 WindowManager 替代独立 createWindow，改造主题同步和 second-instance
- `src/main/ipc/claude-webview.ts` - sendToWebview 支持定向路由 + setWindowManager 注入
- `src/main/notification/notification-manager.ts` - 改用 WindowManager 定向通知
- `src/main/tray/tray-manager.ts` - 接受 WindowManager，双击恢复最后活跃窗口
- `src/preload/index.ts` - 新增 windowRegisterChannel / windowTabActivated
- `src/preload/index.d.ts` - 新增类型声明

## 做出的决策

- sendToWebview 无 channelId 时广播（如 init response），有 channelId 时定向发送到拥有该频道的窗口
- WindowManager 通过 setWindowManager() 函数注入到 claude-webview 模块，避免循环依赖
- 窗口焦点跟踪通过 BrowserWindow 的 'focus' 事件自动更新 lastActiveWindowId
- Vite SSR 将主进程代码打包到 out/main/index.js（flat），因此 preload 和 renderer 路径需要相对于 out/main/ 而非 out/main/window/

## 与计划的偏差

- 额外提交了 2 个修复：ESLint 配置调整和 Vite flat bundle 路径问题
- 路径问题是因为 Vite 打包后 __dirname 与源码目录结构不同，preload 路径从 ../../preload 改为 ../preload

## 遇到的问题

1. ESLint 不允许下划线前缀的未使用变量 — 在 eslint.config.mjs 中添加规则
2. Vite flat bundle 导致 __dirname 变为 out/main/ 而非 out/main/window/，preload 路径需要调整

## Self-Check: PASSED

- src/main/window/window-manager.ts: FOUND
- src/main/window/window-registry.ts: FOUND
- src/main/ipc/window-handlers.ts: FOUND
- src/main/index.ts uses WindowManager: VERIFIED
- src/main/ipc/claude-webview.ts has setWindowManager: VERIFIED
- src/main/notification/notification-manager.ts accepts WindowManager: VERIFIED
- src/main/tray/tray-manager.ts accepts WindowManager: VERIFIED
- src/preload/index.ts has windowRegisterChannel: VERIFIED
- Commit f812c7c: FOUND
- Commit 1f6cab3: FOUND
- Commit 246de2d: FOUND

---
*Phase: 08-advanced-features*
*Completed: 2026-04-28*
