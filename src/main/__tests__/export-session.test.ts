/**
 * 对话导出 Markdown 格式化单元测试 (UX-07)
 *
 * 测试 formatMessagesAsMarkdown 的过滤、格式化和保留行为
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'

// Mock 依赖
vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(''),
  stat: vi.fn().mockResolvedValue({ isFile: () => true, isDirectory: () => false, size: 100, mtimeMs: Date.now() }),
  readdir: vi.fn().mockResolvedValue([]),
  open: vi.fn().mockResolvedValue({
    read: vi.fn().mockResolvedValue({ bytesRead: 0 }),
    close: vi.fn().mockResolvedValue(undefined)
  }),
  unlink: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true)
}))

vi.mock('../claude/logger', () => ({
  safeLog: vi.fn(),
  safeError: vi.fn()
}))

describe('formatMessagesAsMarkdown (UX-07)', () => {
  let formatMessagesAsMarkdown: (
    messages: unknown[],
    title: string,
    date: string
  ) => string

  beforeAll(async () => {
    const sessionStore = await import('../claude/session-store')
    formatMessagesAsMarkdown = sessionStore.formatMessagesAsMarkdown
  })

  // Test 1: 过滤 system 消息 — 仅保留 user 消息
  it('过滤 system 消息，输出仅包含 user 消息内容', () => {
    const messages = [
      { type: 'system', message: { role: 'system', content: [{ type: 'text', text: '系统指令' }] } },
      { type: 'user', message: { role: 'user', content: [{ type: 'text', text: '用户提问' }] } }
    ]
    const result = formatMessagesAsMarkdown(messages, '测试对话', '2026-04-26')

    expect(result).toContain('## 用户')
    expect(result).toContain('用户提问')
    expect(result).not.toContain('系统指令')
  })

  // Test 2: 过滤 tool_use/thinking block — 仅保留 text block
  it('过滤 assistant 消息中的 tool_use 和 thinking block', () => {
    const messages = [
      {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: '这是助手回复' },
            { type: 'tool_use', name: 'Read', input: { path: '/some/file' } },
            { type: 'thinking', text: '内部思考过程' }
          ]
        }
      }
    ]
    const result = formatMessagesAsMarkdown(messages, '测试对话', '2026-04-26')

    expect(result).toContain('## 助手')
    expect(result).toContain('这是助手回复')
    expect(result).not.toContain('tool_use')
    expect(result).not.toContain('内部思考过程')
  })

  // Test 3: 文件头包含标题和日期
  it('文件头第一行为标题，第二行为导出日期', () => {
    const messages: unknown[] = []
    const result = formatMessagesAsMarkdown(messages, '我的对话', '2026-04-26')

    const lines = result.split('\n')
    expect(lines[0]).toBe('# 我的对话')
    expect(lines[1]).toBe('> 导出于 2026-04-26')
  })

  // Test 4: 保留原始 Markdown 代码块
  it('保留原始 Markdown 代码块和语言标识', () => {
    const codeBlock = '```python\nprint("hello")\n```'
    const messages = [
      {
        type: 'user',
        message: {
          role: 'user',
          content: [{ type: 'text', text: codeBlock }]
        }
      }
    ]
    const result = formatMessagesAsMarkdown(messages, '代码对话', '2026-04-26')

    expect(result).toContain(codeBlock)
  })

  // Test 5: 空 content 数组不崩溃，输出仅包含文件头
  it('空 content 数组不崩溃，输出仅包含文件头', () => {
    const messages = [
      { type: 'user', message: { role: 'user', content: [] } },
      { type: 'assistant', message: { role: 'assistant', content: [] } }
    ]
    const result = formatMessagesAsMarkdown(messages, '空对话', '2026-04-26')

    // 应包含文件头
    expect(result).toContain('# 空对话')
    expect(result).toContain('> 导出于 2026-04-26')
    // 不崩溃即可
  })
})
