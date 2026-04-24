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
      claudeResumeSession: (channelId: string | null, sessionId: string) => Promise<{ success: boolean; error?: string; channelId?: string }>
      claudeWebviewFromWebview: (msg: unknown) => void
      onClaudeMessage: (callback: (msg: unknown) => void) => (() => void)
      onClaudeError: (callback: (err: string) => void) => (() => void)
      onClaudeExit: (callback: (code: number | null) => void) => (() => void)
      onClaudeWebviewMessage: (callback: (msg: unknown) => void) => (() => void)
    }
  }
}
