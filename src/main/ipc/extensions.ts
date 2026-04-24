import { ipcMain } from 'electron'
import { discoverExtensions, type DiscoveredExtension } from '../extension-discovery'
import { ExtensionHostManager } from '../extension-host/host-manager'
import { registerAllAPIs } from '../extension-host/main-thread'

let cachedExtensions: DiscoveredExtension[] | null = null
let hostManager: ExtensionHostManager | null = null

export function registerExtensionHandlers(): void {
  ipcMain.handle('ext:getInstalled', async () => {
    if (!cachedExtensions) {
      cachedExtensions = await discoverExtensions()
    }
    return cachedExtensions
  })

  ipcMain.handle('ext:activate', async (_event, extensionId: string) => {
    if (!cachedExtensions || cachedExtensions.length === 0) {
      cachedExtensions = await discoverExtensions()
    }

    const ext = cachedExtensions?.find((e) => e.id === extensionId)
    if (!ext) throw new Error(`未找到扩展: ${extensionId}`)

    if (!hostManager) {
      hostManager = new ExtensionHostManager()
      registerAllAPIs(hostManager)
    }

    await hostManager.start({
      extensionPaths: [ext.extensionPath],
      workspacePath: process.cwd()
    })
  })
}

export async function shutdownExtensionHost(): Promise<void> {
  if (hostManager) {
    await hostManager.stop()
    hostManager = null
  }
}
