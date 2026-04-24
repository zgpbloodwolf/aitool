import { readdir, readFile, stat } from 'fs/promises'
import { join } from 'path'
import type { ExtensionInfo } from '../shared/types'

export type DiscoveredExtension = ExtensionInfo

const TARGET_EXTENSIONS = new Set([
  'anthropic.claude-code',
  'saoudrizwan.claude-dev',
  'openai.codex'
])

async function findVSCodeExtensionsDir(): Promise<string> {
  const homeDir = process.env.USERPROFILE || process.env.HOME || ''
  const candidates = [
    join(homeDir, '.vscode', 'extensions'),
    join(homeDir, '.vscode-insiders', 'extensions')
  ]

  for (const dir of candidates) {
    try {
      await stat(dir)
      return dir
    } catch {
      continue
    }
  }
  return ''
}

export async function discoverExtensions(): Promise<DiscoveredExtension[]> {
  const extensionsDir = await findVSCodeExtensionsDir()
  if (!extensionsDir) return []

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
    return []
  }

  return Array.from(byId.values())
}
