---
phase: 8
plan: 02
subsystem: branch-management
tags: [branch, persistence, ipc, ux-12]
dependency_graph:
  requires: [08-01]
  provides: [BranchStore, BranchManager, branch-ipc]
  affects: [shared/types, preload, ipc/claude-webview]
tech-stack:
  added: [branch-store.ts, branch-manager.ts]
  patterns: [json-persistence, promise-chain-write-queue, dynamic-import-ipc]
key-files:
  created:
    - src/main/claude/branch-store.ts
    - src/main/claude/branch-manager.ts
  modified:
    - src/shared/types.ts
    - src/main/ipc/claude-webview.ts
    - src/preload/index.ts
    - src/preload/index.d.ts
decisions:
  - Promise chain 写入队列保证并发安全（与 token-usage-store 模式一致）
  - 每会话最大 10 个分支限制，防止资源耗尽
  - Dynamic import 用于 IPC handler 避免循环依赖
  - 分支创建时重放父会话消息到新频道
metrics:
  duration: 3min
  completed: 2026-04-28
  tasks: 2
  files: 6
---

# Phase 8 Plan 02: BranchStore + BranchManager + Branch IPC Summary

Branch metadata persistence with JSON file storage, branch management logic with message replay, and 7 IPC handlers bridging renderer to main process.

## Changes Made

### Task 1: BranchStore + 分支类型定义

**src/shared/types.ts** - 新增 `BranchMeta` 和 `BranchesData` 接口定义

**src/main/claude/branch-store.ts** (新建) - 分支元数据持久化模块
- JSON 文件存储在 `app.getPath('userData')/branches.json`
- Promise chain 写入队列防止并发写入损坏
- 每会话最大 10 个分支限制（`MAX_BRANCHES_PER_SESSION`）
- 提供 `loadBranchData`, `canCreateBranch`, `getRemainingQuota`, `saveBranch`, `getBranchesByParent`, `getBranchesAtPoint`, `getBranchByChannelId`, `renameBranch`, `deleteBranch`, `getNextBranchNumber` 等 API

### Task 2: BranchManager + 分支 IPC 注册

**src/main/claude/branch-manager.ts** (新建) - 分支管理逻辑
- `createBranch` - 创建分支并重放父会话消息到新频道
- `listBranches` / `listBranchesAtPoint` - 查询分支列表
- `renameBranch` / `removeBranch` - 重命名和删除分支
- `findBranchByChannel` - 通过频道 ID 查找分支

**src/main/ipc/claude-webview.ts** - 注册 7 个分支 IPC handler
- `branch:create` - 创建分支
- `branch:list` - 列出会话分支
- `branch:list-at-point` - 列出分支点分支
- `branch:rename` - 重命名分支
- `branch:delete` - 删除分支
- `branch:find-by-channel` - 通过频道查找分支
- `branch:can-create` - 检查是否可创建分支

**src/preload/index.ts** + **src/preload/index.d.ts** - 添加 7 个分支 IPC 桥接方法和类型声明

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript 编译通过 (`npx tsc --noEmit`) - 零错误
- 所有新增文件和修改已提交

## Self-Check: PASSED
