# Phase 5: 主题个性化 - Research

**Researched:** 2026-04-26
**Domain:** CSS theming / Electron nativeTheme / multi-window theme sync
**Confidence:** HIGH

## Summary

本阶段为现有 Catppuccin Mocha 暗色主题添加亮色（Catppuccin Latte）和系统跟随两种模式。核心技术方案是 CSS 变量 + `data-theme` 属性切换，辅以 Electron `nativeTheme` API 检测系统主题偏好。主要工作量在于：(1) main.css 扩展双主题变量值，(2) 将 ChatPanel.vue ~30 处硬编码 hex 迁移为 CSS 变量引用，(3) webview-server.ts 和 notification/index.html 的参数化主题注入，(4) 设置 store/UI 扩展。

**Primary recommendation:** 使用 `data-theme` 属性切换方案，Catppuccin 官方 Latte 配色已通过 npm 包 `@catppuccin/palette@1.8.0` 验证全部 hex 值。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 亮色主题使用 Catppuccin Latte 配色，与现有 Mocha 暗色同系列
  - 语义变量名一一对应（如 `--bg-primary` 暗色 `#1e1e2e` -> 亮色 `#eff1f5`）
  - 无需新增 CSS 变量名，只需在不同主题下提供不同值
  - accent 颜色：暗色 `#89b4fa` -> 亮色 `#1e66f5`
- **D-02:** 通过 IPC 通知 + 参数化生成方案同步 webview 主题
  - 渲染进程切换主题时通过 IPC 通知主进程
  - 主进程存储当前主题值
  - `webview-server.ts` 的 `generateHostHTML()` 接收主题参数，动态生成对应颜色的 CSS 和 `--vscode-*` 变量覆盖
  - 已打开的 webview 需刷新才能应用新主题（可接受，主题切换不频繁）
- **D-03:** 全面迁移所有硬编码颜色到 CSS 变量
  - ChatPanel.vue 约 30 处硬编码 hex -> 替换为 `var(--xxx)` 引用
  - ConfirmDialog.vue hover 颜色 -> CSS 变量
  - notification/index.html -> CSS 变量或参数化
  - webview-server.ts 内联 CSS -> 参数化生成
  - 可能需新增少量辅助变量（如 `--bg-hover`, `--border-hover`）
- **D-04:** 使用 Electron nativeTheme API + CSS prefers-color-scheme 双重检测
  - 主进程监听 `nativeTheme.on('updated')` 事件
  - 通过 IPC 通知渲染进程切换主题
  - 渲染进程用 CSS `@media (prefers-color-scheme)` 作为后备
  - 主进程同步更新 BrowserWindow 背景色
- **D-05:** CSS 变量切换方案 — 在 `<html>` 元素上添加 `data-theme` 属性
  - `data-theme="dark"` — Catppuccin Mocha
  - `data-theme="light"` — Catppuccin Latte
  - `data-theme="system"` — 根据 nativeTheme 检测结果应用 dark 或 light
  - `main.css` 中使用 `[data-theme="dark"]` 和 `[data-theme="light"]` 选择器定义两套变量值
- **D-06:** 设置 store 新增 `theme: 'dark' | 'light' | 'system'` 字段，持久化到 localStorage
  - 复用现有 `settings.ts` 的 `update(patch)` 方法
- **D-07:** SettingsDrawer.vue 添加主题切换区域（三个选项：暗色/亮色/跟随系统）

### Claude's Discretion
- Catppuccin Latte 与 Mocha 之间具体变量值的微调
- 通知窗口主题同步的具体实现方式
- 主题切换时的过渡动画（是否需要平滑过渡）
- 硬编码颜色迁移时新增辅助变量的命名

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UX-06 | 支持多种视觉主题，用户可根据环境切换外观风格。三种预设主题：暗色(Catppuccin Mocha) / 亮色(Catppuccin Latte) / 跟随 Windows 系统。所有 UI 元素（包括 webview）样式一致。 | Catppuccin Latte 配色已验证(VERIFIED)、CSS 变量切换模式已确认、nativeTheme API 已查证、硬编码颜色审计完成 |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CSS 变量双主题定义 | Browser / Client | — | 纯 CSS 层，`[data-theme]` 选择器在 `<html>` 元素上切换 |
| 主题偏好持久化 | Browser / Client | — | Pinia store + localStorage，无需服务端 |
| 系统主题检测 | Electron Main | — | `nativeTheme.shouldUseDarkColors` + `nativeTheme.on('updated')` 仅主进程可用 |
| 主题 IPC 通信 | Electron Main | Browser / Client | 主进程检测系统主题变化 -> IPC 转发渲染进程；渲染进程用户选择 -> IPC 通知主进程 |
| BrowserWindow 背景色 | Electron Main | — | `BrowserWindow({ backgroundColor })` 在创建时设置，需动态更新 |
| Webview 主题注入 | Electron Main | — | `generateHostHTML()` 在主进程执行，需参数化生成 |
| 通知窗口主题注入 | Electron Main | — | 通知是独立 BrowserWindow，通过 URL 参数传递主题 |
| 硬编码颜色迁移 | Browser / Client | — | `.vue` 组件 scoped CSS 中的 hex 替换为 `var()` |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron nativeTheme | 35.x (项目版本) | 系统主题检测 | Electron 内置 API，无需额外依赖 [VERIFIED: Context7] |
| CSS Custom Properties | 原生 | 主题变量切换 | 浏览器原生支持，Electron Chromium 内核完全兼容 [ASSUMED] |
| Pinia | 项目已有 | 主题偏好状态管理 | 已在 settings.ts 中使用，直接扩展 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @catppuccin/palette | 1.8.0 | 官方配色参考 | 验证颜色值时参考（不需要安装为依赖） |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| data-theme 属性切换 | CSS `prefers-color-scheme` 媒体查询 | 媒体查询仅支持系统主题，不支持用户手动选择。data-theme 方案覆盖三种模式更灵活 |
| 手动维护颜色对照表 | @catppuccin/palette npm 包导入 | 包体积增加，而颜色值固定不变，直接硬编码对照表更简洁 |

**Installation:**
```bash
# 无需安装新依赖 — 使用项目已有的 Electron、Vue、Pinia
# @catppuccin/palette 仅作参考，不作为运行时依赖
```

**Version verification:**
```bash
npm view @catppuccin/palette version
# 1.8.0 (已验证，用于参考 Latte 配色值)
```

## Architecture Patterns

### System Architecture Diagram

```
用户选择主题 (SettingsDrawer)
    |
    v
渲染进程 (settings store)
    |-- 更新 data-theme 属性 <html data-theme="dark|light|system">
    |-- CSS 变量自动切换 (main.css)
    |-- 所有 Vue 组件自动适配 (var(--xxx))
    |
    |-- [IPC] theme:changed --> 主进程
    |                              |
    |                              |-- 存储当前 resolved 主题值
    |                              |-- 更新 BrowserWindow backgroundColor
    |                              |-- 传递给 webview-server (参数化 HTML 生成)
    |                              |-- 传递给 notification-manager (URL 参数)
    |
系统主题变化 (Windows)
    |
    v
主进程 (nativeTheme.on('updated'))
    |-- 检测 nativeTheme.shouldUseDarkColors
    |-- [IPC] theme:system-changed --> 渲染进程
    |                                    |
    |                                    |-- 若用户选择 "system" -> 自动切换 data-theme
    |                                    |-- 若用户选择 "dark"/"light" -> 不响应
```

### Recommended Project Structure
```
src/
├── renderer/src/
│   ├── assets/
│   │   └── main.css              # 扩展 [data-theme="light"] 变量值
│   ├── components/
│   │   ├── ChatPanel.vue         # ~30 处硬编码迁移
│   │   ├── ConfirmDialog.vue     # 2 处硬编码迁移
│   │   └── SettingsDrawer.vue    # 新增主题切换区域
│   ├── stores/
│   │   └── settings.ts           # 新增 theme 字段
│   ├── main.ts                   # 主题初始化逻辑
│   └── index.html                # html 元素添加 data-theme
├── main/
│   ├── index.ts                  # nativeTheme 监听 + backgroundColor 动态化
│   ├── claude/
│   │   └── webview-server.ts     # generateHostHTML() 参数化
│   ├── ipc/
│   │   └── claude-webview.ts     # 可能需要新增主题 IPC 通道
│   └── notification/
│       └── notification-manager.ts  # 传递主题参数给通知窗口
├── preload/
│   └── index.ts                  # 新增主题相关 IPC 桥接
└── notification/
    └── index.html                # 参数化主题支持
```

### Pattern 1: CSS 变量双主题定义
**What:** 在 `main.css` 中使用 `[data-theme]` 属性选择器为同一变量名提供两套值
**When to use:** 所有需要跟随主题变化的颜色值
**Example:**
```css
/* 默认（暗色）— 保持现有 :root 不变 */
:root,
[data-theme="dark"] {
  --bg-primary: #1e1e2e;
  --bg-secondary: #181825;
  --bg-tertiary: #313244;
  --text-primary: #cdd6f4;
  --text-secondary: #a6adc8;
  --text-muted: #6c7086;
  --accent: #89b4fa;
  --accent-hover: #74c7ec;
  --border: #45475a;
  --success: #a6e3a1;
  --error: #f38ba8;
  --warning: #fab387;
  --sidebar-width: 260px;
  --titlebar-height: 36px;
  --statusbar-height: 24px;
  --terminal-default-height: 200px;
}

/* 亮色主题 — Catppuccin Latte */
[data-theme="light"] {
  --bg-primary: #eff1f5;
  --bg-secondary: #e6e9ef;
  --bg-tertiary: #ccd0da;
  --text-primary: #4c4f69;
  --text-secondary: #5c5f77;
  --text-muted: #9ca0b0;
  --accent: #1e66f5;
  --accent-hover: #209fb5;
  --border: #bcc0cc;
  --success: #40a02b;
  --error: #d20f39;
  --warning: #fe640b;
  /* 非颜色变量（尺寸）不需要覆盖 */
}
```
Source: [VERIFIED: @catppuccin/palette@1.8.0 css/catppuccin.css]

### Pattern 2: 主题初始化与切换
**What:** 在渲染进程初始化时读取 store 设置，应用 data-theme；切换时更新 store + DOM
**When to use:** 应用启动、用户切换主题、系统主题变化时
**Example:**
```typescript
// settings.ts 扩展
export type ThemeMode = 'dark' | 'light' | 'system'

export interface SettingsState {
  // ... 现有字段
  theme: ThemeMode  // 新增
}

const DEFAULTS: SettingsState = {
  // ... 现有默认值
  theme: 'dark'  // 新增
}

// 主题切换辅助函数（在 main.ts 或 settings store 中）
function applyTheme(mode: ThemeMode): void {
  let resolved: 'dark' | 'light'
  if (mode === 'system') {
    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } else {
    resolved = mode
  }
  document.documentElement.setAttribute('data-theme', resolved)
}
```

### Pattern 3: 主进程 nativeTheme 监听
**What:** 主进程监听系统主题变化，通过 IPC 通知渲染进程
**When to use:** 用户选择 "跟随系统" 模式时，系统主题变化需响应
**Example:**
```typescript
// src/main/index.ts
import { nativeTheme } from 'electron'

// 监听系统主题变化
nativeTheme.on('updated', () => {
  const isDark = nativeTheme.shouldUseDarkColors
  mainWindow.webContents.send('theme:system-changed', isDark ? 'dark' : 'light')
  // 同步更新窗口背景色
  mainWindow.setBackgroundColor(isDark ? '#1e1e2e' : '#eff1f5')
})
```
Source: [VERIFIED: Context7 - Electron nativeTheme docs]

### Pattern 4: 通知窗口主题参数化
**What:** notification-manager 创建通知时传递当前主题作为 URL 查询参数
**When to use:** 每次创建通知 BrowserWindow
**Example:**
```typescript
// notification-manager.ts 修改
const params = new URLSearchParams({
  id,
  type: options.type,
  title: options.title,
  body: options.body,
  toolName: options.toolName || '',
  theme: currentTheme  // 'dark' 或 'light'
})

// notification/index.html 读取参数
var theme = params.get('theme') || 'dark'
var colors = theme === 'light'
  ? { bg: '#eff1f5', border: '#bcc0cc', text: '#4c4f69', subtext: '#5c5f77', accent: '#1e66f5' }
  : { bg: '#1e1e2e', border: '#45475a', text: '#cdd6f4', subtext: '#a6adc8', accent: '#89b4fa' }
```

### Anti-Patterns to Avoid
- **在 JS 中手动切换每个颜色值:** 应该只切换 `data-theme` 属性，让 CSS 变量系统处理所有颜色变化。手动维护 JS 颜色映射表容易遗漏且难以维护
- **使用 `:root` 和 `.light` 类名切换:** `[data-theme]` 属性选择器语义更清晰，且支持 `system` 中间状态映射到 `dark`/`light`
- **安装 CSS-in-JS 库:** 项目使用纯 CSS 变量 + Vue scoped CSS，无需引入额外样式库
- **给每个组件单独做主题适配:** 应该在全局 `main.css` 定义变量，组件只引用变量。组件无需知道当前主题

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 系统暗色模式检测 | 自定义 Windows API 调用或定时轮询 | `nativeTheme.shouldUseDarkColors` | Electron 内置，跨平台，实时响应系统变化 [VERIFIED: Context7] |
| CSS 变量主题切换 | JS 动态修改每条 CSS 规则 | `[data-theme]` 属性选择器 + CSS 自定义属性 | 声明式，浏览器原生支持，性能好 |
| 主题持久化 | 自定义文件存储 | Pinia store + localStorage（已有模式） | 复用现有 settings.ts 框架 |
| Catppuccin 配色值 | 自行调色 | @catppuccin/palette 官方色板 | 确保与 Catppuccin 生态一致，避免视觉偏差 [VERIFIED: npm @catppuccin/palette@1.8.0] |

**Key insight:** 整个主题系统不引入任何新依赖。Electron nativeTheme 是内置 API，CSS 变量是原生特性，Pinia store 已有框架。只需添加正确的 CSS 值和胶水代码。

## Common Pitfalls

### Pitfall 1: rgba() 中使用主题相关颜色的 opacity 变体
**What goes wrong:** 亮色主题下，`rgba(24, 24, 37, 0.95)` 这样的硬编码 rgba 值仍然显示暗色背景
**Why it happens:** rgba 值是独立的颜色通道值，不受 CSS 变量影响
**How to avoid:** 将所有 `rgba()` 迁移为 `color-mix(in srgb, var(--bg-secondary) 95%, transparent)` 或新增辅助变量如 `--bg-secondary-a95`
**Warning signs:** 组件在亮色主题下出现暗色半透明背景块

### Pitfall 2: BrowserWindow 背景色闪烁
**What goes wrong:** 应用启动时短暂显示白色（默认背景）再变为暗色
**Why it happens:** BrowserWindow 创建时的 `backgroundColor` 在 HTML 加载前就决定了可见颜色
**How to avoid:** 在 `createWindow()` 时根据当前主题设置 `backgroundColor`；主题切换时也要同步更新
**Warning signs:** 启动闪白屏，或切换主题后重新打开窗口时背景色不对

### Pitfall 3: 通知窗口和主应用主题不同步
**What goes wrong:** 用户切换到亮色主题后，弹出的通知仍然是暗色
**Why it happens:** 通知窗口是独立的 BrowserWindow，不共享渲染进程的 CSS 变量
**How to avoid:** notification-manager.ts 每次创建通知时从主进程获取当前 resolved 主题值，通过 URL 参数传递
**Warning signs:** 通知颜色与主窗口不一致

### Pitfall 4: Webview 已打开页面主题不更新
**What goes wrong:** 用户切换主题后，已打开的 Claude webview 仍然是旧主题颜色
**Why it happens:** webview HTML 在创建时一次性生成，不会自动响应主题变化
**How to avoid:** 这是已知可接受的行为（CONTEXT.md D-02 确认）。新打开的 webview 使用新主题即可
**Warning signs:** 这是预期行为，不需要修复

### Pitfall 5: data-theme="system" 不应直接作为 CSS 选择器值
**What goes wrong:** 如果 `data-theme="system"` 传到 DOM，CSS 中没有 `[data-theme="system"]` 选择器
**Why it happens:** CSS 只需要知道最终是 dark 还是 light，不需要知道是否是"系统"模式
**How to avoid:** "system" 是存储值，但应用到 DOM 时必须 resolve 为 "dark" 或 "light"
**Warning signs:** 切换到"跟随系统"后所有颜色回到默认值

### Pitfall 6: ChatPanel.vue 中 `rgba()` 值的完整迁移
**What goes wrong:** 只迁移了 hex 颜色，忽略了 `rgba(24, 24, 37, 0.95)` 这类带透明度的暗色
**Why it happens:** grep 搜索 `#[0-9a-f]` 模式不会匹配 rgba 格式
**How to avoid:** 同时搜索 `rgba(` 模式，识别所有硬编码颜色通道值
**Warning signs:** 亮色模式下出现暗色半透明覆盖层

## Code Examples

### Catppuccin Mocha -> Latte 完整颜色对照表（已验证）
```css
/* 来源: @catppuccin/palette@1.8.0 — VERIFIED by npm package CSS file */

/* 语义变量       Mocha (暗色)      Latte (亮色)      Catppuccin 名称 */
/* --bg-primary   #1e1e2e           #eff1f5           Base */
/* --bg-secondary #181825           #e6e9ef           Mantle */
/* --bg-tertiary  #313244           #ccd0da           Surface0 */
/* --text-primary #cdd6f4           #4c4f69           Text */
/* --text-secondary #a6adc8         #5c5f77           Subtext1 */
/* --text-muted   #6c7086           #9ca0b0           Overlay0 */
/* --accent       #89b4fa           #1e66f5           Blue */
/* --accent-hover #74c7ec           #209fb5           Sapphire */
/* --border       #45475a           #bcc0cc           Surface1 */
/* --success      #a6e3a1           #40a02b           Green */
/* --error        #f38ba8           #d20f39           Red */
/* --warning      #fab387           #fe640b           Peach */
```

### ChatPanel.vue 硬编码颜色迁移示例
```css
/* 迁移前 */
.tab-bar {
  background: #181825;
  border-bottom: 1px solid #45475a;
}
.tab-item {
  color: #a6adc8;
}
.tab-item:hover {
  background: #1e1e2e;
}

/* 迁移后 */
.tab-bar {
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
}
.tab-item {
  color: var(--text-secondary);
}
.tab-item:hover {
  background: var(--bg-primary);
}
```

### 新增辅助变量（可能需要）
```css
:root,
[data-theme="dark"] {
  /* 现有变量 */
  --bg-primary: #1e1e2e;
  --border: #45475a;

  /* 新增辅助变量 */
  --bg-hover: #45475a;        /* Surface1 — 悬停背景 */
  --border-hover: #585b70;    /* Surface2 — 悬停边框 */
  --bg-overlay: rgba(30, 30, 46, 0.95);  /* 半透明覆盖 */
}

[data-theme="light"] {
  /* 对应 Latte 值 */
  --bg-hover: #bcc0cc;        /* Surface1 */
  --border-hover: #acb0be;    /* Surface2 */
  --bg-overlay: rgba(239, 241, 245, 0.95);  /* 半透明覆盖 */
}
```

### webview-server.ts 参数化签名变更
```typescript
// 迁移前
function generateHostHtml(_extensionPath: string): string

// 迁移后
function generateHostHtml(
  _extensionPath: string,
  theme: 'dark' | 'light' = 'dark'
): string
```

### preload/index.ts 新增主题 IPC 桥接
```typescript
// 新增到 api 对象中
onThemeSystemChanged: (callback: (resolvedTheme: 'dark' | 'light') => void): (() => void) => {
  const handler = (_event: Electron.IpcRendererEvent, theme: string): void => callback(theme as 'dark' | 'light')
  ipcRenderer.on('theme:system-changed', handler)
  return () => ipcRenderer.removeListener('theme:system-changed', handler)
},
updateTheme: (mode: 'dark' | 'light' | 'system'): void =>
  ipcRenderer.send('theme:update', mode),
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `systemPreferences.isDarkMode()` | `nativeTheme.shouldUseDarkColors` | Electron 13 (2021) | 旧 API 已移除，必须使用 nativeTheme |
| CSS `@media (prefers-color-scheme)` only | `data-theme` 属性切换 | — | 允许用户手动覆盖系统偏好 |
| 单一暗色主题硬编码 | CSS 变量双主题 | 本阶段 | 需要迁移所有硬编码颜色 |

**Deprecated/outdated:**
- `systemPreferences.isDarkMode()`: Electron 13 已移除，替换为 `nativeTheme.shouldUseDarkColors` [VERIFIED: Context7]
- `systemPreferences.setAppLevelAppearance()`: 已移除，替换为 `nativeTheme.themeSource` [VERIFIED: Context7]

## Hardcoded Color Audit

### ChatPanel.vue (约 30+ 处)
以下是需要迁移的硬编码颜色完整列表（来自代码审计）：

| 硬编码值 | 出现次数 | 应替换为 | 上下文 |
|---------|---------|---------|--------|
| `#181825` | ~5 | `var(--bg-secondary)` | tab bar 背景、session history 背景 |
| `#1e1e2e` | ~6 | `var(--bg-primary)` | hover 背景、active tab 背景 |
| `#313244` | ~3 | `var(--bg-tertiary)` | hover 边框、输入框背景 |
| `#45475a` | ~4 | `var(--border)` | 边框、分隔线 |
| `#cdd6f4` | ~3 | `var(--text-primary)` | 文字颜色 |
| `#a6adc8` | ~2 | `var(--text-secondary)` | 次要文字 |
| `#89b4fa` | ~3 | `var(--accent)` | 活跃标签底线、状态图标 |
| `#f38ba8` | ~1 | `var(--error)` | 错误状态 |
| `#f9e2af` | ~1 | `var(--warning)` (或新增 `--warning-bright`) | 警告状态 |
| `#74c7ec` | ~1 | `var(--accent-hover)` | 链接 hover |
| `rgba(24, 24, 37, 0.95)` | ~1 | `var(--bg-overlay)` (需新增) | 无响应覆盖层 |
| `rgba(24, 24, 37, 0.8)` | ~1 | 需新增辅助变量 | 加载覆盖层 |
| `rgba(0, 0, 0, 0.3)` | ~1 | 可能保留（通用阴影） | box-shadow |

### ConfirmDialog.vue (2 处)
| 硬编码值 | 应替换为 | 上下文 |
|---------|---------|--------|
| `#eba0ac` | `var(--error-hover)` (需新增) | danger 按钮 hover |
| `#ffcba0` | `var(--warning-hover)` (需新增) | warning 按钮 hover |

Mocha hover 值对应：`#eba0ac` 是 Red 的亮化变体，`#ffcba0` 是 Peach 的亮化变体。
Latte hover 值建议：Red `#d20f39` -> hover `#e64553` (Maroon)，Peach `#fe640b` -> hover `#e64553` 或类似。

### notification/index.html (~20 处)
全部硬编码 Catppuccin Mocha 值。由于是独立 BrowserWindow，需参数化方案：
- `#1e1e2e` (bg) -> 参数化
- `#45475a` (border) -> 参数化
- `#cdd6f4` (text) -> 参数化
- `#a6adc8` (subtext) -> 参数化
- `#89b4fa` (accent) -> 参数化
- `#a6e3a1` (success/green) -> 参数化
- `#f38ba8` (error/red) -> 参数化
- `#181825` (input bg) -> 参数化
- `#585b70` (hover) -> 参数化

### webview-server.ts (~30+ 处 `--vscode-*` 变量)
完整的 VSCode CSS 变量映射需要两套值（dark Mocha / light Latte）。主要变量包括：
- `--vscode-editor-background` -> `#1e1e2e` / `#eff1f5`
- `--vscode-editor-foreground` -> `#cdd6f4` / `#4c4f69`
- 以及约 200+ 个其他 VSCode 变量（参见 `vscode-theme.css` 现有映射）

### UpdatePrompt.vue (rgba 问题)
- `rgba(243, 139, 168, 0.1)` — error 背景色，对应 `#f38ba8` 的低透明度
- `rgba(166, 227, 161, 0.1)` — success 背景色，对应 `#a6e3a1` 的低透明度
- 亮色主题下这些颜色需要替换为 Latte 对应值

### 已使用 CSS 变量的组件（无需迁移）
- `Sidebar.vue` — 已全部使用 `var(--xxx)`
- `TitleBar.vue` — 已全部使用 `var(--xxx)`
- `StatusBar.vue` — 已全部使用 `var(--xxx)`
- `FileTree.vue` — 已全部使用 `var(--xxx)`
- `SettingsDrawer.vue` — 已全部使用 `var(--xxx)`

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | CSS Custom Properties 在 Electron 35 Chromium 内核中完全支持 | Standard Stack | 极低风险 — CSS 变量是成熟特性 |
| A2 | 现有 14 个 CSS 变量足以覆盖所有主题需求，可能只需新增 3-5 个辅助变量 | Architecture | 如果遗漏变量，迁移时会发现并补充 |
| A3 | `nativeTheme.on('updated')` 在 Windows 10 上可靠触发 | Pattern 3 | Electron 官方文档确认支持，低风险 |

**Note:** 所有 Catppuccin 配色值已通过 `@catppuccin/palette@1.8.0` npm 包的 CSS 文件验证，不再标记为 ASSUMED。

## Open Questions

1. **vscode-theme.css 是否需要完整的 Latte 映射？**
   - What we know: 现有 `vscode-theme.css` 有 237 行 Catppuccin Mocha -> VSCode 变量映射
   - What's unclear: webview-server.ts 是否实际使用了该文件，还是内联了颜色值
   - Recommendation: 先确认 webview-server.ts 内联了多少 VSCode 变量，再决定是否需要完整映射

2. **主题过渡动画是否需要？**
   - What we know: CONTEXT.md 标记为 Claude's Discretion
   - What's unclear: 主题切换时是否需要平滑过渡（如 `transition: background-color 0.3s`）
   - Recommendation: 初始实现不加过渡动画，如果视觉反馈突兀再添加

3. **`nativeTheme.themeSource` 是否需要设置？**
   - What we know: Electron 提供 `themeSource` 属性可影响 Chromium 内部主题
   - What's unclear: 是否需要设置此属性来确保 `prefers-color-scheme` 媒体查询正确工作
   - Recommendation: 不设置，因为项目使用 `data-theme` 属性而非媒体查询作为主方案

## Environment Availability

Step 2.6: SKIPPED — 本阶段不引入外部依赖，所有技术均为项目已有（Electron nativeTheme 内置、CSS 原生、Pinia 已安装）。

## Sources

### Primary (HIGH confidence)
- @catppuccin/palette@1.8.0 — npm 包 CSS 文件中提取的完整 Latte/Mocha hex 值（VERIFIED）
- Context7 (/electron/electron) — nativeTheme API 文档：`shouldUseDarkColors`, `themeSource`, `updated` 事件（VERIFIED）
- 项目源码审计 — main.css, ChatPanel.vue, settings.ts, SettingsDrawer.vue, notification-manager.ts, webview-server.ts, preload/index.ts, index.html, notification/index.html

### Secondary (MEDIUM confidence)
- Electron breaking-changes 文档 — 确认 systemPreferences 旧 API 已移除，nativeTheme 是替代方案

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 无新依赖，使用已有技术栈
- Architecture: HIGH — 方案简单明确（data-theme 属性 + CSS 变量），复杂度低
- Pitfalls: HIGH — 基于代码审计的具体发现，rgba 遗漏和独立窗口同步是实际问题
- Color values: HIGH — 通过 @catppuccin/palette@1.8.0 npm 包 CSS 文件逐一验证

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 (30 days — CSS 变量和 Electron API 稳定)
