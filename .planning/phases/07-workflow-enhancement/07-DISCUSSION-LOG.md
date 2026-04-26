# Phase 7: 工作流增强 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-26
**Phase:** 07-workflow-enhancement
**Areas discussed:** Token 数据持久化, 统计面板展示方式, 右键菜单注册方式, 目录打开通信机制

---

## Token 数据持久化

| Option | Description | Selected |
|--------|-------------|----------|
| JSON 文件 | userData 目录下存 JSON 文件，按日汇总写入，与 close-behavior.json 模式一致 | ✓ |
| SQLite | better-sqlite3/sql.js 本地数据库，适合复杂查询但引入新依赖 | |
| IndexedDB | 渲染进程 IndexedDB 存储，数据在渲染进程丢失时不可恢复 | |

**User's choice:** JSON 文件
**Notes:** 与项目现有持久化模式一致，轻量简单

### 记录粒度

| Option | Description | Selected |
|--------|-------------|----------|
| 会话结束汇总 | 每次 channel 销毁时写入一条记录 | ✓ |
| 每次 API 调用 | 每次 stream_event 追加记录，粒度细但数据量大 | |
| 定时聚合 | 每 5 分钟聚合写入，平衡粒度和频率 | |

**User's choice:** 会话结束汇总

### 数据结构

| Option | Description | Selected |
|--------|-------------|----------|
| 按天汇总 | 每天一个汇总对象 { date, sessions: [...] } | ✓ |
| 扁平记录列表 | 所有记录放在一个数组，内存中过滤聚合 | |
| 按工作区分文件 | 每个工作区独立 JSON 文件 | |

**User's choice:** 按天汇总

### 数据清理

| Option | Description | Selected |
|--------|-------------|----------|
| 保留 90 天 | 3 个月数据，JSON 文件不会太大 | ✓ |
| 保留 30 天 | 1 个月数据，满足今日/本周/本月查询 | |
| 不清理 | 所有数据永久保留 | |

**User's choice:** 保留 90 天

---

## 统计面板展示方式

### 面板位置

| Option | Description | Selected |
|--------|-------------|----------|
| 设置面板内嵌 | SettingsDrawer 中添加 "用量统计" 分组 | ✓ |
| 独立弹出窗口 | BrowserWindow 创建独立窗口，空间更大 | |
| 标签页形式 | 侧边栏添加入口，主区域显示统计 | |

**User's choice:** 设置面板内嵌

### 图表库

| Option | Description | Selected |
|--------|-------------|----------|
| Chart.js | 轻量级 Canvas 图表（~65KB），MIT 协议，有 vue-chartjs 封装 | ✓ |
| 纯 CSS 柱状图 | div + CSS 变量实现，零依赖但交互能力有限 | |
| ECharts | 功能丰富但体积大（~800KB），对小面板过重 | |

**User's choice:** Chart.js

### 预警线

| Option | Description | Selected |
|--------|-------------|----------|
| 设置中可配置阈值 | 阈值输入框 + 超标警告色 | |
| 固定默认阈值 | 硬编码默认值，不可配置 | |
| 无预警线 | 仅展示数据，不做预警 | ✓ |

**User's choice:** 无预警线

### 工作区分组展示

| Option | Description | Selected |
|--------|-------------|----------|
| 汇总下方列表 | 总用量卡片下方列工作区明细，点击展开趋势图 | ✓ |
| 下拉筛选 | 图表上方下拉框切换工作区 | |
| 仅汇总卡片 | 只显示 TOP 3 工作区，无交互 | |

**User's choice:** 汇总下方列表

---

## 右键菜单注册方式

### 注册方式

| Option | Description | Selected |
|--------|-------------|----------|
| NSIS + 应用代码双重 | 安装脚本写入 + 首次启动检查补注册，互为保障 | ✓ |
| 仅应用代码注册 | 首次启动时用 Node.js 写入注册表 | |
| 仅 NSIS 脚本注册 | 纯安装脚本，运行时无法修复 | |

**User's choice:** NSIS + 应用代码双重注册

### 右键菜单范围

| Option | Description | Selected |
|--------|-------------|----------|
| 文件夹右键 | HKCR\Directory\shell | ✓ |
| 文件夹背景右键 | HKCR\Directory\Background\shell | ✓ |
| 驱动器右键 | HKCR\Drive\shell | |

**User's choice:** 文件夹右键 + 文件夹背景右键（多选）

### 菜单图标

| Option | Description | Selected |
|--------|-------------|----------|
| 显示图标 | 注册表指定 exe 图标路径，视觉效果好 | ✓ |
| 不显示图标 | 纯文字菜单项，实现简单 | |

**User's choice:** 显示图标

---

## 目录打开通信机制

### 单实例通信

| Option | Description | Selected |
|--------|-------------|----------|
| requestSingleInstanceLock | Electron 内置单实例锁 + second-instance 事件传 argv | ✓ |
| 本地 Socket 通信 | 监听本地端口，更灵活但需端口管理 | |
| 文件锁 + 轮询 | 写锁文件 + 临时文件，有时序问题 | |

**User's choice:** requestSingleInstanceLock

### 目录打开行为

| Option | Description | Selected |
|--------|-------------|----------|
| 打开新标签页 | 在当前窗口创建新标签页并切换到目录 | ✓ |
| 切换工作区并提示 | 切换当前标签页工作区，弹出确认 | |
| 仅设置工作区 | 只更新工作目录，不创建新标签页 | |

**User's choice:** 打开新标签页

---

## Claude's Discretion

- JSON 文件的具体字段命名和文件名
- Chart.js 柱状图样式细节（颜色、间距、动画）
- 统计面板布局细节（卡片排列、数字格式化）
- NSIS 安装脚本的具体注册表键名和值
- 右键菜单项中文文案
- 工作区列表排序方式

## Deferred Ideas

None — discussion stayed within phase scope
