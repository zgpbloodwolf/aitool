import { ChildProcess, fork } from 'child_process'
import { join } from 'path'
import { app } from 'electron'
import { encodeMessage, decodeMessage, ProtocolMessageType } from './protocol'

export interface ExtensionHostConfig {
  extensionPaths: string[]
  workspacePath: string
  extensionHostPath?: string
}

export class ExtensionHostManager {
  private process: ChildProcess | null = null
  private messageBuffer = Buffer.alloc(0)
  private messageId = 0
  private messageHandlers = new Map<string, (method: string, args: unknown[]) => Promise<unknown>>()

  async start(config: ExtensionHostConfig): Promise<void> {
    const hostPath = config.extensionHostPath || this.getDefaultHostPath()

    this.process = fork(hostPath, [], {
      env: {
        ...process.env,
        VSCODE_EXTHOST_IPC_HOOK: '',
        ELECTRON_RUN_AS_NODE: '1'
      },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    })

    this.process.stdout?.on('data', (data: Buffer) => this.handleData(data))
    this.process.stderr?.on('data', (data: Buffer) => {
      console.error('[扩展宿主]', data.toString())
    })

    this.process.on('exit', (code) => {
      console.log(`[扩展宿主] 已退出，退出码 ${code}`)
      this.process = null
    })

    await this.sendInitData(config)
  }

  private getDefaultHostPath(): string {
    if (app.isPackaged) {
      return join(process.resourcesPath, 'extension-host', 'bootstrap.js')
    }
    return join(process.cwd(), 'extension-host', 'bootstrap.js')
  }

  private async sendInitData(config: ExtensionHostConfig): Promise<void> {
    const initData = {
      extensions: config.extensionPaths.map((p) => ({ extensionLocation: { path: p } })),
      workspace: { workspaceFolders: [{ uri: { path: config.workspacePath } }] }
    }
    const data = Buffer.from(JSON.stringify(initData))
    const message = encodeMessage(ProtocolMessageType.Regular, ++this.messageId, 0, data)
    this.process?.stdin?.write(message)
  }

  private handleData(data: Buffer): void {
    this.messageBuffer = Buffer.concat([this.messageBuffer, data])

    while (this.messageBuffer.length > 0) {
      const message = decodeMessage(this.messageBuffer)
      if (!message) break

      this.messageBuffer = this.messageBuffer.subarray(13 + message.data.length)
      this.processMessage(message)
    }
  }

  private async processMessage(message: {
    type: ProtocolMessageType
    id: number
    ack: number
    data: Buffer
  }): Promise<void> {
    if (message.type === ProtocolMessageType.Regular) {
      try {
        const rpc = JSON.parse(message.data.toString())
        const handlerId = rpc.proxyId || 'default'
        const handler = this.messageHandlers.get(handlerId)
        if (handler) {
          const result = await handler(rpc.method, rpc.args)
          const reply = encodeMessage(
            ProtocolMessageType.Regular,
            ++this.messageId,
            message.id,
            Buffer.from(JSON.stringify({ type: 9, id: message.id, data: result }))
          )
          this.process?.stdin?.write(reply)
        }
      } catch (err) {
        console.error('[扩展宿主] 处理消息时出错:', err)
      }
    }
  }

  registerHandler(
    proxyId: string,
    handler: (method: string, args: unknown[]) => Promise<unknown>
  ): void {
    this.messageHandlers.set(proxyId, handler)
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill()
      this.process = null
    }
  }
}
