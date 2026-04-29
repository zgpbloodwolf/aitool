/**
 * 分支元数据持久化模块 (UX-12)
 *
 * 功能：
 * - 分支创建/删除/重命名时的元数据持久化
 * - 每会话最大分支数限制（10）
 * - Promise chain 写入队列防止并发写入损坏
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { BranchMeta, BranchesData } from '../../shared/types'
import { safeLog, safeError } from './logger'

const BRANCHES_FILE = join(app.getPath('userData'), 'branches.json')
const MAX_BRANCHES_PER_SESSION = 10

let data: BranchesData = { branches: {}, sessionBranchCount: {} }

// Promise chain 写入队列
let writeChain: Promise<void> = Promise.resolve()

/** 加载分支数据 */
export function loadBranchData(): BranchesData {
  try {
    if (existsSync(BRANCHES_FILE)) {
      const raw = readFileSync(BRANCHES_FILE, 'utf-8')
      data = JSON.parse(raw)
      if (!data.branches) data.branches = {}
      if (!data.sessionBranchCount) data.sessionBranchCount = {}
    }
  } catch (err) {
    safeError('[BranchStore] 加载分支数据失败:', err)
    data = { branches: {}, sessionBranchCount: {} }
  }
  return data
}

/** 异步保存分支数据（Promise chain 队列写入） */
function saveBranchData(): Promise<void> {
  writeChain = writeChain.then(() => {
    try {
      writeFileSync(BRANCHES_FILE, JSON.stringify(data, null, 2), 'utf-8')
    } catch (err) {
      safeError('[BranchStore] 保存分支数据失败:', err)
    }
  })
  return writeChain
}

/** 检查会话是否还能创建新分支 */
export function canCreateBranch(parentSessionId: string): boolean {
  loadBranchData()
  const count = data.sessionBranchCount[parentSessionId] || 0
  return count < MAX_BRANCHES_PER_SESSION
}

/** 获取会话的剩余分支配额 */
export function getRemainingQuota(parentSessionId: string): number {
  loadBranchData()
  const count = data.sessionBranchCount[parentSessionId] || 0
  return MAX_BRANCHES_PER_SESSION - count
}

/** 保存分支元数据 */
export function saveBranch(branch: BranchMeta): void {
  loadBranchData()
  data.branches[branch.id] = branch
  data.sessionBranchCount[branch.parentSessionId] =
    (data.sessionBranchCount[branch.parentSessionId] || 0) + 1
  saveBranchData()
  safeLog('[BranchStore] 已保存分支:', branch.id, '标签:', branch.label)
}

/** 获取父会话的所有分支 */
export function getBranchesByParent(parentSessionId: string): BranchMeta[] {
  loadBranchData()
  return Object.values(data.branches)
    .filter((b) => b.parentSessionId === parentSessionId)
    .sort((a, b) => a.branchPointIndex - b.branchPointIndex || a.createdAt - b.createdAt)
}

/** 获取分支点相同的所有分支 */
export function getBranchesAtPoint(
  parentSessionId: string,
  branchPointIndex: number
): BranchMeta[] {
  loadBranchData()
  return Object.values(data.branches).filter(
    (b) => b.parentSessionId === parentSessionId && b.branchPointIndex === branchPointIndex
  )
}

/** 获取指定频道 ID 对应的分支 */
export function getBranchByChannelId(channelId: string): BranchMeta | undefined {
  loadBranchData()
  return Object.values(data.branches).find((b) => b.channelId === channelId)
}

/** 重命名分支 */
export function renameBranch(branchId: string, newLabel: string): boolean {
  loadBranchData()
  const branch = data.branches[branchId]
  if (!branch) return false
  branch.label = newLabel
  saveBranchData()
  safeLog('[BranchStore] 已重命名分支:', branchId, '新标签:', newLabel)
  return true
}

/** 删除分支元数据 */
export function deleteBranch(branchId: string): boolean {
  loadBranchData()
  const branch = data.branches[branchId]
  if (!branch) return false
  delete data.branches[branchId]
  const count = data.sessionBranchCount[branch.parentSessionId] || 0
  if (count > 0) {
    data.sessionBranchCount[branch.parentSessionId] = count - 1
  }
  saveBranchData()
  safeLog('[BranchStore] 已删除分支:', branchId)
  return true
}

/** 获取下一个分支编号 */
export function getNextBranchNumber(parentSessionId: string): number {
  loadBranchData()
  const branches = getBranchesByParent(parentSessionId)
  return branches.length + 1
}
