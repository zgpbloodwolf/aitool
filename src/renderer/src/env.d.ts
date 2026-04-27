/// <reference types="vite/client" />

export {}

interface WindowApi {
  getAppVersion: () => string
  selectFolder: () => Promise<string | null>
  readDir: (dirPath: string) => Promise<{ name: string; isDirectory: boolean; isFile: boolean }[]>
  readFile: (filePath: string) => Promise<string>
  stat: (filePath: string) => Promise<{ isFile: boolean; isDirectory: boolean; size: number }>
  startFileWatch: (projectId: string, dirPath: string) => Promise<boolean>
  stopFileWatch: (projectId: string) => Promise<boolean>
  onFileChanged: (projectId: string, callback: () => void) => () => void
  getInstalledExtensions: () => Promise<Array<{
    id: string
    name: string
    version: string
    description: string
    publisher: string
    extensionPath: string
    iconPath?: string
  }>>
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
  }>>
  claudeGetModel: () => Promise<string>
  claudeDeleteSession: (sessionId: string) => Promise<boolean>
  claudeGetContextUsage: () => Promise<Record<string, { inputTokens: number; outputTokens: number }>>
  claudeResumeSession: (channelId: string | null, sessionId: string) => Promise<{ success: boolean; error?: string; channelId?: string }>
  claudeRecoverProcess: (channelId: string) => Promise<{ success: boolean; channelId?: string; error?: string }>
  claudeStartWebviewServer: (extensionPath: string) => Promise<number>
  claudeWebviewFromWebview: (msg: unknown) => void
  getActiveSessionId: (channelId: string) => Promise<string | null>
  showSaveDialog: (options: { defaultPath: string; title: string }) => Promise<{
    canceled: boolean
    filePath: string
  }>
  exportSession: (sessionId: string, title: string, savePath: string) => Promise<{
    success: boolean
    error?: string
  }>
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
  onProcessCrashed: (callback: (data: { channelId: string; canRecover: boolean }) => void) => () => void
  onProcessUnresponsive: (callback: (data: { channelId: string }) => void) => () => void
  onShortcut: (callback: (action: string) => void) => () => void
  updateCloseBehavior: (behavior: 'minimize' | 'quit' | 'ask') => void
  onCloseBehaviorChanged: (callback: (behavior: string) => void) => () => void
  notificationAction: (notificationId: string, action: string, replyText?: string) => void
  onNotificationFocusTab: (callback: (channelId: string) => void) => () => void
  onNotificationPlaySound: (callback: (type: string) => void) => () => void
  onThemeSystemChanged: (callback: (resolvedTheme: 'dark' | 'light') => void) => () => void
  updateTheme: (mode: 'dark' | 'light' | 'system', resolved?: 'dark' | 'light') => void
  send: (channel: string, ...args: unknown[]) => void
  setZoomFactor: (factor: number) => void
  updaterCheck: () => Promise<{ version: string | null; error?: string }>
  updaterDownload: () => void
  updaterInstall: () => void
  onUpdaterAvailable: (
    callback: (info: {
      version: string
      releaseNotes?: string | Array<{ version: string; note: string }>
    }) => void
  ) => () => void
  onUpdaterProgress: (
    callback: (data: { percent: number; bytesPerSecond: number }) => void
  ) => () => void
  onUpdaterDownloaded: (callback: () => void) => () => void
  onUpdaterError: (callback: (data: { message: string }) => void) => () => void
}

declare global {
  interface Window {
    api: WindowApi
  }
}
