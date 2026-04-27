import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'

import {
  listAccountIds,
  loadAccount,
  saveAccount,
  type StoredWeChatAccount
} from './account-store'
import { WeChatConversationStore } from './conversation-store'
import { HeadlessAISessionManager } from './headless-session-manager'
import {
  downloadWeChatImageToTemp,
  getUpdates,
  sendWeChatText,
  startQrLogin,
  waitQrLogin,
  type WeChatInboundMessage,
  type WeChatQrStartResult,
  type WeChatQrWaitResult
} from './protocol-adapter'
import { inboundImageToCanonical, inboundTextToCanonical } from './message-bridge'
import type { WeChatAccountRecord } from './types'

function toAccountRecord(accountId: string, account: StoredWeChatAccount): WeChatAccountRecord {
  return {
    accountId,
    userId: account.userId,
    displayName: account.displayName,
    baseUrl: account.baseUrl,
    enabled: true,
    connected: false,
    defaultEngine: 'codex',
    sessionIsolationMode: 'per-contact'
  }
}

type WeChatChannelManagerDeps = {
  listAccountIds: typeof listAccountIds
  loadAccount: typeof loadAccount
  saveAccount: typeof saveAccount
  startQrLogin: typeof startQrLogin
  waitQrLogin: typeof waitQrLogin
  getUpdates: typeof getUpdates
  downloadWeChatImageToTemp: typeof downloadWeChatImageToTemp
  sendWeChatText: typeof sendWeChatText
  autoStartPolling: boolean
}

type RuntimeAccountState = {
  accountId: string
  baseUrl: string
  token: string
  cursor: string
}

export class WeChatChannelManager extends EventEmitter {
  private readonly deps: WeChatChannelManagerDeps
  private readonly runtimeAccounts = new Map<string, RuntimeAccountState>()
  private readonly pollingControllers = new Map<string, AbortController>()

  constructor(
    private readonly store: WeChatConversationStore,
    private readonly sessions: HeadlessAISessionManager,
    deps?: Partial<WeChatChannelManagerDeps>
  ) {
    super()
    this.deps = {
      listAccountIds,
      loadAccount,
      saveAccount,
      startQrLogin,
      waitQrLogin,
      getUpdates,
      downloadWeChatImageToTemp,
      sendWeChatText,
      autoStartPolling: true,
      ...deps
    }
  }

  async bootstrapAccounts(): Promise<void> {
    const accountIds = await this.deps.listAccountIds()
    for (const accountId of accountIds) {
      const account = await this.deps.loadAccount(accountId)
      if (!account) {
        continue
      }

      this.store.upsertAccount(toAccountRecord(accountId, account))
      this.runtimeAccounts.set(accountId, {
        accountId,
        baseUrl: account.baseUrl,
        token: account.token,
        cursor: ''
      })
      if (this.deps.autoStartPolling) {
        this.startPollingAccount(accountId)
      }
    }
  }

  async startQrLogin(baseUrl: string): Promise<WeChatQrStartResult> {
    return this.deps.startQrLogin(baseUrl)
  }

  async waitQrLogin(sessionKey: string, baseUrl: string): Promise<WeChatQrWaitResult> {
    const result = await this.deps.waitQrLogin(sessionKey, baseUrl)

    if (result.connected && result.accountId && result.token) {
      const storedAccount: StoredWeChatAccount = {
        token: result.token,
        baseUrl: result.baseUrl ?? baseUrl,
        userId: result.userId,
        displayName: undefined
      }

      await this.deps.saveAccount(result.accountId, storedAccount)
      this.store.upsertAccount({
        ...toAccountRecord(result.accountId, storedAccount),
        connected: true
      })
      this.runtimeAccounts.set(result.accountId, {
        accountId: result.accountId,
        baseUrl: storedAccount.baseUrl,
        token: storedAccount.token,
        cursor: ''
      })
      if (this.deps.autoStartPolling) {
        this.startPollingAccount(result.accountId)
      }
    }

    return result
  }

  async pollAccountOnce(accountId: string): Promise<void> {
    const runtime = this.runtimeAccounts.get(accountId)
    if (!runtime) {
      return
    }

    const update = await this.deps.getUpdates({
      baseUrl: runtime.baseUrl,
      token: runtime.token,
      cursor: runtime.cursor
    })
    runtime.cursor = update.cursor

    const account = this.store.listAccounts().find((entry) => entry.accountId === accountId)
    if (account && !account.connected) {
      this.store.upsertAccount({
        ...account,
        connected: true
      })
    }

    for (const message of update.messages) {
      await this.processInboundMessage(runtime, message)
    }
  }

  private startPollingAccount(accountId: string): void {
    if (this.pollingControllers.has(accountId)) {
      return
    }

    const controller = new AbortController()
    this.pollingControllers.set(accountId, controller)

    void this.pollLoop(accountId, controller.signal).finally(() => {
      if (this.pollingControllers.get(accountId) === controller) {
        this.pollingControllers.delete(accountId)
      }
    })
  }

  private async pollLoop(accountId: string, signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      try {
        await this.pollAccountOnce(accountId)
      } catch (error) {
        this.emit('error', error)
        await sleep(3_000, signal)
        continue
      }

      await sleep(250, signal)
    }
  }

  private async processInboundMessage(
    runtime: RuntimeAccountState,
    message: WeChatInboundMessage
  ): Promise<void> {
    const account = this.store.listAccounts().find((entry) => entry.accountId === runtime.accountId)
    if (!account) {
      return
    }

    const canonicalMessage = message.image
      ? inboundImageToCanonical({
          messageId: message.messageId,
          accountId: runtime.accountId,
          peerUserId: message.peerUserId,
          imagePath: await this.deps.downloadWeChatImageToTemp(message.image),
          text: message.text,
          contextToken: message.contextToken,
          timestamp: message.timestamp
        })
      : inboundTextToCanonical({
          messageId: message.messageId,
          accountId: runtime.accountId,
          peerUserId: message.peerUserId,
          text: message.text ?? '',
          contextToken: message.contextToken,
          timestamp: message.timestamp
        })

    const conversation = this.store.resolveConversation({
      accountId: runtime.accountId,
      peerUserId: message.peerUserId,
      aiSessionId: `wechat:${runtime.accountId}:${message.peerUserId}`,
      engine: account.defaultEngine ?? 'claude',
      isolationMode: account.sessionIsolationMode
    })

    this.store.recordMessage(canonicalMessage)

    await this.sessions.enqueue({
      conversationKey: conversation.conversationKey,
      engine: conversation.engine,
      message: canonicalMessage,
      onReply: async (replyText) => {
        await this.deps.sendWeChatText({
          baseUrl: runtime.baseUrl,
          token: runtime.token,
          toUserId: message.peerUserId,
          text: replyText,
          contextToken: message.contextToken
        })

        this.store.recordMessage({
          messageId: randomUUID(),
          accountId: runtime.accountId,
          peerUserId: message.peerUserId,
          direction: 'outbound',
          type: 'text',
          text: replyText,
          contextToken: message.contextToken,
          timestamp: Date.now()
        })
      }
    })
  }

  getConversationStore(): WeChatConversationStore {
    return this.store
  }

  getSessionManager(): HeadlessAISessionManager {
    return this.sessions
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true }
    )
  })
}
