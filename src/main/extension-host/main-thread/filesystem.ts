import type { MainThreadAPI } from './index'
import { readFile, writeFile, stat, readdir, mkdir, unlink, rename } from 'fs/promises'

export class MainThreadFileSystem implements MainThreadAPI {
  readonly proxyId = 'MainThreadFileSystem'

  async handle(method: string, args: unknown[]): Promise<unknown> {
    try {
      switch (method) {
        case '$readFile':
          return await readFile(args[0] as string)
        case '$writeFile':
          await writeFile(args[0] as string, args[1] as Buffer | string)
          return undefined
        case '$stat': {
          const s = await stat(args[0] as string)
          return { type: s.isFile() ? 1 : 2, size: s.size, mtime: s.mtimeMs, ctime: s.ctimeMs }
        }
        case '$readdir': {
          const entries = await readdir(args[0] as string, { withFileTypes: true })
          return entries.map((e) => ({ name: e.name, type: e.isDirectory() ? 2 : 1 }))
        }
        case '$mkdir':
          await mkdir(args[0] as string, { recursive: true })
          return undefined
        case '$delete':
          await unlink(args[0] as string)
          return undefined
        case '$rename':
          await rename(args[0] as string, args[1] as string)
          return undefined
        default:
          console.log(`[FileSystem] Unhandled: ${method}`)
          return undefined
      }
    } catch (err) {
      console.error(`[FileSystem] Error in ${method}:`, err)
      throw err
    }
  }
}
