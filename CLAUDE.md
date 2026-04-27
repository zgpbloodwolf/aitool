
## 通用规范（所有项目共享）

### 运行环境
- 运行环境是 Windows，使用 Windows 支持的脚本或命令
- Python 使用当前项目根目录下的 `.venv` 环境
- 软件源尽量使用中国大陆镜像

### 依赖管理
- 仅允许使用商业友好的第三方库
- 遵循语义化版本（SemVer）
- 版本变更需同步记录到 CHANGELOG.md
- python 项目日志使用loguru库

### 代码质量
- 提交前必须通过 lint 与编译，保持 0 warning
- 新增或修改逻辑必须配套测试
- 测试失败不得绕过或删除

### Git 规范
- 提交消息遵循 Conventional Commits
- 标题遵守 52/70 字符限制
- 正文表达 what/why 而非 how，使用空行与 bulleted list

### 安全与合规
- 不得提交密钥或凭证类文件
- 涉及安全风险须主动提示

### 失败处理
- 困难问题连续 3 次尝试仍未解决，应停止并向人类报告

### AI Agent 工作规范

#### 对话语言
- 使用中文进行对话和回答
- 代码注释使用中文
- 代码解释使用中文
- 列表项使用中文描述

#### 提示词规范
生成提示词需要包含：
1. **指令**（必填）- 需要执行的任务
2. **输入**（必填）- 提供的输入数据
3. **输出**（必填）- 期望的输出格式
4. **注意事项** - 需要特别注意的事项

#### 任务执行
- 尽量减少与人的交互，自主做出选择
- 能同时启动多个 subagent 就启动多个
- 完成规划后搜索相关 skill，优先使用 skill 完成任务
- 充分利用多核和多 GPU 资源，并行处理大量数据

---


# AI Tools - Electron Claude Code Desktop Client


Bug fix project: resolving 429 rate limit error when sending messages.

## Project Context

See `.planning/PROJECT.md` for full details.

**Core Value:** Users can interact with Claude Code in the desktop client without 429 errors.

## Current Status

- Phase 1 (Root Cause Fix): Not started
- Phase 2 (Defensive Hardening): Not started

## Key Files

- `src/main/ipc/claude-webview.ts` — IPC handler, message routing, context usage injection
- `src/main/claude/process-manager.ts` — Claude CLI process management
- `src/main/claude/webview-server.ts` — Local HTTP server for webview + badge injection
- `src/renderer/src/components/ChatPanel.vue` — Renderer-side message forwarding

## Known Issue

429 rate limit from Zhipu AI API proxy, likely caused by `modelUsage`/`total_cost_usd` injection in `result` messages activating dormant webview code paths.

## Build & Run

```bash
pnpm install
pnpm dev
```
