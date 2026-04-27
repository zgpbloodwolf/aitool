import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import type { AIEngineWorker, EngineEvent, EngineInput } from './claude-worker'

const execFileAsync = promisify(execFile)

type CodexRunner = (input: EngineInput) => Promise<string>

async function runCodexCli(input: EngineInput): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), 'aitool-codex-'))
  const outputPath = join(tempDir, 'last-message.txt')
  const command = process.platform === 'win32' ? 'codex.cmd' : 'codex'
  const prompt = [
    'You are replying to a WeChat user inside the aitool desktop bridge.',
    'Reply directly to the user in plain text.',
    input.text ? `User message:\n${input.text}` : 'The user sent an image without text.',
    input.imagePath ? `The user also sent an image at this local path: ${input.imagePath}` : ''
  ]
    .filter(Boolean)
    .join('\n\n')

  const args = [
    'exec',
    '--skip-git-repo-check',
    '--ephemeral',
    '--sandbox',
    'read-only',
    '--color',
    'never',
    '-C',
    process.cwd(),
    '-o',
    outputPath
  ]

  if (input.imagePath) {
    args.push('-i', input.imagePath)
  }

  args.push(prompt)

  try {
    await execFileAsync(command, args, {
      cwd: process.cwd(),
      windowsHide: true,
      shell: process.platform === 'win32'
    })

    const output = await readFile(outputPath, 'utf-8')
    return output.trim() || '(empty codex reply)'
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

export class CodexWorker implements AIEngineWorker {
  constructor(private readonly runner: CodexRunner = runCodexCli) {}

  async *sendMessage(input: EngineInput): AsyncIterable<EngineEvent> {
    yield { type: 'reply_started' }
    const finalText = await this.runner(input)
    yield {
      type: 'reply_finished',
      finalText
    }
  }

  async shutdown(_sessionId: string): Promise<void> {}
}
