/**
 * 分支管理模块 (UX-12)
 *
 * 功能：
 * - 创建分支（重放父会话消息到新频道）
 * - 查询/重命名/删除分支
 * - 每会话最大分支数限制（10）
 */

import type { BranchMeta } from '../../shared/types'
import {
  canCreateBranch, saveBranch, getBranchesByParent,
  getBranchesAtPoint, getBranchByChannelId,
  renameBranch as renameBranchInStore, getNextBranchNumber,
  getRemainingQuota, deleteBranch as deleteBranchInStore
} from './branch-store'
import { getSessionMessages } from './session-store'
import { safeLog, safeError } from './logger'

export interface BranchCreateResult {
  success: boolean
  branch?: BranchMeta
  channelId?: string
  error?: string
}

export async function createBranch(
  parentSessionId: string,
  branchPointIndex: number,
  cwd: string,
  handleLaunchFn: (channelId: string, cwd: string, permMode: string, thinkingLevel: string, resumeSessionId?: string, persistent?: boolean) => Promise<void>,
  sendToWebviewFn: (msg: unknown, targetChannelId?: string) => void
): Promise<BranchCreateResult> {
  if (!canCreateBranch(parentSessionId)) {
    const remaining = getRemainingQuota(parentSessionId)
    return {
      success: false,
      error: `此会话已达到最大分支数量（10），请关闭旧分支后重试。剩余配额: ${remaining}`
    }
  }

  try {
    const allMessages = await getSessionMessages(parentSessionId, cwd)
    if (branchPointIndex >= allMessages.length) {
      return { success: false, error: '分支点索引超出消息范围' }
    }
    const branchMessages = allMessages.slice(0, branchPointIndex + 1)

    const channelId = `ch_${Date.now()}_${Math.random().toString(36).slice(2)}`

    await handleLaunchFn(channelId, cwd, 'default', '')

    for (const msg of branchMessages) {
      sendToWebviewFn({ type: 'io_message', channelId, message: msg }, channelId)
    }

    safeLog('[BranchManager] 已重放', branchMessages.length, '条消息到分支频道:', channelId)

    const branchNumber = getNextBranchNumber(parentSessionId)
    const branchId = `branch_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const branch: BranchMeta = {
      id: branchId,
      parentSessionId,
      branchPointIndex,
      channelId,
      label: `分支 #${branchNumber}`,
      createdAt: Date.now()
    }
    saveBranch(branch)

    safeLog('[BranchManager] 已创建分支:', branchId, '标签:', branch.label, '频道:', channelId)

    return { success: true, branch, channelId }
  } catch (err) {
    safeError('[BranchManager] 创建分支失败:', err)
    return { success: false, error: String(err) }
  }
}

export function listBranches(parentSessionId: string): BranchMeta[] {
  return getBranchesByParent(parentSessionId)
}

export function listBranchesAtPoint(parentSessionId: string, branchPointIndex: number): BranchMeta[] {
  return getBranchesAtPoint(parentSessionId, branchPointIndex)
}

export function renameBranch(branchId: string, newLabel: string): boolean {
  return renameBranchInStore(branchId, newLabel)
}

export function removeBranch(branchId: string): boolean {
  return deleteBranchInStore(branchId)
}

export function findBranchByChannel(channelId: string): BranchMeta | undefined {
  return getBranchByChannelId(channelId)
}
