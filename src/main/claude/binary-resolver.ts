import { join } from 'path'
import { existsSync } from 'fs'
import { discoverExtensions } from '../extension-discovery'

let cachedPath: string | null | undefined

function getClaudeBinaryName(): string {
  return process.platform === 'win32' ? 'claude.exe' : 'claude'
}

export async function resolveClaudeBinary(): Promise<string | null> {
  if (cachedPath !== undefined) return cachedPath

  const extensions = await discoverExtensions()
  const claudeExt = extensions.find((e) => e.id === 'anthropic.claude-code')

  if (!claudeExt) {
    cachedPath = null
    return null
  }

  const binaryName = getClaudeBinaryName()
  const binaryPath = join(claudeExt.extensionPath, 'resources', 'native-binary', binaryName)

  if (!existsSync(binaryPath)) {
    // Fallback: try without platform-specific name (some distributions use different paths)
    const fallbackPath = join(claudeExt.extensionPath, 'resources', 'native-binary', 'claude')
    if (!existsSync(fallbackPath)) {
      cachedPath = null
      return null
    }
    cachedPath = fallbackPath
    return fallbackPath
  }

  cachedPath = binaryPath
  return binaryPath
}
