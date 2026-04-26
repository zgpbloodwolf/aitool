export interface ExtensionInfo {
  id: string
  name: string
  version: string
  description: string
  publisher: string
  extensionPath: string
  iconPath?: string
}

export interface SessionInfo {
  id: string
  lastModified: number
  fileSize: number
  summary: string | undefined
  gitBranch: string | undefined
}

/** 对话导出结果 (UX-07) */
export interface ExportSessionResult {
  success: boolean
  error?: string
}
