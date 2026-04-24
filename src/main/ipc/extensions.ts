import { ipcMain } from 'electron'
import { discoverExtensions, type DiscoveredExtension } from '../extension-discovery'

let cachedExtensions: DiscoveredExtension[] | null = null

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
    // Extension activation is handled by the claude-webview module
  })
}
