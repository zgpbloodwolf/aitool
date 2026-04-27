# Phase 07b: Stop Button Fix - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning (updated)

<domain>
## Phase Boundary

修复对话过程中点击停止按钮无法中断当前生成的问题。停止按钮应通过 stdin 管道发送控制消息让 claude.exe 优雅停止当前操作，进程继续存活，用户可在同一会话中继续对话。

**范围限制**: 只修复停止按钮的中断功能，不涉及关闭标签页（close_channel 路径已正常工作）、不涉及 UI 样式变更、不涉及新增功能。
</domain>

<decisions>
## Implementation Decisions

### 中断机制（重大更新）
- **D-01:** 通过 stdin 管道发送控制消息实现中断，而非 SIGINT 信号 — 发送 `{request_id: "随机ID", type: "control_request", request: {subtype: "interrupt"}}`
  - Why: VSCode Claude Code 插件的实际实现方式是通过 stdin 管道协议发送 `control_request` 控制消息，不依赖进程信号
  - Windows 上 SIGINT 无法可靠送达非进程组组长的子进程（之前的 detached 方案已回退）
  - stdin 管道协议与平台无关，在所有操作系统上行为一致
  - CLI 使用 `--input-format stream-json` 启动，stdin 就是用于接收 JSON 消息的

- **D-02:** `interrupt()` 方法改为发送 JSON 控制消息，不再使用 `process.kill(pid, 'SIGINT')`
  - 使用现有的 `send()` 方法写入 stdin 管道
  - 消息格式: `{request_id: string, type: "control_request", request: {subtype: "interrupt"}}`

### 回退策略
- **D-03:** 保留 kill-and-resume 作为回退 — 如果控制消息发送后 CLI 无响应（超时），回退到停止进程并用 `--resume` 恢复
  - 回退逻辑: 发送控制消息 → 等待 CLI 输出 `[Request interrupted by user]` → 超时则 kill + resume
  - 现有的 `channel.interrupted` 标记和 `resumeChannelAndSendMessage` 保留用于回退路径

### UI 状态
- **D-04:** 中断后无需额外 UI 提示 — CLI 自身会输出包含 `[Request interrupted by user]` 的 result 消息，webview 自然更新状态
  - 移除当前方案中的合成 result 消息（不再需要手动构造 synthetic result）
  - 正常路径下进程不退出，webview 保持连接

### 代码清理
- **D-05:** `interrupt()` 方法中的 SIGINT 逻辑和 `detached` 相关代码全部移除 — 用 stdin 控制消息替代
- **D-06:** `handleInterrupt` 函数简化 — 直接发送控制消息，Windows 不再需要特殊处理
- **D-07:** 保留诊断日志 — 中断操作的日志记录（channelId、结果等）继续存在

### Claude's Discretion
- 具体的超时时间（建议 3-5 秒）
- 错误处理的边界情况（stdin 已关闭、进程已退出等）
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 核心文件
- `src/main/claude/process-manager.ts` — ClaudeProcessManager 类，`interrupt()` (L168-191)、`send()` (L132-139)、`start()` (L60-130)
- `src/main/ipc/claude-webview.ts` — IPC handler，`handleInterrupt` (L419-471)、`handleIoMessage` (L348-373)、`resumeChannelAndSendMessage` (L376-417)

### VSCode 插件参考实现
- `extensions/anthropic.claude-code-2.1.120@win32-x64/extension.js` — VSCode Claude Code 插件源码
  - `ProcessTransport.spawnLocalProcess()` — spawn 方式（detached: false, shell: false）
  - `Query.interrupt()` → `request({subtype: "interrupt"})` — 通过 stdin 发送控制消息
  - `Query.request()` — 发送 `{type: "control_request", request: {...}}` 格式
  - 强制终止路径: SIGTERM (2s delay) → SIGKILL (5s later)

### stdin 协议
- Claude CLI 使用 `--input-format stream-json --output-format stream-json` 模式
- 已有的 `send()` 方法通过 stdin 写入 JSON + 换行
- `sendUserMessage()` 已在使用相同管道发送 `{type: "user", ...}` 消息
- 控制消息格式: `{request_id: string, type: "control_request", request: {subtype: "interrupt"}}`
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `send(msg)` 方法已存在 — 直接写入 `process.stdin`，可用于发送控制消息
- `resumeChannelAndSendMessage()` 已存在 — kill-and-resume 回退路径的完整实现
- `channel.interrupted` 标记机制已存在 — exit handler 可识别用户主动中断

### Established Patterns
- stdin 管道消息格式: `JSON.stringify(msg) + '\n'`
- 已有消息类型: `user`（`sendUserMessage`）— 控制消息是同一管道的另一种消息类型
- VSCode 插件检测 `"[Request interrupted by user"` 正则表示 CLI 会输出中断确认

### Integration Points
- `handleInterrupt` 被 `claude-webview:from-webview` IPC 消息路由的 `interrupt_claude` case 触发
- `interrupt()` 被 `handleInterrupt` 调用
- 中断后的 CLI 输出通过 `proc.on('message')` 正常流转发到 webview

### 关键约束
- stdin 管道可能已关闭（进程正在退出时）— `send()` 方法已有 `try-catch` 处理
- CLI 不一定支持 `control_request` 消息类型（需验证）— 不支持时回退到 kill-and-resume
</code_context>

<specifics>
## Specific Ideas

- 参考 VSCode Claude Code 插件的实现，使用 stdin 控制消息而非进程信号
- 停止按钮行为应与 VSCode 插件完全一致 — 点击后立即中断，无延迟，无额外提示
</specifics>

<deferred>
## Deferred Ideas

None — 讨论聚焦在停止按钮修复范围内
</deferred>

---

*Phase: 07b-stop-button-fix*
*Context gathered: 2026-04-27*
*Context updated: 2026-04-27 (基于 VSCode 插件源码分析，方案从 SIGINT 改为 stdin 控制消息)*
