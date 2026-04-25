// Claude Code 扩展自动下载器 — 从 Open VSX 下载到本地 extensions/ 目录
import { createWriteStream, mkdirSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import { createReadStream } from 'fs'
import { createUnzip } from 'zlib'
import { basename } from 'path'

// Open VSX API
const OPEN_VSX_API = 'https://open-vsx.org/api'
const EXTENSION_NAMESPACE = 'Anthropic'
const EXTENSION_NAME = 'claude-code'

function getTargetPlatform(): string {
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  const platform = process.platform === 'darwin' ? 'darwin' : process.platform === 'linux' ? 'linux' : 'win32'
  return `${platform}-${arch}`
}

function getExtensionsDir(): string {
  const appPath = app.isPackaged ? process.resourcesPath : app.getAppPath()
  return join(appPath, 'extensions')
}

// 检查本地是否已有 claude-code 扩展
export function findLocalExtension(): string | null {
  const extDir = getExtensionsDir()
  if (!existsSync(extDir)) return null

  try {
    const entries = readdirSync(extDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.toLowerCase().startsWith('anthropic.claude-code')) {
        return join(extDir, entry.name)
      }
    }
  } catch { /* ignore */ }
  return null
}

// 从 Open VSX 获取最新版本信息
async function getLatestVersion(): Promise<{ version: string; downloadUrl: string } | null> {
  const target = getTargetPlatform()
  const url = `${OPEN_VSX_API}/${EXTENSION_NAMESPACE}/${EXTENSION_NAME}/${target}/latest`

  const resp = await fetch(url)
  if (!resp.ok) {
    // fallback: 不带 target 查询
    const fallbackUrl = `${OPEN_VSX_API}/${EXTENSION_NAMESPACE}/${EXTENSION_NAME}`
    const fallbackResp = await fetch(fallbackUrl)
    if (!fallbackResp.ok) return null
    const data = await fallbackResp.json() as { version: string; files: { download?: string } }
    if (!data.version || !data.files?.download) return null
    return { version: data.version, downloadUrl: data.files.download }
  }

  const data = await resp.json() as { version: string; files: { download?: string } }
  if (!data.version || !data.files?.download) return null
  return { version: data.version, downloadUrl: data.files.download }
}

// 下载 vsix 并解压到 extensions/ 目录
export async function downloadExtension(
  onProgress?: (msg: string) => void
): Promise<string | null> {
  onProgress?.('正在查询最新版本...')
  const latest = await getLatestVersion()
  if (!latest) {
    onProgress?.('无法获取扩展版本信息')
    return null
  }

  const { version, downloadUrl } = latest
  const extDir = getExtensionsDir()
  const targetDir = join(extDir, `${EXTENSION_NAMESPACE.toLowerCase()}.${EXTENSION_NAME}-${version}`)

  // 已存在则跳过下载
  if (existsSync(join(targetDir, 'package.json'))) {
    onProgress?.(`扩展已存在: v${version}`)
    return targetDir
  }

  onProgress?.(`正在下载 Claude Code v${version}...`)
  mkdirSync(extDir, { recursive: true })

  // 下载 vsix (zip 格式)
  const vsixPath = join(extDir, `claude-code-${version}.vsix`)
  try {
    const resp = await fetch(downloadUrl)
    if (!resp.ok) {
      onProgress?.(`下载失败: HTTP ${resp.status}`)
      return null
    }

    const fileStream = createWriteStream(vsixPath)
    const nodeStream = Readable.fromWeb(resp.body as import('stream/web').ReadableStream)
    await pipeline(nodeStream, fileStream)

    onProgress?.('正在解压...')
    mkdirSync(targetDir, { recursive: true })

    // vsix 是 zip 文件，使用 Node.js 内置解压不了，用 tar 或者让用户安装 adm-zip
    // 实际上 vsix 就是 zip，但 Node.js 没有 zip 解压能力
    // 用 PowerShell 解压（Windows）
    const { execSync } = await import('child_process')
    const psCommand = `Expand-Archive -Path "${vsixPath}" -DestinationPath "${targetDir}" -Force`
    execSync(`powershell -Command "${psCommand}"`, { timeout: 120000 })

    // vsix 解压后内容在 extension/ 子目录，移到根目录
    const extensionSubDir = join(targetDir, 'extension')
    if (existsSync(extensionSubDir)) {
      const { renameSync, readdirSync } = await import('fs')
      const items = readdirSync(extensionSubDir)
      for (const item of items) {
        renameSync(join(extensionSubDir, item), join(targetDir, item))
      }
      // 删除空的 extension 目录
      const { rmdirSync } = await import('fs')
      try { rmdirSync(extensionSubDir) } catch { /* ignore */ }
    }

    // 清理 vsix 文件
    const { unlinkSync } = await import('fs')
    try { unlinkSync(vsixPath) } catch { /* ignore */ }

    onProgress?.(`Claude Code v${version} 安装完成`)
    return targetDir
  } catch (e) {
    onProgress?.(`下载失败: ${String(e)}`)
    return null
  }
}
