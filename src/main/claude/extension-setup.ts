// Claude Code 扩展安装 — 从项目内置 vsix 解压到 extensions/ 目录
import { existsSync, mkdirSync, readdirSync, renameSync, rmdirSync, unlinkSync, copyFileSync } from 'fs'
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
    const msg = '未找到内置的 Claude Code 扩展包'
    safeLog('[ExtensionSetup] ' + msg + '，搜索目录: ' + getResourcesDir())
    onProgress?.(msg)
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
    // PowerShell Expand-Archive 只支持 .zip 扩展名，先复制为 .zip
    const { tmpdir } = await import('os')
    const zipPath = join(tmpdir(), `claude-code-setup-${Date.now()}.zip`)
    copyFileSync(vsixPath, zipPath)

    const { execSync } = await import('child_process')
    const psCommand = `Expand-Archive -Path "${zipPath}" -DestinationPath "${targetDir}" -Force`
    execSync(`powershell -Command "${psCommand}"`, { timeout: 120000 })

    // 清理临时 zip
    try { unlinkSync(zipPath) } catch { /* ignore */ }

    // 解压后提升目录结构：如果顶层只有一个子目录（如 extension/ 或同名目录），提到上层
    const items = readdirSync(targetDir)
    if (items.length === 1) {
      const subDir = join(targetDir, items[0])
      const subStat = await import('fs').then(fs => fs.statSync(subDir))
      if (subStat.isDirectory()) {
        const subItems = readdirSync(subDir)
        for (const item of subItems) {
          renameSync(join(subDir, item), join(targetDir, item))
        }
        try { rmdirSync(subDir) } catch { /* ignore */ }
      }
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
