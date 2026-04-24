import type { MainThreadAPI } from './index'

type CommandHandler = (...args: unknown[]) => unknown | Promise<unknown>

export class MainThreadCommands implements MainThreadAPI {
  readonly proxyId = 'MainThreadCommands'
  private commands = new Map<string, CommandHandler>()

  async handle(method: string, args: unknown[]): Promise<unknown> {
    switch (method) {
      case '$registerCommand': {
        const [id] = args as [string]
        this.commands.set(id, () => console.log(`[Command] executed: ${id}`))
        return undefined
      }
      case '$executeCommand': {
        const [id, ...commandArgs] = args as [string, ...unknown[]]
        const handler = this.commands.get(id)
        if (handler) return handler(...commandArgs)
        console.log(`[Command] not found: ${id}`)
        return undefined
      }
      case '$unregisterCommand': {
        const [id] = args as [string]
        this.commands.delete(id)
        return undefined
      }
      default:
        console.log(`[Commands] Unhandled: ${method}`)
        return undefined
    }
  }

  registerCommand(id: string, handler: CommandHandler): void {
    this.commands.set(id, handler)
  }
}
