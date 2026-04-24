import { join } from 'path'
import { existsSync } from 'fs'
import { discoverExtensions } from '../extension-discovery'

let cachedPath: string | null | undefined

export async function resolveClaudeBinary(): Promise<string | null> {
  if (cachedPath !== undefined) return cachedPath

  const extensions = await discoverExtensions()
  const claudeExt = extensions.find((e) => e.id === 'anthropic.claude-code')

  if (!claudeExt) {
    cachedPath = null
    return null
  }

  const binaryPath = join(claudeExt.extensionPath, 'resources', 'native-binary', 'claude.exe')

  if (!existsSync(binaryPath)) {
    cachedPath = null
    return null
  }

  cachedPath = binaryPath
  return binaryPath
}
