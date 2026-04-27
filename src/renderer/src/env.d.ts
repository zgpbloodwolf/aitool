/// <reference types="vite/client" />

export {}

interface WindowApi {
  selectFolder: () => Promise<string | null>
  readDir: (
    dirPath: string
  ) => Promise<{ name: string; isDirectory: boolean; isFile: boolean }[]>
  readFile: (filePath: string) => Promise<string>
  stat: (filePath: string) => Promise<{ isFile: boolean; isDirectory: boolean; size: number }>
  getInstalledExtensions: () => Promise<{
    id: string
    name: string
    version: string
    description: string
    publisher: string
    extensionPath: string
    iconPath?: string
  }[]>
  activateExtension: (extensionId: string) => Promise<void>
  claudeStart: () => Promise<{ success: boolean; error?: string }>
  claudeSetCwd: (cwd: string) => Promise<{ success: boolean }>
  claudeSend: (text: string) => void
  claudeStop: () => void
  claudeGetExtensionPath: () => Promise<string | null>
  claudeListSessions: () => Promise<Array<{
    id: string
    lastModified: number
    fileSize: number
    summary: string | undefined
    gitBranch: string | undefined
    isCurrentWorkspace: true
  }>>
  claudeResumeSession: (channelId: string | null, sessionId: string) => Promise<{ success: boolean; error?: string; channelId?: string }>
  claudeStartWebviewServer: (extensionPath: string) => Promise<number>
  claudeWebviewFromWebview: (msg: unknown) => void
  wechatStartQrLogin: (baseUrl?: string) => Promise<{
    sessionKey: string
    qrUrl?: string
    message: string
  }>
  wechatWaitQrLogin: (sessionKey: string, baseUrl?: string) => Promise<{
    connected: boolean
    accountId?: string
    userId?: string
    baseUrl?: string
    token?: string
    message: string
  }>
  wechatListAccounts: () => Promise<{
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
  }[]>
  wechatListConversations: () => Promise<{
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
  }[]>
  onClaudeMessage: (callback: (msg: unknown) => void) => () => void
  onClaudeError: (callback: (err: string) => void) => () => void
  onClaudeExit: (callback: (code: number | null) => void) => () => void
  onClaudeWebviewMessage: (callback: (msg: unknown) => void) => () => void
}

declare global {
  interface Window {
    api: WindowApi
  }
}
