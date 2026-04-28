<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  type ChartData,
  type ChartOptions
} from 'chart.js'
import { Bar } from 'vue-chartjs'
import { useTokenUsage } from '../composables/useTokenUsage'

// Tree-shaking: 只注册柱状图需要的组件
ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

const { stats, loading, selectedRange, fetchStats } = useTokenUsage()

// 时间范围选项
const rangeOptions: { value: string; label: string }[] = [
  { value: 'today', label: '今日' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' }
]

// 展开的工作区
const expandedWorkspace = ref<string | null>(null)

// 获取 CSS 变量实际值 -- Canvas 不支持 CSS 变量 (RESEARCH Pitfall 5)
function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

// 柱状图数据
const chartData = computed<ChartData<'bar'>>(() => {
  if (!stats.value) return { labels: [], datasets: [] }

  const days = stats.value.days
  const accentColor = getCSSVar('--accent') || '#89b4fa'
  const accentColorAlt = getCSSVar('--text-muted') || '#a6adc8'

  return {
    labels: days.map((d) => d.date.slice(5)), // MM-DD
    datasets: [
      {
        label: '输入 Token',
        backgroundColor: accentColor,
        data: days.map((d) => d.inputTokens)
      },
      {
        label: '输出 Token',
        backgroundColor: accentColorAlt,
        data: days.map((d) => d.outputTokens)
      }
    ]
  }
})

// 展开工作区的柱状图数据
const workspaceChartData = computed<ChartData<'bar'>>(() => {
  if (!stats.value || !expandedWorkspace.value) return { labels: [], datasets: [] }

  // 从 days 数据中筛选该工作区的 sessions -- 这里用主数据的 days 作为替代
  // 实际上后端返回的是全局 days，工作区详情需要更细粒度数据
  // 当前方案：使用全局 days 数据作为工作区趋势的近似展示
  const days = stats.value.days
  const accentColor = getCSSVar('--accent') || '#89b4fa'

  return {
    labels: days.map((d) => d.date.slice(5)),
    datasets: [
      {
        label: 'Token 用量',
        backgroundColor: accentColor,
        data: days.map((d) => d.inputTokens + d.outputTokens)
      }
    ]
  }
})

// Chart.js 配置
const chartOptions = computed<ChartOptions<'bar'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: getCSSVar('--text-secondary') || '#bac2de',
        font: { size: 11 }
      }
    },
    tooltip: {
      mode: 'index',
      intersect: false
    }
  },
  scales: {
    x: {
      ticks: { color: getCSSVar('--text-muted') || '#a6adc8' },
      grid: { color: getCSSVar('--border') || '#313244' }
    },
    y: {
      beginAtZero: true,
      ticks: { color: getCSSVar('--text-muted') || '#a6adc8' },
      grid: { color: getCSSVar('--border') || '#313244' }
    }
  }
}))

// 格式化 token 数量（K/M）
function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

// 获取工作区显示名（取最后一级目录名）
function workspaceName(cwd: string): string {
  const parts = cwd.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || cwd
}

// 切换工作区展开
function toggleWorkspace(cwd: string): void {
  expandedWorkspace.value = expandedWorkspace.value === cwd ? null : cwd
}

// 初始加载
onMounted(() => {
  fetchStats()
})
</script>

<template>
  <div class="token-usage-panel">
    <!-- 时间范围选择器 -->
    <div class="range-selector">
      <button
        v-for="opt in rangeOptions"
        :key="opt.value"
        :class="['range-btn', { active: selectedRange === opt.value }]"
        @click="fetchStats(opt.value as any)"
      >
        {{ opt.label }}
      </button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">加载中...</div>

    <!-- 无数据状态 -->
    <div v-else-if="!stats || stats.totalSessions === 0" class="empty-state">
      暂无用量数据
    </div>

    <!-- 数据展示 -->
    <template v-else>
      <!-- 汇总卡片 -->
      <div class="summary-cards">
        <div class="summary-card">
          <span class="summary-label">输入 Token</span>
          <span class="summary-value">{{ formatTokens(stats.totalInputTokens) }}</span>
        </div>
        <div class="summary-card">
          <span class="summary-label">输出 Token</span>
          <span class="summary-value">{{ formatTokens(stats.totalOutputTokens) }}</span>
        </div>
        <div class="summary-card">
          <span class="summary-label">会话数</span>
          <span class="summary-value">{{ stats.totalSessions }}</span>
        </div>
      </div>

      <!-- 每日趋势柱状图 (D-06) -->
      <div class="chart-container">
        <Bar :data="chartData" :options="chartOptions" />
      </div>

      <!-- 工作区分组统计 (D-08) -->
      <div v-if="stats.workspaces.length > 0" class="workspace-list">
        <h4 class="workspace-title">按工作区</h4>
        <div
          v-for="ws in stats.workspaces"
          :key="ws.cwd"
          class="workspace-item"
          @click="toggleWorkspace(ws.cwd)"
        >
          <div class="workspace-row">
            <span class="ws-name">{{ workspaceName(ws.cwd) }}</span>
            <span class="ws-tokens">{{ formatTokens(ws.inputTokens + ws.outputTokens) }}</span>
          </div>
          <!-- 展开的工作区趋势图 -->
          <div v-if="expandedWorkspace === ws.cwd" class="workspace-chart">
            <Bar :data="workspaceChartData" :options="chartOptions" />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.token-usage-panel {
  padding: 4px 0;
}

.range-selector {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
}

.range-btn {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid var(--border);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
}

.range-btn.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.loading-state,
.empty-state {
  text-align: center;
  color: var(--text-muted);
  padding: 20px 0;
  font-size: 13px;
}

.summary-cards {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}

.summary-card {
  background: var(--bg-tertiary);
  border-radius: 6px;
  padding: 8px;
  text-align: center;
}

.summary-label {
  display: block;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.summary-value {
  display: block;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.chart-container {
  height: 200px;
  margin-bottom: 12px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  padding: 8px;
}

.workspace-title {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0 0 6px 0;
  font-weight: 400;
}

.workspace-list {
  border-top: 1px solid var(--border);
  padding-top: 8px;
}

.workspace-item {
  cursor: pointer;
  padding: 4px 0;
}

.workspace-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.ws-name {
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

.ws-tokens {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

.workspace-chart {
  height: 150px;
  margin-top: 6px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  padding: 6px;
}
</style>
