import { readdir, readFile, stat } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import type { ExtensionInfo } from '../shared/types'
import { setupExtension } from './claude/extension-setup'

export type DiscoveredExtension = ExtensionInfo

const TARGET_EXTENSIONS = new Set([
  'anthropic.claude-code',
  'saoudrizwan.claude-dev',
  'openai.codex'
])

// 只搜索项目内置 extensions/ 目录
function getExtensionsDir(): string {
  if (app.isPackaged) {
    return join(app.getPath('userData'), 'extensions')
  }
  return join(app.getAppPath(), 'extensions')
}

export async function discoverExtensions(): Promise<DiscoveredExtension[]> {
  const extensionsDir = getExtensionsDir()

  // 先尝试发现已有扩展
  let extensions = await scanDir(extensionsDir)

  // 没找到 claude-code 扩展 → 自动从内置 vsix 解压
  if (!extensions.some(e => e.id === 'anthropic.claude-code')) {
    console.log('[ExtensionDiscovery] 未找到 claude-code 扩展，尝试自动安装...')
    const result = await setupExtension()
    if (result) {
      extensions = await scanDir(extensionsDir)
    }
  }

  return extensions
}

async function scanDir(extensionsDir: string): Promise<DiscoveredExtension[]> {
  try {
    await stat(extensionsDir)
  } catch {
    return []
  }

  const byId = new Map<string, DiscoveredExtension>()

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
    // ignore
  }

  return Array.from(byId.values())
}
