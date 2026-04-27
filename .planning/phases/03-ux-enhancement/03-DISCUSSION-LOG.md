# Phase 3: UX Enhancement - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 03-ux-enhancement
**Areas discussed:** 错误恢复, 键盘快捷键, 确认对话框, 进程健康监控, 标签页增强, 文件树增强, 安全修补

---

## 错误恢复机制

| Option | Description | Selected |
|--------|-------------|----------|
| 全面错误恢复 | webview 重试按钮 + 会话删除确认 + 扩展加载错误提示 + 会话列表错误提示 | ✓ |
| 仅 Webview 重试 | 只在 webview 初始化失败加重试按钮 | |
| 你来决定 | Claude 决定具体方案和范围 | |

**User's choice:** 全面错误恢复
**Notes:** 用户明确要求所有错误都有恢复路径

---

## 键盘快捷键

| Option | Description | Selected |
|--------|-------------|----------|
| 完整快捷键集 | Ctrl+N/W/B + Shift+N + Ctrl+Tab 全套 | ✓ |
| 最小快捷键集 | 只加 Ctrl+N、Ctrl+W、Ctrl+B | |
| 你来决定 | Claude 决定快捷键集合 | |

**User's choice:** 完整快捷键集（与 VS Code / 浏览器习惯一致）

---

## 确认对话框

| Option | Description | Selected |
|--------|-------------|----------|
| 删除会话确认 | 防止误删 | ✓ (implied) |
| 关闭活跃标签确认 | 防止意外终止进程 | ✓ (implied) |
| 切换工作区警告 | 有活跃进程时提示 | ✓ (implied) |

**Notes:** 作为全面错误恢复的一部分，自动纳入。使用自定义 Vue 组件（非 window.confirm）。

---

## Claude 进程健康监控与自动恢复

| Option | Description | Selected |
|--------|-------------|----------|
| 自动重连+会话恢复 | 崩溃后自动重启并恢复，用户看到"正在恢复..." | ✓ |
| 手动重连按钮 | 显示断开提示，用户点击重连 | |

**User's choice:** 自动重连+会话恢复

### 心跳检测

| Option | Description | Selected |
|--------|-------------|----------|
| 定时心跳检测 | 每 30 秒检查进程存活，挂死时通知并提供重启按钮 | ✓ |
| 被动检测 | 只在用户操作时发现不响应 | |

**User's choice:** 定时心跳检测

---

## 标签页增强

| Option | Description | Selected |
|--------|-------------|----------|
| 智能标签名 | 从会话摘要提取标题 | ✓ |
| 标签状态指示器 | 绿/黄/灰点表示运行/等待/空闲 | ✓ |
| 标签拖拽+中键关闭 | 中键关闭和拖拽排序 | ✓ |
| 上下文用量展示 | 状态栏显示 token 用量 | |

**User's choice:** 智能标签名 + 标签状态指示器 + 标签拖拽+中键关闭（未选上下文用量展示）

---

## 文件树与侧边栏增强

| Option | Description | Selected |
|--------|-------------|----------|
| 文件搜索过滤 | 搜索框实时过滤文件/目录名 | ✓ |
| 文件系统监听 | chokidar 监听工作区变更，自动刷新 | ✓ |
| 侧边栏可调整宽度 | 拖拽手柄 + localStorage 持久化 | ✓ |
| 关闭工作区按钮 | 可回到"未打开文件夹"状态 | ✓ (implied) |
| 收藏项目目录 | 永久保存常用项目路径列表 | ✓ (user-requested) |

**User's choice:** 全部选中，额外提出"收藏项目目录"需求

---

## 安全与健壮性修补

| Option | Description | Selected |
|--------|-------------|----------|
| 路径遍历防御 | deleteSession 验证 UUID 格式 | ✓ |
| 符号链接保护 | 使用 realpath 解析后再检查白名单 | ✓ |
| iframe 安全加固 | 移除 allow-same-origin，精确 origin postMessage | ✓ |
| 全局异常处理 | uncaughtException + unhandledRejection 处理器 | ✓ |

**User's choice:** 全部选中。iframe 加固需要测试兼容性。

---

## Claude's Discretion

- 确认对话框组件的具体视觉设计
- 文件搜索的防抖时间
- 心跳检测间隔
- 收藏列表最大数量
- 全局异常处理策略

## Deferred Ideas

- 上下文用量展示（状态栏显示 token）
- 深色/浅色主题切换
- ARIA 无障碍属性
- FileTree 重构为 SFC 模式
- 自动更新（electron-updater）
