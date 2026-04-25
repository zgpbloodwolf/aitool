---
phase: 03-ux-enhancement
plan: 05
subsystem: ui
tags: [chokidar, sidebar, drag-resize, file-search, favorites, localStorage, pinia, vue3]

# Dependency graph
requires:
  - phase: 03-ux-enhancement/03-01
    provides: Sidebar.vue 基础布局和 workspace store
provides:
  - chokidar 文件监听 IPC handler（file-watcher.ts）
  - preload 桥接文件监听 API
  - 侧边栏拖拽宽度调整 + localStorage 持久化
  - 文件搜索过滤（递归 FileEntry 树过滤）
  - 收藏项目目录 CRUD + localStorage 持久化
  - workspace store 的 filteredFiles/addFavorite/removeFavorite/openFavorite
  - 7 个单元测试覆盖过滤和收藏逻辑
affects: [sidebar, file-tree, workspace-store, file-watcher]

# Tech tracking
tech-stack:
  added: [chokidar@5.0.0]
  patterns: [chokidar-ipc-file-watcher, sidebar-drag-resize, recursive-tree-filter, localStorage-persistence]

key-files:
  created:
    - src/main/ipc/file-watcher.ts
    - src/renderer/src/stores/__tests__/workspace-filter-favorites.test.ts
  modified:
    - src/renderer/src/App.vue
    - src/renderer/src/components/Sidebar.vue
    - src/renderer/src/components/FileTree.vue
    - src/renderer/src/stores/workspace.ts
    - src/main/index.ts
    - src/preload/index.ts
    - src/preload/index.d.ts

key-decisions:
  - "使用 chokidar 5.0.0 (npm resolved latest) 而非 v3，RESEARCH.md 已验证 v5 兼容 electron-vite"
  - "文件监听使用全局事件去重（all 事件统一通知 fs:changed），不做细粒度 event/path 传递"
  - "收藏路径存储在 localStorage (aitools-favorites)，不引入 electron-store"
  - "侧边栏宽度存储在 localStorage (aitools-sidebar-width)，默认 260px"

patterns-established:
  - "chokidar IPC 模式: 主进程监听 -> ipcMain.handle 注册 -> BrowserWindow.send 通知 -> preload 桥接 -> store 集成"
  - "拖拽模式: mousedown 记录起点 -> mousemove 计算 delta -> mouseup 持久化，拖拽期间禁用 iframe pointer-events"
  - "递归树过滤: filterFiles 递归子目录，匹配的子目录保留父节点，空结果返回空数组"

requirements-completed: [D-17, D-18, D-19, D-20]

# Metrics
duration: 8min
completed: 2026-04-25
---

# Phase 3 Plan 05: 侧边栏增强 Summary

**侧边栏可拖拽调整宽度(200-500px)并持久化、chokidar 文件监听自动刷新文件树、搜索框实时过滤文件名、收藏目录快速切换工作区**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-25T01:45:05Z
- **Completed:** 2026-04-25T01:53:32Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- chokidar 文件监听基础设施：主进程 IPC handler + preload 桥接 + workspace store 集成
- 侧边栏拖拽宽度：4px 手柄、200-500px 范围限制、localStorage 持久化、iframe 拦截防护
- 搜索过滤：递归 FileEntry 树过滤，Sidebar 搜索框实时绑定，无匹配时显示提示
- 收藏目录：addFavorite/removeFavorite/openFavorite CRUD，localStorage 持久化
- 7 个单元测试覆盖 filterFiles 递归过滤和收藏列表 CRUD（含 removeFavorite bug fix 验证）

## Task Commits

Each task was committed atomically:

1. **Task 1: chokidar 文件监听基础设施 + preload 桥接 + workspace 基础 ref** - `35ce520` (feat)
2. **Task 2: 侧边栏拖拽宽度 + 搜索过滤 + 收藏目录 UI** - `4c1865e` (feat, TDD)

## Files Created/Modified
- `src/main/ipc/file-watcher.ts` - chokidar 文件监听 IPC handler，fs:startWatch/fs:stopWatch
- `src/main/index.ts` - 注册 registerFileWatcherHandlers
- `src/preload/index.ts` - 添加 startFileWatch/stopFileWatch/onFileChanged API 桥接
- `src/preload/index.d.ts` - 添加文件监听 TypeScript 类型声明
- `src/renderer/src/stores/workspace.ts` - 添加 startWatch/stopWatch/filterText/favorites/filteredFiles/addFavorite/removeFavorite/openFavorite
- `src/renderer/src/App.vue` - 侧边栏拖拽手柄 + sidebarWidth 持久化
- `src/renderer/src/components/Sidebar.vue` - 搜索框 + 收藏列表 + 工作区名旁收藏按钮
- `src/renderer/src/components/FileTree.vue` - 使用 filteredFiles 替代 files，空匹配提示
- `src/renderer/src/stores/__tests__/workspace-filter-favorites.test.ts` - 7 个单元测试

## Decisions Made
- 使用 chokidar 5.0.0 (npm resolved latest)，RESEARCH.md 已验证 v5 兼容 electron-vite
- 文件监听使用全局事件去重（all 事件统一通知 fs:changed），不做细粒度 event/path 传递
- 收藏路径和侧边栏宽度均使用 localStorage 存储，不引入 electron-store
- 侧边栏默认宽度 260px，可拖拽范围 200-500px

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 所有 D-17/D-18/D-19/D-20 需求已实现并通过验证
- chokidar 文件监听已就绪，打开工作区后自动启动
- workspace store 的 filteredFiles/favorites 可被后续功能复用
- Sidebar 的 CSS 已移除固定 width，改为由 App.vue 通过 style 属性控制

---
*Phase: 03-ux-enhancement*
*Completed: 2026-04-25*
