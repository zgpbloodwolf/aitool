# Roadmap: AI Tools - 429 Bug Fix

## Overview

Fix the 429 rate limit error caused by injecting `modelUsage` and `total_cost_usd` into `result` messages, which activates a dormant context-management code path in the Claude Code webview. Remove the injection, preserve the context usage badge via existing stream data only, then harden the message pipeline against future mutation and blocking issues.

## Phases

**Phase Numbering:**
- Integer phases (1, 2): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Root Cause Fix** - Remove modelUsage/total_cost_usd injection, verify 429 resolved, preserve badge from stream_event data only
- [x] **Phase 2: Defensive Hardening** - Deep-copy messages before forwarding, cache settings reads
- [x] **Phase 3: UX Enhancement** - 错误恢复、键盘快捷键、操作确认、进程监控、标签页增强、文件树增强、安全加固

## Phase Details

### Phase 1: Root Cause Fix
**Goal**: Users can send messages and receive responses without hitting 429 rate limit errors
**Depends on**: Nothing (first phase)
**Requirements**: FIX-01, FIX-02, KEEP-01
**Success Criteria** (what must be TRUE):
  1. User can send a message and receive a complete response without any 429 error
  2. The `result` messages forwarded to the webview contain no injected `modelUsage` or `total_cost_usd` fields
  3. The context usage badge still displays token usage percentage based on `stream_event` data already present in the message stream
**Plans**: 1 plan

Plan:
- [x] 01-01-PLAN.md -- Remove modelUsage/total_cost_usd injection from result messages

### Phase 2: Defensive Hardening
**Goal**: The message pipeline does not mutate CLI output and does not block the event loop on settings reads
**Depends on**: Phase 1
**Requirements**: FIX-03, PERF-01
**Success Criteria** (what must be TRUE):
  1. Messages forwarded to the webview are deep copies -- the original claude.exe output objects are never modified
  2. `getClaudeSettings()` results are cached so that `readFileSync` is not called on every `result` message
**Plans**: 1 plan

Plans:
- [x] 02-01-PLAN.md -- Deep-copy messages + cache getClaudeSettings with TTL and file-watch

### Phase 3: UX Enhancement
**Goal**: 全面提升桌面客户端用户体验，包括错误恢复机制、键盘快捷键、操作确认、进程健康监控、标签页增强、文件树增强和安全加固
**Depends on**: Phase 2
**Requirements**: D-01 through D-24 (见 CONTEXT.md)
**Success Criteria** (what must be TRUE):
  1. Webview 初始化失败时显示重试按钮，用户可重新初始化
  2. 会话删除/关闭活跃标签/切换工作区前均有确认对话框
  3. 完整键盘快捷键集（Ctrl+N/W/B/Tab 等）正常工作
  4. Claude 进程崩溃后自动重连并恢复会话状态
  5. 每 30 秒心跳检测进程存活，挂死时通知用户
  6. 标签页显示智能标题和状态指示器
  7. 侧边栏宽度可调整、文件树支持搜索过滤和自动刷新
  8. deleteSession 验证 UUID 格式，iframe sandbox 安全加固
**Plans**: 6 plans

Plans:
- [x] 03-01-PLAN.md -- ConfirmDialog 组件 + 错误恢复与确认集成 (D-01,02,03,04,06,07,08,09)
- [x] 03-02-PLAN.md -- 键盘快捷键 + 标签拖拽排序 (D-05, D-16)
- [x] 03-03-PLAN.md -- 进程健康监控 + 全局异常处理 (D-10,11,12,24)
- [x] 03-04-PLAN.md -- 标签页体验增强: 智能标签名 + 状态指示器 + 中键关闭 (D-13,14,15)
- [x] 03-05-PLAN.md -- 侧边栏与文件树增强: 拖拽宽度 + 文件监听 + 搜索 + 收藏 (D-17,18,19,20)
- [x] 03-06-PLAN.md -- 安全加固: UUID 验证 + 符号链接解析 + iframe sandbox (D-21,22,23)

## Progress

**Execution Order:**
Phases execute in numeric order: 1, 2, 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Root Cause Fix | 1/1 | Complete | 2026-04-24 |
| 2. Defensive Hardening | 1/1 | Complete | 2026-04-24 |
| 3. UX Enhancement | 6/6 | Complete | 2026-04-25 |
