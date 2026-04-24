import type { MainThreadAPI } from './index'
import { readdir } from 'fs/promises'
import { join } from 'path'

export class MainThreadWorkspace implements MainThreadAPI {
  readonly proxyId = 'MainThreadWorkspace'

  async handle(method: string, args: unknown[]): Promise<unknown> {
    switch (method) {
      case '$startFileSearch':
        return this.startFileSearch(args[0] as { query: string; folder: string })
      case '$saveAll':
        return true
      case '$applyWorkspaceEdit':
        return this.applyWorkspaceEdit(args[0])
      default:
        console.log(`[Workspace] Unhandled: ${method}`)
        return undefined
    }
  }

  private async startFileSearch(params: { query: string; folder: string }): Promise<string[]> {
    const results: string[] = []
    await this.walkDir(params.folder, params.query, results)
    return results.slice(0, 100)
  }

  private async walkDir(dir: string, query: string, results: string[]): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          await this.walkDir(fullPath, query, results)
        } else if (entry.name.includes(query)) {
          results.push(fullPath)
        }
      }
    } catch {
      /* ignore permission errors */
    }
  }

  private async applyWorkspaceEdit(_edit: unknown): Promise<boolean> {
    console.log('[Workspace] applyWorkspaceEdit stub')
    return true
  }
}
