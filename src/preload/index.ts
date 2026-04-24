import { contextBridge, ipcRenderer } from 'electron'
import type { ExtensionInfo, SessionInfo } from '../shared/types'

const api = {
  // App
  getAppVersion: (): string => ipcRenderer.sendSync('app:version'),

  // Workspace
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:selectFolder'),
  readDir: (dirPath: string): Promise<string[]> => ipcRenderer.invoke('fs:readDir', dirPath),
  readFile: (filePath: string): Promise<string> => ipcRenderer.invoke('fs:readFile', filePath),
  stat: (filePath: string): Promise<{ isFile: boolean; isDirectory: boolean; size: number }> =>
    ipcRenderer.invoke('fs:stat', filePath),

  // Extension Host
  getInstalledExtensions: (): Promise<ExtensionInfo[]> => ipcRenderer.invoke('ext:getInstalled'),
  activateExtension: (extensionId: string): Promise<void> =>
    ipcRenderer.invoke('ext:activate', extensionId),

  // Claude Code
  claudeStart: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('claude:start'),
  claudeSend: (text: string): void => ipcRenderer.send('claude:send', text),
  claudeStop: (): void => ipcRenderer.send('claude:stop'),
  claudeSetCwd: (cwd: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('claude:set-cwd', cwd),
  claudeGetExtensionPath: (): Promise<string | null> =>
    ipcRenderer.invoke('claude:get-extension-path'),
  claudeStartWebviewServer: (extensionPath: string): Promise<number> =>
    ipcRenderer.invoke('claude:start-webview-server', extensionPath),
  claudeListSessions: (): Promise<SessionInfo[]> =>
    ipcRenderer.invoke('claude:list-sessions'),
  claudeGetModel: (): Promise<string> =>
    ipcRenderer.invoke('claude:get-model'),
  claudeResumeSession: (channelId: string | null, sessionId: string): Promise<{ success: boolean; error?: string; channelId?: string }> =>
    ipcRenderer.invoke('claude:resume-session', channelId, sessionId),
  claudeWebviewFromWebview: (msg: unknown): void =>
    ipcRenderer.send('claude-webview:from-webview', msg),
  onClaudeMessage: (callback: (msg: unknown) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, msg: unknown): void => callback(msg)
    ipcRenderer.on('claude:message', handler)
    return () => ipcRenderer.removeListener('claude:message', handler)
  },
  onClaudeError: (callback: (err: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, err: string): void => callback(err)
    ipcRenderer.on('claude:error', handler)
    return () => ipcRenderer.removeListener('claude:error', handler)
  },
  onClaudeExit: (callback: (code: number | null) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, code: number | null): void => callback(code)
    ipcRenderer.on('claude:exit', handler)
    return () => ipcRenderer.removeListener('claude:exit', handler)
  },
  onClaudeWebviewMessage: (callback: (msg: unknown) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, msg: unknown): void => callback(msg)
    ipcRenderer.on('claude-webview:to-webview', handler)
    return () => ipcRenderer.removeListener('claude-webview:to-webview', handler)
  }
}

export type { ExtensionInfo, SessionInfo }

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}
