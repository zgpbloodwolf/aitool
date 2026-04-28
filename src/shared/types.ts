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

/** 分支元数据 (UX-12) */
export interface BranchMeta {
  id: string
  parentSessionId: string
  branchPointIndex: number
  channelId: string
  label: string
  createdAt: number
  parentTabId?: string
}

/** 分支存储数据结构 */
export interface BranchesData {
  branches: Record<string, BranchMeta>
  sessionBranchCount: Record<string, number>
}
