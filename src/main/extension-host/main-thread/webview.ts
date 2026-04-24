import type { MainThreadAPI } from './index'
import { BrowserWindow } from 'electron'

export class MainThreadWebview implements MainThreadAPI {
  readonly proxyId = 'MainThreadWebview'
  private webviewHtml = new Map<string, string>()

  async handle(method: string, args: unknown[]): Promise<unknown> {
    switch (method) {
      case '$registerWebviewViewProvider': {
        const [viewType] = args as [string]
        console.log(`[Webview] Registered provider: ${viewType}`)
        return undefined
      }
      case '$createWebviewPanel': {
        const [id, viewType, title] = args as [string, string, string]
        console.log(`[Webview] Create panel: ${id} type=${viewType} title=${title}`)
        return undefined
      }
      case '$setHtml': {
        const [id, html] = args as [string, string]
        this.webviewHtml.set(id, html)
        this.renderWebview(id)
        return undefined
      }
      case '$postMessage': {
        const [id, message] = args as [string, unknown]
        console.log(`[Webview] Post message to ${id}:`, JSON.stringify(message).slice(0, 100))
        return undefined
      }
      default:
        console.log(`[Webview] Unhandled: ${method}`)
        return undefined
    }
  }

  private renderWebview(id: string): void {
    const html = this.webviewHtml.get(id)
    if (!html) return

    const window = BrowserWindow.getAllWindows()[0]
    if (!window) return

    window.webContents.send('ext:webviewHtml', { id, html })
  }
}
