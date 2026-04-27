import { readFile, stat, readdir, open, unlink, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { safeLog, safeError } from './logger'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const JSONL_CHUNK = 65536

export interface SessionInfo {
  id: string
  lastModified: number
  fileSize: number
  summary: string | undefined
  gitBranch: string | undefined
}

export function encodeProjectPath(cwd: string): string {
  const encoded = cwd.replace(/[^a-zA-Z0-9]/g, '-')
  if (encoded.length <= 200) return encoded
  const hash = Math.abs(
    Array.from(cwd).reduce((acc, ch) => ((acc << 5) - acc + ch.charCodeAt(0)) | 0, 0)
  ).toString(36)
  return `${encoded.slice(0, 200)}-${hash}`
}

export function getProjectSessionDir(cwd: string): string | null {
  const homeDir = process.env.USERPROFILE || process.env.HOME || ''
  const claudeDir = join(homeDir, '.claude', 'projects')
  const encoded = encodeProjectPath(cwd)
  const dir = join(claudeDir, encoded)
  if (existsSync(dir)) return dir
  if (/^[A-Z]:/.test(cwd)) {
    const lower = encodeProjectPath(cwd[0].toLowerCase() + cwd.slice(1))
    const dirLower = join(claudeDir, lower)
    if (existsSync(dirLower)) return dirLower
  }
  return null
}

async function readFileHeadAndTail(
  filePath: string
): Promise<{ head: string; tail: string; mtime: number; size: number }> {
  const s = await stat(filePath)
  const fd = await open(filePath, 'r')
  try {
    const headBuf = Buffer.alloc(JSONL_CHUNK)
    const { bytesRead: headBytes } = await fd.read(headBuf, 0, JSONL_CHUNK, 0)
    const head = headBuf.toString('utf8', 0, headBytes)
    let tail = ''
    if (s.size > JSONL_CHUNK) {
      const tailBuf = Buffer.alloc(JSONL_CHUNK)
      const { bytesRead: tailBytes } = await fd.read(tailBuf, 0, JSONL_CHUNK, s.size - JSONL_CHUNK)
      tail = tailBuf.toString('utf8', 0, tailBytes)
    }
    return { head, tail, mtime: s.mtimeMs, size: s.size }
  } finally {
    await fd.close()
  }
}

function extractFirstUserPrompt(text: string): string | undefined {
  const lines = text.split('\n')
  for (const line of lines) {
    if (!line.includes('"type":"user"') && !line.includes('"type": "user"')) continue
    try {
      const obj = JSON.parse(line)
      if (obj.isSidechain || obj.isMeta || obj.isCompactSummary) continue
      const content = obj.message?.content
      if (!Array.isArray(content)) continue
      for (const block of content) {
        if (block.type === 'text' && typeof block.text === 'string' && block.text.trim()) {
          return block.text.length > 200 ? block.text.slice(0, 200) + '...' : block.text
        }
      }
    } catch {
      /* skip malformed */
    }
  }
  return undefined
}

function extractStringValue(text: string, key: string): string | undefined {
  const marker = `"${key}":"`
  const idx = text.indexOf(marker)
  if (idx === -1) return undefined
  const start = idx + marker.length
  const end = text.indexOf('"', start)
  if (end === -1) return undefined
  return text.slice(start, end)
}

export async function listSessions(cwd: string): Promise<SessionInfo[]> {
  const sessionDir = getProjectSessionDir(cwd)
  if (!sessionDir) return []

  const sessions: SessionInfo[] = []
  try {
    const entries = await readdir(sessionDir)
    for (const entry of entries) {
      if (!entry.endsWith('.jsonl') || entry.startsWith('agent-')) continue
      const sessionId = entry.replace('.jsonl', '')
      if (!UUID_RE.test(sessionId)) continue

      const filePath = join(sessionDir, entry)
      try {
        const { head, tail, mtime, size } = await readFileHeadAndTail(filePath)
        const fullText = head + '\n' + tail
        const summary =
          extractFirstUserPrompt(head) ||
          extractStringValue(tail, 'customTitle') ||
          extractStringValue(fullText, 'aiTitle')
        const gitBranch = extractStringValue(fullText, 'gitBranch')
        sessions.push({ id: sessionId, lastModified: mtime, fileSize: size, summary, gitBranch })
      } catch {
        /* skip */
      }
    }
  } catch {
    /* skip */
  }

  sessions.sort((a, b) => b.lastModified - a.lastModified)
  safeLog('[SessionStore] 已列出会话:', sessions.length)
  return sessions
}

export async function getSessionMessages(sessionId: string, cwd: string): Promise<unknown[]> {
  const sessionDir = getProjectSessionDir(cwd)
  if (!sessionDir) return []

  const filePath = join(sessionDir, `${sessionId}.jsonl`)
  if (!existsSync(filePath)) return []

  const messages: unknown[] = []
  try {
    const content = await readFile(filePath, 'utf8')
    for (const line of content.split('\n')) {
      if (!line.trim()) continue
      try {
        const obj = JSON.parse(line)
        if (obj.isSidechain || obj.isMeta) continue
        if (obj.type === 'user' || obj.type === 'assistant' || obj.type === 'system') {
          messages.push(obj)
        }
      } catch {
        /* skip malformed */
      }
    }
  } catch {
    safeError('[SessionStore] 读取会话文件失败:', filePath)
  }

  safeLog('[SessionStore] 已加载会话:', sessionId, '消息数:', messages.length)
  return messages
}

export async function deleteSession(sessionId: string, cwd: string): Promise<boolean> {
  // 验证 sessionId 为 UUID 格式，防止路径遍历攻击 (per D-21)
  if (!UUID_RE.test(sessionId)) {
    safeError('[SessionStore] 无效的 sessionId 格式:', sessionId)
    return false
  }

  const sessionDir = getProjectSessionDir(cwd)
  if (!sessionDir) return false

  const filePath = join(sessionDir, `${sessionId}.jsonl`)
  if (!existsSync(filePath)) return false

  await unlink(filePath)
  safeLog('[SessionStore] 已删除会话:', sessionId)
  return true
}

/**
 * 将消息数组格式化为 Markdown 文本 (UX-07)
 *
 * D-01: 过滤 system 消息和工具调用细节，仅保留 user + assistant
 * D-02: 文件头包含标题和导出日期
 * D-03: 保留原始 Markdown 代码块，不做额外处理
 *
 * @param messages - JSONL 消息数组
 * @param title - 会话标题
 * @param date - 导出日期（YYYY-MM-DD 格式）
 * @returns 格式化后的 Markdown 字符串
 */
export function formatMessagesAsMarkdown(
  messages: unknown[],
  title: string,
  date: string
): string {
  const lines: string[] = []
  // D-02: 文件头
  lines.push(`# ${title}`)
  lines.push(`> 导出于 ${date}`)
  lines.push('')

  for (const msg of messages) {
    const obj = msg as Record<string, unknown>
    // D-01: 过滤 system 消息
    if (obj.type === 'system') continue
    if (obj.isSidechain || obj.isMeta) continue

    const content = (obj.message as Record<string, unknown>)?.content
    if (!Array.isArray(content)) continue

    if (obj.type === 'user') {
      lines.push('## 用户')
      lines.push('')
      for (const block of content) {
        const b = block as Record<string, unknown>
        // D-01: 只保留 text block
        if (b.type === 'text' && typeof b.text === 'string' && b.text) {
          lines.push(b.text)
        }
      }
      lines.push('')
    } else if (obj.type === 'assistant') {
      lines.push('## 助手')
      lines.push('')
      for (const block of content) {
        const b = block as Record<string, unknown>
        // D-01: 过滤 tool_use 和 thinking，只保留 text
        if (b.type === 'text' && typeof b.text === 'string' && b.text) {
          // D-03: 保留原始 Markdown 代码块
          lines.push(b.text)
        }
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}

/**
 * 将会话导出为 Markdown 文件 (UX-07)
 *
 * @param sessionId - 会话 ID（UUID 格式）
 * @param title - 会话标题
 * @param savePath - 保存路径
 * @param cwd - 工作目录
 * @returns 导出结果
 */
export async function exportSessionAsMarkdown(
  sessionId: string,
  title: string,
  savePath: string,
  cwd: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 验证 sessionId 为 UUID 格式，防止路径遍历 (per T-06-02)
    if (!UUID_RE.test(sessionId)) {
      safeError('[SessionStore] 导出失败，无效的 sessionId 格式:', sessionId)
      return { success: false, error: '无效的会话 ID 格式' }
    }

    const messages = await getSessionMessages(sessionId, cwd)
    const date = new Date().toISOString().split('T')[0]
    const markdown = formatMessagesAsMarkdown(messages, title, date)
    await writeFile(savePath, markdown, 'utf8')
    safeLog('[SessionStore] 会话已导出:', sessionId, '路径:', savePath)
    return { success: true }
  } catch (e) {
    safeError('[SessionStore] 导出会话失败:', e)
    return { success: false, error: String(e) }
  }
}
