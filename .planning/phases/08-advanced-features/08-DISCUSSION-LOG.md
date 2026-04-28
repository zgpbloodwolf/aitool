# Phase 8: 高级特性 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 08-advanced-features
**Areas discussed:** 多窗口架构, 窗口创建方式, 单实例行为, 窗口状态, 通知路由, 拖拽细节, 主题同步, 分支触发, 分支可视化, 分支数据模型, 分支展示, 分支命名, 分支上限

---

## 多窗口架构

| Option | Description | Selected |
|--------|-------------|----------|
| 多窗口同架构 | 每个窗口独立 BrowserWindow + 独立 Pinia 状态，新增 WindowManager 统一管理 | ✓ |
| 主窗口 + 轻量分支窗口 | 主窗口不变，分支窗口用精简版 renderer | |
| 标签分组模拟窗口 | 单 BrowserWindow，拖拽标签页生成窗口组视觉效果 | |

**User's choice:** 多窗口同架构
**Notes:** 与现有架构最一致，但窗口间无直接状态共享

---

## 窗口创建方式

| Option | Description | Selected |
|--------|-------------|----------|
| 快捷键新建窗口 | Ctrl+Shift+N 打开新窗口 | |
| 拖拽标签页生成窗口 | 将标签页拖出窗口时创建新窗口（类似 Chrome） | ✓ |
| 仅右键菜单 | 右键菜单工作区目录 → "在新窗口中打开" | |

**User's choice:** 拖拽标签页生成窗口
**Notes:** 更直观但实现复杂度高

---

## 单实例行为

| Option | Description | Selected |
|--------|-------------|----------|
| 保持单实例 | requestSingleInstanceLock 不变，多窗口是应用内部行为 | ✓ |
| 允许多实例 | 每个实例独立运行 | |

**User's choice:** 保持单实例

---

## 窗口状态记忆

| Option | Description | Selected |
|--------|-------------|----------|
| 记忆所有窗口 | 记住位置/大小/工作区，下次恢复 | |
| 仅记忆单一窗口 | 只记忆最后一个窗口 | |
| 不记忆布局 | 新窗口居中显示，不记忆 | ✓ |

**User's choice:** 不记忆布局

---

## 通知路由

| Option | Description | Selected |
|--------|-------------|----------|
| 精准路由到目标窗口 | 通知发送到拥有该会话的窗口 | ✓ |
| 全部发到聚焦窗口 | 所有通知发到当前聚焦窗口 | |

**User's choice:** 精准路由到目标窗口

---

## 拖拽触发细节

| Option | Description | Selected |
|--------|-------------|----------|
| 拖出窗口边界时创建 | 检测鼠标超出窗口边界，创建半透明预览窗口 | ✓ |
| 拖入指定区域创建 | 出现"拖到新窗口"提示区域 | |

**User's choice:** 拖出窗口边界时创建

---

## 主题同步

| Option | Description | Selected |
|--------|-------------|----------|
| 全部窗口同步 | 任一窗口切换主题，其他窗口立即响应 | ✓ |
| 窗口独立主题 | 每个窗口可独立设置 | |

**User's choice:** 全部窗口同步

---

## 分支触发方式

| Option | Description | Selected |
|--------|-------------|----------|
| 消息旁分支按钮 | 每条消息右侧出现分支图标 | ✓ |
| 右键菜单触发 | 右键消息弹出菜单 | |
| 分支面板 | 点击消息旁按钮弹出分支面板 | |

**User's choice:** 消息旁分支按钮

---

## 分支可视化

| Option | Description | Selected |
|--------|-------------|----------|
| 内联分支指示器 | 分叉点显示"N 个分支"标签，点击展开切换 | ✓ |
| 侧边树状面板 | 新增侧边面板显示树状结构 | |
| 标签栏分支下拉 | 标签栏下方显示分支切换栏 | |

**User's choice:** 内联分支指示器

---

## 分支数据模型

| Option | Description | Selected |
|--------|-------------|----------|
| 新 CLI 会话 | 新 session_id，分支点上下文作为历史注入 | ✓ |
| 复用同一 CLI 会话 | 修改 JSONL 文件回滚到分叉点 | |

**User's choice:** 新 CLI 会话

---

## 分支展示

| Option | Description | Selected |
|--------|-------------|----------|
| 分支即标签页 | 每个分支独立标签页，标注分支来源 | ✓ |
| 同一标签页内切换 | 所有分支共享标签页 | |

**User's choice:** 分支即标签页

---

## 分支命名

| Option | Description | Selected |
|--------|-------------|----------|
| 自动编号 + 可重命名 | "分支 #1"、"分支 #2"，右键可重命名 | ✓ |
| 创建时手动命名 | 创建时弹出输入框 | |
| 自动取消息摘要 | 以分叉点用户消息前 20 字命名 | |

**User's choice:** 自动编号 + 可重命名

---

## 分支数量限制

| Option | Description | Selected |
|--------|-------------|----------|
| 不设上限 | 由用户自行管理 | |
| 每个会话限制 N 个 | 超出后提示关闭旧分支（建议 N=10） | ✓ |

**User's choice:** 每个会话限制 N 个

---

## Claude's Discretion

- WindowManager 的具体 API 设计
- 拖拽检测实现细节
- 分支按钮视觉样式
- 内联分支指示器动画
- 分支上下文注入格式
- 窗口间主题同步 IPC 细节
- 半透明预览窗口样式
- 分支上限 N 的具体值

## Deferred Ideas

None
