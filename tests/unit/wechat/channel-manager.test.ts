import { describe, expect, it, vi } from 'vitest'

import { WeChatChannelManager } from '../../../src/main/wechat/channel-manager'
import { WeChatConversationStore } from '../../../src/main/wechat/conversation-store'
import { HeadlessAISessionManager } from '../../../src/main/wechat/headless-session-manager'

describe('WeChatChannelManager', () => {
  it('saves and registers an account after QR login succeeds', async () => {
    const store = new WeChatConversationStore()
    const sessions = new HeadlessAISessionManager()
    const saveAccount = vi.fn().mockResolvedValue(undefined)

    const manager = new WeChatChannelManager(store, sessions, {
      listAccountIds: async () => [],
      loadAccount: async () => null,
      saveAccount,
      startQrLogin: async () => ({
        sessionKey: 'qr-session',
        qrUrl: 'https://example.com/qr.png',
        message: 'scan now'
      }),
      waitQrLogin: async () => ({
        connected: true,
        accountId: 'acc-1',
        token: 'token-1',
        baseUrl: 'https://example.com',
        userId: 'user-1',
        message: 'ok'
      }),
      sendWeChatText: async () => ({ messageId: 'out-1' }),
      autoStartPolling: false
    })

    const started = await manager.startQrLogin('https://example.com')
    expect(started.qrUrl).toBe('https://example.com/qr.png')

    const completed = await manager.waitQrLogin('qr-session', 'https://example.com')

    expect(completed.connected).toBe(true)
    expect(saveAccount).toHaveBeenCalledWith('acc-1', {
      token: 'token-1',
      baseUrl: 'https://example.com',
      userId: 'user-1',
      displayName: undefined
    })
    expect(store.listAccounts()).toHaveLength(1)
    expect(store.listAccounts()[0]?.accountId).toBe('acc-1')
  })

  it('processes one inbound text update and sends the AI reply back', async () => {
    const store = new WeChatConversationStore()
    const sendWeChatText = vi.fn().mockResolvedValue({ messageId: 'out-1' })

    class TestSessionManager extends HeadlessAISessionManager {
      override async enqueue(params: {
        conversationKey: string
        engine: 'claude' | 'codex'
        message: {
          messageId: string
          accountId: string
          peerUserId: string
          direction: 'inbound' | 'outbound'
          type: 'text' | 'image'
          text?: string
          imagePath?: string
          timestamp: number
          contextToken?: string
        }
        onReply: (text: string) => Promise<void>
      }): Promise<void> {
        await params.onReply(`Claude echo: ${params.message.text ?? ''}`)
      }
    }

    const manager = new WeChatChannelManager(store, new TestSessionManager(), {
      listAccountIds: async () => ['acc-1'],
      loadAccount: async () => ({
        token: 'token-1',
        baseUrl: 'https://example.com',
        userId: 'bot-user'
      }),
      saveAccount: vi.fn().mockResolvedValue(undefined),
      startQrLogin: async () => ({
        sessionKey: 'qr-session',
        qrUrl: 'https://example.com/qr.png',
        message: 'scan now'
      }),
      waitQrLogin: async () => ({
        connected: false,
        message: 'not used'
      }),
      sendWeChatText,
      autoStartPolling: false,
      getUpdates: async () => ({
        cursor: 'cursor-2',
        messages: [
          {
            messageId: 'm-1',
            peerUserId: 'user-1',
            timestamp: 1,
            contextToken: 'ctx-1',
            text: 'hello'
          }
        ]
      })
    })

    await manager.bootstrapAccounts()
    await manager.pollAccountOnce('acc-1')

    expect(store.listConversations()).toHaveLength(1)
    expect(sendWeChatText).toHaveBeenCalledWith({
      baseUrl: 'https://example.com',
      token: 'token-1',
      toUserId: 'user-1',
      text: 'Claude echo: hello',
      contextToken: 'ctx-1'
    })
  })
})
