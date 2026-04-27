---
phase: 07-workflow-enhancement
plan: 02
subsystem: context-menu
tags: [windows-shell, nsis, single-instance, registry, ipc]
dependency_graph:
  requires: [preload onOpenDirectory bridge from 07-01]
  provides: [installer.nsh, single-instance lock, registry check, open-directory IPC flow]
  affects: [build/installer.nsh, electron-builder.yml, src/main/index.ts, src/renderer/src/components/ChatPanel.vue]
tech_stack:
  added: []
  patterns: [NSIS customInstall/customUnInstall macros, requestSingleInstanceLock, reg.exe runtime check]
key_files:
  created:
    - build/installer.nsh
  modified:
    - electron-builder.yml
    - src/main/index.ts
    - src/renderer/src/components/ChatPanel.vue
decisions:
  - NSIS 使用 SHCTX 自动路由 HKLM/HKCU，与安装模式匹配
  - 单实例锁在 app.whenReady 之前注册，确保命令行参数不会丢失
  - 注册表运行时检查仅在打包模式下执行，开发模式跳过
  - ChatPanel 使用可选链 ?. 防护 onOpenDirectory，兼容 preload 尚未定义的场景
metrics:
  duration: 3min
  completed: 2026-04-27
  tasks: 2
  files: 4
---

# Phase 07 Plan 02: Windows 右键菜单集成 Summary

NSIS 安装脚本 + 单实例锁 + 注册表运行时检查 + 渲染进程目录接收，实现 Windows 资源管理器右键打开目录功能

## Changes Made

### Task 1: 创建 NSIS 安装脚本 + 配置 electron-builder + 单实例锁
- **Commit:** 66f191c
- 创建 `build/installer.nsh`
  - `customInstall` 宏：注册 Directory\shell 和 Directory\Background\shell 右键菜单
  - `customUnInstall` 宏：清理注册表项
  - 使用 `$INSTDIR\ai-tools.exe` 与 win.executableName 一致
  - 使用 SHCTX 让 NSIS 根据安装模式自动路由
  - 每个 shell 项包含 Icon 值指向 exe 路径 (D-11)
- 修改 `electron-builder.yml`
  - nsis 段新增 `include: build/installer.nsh`
- 修改 `src/main/index.ts`
  - `requestSingleInstanceLock()` 单实例锁 (D-12)
  - `second-instance` 事件过滤 argv 匹配 `^[A-Z]:\\` 格式路径，排除 .exe (T-07-03)
  - `mainWindow.webContents.send('open-directory', dirPath)` IPC 通知
  - `ensureContextMenuRegistered()` 函数在首次启动时检查并补注册 HKCU 注册表项 (D-09)

### Task 2: ChatPanel 监听 open-directory 事件创建新标签页
- **Commit:** e3aad50
- 修改 `src/renderer/src/components/ChatPanel.vue`
  - 添加 `offOpenDirectory` 清理函数变量
  - 在 `onMounted` 中注册 `window.api.onOpenDirectory` 事件监听
  - 收到 dirPath 后调用 `window.api.claudeSetCwd(dirPath)` + `addNewTab()`
  - 在 `onBeforeUnmount` 中调用 `offOpenDirectory?.()` 清理

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

1. `customInstall` 宏存在于 build/installer.nsh
2. `customUnInstall` 宏存在于 build/installer.nsh
3. `$INSTDIR\ai-tools.exe` 引用正确（4 处）
4. `requestSingleInstanceLock` 在 src/main/index.ts 中注册
5. `open-directory` IPC 事件在 src/main/index.ts 中发送
6. `onOpenDirectory` 在 ChatPanel.vue 中监听
7. `ensureContextMenuRegistered` 在 src/main/index.ts 中定义并调用（2 处）

## Self-Check: PASSED

- [x] build/installer.nsh -- FOUND
- [x] 66f191c -- FOUND
- [x] e3aad50 -- FOUND
