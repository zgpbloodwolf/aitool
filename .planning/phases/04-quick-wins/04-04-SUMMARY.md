---
phase: 04-quick-wins
plan: 04
subsystem: ui
tags: [notification, BrowserWindow, IPC, executeJavaScript, Catppuccin-Mocha, stacking, transparent]

# 依赖图
requires:
  - phase: 04-01
    provides: Settings store (soundEnabled, soundVolume, soundComplete/Permission/Error)
  - phase: 04-03
    provides: useSound composable (playSound for notification sound)
provides:
  - NotificationManager 主进程通知窗口管理（堆叠、定位、IPC 按钮）
  - notification-registry 共享引用模块（避免循环依赖）
  - 通知窗口 HTML（Catppuccin Mocha 风格，5 种通知类型，交互按钮）
  - useNotification composable（渲染端跳转标签页 + 声音播放监听）
  - D-03 智能触发（executeJavaScript 查询标签页可见性）
affects: [04-05]

# 技术追踪
tech-stack:
  added: []
patterns:
  - "通知窗口: BrowserWindow frameless + transparent + alwaysOnTop + URL 查询参数传数据"
  - "D-03 智能触发: isFocused() + executeJavaScript(__channelToTab/__activeTabId) 双重检查"
  - "通知-注册表模式: notification-registry.ts 共享引用避免 index.ts 和 claude-webview.ts 循环依赖"
  - "通知跳转: 主进程 IPC → 渲染端 CustomEvent → ChatPanel.switchTab"

key-files:
  created:
    - src/main/notification/notification-manager.ts
    - src/main/notification/notification-registry.ts
    - src/notification/index.html
    - src/renderer/src/composables/useNotification.ts
  modified:
    - src/main/index.ts
    - src/main/ipc/claude-webview.ts
    - src/preload/index.ts
    - src/preload/index.d.ts
    - src/renderer/src/App.vue
    - src/renderer/src/components/ChatPanel.vue
    - electron-builder.yml

key-decisions:
  - "使用 executeJavaScript 查询 window.__channelToTab/__activeTabId 实现 D-03 标签页可见性检查，避免复杂的 IPC 双向通信"
  - "通知数据通过 URL 查询参数传递到 HTML 窗口，HTML 端使用 escapeHtml() 防止 XSS"
  - "通知跳转使用 CustomEvent 从 useNotification 传递到 App.vue，因为 App.vue 持有 chatPanelRef"
  - "channelId 在 executeJavaScript 中先清理非字母数字字符（T-04-13 注入防护）"

patterns-established:
  - "通知窗口模式: BrowserWindow({ frame: false, transparent: true, alwaysOnTop: true }) + loadFile + query params"
  - "跨模块共享管理器: registry 模块导出 let + set 函数，避免循环导入"
  - "主→渲染→组件通信: 主进程 IPC → preload → composable → CustomEvent → 父组件 ref 调用"

requirements-completed: [UX-01]

# 度量
duration: 5min
completed: 2026-04-26
---

# Phase 4 Plan 04: Interactive Notification System Summary

**自定义 BrowserWindow 通知系统（Catppuccin Mocha 风格，5 种类型交互按钮，最多 3 条堆叠，D-03 智能触发，executeJavaScript 标签页可见性检查）**

## 性能

- **时长:** 5 分钟
- **开始:** 2026-04-26T02:22:52Z
- **完成:** 2026-04-26T02:27:27Z
- **任务:** 2
- **修改文件:** 11

## 成果

- NotificationManager 管理通知窗口的创建、堆叠（最多 3 条）、定位（屏幕右下角）和自动关闭
- 通知 HTML 支持 5 种类型：回复完成、权限请求、方案选择、文本回复、错误
- 权限通知带允许/拒绝按钮，点击后通过 IPC 转发到主进程
- D-03 智能触发：窗口不在前台时显示通知；窗口在前台时通过 executeJavaScript 检查标签页可见性
- ChatPanel 通过 window.__channelToTab 和 window.__activeTabId 暴露标签状态
- useNotification composable 处理跳转标签页和前台声音播放
- 通知触发点集成到 claude-webview.ts 的 result、permission request、error 事件
- electron-builder.yml 配置了通知 HTML 打包
- TypeScript 编译零错误通过

## 任务提交记录

每个任务独立提交：

1. **Task 1: Create notification manager, registry, and window HTML** - `d96aed8` (feat)
2. **Task 2: Integrate notifications with IPC events and tab visibility** - `5049121` (feat)

## 创建/修改的文件

- `src/main/notification/notification-manager.ts` - NotificationManager 类，BrowserWindow 生命周期、堆叠管理、D-03 智能触发、IPC 按钮处理
- `src/main/notification/notification-registry.ts` - 共享引用模块，避免循环依赖
- `src/notification/index.html` - 通知窗口 HTML，Catppuccin Mocha CSS，5 种通知类型 UI，escapeHtml 防 XSS
- `src/renderer/src/composables/useNotification.ts` - 渲染端通知事件监听（跳转标签页 + 声音播放）
- `src/main/index.ts` - 添加 NotificationManager 初始化
- `src/main/ipc/claude-webview.ts` - 添加 notificationManager 触发点（result/permission/error）
- `src/preload/index.ts` - 添加 notificationAction、onNotificationFocusTab、onNotificationPlaySound
- `src/preload/index.d.ts` - 添加对应类型声明
- `src/renderer/src/App.vue` - 集成 useNotification + CustomEvent 标签页跳转
- `src/renderer/src/components/ChatPanel.vue` - 暴露 __channelToTab/__activeTabId 到 window
- `electron-builder.yml` - 添加 extraFiles 打包通知 HTML

## 做出的决策

- 使用 `executeJavaScript` 查询渲染进程的 `window.__channelToTab` 和 `window.__activeTabId` 实现 D-03 标签页可见性检查，比 IPC 双向通信简单得多
- 通知数据通过 URL 查询参数传递到 HTML 窗口，HTML 端使用 `escapeHtml()` 函数（通过 textContent 赋值）防止 XSS
- 通知跳转使用 `CustomEvent` 从 useNotification composable 传递到 App.vue，因为 App.vue 持有 chatPanelRef
- channelId 在 `executeJavaScript` 模板字符串中先清理非字母数字字符，防止注入风险（T-04-13）

## 计划偏差

无 - 按计划完全执行。计划中讨论了多种 IPC 通信方案，最终采用了计划末尾推荐的 executeJavaScript 方案。

## 遇到的问题

无。

## 用户设置要求

无 - 不需要外部服务配置。

## 下一阶段准备

- 通知系统已完整实现，04-05 自动更新功能可直接独立开发
- 通知 HTML 已配置打包到生产构建
- 声音播放通过 useSound composable 集成，使用设置面板中的声音开关控制

## Self-Check: PASSED

- [x] src/main/notification/notification-manager.ts -- FOUND
- [x] src/main/notification/notification-registry.ts -- FOUND
- [x] src/notification/index.html -- FOUND
- [x] src/renderer/src/composables/useNotification.ts -- FOUND
- [x] Commit d96aed8 (Task 1) -- FOUND
- [x] Commit 5049121 (Task 2) -- FOUND

---
*Phase: 04-quick-wins*
*Completed: 2026-04-26*
