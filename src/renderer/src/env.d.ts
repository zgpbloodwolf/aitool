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
  claudeDownloadExtension: () => Promise<string | null>
  onDownloadProgress: (callback: (msg: string) => void) => () => void
  claudeWebviewFromWebview: (msg: unknown) => void
  onClaudeMessage: (callback: (msg: unknown) => void) => () => void
  onClaudeError: (callback: (err: string) => void) => () => void
  onClaudeExit: (callback: (code: number | null) => void) => () => void
  onClaudeWebviewMessage: (callback: (msg: unknown) => void) => () => void
  onProcessCrashed: (callback: (data: { channelId: string; canRecover: boolean }) => void) => () => void
  onProcessUnresponsive: (callback: (data: { channelId: string }) => void) => () => void
  onShortcut: (callback: (action: string) => void) => () => void
}

declare global {
  interface Window {
    api: WindowApi
  }
}
