import { describe, expect, it } from 'vitest'
import { WeChatConversationStore } from '../../../src/main/wechat/conversation-store'

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

    const first = store.resolveConversation({
      accountId: 'acc-1',
      peerUserId: 'user-a',
      aiSessionId: 'sess-a',
      engine: 'claude',
      isolationMode: 'per-contact'
    })
    const second = store.resolveConversation({
      accountId: 'acc-1',
      peerUserId: 'user-b',
      aiSessionId: 'sess-b',
      engine: 'claude',
      isolationMode: 'per-contact'
    })

    expect(first.conversationKey).not.toBe(second.conversationKey)
  })

  it('uses a shared key when the account isolation mode is shared', () => {
    const store = new WeChatConversationStore()
    store.upsertAccount({
      accountId: 'acc-1',
      baseUrl: 'https://example.com',
      enabled: true,
      connected: true,
      defaultEngine: 'codex',
      sessionIsolationMode: 'shared'
    })

    const first = store.resolveConversation({
      accountId: 'acc-1',
      peerUserId: 'user-a',
      aiSessionId: 'sess-a',
      engine: 'codex',
      isolationMode: 'shared'
    })
    const second = store.resolveConversation({
      accountId: 'acc-1',
      peerUserId: 'user-b',
      aiSessionId: 'sess-b',
      engine: 'codex',
      isolationMode: 'shared'
    })

    expect(first.conversationKey).toBe('wechat:acc-1:shared')
    expect(second.conversationKey).toBe('wechat:acc-1:shared')
  })
})
