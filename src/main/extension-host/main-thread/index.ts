import type { ExtensionHostManager } from '../host-manager'
import { MainThreadWorkspace } from './workspace'
import { MainThreadCommands } from './commands'
import { MainThreadFileSystem } from './filesystem'
import { MainThreadWebview } from './webview'

export interface MainThreadAPI {
  proxyId: string
  handle(method: string, args: unknown[]): Promise<unknown>
}

export function registerAllAPIs(hostManager: ExtensionHostManager): void {
  const apis: MainThreadAPI[] = [
    new MainThreadWorkspace(),
    new MainThreadCommands(),
    new MainThreadFileSystem(),
    new MainThreadWebview()
  ]

  for (const api of apis) {
    hostManager.registerHandler(api.proxyId, (method, args) => api.handle(method, args))
  }
}
