# Roadmap: AI Tools - UX Enhancement

## Overview

在已完成 429 Bug 修复和基础 UX 增强后，全面升级桌面客户端用户体验。从快速取胜功能开始，逐步扩展到多窗口、对话分支、微信公众号集成等高级特性。

## Phases

**Phase Numbering:**
- Phases 1-3: 已完成（Bug 修复 + 基础 UX）
- Phases 4-9: UX 增强新规划

- [x] **Phase 1: Root Cause Fix** - Remove modelUsage/total_cost_usd injection, verify 429 resolved
- [x] **Phase 2: Defensive Hardening** - Deep-copy messages, cache settings reads
- [x] **Phase 3: UX Enhancement** - 错误恢复、键盘快捷键、操作确认、进程监控、标签页增强、文件树增强、安全加固
- [x] **Phase 4: Quick Wins** - 交互式通知、托盘图标、声音提示、全局缩放、自动更新 (2026-04-26)
- [x] **Phase 5: 主题个性化** - 主题系统（暗色/亮色/跟随系统） (2026-04-26)
- [ ] **Phase 6: 知识管理** - 对话导出、剪贴板增强
- [ ] **Phase 7: 工作流增强** - Token 用量统计、Windows 右键菜单集成
- [ ] **Phase 8: 高级特性** - 多窗口支持、对话分支
- [ ] **Phase 9: 远程访问** - 微信公众号集成

## Phase Details

### Phase 1: Root Cause Fix
**Goal**: Users can send messages and receive responses without hitting 429 rate limit errors
**Depends on**: Nothing (first phase)
**Requirements**: FIX-01, FIX-02, KEEP-01
**Success Criteria**:
  1. User can send a message and receive a complete response without any 429 error
  2. The `result` messages forwarded to the webview contain no injected `modelUsage` or `total_cost_usd` fields
  3. The context usage badge still displays token usage percentage
**Plans**: 1 plan (Complete)

### Phase 2: Defensive Hardening
**Goal**: The message pipeline does not mutate CLI output and does not block the event loop
**Depends on**: Phase 1
**Requirements**: FIX-03, PERF-01
**Success Criteria**:
  1. Messages forwarded to the webview are deep copies
  2. `getClaudeSettings()` results are cached
**Plans**: 1 plan (Complete)

### Phase 3: UX Enhancement
**Goal**: 全面提升桌面客户端用户体验
**Depends on**: Phase 2
**Success Criteria**:
  1. Webview 初始化失败时显示重试按钮
  2. 会话删除/关闭活跃标签/切换工作区前均有确认对话框
  3. 完整键盘快捷键集正常工作
  4. Claude 进程崩溃后自动重连并恢复会话状态
  5. 每 30 秒心跳检测进程存活
  6. 标签页显示智能标题和状态指示器
  7. 侧边栏宽度可调整、文件树支持搜索过滤
  8. deleteSession 验证 UUID 格式，iframe sandbox 安全加固
**Plans**: 6 plans (Complete)

### Phase 4: Quick Wins
**Goal**: 用最少代码实现用户可感知的体验提升，包括交互式通知、托盘常驻、声音反馈、全局缩放和自动更新
**Depends on**: Phase 3
**Requirements**: UX-01 ~ UX-05

**功能清单:**

**F1: 系统通知 + 交互式通知 (UX-01)**
- 三种通知场景: 回复完成、工具权限请求、异常错误
- 交互式通知: 用户可直接在通知上操作（允许/拒绝权限、选择方案 A/B/C、文本回复）
- 无需跳转回应用即可完成操作
- 窗口在前台时不重复发送通知
- 设置页面可按事件类型单独开关
- 点击通知跳转到对应标签页

**F2: 托盘图标 (UX-02)**
- Windows 系统托盘常驻图标
- 首次关闭窗口时询问: 最小化到托盘 or 退出应用，记住用户选择
- 右键菜单: 新建对话 / 显示窗口 / 退出
- 双击托盘图标恢复窗口

**F3: 声音提示 (UX-03)**
- 事件音效: 回复完成、工具权限请求、错误
- 默认关闭，设置页面按事件类型单独控制
- 使用轻量级自定义音效文件
- 音量可调

**F5: 全局缩放 (UX-04)**
- 全局字体缩放（类似浏览器行为），所有 UI 统一调整
- Ctrl + 鼠标滚轮快速缩放
- 设置页面精确调整滑块
- Ctrl+0 重置默认大小
- 缩放比例持久化到 localStorage

**F6: 自动更新 (UX-05)**
- 从 GitHub Releases 检查新版本
- 发现新版本后弹出提示，显示版本号和更新内容
- 用户手动确认后下载
- 下载完成后提示重启安装
- 下载进度显示

**Plans**: 5 plans (Complete)

Plans:
- [x] 04-01-PLAN.md — Settings store + Settings drawer UI + title bar gear icon
- [x] 04-02-PLAN.md — System tray icon with smart close behavior
- [x] 04-03-PLAN.md — Sound playback + global zoom composables
- [x] 04-04-PLAN.md — Interactive notification system (custom BrowserWindow)
- [x] 04-05-PLAN.md — Auto-update via electron-updater + GitHub Releases

**Success Criteria**:
  1. Claude 回复完成、工具权限请求、异常错误时发送 Windows 原生通知
  2. 通知上可直接操作（允许/拒绝权限、选择方案、文本回复），无需跳转
  3. 关闭窗口时最小化到托盘，右键菜单可操作
  4. 声音提示可按事件类型独立开关
  5. Ctrl+滚轮全局缩放，比例持久化
  6. 应用可检测新版本并提示更新

### Phase 5: 主题个性化
**Goal**: 支持多种视觉主题，用户可根据环境切换外观风格
**Depends on**: Phase 4
**Requirements**: UX-06

**功能清单:**

**F7: 主题系统 (UX-06)**
- 三种预设主题: 暗色(Catppuccin) / 亮色 / 跟随 Windows 系统
- 跟随系统模式自动适配 Windows 明暗设置
- 设置页面切换主题

**Plans**: 3 plans (Complete)

Plans:
- [x] 05-01-PLAN.md — CSS 变量双主题 + 设置 store + preload IPC + 主题初始化 + 设置面板主题 UI
- [x] 05-02-PLAN.md — 硬编码颜色迁移 (ChatPanel/ConfirmDialog/UpdatePrompt/SettingsDrawer)
- [x] 05-03-PLAN.md — 主进程 nativeTheme + webview 参数化 + 通知窗口主题同步

**Success Criteria**:
  1. 暗色、亮色、跟随系统三种主题均可正常切换
  2. 切换主题后所有 UI 元素（包括 webview）样式一致
  3. 跟随系统模式下主题随 Windows 设置自动变化

### Phase 6: 知识管理
**Goal**: 让对话内容可导出复用，剪贴板操作更高效
**Depends on**: Phase 5
**Requirements**: UX-07, UX-08

**功能清单:**

**F10: 对话导出 (UX-07)**
- 导出为 Markdown 格式
- 保留代码块和基本格式
- 标签右键菜单触发"导出对话"
- 选择保存位置

**F11: 剪贴板增强 (UX-08)**
- 记录最近复制内容，快捷键唤起列表快速插入
- 收藏功能: 用户可将常用内容收藏为片段，快速重复使用
- 输入框右键或快捷键唤起

**Plans**: 4 plans

Plans:
- [ ] 06-01-PLAN.md — 导出后端 IPC 管线 (dialog:showSaveDialog + claude:export-session + Markdown 格式化)
- [ ] 06-02-PLAN.md — 剪贴板数据层 (clipboard store + snippet store + useClipboard composable)
- [ ] 06-03-PLAN.md — 对话导出前端 (ContextMenu 组件 + 标签右键菜单 + 导出触发)
- [ ] 06-04-PLAN.md — 剪贴板面板 UI (ClipboardPanel 组件 + 快捷键注册 + ChatPanel 集成)

**Success Criteria**:
  1. 任意会话可导出为完整 Markdown 文件
  2. 剪贴板历史记录可唤起并快速插入
  3. 收藏的片段可随时调用

### Phase 7: 工作流增强
**Goal**: 增强日常使用效率，Token 用量可视化和系统级集成
**Depends on**: Phase 6
**Requirements**: UX-09, UX-10

**功能清单:**

**F13: Token 用量统计面板 (UX-09)**
- 今日/本周/本月总用量汇总
- 每日用量趋势图（柱状图）
- 按工作区分组统计
- 用量预警线

**F22: Windows 右键菜单集成 (UX-10)**
- 右键点击文件夹 → "使用 AI Tools 打开"
- 在文件夹空白处右键 → "使用 AI Tools 打开当前目录"
- 应用未启动时启动应用并切换到该目录
- 应用已启动时在已有窗口中打开该目录
- 安装/卸载时自动注册/清理注册表

**Success Criteria**:
  1. Token 用量统计面板正确显示汇总数据和趋势图
  2. Windows 资源管理器右键菜单显示"使用 AI Tools 打开"
  3. 通过右键菜单打开的目录正确设为工作目录

### Phase 8: 高级特性
**Goal**: 多窗口并行和对话分支探索，面向深度用户
**Depends on**: Phase 7
**Requirements**: UX-11, UX-12

**功能清单:**

**F19: 多窗口支持 (UX-11)**
- 支持同时打开多个独立窗口
- 每个窗口独立工作区和会话
- 共享全局配置（设置、扩展）
- 任务栏多窗口预览

**F20: 对话分支 (UX-12)**
- 从对话中任意历史消息分支新对话
- 树状结构显示分支关系
- 分支对话在标签栏有层级标识
- 可在不同分支间切换

**Success Criteria**:
  1. 多个窗口可独立运行不同工作区的对话
  2. 从任意消息可创建分支，分支关系可视化
  3. 窗口间状态隔离，配置共享

### Phase 9: 远程访问
**Goal**: 通过微信公众号实现移动端远程使用 AI Tools
**Depends on**: Phase 8
**Requirements**: UX-13

**功能清单:**

**F23: 微信公众号集成 (UX-13)**
- 用户关注公众号后，在公众号对话中发消息 → 转发给 AI 处理 → 回复结果
- 支持文字问答
- 支持工作区管理（切换工作区、查看会话列表）
- 代码在回复中用代码块格式展示

**Success Criteria**:
  1. 微信公众号可接收用户消息并转发给 AI 处理
  2. AI 回复正确返回到微信对话中
  3. 可通过微信命令切换工作区和查看会话列表

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Root Cause Fix | 1/1 | Complete | 2026-04-24 |
| 2. Defensive Hardening | 1/1 | Complete | 2026-04-24 |
| 3. UX Enhancement | 6/6 | Complete | 2026-04-25 |
| 4. Quick Wins | 5/5 | Complete | 2026-04-26 |
| 5. 主题个性化 | 3/3 | Complete | 2026-04-26 |
| 6. 知识管理 | 0/4 | Not started | - |
| 7. 工作流增强 | 0/- | Not started | - |
| 8. 高级特性 | 0/- | Not started | - |
| 9. 远程访问 | 0/- | Not started | - |

## Feature Summary

| # | 功能 | Phase | 复杂度 |
|---|------|-------|--------|
| F1+F24 | 系统通知 + 交互式通知 | 4 | 低~中 |
| F2 | 托盘图标 | 4 | 极低 |
| F3 | 声音提示 | 4 | 极低 |
| F5 | 全局缩放 | 4 | 低 |
| F6 | 自动更新 | 4 | 低 |
| F7 | 主题系统 | 5 | 低~中 |
| F10 | 对话导出 (Markdown) | 6 | 中 |
| F11 | 剪贴板增强 + 收藏 | 6 | 中 |
| F13 | Token 用量统计面板 | 7 | 中 |
| F22 | Windows 右键菜单集成 | 7 | 中 |
| F19 | 多窗口支持 | 8 | 高 |
| F20 | 对话分支 | 8 | 高 |
| F23 | 微信公众号集成 | 9 | 高 |
