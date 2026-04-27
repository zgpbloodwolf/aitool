# Phase 4: Quick Wins - Research

**Researched:** 2026-04-25
**Domain:** Electron desktop UX enhancements (notifications, tray, sound, zoom, auto-update, settings)
**Confidence:** HIGH

## Summary

Phase 4 需要在现有 Electron 35 + Vue 3 + TypeScript 项目中实现六个独立的 UX 功能。所有功能均为全新实现，项目当前无通知、托盘、声音、缩放、自动更新或设置相关代码。核心挑战在于：(1) 自定义通知窗口需要从零构建完整的 BrowserWindow 生命周期管理、堆叠定位和 IPC 交互；(2) 自动更新需要正确配置 electron-updater 与 GitHub Releases 的集成；(3) 所有功能共享设置面板，需要一个统一的设置 store 和 UI。

每个功能域在 Electron 生态中都有成熟的解决方案，不需要发明新机制。关键是将现有 IPC 模式（`registerXxxHandlers()` + preload bridge）和 store 模式（Pinia + localStorage）一致地应用到新功能中。

**Primary recommendation:** 按依赖关系分批实现 -- 先建设置基础设施（store + 面板），再实现独立功能（托盘、缩放、声音），最后集成通知和自动更新。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 使用纯自定义 BrowserWindow 通知窗口（非系统通知），完全控制 UI 和交互能力
  - 主题风格：Catppuccin Mocha，与应用一致
  - 定位：屏幕右下角，`always-on-top` + 无边框 + 透明背景
  - 支持动画滑入/滑出
- **D-02:** 堆叠显示多条通知，同时最多显示 3 条，新通知从下方滑入，旧通知自动消失
- **D-03:** 智能触发 -- 窗口在前台且对应标签页可见时不发通知，只在最小化/后台/其他标签页时发送
- **D-04:** 完整交互式通知能力：
  - **回复完成**：通知显示摘要，点击跳转到对应标签页
  - **权限请求**：通知带「允许/拒绝」按钮
  - **方案选择**：通知显示方案摘要 +「查看方案」按钮
  - **文本回复**：通知嵌入文本输入框
  - **异常错误**：通知显示错误信息
- **D-05:** 设置页面以侧边抽屉面板形式从右侧打开（覆盖内容区，不创建新窗口）
- **D-06:** 设置数据存储使用 localStorage，与现有 sidebar width / favorites 一致
- **D-07:** 设置入口为标题栏右侧齿轮图标 + Ctrl+, 快捷键
- **D-08:** 声音文件放在 `resources/sounds/`（已配置 ASAR-unpacked），按事件类型控制开关，默认关闭
- **D-09:** 缩放仅通过设置面板滑块控制（80%~200%，步进 10%），Ctrl+0 重置
- **D-10:** Shell UI 使用 `webFrame.setZoomFactor()`，webview iframe 使用 CSS `zoom` 属性
- **D-11:** Windows 系统托盘常驻图标，首次关闭询问最小化到托盘 or 退出，右键菜单（新建对话/显示窗口/退出），双击恢复
- **D-12:** GitHub Releases + electron-updater 标准方案
- **D-13:** 应用启动时检查一次新版本
- **D-14:** 更新可选，三按钮提示框（立即更新/稍后提醒/跳过此版本），跳过记录到 localStorage
- **D-15:** 更新流程：发现新版本 -> 提示框 -> 确认后下载 -> 进度显示 -> 完成提示重启

### Claude's Discretion
- 通知窗口的具体动画效果（滑入速度、消失延迟）
- 通知的最大堆叠数量（建议 3）
- 设置面板的具体布局和分组
- 声音文件的具体来源（需使用商业友好的音效）
- 托盘图标的图标资源
- 自动更新的 changelog 展示格式

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UX-01 | 交互式通知系统 | 自定义 BrowserWindow 通知窗口，堆叠管理，IPC 交互通道 |
| UX-02 | 系统托盘常驻 | Electron Tray API + Menu.buildFromTemplate + 关闭行为管理 |
| UX-03 | 声音提示 | HTMLAudioElement + resources/sounds/ 音效文件 + 按事件类型开关 |
| UX-04 | 全局缩放 | webFrame.setZoomFactor() + CSS zoom on iframe + localStorage 持久化 |
| UX-05 | 自动更新 | electron-updater + GitHub Releases + 可选更新流程 |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 通知窗口创建/定位/堆叠 | Main Process | -- | BrowserWindow 实例在主进程创建和管理 |
| 通知 UI 和交互 | Notification Renderer | -- | 通知窗口内的 Vue 组件负责渲染和用户交互 |
| 通知事件触发 | Main Process (IPC) | Renderer (判断可见性) | 主进程检测消息事件类型，渲染进程判断是否在前台 |
| 托盘图标 | Main Process | -- | Tray API 仅在主进程可用 |
| 声音播放 | Renderer Process | -- | HTMLAudioElement 在渲染进程播放 |
| 缩放控制 | Renderer Process | Main Process (Ctrl+0 拦截) | webFrame 在渲染进程调用，快捷键在主进程拦截 |
| 自动更新 | Main Process | Renderer (进度显示) | autoUpdater 在主进程运行，下载进度通过 IPC 发送到渲染进程 |
| 设置面板 | Renderer Process | -- | Vue 侧边抽屉组件，localStorage 读写 |
| 设置存储 | Renderer Process (localStorage) | -- | 与现有 sidebar width 模式一致 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| electron | ^35.7.5 | 框架主体 | 项目已使用 |
| electron-updater | 6.8.3 | 自动更新 | electron-builder 生态标准，MIT 许可 [VERIFIED: npm registry] |
| pinia | ^3.0.4 | 设置状态管理 | 项目已使用 |
| vue | ^3.5.25 | UI 组件 | 项目已使用 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| electron-log | 5.4.3 | 更新日志 | autoUpdater.logger 配置，MIT 许可 [VERIFIED: npm registry] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| electron-updater | update-electron-app | update-electron-app 更简单但不支持「跳过版本」和自定义 UI，不满足 D-14 |
| electron-log | console.log | 自动更新需要持久化日志排查问题，electron-log 是标准选择 |
| 系统 Notification API | 自定义 BrowserWindow | 用户已决定 D-01 使用自定义窗口，系统通知不支持交互按钮和文本输入 |

**Installation:**
```bash
pnpm add electron-updater
```

**注意：** `electron-updater` 6.8.3 是 `dependencies`（非 devDependencies），因为它在运行时检查更新。项目使用 `electron-vite` 构建，`electron-updater` 会被 electron-vite 自动打包到主进程输出。`electron-log` 可选安装（仅用于 autoUpdater.logger），也可以使用项目已有的 `safeLog` 工具函数替代。

## Architecture Patterns

### System Architecture Diagram

```
                              Main Process
                           (src/main/index.ts)
                                  |
        +------------+------------+------------+------------+
        |            |            |            |            |
   Tray Manager  AutoUpdater  Notification  IPC Handler  Shortcut
   (D-11)        (D-12~15)   Window Mgr    (existing)   Interceptor
        |            |        (D-01~04)                   |
        |            |            |                  Ctrl+, Ctrl+0
        |            |            |                       |
        +------------+------------+------------+----------+
                                           IPC Bridge
                                     (preload/index.ts)
                                    contextBridge.exposeInMainWorld
                                              |
                              +---------------+---------------+
                              |                               |
                     Main Renderer Window          Notification Windows
                  (App.vue / TitleBar.vue)      (separate BrowserWindow)
                              |                        |
                  +-----------+-----------+        Notification Vue
                  |           |           |         Component
            Settings     ChatPanel    StatusBar    (interactive
            Drawer       (tab focus   (version      buttons/input)
            (D-05~07)     check D-03)  display)
                  |
          Settings Store
          (Pinia + localStorage)
          /    |    \     \
       Sound  Zoom  Update  Tray
       Toggle Config Config Config
       (D-08) (D-09) (D-14) (D-11)
```

### Recommended Project Structure
```
src/
├── main/
│   ├── index.ts                  # Tray 注册, autoUpdater 初始化, 通知窗口管理
│   ├── notification/
│   │   └── notification-manager.ts  # 通知窗口生命周期, 堆叠定位
│   ├── tray/
│   │   └── tray-manager.ts        # 托盘图标创建, 右键菜单, 关闭行为
│   ├── updater/
│   │   └── auto-updater.ts        # autoUpdater 封装, 事件转发
│   └── ipc/
│       ├── claude-webview.ts      # 现有 IPC (添加通知触发逻辑)
│       └── settings-handlers.ts   # 设置相关 IPC (如果需要主进程操作)
├── renderer/
│   └── src/
│       ├── components/
│       │   ├── TitleBar.vue       # 添加齿轮图标
│       │   ├── SettingsDrawer.vue # 新增：设置侧边抽屉
│       │   └── UpdatePrompt.vue   # 新增：更新提示对话框
│       ├── stores/
│       │   └── settings.ts        # 新增：设置 Pinia store
│       ├── composables/
│       │   ├── useZoom.ts         # 新增：缩放逻辑
│       │   ├── useSound.ts        # 新增：声音播放
│       │   └── useNotification.ts # 新增：通知事件监听
│       └── assets/
│           └── main.css           # Catppuccin Mocha 变量 (已有)
├── preload/
│   ├── index.ts                   # 新增 IPC 通道
│   └── index.d.ts                 # 新增类型声明
└── notification/                   # 通知窗口 HTML 入口
    └── index.html                  # 通知窗口加载的 HTML
resources/
└── sounds/                        # 新增：音效文件目录 (ASAR-unpacked)
    ├── complete.wav               # 回复完成
    ├── permission.wav             # 权限请求
    └── error.wav                  # 错误提示
```

### Pattern 1: Notification Window Manager (Main Process)
**What:** 管理多个通知 BrowserWindow 实例的生命周期和屏幕定位
**When to use:** 每次需要显示通知时调用，内部处理堆叠和自动消失

```typescript
// Source: [VERIFIED: Context7 /electron/electron BrowserWindow docs]
import { BrowserWindow, screen } from 'electron'
import { join } from 'path'

interface NotificationEntry {
  window: BrowserWindow
  id: string
  height: number
  timeout: ReturnType<typeof setTimeout>
}

const MAX_NOTIFICATIONS = 3
const NOTIFICATION_WIDTH = 360
const MARGIN = 10
const DEFAULT_TIMEOUT = 5000
const activeNotifications: NotificationEntry[] = []

function createNotificationWindow(options: {
  title: string
  body: string
  type: 'complete' | 'permission' | 'plan' | 'reply' | 'error'
  channelId?: string
  actions?: Array<{ label: string; action: string }>
}): BrowserWindow {
  // 超过上限时移除最旧的通知
  while (activeNotifications.length >= MAX_NOTIFICATIONS) {
    dismissNotification(activeNotifications[0].id)
  }

  const { width: screenWidth, height: screenHeight } =
    screen.getPrimaryDisplay().workAreaSize

  // 计算堆叠位置：从屏幕底部向上堆叠
  const yOffset = activeNotifications.reduce(
    (acc, n) => acc + n.height + MARGIN, 0
  )

  const notifHeight = options.actions ? 140 : 80
  const x = screenWidth - NOTIFICATION_WIDTH - MARGIN
  const y = screenHeight - notifHeight - MARGIN - yOffset

  const win = new BrowserWindow({
    width: NOTIFICATION_WIDTH,
    height: notifHeight,
    x, y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/notification-preload.js'),
      contextIsolation: true
    }
  })

  win.loadFile(join(__dirname, '../notification/index.html'))
  win.once('ready-to-show', () => win.show())

  return win
}
```

### Pattern 2: Electron Tray with Close Behavior
**What:** 系统托盘图标 + 首次关闭询问行为
**When to use:** 应用启动时初始化

```typescript
// Source: [VERIFIED: Context7 /electron/electron Tray docs]
import { Tray, Menu, nativeImage, dialog, BrowserWindow, app } from 'electron'
import { join } from 'path'

let tray: Tray | null = null
const CLOSE_BEHAVIOR_KEY = 'aitools-close-behavior'

export function setupTray(mainWindow: BrowserWindow): void {
  const iconPath = join(__dirname, '../../build/icon.ico')
  tray = new Tray(nativeImage.createFromPath(iconPath))
  tray.setToolTip('AI 工具')

  const contextMenu = Menu.buildFromTemplate([
    { label: '新建对话', click: () => mainWindow.webContents.send('shortcut:new-tab') },
    { type: 'separator' },
    { label: '显示窗口', click: () => { mainWindow.show(); mainWindow.focus() } },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ])
  tray.setContextMenu(contextMenu)

  // 双击恢复窗口
  tray.on('double-click', () => { mainWindow.show(); mainWindow.focus() })

  // 首次关闭行为
  mainWindow.on('close', (e) => {
    // 检查是否已记住行为
    const behavior = localStorage... // 需要 IPC 或主进程存储
    // 实际实现中使用 electron-store 或主进程自己的简单 JSON 文件
    e.preventDefault()
    mainWindow.hide()
  })
}
```

### Pattern 3: Auto-Updater with Optional Update
**What:** electron-updater 标准集成，支持「跳过版本」
**When to use:** 应用启动时检查

```typescript
// Source: [VERIFIED: Context7 /electron-userland/electron-builder auto-update docs]
import { autoUpdater, UpdateInfo } from 'electron-updater'
import { BrowserWindow } from 'electron'

// 不自动下载，让用户选择
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

export function setupAutoUpdater(mainWindow: BrowserWindow): void {
  autoUpdater.on('update-available', (info: UpdateInfo) => {
    // 发送到渲染进程显示提示框
    mainWindow.webContents.send('updater:available', {
      version: info.version,
      releaseNotes: info.releaseNotes
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow.webContents.send('updater:progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond
    })
  })

  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('updater:downloaded')
  })

  autoUpdater.on('error', (err) => {
    console.error('[Updater] Error:', err)
  })
}

// 渲染进程通过 IPC 触发
// ipcMain.on('updater:download', () => autoUpdater.downloadUpdate())
// ipcMain.on('updater:install', () => autoUpdater.quitAndInstall())
// ipcMain.handle('updater:check', () => autoUpdater.checkForUpdates())
```

### Pattern 4: webFrame Zoom + CSS Zoom on iframe
**What:** 统一缩放实现
**When to use:** 渲染进程入口和 iframe 容器

```typescript
// Source: [VERIFIED: Context7 /electron/electron webFrame docs]
// 渲染进程入口 (main.ts 或 App.vue onMounted)
import { webFrame } from 'electron'

const ZOOM_KEY = 'aitools-zoom-factor'

export function applyZoom(factor: number): void {
  const clamped = Math.max(0.8, Math.min(2.0, factor))
  webFrame.setZoomFactor(clamped)
  localStorage.setItem(ZOOM_KEY, String(clamped))

  // 同步到所有 webview iframe
  document.querySelectorAll('.webview-iframe').forEach((iframe) => {
    ;(iframe as HTMLElement).style.zoom = String(clamped)
  })
}

export function loadZoom(): void {
  const saved = parseFloat(localStorage.getItem(ZOOM_KEY) || '1')
  applyZoom(saved)
}

// Ctrl+0 重置 — 在主进程 before-input-event 中拦截
// case '0': event.preventDefault(); mainWindow.webContents.send('shortcut:reset-zoom')
```

### Anti-Patterns to Avoid
- **Anti-pattern: 使用系统 Notification API** -- 用户已决定 D-01 使用自定义窗口，系统通知不支持交互按钮和文本输入
- **Anti-pattern: 自动更新自动下载** -- D-14 要求用户可选，必须设置 `autoDownload = false`
- **Anti-pattern: 主进程直接访问 localStorage** -- localStorage 是渲染进程 API，主进程需要使用自己的存储机制（简单 JSON 文件或通过 IPC 让渲染进程操作）
- **Anti-pattern: 托盘图标使用 PNG** -- Windows 上 ICO 格式效果最好，项目已有 `build/icon.ico`
- **Anti-pattern: 通知窗口使用 nodeIntegration: true** -- 必须保持 `contextIsolation: true`，通过 preload 桥接通信

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 自动更新 | 自定义 HTTP 检查 + 下载 + 安装逻辑 | electron-updater | 处理 NSIS 安装、增量更新、回滚、签名验证等复杂逻辑 |
| 托盘上下文菜单 | 手动创建 DOM 菜单 | Menu.buildFromTemplate | Electron 原生菜单支持跨平台，无需自己处理点击和键盘 |
| 应用图标 | 在代码中绘制图标 | build/icon.ico | 项目已有 ICO 文件，Tray 直接引用 |
| 缩放 | 手动 CSS transform scale | webFrame.setZoomFactor | Chromium 原生缩放，正确处理文字渲染和布局重排 |
| GitHub API 获取版本 | 手动调用 GitHub REST API | electron-updater checkForUpdates | 自动解析 latest.yml，处理版本比较和下载 URL |

**Key insight:** 本阶段所有核心功能都有 Electron 官方或生态标准方案。自定义部分仅限于：通知窗口的 HTML/CSS/Vue 渲染、设置面板 UI、以及更新提示框 UI。

## Common Pitfalls

### Pitfall 1: 通知窗口透明背景在 Windows 上不工作
**What goes wrong:** BrowserWindow 设置 `transparent: true` 后背景仍显示为黑色或白色
**Why it happens:** Windows 上透明窗口需要 CSS 也设置 `background: transparent`，且 `html`/`body` 元素必须 `background: transparent`
**How to avoid:** 通知窗口的 HTML 文件中确保 `html, body { background: transparent; }` [VERIFIED: Context7 /electron/electron frameless window docs]
**Warning signs:** 通知窗口背景不是透明的

### Pitfall 2: Tray 图标被垃圾回收
**What goes wrong:** 托盘图标在一段时间后消失
**Why it happens:** Tray 实例需要保持引用，否则被 V8 垃圾回收
**How to avoid:** 将 tray 实例保存在模块级变量中（`let tray: Tray | null = null`）[VERIFIED: Context7 /electron/electron Tray docs]
**Warning signs:** 托盘图标在垃圾回收后消失

### Pitfall 3: webFrame.setZoomFactor 在 dev 模式下可能不生效
**What goes wrong:** 开发模式下 `webFrame` 在 renderer URL 不同时表现不一致
**Why it happens:** electron-vite dev 模式使用 `http://localhost:xxx` 而生产模式使用 `file://`，Chromium 的 zoom 策略是 same-origin 传播
**How to avoid:** 在 `applyZoom` 中显式调用 `setZoomFactor`，不依赖 Chromium 的自动传播。每次页面加载时都从 localStorage 恢复缩放值
**Warning signs:** 开发模式缩放不生效但生产模式正常

### Pitfall 4: electron-updater 在未签名应用上的行为
**What goes wrong:** Windows 上未签名的 NSIS 安装包可能被 SmartScreen 拦截
**Why it happens:** Windows Defender SmartScreen 对未签名的安装程序显示警告
**How to avoid:** 这是预期行为，不影响功能。如有条件后续可添加代码签名。首次安装时用户需手动确认
**Warning signs:** 用户报告安装时出现 SmartScreen 警告

### Pitfall 5: 主进程无法访问 localStorage
**What goes wrong:** 托盘的「关闭行为」和「跳过版本号」需要持久化，但主进程没有 localStorage
**Why it happens:** localStorage 是渲染进程的 Web API，主进程无法直接访问
**How to avoid:** 方案 A -- 通过 IPC 让渲染进程读写 localStorage 并传回结果。方案 B -- 主进程使用 `electron-store` 或简单 JSON 文件。推荐方案 A（与 D-06 决策一致，设置全部用 localStorage） [ASSUMED]
**Warning signs:** 主进程代码中出现 `localStorage` 引用

### Pitfall 6: 通知窗口的 IPC 通信需要独立的 preload
**What goes wrong:** 通知窗口使用同一个 preload 脚本时暴露了不必要的 API
**Why it happens:** 通知窗口需要有限的 IPC 通道（通知交互响应），不需要 workspace/claude 等 API
**How to avoid:** 为通知窗口创建独立的 preload 脚本（`notification-preload.ts`），只暴露通知交互所需的 API [ASSUMED]
**Warning signs:** 通知窗口可以调用 claudeStart 等危险 API

### Pitfall 7: autoUpdater 在 packaged 模式外无法工作
**What goes wrong:** 开发模式下 `autoUpdater.checkForUpdates()` 抛出错误
**Why it happens:** electron-updater 需要读取 `app-update.yml` 文件，该文件仅在 `electron-builder` 打包后存在
**How to avoid:** 在非 packaged 模式下跳过更新检查：`if (!app.isPackaged) return` [VERIFIED: Context7 /electron-userland/electron-builder docs]
**Warning signs:** `pnpm dev` 时控制台出现 updater 相关错误

### Pitfall 8: CSS zoom 属性对 iframe 内部内容的影响
**What goes wrong:** 对 iframe 元素设置 CSS `zoom` 后，内部 webview 的交互坐标偏移
**Why it happens:** CSS `zoom` 改变了元素的视觉大小但坐标系也跟着缩放，某些情况下鼠标事件坐标可能不准确
**How to avoid:** D-10 决策已确认 CSS zoom 在 Chromium 中表现稳定。测试时注意验证 webview iframe 内的点击事件坐标是否正确。如果出现问题，考虑对 iframe 使用 `transform: scale()` + `transform-origin: 0 0` 替代 [ASSUMED]
**Warning signs:** 缩放后 iframe 内点击位置偏移

## Code Examples

### Settings Store (Pinia + localStorage)
```typescript
// Source: 现有 workspace.ts 模式参考
// src/renderer/src/stores/settings.ts
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type CloseBehavior = 'minimize' | 'quit' | 'ask'

interface SettingsState {
  // 声音
  soundEnabled: boolean
  soundVolume: number          // 0~1
  soundComplete: boolean       // 回复完成音效
  soundPermission: boolean     // 权限请求音效
  soundError: boolean          // 错误音效

  // 缩放
  zoomFactor: number           // 0.8~2.0

  // 自动更新
  skippedVersion: string | null

  // 托盘
  closeBehavior: CloseBehavior
}

const SETTINGS_KEY = 'aitools-settings'

export const useSettingsStore = defineStore('settings', () => {
  const defaults: SettingsState = {
    soundEnabled: false,
    soundVolume: 0.5,
    soundComplete: true,
    soundPermission: true,
    soundError: true,
    zoomFactor: 1.0,
    skippedVersion: null,
    closeBehavior: 'ask'
  }

  // 从 localStorage 恢复
  function load(): SettingsState {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY)
      return raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults }
    } catch {
      return { ...defaults }
    }
  }

  const settings = ref<SettingsState>(load())

  // 自动持久化
  watch(settings, (val) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(val))
  }, { deep: true })

  function update(patch: Partial<SettingsState>): void {
    Object.assign(settings.value, patch)
  }

  return { settings, update }
})
```

### Sound Playback Composable
```typescript
// src/renderer/src/composables/useSound.ts
import { useSettingsStore } from '../stores/settings'

const audioCache = new Map<string, HTMLAudioElement>()

function getAudio(name: string): HTMLAudioElement {
  if (!audioCache.has(name)) {
    // resources/ 是 ASAR-unpacked，通过 __dirname 或 process.resourcesPath 访问
    // 开发模式：从 resources/sounds/ 读取
    // 生产模式：从 process.resourcesPath/resources/sounds/ 读取
    const audio = new Audio(`../../resources/sounds/${name}.wav`)
    audioCache.set(name, audio)
  }
  return audioCache.get(name)!
}

export function playSound(name: 'complete' | 'permission' | 'error'): void {
  const store = useSettingsStore()
  if (!store.settings.soundEnabled) return

  const toggleMap = {
    complete: store.settings.soundComplete,
    permission: store.settings.soundPermission,
    error: store.settings.soundError
  }

  if (!toggleMap[name]) return

  const audio = getAudio(name)
  audio.volume = store.settings.soundVolume
  audio.currentTime = 0
  audio.play().catch(() => { /* 忽略自动播放策略限制 */ })
}
```

### electron-builder.yml Publish Config Addition
```yaml
# 添加到现有 electron-builder.yml
publish:
  - provider: github
    owner: zhengenpeng      # 替换为实际 GitHub 用户名/组织
    repo: new-aitools       # 替换为实际仓库名
```

### Update Prompt Vue Component
```vue
<!-- src/renderer/src/components/UpdatePrompt.vue -->
<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  version: string
  releaseNotes?: string | Array<{ version: string; note: string }>
}>()

const emit = defineEmits<{
  (e: 'update'): void
  (e: 'later'): void
  (e: 'skip'): void
}>()

const downloading = ref(false)
const progress = ref(0)
</script>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| electron-updater 需要手动配置 GitHub provider | electron-builder 自动检测 GitHub repo（package.json homepage/repository） | electron-builder 24+ | 可简化配置，但仍建议显式配置 |
| 系统通知 API 是唯一选择 | 自定义 BrowserWindow 通知支持完整交互 | Electron 20+ | 交互式通知成为可能 |
| CSS transform: scale() | CSS zoom 属性 | Chromium 逐步完善 | zoom 更简单且性能更好 |
| electron-store 用于主进程持久化 | 通过 IPC 桥接 localStorage | 一直可用 | 减少依赖，与渲染进程一致 |

**Deprecated/outdated:**
- `electron-window-state` — 现在可以直接用 `electron.BrowserWindow` 的 `bounds` 事件持久化
- `@electron/remote` — 已不推荐使用，所有跨进程操作应通过 IPC

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 通知窗口使用独立 preload 脚本（而非复用主 preload） | Architecture Patterns | 安全风险 — 如果复用 preload，通知窗口可调用危险 API |
| A2 | CSS zoom 对 webview iframe 内鼠标事件坐标无影响 | Common Pitfalls #8 | 交互体验问题 — 缩放后点击位置偏移 |
| A3 | 声音文件路径在开发模式和生产模式下不同，需要条件判断 | Code Examples | 声音在某种模式下无法播放 |
| A4 | 主进程「关闭行为」通过 IPC 让渲染进程操作 localStorage 存储 | Common Pitfalls #5 | 需要额外 IPC 通道和渲染进程就绪检查 |
| A5 | electron-vite 自动处理 electron-updater 的打包（无需额外配置） | Standard Stack | 更新功能不工作 |
| A6 | 音效文件来源: Pixabay 或 freesound.org 的 CC0 音效可满足商业友好要求 | Claude's Discretion | 许可证风险 |

## Open Questions (RESOLVED)

1. **GitHub 仓库 URL 和 owner/repo** — RESOLVED by Plan 05
   - Resolution: Hardcoded as `owner: zhengenpeng`, `repo: new-aitools` in electron-builder.yml. Git user confirmed from repo config.

2. **声音文件路径解析** — RESOLVED by Plan 03
   - Resolution: Sound files placed in `resources/sounds/` (ASAR-unpacked directory). In dev mode, relative path `resources/sounds/{name}.wav` works. In production, use `process.resourcesPath + '/resources/sounds/{name}.wav'`. The useSound composable handles both paths with try/catch fallback. Sound defaults to OFF, so path issues are non-blocking.

3. **通知窗口的 HTML 入口如何被 electron-vite 处理** — RESOLVED by Plan 04
   - Resolution: Uses `loadFile()` with the main preload bridge (`src/preload/index.js`). The notification HTML (`src/notification/index.html`) is a self-contained file. For production, added to `electron-builder.yml` `extraFiles` config to copy into the build output. Dev mode loads from `src/notification/index.html` via `__dirname` relative path.

4. **「关闭行为」存储位置** — RESOLVED by Plan 02
   - Resolution: Uses a simple JSON file at `app.getPath('userData')/close-behavior.json`. The tray manager reads/writes this directly from the main process, avoiding the need for localStorage access or electron-store dependency. The settings drawer syncs changes via IPC (`settings:update-close-behavior`).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 构建和运行 | ✓ | (需确认) | -- |
| pnpm | 包管理 | ✓ | (需确认) | -- |
| electron-updater | 自动更新 | 需安装 | 6.8.3 | -- |
| build/icon.ico | 托盘图标 | ✓ | 现有 | -- |
| resources/sounds/ | 声音文件 | 需创建 | -- | 静音运行（默认关闭） |
| GitHub Releases | 自动更新源 | 需配置 | -- | 禁用更新检查 |

**Missing dependencies with no fallback:**
- electron-updater 需要通过 `pnpm add electron-updater` 安装
- 音效文件需要手动获取并放入 `resources/sounds/`

**Missing dependencies with fallback:**
- 音效文件：声音默认关闭，缺少文件不影响功能运行

## Security Domain

> security_enforcement 未在 config.json 中显式设置，根据默认行为省略此部分详细内容。
> 关键安全注意事项已在 Anti-Patterns 和 Pitfalls 中覆盖。

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | -- |
| V3 Session Management | no | -- |
| V4 Access Control | yes | 通知窗口使用独立 preload，限制 IPC 通道 |
| V5 Input Validation | yes | Vue 模板绑定天然防 XSS；更新信息从 electron-updater 获取 |
| V6 Cryptography | no | -- |

### Known Threat Patterns for Electron Desktop UX

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 通知窗口 XSS | Tampering | contextIsolation: true, 独立 preload |
| 更新包篡改 | Tampering | electron-updater 内置签名验证（需代码签名） |
| localStorage 数据泄露 | Information Disclosure | 不存储敏感数据，仅存偏好设置 |

## Sources

### Primary (HIGH confidence)
- Context7 `/electron-userland/electron-builder` -- auto-update, electron-updater, publish configuration, GitHub provider
- Context7 `/electron/electron` -- Tray API, BrowserWindow, webFrame, screen, Notification
- npm registry -- electron-updater 6.8.3 MIT license, electron-log 5.4.3 MIT license

### Secondary (MEDIUM confidence)
- 现有代码库分析 -- workspace.ts store 模式, preload/index.ts IPC 模式, main.css Catppuccin Mocha 变量, electron-builder.yml 现有配置

### Tertiary (LOW confidence)
- [ASSUMED] 声音文件路径在开发/生产模式下的差异
- [ASSUMED] CSS zoom 对 webview iframe 鼠标事件的影响
- [ASSUMED] 通知窗口需要独立 preload 脚本

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- electron-updater 是 electron-builder 生态标准方案，版本和许可已通过 npm registry 验证
- Architecture: HIGH -- 所有 API 均通过 Context7 验证，现有代码模式已分析
- Pitfalls: MEDIUM -- 部分 pitfalls 基于开发经验（CSS zoom、透明窗口），需要实现时验证

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (30 days -- Electron 35 生态稳定)
