import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useWeChatStore } from '../../../src/renderer/src/stores/wechat'

describe('useWeChatStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('window', {
      api: {
        wechatListAccounts: vi.fn().mockResolvedValue([{ accountId: 'acc-1' }]),
        wechatListConversations: vi.fn().mockResolvedValue([{ conversationKey: 'wechat:acc-1:user-1' }])
      }
    })
  })

  it('refreshes accounts and conversations from preload APIs', async () => {
    const store = useWeChatStore()

    await store.refresh()

    expect(store.accounts).toEqual([{ accountId: 'acc-1' }])
    expect(store.conversations).toEqual([{ conversationKey: 'wechat:acc-1:user-1' }])
  })
})
