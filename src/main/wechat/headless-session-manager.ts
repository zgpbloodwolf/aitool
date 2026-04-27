import { ClaudeWorker } from './engine/claude-worker'
import { CodexWorker } from './engine/codex-worker'
import type { CanonicalMessage, EngineType } from './types'

export class HeadlessAISessionManager {
  private readonly running = new Map<string, Promise<void>>()

  async enqueue(params: {
    conversationKey: string
    engine: EngineType
    message: CanonicalMessage
    onReply: (text: string) => Promise<void>
  }): Promise<void> {
    const previous = this.running.get(params.conversationKey) ?? Promise.resolve()

    const next = previous
      .catch(() => undefined)
      .then(async () => {
        const worker = params.engine === 'claude' ? new ClaudeWorker() : new CodexWorker()

        for await (const event of worker.sendMessage({
          sessionId: params.conversationKey,
          text: params.message.text,
          imagePath: params.message.imagePath
        })) {
          if (event.type === 'reply_finished' && event.finalText) {
            await params.onReply(event.finalText)
          }

          if (event.type === 'reply_error' && event.error) {
            throw new Error(event.error)
          }
        }
      })
      .finally(() => {
        if (this.running.get(params.conversationKey) === next) {
          this.running.delete(params.conversationKey)
        }
      })

    this.running.set(params.conversationKey, next)
    await next
  }
}
