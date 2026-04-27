export interface EngineInput {
  sessionId: string
  text?: string
  imagePath?: string
}

export interface EngineEvent {
  type: 'reply_started' | 'reply_delta' | 'reply_finished' | 'reply_error'
  textDelta?: string
  finalText?: string
  error?: string
}

export interface AIEngineWorker {
  sendMessage(input: EngineInput): AsyncIterable<EngineEvent>
  shutdown(sessionId: string): Promise<void>
}

export class ClaudeWorker implements AIEngineWorker {
  async *sendMessage(input: EngineInput): AsyncIterable<EngineEvent> {
    yield { type: 'reply_started' }
    yield {
      type: 'reply_finished',
      finalText: `Claude echo: ${input.text ?? '[image]'}`
    }
  }

  async shutdown(_sessionId: string): Promise<void> {}
}
