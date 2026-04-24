# AI Tools

基于 Electron + Vue 3 + TypeScript 的 AI 编程助手桌面客户端，集成 Claude Code CLI。

## 功能

- 嵌入 Claude Code webview，支持多标签对话
- 会话历史管理与恢复
- 工作区文件浏览器
- 支持 VS Code 扩展宿主
- 多平台支持 (Windows / macOS / Linux)

## 技术栈

- Electron 35 + electron-vite
- Vue 3 + Pinia + TypeScript
- VSCodium 扩展宿主

## 开发

```bash
# 安装依赖
pnpm install

# 启动开发模式
pnpm dev

# 类型检查
pnpm typecheck

# 构建
pnpm build:win
```

## 前置条件

- 需安装 Claude Code VS Code 扩展 (`anthropic.claude-code`)
- Node.js >= 18
- pnpm
