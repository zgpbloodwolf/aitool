---
phase: 07b-stop-button-fix
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/main/claude/process-manager.ts
  - src/main/ipc/claude-webview.ts
autonomous: true
requirements: [D-01, D-02, D-03, D-04, D-05, D-06, D-07]

must_haves:
  truths:
    - "点击停止按钮时通过 stdin 管道发送 control_request 控制消息中断 claude.exe"
    - "正常路径下中断后进程不退出，用户可在同一会话中继续对话"
    - "CLI 输出包含 [Request interrupted by user] 的 result 消息，webview 自然更新状态"
    - "控制消息超时无响应时回退到 kill-and-resume 路径"
    - "handleInterrupt 和 interrupt() 保留诊断日志"
  artifacts:
    - path: "src/main/claude/process-manager.ts"
      provides: "interrupt() 用 stdin 控制消息替代 SIGINT"
      contains: "control_request"
    - path: "src/main/ipc/claude-webview.ts"
      provides: "handleInterrupt 发送控制消息 + 超时回退 kill-and-resume"
      contains: "interrupt.*control_request"
  key_links:
    - from: "src/main/ipc/claude-webview.ts"
      to: "src/main/claude/process-manager.ts"
      via: "channel.process.send(controlMessage)"
      pattern: "send\\(.*control_request"
    - from: "src/main/ipc/claude-webview.ts"
      to: "interrupt_claude"
      via: "switch case 'interrupt_claude' -> handleInterrupt"
      pattern: "case 'interrupt_claude'"
---

<objective>
用 stdin 控制消息替代 SIGINT 信号实现停止按钮中断功能。

Purpose: 当前 interrupt() 使用 process.kill(pid, 'SIGINT')，在 Windows 上不可靠（即使 detached 方案也已回退）。VSCode Claude Code 插件的实际实现是通过 stdin 管道发送 JSON 控制消息 {type: "control_request", request: {subtype: "interrupt"}}，这种方式与平台无关且行为一致。CLI 使用 --input-format stream-json 启动，stdin 天然支持接收此类消息。

Output: 修改后的 process-manager.ts（interrupt() 用 stdin 控制消息）和 claude-webview.ts（handleInterrupt 简化 + 超时回退）
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/07b-stop-button-fix/07b-CONTEXT.md

<interfaces>
<!-- 执行器需要的关键接口，从代码库提取 -->

From src/main/claude/process-manager.ts — ClaudeProcessManager 类:

```typescript
// L12-18: 类成员
export class ClaudeProcessManager extends EventEmitter {
  private process: ChildProcess | null = null
  private _running = false
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null
  private _resumeSessionId: string | null = null

  get running(): boolean { return this._running }         // L20-22
  get resumeSessionId(): string | null { ... }            // L24-26
  startHealthCheck(onUnresponsive, intervalMs?): void     // L34-50
  stopHealthCheck(): void                                  // L53-58
  start(options: ClaudeProcessOptions): void               // L60-130
  send(msg: unknown): void                                 // L132-139
  sendUserMessage(text: string): void                      // L141-151
  stop(): void                                             // L153-166
  interrupt(): void                                        // L168-191
}
```

ClaudeProcessOptions 接口 (L5-10):
```typescript
export interface ClaudeProcessOptions {
  claudePath: string
  cwd?: string
  env?: Record<string, string>
  resumeSessionId?: string
}
```

当前 send() 方法 (L132-139) — 复用此方法发送控制消息:
```typescript
send(msg: unknown): void {
  if (!this.process?.stdin || this.process.stdin.destroyed) return
  try {
    this.process.stdin.write(JSON.stringify(msg) + '\n')
  } catch {
    // stream closed
  }
}
```

当前 interrupt() 方法 (L168-191) — 需要替换:
```typescript
interrupt(): void {
  console.log('[Claude] interrupt() 调用 — PID:', this.process?.pid, '_running:', this._running)
  if (!this.process || !this._running) {
    console.log('[Claude] interrupt() 跳过 — 进程未运行')
    return
  }
  const pid = this.process.pid!
  try {
    process.kill(pid, 'SIGINT')
    console.log('[Claude] interrupt() SIGINT 已发送 — PID:', pid)
  } catch (err) {
    console.warn('[Claude] interrupt() SIGINT 发送失败，尝试强制终止:', err)
    try {
      this.process.kill()
    } catch (killErr) {
      console.warn('[Claude] interrupt() 强制终止也失败:', killErr)
    }
  }
}
```

From src/main/ipc/claude-webview.ts:

Channel 接口 (L28-41):
```typescript
interface Channel {
  process: ClaudeProcessManager
  permissionMode: string
  planText: string
  pendingToolUse: PendingToolUse | null
  permissionResolvers: Map<string, PermissionResolver>
  sentPermissionRequests: Set<string>
  totalInputTokens: number
  totalOutputTokens: number
  lastSessionId: string | null
  interrupted?: boolean    // L41 — 用户主动中断标记
}
```

当前 handleInterrupt 函数 (L419-471) — 需要简化:
```typescript
function handleInterrupt(channelId: string): void {
  safeLog('[ClaudeIPC] handleInterrupt 收到中断请求 — channelId:', channelId)
  const channel = channels.get(channelId)
  if (!channel) {
    safeLog('[ClaudeIPC] handleInterrupt 未找到频道 — channelId:', channelId, '活跃频道:', [...channels.keys()])
    return
  }
  safeLog('[ClaudeIPC] handleInterrupt 找到频道 — channelId:', channelId, '进程运行状态:', channel.process.running)

  if (!channel.process.running) {
    safeLog('[ClaudeIPC] handleInterrupt 进程未运行，跳过')
    return
  }

  // 非 Windows 平台：SIGINT 可以可靠送达，使用原有 interrupt()
  if (process.platform !== 'win32') {
    channel.process.interrupt()
    safeLog('[ClaudeIPC] handleInterrupt interrupt() 已调用 — channelId:', channelId)
    return
  }

  // Windows 路径: 发送合成 result → 标记 interrupted → 停止进程
  const sessionId = channel.lastSessionId
  if (!sessionId) {
    safeLog('[ClaudeIPC] handleInterrupt 无 sessionId，回退到强制中断')
    channel.process.interrupt()
    return
  }

  safeLog('[ClaudeIPC] handleInterrupt 停止进程 — sessionId:', sessionId)
  // 1. 发送合成 result 消息
  sendToWebview({ type: 'io_message', channelId, message: { type: 'result', subtype: 'success', ... } })
  // 2. 标记为用户主动中断
  channel.interrupted = true
  channel.pendingToolUse = null
  // 3. 停止进程
  channel.process.stop()
}
```

resumeChannelAndSendMessage 函数 (L376-417) — 保留不动（回退路径依赖）:
```typescript
async function resumeChannelAndSendMessage(channelId, channel, message): Promise<void> {
  // 清理旧进程 → handleLaunchClaude(--resume) → 发送消息
}
```

handleIoMessage 函数 (L348-373) — 保留不动（回退路径依赖）:
```typescript
function handleIoMessage(channelId: string, message: unknown, _done?: boolean): void {
  // 进程被中断后已停止 — 用 --resume 恢复，再发送消息
  if (!channel.process.running && channel.interrupted && channel.lastSessionId) {
    resumeChannelAndSendMessage(channelId, channel, message)
    return
  }
  // 正常路径: 发送消息到 stdin
}
```

消息路由入口 (L665):
```typescript
case 'interrupt_claude':
  handleInterrupt(msg.channelId)
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: 修改 process-manager.ts — interrupt() 改用 stdin 控制消息</name>
  <files>src/main/claude/process-manager.ts</files>
  <read_first>
    src/main/claude/process-manager.ts (完整文件，重点关注 interrupt() L168-191 和 send() L132-139)
  </read_first>
  <action>
读取文件后执行以下修改：

**修改: 替换 interrupt() 方法 (L168-191) (per D-01, D-02, D-05, D-07)**

删除整个 interrupt() 方法体（L168-191），替换为通过 stdin 管道发送控制消息的新实现。

核心逻辑：
1. 生成随机 request_id（与 VSCode 插件一致: `Math.random().toString(36).substring(2, 15)`）
2. 构造控制消息: `{request_id, type: "control_request", request: {subtype: "interrupt"}}`
3. 通过已有的 `send()` 方法写入 stdin 管道
4. stdin 已关闭或进程已退出时 send() 内部已有 try-catch 处理，无需额外错误处理

替换 L168-191 的整个 interrupt() 方法为：

```typescript
  /** D-01, D-02: 通过 stdin 管道发送控制消息中断 claude.exe（替代 SIGINT） */
  interrupt(): void {
    console.log('[Claude] interrupt() 调用 — PID:', this.process?.pid, '_running:', this._running)

    if (!this.process || !this._running) {
      console.log('[Claude] interrupt() 跳过 — 进程未运行')
      return
    }

    // D-01: 通过 stdin 管道发送控制消息，与 VSCode Claude Code 插件方式一致
    // CLI 使用 --input-format stream-json 模式，stdin 接收 JSON 消息
    // 消息格式: {request_id: string, type: "control_request", request: {subtype: "interrupt"}}
    const requestId = Math.random().toString(36).substring(2, 15)
    const controlMessage = {
      request_id: requestId,
      type: 'control_request',
      request: { subtype: 'interrupt' }
    }

    console.log('[Claude] interrupt() 发送控制消息 — requestId:', requestId)
    this.send(controlMessage)
    console.log('[Claude] interrupt() 控制消息已发送 — requestId:', requestId)
  }
```

**确认不需要修改的其他部分 (per D-05):**
- spawn 选项中的 `detached` 相关代码已在之前的提交中移除（当前代码 L88-93 无 detached）
- send() 方法 (L132-139) 保持不变，直接复用
- stop() 方法 (L153-166) 保持不变
- start() 方法 (L60-130) 保持不变
  </action>
  <verify>
    <automated>cd "e:/work/projects/new-aitools" && npx tsc --noEmit --pretty 2>&1 | head -20 && echo "---TYPE CHECK PASSED---" && grep -n "control_request" src/main/claude/process-manager.ts && grep -n "SIGINT" src/main/claude/process-manager.ts && echo "---SIGINT CHECK (should be empty)---" && grep -n "this.send(controlMessage)" src/main/claude/process-manager.ts</automated>
  </verify>
  <done>
    - interrupt() 方法通过 this.send() 发送 {type: "control_request", request: {subtype: "interrupt"}} 控制消息
    - interrupt() 中不再有 process.kill() 或 SIGINT 相关代码
    - interrupt() 保留诊断日志（PID、_running、requestId）
    - send() 方法未被修改
    - stop() 方法未被修改
    - start() 方法未被修改
    - TypeScript 编译零错误
  </done>
  <acceptance_criteria>
    - grep "control_request" src/main/claude/process-manager.ts 命中至少 1 行
    - grep "SIGINT" src/main/claude/process-manager.ts 无命中
    - grep "this.send(controlMessage)" src/main/claude/process-manager.ts 命中 1 行
    - npx tsc --noEmit 零错误
  </acceptance_criteria>
</task>

<task type="auto" tdd="false">
  <name>Task 2: 修改 claude-webview.ts — 简化 handleInterrupt + 超时回退</name>
  <files>src/main/ipc/claude-webview.ts</files>
  <read_first>
    src/main/ipc/claude-webview.ts (完整文件，重点关注 handleInterrupt L419-471、resumeChannelAndSendMessage L376-417、handleIoMessage L348-373)
  </read_first>
  <action>
读取文件后执行以下修改：

**修改: 替换 handleInterrupt 函数 (L419-471) (per D-03, D-04, D-06, D-07)**

删除整个 handleInterrupt 函数（L419-471），替换为简化版本。核心变化：
1. 移除 `process.platform !== 'win32'` 分支（per D-06 — 不再需要平台判断）
2. 移除合成 result 消息（per D-04 — CLI 会自己输出包含 [Request interrupted by user] 的 result 消息）
3. 直接调用 `channel.process.interrupt()` 发送 stdin 控制消息
4. 设置超时定时器，如果 5 秒内进程未退出或 CLI 无响应，回退到 kill-and-resume（per D-03）
5. 保留 channel.interrupted 标记（回退路径需要）和诊断日志（per D-07）

替换 L419-471 的整个 handleInterrupt 函数为：

```typescript
/** D-06: 简化 handleInterrupt — 通过 stdin 控制消息中断，超时回退 kill-and-resume */
function handleInterrupt(channelId: string): void {
  safeLog('[ClaudeIPC] handleInterrupt 收到中断请求 — channelId:', channelId)
  const channel = channels.get(channelId)
  if (!channel) {
    safeLog('[ClaudeIPC] handleInterrupt 未找到频道 — channelId:', channelId, '活跃频道:', [...channels.keys()])
    return
  }
  safeLog('[ClaudeIPC] handleInterrupt 找到频道 — channelId:', channelId, '进程运行状态:', channel.process.running)

  if (!channel.process.running) {
    safeLog('[ClaudeIPC] handleInterrupt 进程未运行，跳过')
    return
  }

  // D-01, D-06: 统一通过 stdin 控制消息中断，不区分平台
  channel.process.interrupt()
  safeLog('[ClaudeIPC] handleInterrupt 控制消息已发送 — channelId:', channelId)

  // D-03: 超时回退 — 如果 5 秒后进程仍在运行，回退到 kill-and-resume
  const sessionId = channel.lastSessionId
  if (!sessionId) {
    safeLog('[ClaudeIPC] handleInterrupt 无 sessionId，跳过超时回退设置')
    return
  }

  // 保存引用用于超时回调
  const proc = channel.process

  setTimeout(() => {
    // 进程已退出或 channel 已不存在 — 无需回退
    if (!proc.running) {
      safeLog('[ClaudeIPC] handleInterrupt 超时检查: 进程已退出 — channelId:', channelId)
      return
    }

    const currentChannel = channels.get(channelId)
    if (!currentChannel || currentChannel.process !== proc) {
      return
    }

    // 进程仍在运行 — CLI 未响应控制消息，回退到 kill-and-resume
    safeLog('[ClaudeIPC] handleInterrupt 超时回退: CLI 未响应，执行 kill-and-resume — channelId:', channelId)
    channel.interrupted = true
    channel.pendingToolUse = null
    proc.stop()
  }, 5000)
}
```

**确认不需要修改的其他部分：**
- resumeChannelAndSendMessage (L376-417) — 保持不变，回退路径依赖
- handleIoMessage (L348-373) — 保持不变，回退路径依赖
- exit handler (L281-305) — 保持不变，channel.interrupted 检查继续用于回退路径
- 消息路由 case 'interrupt_claude' (L665-666) — 保持不变
  </action>
  <verify>
    <automated>cd "e:/work/projects/new-aitools" && npx tsc --noEmit --pretty 2>&1 | head -20 && echo "---TYPE CHECK PASSED---" && grep -n "process.platform" src/main/ipc/claude-webview.ts && echo "---PLATFORM CHECK---" && grep -n "control消息已发送" src/main/ipc/claude-webview.ts && grep -n "超时回退" src/main/ipc/claude-webview.ts && grep -c "sendToWebview.*result.*subtype.*success" src/main/ipc/claude-webview.ts</automated>
  </verify>
  <done>
    - handleInterrupt 不再有 process.platform !== 'win32' 分支
    - handleInterrupt 不再发送合成 result 消息
    - handleInterrupt 直接调用 channel.process.interrupt()
    - handleInterrupt 设置 5 秒超时定时器，超时后回退到 kill-and-resume
    - resumeChannelAndSendMessage 函数未被修改
    - handleIoMessage 函数未被修改
    - exit handler 中 channel.interrupted 检查未被修改
    - 诊断日志保留
    - TypeScript 编译零错误
  </done>
  <acceptance_criteria>
    - grep "process.platform" src/main/ipc/claude-webview.ts 无命中（handleInterrupt 中）
    - grep "控制消息已发送" src/main/ipc/claude-webview.ts 命中 1 行
    - grep "超时回退" src/main/ipc/claude-webview.ts 命中至少 1 行
    - npx tsc --noEmit 零错误
  </acceptance_criteria>
</task>

<task type="auto" tdd="false">
  <name>Task 3: 编译验证 + 代码一致性检查</name>
  <files></files>
  <read_first>
    src/main/claude/process-manager.ts
    src/main/ipc/claude-webview.ts
  </read_first>
  <action>
读取两个修改后的文件，执行以下验证步骤：

1. **TypeScript 编译检查**: 运行 `npx tsc --noEmit` 确认零错误

2. **代码一致性检查**:
   - process-manager.ts: 确认 interrupt() 中不再有 SIGINT、process.kill、detached 相关代码
   - process-manager.ts: 确认 send()、stop()、start() 方法未被修改
   - claude-webview.ts: 确认 handleInterrupt 中不再有 process.platform 分支和合成 result 消息
   - claude-webview.ts: 确认 resumeChannelAndSendMessage 和 handleIoMessage 未被修改
   - 两个文件: 确认诊断日志保留

3. **git diff 审查**: 查看完整的 git diff，确认只有预期的修改

如果发现任何不一致，直接修复。
  </action>
  <verify>
    <automated>cd "e:/work/projects/new-aitools" && npx tsc --noEmit --pretty 2>&1 | head -20 && echo "---TYPE CHECK PASSED---" && echo "=== SIGINT check ===" && grep -n "SIGINT" src/main/claude/process-manager.ts && echo "=== platform check ===" && grep -n "process.platform" src/main/ipc/claude-webview.ts && echo "=== control_request check ===" && grep -n "control_request" src/main/claude/process-manager.ts && echo "=== timeout check ===" && grep -n "5000" src/main/ipc/claude-webview.ts && echo "=== detached check ===" && grep -n "detached" src/main/claude/process-manager.ts</automated>
  </verify>
  <done>
    - TypeScript 编译零错误
    - interrupt() 不含 SIGINT / process.kill / detached 代码
    - handleInterrupt 不含 process.platform 分支和合成 result 消息
    - send()、stop()、start()、resumeChannelAndSendMessage、handleIoMessage 均未被修改
    - git diff 显示只有预期的修改
  </done>
  <acceptance_criteria>
    - npx tsc --noEmit 零错误
    - grep "SIGINT" src/main/claude/process-manager.ts 无命中
    - grep "control_request" src/main/claude/process-manager.ts 命中至少 1 行
    - grep "detached" src/main/claude/process-manager.ts 无命中
    - grep "process.platform" src/main/ipc/claude-webview.ts 无命中
  </acceptance_criteria>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| webview -> IPC -> handleInterrupt | webview 发送 interrupt_claude 消息，channelId 可被篡改 |
| 主进程 -> claude.exe stdin | 通过 stdin 管道发送控制消息，消息方向为主进程->子进程 |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-07b-01 | Tampering | handleInterrupt channelId | accept | channelId 由内部 webview 生成，非用户输入；篡改仅影响中断错误的 channel（无实际危害） |
| T-07b-02 | DoS | interrupt() 反复调用 | accept | interrupt 是幂等操作（重复发送控制消息 CLI 忽略）；诊断日志记录每次调用 |
| T-07b-03 | Spoofing | 伪造控制消息格式 | accept | stdin 管道仅在主进程内部使用，外部无法注入；消息格式由代码控制 |
</threat_model>

<verification>
1. TypeScript 编译通过: `npx tsc --noEmit`
2. grep 验证 `control_request` 存在于 process-manager.ts
3. grep 验证 `SIGINT` 不存在于 process-manager.ts
4. grep 验证 `detached` 不存在于 process-manager.ts
5. grep 验证 `process.platform` 不存在于 claude-webview.ts 的 handleInterrupt 中
6. grep 验证超时回退逻辑存在于 claude-webview.ts
7. 运行 `pnpm dev` 启动应用，发送消息后点击停止按钮，观察：
   - 控制台日志显示 "控制消息已发送"
   - CLI 输出包含 [Request interrupted by user] 的消息
   - 进程继续存活，可在同一会话中继续对话
</verification>

<success_criteria>
1. process-manager.ts 的 interrupt() 通过 this.send() 发送 {type: "control_request", request: {subtype: "interrupt"}} 控制消息
2. interrupt() 不再包含 SIGINT、process.kill 或 detached 相关代码
3. handleInterrupt 不再有 process.platform !== 'win32' 分支判断
4. handleInterrupt 不再发送合成 result 消息到 webview
5. handleInterrupt 设置 5 秒超时定时器，超时后回退到 kill-and-resume
6. resumeChannelAndSendMessage 函数未被修改
7. handleIoMessage 函数未被修改
8. 诊断日志保留（interrupt() 和 handleInterrupt 中）
9. TypeScript 编译零错误
10. 功能验证: 点击停止按钮后 CLI 中断当前生成，进程继续存活，用户可继续对话
</success_criteria>

<output>
After completion, create `.planning/phases/07b-stop-button-fix/07b-01-SUMMARY.md`
</output>
