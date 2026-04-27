# Phase 07b: Stop Button Fix - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27 (updated)
**Phase:** 07b-stop-button-fix
**Areas discussed:** 中断机制、回退策略、UI 状态

---

## 中断机制（重大更新）

| Option | Description | Selected |
|--------|-------------|----------|
| stdin 控制消息 | 通过 stdin 管道发送 control_request 消息，与 VSCode 插件一致 | ✓ |
| 保持现状 | 继续用 kill-and-resume 方案 | |
| 先验证 | 先手动验证再决定 | |

**User's choice:** stdin 控制消息（推荐）
**Notes:** 分析 VSCode Claude Code 插件源码发现其通过 stdin 管道发送 `{type: "control_request", request: {subtype: "interrupt"}}` 控制消息实现中断，不依赖 SIGINT 信号。这是与平台无关的方案。

---

## 回退策略

| Option | Description | Selected |
|--------|-------------|----------|
| 保留 kill-and-resume 作为回退 | 控制消息超时后回退到现有方案 | ✓ |
| 仅发送控制消息 | 无效时不做处理 | |
| 无效时强制终止 | 直接 kill 进程不恢复 | |

**User's choice:** 保留 kill-and-resume 作为回退（推荐）
**Notes:** 控制消息可能不被 CLI 支持（需验证），保留现有 kill-and-resume 机制作为安全网。

---

## UI 状态

| Option | Description | Selected |
|--------|-------------|----------|
| 无需提示 | 中断后直接回到可输入状态 | ✓ |
| 简单提示 | 显示"已中断"提示 | |
| 加载提示 | 显示"正在恢复..." | |

**User's choice:** 无需提示（推荐）
**Notes:** CLI 接收到控制消息后会输出 `[Request interrupted by user]` 类似的 result 消息，webview 自然更新状态。不需要手动构造合成 result。

---

## 关键发现

### VSCode 插件中断机制分析
- **中断方式**: stdin 管道发送 JSON 控制消息，非 SIGINT 信号
- **消息格式**: `{request_id: string, type: "control_request", request: {subtype: "interrupt"}}`
- **spawn 选项**: `detached: false`, `shell: false`, `windowsHide: true`
- **强制终止路径**: SIGTERM (2s delay) → SIGKILL (5s later)
- **中断检测**: 正则 `/\[Request interrupted by user[^\]]*\]/` 匹配 CLI 输出

### 之前的方案历史（4 次迭代）
1. ~~detached 进程组 + process.kill(-pid)~~ — 回退，Windows 上行为不稳定
2. ~~直接 process.kill(pid, 'SIGINT')~~ — Windows 上 libuv 回退到 TerminateProcess
3. ~~kill + 立即 resume~~ — 新进程立即崩溃
4. ~~kill + lazy-resume~~ — 当前方案，可用但体验较差（需要重启进程）

---

## Claude's Discretion

- 超时时间（建议 3-5 秒）
- stdin 已关闭时的错误处理
- 进程已退出时的边界情况

## Deferred Ideas

None
