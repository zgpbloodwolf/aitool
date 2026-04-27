import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createRequire } from 'node:module'

import { z } from 'zod'

const electronRequire = createRequire(import.meta.url)

const StoredWeChatAccountSchema = z.object({
  token: z.string().min(1),
  baseUrl: z.string().min(1),
  userId: z.string().optional(),
  displayName: z.string().optional()
})

export type StoredWeChatAccount = z.infer<typeof StoredWeChatAccountSchema>

let accountsDirOverride: string | null = null

function resolveUserDataDir(): string {
  const electronModule = electronRequire('electron') as unknown
  if (
    electronModule &&
    typeof electronModule === 'object' &&
    'app' in electronModule &&
    electronModule.app &&
    typeof (electronModule.app as { getPath?: unknown }).getPath === 'function'
  ) {
    return (electronModule.app as { getPath: (name: string) => string }).getPath('userData')
  }

  throw new Error('Electron app userData path is unavailable outside the Electron runtime')
}

function resolveAccountsDir(): string {
  return accountsDirOverride ?? join(resolveUserDataDir(), 'wechat', 'accounts')
}

export function setWeChatAccountsDirForTests(dir: string): void {
  accountsDirOverride = dir
}

export function clearWeChatAccountsDirForTests(): void {
  accountsDirOverride = null
}

export async function saveAccount(accountId: string, account: StoredWeChatAccount): Promise<void> {
  const dir = resolveAccountsDir()
  await mkdir(dir, { recursive: true })
  const stored = StoredWeChatAccountSchema.parse(account)
  await writeFile(join(dir, `${accountId}.json`), JSON.stringify(stored, null, 2), 'utf-8')
}

export async function loadAccount(accountId: string): Promise<StoredWeChatAccount | null> {
  try {
    const raw = await readFile(join(resolveAccountsDir(), `${accountId}.json`), 'utf-8')
    return StoredWeChatAccountSchema.parse(JSON.parse(raw))
  } catch {
    return null
  }
}

export async function listAccountIds(): Promise<string[]> {
  try {
    const entries = await readdir(resolveAccountsDir())
    return entries
      .filter((entry) => entry.endsWith('.json'))
      .map((entry) => entry.replace(/\.json$/, ''))
      .sort()
  } catch {
    return []
  }
}

export async function deleteAccount(accountId: string): Promise<void> {
  await rm(join(resolveAccountsDir(), `${accountId}.json`), { force: true })
}
