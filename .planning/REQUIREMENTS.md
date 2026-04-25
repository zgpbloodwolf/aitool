# Requirements: AI Tools - 429 Bug Fix

**Defined:** 2026-04-24
**Core Value:** 用户能在桌面客户端中正常与 Claude Code 交互，不出现 429 速率限制错误

## v1 Requirements

### Core Fix

- [ ] **FIX-01**: 移除或修正 `result` 消息中的 `modelUsage` 和 `total_cost_usd` 注入，避免激活 webview 中休眠的用量追踪代码路径
- [ ] **FIX-02**: 确认移除注入后发送消息不再触发 429 错误
- [ ] **FIX-03**: 消息在转发到 webview 前使用深拷贝，不修改 claude.exe 的原始输出

### Performance

- [ ] **PERF-01**: 缓存 `getClaudeSettings()` 读取结果，避免每次 `result` 消息都调用 `readFileSync` 阻塞事件循环

### Preservation

- [ ] **KEEP-01**: 保留上下文使用量显示功能（badge），但改为仅从已有的 `stream_event` 中提取数据，不注入额外字段到 `result` 消息

## v2 Requirements

### Hardening

- **HARD-01**: 添加消息去重，防止浏览器重复触发 `message` 事件导致双倍 API 调用
- **HARD-02**: 追踪 CLI 返回的真实 session_id 并在后续消息中使用
- **HARD-03**: 优化 `setInterval` badge 重插逻辑，避免与 React 虚拟 DOM 冲突

## Out of Scope

| Feature | Reason |
|---------|--------|
| 切换到 Anthropic 官方 API | 用户环境选择智谱 AI 代理，不是 bug 范围 |
| 重构消息架构 | 当前只修 bug，不做重构 |
| 跨平台兼容性 | 仅关注 Windows |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FIX-01 | Phase 1 | Pending |
| FIX-02 | Phase 1 | Pending |
| FIX-03 | Phase 2 | Pending |
| PERF-01 | Phase 2 | Pending |
| KEEP-01 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 5 total
- Mapped to phases: 5
- Unmapped: 0

---
*Requirements defined: 2026-04-24*
*Last updated: 2026-04-24 after roadmap creation*
