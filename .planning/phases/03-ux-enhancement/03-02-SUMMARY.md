---
phase: 03-ux-enhancement
plan: 02
subsystem: renderer-ui
tags: [keyboard-shortcuts, drag-drop, tab-management, ux-enhancement]
dependency_graph:
  requires: [03-01]
  provides: [global-keydown-handler, tab-drag-sort, ChatPanel-activeTabId-expose]
  affects: [App.vue, ChatPanel.vue]
tech_stack:
  added: []
  patterns: [global-keydown-listener, HTML5-Drag-and-Drop, ref-expose-cross-component]
key_files:
  created:
    - src/renderer/src/__tests__/keyboard-shortcuts.test.ts
  modified:
    - src/renderer/src/App.vue
    - src/renderer/src/components/ChatPanel.vue
decisions:
  - Ctrl+Tab preventDefault 在逻辑最前面调用，防止浏览器拦截默认行为
  - Ctrl+Shift+N 降级为新建标签页（与 Ctrl+N 相同），不实现多窗口
  - 标签拖拽使用原生 HTML5 Drag API（零外部依赖）
  - 键盘快捷键测试采用纯逻辑单元测试，不依赖 Vue 组件挂载
metrics:
  duration: 4m
  completed: 2026-04-25
  tasks: 2
  files: 3
  test_count: 12
---

# Phase 3 Plan 2: 全局键盘快捷键与标签拖拽排序 Summary

实现 5 组全局键盘快捷键（Ctrl+N/W/B/Tab/Shift+Tab）和标签拖拽排序功能。

## What Changed

### Task 1: 全局键盘快捷键注册 (D-05)

- **App.vue**: 添加 `handleGlobalKeydown` 函数，注册 `keydown` 事件监听器
- **快捷键映射**: Ctrl+N (新建标签), Ctrl+W (关闭当前标签), Ctrl+B (切换侧边栏), Ctrl+Tab (下一个标签), Ctrl+Shift+Tab (上一个标签)
- **Ctrl+Tab 处理**: 在函数最前面先检查 Ctrl+Tab 并调用 `preventDefault()`，防止浏览器拦截
- **Ctrl+Shift+N**: 降级为新建标签页（与 Ctrl+N 相同），不实现多窗口
- **ChatPanel.vue**: `defineExpose` 额外暴露 `activeTabId` ref，供 Ctrl+W 获取当前活跃标签 ID
- **单元测试**: 12 个测试用例覆盖所有快捷键场景，包括无修饰键、不相关按键的边界情况

### Task 2: 标签拖拽排序 (D-16)

- **原生 HTML5 Drag API**: 零外部依赖实现标签拖拽排序
- **拖拽状态**: `draggedTabId` 和 `dragOverTabId` 两个 ref 追踪拖拽生命周期
- **数组重排**: `onDrop` 中使用 `splice` 从原位置移除并插入目标位置
- **视觉反馈**: 拖拽源标签降低 opacity (0.5)，目标标签显示左侧 accent 色边框

## Key Decisions

1. **Ctrl+Tab 的 preventDefault 优先**: 按照计划 RESEARCH.md Pitfall 2 的建议，Ctrl+Tab 检查放在函数最前面，确保浏览器默认行为被拦截
2. **纯逻辑单元测试**: 不挂载完整 App 组件（依赖过重），而是提取 `handleGlobalKeydown` 核心逻辑到独立测试函数中测试
3. **原生 Drag API**: 标签拖拽使用 HTML5 Drag API 而非 vue-draggable-plus，避免引入额外依赖

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

| Check | Result |
|-------|--------|
| TypeScript compilation | PASSED (0 errors) |
| ESLint (App.vue) | PASSED (0 errors, 0 warnings) |
| ESLint (ChatPanel.vue) | Pre-existing errors only (see note) |
| Keyboard shortcuts unit tests | PASSED (12/12) |
| App.vue handleGlobalKeydown | FOUND |
| App.vue addEventListener keydown | FOUND |
| App.vue removeEventListener keydown | FOUND |
| ChatPanel.vue defineExpose activeTabId | FOUND |
| ChatPanel.vue draggedTabId ref | FOUND |
| ChatPanel.vue onDragStart function | FOUND |
| ChatPanel.vue onDrop function | FOUND |
| ChatPanel.vue .tab-item draggable="true" | FOUND |
| ChatPanel.vue .dragging CSS | FOUND |
| ChatPanel.vue .drag-over CSS | FOUND |

**Note on ChatPanel.vue ESLint**: Pre-existing errors (missing return types on functions created before this plan, `_channelId` unused parameter) documented in 03-01-SUMMARY.md. No new errors introduced.

## Self-Check: PASSED

- src/renderer/src/App.vue: FOUND
- src/renderer/src/components/ChatPanel.vue: FOUND
- src/renderer/src/__tests__/keyboard-shortcuts.test.ts: FOUND
- Commit eed62a7: FOUND
- Commit 752cde4: FOUND
- 12 unit tests: ALL PASSED
- TypeScript: 0 errors
- ESLint new code: 0 errors

## Commits

| Hash | Message |
|------|---------|
| `eed62a7` | feat(03-02): add global keyboard shortcuts for tab and sidebar control |
| `752cde4` | feat(03-02): add tab drag-and-drop reordering with HTML5 Drag API |
