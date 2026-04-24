import { appendFileSync, statSync, renameSync, existsSync } from 'fs'
import { join } from 'path'

const MAX_LOG_SIZE = 10 * 1024 * 1024 // 10MB

const logPath = join(process.env.USERPROFILE || process.env.HOME || '/tmp', '.claude', 'aitools-dev.log')

function rotateIfNeeded(): void {
  try {
    if (!existsSync(logPath)) return
    const size = statSync(logPath).size
    if (size > MAX_LOG_SIZE) {
      renameSync(logPath, logPath + '.old')
    }
  } catch { /* ignore */ }
}

export function safeLog(...args: unknown[]): void {
  try {
    rotateIfNeeded()
    const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')
    appendFileSync(logPath, `[INFO] ${msg}\n`)
  } catch { /* ignore */ }
}

export function safeError(...args: unknown[]): void {
  try {
    rotateIfNeeded()
    const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')
    appendFileSync(logPath, `[ERROR] ${msg}\n`)
  } catch { /* ignore */ }
}
