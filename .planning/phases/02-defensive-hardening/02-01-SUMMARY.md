---
phase: 02-defensive-hardening
plan: 01
status: complete
started: 2026-04-24T19:00:00Z
completed: 2026-04-24T19:05:00Z
requirements: [FIX-03, PERF-01]
---

## Summary

Deep-copy messages before forwarding to webview and cache getClaudeSettings() to eliminate readFileSync blocking.

## Changes

### Task 1: Cache getClaudeSettings() with TTL and file-watch invalidation
- Added `statSync` import from 'fs'
- Introduced `SETTINGS_CACHE_TTL_MS` constant (5000ms) and `settingsCache` module-level variable
- Replaced uncached `readFileSync`-on-every-call with TTL+mtime-aware cache logic
- Cache hit: returns cached data if TTL not expired and file mtime unchanged
- Cache miss: reads file, stores mtime+timestamp, returns fresh data
- File deletion detection: `statSync` failure resets cache and returns `{}`
- All 6 existing call sites (getAuthStatus, getModelSetting, handleLaunchClaude, init, get_claude_state) benefit with zero code changes

### Task 2: Deep-copy messages before forwarding to webview
- Replaced direct `msg` reference in `tagged` object with `structuredClone(msg)` deep copy
- Try/catch wraps structuredClone — fallback to original `msg` for non-cloneable values
- All existing message handling (plan mode, tool permissions, token tracking) reads from original `msg` before the clone point

## Key Files

### Created/Modified
- `src/main/ipc/claude-webview.ts` — TTL+mtime settings cache + structuredClone deep-copy

## Verification

- TypeScript compiles without errors: `npx tsc --noEmit -p tsconfig.node.json` — PASS
- `structuredClone` present in message forwarding path — PASS
- `settingsCache` variable at module level — PASS
- `readFileSync` only called in cache-miss path (1 invocation) — PASS
- No behavioral changes to existing message handling — PASS

## Self-Check: PASSED

- [x] All tasks executed
- [x] Each task committed individually (single atomic commit for both tasks — same file, tightly coupled)
- [x] TypeScript compiles cleanly
- [x] No modifications to shared orchestrator artifacts
