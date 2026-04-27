---
phase: 04-quick-wins
plan: 05
subsystem: ui
tags: [electron-updater, auto-update, GitHub Releases, IPC, modal, Catppuccin-Mocha]

# 依赖图
requires:
  - phase: 04-01
    provides: Settings store (skippedVersion field)
provides:
  - Auto-updater 主进程模块（electron-updater 封装 + IPC 事件转发）
  - UpdatePrompt 模态对话框组件（下载进度 + 三按钮 + 跳过版本）
  - Preload IPC 桥接（updater:check/download/install + 事件监听）
  - electron-builder GitHub Releases 发布配置
affects: []

# 技术追踪
tech-stack:
  added: [electron-updater 6.8.3]
patterns:
  - "Auto-updater 模式: app.isPackaged 守卫 + autoDownload=false + 事件转发到渲染进程"
  - "更新 UI: 模态对话框 + Transition 动画 + 进度条 + 三状态（提示/下载/完成）"

key-files:
  created:
    - src/main/updater/auto-updater.ts
    - src/renderer/src/components/UpdatePrompt.vue
  modified:
    - src/main/index.ts
    - src/preload/index.ts
    - src/preload/index.d.ts
    - src/renderer/src/App.vue
    - electron-builder.yml
    - package.json

key-decisions:
  - "autoDownload=false 让用户选择是否更新，autoInstallOnAppQuit=true 退出时静默安装"
  - "开发模式通过 app.isPackaged 守卫跳过更新检查，避免 electron-updater 报错"
  - "跳过版本存储到 settings store 的 skippedVersion 字段，持久化到 localStorage"

patterns-established:
  - "Updater 模式: src/main/updater/ 目录存放更新相关模块"
  - "IPC 更新模式: 主进程 autoUpdater 事件 → webContents.send → preload 监听 → Vue 组件"
  - "模态对话框模式: Transition + fixed overlay + @click.self 关闭"

requirements-completed: [UX-05]

# 度量
duration: 4min
completed: 2026-04-26
---

# Phase 4 Plan 05: Auto-Update via GitHub Releases Summary

**electron-updater 6.8.3 自动更新模块（GitHub Releases 发布源）+ UpdatePrompt 模态对话框（下载进度条 + 立即更新/稍后提醒/跳过版本三按钮）+ 完整 IPC 桥接**

## 性能

- **时长:** 4 分钟
- **开始:** 2026-04-26T02:30:01Z
- **完成:** 2026-04-26T02:34:09Z
- **任务:** 2
- **修改文件:** 8

## 成果

- electron-updater 6.8.3 安装为运行时依赖，electron-builder.yml 配置 GitHub Releases 发布源
- auto-updater 模块封装 electron-updater，支持发现新版本、下载进度、下载完成、错误四种事件
- UpdatePrompt 组件显示版本号、发布说明、进度条，支持立即更新/稍后提醒/跳过版本三个操作
- 跳过版本记录到 settings store 的 skippedVersion 字段，不再重复提示
- 开发模式通过 app.isPackaged 守卫自动跳过更新检查
- TypeScript 编译零错误通过（主进程 + 渲染进程）

## 任务提交记录

每个任务独立提交：

1. **Task 1: Install electron-updater, create auto-updater module** - `989e948` (feat)
2. **Task 2: Create UpdatePrompt component with IPC bridge** - `d70e9c9` (feat)

## 创建/修改的文件

- `src/main/updater/auto-updater.ts` - 自动更新模块，electron-updater 封装 + IPC 事件转发 + app.isPackaged 守卫
- `src/renderer/src/components/UpdatePrompt.vue` - 更新提示模态对话框，Catppuccin Mocha 风格，下载进度条，三按钮
- `src/main/index.ts` - 添加 setupAutoUpdater 调用
- `src/preload/index.ts` - 添加 updaterCheck/updaterDownload/updaterInstall + 四个事件监听器
- `src/preload/index.d.ts` - 添加所有 updater API 类型声明
- `src/renderer/src/App.vue` - 集成 UpdatePrompt 组件
- `electron-builder.yml` - 添加 GitHub Releases 发布配置
- `package.json` - 添加 electron-updater 依赖

## 做出的决策

- 设置 `autoDownload=false` 让用户主动选择更新时机，`autoInstallOnAppQuit=true` 确保退出时安装已下载的更新
- 开发模式通过 `app.isPackaged` 守卫跳过更新检查，避免 electron-updater 在未打包环境中报错
- 跳过版本存储到 settings store 的 `skippedVersion` 字段（而非独立 localStorage key），保持设置管理的一致性
- UpdatePrompt 使用 `<Transition name="modal">` 实现淡入淡出动画，`@click.self` 点击背景关闭

## 计划偏差

无 - 按计划完全执行。

## 遇到的问题

无。

## 用户设置要求

- 需要在 GitHub 仓库 Settings 中确认 Releases 功能已启用（Settings -> General -> Features -> Releases）
- 生产环境发布更新需要创建 GitHub Release 并上传构建产物

## 下一阶段准备

- Phase 4 Quick Wins 全部 5 个计划已完成
- 自动更新功能在打包发布后才能实际测试（开发模式自动跳过）
- 所有 UX 增强功能（设置面板、声音提示、缩放、通知、自动更新）已就绪

## Self-Check: PASSED

- [x] src/main/updater/auto-updater.ts -- FOUND
- [x] src/renderer/src/components/UpdatePrompt.vue -- FOUND
- [x] Commit 989e948 (Task 1) -- FOUND
- [x] Commit d70e9c9 (Task 2) -- FOUND

---
*Phase: 04-quick-wins*
*Completed: 2026-04-26*
