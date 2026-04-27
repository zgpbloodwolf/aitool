---
phase: 03-ux-enhancement
plan: 06
subsystem: security
tags: [security, validation, sandbox, iframe, hardening]
dependency_graph:
  requires: []
  provides: [D-21-uuid-validation, D-22-symlink-resolution, D-23-postmessage-origin]
  affects: [session-store.ts, filesystem.ts, ChatPanel.vue]
tech_stack:
  added: []
  patterns: [uuid-validation, realpath-symlink-resolve, postmessage-precise-origin]
key_files:
  created:
    - src/main/__tests__/security-hardening.test.ts
    - vitest.main.config.ts
  modified:
    - src/main/claude/session-store.ts
    - src/main/ipc/filesystem.ts
    - src/renderer/src/components/ChatPanel.vue
    - vitest.config.ts
decisions:
  - "D-23: 保留 allow-same-origin 因为无法在执行期间运行应用验证移除后的兼容性；postMessage 改用精确 origin 作为最低限度加固"
metrics:
  duration: 389s
  completed: "2026-04-25"
  tasks: 1
  test_files: 1
  tests_passed: 7
---

# Phase 03 Plan 06: Security Hardening Summary

deleteSession UUID 验证防止路径遍历、文件系统沙盒使用 realpath 解析符号链接、iframe postMessage 精确 origin 加固。

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | UUID 验证 + 符号链接解析 + iframe sandbox 加固 (D-21, D-22, D-23) | aefc0c1 (RED), b6bc081 (GREEN) | session-store.ts, filesystem.ts, ChatPanel.vue, security-hardening.test.ts |

## Changes Made

### D-21: deleteSession UUID 验证

- `session-store.ts` 的 `deleteSession` 函数在执行前校验 sessionId 是否为 UUID 格式
- 复用已有的 `UUID_RE` 正则表达式
- 非法输入（路径遍历、空字符串等）直接返回 false 并记录错误日志

### D-22: 文件系统沙盒符号链接解析

- `filesystem.ts` 的 `isPathAllowed` 改为 async 函数
- 先使用 `fs.realpath()` 解析符号链接后再与白名单比较
- `realpath` 失败时回退到原始路径检查（文件不存在等场景）
- 三个 IPC handler (`fs:readDir`, `fs:readFile`, `fs:stat`) 更新为 `await isPathAllowed()`

### D-23: iframe sandbox postMessage 精确 origin

- `ChatPanel.vue` 新增 `webviewPort` ref 存储端口
- `postMessage` 的 `targetOrigin` 从 `'*'` 改为 `http://127.0.0.1:${webviewPort.value}`
- 保留 `allow-same-origin` sandbox 属性（见兼容性测试说明）

### 测试

- 创建 `vitest.main.config.ts` 支持主进程测试（node 环境）
- 创建 `security-hardening.test.ts` 包含 7 个测试用例，全部通过

## D-23 兼容性测试说明

**重要：** 无法在计划执行期间启动应用做实际兼容性测试。

**当前方案：** 保留 `sandbox="allow-scripts allow-same-origin allow-forms allow-popups"`，但 postMessage 使用精确 origin 替代通配符 `'*'`。

**需要后续验证的操作：**

1. 运行 `pnpm dev`，启动应用
2. 打开 Claude Code webview，发送一条消息，确认正常响应
3. 检查 DevTools 控制台无 CORS/same-origin 错误
4. 如果正常，可尝试移除 `allow-same-origin` 再次测试
5. 如果移除后 webview 功能正常，更新 sandbox 为 `allow-scripts allow-forms allow-popups`（更安全的方案）

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (failing test) | aefc0c1 | 3 个测试失败 |
| GREEN (all pass) | b6bc081 | 7 个测试通过 |
| REFACTOR | - | 无需重构 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 创建 vitest.main.config.ts**

- **Found during:** Task 1 RED phase
- **Issue:** 现有 vitest.config.ts 仅包含 `src/renderer/src/**/*.test.ts`，主进程测试不在 include 范围内
- **Fix:** 创建独立的 `vitest.main.config.ts`，使用 node 环境和 `src/main/**/*.test.ts` include 模式
- **Files modified:** vitest.main.config.ts (新建), vitest.config.ts (注释说明)
- **Commit:** aefc0c1

**2. [Rule 1 - Bug] 修复 session-store.ts prefer-const 错误**

- **Found during:** Task 1 GREEN phase
- **Issue:** `encodeProjectPath` 中 `let encoded` 应为 `const encoded`（值未重新赋值）
- **Fix:** 改为 `const`
- **Files modified:** src/main/claude/session-store.ts
- **Commit:** b6bc081

**3. [Rule 3 - Blocking] ESLint 要求 await 加括号**

- **Found during:** Task 1 GREEN phase
- **Issue:** `!await isPathAllowed(...)` 运算符优先级不明确，prettier 要求 `(await isPathAllowed(...))`
- **Fix:** 添加括号 `!(await isPathAllowed(...))`
- **Files modified:** src/main/ipc/filesystem.ts
- **Commit:** b6bc081

## Deferred Items

- ChatPanel.vue 中预存在的 ESLint 错误（`_channelId` 未使用、多个函数缺少返回类型、vue/attributes-order）不在本计划范围
- D-23 iframe sandbox 移除 `allow-same-origin` 的兼容性测试需要在运行时环境验证

## Verification Results

| Check | Result |
|-------|--------|
| TypeScript compilation (`tsc --noEmit`) | PASS (0 errors) |
| ESLint (main process files) | PASS (0 errors, 0 warnings) |
| Unit tests (security-hardening.test.ts) | PASS (7/7) |
| Renderer tests (ConfirmDialog.test.ts) | PASS (9/9) |
| No postMessage(..., '*') residual | CONFIRMED |

## Commits

| Hash | Type | Message |
|------|------|---------|
| aefc0c1 | test | test(03-06): add failing tests for UUID validation and symlink resolution |
| b6bc081 | feat | feat(03-06): security hardening for session deletion, filesystem sandbox, and iframe |

## Self-Check: PASSED

All files exist, all commits verified in git log.
