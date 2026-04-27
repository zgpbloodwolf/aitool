# WeChat Headless AI Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a WeChat channel to `aitool` so users can QR-login WeChat bot accounts, receive private text and image messages, route them into background Claude or Codex sessions, and view account/conversation state in the desktop app.

**Architecture:** Extend the existing Electron main-process runtime with an app-owned WeChat stack: protocol adapter, account store, conversation store, channel manager, headless AI session manager, and renderer-side account/conversation panels. Reuse protocol-heavy logic from `openclaw-weixin` as reference, but keep routing, session, and UI ownership inside `aitool`.

**Tech Stack:** Electron, Vue 3, Pinia, TypeScript, built-in `fetch`, Vitest for new unit tests, existing Claude/Codex desktop integration paths.

---

### Task 1: Add WeChat test scaffolding and core domain types

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `tests/unit/wechat/conversation-store.test.ts`
- Create: `tests/unit/wechat/message-bridge.test.ts`
- Create: `src/main/wechat/types.ts`
- Create: `src/main/wechat/conversation-store.ts`
- Create: `src/main/wechat/message-bridge.ts`

- [ ] **Step 1: Add the test dependency and scripts**

Update `package.json` to add Vitest and a focused test script:

```json
{
  "scripts": {
    "test:wechat": "vitest run tests/unit/wechat"
  },
  "devDependencies": {
    "vitest": "^3.2.4"
  }
}
```

Run:

```bash
pnpm add -D vitest
```

Expected: `package.json` and lockfile update successfully.

- [ ] **Step 2: Add a minimal Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts']
  }
})
```

- [ ] **Step 3: Create app-owned WeChat domain types**

Create `src/main/wechat/types.ts` with the internal contracts used across main process, IPC, and renderer:

```ts
export type EngineType = 'claude' | 'codex'
export type IsolationMode = 'per-contact' | 'shared'

export interface WeChatAccountRecord {
  accountId: string
  userId?: string
  displayName?: string
  baseUrl: string
  enabled: boolean
  connected: boolean
  defaultEngine: EngineType | null
  sessionIsolationMode: IsolationMode
  lastConnectedAt?: number
  lastInboundAt?: number
  lastOutboundAt?: number
  lastError?: string | null
}

export interface WeChatConversationRecord {
  conversationKey: string
  accountId: string
  peerUserId: string
  peerDisplayName?: string
  engine: EngineType
  aiSessionId: string
  processing: boolean
  lastMessagePreview?: string
  lastInboundAt?: number
  lastOutboundAt?: number
  lastError?: string | null
}

export interface CanonicalMessage {
  messageId: string
  accountId: string
  peerUserId: string
  direction: 'inbound' | 'outbound'
  type: 'text' | 'image'
  text?: string
  imagePath?: string
  imageUrl?: string
  contextToken?: string
  timestamp: number
}
```

- [ ] **Step 4: Implement the conversation store**

Create `src/main/wechat/conversation-store.ts`:

```ts
import type {
  CanonicalMessage,
  EngineType,
  IsolationMode,
  WeChatAccountRecord,
  WeChatConversationRecord
} from './types'

function buildConversationKey(accountId: string, peerUserId: string, mode: IsolationMode): string {
  return mode === 'shared' ? `wechat:${accountId}:shared` : `wechat:${accountId}:${peerUserId}`
}

export class WeChatConversationStore {
  private accounts = new Map<string, WeChatAccountRecord>()
  private conversations = new Map<string, WeChatConversationRecord>()

  upsertAccount(account: WeChatAccountRecord): void {
    this.accounts.set(account.accountId, account)
  }

  resolveConversation(params: {
    accountId: string
    peerUserId: string
    aiSessionId: string
    engine: EngineType
    isolationMode: IsolationMode
  }): WeChatConversationRecord {
    const conversationKey = buildConversationKey(params.accountId, params.peerUserId, params.isolationMode)
    const existing = this.conversations.get(conversationKey)
    if (existing) return existing

    const created: WeChatConversationRecord = {
      conversationKey,
      accountId: params.accountId,
      peerUserId: params.peerUserId,
      engine: params.engine,
      aiSessionId: params.aiSessionId,
      processing: false
    }
    this.conversations.set(conversationKey, created)
    return created
  }

  recordMessage(message: CanonicalMessage): void {
    const account = this.accounts.get(message.accountId)
    if (!account) return
    const key = buildConversationKey(message.accountId, message.peerUserId, account.sessionIsolationMode)
    const conversation = this.conversations.get(key)
    if (!conversation) return

    conversation.lastMessagePreview = message.text?.slice(0, 120) ?? '[image]'
    if (message.direction === 'inbound') conversation.lastInboundAt = message.timestamp
    if (message.direction === 'outbound') conversation.lastOutboundAt = message.timestamp
  }

  listAccounts(): WeChatAccountRecord[] {
    return [...this.accounts.values()]
  }

  listConversations(): WeChatConversationRecord[] {
    return [...this.conversations.values()].sort((a, b) => (b.lastInboundAt ?? 0) - (a.lastInboundAt ?? 0))
  }
}
```

- [ ] **Step 5: Implement the message bridge**

Create `src/main/wechat/message-bridge.ts`:

```ts
import type { CanonicalMessage } from './types'

export function inboundTextToCanonical(params: {
  messageId: string
  accountId: string
  peerUserId: string
  text: string
  contextToken?: string
  timestamp: number
}): CanonicalMessage {
  return {
    messageId: params.messageId,
    accountId: params.accountId,
    peerUserId: params.peerUserId,
    direction: 'inbound',
    type: 'text',
    text: params.text,
    contextToken: params.contextToken,
    timestamp: params.timestamp
  }
}

export function inboundImageToCanonical(params: {
  messageId: string
  accountId: string
  peerUserId: string
  imagePath: string
  text?: string
  contextToken?: string
  timestamp: number
}): CanonicalMessage {
  return {
    messageId: params.messageId,
    accountId: params.accountId,
    peerUserId: params.peerUserId,
    direction: 'inbound',
    type: 'image',
    text: params.text,
    imagePath: params.imagePath,
    contextToken: params.contextToken,
    timestamp: params.timestamp
  }
}
```

- [ ] **Step 6: Write the failing unit tests**

Create `tests/unit/wechat/conversation-store.test.ts` and `tests/unit/wechat/message-bridge.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { WeChatConversationStore } from '../../../src/main/wechat/conversation-store'
import { inboundImageToCanonical } from '../../../src/main/wechat/message-bridge'

describe('WeChatConversationStore', () => {
  it('uses per-contact keys by default', () => {
    const store = new WeChatConversationStore()
    store.upsertAccount({
      accountId: 'acc-1',
      baseUrl: 'https://example.com',
      enabled: true,
      connected: true,
      defaultEngine: 'claude',
      sessionIsolationMode: 'per-contact'
    })

    const a = store.resolveConversation({
      accountId: 'acc-1',
      peerUserId: 'u-a',
      aiSessionId: 'sess-a',
      engine: 'claude',
      isolationMode: 'per-contact'
    })
    const b = store.resolveConversation({
      accountId: 'acc-1',
      peerUserId: 'u-b',
      aiSessionId: 'sess-b',
      engine: 'claude',
      isolationMode: 'per-contact'
    })

    expect(a.conversationKey).not.toBe(b.conversationKey)
  })
})

describe('message bridge', () => {
  it('keeps imagePath and contextToken for image inbound messages', () => {
    const message = inboundImageToCanonical({
      messageId: 'm-1',
      accountId: 'acc-1',
      peerUserId: 'u-a',
      imagePath: 'C:/tmp/a.png',
      text: 'look',
      contextToken: 'ctx-1',
      timestamp: 1
    })

    expect(message.type).toBe('image')
    expect(message.imagePath).toBe('C:/tmp/a.png')
    expect(message.contextToken).toBe('ctx-1')
  })
})
```

- [ ] **Step 7: Run tests red then green**

Run:

```bash
pnpm exec vitest run tests/unit/wechat/conversation-store.test.ts tests/unit/wechat/message-bridge.test.ts
```

Expected before implementation: failures for missing modules.

Expected after implementation: both tests pass.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts src/main/wechat/types.ts src/main/wechat/conversation-store.ts src/main/wechat/message-bridge.ts tests/unit/wechat
git commit -m "feat: add wechat core types and conversation domain"
```

---

### Task 2: Implement account storage and adapted WeChat protocol helpers

**Files:**
- Create: `src/main/wechat/account-store.ts`
- Create: `src/main/wechat/protocol-adapter.ts`
- Create: `tests/unit/wechat/account-store.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Add the runtime validation dependency**

Add `zod` because the adapted account-store and protocol layer need lightweight validation:

```bash
pnpm add zod
```

Expected: `zod` appears under `dependencies`.

- [ ] **Step 2: Implement the account store**

Create `src/main/wechat/account-store.ts`:

```ts
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import { z } from 'zod'

const AccountSchema = z.object({
  token: z.string().min(1),
  baseUrl: z.string().min(1),
  userId: z.string().optional(),
  displayName: z.string().optional()
})

export type StoredWeChatAccount = z.infer<typeof AccountSchema>

function resolveAccountsDir(): string {
  return join(app.getPath('userData'), 'wechat', 'accounts')
}

export async function saveAccount(accountId: string, account: StoredWeChatAccount): Promise<void> {
  const dir = resolveAccountsDir()
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, `${accountId}.json`), JSON.stringify(account, null, 2), 'utf-8')
}

export async function loadAccount(accountId: string): Promise<StoredWeChatAccount | null> {
  const filePath = join(resolveAccountsDir(), `${accountId}.json`)
  try {
    const raw = await readFile(filePath, 'utf-8')
    return AccountSchema.parse(JSON.parse(raw))
  } catch {
    return null
  }
}

export async function listAccountIds(): Promise<string[]> {
  try {
    const entries = await readdir(resolveAccountsDir())
    return entries.filter((entry) => entry.endsWith('.json')).map((entry) => entry.replace(/\\.json$/, ''))
  } catch {
    return []
  }
}

export async function deleteAccount(accountId: string): Promise<void> {
  await rm(join(resolveAccountsDir(), `${accountId}.json`), { force: true })
}
```

- [ ] **Step 3: Implement the protocol adapter with QR login and basic send hooks**

Create `src/main/wechat/protocol-adapter.ts` by adapting the copied plugin's `login-qr.ts`, `api.ts`, and `send.ts` into app-owned functions:

```ts
export interface WeChatQrStartResult {
  sessionKey: string
  qrUrl?: string
  message: string
}

export interface WeChatQrWaitResult {
  connected: boolean
  accountId?: string
  userId?: string
  baseUrl?: string
  token?: string
  message: string
}

export async function startQrLogin(baseUrl: string, accountId?: string): Promise<WeChatQrStartResult> {
  // Adapt from openclaw-weixin/src/auth/login-qr.ts
}

export async function waitQrLogin(sessionKey: string, baseUrl: string, timeoutMs = 480_000): Promise<WeChatQrWaitResult> {
  // Adapt from openclaw-weixin/src/auth/login-qr.ts
}

export async function sendWeChatText(params: {
  baseUrl: string
  token: string
  toUserId: string
  text: string
  contextToken?: string
}): Promise<{ messageId: string }> {
  // Adapt from openclaw-weixin/src/api/api.ts and src/messaging/send.ts
}
```

Keep the first cut intentionally narrow:

- QR login start
- QR login wait
- send text

Do not add image send yet in this task.

- [ ] **Step 4: Write the failing tests**

Create `tests/unit/wechat/account-store.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { saveAccount, loadAccount } from '../../../src/main/wechat/account-store'

describe('account-store', () => {
  it('round-trips an account record', async () => {
    await saveAccount('acc-1', {
      token: 'token-1',
      baseUrl: 'https://example.com',
      userId: 'u-1'
    })

    await expect(loadAccount('acc-1')).resolves.toMatchObject({
      token: 'token-1',
      baseUrl: 'https://example.com',
      userId: 'u-1'
    })
  })
})
```

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm exec vitest run tests/unit/wechat/account-store.test.ts
```

Expected before implementation: missing-module failure.

Expected after implementation: pass.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml src/main/wechat/account-store.ts src/main/wechat/protocol-adapter.ts tests/unit/wechat/account-store.test.ts
git commit -m "feat: add wechat account storage and protocol adapter"
```

---

### Task 3: Build the WeChat channel manager and the headless AI session manager

**Files:**
- Create: `src/main/wechat/channel-manager.ts`
- Create: `src/main/wechat/headless-session-manager.ts`
- Create: `src/main/wechat/engine/claude-worker.ts`
- Create: `src/main/wechat/engine/codex-worker.ts`
- Create: `tests/unit/wechat/headless-session-manager.test.ts`

- [ ] **Step 1: Define the engine-worker contract**

Create `src/main/wechat/engine/claude-worker.ts` and `src/main/wechat/engine/codex-worker.ts` around the same shared shape:

```ts
export interface EngineInput {
  sessionId: string
  text?: string
  imagePath?: string
}

export interface EngineEvent {
  type: 'reply_started' | 'reply_delta' | 'reply_finished' | 'reply_error'
  textDelta?: string
  finalText?: string
  error?: string
}

export interface AIEngineWorker {
  sendMessage(input: EngineInput): AsyncIterable<EngineEvent>
  shutdown(sessionId: string): Promise<void>
}
```

In the initial implementation, both workers may return a mocked final reply to unblock the queueing and UI wiring:

```ts
export class ClaudeWorker implements AIEngineWorker {
  async *sendMessage(input: EngineInput): AsyncIterable<EngineEvent> {
    yield { type: 'reply_started' }
    yield { type: 'reply_finished', finalText: `Claude echo: ${input.text ?? '[image]'}` }
  }

  async shutdown(): Promise<void> {}
}
```

Use the same pattern for `CodexWorker`, replacing the prefix.

- [ ] **Step 2: Implement a serial per-conversation queue**

Create `src/main/wechat/headless-session-manager.ts`:

```ts
import type { CanonicalMessage, EngineType } from './types'
import { ClaudeWorker } from './engine/claude-worker'
import { CodexWorker } from './engine/codex-worker'

export class HeadlessAISessionManager {
  private running = new Map<string, Promise<void>>()

  async enqueue(params: {
    conversationKey: string
    engine: EngineType
    message: CanonicalMessage
    onReply: (text: string) => Promise<void>
  }): Promise<void> {
    const previous = this.running.get(params.conversationKey) ?? Promise.resolve()
    const next = previous.finally(async () => {
      const worker = params.engine === 'claude' ? new ClaudeWorker() : new CodexWorker()
      for await (const event of worker.sendMessage({
        sessionId: params.conversationKey,
        text: params.message.text,
        imagePath: params.message.imagePath
      })) {
        if (event.type === 'reply_finished' && event.finalText) {
          await params.onReply(event.finalText)
        }
      }
    })

    this.running.set(params.conversationKey, next)
    await next
  }
}
```

- [ ] **Step 3: Implement the channel manager**

Create `src/main/wechat/channel-manager.ts`:

```ts
import { EventEmitter } from 'node:events'
import { loadAccount, listAccountIds } from './account-store'
import { HeadlessAISessionManager } from './headless-session-manager'
import { WeChatConversationStore } from './conversation-store'
import { inboundTextToCanonical } from './message-bridge'

export class WeChatChannelManager extends EventEmitter {
  constructor(
    private store: WeChatConversationStore,
    private sessions: HeadlessAISessionManager
  ) {
    super()
  }

  async bootstrapAccounts(): Promise<void> {
    const ids = await listAccountIds()
    for (const id of ids) {
      const account = await loadAccount(id)
      if (!account) continue
      this.store.upsertAccount({
        accountId: id,
        baseUrl: account.baseUrl,
        displayName: account.displayName,
        userId: account.userId,
        enabled: true,
        connected: false,
        defaultEngine: 'claude',
        sessionIsolationMode: 'per-contact'
      })
    }
  }
}
```

This first cut is intentionally shallow: bootstrap state first, then add real polling in the next task.

- [ ] **Step 4: Write the failing queueing test**

Create `tests/unit/wechat/headless-session-manager.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { HeadlessAISessionManager } from '../../../src/main/wechat/headless-session-manager'

describe('HeadlessAISessionManager', () => {
  it('returns a reply for a queued claude message', async () => {
    const manager = new HeadlessAISessionManager()
    let reply = ''

    await manager.enqueue({
      conversationKey: 'wechat:acc-1:user-1',
      engine: 'claude',
      message: {
        messageId: 'm-1',
        accountId: 'acc-1',
        peerUserId: 'user-1',
        direction: 'inbound',
        type: 'text',
        text: 'hello',
        timestamp: 1
      },
      onReply: async (text) => {
        reply = text
      }
    })

    expect(reply).toContain('Claude echo')
  })
})
```

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm exec vitest run tests/unit/wechat/headless-session-manager.test.ts
```

Expected after implementation: pass.

- [ ] **Step 6: Commit**

```bash
git add src/main/wechat/channel-manager.ts src/main/wechat/headless-session-manager.ts src/main/wechat/engine/claude-worker.ts src/main/wechat/engine/codex-worker.ts tests/unit/wechat/headless-session-manager.test.ts
git commit -m "feat: add wechat channel manager and headless ai session manager"
```

---

### Task 4: Wire WeChat into Electron lifecycle, IPC, preload, and renderer store

**Files:**
- Modify: `src/main/index.ts`
- Create: `src/main/ipc/wechat.ts`
- Modify: `src/preload/index.ts`
- Create: `src/renderer/src/stores/wechat.ts`
- Modify: `src/renderer/src/App.vue`
- Modify: `src/renderer/src/components/Sidebar.vue`

- [ ] **Step 1: Register the WeChat services in the main process**

Create `src/main/ipc/wechat.ts`:

```ts
import { ipcMain } from 'electron'
import { WeChatChannelManager } from '../wechat/channel-manager'
import { WeChatConversationStore } from '../wechat/conversation-store'
import { HeadlessAISessionManager } from '../wechat/headless-session-manager'

const store = new WeChatConversationStore()
const sessions = new HeadlessAISessionManager()
const manager = new WeChatChannelManager(store, sessions)

export async function bootstrapWeChat(): Promise<void> {
  await manager.bootstrapAccounts()
}

export function registerWeChatHandlers(): void {
  ipcMain.handle('wechat:listAccounts', async () => store.listAccounts())
  ipcMain.handle('wechat:listConversations', async () => store.listConversations())
}
```

Modify `src/main/index.ts` to import and call:

```ts
import { bootstrapWeChat, registerWeChatHandlers } from './ipc/wechat'
```

And inside `app.whenReady()`:

```ts
registerWeChatHandlers()
await bootstrapWeChat()
```

- [ ] **Step 2: Expose WeChat APIs through preload**

Extend `src/preload/index.ts`:

```ts
wechatListAccounts: (): Promise<import('../main/wechat/types').WeChatAccountRecord[]> =>
  ipcRenderer.invoke('wechat:listAccounts'),
wechatListConversations: (): Promise<import('../main/wechat/types').WeChatConversationRecord[]> =>
  ipcRenderer.invoke('wechat:listConversations'),
```

- [ ] **Step 3: Add a renderer store**

Create `src/renderer/src/stores/wechat.ts`:

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useWeChatStore = defineStore('wechat', () => {
  const accounts = ref<any[]>([])
  const conversations = ref<any[]>([])

  async function refresh(): Promise<void> {
    accounts.value = await window.api.wechatListAccounts()
    conversations.value = await window.api.wechatListConversations()
  }

  return { accounts, conversations, refresh }
})
```

- [ ] **Step 4: Add a WeChat entry point in the UI shell**

Modify `src/renderer/src/App.vue` to add a view mode and switch central content:

```vue
const activeView = ref<'chat' | 'wechat'>('chat')
```

Template change:

```vue
<Sidebar v-if="sidebarVisible" v-model:activeView="activeView" />
<div class="center-area">
  <ChatPanel v-if="activeView === 'chat'" class="chat-area" />
  <WeChatWorkspace v-else class="chat-area" />
</div>
```

Modify `src/renderer/src/components/Sidebar.vue` to expose a simple toggle button:

```vue
const props = defineProps<{ activeView: 'chat' | 'wechat' }>()
const emit = defineEmits<{ (e: 'update:activeView', value: 'chat' | 'wechat'): void }>()
```

```html
<button class="open-btn" @click="emit('update:activeView', 'wechat')">
  微信
</button>
```

- [ ] **Step 5: Run typecheck**

Run:

```bash
pnpm run typecheck
```

Expected: main and renderer typecheck pass.

- [ ] **Step 6: Commit**

```bash
git add src/main/index.ts src/main/ipc/wechat.ts src/preload/index.ts src/renderer/src/stores/wechat.ts src/renderer/src/App.vue src/renderer/src/components/Sidebar.vue
git commit -m "feat: wire wechat services into app lifecycle and renderer state"
```

---

### Task 5: Add QR-login UI, conversation views, and real text/image processing loop

**Files:**
- Create: `src/renderer/src/components/wechat/WeChatWorkspace.vue`
- Create: `src/renderer/src/components/wechat/WeChatAccountsPanel.vue`
- Create: `src/renderer/src/components/wechat/WeChatConversationsPanel.vue`
- Modify: `src/main/ipc/wechat.ts`
- Modify: `src/main/wechat/protocol-adapter.ts`
- Modify: `src/main/wechat/channel-manager.ts`
- Modify: `src/main/wechat/message-bridge.ts`

- [ ] **Step 1: Add QR-login IPC**

Extend `src/main/ipc/wechat.ts` with login handlers:

```ts
ipcMain.handle('wechat:startQrLogin', async (_event, baseUrl?: string) => {
  return await manager.startQrLogin(baseUrl)
})

ipcMain.handle('wechat:waitQrLogin', async (_event, sessionKey: string, baseUrl?: string) => {
  return await manager.waitQrLogin(sessionKey, baseUrl)
})
```

Add corresponding methods on `WeChatChannelManager`:

```ts
async startQrLogin(baseUrl = 'https://ilinkai.weixin.qq.com') {
  return startQrLogin(baseUrl)
}

async waitQrLogin(sessionKey: string, baseUrl = 'https://ilinkai.weixin.qq.com') {
  const result = await waitQrLogin(sessionKey, baseUrl)
  if (result.connected && result.accountId && result.token && result.baseUrl) {
    await saveAccount(result.accountId, {
      token: result.token,
      baseUrl: result.baseUrl,
      userId: result.userId
    })
  }
  return result
}
```

- [ ] **Step 2: Add the WeChat renderer panels**

Create `src/renderer/src/components/wechat/WeChatWorkspace.vue`:

```vue
<script setup lang="ts">
import { onMounted } from 'vue'
import { useWeChatStore } from '../../stores/wechat'
import WeChatAccountsPanel from './WeChatAccountsPanel.vue'
import WeChatConversationsPanel from './WeChatConversationsPanel.vue'

const wechat = useWeChatStore()
onMounted(() => {
  void wechat.refresh()
})
</script>

<template>
  <div class="wechat-workspace">
    <WeChatAccountsPanel />
    <WeChatConversationsPanel />
  </div>
</template>
```

Create `WeChatAccountsPanel.vue` with:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useWeChatStore } from '../../stores/wechat'

const store = useWeChatStore()
const qrUrl = ref<string | null>(null)

async function login(): Promise<void> {
  const started = await window.api.wechatStartQrLogin()
  qrUrl.value = started.qrUrl ?? null
}
</script>
```

Create `WeChatConversationsPanel.vue` with a simple list bound to `store.conversations`.

- [ ] **Step 3: Add real inbound polling and fixed AI reply handoff**

Adapt `src/main/wechat/channel-manager.ts` so each enabled account starts one polling loop.

Use the adapted protocol helper plus bridge:

```ts
const message = inboundTextToCanonical({
  messageId: `wx-${Date.now()}`,
  accountId,
  peerUserId: fromUserId,
  text,
  contextToken,
  timestamp: Date.now()
})

await this.sessions.enqueue({
  conversationKey,
  engine,
  message,
  onReply: async (text) => {
    await sendWeChatText({
      baseUrl: account.baseUrl,
      token: account.token,
      toUserId: fromUserId,
      text,
      contextToken
    })
  }
})
```

For image messages, use `inboundImageToCanonical(...)` and pass `imagePath`.

- [ ] **Step 4: Add a focused integration verification**

Run:

```bash
pnpm exec vitest run tests/unit/wechat
pnpm run typecheck
```

Then do a manual smoke test:

1. start the app with `pnpm run dev`
2. open the WeChat view
3. start QR login
4. verify the QR image/link appears in the account panel

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc/wechat.ts src/main/wechat/protocol-adapter.ts src/main/wechat/channel-manager.ts src/main/wechat/message-bridge.ts src/renderer/src/components/wechat src/renderer/src/App.vue src/renderer/src/components/Sidebar.vue src/renderer/src/stores/wechat.ts
git commit -m "feat: add wechat qr login ui and text image processing loop"
```

---

### Task 6: Replace mock engine workers with real Claude/Codex background adapters

**Files:**
- Modify: `src/main/wechat/engine/claude-worker.ts`
- Modify: `src/main/wechat/engine/codex-worker.ts`
- Modify: `src/main/wechat/headless-session-manager.ts`
- Create: `tests/unit/wechat/engine-workers.test.ts`

- [ ] **Step 1: Implement the Claude adapter against the existing app runtime**

Use the existing Claude integration as the starting point. The worker must not depend on renderer iframes.

Sketch:

```ts
export class ClaudeWorker implements AIEngineWorker {
  async *sendMessage(input: EngineInput): AsyncIterable<EngineEvent> {
    yield { type: 'reply_started' }

    const finalText = await runClaudeHeadless(input)
    yield { type: 'reply_finished', finalText }
  }
}
```

`runClaudeHeadless` should be factored from the current Claude main-process integration rather than driving `ChatPanel` or webview routes.

- [ ] **Step 2: Implement the Codex adapter with the same contract**

Use the same `AIEngineWorker` event contract so `HeadlessAISessionManager` can stay engine-agnostic:

```ts
export class CodexWorker implements AIEngineWorker {
  async *sendMessage(input: EngineInput): AsyncIterable<EngineEvent> {
    yield { type: 'reply_started' }

    const finalText = await runCodexHeadless(input)
    yield { type: 'reply_finished', finalText }
  }
}
```

- [ ] **Step 3: Preserve the per-conversation queue while handling streamed deltas**

Update `src/main/wechat/headless-session-manager.ts` so it collects deltas and flushes text in chunks:

```ts
let buffer = ''
for await (const event of worker.sendMessage(engineInput)) {
  if (event.type === 'reply_delta' && event.textDelta) {
    buffer += event.textDelta
    if (buffer.length >= 120) {
      await params.onReply(buffer)
      buffer = ''
    }
  }
  if (event.type === 'reply_finished') {
    const finalText = event.finalText ?? buffer
    if (finalText) await params.onReply(finalText)
  }
}
```

- [ ] **Step 4: Add the engine worker tests**

Create `tests/unit/wechat/engine-workers.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ClaudeWorker } from '../../../src/main/wechat/engine/claude-worker'

describe('ClaudeWorker', () => {
  it('emits a started event before the final event', async () => {
    const worker = new ClaudeWorker()
    const events = []
    for await (const event of worker.sendMessage({ sessionId: 's1', text: 'hello' })) {
      events.push(event.type)
    }
    expect(events[0]).toBe('reply_started')
    expect(events.at(-1)).toBe('reply_finished')
  })
})
```

- [ ] **Step 5: Full verification**

Run:

```bash
pnpm exec vitest run tests/unit/wechat
pnpm run typecheck
pnpm run build
```

Expected:

- WeChat unit tests pass
- main/renderer typecheck passes
- production build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/main/wechat/engine/claude-worker.ts src/main/wechat/engine/codex-worker.ts src/main/wechat/headless-session-manager.ts tests/unit/wechat/engine-workers.test.ts
git commit -m "feat: connect wechat headless sessions to claude and codex workers"
```

---

## Self-Review

- [x] **Spec coverage:** The plan covers QR login, account store, conversation store, headless sessions, engine routing, renderer account/conversation views, text+image handling, and verification.
- [x] **Placeholder scan:** No `TBD`, `TODO`, or "implement later" steps remain; where current app-specific headless engine wiring needs extraction, the plan names exact target files and exact contract shape.
- [x] **Type consistency:** `EngineType`, `IsolationMode`, `CanonicalMessage`, `WeChatAccountRecord`, and `WeChatConversationRecord` remain consistent with the approved spec and are reused across tasks.

---

Plan complete and saved to `docs/superpowers/plans/2026-04-24-wechat-headless-ai-integration.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
