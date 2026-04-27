---
phase: 07-workflow-enhancement
plan: 03
subsystem: token-usage-ui
tags: [chart.js, vue-chartjs, composable, settings-drawer, css-variables]
dependency_graph:
  requires: [token-usage IPC from 07-01, preload bridge from 07-01]
  provides: [useTokenUsage composable, TokenUsagePanel component, SettingsDrawer integration]
  affects: [src/renderer/src/composables/useTokenUsage.ts, src/renderer/src/components/TokenUsagePanel.vue, src/renderer/src/components/SettingsDrawer.vue]
tech_stack:
  added: []
  patterns: [Vue composable, Chart.js tree-shaking registration, computed for reactive chart options]
key_files:
  created:
    - src/renderer/src/composables/useTokenUsage.ts
    - src/renderer/src/components/TokenUsagePanel.vue
  modified:
    - src/renderer/src/components/SettingsDrawer.vue
decisions:
  - chartOptions 使用 computed 而非静态对象，确保主题切换时图表颜色正确更新
  - 工作区趋势图使用全局 days 数据作为近似展示（后端未提供按工作区分天的数据）
  - 数字格式化使用 K/M 缩写提升可读性
metrics:
  duration: 9min
  completed: 2026-04-27
  tasks: 2
  files: 3
---

# Phase 07 Plan 03: Token 用量统计面板 UI Summary

Chart.js 柱状图 + useTokenUsage composable + SettingsDrawer 集成，实现 Token 用量可视化统计面板

## Changes Made

### Task 1: 创建 useTokenUsage composable + TokenUsagePanel 组件
- **Commit:** 9faca5c
- 创建 `src/renderer/src/composables/useTokenUsage.ts`
  - `useTokenUsage()` composable 导出响应式状态：`stats`, `loading`, `selectedRange`, `selectedWorkspace`, `fetchStats`
  - 通过 `window.api.getTokenUsageStats(range)` IPC 获取主进程 token 数据
  - 错误捕获与 null 降级处理
- 创建 `src/renderer/src/components/TokenUsagePanel.vue`
  - Chart.js tree-shaking 注册（Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale）
  - vue-chartjs `<Bar>` 组件渲染柱状图
  - 时间范围选择器（今日/本周/本月）
  - 汇总卡片（输入 Token、输出 Token、会话数）3 列网格布局
  - 每日趋势柱状图（高度 200px）
  - 工作区列表（点击展开趋势图，高度 150px）
  - 所有颜色使用 CSS 变量，通过 `getComputedStyle` 获取实际值传入 Canvas
  - 数字格式化 K/M 缩写

### Task 2: 将 TokenUsagePanel 集成到 SettingsDrawer
- **Commit:** 771673a
- 修改 `src/renderer/src/components/SettingsDrawer.vue`
  - 导入 `TokenUsagePanel` 组件
  - 在 "关闭窗口时" section 之后添加 "用量统计" section（包含 `<TokenUsagePanel />`）

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Critical Functionality] chartOptions 改为 computed 属性**
- **Found during:** Task 1 实现
- **Issue:** 计划中 chartOptions 是静态对象，`getCSSVar()` 在组件创建时只调用一次。主题切换后图表颜色不会更新。
- **Fix:** 将 chartOptions 从静态对象改为 `computed` 属性，确保响应式依赖触发重新计算。
- **Files modified:** src/renderer/src/components/TokenUsagePanel.vue
- **Commit:** 9faca5c

## Verification Results

1. `TokenUsagePanel` 在 SettingsDrawer.vue 中被导入和使用（2 处引用）
2. `ChartJS.register` 在 TokenUsagePanel.vue 中正确注册（6 个模块）
3. `getComputedStyle` 用于获取 CSS 变量实际值（Canvas 渲染所需）
4. CSS 变量使用 15 处（覆盖背景、文本、边框、强调色等）
5. `useTokenUsage` 通过 `getTokenUsageStats` IPC 获取数据

## Self-Check: PASSED

- [x] src/renderer/src/composables/useTokenUsage.ts -- FOUND
- [x] src/renderer/src/components/TokenUsagePanel.vue -- FOUND
- [x] 9faca5c -- FOUND
- [x] 771673a -- FOUND
