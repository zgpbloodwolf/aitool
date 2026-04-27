import { defineStore } from 'pinia'
import { ref } from 'vue'

interface WeChatAccountView {
  accountId: string
  userId?: string
  displayName?: string
  baseUrl: string
  enabled: boolean
  connected: boolean
  defaultEngine: 'claude' | 'codex' | null
  sessionIsolationMode: 'per-contact' | 'shared'
  lastConnectedAt?: number
  lastInboundAt?: number
  lastOutboundAt?: number
  lastError?: string | null
}

interface WeChatConversationView {
  conversationKey: string
  accountId: string
  peerUserId: string
  peerDisplayName?: string
  engine: 'claude' | 'codex'
  aiSessionId: string
  processing: boolean
  lastMessagePreview?: string
  lastInboundAt?: number
  lastOutboundAt?: number
  lastError?: string | null
}

export const useWeChatStore = defineStore('wechat', () => {
  const accounts = ref<WeChatAccountView[]>([])
  const conversations = ref<WeChatConversationView[]>([])
  const loading = ref(false)

  async function refresh(): Promise<void> {
    loading.value = true
    try {
      const [nextAccounts, nextConversations] = await Promise.all([
        window.api.wechatListAccounts(),
        window.api.wechatListConversations()
      ])
      accounts.value = nextAccounts
      conversations.value = nextConversations
    } finally {
      loading.value = false
    }
  }

  return { accounts, conversations, loading, refresh }
})
