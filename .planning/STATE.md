# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-24)

**Core value:** Users can interact with Claude Code in the desktop client without 429 rate limit errors
**Current focus:** Phase 07-workflow-enhancement in progress

## Current Position

Phase: 07-workflow-enhancement
Plan: 3/3 in current phase (complete)
Status: Phase 07 complete
Last activity: 2026-04-27 -- Plan 07-03 Token 用量统计面板 UI complete

Progress: [#########.] ~90% (phases 1-7 complete, phase 8 remaining)

## Performance Metrics

**Velocity:**
- Total plans completed: 14
- Average duration: ~6 min
- Total execution time: ~1h 39min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Root Cause Fix | 1 | ~5 min | ~5 min |
| 2. Defensive Hardening | 1 | ~5 min | ~5 min |
| 3. UX Enhancement | 6 | ~40 min | ~7 min |
| 4. Quick Wins | 5 | ~18 min | ~3.6 min |
| 5. 主题个性化 | 3 | ~16 min | ~5 min |
| 7. 工作流增强 | 3 | ~19 min | ~6 min |

**Recent Trend:**
- Last 5 plans: 06-03 (3min), 06-04 (3min), 07-01 (7min), 07-02 (3min), 07-03 (9min)
- Trend: Consistent execution, Phase 7 in progress

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Research confirmed `modelUsage`/`total_cost_usd` injection into `result` messages activates dormant webview code path, most likely causing 429 via Zhipu AI's strict concurrency limits
- 关闭行为使用独立 JSON 文件存储（userData/close-behavior.json）而非 IPC 桥接 localStorage，因为主进程在渲染进程未就绪时就需要读取
- ClipboardPanel 使用 Teleport to body 避免 z-index 层叠问题，通过 App.vue handleShortcut 转发到 ChatPanel.toggleClipboardPanel
- Ctrl+Shift+V 在主进程 before-input-event 拦截确保 iframe 焦点时也能触发
- Token 用量持久化使用 JSON 文件 + Promise chain 写入队列，按天汇总，90 天自动清理
- NSIS 安装脚本使用 SHCTX 自动路由注册表到 HKLM/HKCU，运行时检查仅写 HKCU
- 单实例锁通过 requestSingleInstanceLock + second-instance argv 过滤实现右键菜单目录传递
- chartOptions 使用 computed 确保主题切换时图表颜色更新，工作区趋势图用全局 days 近似

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2 | Message deduplication (HARD-01) | Deferred | 2026-04-24 |
| v2 | Real session_id tracking (HARD-02) | Deferred | 2026-04-24 |
| v2 | setInterval badge rework (HARD-03) | Deferred | 2026-04-24 |

## Session Continuity

Last session: 2026-04-27
Stopped at: Phase 07 Plan 03 complete — Token 用量统计面板 UI
Resume file: .planning/phases/07-workflow-enhancement/07-03-SUMMARY.md
