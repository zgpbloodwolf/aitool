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
