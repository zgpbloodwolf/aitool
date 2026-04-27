# AI Tools

基于 Electron + Vue 3 + TypeScript 的 AI 编程助手桌面客户端，集成 Claude Code CLI。

## 功能

### 核心对话
- 嵌入 Claude Code webview，支持多标签对话
- 会话历史管理与恢复
- 上下文使用量实时显示（badge 徽章）

### 标签管理
- **智能标签名**：自动从对话内容提取标签标题
- **状态指示器**：绿色（处理中）、黄色（等待权限）、灰色（空闲）
- **中键关闭**：鼠标中键点击标签快速关闭
- **拖拽排序**：拖拽标签调整顺序
- **键盘快捷键**：Ctrl+N（新建）、Ctrl+W（关闭）、Ctrl+Tab（切换）

### 多项目管理
- 添加多个项目目录到侧边栏
- **标签分组收藏**：给收藏项目添加标签（如 OCR、AI），按标签分组展示
- **激活项目**：点击激活后新建 Claude 标签自动使用该项目目录作为工作目录
- 未收藏的项目关闭后自动清除，收藏项目跨重启持久化
- 文件搜索过滤、目录展开折叠

### 安全与稳定性
- 进程崩溃自动恢复（从 system init 提取 session_id）
- 30 秒心跳检测，进程挂死时提示用户
- 删除会话/关闭活跃标签/切换工作区操作确认对话框
- iframe postMessage 使用精确 origin，UUID 验证，符号链接解析
- 全局未捕获异常处理器

### 开发体验
- 中文界面
- 侧边栏宽度可拖拽调整（200-500px），持久化
- 文件系统监听自动刷新（chokidar）
- 支持 VS Code 扩展宿主

## 技术栈

- Electron 35 + electron-vite
- Vue 3 (Composition API) + Pinia + TypeScript
- VSCodium 扩展宿主
- chokidar 文件监听
- 多平台支持 (Windows / macOS / Linux)

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

## 项目结构

```
src/
├── main/               # Electron 主进程
│   ├── index.ts        # 应用入口、全局异常处理、快捷键拦截
│   ├── ipc/            # IPC handlers
│   │   ├── claude-webview.ts   # Claude 进程管理、消息路由
│   │   ├── filesystem.ts       # 文件系统访问（白名单+符号链接解析）
│   │   ├── file-watcher.ts     # 多项目 chokidar 文件监听
│   │   └── dialog.ts           # 原生对话框
│   └── claude/
│       ├── process-manager.ts  # Claude CLI 进程管理、心跳检测
│       ├── webview-server.ts   # 本地 HTTP 服务器
│       └── session-store.ts    # 会话存储（UUID 验证）
├── renderer/           # Vue 3 渲染进程
│   ├── App.vue         # 布局、快捷键、侧边栏调整
│   └── components/
│       ├── ChatPanel.vue      # 多标签对话面板
│       ├── Sidebar.vue        # 多项目管理侧边栏
│       ├── FileTree.vue       # 文件树（prop 驱动）
│       └── ConfirmDialog.vue  # 通用确认对话框
└── preload/            # 预加载脚本（IPC 桥接）
```

## 更新日志

### v1.0.0 (2025-04-25)

**Phase 1: 根因修复**
- 移除 `modelUsage`/`total_cost_usd` 注入，修复 429 速率限制错误
- 保留上下文用量 badge 显示

**Phase 2: 防御性加固**
- 消息转发前深拷贝，防止 CLI 输出对象被修改
- `getClaudeSettings()` 读取结果缓存，避免频繁 `readFileSync`

**Phase 3: UX 增强**
- ConfirmDialog 组件 + 错误恢复与确认集成
- 键盘快捷键 + 标签拖拽排序
- 进程健康监控 + 全局异常处理
- 智能标签名 + 状态指示器 + 中键关闭
- 多项目管理侧边栏（标签分组、收藏持久化、搜索过滤）
- 安全加固：UUID 验证、符号链接解析、iframe sandbox
