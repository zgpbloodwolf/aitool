/**
 * Token 用量数据持久化模块 (UX-09)
 *
 * 功能：
 * - Channel 关闭时记录 token 用量到 token-usage.json
 * - 按天汇总结构（D-02），90 天自动清理（D-04）
 * - 写入队列机制防止并发写入损坏（RESEARCH Pitfall 4）
 * - 提供聚合查询接口供 IPC handler 调用
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

// --- 数据结构定义 (D-02) ---

/** 单次会话记录 */
interface SessionRecord {
  id: string // channel ID
  cwd: string // 工作目录路径
  inputTokens: number
  outputTokens: number
  timestamp: number // 会话结束时间戳
}

/** 按天汇总记录 */
interface DayRecord {
  date: string // 'YYYY-MM-DD' 格式
  sessions: SessionRecord[]
}

/** JSON 文件顶层结构 */
interface TokenUsageData {
  days: DayRecord[]
}

/** 聚合统计结果 — 返回给渲染进程的数据结构 */
interface TokenUsageStats {
  totalInputTokens: number
  totalOutputTokens: number
  totalSessions: number
  days: { date: string; inputTokens: number; outputTokens: number }[]
  workspaces: { cwd: string; inputTokens: number; outputTokens: number; sessions: number }[]
}

// --- 常量定义 ---

/** JSON 数据文件路径 — 存储在 userData 目录 */
const DATA_FILE = join(app.getPath('userData'), 'token-usage.json')

/** D-04: 历史数据保留天数上限 */
const MAX_DAYS = 90

// --- 写入队列机制 (RESEARCH Pitfall 4) ---

/** 模块级写入队列 — 确保同一时间只有一个写操作 */
let writeQueue: Promise<void> = Promise.resolve()

/**
 * 串行化写入函数 — 将写操作加入 Promise 队列
 * 防止多个 channel 同时关闭时并发写入导致 JSON 文件损坏
 */
function serializeWrite(fn: () => void): void {
  writeQueue = writeQueue.then(() => {
    try {
      fn()
    } catch (e) {
      console.error('[TokenUsage] 写入失败:', e)
    }
  })
}

// --- 数据读写 ---

/**
 * 从 JSON 文件加载 token 用量数据
 * 文件不存在或损坏时返回默认空结构
 */
function loadData(): TokenUsageData {
  try {
    if (existsSync(DATA_FILE)) {
      return JSON.parse(readFileSync(DATA_FILE, 'utf-8'))
    }
  } catch {
    // 文件损坏或格式错误，返回默认值
  }
  return { days: [] }
}

/**
 * 保存 token 用量数据到 JSON 文件
 * 通过写入队列确保串行写入
 */
function saveData(data: TokenUsageData): void {
  serializeWrite(() => {
    writeFileSync(DATA_FILE, JSON.stringify(data), 'utf-8')
  })
}

// --- 公开 API ---

/**
 * 记录一次会话的 token 用量
 * 在 Channel 关闭时调用 (D-03)
 *
 * @param session - 会话记录，包含 id/cwd/inputTokens/outputTokens/timestamp
 */
function recordTokenUsage(session: SessionRecord): void {
  // 获取当天日期字符串
  const today = new Date().toISOString().slice(0, 10)

  // 加载现有数据
  const data = loadData()

  // 找到或创建当天的 DayRecord
  let dayRecord = data.days.find((d) => d.date === today)
  if (!dayRecord) {
    dayRecord = { date: today, sessions: [] }
    data.days.push(dayRecord)
  }

  // 将本次会话记录追加到当天
  dayRecord.sessions.push(session)

  // D-04: 清理超过 MAX_DAYS 的旧数据
  if (data.days.length > MAX_DAYS) {
    data.days = data.days.slice(-MAX_DAYS)
  }

  // 保存数据
  saveData(data)
}

/**
 * 获取指定时间范围的 token 用量聚合统计
 *
 * @param range - 时间范围: 'today' | 'week' | 'month' | 'all'
 * @returns 聚合统计数据，包含按天和按工作区分组的统计
 */
function getTokenUsageStats(range: string): TokenUsageStats {
  // T-07-01: 验证 range 参数为合法枚举值
  const validRanges = ['today', 'week', 'month', 'all']
  if (!validRanges.includes(range)) {
    range = 'week' // 非法值降级为 'week'
  }

  const data = loadData()
  const now = new Date()

  // 根据 range 计算日期范围
  const filteredDays = data.days.filter((day) => {
    if (range === 'all') return true

    const dayDate = new Date(day.date)
    let startDate: Date

    switch (range) {
      case 'today':
        return day.date === now.toISOString().slice(0, 10)
      case 'week':
        startDate = new Date(now)
        startDate.setDate(startDate.getDate() - 7)
        return dayDate >= startDate
      case 'month':
        startDate = new Date(now)
        startDate.setDate(startDate.getDate() - 30)
        return dayDate >= startDate
      default:
        return true
    }
  })

  // 按天聚合
  const days = filteredDays.map((day) => ({
    date: day.date,
    inputTokens: day.sessions.reduce((sum, s) => sum + s.inputTokens, 0),
    outputTokens: day.sessions.reduce((sum, s) => sum + s.outputTokens, 0)
  }))

  // 按工作区 (cwd) 分组聚合
  const workspaceMap = new Map<string, { inputTokens: number; outputTokens: number; sessions: number }>()

  for (const day of filteredDays) {
    for (const session of day.sessions) {
      const existing = workspaceMap.get(session.cwd)
      if (existing) {
        existing.inputTokens += session.inputTokens
        existing.outputTokens += session.outputTokens
        existing.sessions += 1
      } else {
        workspaceMap.set(session.cwd, {
          inputTokens: session.inputTokens,
          outputTokens: session.outputTokens,
          sessions: 1
        })
      }
    }
  }

  const workspaces = Array.from(workspaceMap.entries()).map(([cwd, stats]) => ({
    cwd,
    ...stats
  }))

  // 计算汇总
  const totalInputTokens = days.reduce((sum, d) => sum + d.inputTokens, 0)
  const totalOutputTokens = days.reduce((sum, d) => sum + d.outputTokens, 0)
  const totalSessions = filteredDays.reduce((sum, d) => sum + d.sessions.length, 0)

  return {
    totalInputTokens,
    totalOutputTokens,
    totalSessions,
    days,
    workspaces
  }
}

export { recordTokenUsage, getTokenUsageStats }
export type { TokenUsageStats, DayRecord, SessionRecord }
