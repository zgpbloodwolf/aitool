# Phase 4: Quick Wins - Discussion Log

**Date:** 2026-04-25
**Phase:** 4 - Quick Wins

## Areas Discussed

1. 交互式通知深度
2. 设置管理架构
3. 自动更新源与策略
4. 缩放与 Webview 同步

---

## Area 1: 交互式通知深度

### Q1: 交互式通知应该实现到什么程度？
- **Options:** 完整交互式（推荐） / 基础交互式 / 纯信息通知
- **Selected:** 完整交互式（推荐）
- **Notes:** 权限请求通知带「允许/拒绝」按钮；回复完成通知点击跳转；错误通知点击查看

### Q2: 通知触发时机——窗口在前台时是否也发通知？
- **Options:** 智能触发（推荐） / 始终发送
- **Selected:** 智能触发（推荐）
- **Notes:** 窗口在前台且标签页可见时不发通知，只在最小化/后台/其他标签页时发送

### Q3: 通知还有更多问题？
- **Selected:** 更多问题

### Q4: 自定义通知窗口 vs 系统通知？
- **User input:** "如果 Windows 系统通知无法满足，是否可以自己创建一个类似通知的窗体在右下角显示"
- **Options:** 纯自定义通知窗口（推荐） / 混合方案 / 系统优先+补充
- **Selected:** 纯自定义通知窗口（推荐）
- **Notes:** 自定义 BrowserWindow，完全控制 UI，Catppuccin Mocha 主题一致

### Q5: 多条通知如何显示？
- **Options:** 堆叠显示（推荐） / 单条替换
- **Selected:** 堆叠显示（推荐）
- **User clarification:** 不要漏通知

---

## Area 2: 设置管理架构

### Q1: 设置页面的 UI 形式？
- **Options:** 侧边抽屉面板（推荐） / 新标签页 / 独立弹窗
- **Selected:** 侧边抽屉面板（推荐）
- **Notes:** 右侧打开，不离开当前页面，类似 VS Code

### Q2: 设置数据存储方式？
- **Options:** localStorage（推荐） / electron-store
- **Selected:** localStorage（推荐）
- **Notes:** 与现有 sidebar width / favorites 一致

### Q3: 如何触发设置面板？
- **Options:** 标题栏齿轮图标（推荐） / 侧边栏按钮 / 仅快捷键
- **Selected:** 标题栏齿轮图标（推荐）

---

## Area 3: 自动更新源与策略

### Q1: 更新源——从哪里检查和下载新版本？
- **Options:** GitHub Releases（推荐） / 自建服务器 / 简单版本检查+浏览器下载
- **Selected:** GitHub Releases（推荐）

### Q2: GitHub 仓库是 public 还是 private？
- **Selected:** Public 仓库

### Q3: 版本检查频率？
- **Options:** 启动时检查（推荐） / 启动+定时检查 / 仅手动检查
- **Selected:** 启动时检查（推荐）

### Q4: 更新下载流程？
- **Options:** 提示→确认→下载→重启（推荐） / 静默下载→提示重启
- **Selected:** 提示→确认→下载→重启（推荐）

### Q5: 更新提示中要显示多少更新内容？
- **User input:** "更新不是强制的，不更新也能使用"
- **Notes:** 更新是可选的，跳过后不影响使用

### Q6: 更新提示的跳过行为？
- **Options:** 三按钮提示（推荐） / 两按钮+每次提醒
- **Selected:** 三按钮提示（推荐）
- **Notes:** 「立即更新」「稍后提醒」「跳过此版本」

---

## Area 4: 缩放与 Webview 同步

### Q1: 缩放范围——是否需要同步缩放 webview 内容？
- **Options:** 仅 Shell UI / Shell + Webview 同步（推荐）
- **Selected:** Shell + Webview 同步（推荐）

### Q2: 同步缩放 webview 的技术方案？
- **Options:** CSS transform 缩放 / postMessage + webFrame / CSS zoom 属性
- **User input:** "对这些不了解，推荐那个"
- **Selected:** CSS zoom 属性（推荐）
- **Notes:** webFrame.setZoomFactor() 用于 Shell，CSS zoom 用于 iframe，同一缩放值

### Q3: 缩放范围限制？
- **User input:** "在设置中配置缩放是否会简单一点，不在使用鼠标进行缩放"
- **Notes:** 只在设置面板通过滑块控制，不需要 Ctrl+滚轮。Ctrl+0 重置。80%~200%。

---

*Discussion completed: 2026-04-25*
