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

  get running(): boolean {
    return this._running
  }

  start(options: ClaudeProcessOptions): void {
    if (this.process) {
      this.stop()
    }

    const cwd = options.cwd || process.cwd()
    const env = { ...process.env, ...options.env } as Record<string, string>

    const args = [
      '--output-format', 'stream-json',
      '--verbose',
      '--input-format', 'stream-json',
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

  interrupt(): void {
    if (this.process && this._running) {
      // Windows: kill with SIGINT triggers CTRL_BREAK which claude.exe handles as interrupt
      try {
        process.kill(this.process.pid!, 'SIGINT')
      } catch {
        this.process.kill()
      }
    }
  }
}
