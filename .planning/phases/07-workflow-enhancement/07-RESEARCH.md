# Phase 7: 工作流增强 - Research

**Researched:** 2026-04-26
**Domain:** Electron 桌面应用 -- Token 用量可视化 + Windows 系统集成
**Confidence:** HIGH

## Summary

Phase 7 包含两个相对独立的功能模块：(1) Token 用量统计面板，需要新增 JSON 持久化层、IPC 通道和 Chart.js 可视化组件；(2) Windows 右键菜单集成，需要 NSIS 安装脚本注册表操作和 Electron 单实例锁通信机制。两者不共享代码，可并行开发。

现有代码已具备关键基础设施：`claude-webview.ts` 中 Channel 对象已追踪 `totalInputTokens`/`totalOutputTokens`，`tray-manager.ts` 提供了 userData 目录 JSON 文件读写的参考模式（`close-behavior.json`），`SettingsDrawer.vue` 有成熟的分组布局可直接扩展。

**Primary recommendation:** Token 持久化复用 `close-behavior.json` 的 `readFileSync`/`writeFileSync` 模式；Chart.js 严格按 tree-shaking 方式注册仅需要的组件；NSIS 使用 `build/installer.nsh` 的 `customInstall`/`customUnInstall` 宏操作注册表；单实例通信使用 Electron 标准 `requestSingleInstanceLock` + `second-instance` 事件。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** JSON 文件持久化 Token 用量数据，存储在 userData 目录（如 `token-usage.json`）
- **D-02:** 按天汇总结构 `{ date, sessions: [{id, cwd, inputTokens, outputTokens, timestamp}] }`
- **D-03:** 写入时机为会话结束（channel 销毁/close 时），非每次 API 调用
- **D-04:** 历史数据保留 90 天，超过后自动清理
- **D-05:** 统计面板嵌入 SettingsDrawer.vue，新增 "用量统计" 分组
- **D-06:** 使用 Chart.js + vue-chartjs 绘制每日用量趋势柱状图
- **D-07:** 不实现预警线功能，仅展示数据
- **D-08:** 工作区分组统计以汇总卡片下方列表形式展示，每行显示工作区名 + token 用量，点击可展开查看该工作区趋势图
- **D-09:** NSIS 安装脚本 + 应用首次启动代码双重注册
- **D-10:** 右键菜单范围：文件夹右键 + 文件夹背景右键，不含驱动器右键
- **D-11:** 右键菜单项显示应用图标
- **D-12:** 使用 `app.requestSingleInstanceLock()` + `second-instance` 事件
- **D-13:** 已启动实例收到目录路径后，在当前窗口创建新标签页并切换
- **D-14:** 应用未启动时正常启动并打开该目录的标签页

### Claude's Discretion
- JSON 文件的具体字段命名和文件名
- Chart.js 柱状图的样式细节（颜色、间距、动画）
- 统计面板的布局细节（卡片排列、数字格式化）
- NSIS 安装脚本的具体注册表键名和值
- 右键菜单项的中文文案
- 工作区列表的排序方式

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UX-09 | Token 用量统计面板：今日/本周/本月汇总 + 每日趋势柱状图 + 按工作区分组 | Chart.js + vue-chartjs 柱状图组件，JSON 持久化层，IPC 数据通道 |
| UX-10 | Windows 右键菜单集成：文件夹右键 + 目录背景右键 + 单实例通信 | NSIS installer.nsh 注册表操作，requestSingleInstanceLock + second-instance 事件 |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Token 数据持久化 | API / Backend (主进程) | -- | 文件系统操作属于主进程职责，userData 目录 JSON 读写 |
| Token 数据聚合 | API / Backend (主进程) | -- | Channel token 累计值在主进程 claude-webview.ts 中维护 |
| 统计面板 UI | Browser / Client (渲染进程) | -- | Chart.js 渲染 + Vue 组件在渲染进程运行 |
| IPC 数据桥接 | Frontend Server (Preload) | -- | preload 层桥接主进程 token 数据到渲染进程 |
| 右键菜单注册 | API / Backend (NSIS + 主进程) | -- | 注册表操作在 NSIS 安装脚本和应用代码中执行 |
| 单实例通信 | API / Backend (主进程) | -- | requestSingleInstanceLock 和 second-instance 事件属于主进程 |
| 新标签页创建 | Browser / Client (渲染进程) | API / Backend (IPC) | 渲染进程管理标签页，主进程通过 IPC 通知 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| chart.js | 4.5.1 | Canvas 图表渲染引擎 | MIT 协议，轻量级，tree-shakable，与 vue-chartjs 官方适配 [VERIFIED: npm registry] |
| vue-chartjs | 5.3.3 | Chart.js 的 Vue 3 封装组件 | 官方维护，支持 Composition API + `<script setup>` [VERIFIED: npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (无额外依赖) | -- | -- | 右键菜单和单实例通信使用 Electron 内置 API |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Chart.js | ECharts | ECharts 功能更全但体积 ~800KB+，远超 Chart.js ~65KB (tree-shaken)，本项目只需简单柱状图 |
| Chart.js | D3.js | D3 偏底层，需要手动处理渲染逻辑，对于标准柱状图过度设计 |

**Installation:**
```bash
pnpm add chart.js vue-chartjs
```

**Version verification:**
- chart.js: 4.5.1 (verified via `npm view chart.js version`, 2026-04-26)
- vue-chartjs: 5.3.3 (verified via `npm view vue-chartjs version`, 2026-04-26)
- Both MIT licensed, commercially friendly [VERIFIED: npm registry]

## Architecture Patterns

### System Architecture Diagram

```
Token 用量统计面板数据流:

[claude.exe 进程]
     |
     | stream_event (usage.input_tokens/output_tokens)
     v
[claude-webview.ts] --- 累计 totalInputTokens/totalOutputTokens 到 Channel 对象
     |
     | handleCloseChannel() 触发
     v
[token-usage-store.ts] --- 新模块，聚合当天数据，写入 token-usage.json
     |                      90天自动清理
     |
     | IPC: token-usage:get-stats
     v
[preload/index.ts] --- 桥接 exposeInMainWorld('api', { getTokenUsageStats })
     |
     v
[TokenUsagePanel.vue] --- SettingsDrawer.vue 内新分组
     |
     | 使用 vue-chartjs <Bar> 组件
     v
[Chart.js Canvas] --- 渲染柱状图


Windows 右键菜单数据流:

[用户右键文件夹] --> [Windows Shell 读取注册表]
                         |
                         | HKCR\Directory\shell\ai-tools\command = "path\to\ai-tools.exe" "%V"
                         v
                    [启动 ai-tools.exe "%V"]
                         |
                         | app.requestSingleInstanceLock() 检查
                    +----+----+
                    |         |
              已有实例      首次启动
                    |         |
              second-instance  正常启动
              event            + 打开目录标签页
                    |
              [主进程 IPC 通知]
                    |
              [渲染进程创建新标签页 + 设置 cwd]


安装/卸载注册表操作:

[NSIS installer.nsh]
     |  customInstall 宏
     |  WriteRegStr HKCR\Directory\shell\ai-tools
     |  WriteRegStr HKCR\Directory\Background\shell\ai-tools
     v
[Windows Registry]

[主进程 index.ts]
     |  app.whenReady() 后检查注册表
     |  缺失则 reg.exe 补注册
     v
[Windows Registry] (双保险)
```

### Recommended Project Structure
```
src/
├── main/
│   ├── ipc/
│   │   ├── claude-webview.ts      # 修改: handleCloseChannel 中调用 token-usage-store 记录
│   │   └── token-usage.ts          # 新增: token 用量数据 IPC handlers
│   ├── claude/
│   │   └── token-usage-store.ts    # 新增: token-usage.json 读写、聚合、清理逻辑
│   └── index.ts                    # 修改: 添加 requestSingleInstanceLock + 注册表检查
├── renderer/src/
│   ├── components/
│   │   ├── SettingsDrawer.vue      # 修改: 新增 "用量统计" 分组
│   │   └── TokenUsagePanel.vue     # 新增: 统计面板子组件 (Chart.js 柱状图)
│   └── composables/
│       └── useTokenUsage.ts        # 新增: token 用量数据获取 composable
├── preload/
│   ├── index.ts                    # 修改: 新增 token-usage IPC 桥接
│   └── index.d.ts                  # 修改: 新增类型声明
build/
│   └── installer.nsh               # 新增: NSIS 注册表自定义脚本
```

### Pattern 1: userData JSON 文件持久化
**What:** 主进程使用 `app.getPath('userData')` 获取路径，直接 `readFileSync`/`writeFileSync` 操作 JSON 文件
**When to use:** 主进程需要持久化小型配置数据，不需要渲染进程 localStorage
**Example:**
```typescript
// Source: 项目代码 src/main/tray/tray-manager.ts (close-behavior.json 模式)
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

const DATA_FILE = join(app.getPath('userData'), 'token-usage.json')

function loadData(): TokenUsageData {
  try {
    if (existsSync(DATA_FILE)) {
      return JSON.parse(readFileSync(DATA_FILE, 'utf-8'))
    }
  } catch { /* 损坏则返回默认值 */ }
  return { days: [] }
}

function saveData(data: TokenUsageData): void {
  writeFileSync(DATA_FILE, JSON.stringify(data), 'utf-8')
}
```

### Pattern 2: vue-chartjs Composition API 柱状图
**What:** 使用 `<script setup>` + vue-chartjs Bar 组件，tree-shaking 注册必要的 Chart.js 组件
**When to use:** Vue 3 项目中创建响应式图表
**Example:**
```vue
<!-- Source: Context7 /apertureless/vue-chartjs docs -->
<script lang="ts" setup>
import { ref } from 'vue'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  ChartData
} from 'chart.js'
import { Bar } from 'vue-chartjs'

// Tree-shaking: 只注册柱状图需要的组件
ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

const data = ref<ChartData<'bar'>>({
  labels: ['1月', '2月', '3月'],
  datasets: [{
    label: 'Token 用量',
    backgroundColor: 'var(--accent)',  // 使用项目 CSS 变量
    data: [1000, 2000, 1500]
  }]
})

const options = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: { beginAtZero: true }
  }
}
</script>

<template>
  <div style="height: 200px;">
    <Bar :data="data" :options="options" />
  </div>
</template>
```

### Pattern 3: NSIS 自定义注册表脚本
**What:** 通过 `build/installer.nsh` 在安装/卸载时写入/清除注册表项
**When to use:** 需要在安装时注册 Windows Shell 集成（右键菜单、文件关联等）
**Example:**
```nsis
; Source: electron-builder 官方文档 https://www.electron.build/configuration/nsis
; 文件: build/installer.nsh

!macro customInstall
  ; 文件夹右键菜单
  WriteRegStr SHCTX "Software\Classes\Directory\shell\ai-tools" "" "使用 AI Tools 打开"
  WriteRegStr SHCTX "Software\Classes\Directory\shell\ai-tools" "Icon" "$INSTDIR\AI Tools.exe"
  WriteRegStr SHCTX "Software\Classes\Directory\shell\ai-tools\command" "" '"$INSTDIR\AI Tools.exe" "%V"'
  ; 目录背景右键菜单
  WriteRegStr SHCTX "Software\Classes\Directory\Background\shell\ai-tools" "" "使用 AI Tools 打开当前目录"
  WriteRegStr SHCTX "Software\Classes\Directory\Background\shell\ai-tools" "Icon" "$INSTDIR\AI Tools.exe"
  WriteRegStr SHCTX "Software\Classes\Directory\Background\shell\ai-tools\command" "" '"$INSTDIR\AI Tools.exe" "%V"'
!macroend

!macro customUnInstall
  DeleteRegKey SHCTX "Software\Classes\Directory\shell\ai-tools"
  DeleteRegKey SHCTX "Software\Classes\Directory\Background\shell\ai-tools"
!macroend
```

### Pattern 4: Electron 单实例锁 + 命令行参数
**What:** 使用 `requestSingleInstanceLock` 确保只有一个实例运行，通过 `second-instance` 事件传递命令行参数
**When to use:** 需要从外部（如右键菜单）传递参数到已运行的应用实例
**Example:**
```typescript
// Source: Context7 /electron/electron docs -- app.md
import { app, BrowserWindow } from 'electron'

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (event, argv, workingDirectory) => {
    // argv 包含第二个实例的命令行参数
    // 右键菜单传入格式: ai-tools.exe "D:\some\directory"
    const dirPath = argv.find((arg) => {
      // 排除 electron 开发模式参数和 .exe 本身
      return arg.match(/^[A-Z]:\\/i) && !arg.endsWith('.exe')
    })

    if (dirPath && mainWindow) {
      mainWindow.show()
      mainWindow.focus()
      // 通过 IPC 通知渲染进程创建新标签页
      mainWindow.webContents.send('open-directory', dirPath)
    }
  })
}
```

### Pattern 5: IPC Handler 注册
**What:** 新增 IPC handler 遵循现有 `registerXxxHandlers()` 模式
**When to use:** 需要新增主进程-渲染进程通信通道时
**Example:**
```typescript
// 参考现有模式: src/main/ipc/claude-webview.ts
// 在 registerClaudeWebviewHandlers() 中或新建独立注册函数

export function registerTokenUsageHandlers(): void {
  ipcMain.handle('token-usage:get-stats', async (_event, range: string) => {
    // range: 'today' | 'week' | 'month' | 'all'
    return getTokenUsageStats(range)
  })
}
```

### Anti-Patterns to Avoid
- **在渲染进程中直接操作文件系统:** 违反 Electron 安全模型，所有文件 I/O 必须通过主进程
- **每次 API 调用都写入 JSON 文件:** 高频写入影响性能，D-03 明确要求仅在会话结束时写入
- **全量注册 Chart.js 组件:** `import Chart from 'chart.js'` 会引入全部 ~200KB，必须使用 tree-shaking 方式按需注册
- **直接写 HKCR 注册表根键:** 应使用 `SHCTX` 让 NSIS 根据安装模式自动路由到 HKLM 或 HKCU
- **在 NSIS 脚本中硬编码 exe 路径:** 使用 `$INSTDIR` 变量获取安装目录
- **忽略 electron 开发模式命令行参数:** 开发模式下 argv 包含 electron 开发服务器 URL 等，需过滤

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 图表渲染 | 自绘 Canvas/SVG | Chart.js + vue-chartjs | 坐标轴、缩放、响应式、动画、tooltip 等边缘情况多 |
| JSON 文件读写 | 自定义数据库 | Node.js fs 模块 + JSON.parse/stringify | 数据量小（90天 x 每天几KB），JSON 文件足够 |
| 单实例通信 | Socket/Named Pipe/MemoryMappedFile | Electron requestSingleInstanceLock | Electron 内置方案，跨平台，无需额外依赖 |
| 注册表操作 | 自写 reg.exe 脚本 | NSIS installer.nsh 宏 | 安装/卸载时原子性操作，NSIS 有完善的注册表 API |

**Key insight:** 本 phase 的所有核心需求都有成熟的标准方案，不需要创新。关键是正确组合现有模式。

## Common Pitfalls

### Pitfall 1: Chart.js Canvas 在 Electron 中无法正确渲染
**What goes wrong:** Chart.js 默认需要 Canvas 2D context，在某些 Electron 版本中可能遇到 GPU 加速问题
**Why it happens:** Electron 的硬件加速配置可能影响 Canvas 渲染
**How to avoid:** 确保 `maintainAspectRatio: false` 并在容器 div 上设置明确高度；如遇到渲染问题，可添加 `app.disableHardwareAcceleration()` 降级测试
**Warning signs:** 图表区域空白但无报错；控制台出现 WebGL 相关错误

### Pitfall 2: NSIS 注册表写入权限不足
**What goes wrong:** `perMachine: false`（默认）时 NSIS 写入 HKCU，而非 HKLM
**Why it happens:** electron-builder 默认 per-user 安装，`SHCTX` 映射到 HKCU
**How to avoid:** HKCU 下的 `Software\Classes` 仍然会传播到 HKCR 视图，右键菜单对当前用户有效。不需要提权。但如果用户选择 per-machine 安装，需要 `perMachine: true` 且提权
**Warning signs:** 安装后右键菜单不出现；注册表中找不到对应键

### Pitfall 3: second-instance 事件中 argv 解析错误
**What goes wrong:** 开发模式下 argv 包含 `electron-vite dev` 的参数如 `--inspect`、`--require` 等，可能误判为目录路径
**Why it happens:** 开发模式使用 `electron .` 启动，argv 结构与生产模式不同
**How to avoid:** 严格过滤 argv：只接受匹配 `^[A-Z]:\\` 格式的路径参数，排除 `.exe` 后缀
**Warning signs:** 开发模式下测试右键菜单功能异常

### Pitfall 4: token-usage.json 并发写入损坏
**What goes wrong:** 多个 channel 同时关闭时，可能同时写入 JSON 文件导致数据损坏
**Why it happens:** Node.js 的 `writeFileSync` 不是原子操作，并发调用可能导致内容交错
**How to avoid:** 使用模块级写入队列（Promise chain），确保同一时间只有一个写操作；或者在 `handleCloseChannel` 中先聚合所有已关闭 channel 的数据再统一写入
**Warning signs:** JSON.parse 抛出异常；文件内容不完整

### Pitfall 5: Chart.js CSS 变量在 Canvas 中无法使用
**What goes wrong:** 尝试用 `var(--accent)` 作为 Chart.js 颜色值，但 Canvas 不支持 CSS 变量
**Why it happens:** Chart.js 渲染到 Canvas 而非 DOM，CSS 变量需要通过 `getComputedStyle` 获取实际值
**How to avoid:** 在组件中通过 `getComputedStyle(document.documentElement).getPropertyValue('--accent')` 获取实际颜色值传给 Chart.js
**Warning signs:** 图表颜色为默认黑色/白色而非主题色

### Pitfall 6: 注册表路径与生产 exe 路径不匹配
**What goes wrong:** NSIS 使用 `$INSTDIR\AI Tools.exe` 但实际 exe 名称可能是 `ai-tools.exe`（electron-builder 的 `executableName` 配置）
**Why it happens:** `electron-builder.yml` 中 `win.executableName: ai-tools` 与 `productName: AI Tools` 不同
**How to avoid:** NSIS 中使用 `$INSTDIR\ai-tools.exe`（与 executableName 一致），或在主进程代码中用 `app.getPath('exe')` 获取实际路径
**Warning signs:** 右键菜单点击后无法启动应用；Windows 报 "找不到应用程序"

## Code Examples

### Token 用量数据结构设计
```typescript
// 每日汇总结构 (D-02)
interface DayRecord {
  date: string                    // 'YYYY-MM-DD' 格式，作为查询键
  sessions: SessionRecord[]
}

interface SessionRecord {
  id: string                      // channel ID
  cwd: string                     // 工作目录路径
  inputTokens: number
  outputTokens: number
  timestamp: number               // 会话结束时间戳
}

interface TokenUsageData {
  days: DayRecord[]
}
```

### Token 数据聚合 -- 在 handleCloseChannel 中写入
```typescript
// 修改: src/main/ipc/claude-webview.ts
function handleCloseChannel(channelId: string): void {
  const channel = channels.get(channelId)
  if (!channel) return

  // Token 用量记录 -- 会话结束时聚合 (D-03)
  if (channel.totalInputTokens > 0 || channel.totalOutputTokens > 0) {
    recordTokenUsage({
      id: channelId,
      cwd: currentCwd,
      inputTokens: channel.totalInputTokens,
      outputTokens: channel.totalOutputTokens,
      timestamp: Date.now()
    })
  }

  // ... 原有清理逻辑
}
```

### Preload IPC 桥接扩展
```typescript
// 新增到 src/preload/index.ts
getTokenUsageStats: (range: string): Promise<TokenUsageStats> =>
  ipcRenderer.invoke('token-usage:get-stats', range),

// 右键菜单打开目录通知
onOpenDirectory: (callback: (dirPath: string) => void): (() => void) => {
  const handler = (_event: Electron.IpcRendererEvent, dirPath: string): void =>
    callback(dirPath)
  ipcRenderer.on('open-directory', handler)
  return () => ipcRenderer.removeListener('open-directory', handler)
},
```

### 主进程单实例锁集成
```typescript
// 修改: src/main/index.ts -- 在 createWindow 之前
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv, _workingDirectory) => {
    // 从命令行参数中提取目录路径
    const dirPath = argv.find((arg) =>
      /^[A-Z]:\\/i.test(arg) && !arg.endsWith('.exe')
    )
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
      if (dirPath) {
        mainWindow.webContents.send('open-directory', dirPath)
      }
    }
  })

  app.whenReady().then(() => {
    // ... 原有初始化逻辑
  })
}
```

### 注册表首次启动检查 (主进程)
```typescript
// 新增到 src/main/index.ts app.whenReady() 中
import { execSync } from 'child_process'

function ensureContextMenuRegistered(): void {
  const exePath = app.getPath('exe')
  const regCheckCmd = `reg query "HKCU\\Software\\Classes\\Directory\\shell\\ai-tools" /ve 2>nul`

  try {
    execSync(regCheckCmd, { stdio: 'pipe' })
    // 键已存在，无需操作
  } catch {
    // 键不存在，补注册
    const regKey = 'HKCU\\Software\\Classes\\Directory\\shell\\ai-tools'
    execSync(`reg add "${regKey}" /ve /d "使用 AI Tools 打开" /f`, { stdio: 'pipe' })
    execSync(`reg add "${regKey}" /v Icon /d "${exePath}" /f`, { stdio: 'pipe' })
    execSync(`reg add "${regKey}\\command" /ve /d "\\"${exePath}\\" \\"%V\\"" /f`, { stdio: 'pipe' })

    const bgKey = 'HKCU\\Software\\Classes\\Directory\\Background\\shell\\ai-tools'
    execSync(`reg add "${bgKey}" /ve /d "使用 AI Tools 打开当前目录" /f`, { stdio: 'pipe' })
    execSync(`reg add "${bgKey}" /v Icon /d "${exePath}" /f`, { stdio: 'pipe' })
    execSync(`reg add "${bgKey}\\command" /ve /d "\\"${exePath}\\" \\"%V\\"" /f`, { stdio: 'pipe' })
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `app.makeSingleInstance()` | `app.requestSingleInstanceLock()` + `second-instance` event | Electron v4 (2018) | makeSingleInstance 已废弃，必须使用新 API |
| Chart.js v2 全量引入 | Chart.js v4 tree-shaking 注册 | Chart.js v3+ (2021) | 必须按需注册组件以控制 bundle 体积 |
| vue-chartjs v3 (Vue 2) | vue-chartjs v5 (Vue 3 Composition API) | 2023 | 支持 `<script setup>` + TypeScript |

**Deprecated/outdated:**
- `app.makeSingleInstance()`: 已废弃，必须使用 `requestSingleInstanceLock` [CITED: Context7 /electron/electron docs]
- `Chart.js auto` import: 不推荐，会导致 bundle 过大 [CITED: Context7 /chartjs/chart.js docs]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Chart.js tree-shaken 后约 65KB | Standard Stack | 如果实际远大于此，可能影响应用启动速度 |
| A2 | 开发模式右键菜单测试需要特殊处理 argv | Common Pitfalls | 如果忽略，开发调试时会产生误判 |
| A3 | `$INSTDIR\ai-tools.exe` 是正确的 NSIS 路径 | Code Examples | 如果路径不对，右键菜单无法启动应用 |
| A4 | `reg.exe` 命令在所有 Windows 10 版本可用 | Code Examples | 极端情况下可能不可用 |

**需要用户确认的项目:**
- A3: 生产环境 exe 文件名确认 -- 当前 `electron-builder.yml` 配置 `win.executableName: ai-tools`，NSIS 中应使用 `$INSTDIR\ai-tools.exe` 而非 `$INSTDIR\AI Tools.exe`

## Open Questions

1. **Chart.js 柱状图容器尺寸**
   - What we know: SettingsDrawer 宽度 360px，Chart.js 需要明确高度
   - What's unclear: 趋势图的最佳高度，是否需要横向滚动（显示30天/90天）
   - Recommendation: 固定高度 200px，最近30天数据，超出可滚动

2. **多标签页创建 API**
   - What we know: CONTEXT.md 提到 "在当前窗口创建新标签页并切换到该目录"
   - What's unclear: 渲染进程是否已有 `createTab(cwd)` 方法
   - Recommendation: 研究阶段确认渲染进程标签页管理 API，plan 阶段使用

3. **注册表卸载清理范围**
   - What we know: NSIS `customUnInstall` 清理注册表项
   - What's unclear: 应用更新（覆盖安装）时是否需要重新注册
   - Recommendation: NSIS 的 customInstall 每次都执行（包括更新），无需额外处理

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pnpm | 包管理 | ✓ | (项目已使用) | -- |
| electron | 运行时 | ✓ | 35.7.5 | -- |
| electron-builder | 打包 | ✓ | 26.8.1 | -- |
| NSIS | 打包 | ✓ | (electron-builder 内置) | -- |
| reg.exe | 注册表操作 | ✓ | (Windows 内置) | -- |
| vitest | 测试 | ✓ | 2.1.9 | -- |

**Missing dependencies with no fallback:**
- None

**Missing dependencies with fallback:**
- None

## Sources

### Primary (HIGH confidence)
- Context7 `/chartjs/chart.js` -- Chart.js bar chart 配置和 tree-shaking 注册模式
- Context7 `/apertureless/vue-chartjs` -- Vue 3 Composition API `<script setup>` 柱状图模式
- Context7 `/electron/electron` -- requestSingleInstanceLock + second-instance 事件 API
- electron-builder 官方文档 https://www.electron.build/configuration/nsis -- NSIS 自定义脚本 include 宏
- 项目代码 `src/main/tray/tray-manager.ts` -- close-behavior.json JSON 文件持久化参考
- 项目代码 `src/main/ipc/claude-webview.ts` -- Channel token 追踪和 handleCloseChannel 模式
- 项目代码 `src/renderer/src/components/SettingsDrawer.vue` -- 分组布局和 CSS 变量使用
- 项目代码 `src/preload/index.ts` -- IPC 桥接模式
- 项目代码 `electron-builder.yml` -- NSIS 配置和 executableName

### Secondary (MEDIUM confidence)
- npm registry -- chart.js 4.5.1 版本和 MIT 协议确认
- npm registry -- vue-chartjs 5.3.3 版本和 MIT 协议确认

### Tertiary (LOW confidence)
- Chart.js tree-shaken 后约 65KB -- 基于训练数据估算，未实际测量

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- 所有库版本通过 npm registry 验证，API 通过 Context7 确认
- Architecture: HIGH -- 所有模式均基于项目现有代码和官方文档
- Pitfalls: HIGH -- 基于 Electron + Chart.js 常见问题的 Context7 文档和项目经验

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 (30 days -- 稳定技术栈)
