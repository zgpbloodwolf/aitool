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
