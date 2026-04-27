/**
 * Token 用量数据获取 composable
 * 通过 IPC 获取主进程中的 token 用量统计数据
 */
import { ref, type Ref } from 'vue'

interface DailyUsage {
  date: string
  inputTokens: number
  outputTokens: number
}

interface WorkspaceUsage {
  cwd: string
  inputTokens: number
  outputTokens: number
  sessions: number
}

interface TokenStats {
  totalInputTokens: number
  totalOutputTokens: number
  totalSessions: number
  days: DailyUsage[]
  workspaces: WorkspaceUsage[]
}

type TimeRange = 'today' | 'week' | 'month'

export function useTokenUsage(): {
  stats: Ref<TokenStats | null>
  loading: Ref<boolean>
  selectedRange: Ref<TimeRange>
  selectedWorkspace: Ref<string | null>
  fetchStats: (range?: TimeRange) => Promise<void>
} {
  const stats = ref<TokenStats | null>(null)
  const loading = ref(false)
  const selectedRange = ref<TimeRange>('week')
  const selectedWorkspace = ref<string | null>(null)

  async function fetchStats(range?: TimeRange): Promise<void> {
    if (range) selectedRange.value = range
    loading.value = true
    try {
      const result = await window.api.getTokenUsageStats(selectedRange.value)
      stats.value = result as TokenStats
    } catch (e) {
      console.error('[TokenUsage] 获取统计数据失败:', e)
      stats.value = null
    } finally {
      loading.value = false
    }
  }

  return { stats, loading, selectedRange, selectedWorkspace, fetchStats }
}
