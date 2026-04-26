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

  // 文件监听（多项目支持）
  startFileWatch: (projectId: string, dirPath: string): Promise<boolean> =>
    ipcRenderer.invoke('fs:startWatch', projectId, dirPath),
  stopFileWatch: (projectId: string): Promise<boolean> =>
    ipcRenderer.invoke('fs:stopWatch', projectId),
  onFileChanged: (projectId: string, callback: () => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, changedProjectId: string): void => {
      if (changedProjectId === projectId) callback()
    }
    ipcRenderer.on('fs:changed', handler)
    return () => ipcRenderer.removeListener('fs:changed', handler)
  },

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
  claudeListSessions: (): Promise<SessionInfo[]> => ipcRenderer.invoke('claude:list-sessions'),
  claudeGetModel: (): Promise<string> => ipcRenderer.invoke('claude:get-model'),
  claudeDeleteSession: (sessionId: string): Promise<boolean> =>
    ipcRenderer.invoke('claude:delete-session', sessionId),
  claudeGetContextUsage: (): Promise<
    Record<string, { inputTokens: number; outputTokens: number }>
  > => ipcRenderer.invoke('claude:get-context-usage'),
  claudeResumeSession: (
    channelId: string | null,
    sessionId: string
  ): Promise<{ success: boolean; error?: string; channelId?: string }> =>
    ipcRenderer.invoke('claude:resume-session', channelId, sessionId),
  // D-10: 进程恢复 — 崩溃后恢复已退出的 channel
  claudeRecoverProcess: (
    channelId: string
  ): Promise<{ success: boolean; channelId?: string; error?: string }> =>
    ipcRenderer.invoke('claude:recover-process', channelId),
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
  },
  // D-10: 进程崩溃事件 — 通知渲染进程 claude.exe 已崩溃
  onProcessCrashed: (
    callback: (data: { channelId: string; canRecover: boolean }) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { channelId: string; canRecover: boolean }
    ): void => callback(data)
    ipcRenderer.on('claude:process-crashed', handler)
    return () => ipcRenderer.removeListener('claude:process-crashed', handler)
  },
  // D-11: 进程无响应事件 — 通知渲染进程 claude.exe 挂死
  onProcessUnresponsive: (callback: (data: { channelId: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { channelId: string }): void =>
      callback(data)
    ipcRenderer.on('claude:process-unresponsive', handler)
    return () => ipcRenderer.removeListener('claude:process-unresponsive', handler)
  },
  // D-05: 快捷键 IPC — 主进程拦截后转发到渲染进程
  onShortcut: (callback: (action: string) => void): (() => void) => {
    const channels = [
      'shortcut:new-tab', 'shortcut:close-tab', 'shortcut:toggle-sidebar',
      'shortcut:next-tab', 'shortcut:prev-tab', 'shortcut:open-settings',
      'shortcut:reset-zoom'
    ]
    const unsubscribers = channels.map((ch) => {
      const fn = (): void => callback(ch.replace('shortcut:', ''))
      ipcRenderer.on(ch, fn)
      return () => ipcRenderer.removeListener(ch, fn)
    })
    return () => unsubscribers.forEach((u) => u())
  },
  // D-11: 关闭行为 IPC — 设置面板同步关闭行为偏好到主进程
  updateCloseBehavior: (behavior: 'minimize' | 'quit' | 'ask'): void =>
    ipcRenderer.send('settings:update-close-behavior', behavior),
  onCloseBehaviorChanged: (callback: (behavior: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, behavior: string): void =>
      callback(behavior)
    ipcRenderer.on('settings:close-behavior-changed', handler)
    return () => ipcRenderer.removeListener('settings:close-behavior-changed', handler)
  },

  // 通知系统 IPC
  notificationAction: (notificationId: string, action: string, replyText?: string): void =>
    ipcRenderer.send('notification:action', { notificationId, action, replyText }),
  onNotificationFocusTab: (callback: (channelId: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, channelId: string): void =>
      callback(channelId)
    ipcRenderer.on('notification:focus-tab', handler)
    return () => ipcRenderer.removeListener('notification:focus-tab', handler)
  },
  onNotificationPlaySound: (callback: (type: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, type: string): void =>
      callback(type)
    ipcRenderer.on('notification:play-sound', handler)
    return () => ipcRenderer.removeListener('notification:play-sound', handler)
  },

  // 主题 IPC — 主进程系统主题变化通知渲染进程 (05-01)
  onThemeSystemChanged: (callback: (resolvedTheme: 'dark' | 'light') => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, theme: string): void =>
      callback(theme as 'dark' | 'light')
    ipcRenderer.on('theme:system-changed', handler)
    return () => ipcRenderer.removeListener('theme:system-changed', handler)
  },
  // 主题 IPC — 渲染进程通知主进程主题变更 (05-01)
  updateTheme: (mode: 'dark' | 'light' | 'system', resolved?: 'dark' | 'light'): void =>
    ipcRenderer.send('theme:update', mode, resolved),

  // 标签激活通知 — 用户切换标签时关闭对应对话的通知
  send: (channel: string, ...args: unknown[]): void => ipcRenderer.send(channel, ...args),

  // 缩放 IPC — 渲染进程通过 preload 调用 webFrame
  setZoomFactor: (factor: number): void => {
    const { webFrame } = require('electron')
    webFrame.setZoomFactor(factor)
  },

  // 自动更新 IPC
  updaterCheck: (): Promise<{ version: string | null; error?: string }> =>
    ipcRenderer.invoke('updater:check'),
  updaterDownload: (): void => ipcRenderer.send('updater:download'),
  updaterInstall: (): void => ipcRenderer.send('updater:install'),
  onUpdaterAvailable: (
    callback: (info: { version: string; releaseNotes?: unknown }) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      info: { version: string; releaseNotes?: unknown }
    ): void => callback(info)
    ipcRenderer.on('updater:available', handler)
    return () => ipcRenderer.removeListener('updater:available', handler)
  },
  onUpdaterProgress: (
    callback: (data: { percent: number; bytesPerSecond: number }) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { percent: number; bytesPerSecond: number }
    ): void => callback(data)
    ipcRenderer.on('updater:progress', handler)
    return () => ipcRenderer.removeListener('updater:progress', handler)
  },
  onUpdaterDownloaded: (callback: () => void): (() => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('updater:downloaded', handler)
    return () => ipcRenderer.removeListener('updater:downloaded', handler)
  },
  onUpdaterError: (callback: (data: { message: string }) => void): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { message: string }
    ): void => callback(data)
    ipcRenderer.on('updater:error', handler)
    return () => ipcRenderer.removeListener('updater:error', handler)
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
