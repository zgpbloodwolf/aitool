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
  private readonly accounts = new Map<string, WeChatAccountRecord>()
  private readonly conversations = new Map<string, WeChatConversationRecord>()

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

    if (existing) {
      return existing
    }

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
    if (!account) {
      return
    }

    const conversationKey = buildConversationKey(
      message.accountId,
      message.peerUserId,
      account.sessionIsolationMode
    )
    const conversation = this.conversations.get(conversationKey)

    if (!conversation) {
      return
    }

    conversation.lastMessagePreview = message.text?.slice(0, 120) ?? '[image]'

    if (message.direction === 'inbound') {
      conversation.lastInboundAt = message.timestamp
    } else {
      conversation.lastOutboundAt = message.timestamp
    }
  }

  listAccounts(): WeChatAccountRecord[] {
    return [...this.accounts.values()]
  }

  listConversations(): WeChatConversationRecord[] {
    return [...this.conversations.values()].sort(
      (left, right) => (right.lastInboundAt ?? 0) - (left.lastInboundAt ?? 0)
    )
  }
}
