/**
 * Token 用量数据 IPC handlers (UX-09)
 *
 * 注册 IPC 通道供渲染进程查询 token 用量统计数据
 */

import { ipcMain } from 'electron'
import { getTokenUsageStats } from '../claude/token-usage-store'

/**
 * 注册 Token 用量相关 IPC 处理器
 * - token-usage:get-stats: 获取指定时间范围的 token 用量统计
 */
export function registerTokenUsageHandlers(): void {
  ipcMain.handle('token-usage:get-stats', async (_event, range: string) => {
    // T-07-01: range 参数验证在 getTokenUsageStats 内部完成
    // 非法值降级为 'week'
    return getTokenUsageStats(range || 'week')
  })
}
