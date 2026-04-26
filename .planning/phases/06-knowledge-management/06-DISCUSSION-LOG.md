# Phase 6: 知识管理 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-26
**Phase:** 06-knowledge-management
**Areas discussed:** 导出格式与内容, 剪贴板历史管理, 收藏片段系统, 触发与交互方式

---

## 导出格式与内容

### 导出范围

| Option | Description | Selected |
|--------|-------------|----------|
| 仅用户+助手对话 | 只导出用户消息和助手回复，过滤掉 system 消息和工具调用细节 | ✓ |
| 包含工具调用摘要 | 用户+助手对话 + 工具调用的一行摘要 | |
| 完整原始内容 | 包含所有消息类型，包括工具调用的完整输入输出 | |

**User's choice:** 仅用户+助手对话（简洁干净，适合分享和存档）

### 元数据

| Option | Description | Selected |
|--------|-------------|----------|
| 仅标题+日期 | 文件头只有会话标题和导出日期 | ✓ |
| 标题+日期+工作区路径 | 额外包含工作区路径信息 | |
| 无元数据 | 直接开始对话内容 | |

**User's choice:** 仅标题+日期

### 代码块处理

| Option | Description | Selected |
|--------|-------------|----------|
| 保留原始 Markdown 代码块 | 直接保留代码块和语言标识 | ✓ |
| 代码块 + 文件名注释 | 在代码块上方添加文件名注释 | |

**User's choice:** 保留原始 Markdown 代码块

### 文件名生成

| Option | Description | Selected |
|--------|-------------|----------|
| 会话标题+日期 | 如 "Claude-Code-对话-2026-04-26.md" | ✓ |
| 日期+时间戳 | 如 "2026-04-26-143052.md" | |

**User's choice:** 会话标题+日期

---

## 剪贴板历史管理

### 存储策略

| Option | Description | Selected |
|--------|-------------|----------|
| 内存 + 会话内有效 | 只在应用运行期间保存，关闭后清空，最多 50 条 | ✓ |
| localStorage 持久化 | 跨会话持久化 | |
| SQLite 存储 | 本地数据库存储 | |

**User's choice:** 内存 + 会话内有效（简单实用）

### 历史容量

| Option | Description | Selected |
|--------|-------------|----------|
| 50 条 | 足够日常使用 | ✓ |
| 100 条 | 更大历史窗口 | |
| 无限制 | 不设上限 | |

**User's choice:** 50 条

### 记录内容类型

| Option | Description | Selected |
|--------|-------------|----------|
| 仅文本 | 只记录文本内容 | ✓ |
| 文本 + 图片 | 同时记录文本和图片截图 | |

**User's choice:** 仅文本

---

## 收藏片段系统

### 存储方式

| Option | Description | Selected |
|--------|-------------|----------|
| localStorage | 复用现有模式，简单可靠 | ✓ |
| 文件系统存储 | 每个片段存为单独文件 | |

**User's choice:** localStorage

### 管理能力

| Option | Description | Selected |
|--------|-------------|----------|
| 基础 CRUD | 创建、编辑（标题+内容）、删除、列表 | ✓ |
| 基础 CRUD + 分类/搜索 | 额外支持文件夹分类和关键词搜索 | |

**User's choice:** 基础 CRUD

### 片段来源

| Option | Description | Selected |
|--------|-------------|----------|
| 从剪贴板历史提升 + 手动创建 | 在剪贴板历史中点「收藏」+ 手动创建入口 | ✓ |
| 仅手动创建 | 在片段面板中手动输入 | |

**User's choice:** 从剪贴板历史提升 + 手动创建

---

## 触发与交互方式

### 导出入口

| Option | Description | Selected |
|--------|-------------|----------|
| 标签右键菜单 | 右键标签 → 「导出对话」 | ✓ |
| 标签上的导出按钮 | 在标签上添加导出图标按钮 | |
| 会话历史面板 | 历史面板条目上添加「导出」按钮 | |
| 快捷键 | Ctrl+Shift+E 导出当前对话 | |

**User's choice:** 标签右键菜单

### 剪贴板面板唤起

| Option | Description | Selected |
|--------|-------------|----------|
| 快捷键 Ctrl+Shift+V | 常见剪贴板管理器模式 | ✓ |
| 输入框右键菜单 | 在 iframe 内右键触发（实现复杂） | |

**User's choice:** 快捷键 Ctrl+Shift+V，并可在设置中配置

### 面板 UI 形式

| Option | Description | Selected |
|--------|-------------|----------|
| 弹出面板 | 类似 VS Code 命令面板，出现在输入区域附近 | ✓ |
| 侧边抽屉 | 从右侧滑出的抽屉面板 | |

**User's choice:** 弹出面板

### 面板内布局

| Option | Description | Selected |
|--------|-------------|----------|
| 两个 Tab（历史/收藏） | 面板顶部两个 Tab 切换 | ✓ |
| 分两次唤起 | 不同快捷键唤起不同面板 | |

**User's choice:** 两个 Tab（历史/收藏）

---

## Claude's Discretion

- 弹出面板的具体定位和动画效果
- 剪贴板历史记录的列表项预览截断长度
- 收藏片段的编辑对话框 UI 设计
- 标签右键菜单的视觉风格
- 导出进度的反馈方式

## Deferred Ideas

None — discussion stayed within phase scope
