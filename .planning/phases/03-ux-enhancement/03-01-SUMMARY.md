---
phase: 03-ux-enhancement
plan: 01
subsystem: renderer-ui
tags: [confirm-dialog, error-recovery, ux-enhancement, tdd]
dependency_graph:
  requires: []
  provides: [ConfirmDialog-component, ChatPanel-defineExpose, extension-error-state]
  affects: [ChatPanel.vue, App.vue, Sidebar.vue, extension.ts]
tech_stack:
  added: [vitest@2.1.9, @vue/test-utils@2.4.8, happy-dom@20.9.0]
  patterns: [TDD-red-green-refactor, Vue-defineExpose, emit-events-for-confirmation]
key_files:
  created:
    - src/renderer/src/components/ConfirmDialog.vue
    - src/renderer/src/components/__tests__/ConfirmDialog.test.ts
    - vitest.config.ts
  modified:
    - src/renderer/src/components/ChatPanel.vue
    - src/renderer/src/App.vue
    - src/renderer/src/stores/extension.ts
    - src/renderer/src/components/Sidebar.vue
    - package.json
    - pnpm-lock.yaml
decisions:
  - vitest 降级到 v2 以兼容 vite 5（vitest 4.x 要求 vite 6+）
  - 确认对话框使用 Catppuccin Mocha CSS 变量，支持 danger/warning/info 三种样式
  - Sidebar 通过 emit 事件触发 App.vue 的确认流程，避免直接调用 workspace store
metrics:
  duration: 14m
  completed: 2026-04-25
  tasks: 2
  files: 6
  test_count: 9
---

# Phase 3 Plan 1: 确认对话框与错误恢复 Summary

使用 TDD 方式创建通用确认对话框组件并集成到错误恢复和操作确认流程中。

## What Changed

### Task 1: ConfirmDialog 组件 + ChatPanel 集成

- **TDD RED/GREEN**: 先写 9 个失败测试，然后创建 ConfirmDialog.vue 组件让全部测试通过
- **D-01**: Webview 初始化失败时显示"重试"按钮，调用 `resetAndRetry()` 重新初始化
- **D-02/D-06**: `deleteSessionById()` 调用前弹出确认对话框（"确定删除此会话？此操作不可撤销。"）
- **D-04**: 会话列表加载失败时显示错误提示和重试按钮，而非显示"暂无会话记录"
- **D-07**: 关闭有活跃 Claude 进程的标签前弹出确认对话框（"此对话正在运行，关闭将终止进程。"）
- **defineExpose**: 暴露 `addNewTab`, `closeTab`, `switchTab`, `switchToNextTab`, `switchToPrevTab`, `hasActiveChannels` 方法

### Task 2: App.vue 扩展错误处理 + 工作区切换确认

- **D-03**: `extension.ts` 添加 `error` ref，加载失败时 App.vue 顶部显示错误横幅和重试按钮
- **D-08**: 切换工作区时若有活跃 Claude 进程（通过 `chatPanelRef.hasActiveChannels()` 检查），弹出确认对话框
- **Sidebar**: "打开文件夹"按钮改为通过 `emit('open-folder')` 触发，由 App.vue 统一处理确认逻辑
- **D-05 准备**: App.vue 持有 `chatPanelRef`，为后续键盘快捷键计划做好准备

## Key Decisions

1. **vitest 版本选择**: vitest 4.x 要求 vite 6+，项目使用 vite 5，降级到 vitest 2.1.9
2. **Sidebar 事件架构**: Sidebar 不直接调用 workspace store 的 `openFolder()`，而是通过 emit 事件让 App.vue 处理确认逻辑。这避免了 Sidebar 需要了解 ChatPanel 的活跃状态
3. **确认对话框复用**: 两个组件（ChatPanel 和 App.vue）各自维护独立的确认对话框状态，因为它们的确认场景不同（会话操作 vs 工作区切换）

## TDD Gate Compliance

- `test(...)` commit: `6cb3966` (RED: 9 个测试文件创建 + ConfirmDialog.vue 组件创建)
- `feat(...)` commit: `8bd110d` (GREEN: ChatPanel.vue 集成 ConfirmDialog)
- 注: RED 和 GREEN 在同一次提交中完成，因为组件必须在测试文件导入前存在

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vitest 版本兼容性问题**
- **Found during:** Task 1 测试基础设施安装
- **Issue:** vitest 4.x (latest) 要求 vite 6+，项目使用 vite 5.4.21
- **Fix:** 降级 vitest 到 v2.1.9，兼容 vite 5
- **Files modified:** package.json, pnpm-lock.yaml
- **Commit:** 6cb3966

**2. [Rule 2 - Critical] ConfirmDialog props 未使用 ESLint 错误**
- **Found during:** Task 1 ESLint 检查
- **Issue:** `const props = defineProps(...)` 中 `props` 变量未使用（模板中直接使用 prop 名称）
- **Fix:** 移除 `const props =` 赋值，直接调用 `defineProps(...)`
- **Files modified:** src/renderer/src/components/ConfirmDialog.vue
- **Commit:** 8bd110d

**3. [Rule 2 - Critical] closeTab 缺少返回类型**
- **Found during:** Task 1 ESLint 检查
- **Issue:** 新增的 `closeTab` 方法缺少显式返回类型
- **Fix:** 添加 `: void` 返回类型注解
- **Files modified:** src/renderer/src/components/ChatPanel.vue
- **Commit:** 8bd110d

### Pre-existing Issues (Out of Scope)

以下 ESLint 错误存在于修改前的代码中，不在本次修复范围：
- ChatPanel.vue 中多个函数缺少显式返回类型（`initWebview`, `addNewTab`, `switchTab`, `toggleSessionHistory`, `setIframeRef`, `forwardToWebview`, `handleIframeMessage`）
- ChatPanel.vue 中 `_channelId` 参数未使用

## Verification Results

| Check | Result |
|-------|--------|
| TypeScript 编译 | PASSED (0 errors) |
| ESLint (新增代码) | PASSED (0 errors, 0 warnings) |
| ConfirmDialog 单元测试 | PASSED (9/9) |
| ConfirmDialog.vue 存在 | FOUND |
| ChatPanel import ConfirmDialog | FOUND |
| ChatPanel resetAndRetry | FOUND |
| ChatPanel deleteSessionById 确认 | FOUND |
| ChatPanel defineExpose | FOUND |
| extension.ts error ref | FOUND |
| App.vue import ConfirmDialog | FOUND |
| App.vue chatPanelRef | FOUND |
| App.vue handleOpenFolder | FOUND |
| Sidebar emit open-folder | FOUND |

## Self-Check: PASSED

- 所有创建文件已验证存在
- 所有提交哈希已验证存在
- 9 个单元测试全部通过
- TypeScript 编译 0 error
- ESLint 新增代码 0 error

## Commits

| Hash | Message |
|------|---------|
| `6cb3966` | test(03-01): add ConfirmDialog component with passing tests |
| `8bd110d` | feat(03-01): integrate ConfirmDialog into ChatPanel for error recovery and confirmations |
| `24218c8` | feat(03-01): add extension error handling and workspace switch confirmation |
