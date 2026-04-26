---
phase: 04-quick-wins
plan: 02
subsystem: ui
tags: [electron, tray, system-tray, context-menu, close-behavior]

# 依赖图
requires:
  - phase: 04-01
    provides: Settings store 和 SettingsDrawer 中的关闭行为 radio group UI
provides:
  - Tray manager 模块（图标、上下文菜单、双击恢复、关闭行为管理）
  - IPC 通道（updateCloseBehavior, onCloseBehaviorChanged）
  - 关闭行为 JSON 文件持久化
affects: [04-03, 04-04, 04-05]

# 技术追踪
tech-stack:
  added: []
  patterns:
    - "Tray 模块级引用防 GC: let tray: Tray | null = null"
    - "主进程 JSON 文件持久化: app.getPath('userData')/close-behavior.json"

key-files:
  created:
    - src/main/tray/tray-manager.ts
  modified:
    - src/main/index.ts
    - src/preload/index.ts
    - src/preload/index.d.ts

key-decisions:
  - "关闭行为使用独立 JSON 文件存储而非 IPC 桥接 localStorage，避免渲染进程未就绪时无法读取"
  - "isQuitting 标志用于区分托盘退出和窗口关闭按钮点击"

patterns-established:
  - "Tray 管理: setupTray(mainWindow) 在 app.whenReady() 中调用 + registerTrayHandlers() 注册 IPC"
  - "主进程持久化: userData 目录 JSON 文件 + fs 同步读写"

requirements-completed: [UX-02]

# 度量
duration: 2min
completed: 2026-04-26
---

# Phase 4 Plan 02: System Tray Summary

**Windows 系统托盘图标 + 右键上下文菜单（新建对话/显示窗口/退出）+ 双击恢复窗口 + 首次关闭询问并记住选择 + IPC 桥接设置面板同步关闭行为**

## 性能

- **时长:** 2 分钟
- **开始:** 2026-04-26T02:13:08Z
- **完成:** 2026-04-26T02:15:30Z
- **任务:** 2
- **修改文件:** 4

## 成果

- 系统托盘图标在应用启动时自动显示，使用 build/icon.ico
- 右键菜单包含：新建对话、显示窗口、退出三个选项
- 双击托盘图标恢复最小化/隐藏的窗口
- 首次关闭窗口弹出对话框询问：最小化到托盘 or 退出应用
- 用户选择持久化到 userData/close-behavior.json，后续关闭自动执行
- 设置面板通过 IPC 通道同步关闭行为偏好到主进程
- TypeScript 编译零错误通过（主进程和渲染进程）

## 任务提交记录

每个任务独立提交：

1. **Task 1: Create tray manager module** - `1868196` (feat)
2. **Task 2: Integrate tray into main process + add IPC channels** - `d778365` (feat)

## 创建/修改的文件

- `src/main/tray/tray-manager.ts` - 系统托盘管理器：Tray 实例创建、上下文菜单、双击恢复、关闭行为管理、IPC 处理器
- `src/main/index.ts` - 导入并调用 setupTray/registerTrayHandlers，在 app.whenReady() 中初始化托盘
- `src/preload/index.ts` - 添加 updateCloseBehavior 和 onCloseBehaviorChanged IPC 方法
- `src/preload/index.d.ts` - 添加两个新方法的 TypeScript 类型声明

## 做出的决策

- 关闭行为使用独立的 JSON 文件（`app.getPath('userData')/close-behavior.json`）而非通过 IPC 桥接 localStorage，因为主进程在渲染进程未就绪时就需要读取关闭行为
- `isQuitting` 标志确保托盘菜单的「退出」和 app.quit() 能绕过窗口关闭拦截器
- 首次关闭询问后同时通过 IPC 通知渲染进程 settings store 更新关闭行为值

## 计划偏差

无 - 按计划完全执行。

## 遇到的问题

无。

## 用户设置要求

无 - 不需要外部服务配置。

## 下一阶段准备

- Tray 模块已就绪，04-03~04-05 可直接使用托盘功能
- 关闭行为偏好同步到渲染进程，SettingsDrawer 中的 radio group 可通过 `updateCloseBehavior` IPC 更新主进程存储
- 后续 plan（缩放、声音、通知、自动更新）可参考此 IPC 模式扩展 preload API

## Self-Check: PASSED

- [x] src/main/tray/tray-manager.ts — FOUND
- [x] Commit 1868196 (Task 1) — FOUND
- [x] Commit d778365 (Task 2) — FOUND

---
*Phase: 04-quick-wins*
*Completed: 2026-04-26*
