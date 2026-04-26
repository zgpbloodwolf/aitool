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
      updateCloseBehavior: (behavior: 'minimize' | 'quit' | 'ask') => void
      onCloseBehaviorChanged: (callback: (behavior: string) => void) => () => void
      notificationAction: (notificationId: string, action: string, replyText?: string) => void
      onNotificationFocusTab: (callback: (channelId: string) => void) => () => void
      onNotificationPlaySound: (callback: (type: string) => void) => () => void
      send: (channel: string, ...args: unknown[]) => void
      setZoomFactor: (factor: number) => void
      updaterCheck: () => Promise<{ version: string | null; error?: string }>
      updaterDownload: () => void
      updaterInstall: () => void
      onUpdaterAvailable: (
        callback: (info: { version: string; releaseNotes?: unknown }) => void
      ) => () => void
      onUpdaterProgress: (
        callback: (data: { percent: number; bytesPerSecond: number }) => void
      ) => () => void
      onUpdaterDownloaded: (callback: () => void) => () => void
      onUpdaterError: (callback: (data: { message: string }) => void) => () => void
      // 对话导出 (UX-07)
      showSaveDialog: (
        options: { defaultPath: string; title: string }
      ) => Promise<{ canceled: boolean; filePath: string }>
      getActiveSessionId: (channelId: string) => Promise<string | null>
      exportSession: (
        sessionId: string,
        title: string,
        savePath: string
      ) => Promise<{ success: boolean; error?: string }>
    }
  }
}
