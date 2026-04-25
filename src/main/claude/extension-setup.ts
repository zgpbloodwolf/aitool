// Claude Code 扩展安装 — 从项目内置 vsix 解压到 extensions/ 目录
import { createReadStream, existsSync, mkdirSync, readdirSync, renameSync, rmdirSync, unlinkSync } from 'fs'
import { join, basename } from 'path'
import { app } from 'electron'
import { safeLog } from './logger'

function getExtensionsDir(): string {
  const appPath = app.isPackaged ? process.resourcesPath : app.getAppPath()
  return join(appPath, 'extensions')
}

function getResourcesDir(): string {
  const appPath = app.isPackaged ? process.resourcesPath : app.getAppPath()
  return join(appPath, 'resources')
}

// 查找本地 vsix 文件
function findLocalVsix(): string | null {
  const resDir = getResourcesDir()
  if (!existsSync(resDir)) return null

  try {
    const entries = readdirSync(resDir)
    // 匹配 anthropic.claude-code 相关的 vsix 文件
    for (const entry of entries) {
      if (entry.toLowerCase().endsWith('.vsix') && entry.toLowerCase().includes('claude-code')) {
        return join(resDir, entry)
      }
    }
  } catch { /* ignore */ }
  return null
}

// 检查本地是否已有 claude-code 扩展
export function findLocalExtension(): string | null {
  const extDir = getExtensionsDir()
  if (!existsSync(extDir)) return null

  try {
    const entries = readdirSync(extDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.toLowerCase().includes('claude-code')) {
        return join(extDir, entry.name)
      }
    }
  } catch { /* ignore */ }
  return null
}

// 解压 vsix 到 extensions/ 目录
export async function setupExtension(
  onProgress?: (msg: string) => void
): Promise<string | null> {
  // 已存在则跳过
  const existing = findLocalExtension()
  if (existing && existsSync(join(existing, 'package.json'))) {
    onProgress?.('扩展已安装')
    return existing
  }

  const vsixPath = findLocalVsix()
  if (!vsixPath) {
    onProgress?.('未找到内置的 Claude Code 扩展包')
    return null
  }

  const extDir = getExtensionsDir()
  const vsixName = basename(vsixPath, '.vsix')
  const targetDir = join(extDir, vsixName)

  // 已解压过则跳过
  if (existsSync(join(targetDir, 'package.json'))) {
    onProgress?.('扩展已存在')
    return targetDir
  }

  onProgress?.('正在解压 Claude Code 扩展...')
  mkdirSync(extDir, { recursive: true })
  mkdirSync(targetDir, { recursive: true })

  try {
    // 使用 PowerShell 解压 vsix（zip 格式）
    const { execSync } = await import('child_process')
    const psCommand = `Expand-Archive -Path "${vsixPath}" -DestinationPath "${targetDir}" -Force`
    execSync(`powershell -Command "${psCommand}"`, { timeout: 120000 })

    // vsix 解压后内容在 extension/ 子目录，移到根目录
    const extensionSubDir = join(targetDir, 'extension')
    if (existsSync(extensionSubDir)) {
      const items = readdirSync(extensionSubDir)
      for (const item of items) {
        renameSync(join(extensionSubDir, item), join(targetDir, item))
      }
      try { rmdirSync(extensionSubDir) } catch { /* ignore */ }
    }

    onProgress?.('Claude Code 扩展安装完成')
    safeLog('[ExtensionSetup] 扩展解压完成:', targetDir)
    return targetDir
  } catch (e) {
    onProgress?.(`解压失败: ${String(e)}`)
    safeLog('[ExtensionSetup] 解压失败:', e)
    return null
  }
}
