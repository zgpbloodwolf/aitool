import { describe, expect, it } from 'vitest'
import { inboundImageToCanonical, inboundTextToCanonical } from '../../../src/main/wechat/message-bridge'

describe('message bridge', () => {
  it('builds a canonical text message', () => {
    const message = inboundTextToCanonical({
      messageId: 'm-1',
      accountId: 'acc-1',
      peerUserId: 'user-a',
      text: 'hello',
      contextToken: 'ctx-1',
      timestamp: 1
    })

    expect(message).toMatchObject({
      messageId: 'm-1',
      accountId: 'acc-1',
      peerUserId: 'user-a',
      direction: 'inbound',
      type: 'text',
      text: 'hello',
      contextToken: 'ctx-1',
      timestamp: 1
    })
  })

  it('keeps imagePath and contextToken for image inbound messages', () => {
    const message = inboundImageToCanonical({
      messageId: 'm-2',
      accountId: 'acc-1',
      peerUserId: 'user-a',
      imagePath: 'C:/tmp/image.png',
      text: 'look',
      contextToken: 'ctx-2',
      timestamp: 2
    })

    expect(message.type).toBe('image')
    expect(message.imagePath).toBe('C:/tmp/image.png')
    expect(message.text).toBe('look')
    expect(message.contextToken).toBe('ctx-2')
  })
})
