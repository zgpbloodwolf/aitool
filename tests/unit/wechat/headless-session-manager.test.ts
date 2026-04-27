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
