import { readFile, stat, readdir, open, unlink } from 'fs/promises'
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
  let encoded = cwd.replace(/[^a-zA-Z0-9]/g, '-')
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

async function readFileHeadAndTail(filePath: string): Promise<{ head: string; tail: string; mtime: number; size: number }> {
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
    } catch { /* skip malformed */ }
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
        const summary = extractFirstUserPrompt(head) || extractStringValue(tail, 'customTitle') || extractStringValue(fullText, 'aiTitle')
        const gitBranch = extractStringValue(fullText, 'gitBranch')
        sessions.push({ id: sessionId, lastModified: mtime, fileSize: size, summary, gitBranch })
      } catch { /* skip */ }
    }
  } catch { /* skip */ }

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
      } catch { /* skip malformed */ }
    }
  } catch {
    safeError('[SessionStore] 读取会话文件失败:', filePath)
  }

  safeLog('[SessionStore] 已加载会话:', sessionId, '消息数:', messages.length)
  return messages
}

export async function deleteSession(sessionId: string, cwd: string): Promise<boolean> {
  const sessionDir = getProjectSessionDir(cwd)
  if (!sessionDir) return false

  const filePath = join(sessionDir, `${sessionId}.jsonl`)
  if (!existsSync(filePath)) return false

  await unlink(filePath)
  safeLog('[SessionStore] 已删除会话:', sessionId)
  return true
}
