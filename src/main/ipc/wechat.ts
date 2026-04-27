import { ipcMain } from 'electron'

import { WeChatChannelManager } from '../wechat/channel-manager'
import { WeChatConversationStore } from '../wechat/conversation-store'
import { HeadlessAISessionManager } from '../wechat/headless-session-manager'

const conversationStore = new WeChatConversationStore()
const sessionManager = new HeadlessAISessionManager()
const channelManager = new WeChatChannelManager(conversationStore, sessionManager)

export async function bootstrapWeChat(): Promise<void> {
  await channelManager.bootstrapAccounts()
}

export function registerWeChatHandlers(): void {
  ipcMain.handle('wechat:listAccounts', async () => conversationStore.listAccounts())
  ipcMain.handle('wechat:listConversations', async () => conversationStore.listConversations())
  ipcMain.handle('wechat:startQrLogin', async (_event, baseUrl?: string) =>
    channelManager.startQrLogin(baseUrl ?? 'https://ilinkai.weixin.qq.com')
  )
  ipcMain.handle('wechat:waitQrLogin', async (_event, sessionKey: string, baseUrl?: string) =>
    channelManager.waitQrLogin(sessionKey, baseUrl ?? 'https://ilinkai.weixin.qq.com')
  )
}

export function getWeChatChannelManager(): WeChatChannelManager {
  return channelManager
}
