import { spawn, type ChildProcess } from 'child_process'
import { createInterface } from 'readline'
import { EventEmitter } from 'events'

export interface ClaudeProcessOptions {
  claudePath: string
  cwd?: string
  env?: Record<string, string>
  resumeSessionId?: string
}

export class ClaudeProcessManager extends EventEmitter {
  private process: ChildProcess | null = null
  private _running = false
  // D-11: 心跳检测定时器
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null
  // D-10: 崩溃恢复支持 — 保存启动时的 resumeSessionId
  private _resumeSessionId: string | null = null

  get running(): boolean {
    return this._running
  }

  /** D-10: 获取启动时的 resumeSessionId，用于崩溃后恢复 */
  get resumeSessionId(): string | null {
    return this._resumeSessionId
  }

  /**
   * D-11: 启动心跳检测，定期检查 claude.exe 子进程是否存活
   * @param onUnresponsive 进程挂死时的回调（exit 事件未触发但进程不存在）
   * @param intervalMs 检测间隔，默认 30 秒
   */
  startHealthCheck(onUnresponsive: () => void, intervalMs = 30000): void {
    this.stopHealthCheck()
    this.healthCheckInterval = setInterval(() => {
      // 没有进程在运行，跳过检测
      if (!this.process || !this._running) return
      try {
        // process.kill(pid, 0) 不发送信号，仅检查进程是否存在
        // 如果进程不存在会抛出异常
        process.kill(this.process.pid!, 0)
      } catch {
        // 进程已死但 exit 事件未触发 → 挂死状态
        if (this._running) {
          onUnresponsive()
        }
      }
    }, intervalMs)
  }

  /** D-11: 停止心跳检测 */
  stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
  }

  start(options: ClaudeProcessOptions): void {
    if (this.process) {
      this.stop()
    }

    // D-10: 保存 resumeSessionId 用于崩溃恢复
    this._resumeSessionId = options.resumeSessionId || null

    const cwd = options.cwd || process.cwd()
    const env = { ...process.env, ...options.env } as Record<string, string>

    const args = [
      '--output-format',
      'stream-json',
      '--verbose',
      '--input-format',
      'stream-json',
      '--include-partial-messages',
      '--include-hook-events'
    ]

    if (options.resumeSessionId) {
      args.push('--resume', options.resumeSessionId)
    }

    console.log('[Claude] 启动参数:', args.join(' '))
    console.log('[Claude] 工作目录:', cwd)

    this.process = spawn(options.claudePath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd,
      env,
      windowsHide: true
    })

    this._running = true

    const rl = createInterface({ input: this.process.stdout! })
    rl.on('line', (line) => {
      if (!line.trim()) return
      try {
        const msg = JSON.parse(line)
        this.emit('message', msg)
      } catch {
        console.warn('[Claude] 非 JSON 标准输出:', line.slice(0, 200))
      }
    })

    this.process.stderr?.on('data', (data: Buffer) => {
      const text = data.toString().trim()
      if (text) {
        this.emit('stderr', text)
        console.warn('[Claude] 标准错误:', text.slice(0, 500))
      }
    })

    this.process.on('exit', (code) => {
      this._running = false
      this.process = null
      this.emit('exit', code)
    })

    this.process.on('error', (err) => {
      this._running = false
      this.emit('error', err)
    })

    this.process.stdin?.on('error', () => {
      // stdin closed, ignore
    })

    // 发送 initialize 控制请求，激活 CLI 的 SDK 模式
    // VSCode 扩展在 Query 构造时发送此消息，CLI 收到后才会处理 control_request（包括 interrupt）
    this._sendInitialize()
  }

  /** 发送 initialize 控制请求，激活 CLI SDK 模式 */
  private _sendInitialize(): void {
    const requestId = Math.random().toString(36).substring(2, 15)
    const initMessage = {
      request_id: requestId,
      type: 'control_request',
      request: {
        subtype: 'initialize',
        hooks: null,
        sdkMcpServers: null,
        systemPrompt: null,
        allowedTools: null,
        disallowedTools: null
      }
    }
    console.log('[Claude] 发送 initialize 控制请求 — requestId:', requestId)
    this.send(initMessage)
  }

  send(msg: unknown): void {
    if (!this.process?.stdin || this.process.stdin.destroyed) return
    try {
      this.process.stdin.write(JSON.stringify(msg) + '\n')
    } catch {
      // stream closed
    }
  }

  sendUserMessage(text: string): void {
    this.send({
      type: 'user',
      session_id: '',
      message: {
        role: 'user',
        content: [{ type: 'text', text }]
      },
      parent_tool_use_id: null
    })
  }

  stop(): void {
    // D-11: 停止进程时同时停止心跳检测
    this.stopHealthCheck()
    if (this.process) {
      try {
        this.process.stdin?.end()
      } catch {
        // ignore
      }
      this.process.kill()
      this.process = null
      this._running = false
    }
  }

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
}
