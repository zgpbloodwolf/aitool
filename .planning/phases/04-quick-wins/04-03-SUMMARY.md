---
phase: 04-quick-wins
plan: 03
subsystem: ui
tags: [sound, zoom, webFrame, HTMLAudioElement, composables, wav]

# 依赖图
requires:
  - phase: 04-01
    provides: Settings store (soundEnabled, soundVolume, soundComplete/Permission/Error, zoomFactor)
provides:
  - useSound composable (playSound with per-event toggles + volume)
  - useZoom composable (applyZoom, loadAndApplyZoom, resetZoom via webFrame + CSS zoom)
  - Placeholder WAV sound files in resources/sounds/
affects: [04-04, 04-05]

# 技术追踪
tech-stack:
  added: []
  patterns:
    - "HTMLAudioElement + Map 缓存实现声音播放"
    - "electron webFrame.setZoomFactor() + CSS zoom 双层缩放"
    - "Renderer composables 模式: composable 函数组合 settings store"

key-files:
  created:
    - src/renderer/src/composables/useSound.ts
    - src/renderer/src/composables/useZoom.ts
    - resources/sounds/complete.wav
    - resources/sounds/permission.wav
    - resources/sounds/error.wav
  modified:
    - src/renderer/src/App.vue
    - src/main/index.ts
    - src/preload/index.ts

key-decisions:
  - "Audio 实例使用 Map 缓存避免重复创建，src 延迟设置支持开发/生产路径差异"
  - "缩放使用 webFrame.setZoomFactor() 处理 shell UI + CSS zoom 处理 iframe，保持全局一致"
  - "声音文件缺失时静默失败，默认关闭，不影响应用功能"

patterns-established:
  - "Composable 模式: src/renderer/src/composables/ 目录存放可组合功能函数"
  - "Zoom 双层: webFrame 全局 + CSS zoom 同步到 .webview-iframe 元素"

requirements-completed: [UX-03, UX-04]

# 度量
duration: 2min
completed: 2026-04-26
---

# Phase 4 Plan 03: Sound Playback + Global Zoom Summary

**声音提示 composable（HTMLAudioElement + 事件开关 + 音量控制）+ 全局缩放 composable（webFrame + CSS zoom 双层缩放）+ 3 个占位 WAV 音效文件 + Ctrl+0 重置快捷键**

## 性能

- **时长:** 2 分钟
- **开始:** 2026-04-26T02:17:46Z
- **完成:** 2026-04-26T02:20:07Z
- **任务:** 2
- **修改文件:** 8

## 成果

- 3 个占位 WAV 音效文件（complete 880Hz/200ms、permission 660Hz/300ms、error 440Hz/400ms）放入 resources/sounds/
- useSound composable 支持全局开关、按事件开关、音量调节、文件缺失静默失败
- useZoom composable 通过 webFrame.setZoomFactor() 缩放 shell UI，CSS zoom 同步缩放 iframe
- App.vue 在 onMounted 时加载保存的缩放值，watch settings 变化实时应用
- Ctrl+0 快捷键重置缩放到 100%
- TypeScript 编译零错误通过

## 任务提交记录

每个任务独立提交：

1. **Task 1: Create composables and placeholder sounds** - `a1c1f7a` (feat)
2. **Task 2: Integrate zoom/sound into App.vue and shortcuts** - `727afcc` (feat)

## 创建/修改的文件

- `resources/sounds/complete.wav` - 回复完成提示音（880Hz 短促蜂鸣 200ms）
- `resources/sounds/permission.wav` - 权限请求提示音（660Hz 中等蜂鸣 300ms）
- `resources/sounds/error.wav` - 错误提示音（440Hz 较长蜂鸣 400ms）
- `src/renderer/src/composables/useSound.ts` - 声音播放 composable，Audio 缓存 + 设置驱动开关和音量
- `src/renderer/src/composables/useZoom.ts` - 缩放 composable，webFrame + CSS zoom + 重置功能
- `src/renderer/src/App.vue` - 集成 zoom 初始化、watch 设置变化、reset-zoom 快捷键处理
- `src/main/index.ts` - 添加 Ctrl+0 快捷键映射 `'0': 'shortcut:reset-zoom'`
- `src/preload/index.ts` - onShortcut channels 添加 `shortcut:reset-zoom`

## 做出的决策

- Audio 实例使用 Map 缓存（按事件名缓存），src 属性延迟到首次播放时设置，自动判断开发模式（相对路径）和生产模式（process.resourcesPath）
- 缩放使用 webFrame.setZoomFactor() 处理 Electron renderer 层面，CSS zoom 处理 iframe webview 元素，两层使用同一缩放值确保一致
- 声音文件缺失时 play().catch() 静默吞掉错误，不会触发任何用户可见异常

## 计划偏差

无 - 按计划完全执行。

## 遇到的问题

无。

## 用户设置要求

无 - 不需要外部服务配置。

## 下一阶段准备

- useSound composable 已就绪，04-04 通知系统可直接调用 playSound() 播放声音
- useZoom composable 已集成到 App.vue，设置面板滑块拖动时实时生效
- 声音默认关闭，用户需要在设置面板中开启后才能听到音效

## Self-Check: PASSED

- [x] resources/sounds/complete.wav — FOUND
- [x] resources/sounds/permission.wav — FOUND
- [x] resources/sounds/error.wav — FOUND
- [x] src/renderer/src/composables/useSound.ts — FOUND
- [x] src/renderer/src/composables/useZoom.ts — FOUND
- [x] Commit a1c1f7a (Task 1) — FOUND
- [x] Commit 727afcc (Task 2) — FOUND

---
*Phase: 04-quick-wins*
*Completed: 2026-04-26*
