---
phase: 04-quick-wins
plan: 01
subsystem: ui
tags: [pinia, settings, localStorage, vue3, drawer, catppuccin-mocha]

# 依赖图
requires: []
provides:
  - Pinia settings store 持久化到 localStorage
  - SettingsDrawer 侧边抽屉面板组件
  - TitleBar 齿轮图标入口 + Ctrl+, 快捷键
  - 5 个设置分组（声音、缩放、通知、更新、托盘）
affects: [04-02, 04-03, 04-04, 04-05]

# 技术追踪
tech-stack:
  added: []
  patterns:
    - "Pinia composition API store + localStorage 深度监听持久化"
    - "侧边抽屉面板: transform translateX 过渡 + backdrop overlay"

key-files:
  created:
    - src/renderer/src/stores/settings.ts
    - src/renderer/src/components/SettingsDrawer.vue
  modified:
    - src/renderer/src/components/TitleBar.vue
    - src/renderer/src/App.vue
    - src/main/index.ts
    - src/preload/index.ts

key-decisions:
  - "使用单个 settings ref + watch deep 实现自动持久化，而非每个字段独立 ref"
  - "SettingsDrawer 使用 v-if 控制渲染，避免不可见时的性能开销"

patterns-established:
  - "Settings store: defineStore composition API + watch(settings, ..., { deep: true }) + safeParse"
  - "抽屉面板: fixed backdrop + flex-end 对齐 + 0.25s translateX 过渡"
  - "主进程快捷键: shortcuts map + before-input-event + preload onShortcut channels"

requirements-completed: [UX-01, UX-02, UX-03, UX-04, UX-05]

# 度量
duration: 5min
completed: 2026-04-26
---

# Phase 4 Plan 01: Settings Infrastructure Summary

**Pinia settings store + localStorage 持久化 + 侧边抽屉 UI（声音/缩放/通知/更新/托盘五个分组）+ TitleBar 齿轮图标 + Ctrl+, 快捷键**

## 性能

- **时长:** 5 分钟
- **开始:** 2026-04-26T02:06:30Z
- **完成:** 2026-04-26T02:11:07Z
- **任务:** 2
- **修改文件:** 6

## 成果

- Settings store 包含所有 UX-01~UX-05 配置字段，自动持久化到 localStorage
- SettingsDrawer 组件包含声音、缩放、通知、更新、托盘五个设置分组
- TitleBar 添加齿轮图标按钮，点击打开设置面板
- Ctrl+, 快捷键和主进程 IPC 均支持打开/关闭设置面板
- TypeScript 编译零错误通过

## 任务提交记录

每个任务独立提交：

1. **Task 1: Create Settings Store** - `1ed451c` (feat)
2. **Task 2: Build SettingsDrawer + integrate** - `5749458` (feat)

## 创建/修改的文件

- `src/renderer/src/stores/settings.ts` - Pinia settings store，composition API 模式，localStorage 持久化
- `src/renderer/src/components/SettingsDrawer.vue` - 侧边抽屉设置面板，含 5 个分组（声音、缩放、通知、更新、托盘）
- `src/renderer/src/components/TitleBar.vue` - 添加齿轮图标按钮和 titlebar-right 区域
- `src/renderer/src/App.vue` - 集成 SettingsDrawer，Ctrl+, 快捷键，IPC open-settings 处理
- `src/main/index.ts` - 添加 `',': 'shortcut:open-settings'` 快捷键映射
- `src/preload/index.ts` - onShortcut channels 添加 `shortcut:open-settings`

## 做出的决策

- 使用单个 `settings` ref 聚合所有状态字段，配合 `watch(settings, ..., { deep: true })` 实现一次性持久化，避免为每个字段创建独立 ref
- SettingsDrawer 使用 `v-if` 而非 `v-show`，面板不可见时不渲染 DOM
- 关闭行为选项使用 radio group 而非 select 下拉，更直观
- CSS 切换开关使用 `appearance: none` + `::after` 伪元素自定义样式

## 计划偏差

无 - 按计划完全执行。

## 遇到的问题

无。

## 用户设置要求

无 - 不需要外部服务配置。

## 下一阶段准备

- Settings store 已就绪，04-02~04-05 可直接 `useSettingsStore()` 读写配置
- SettingsDrawer 中的声音、通知、更新、托盘分组 UI 已就位，后续 plan 需要实现对应的实际功能逻辑
- 缩放滑块 UI 已存在，04-03 只需添加 `webFrame.setZoomFactor()` 和 iframe CSS zoom 逻辑

---
*Phase: 04-quick-wins*
*Completed: 2026-04-26*
