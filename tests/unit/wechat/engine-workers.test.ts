import { describe, expect, it } from 'vitest'

import { CodexWorker } from '../../../src/main/wechat/engine/codex-worker'

describe('CodexWorker', () => {
  it('emits started before the final reply when the runner succeeds', async () => {
    const worker = new CodexWorker(async () => 'real codex reply')
    const events: string[] = []
    let finalText = ''

    for await (const event of worker.sendMessage({ sessionId: 's-1', text: 'hello' })) {
      events.push(event.type)
      if (event.type === 'reply_finished') {
        finalText = event.finalText ?? ''
      }
    }

    expect(events[0]).toBe('reply_started')
    expect(events.at(-1)).toBe('reply_finished')
    expect(finalText).toBe('real codex reply')
  })
})
