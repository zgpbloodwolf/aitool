import { readdir, readFile, stat } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import type { ExtensionInfo } from '../shared/types'

export type DiscoveredExtension = ExtensionInfo

const TARGET_EXTENSIONS = new Set([
  'anthropic.claude-code',
  'saoudrizwan.claude-dev',
  'openai.codex'
])

// 搜索候选目录：项目内置 extensions/ + VS Code 扩展目录
async function getSearchDirs(): Promise<string[]> {
  const dirs: string[] = []

  // 1. 项目内置 extensions/ 目录（打包后从 resources 目录找，开发时从项目根目录找）
  const appPath = app.isPackaged ? process.resourcesPath : app.getAppPath()
  const bundledDir = join(appPath, 'extensions')
  try {
    await stat(bundledDir)
    dirs.push(bundledDir)
  } catch {
    // 目录不存在，跳过
  }

  // 2. VS Code 扩展目录
  const homeDir = process.env.USERPROFILE || process.env.HOME || ''
  const vscodeDirs = [
    join(homeDir, '.vscode', 'extensions'),
    join(homeDir, '.vscode-insiders', 'extensions')
  ]
  for (const dir of vscodeDirs) {
    try {
      await stat(dir)
      dirs.push(dir)
    } catch {
      continue
    }
  }

  return dirs
}

export async function discoverExtensions(): Promise<DiscoveredExtension[]> {
  const searchDirs = await getSearchDirs()
  if (searchDirs.length === 0) return []

  const byId = new Map<string, DiscoveredExtension>()

  for (const extensionsDir of searchDirs) {
    try {
      const entries = await readdir(extensionsDir, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory()) continue

        const packageJsonPath = join(extensionsDir, entry.name, 'package.json')
        try {
          const content = await readFile(packageJsonPath, 'utf-8')
          const pkg = JSON.parse(content)
          const extId = `${pkg.publisher}.${pkg.name}`.toLowerCase()

          if (TARGET_EXTENSIONS.has(extId)) {
            const ext: DiscoveredExtension = {
              id: extId,
              name: pkg.displayName || pkg.name,
              version: pkg.version,
              description: pkg.description || '',
              publisher: pkg.publisher || '',
              extensionPath: join(extensionsDir, entry.name),
              iconPath: pkg.icon ? join(extensionsDir, entry.name, pkg.icon) : undefined
            }

            const existing = byId.get(extId)
            if (!existing || ext.version.localeCompare(existing.version, undefined, { numeric: true }) > 0) {
              byId.set(extId, ext)
            }
          }
        } catch {
          continue
        }
      }
    } catch {
      continue
    }
  }

  return Array.from(byId.values())
}
