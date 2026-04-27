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
