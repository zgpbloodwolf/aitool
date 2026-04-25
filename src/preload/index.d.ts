import { ElectronAPI } from '@electron-toolkit/preload'
import type { ExtensionInfo, SessionInfo } from '../shared/types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      getAppVersion: () => string
      selectFolder: () => Promise<string | null>
      readDir: (dirPath: string) => Promise<string[]>
      readFile: (filePath: string) => Promise<string>
      stat: (filePath: string) => Promise<{ isFile: boolean; isDirectory: boolean; size: number }>
      startFileWatch: (projectId: string, dirPath: string) => Promise<boolean>
      stopFileWatch: (projectId: string) => Promise<boolean>
      onFileChanged: (projectId: string, callback: () => void) => () => void
      getInstalledExtensions: () => Promise<ExtensionInfo[]>
      activateExtension: (extensionId: string) => Promise<void>
      claudeStart: () => Promise<{ success: boolean; error?: string }>
      claudeSend: (text: string) => void
      claudeStop: () => void
      claudeSetCwd: (cwd: string) => Promise<{ success: boolean }>
      claudeGetExtensionPath: () => Promise<string | null>
      claudeStartWebviewServer: (extensionPath: string) => Promise<number>
      claudeListSessions: () => Promise<SessionInfo[]>
      claudeGetModel: () => Promise<string>
      claudeDeleteSession: (sessionId: string) => Promise<boolean>
      claudeGetContextUsage: () => Promise<
        Record<string, { inputTokens: number; outputTokens: number }>
      >
      claudeResumeSession: (
        channelId: string | null,
        sessionId: string
      ) => Promise<{ success: boolean; error?: string; channelId?: string }>
      claudeRecoverProcess: (
        channelId: string
      ) => Promise<{ success: boolean; channelId?: string; error?: string }>
      claudeWebviewFromWebview: (msg: unknown) => void
      onClaudeMessage: (callback: (msg: unknown) => void) => () => void
      onClaudeError: (callback: (err: string) => void) => () => void
      onClaudeExit: (callback: (code: number | null) => void) => () => void
      onClaudeWebviewMessage: (callback: (msg: unknown) => void) => () => void
      onProcessCrashed: (
        callback: (data: { channelId: string; canRecover: boolean }) => void
      ) => () => void
      onProcessUnresponsive: (callback: (data: { channelId: string }) => void) => () => void
      onShortcut: (callback: (action: string) => void) => () => void
    }
  }
}
