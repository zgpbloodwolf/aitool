import { ipcMain, BrowserWindow } from 'electron'
import { existsSync, readFileSync, statSync, writeFileSync } from 'fs'
import { join } from 'path'
import { ClaudeProcessManager } from '../claude/process-manager'
import { resolveClaudeBinary } from '../claude/binary-resolver'
import { startWebviewServer } from '../claude/webview-server'
import { addAllowedRoot } from './filesystem'
import { safeLog, safeError } from '../claude/logger'
import { listSessions, getSessionMessages, deleteSession, exportSessionAsMarkdown } from '../claude/session-store'
import { discoverSkills, runClaudeCliCommand } from '../claude/plugin-manager'
import { handleGetMcpServers, handleMcpServerCommand } from '../claude/mcp-manager'
import { notificationManager } from '../notification/notification-registry'

interface PendingToolUse {
  id: string
  name: string
  inputJson: string
  index: number
}

interface PermissionResolver {
  resolve: (response: unknown) => void
  toolUseId: string
  // D-12: 超时定时器 ID，channel 关闭时需要清理
  timeoutId: ReturnType<typeof setTimeout>
}

interface Channel {
  process: ClaudeProcessManager
  permissionMode: string
  planText: string
  pendingToolUse: PendingToolUse | null
  permissionResolvers: Map<string, PermissionResolver>
  sentPermissionRequests: Set<string>
  totalInputTokens: number
  totalOutputTokens: number
  // D-10: 最后一次启动时的 resumeSessionId，用于崩溃恢复
  lastSessionId: string | null
  // 用户主动中断标记 — exit handler 不发崩溃通知，等用户发新消息时恢复
  interrupted?: boolean
}

const channels = new Map<string, Channel>()
const launchingChannels = new Set<string>()
let extensionPath: string | null = null
let webviewInitialized = false
let pendingMessages: unknown[] = []
let currentCwd = process.cwd()

interface ClaudeSettings {
  env?: Record<string, string>
  effortLevel?: string
  alwaysThinkingEnabled?: boolean
  permissions?: { allow?: string[]; deny?: string[]; ask?: string[] }
  [key: string]: unknown
}

const SETTINGS_CACHE_TTL_MS = 5000
let settingsCache: { data: ClaudeSettings; mtimeMs: number; timestamp: number } | null = null

function getClaudeSettings(): ClaudeSettings {
  try {
    const homeDir = process.env.USERPROFILE || process.env.HOME || ''
    const settingsPath = join(homeDir, '.claude', 'settings.json')

    if (settingsCache && Date.now() - settingsCache.timestamp < SETTINGS_CACHE_TTL_MS) {
      try {
        const { mtimeMs } = statSync(settingsPath)
        if (mtimeMs === settingsCache.mtimeMs) return settingsCache.data
      } catch {
        settingsCache = null
        return {}
      }
    }

    if (existsSync(settingsPath)) {
      const content = readFileSync(settingsPath, 'utf-8')
      const { mtimeMs } = statSync(settingsPath)
      const data = JSON.parse(content)
      settingsCache = { data, mtimeMs, timestamp: Date.now() }
      return data
    }
    settingsCache = { data: {}, mtimeMs: 0, timestamp: Date.now() }
  } catch {
    /* ignore */
  }
  return {}
}

function getAuthStatus(): { authMethod: string; email: null; subscriptionType: null } {
  const settings = getClaudeSettings()
  if (settings.env?.ANTHROPIC_AUTH_TOKEN) {
    return { authMethod: 'api-key', email: null, subscriptionType: null }
  }
  return { authMethod: 'not-specified', email: null, subscriptionType: null }
}

function getModelSetting(): string {
  const settings = getClaudeSettings()
  if (settings.env?.ANTHROPIC_MODEL) return settings.env.ANTHROPIC_MODEL
  return 'default'
}

function savePlanToMd(planText: string, cwd: string): void {
  try {
    const planPath = join(cwd, 'PLAN.md')
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const content = `# 计划\n\n生成时间：${timestamp}\n\n${planText.trim()}\n`
    writeFileSync(planPath, content, 'utf-8')
    safeLog('[ClaudeIPC] 计划已保存到:', planPath)
  } catch (err) {
    safeError('[ClaudeIPC] 保存计划失败:', err)
  }
}

async function getExtensionPath(): Promise<string | null> {
  if (extensionPath) return extensionPath
  const { discoverExtensions } = await import('../extension-discovery')
  const extensions = await discoverExtensions()
  const ext = extensions.find((e) => e.id === 'anthropic.claude-code')
  extensionPath = ext?.extensionPath || null
  return extensionPath
}

function sendToWebview(msg: unknown): void {
  const window = BrowserWindow.getAllWindows()[0]
  if (window) {
    safeLog('[ClaudeIPC] 发送到 webview:', JSON.stringify(msg).slice(0, 200))
    window.webContents.send('claude-webview:to-webview', msg)
  }
}

// --- Multi-channel process management ---

async function handleLaunchClaude(
  channelId: string,
  cwd: string,
  _permissionMode: string,
  _thinkingLevel: string,
  resumeSessionId?: string,
  persistent?: boolean
): Promise<void> {
  if (channels.has(channelId) || launchingChannels.has(channelId)) {
    safeLog('[ClaudeIPC] 频道已存在或正在启动:', channelId)
    return
  }

  launchingChannels.add(channelId)

  const binaryPath = await resolveClaudeBinary()
  if (!binaryPath) {
    launchingChannels.delete(channelId)
    sendToWebview({ type: 'close_channel', channelId, error: '未找到 Claude Code CLI' })
    return
  }

  // 从 settings.json 读取 env 并注入到 claude.exe 进程（与 VSCode 行为一致）
  const settings = getClaudeSettings()
  const procEnv: Record<string, string> = settings.env || {}

  safeLog('[ClaudeIPC] 正在为频道启动 claude.exe:', channelId)
  const proc = new ClaudeProcessManager()

  proc.on('message', (msg: Record<string, unknown>) => {
    safeLog(
      '[ClaudeIPC] claude.exe 输出 [' + channelId + ']:',
      JSON.stringify(msg).slice(0, msg.type === 'result' ? 1000 : 150)
    )

    const channel = channels.get(channelId)
    if (channel && channel.permissionMode === 'plan') {
      if (msg.type === 'assistant') {
        const content = (msg.message as Record<string, unknown>)?.content as
          | Array<Record<string, unknown>>
          | undefined
        if (content) {
          for (const block of content) {
            if (block.type === 'text' && typeof block.text === 'string') {
              channel.planText += block.text
            }
          }
        }
      } else if (msg.type === 'result' && channel.planText) {
        savePlanToMd(channel.planText, cwd || currentCwd)
        channel.planText = ''
      }
    }

    if (channel) {
      if (msg.type === 'content_block_start') {
        const block = msg.content_block as Record<string, unknown> | undefined
        if (block?.type === 'tool_use') {
          channel.pendingToolUse = {
            id: block.id as string,
            name: block.name as string,
            inputJson: '',
            index: msg.index as number
          }
        }
      }

      if (msg.type === 'content_block_delta' && channel.pendingToolUse) {
        const delta = msg.delta as Record<string, unknown> | undefined
        if (delta?.type === 'input_json_delta' && typeof delta.partial_json === 'string') {
          channel.pendingToolUse.inputJson += delta.partial_json
        }
      }

      if (msg.type === 'content_block_stop' && channel.pendingToolUse) {
        if (channel.pendingToolUse.index === msg.index) {
          const toolUse = channel.pendingToolUse
          channel.pendingToolUse = null
          sendToolPermissionRequest(channel, channelId, toolUse.id, toolUse.name, toolUse.inputJson)
        }
      }

      if (msg.type === 'assistant') {
        const content = (msg.message as Record<string, unknown>)?.content as
          | Array<Record<string, unknown>>
          | undefined
        if (content) {
          for (const block of content) {
            if (block.type === 'tool_use' && block.id) {
              sendToolPermissionRequest(
                channel,
                channelId,
                block.id as string,
                block.name as string,
                JSON.stringify(block.input || {})
              )
            }
          }
        }
      }
    }

    // 追踪 token 用量
    if (msg.type === 'stream_event') {
      const usage = (msg.event as Record<string, unknown>)?.usage as
        | { input_tokens?: number; output_tokens?: number }
        | undefined
      if (usage) {
        const ch = channels.get(channelId)
        if (ch) {
          if (usage.input_tokens) ch.totalInputTokens = usage.input_tokens
          if (usage.output_tokens) ch.totalOutputTokens = usage.output_tokens
        }
      }
    }

    // D-10: 从 system init 消息中提取 session_id 用于崩溃恢复
    if (msg.type === 'system' && msg.subtype === 'init' && typeof msg.session_id === 'string') {
      const ch = channels.get(channelId)
      if (ch) ch.lastSessionId = msg.session_id as string
    }

    // SDK 内部协议消息：control_response / control_request / control_cancel_request / keep_alive
    // 不转发给 webview，这些是 CLI SDK 模式的内部控制消息
    if (msg.type === 'control_response' || msg.type === 'control_request' ||
        msg.type === 'control_cancel_request' || msg.type === 'keep_alive') {
      safeLog('[ClaudeIPC] SDK 内部消息 [' + channelId + ']:', msg.type,
        (msg as Record<string, unknown>).subtype || '')
      return
    }

    let messageCopy: typeof msg
    try {
      messageCopy = structuredClone(msg)
    } catch {
      messageCopy = msg
    }
    const tagged = { type: 'io_message', channelId, message: messageCopy }
    if (!webviewInitialized) {
      pendingMessages.push(tagged)
      return
    }
    sendToWebview(tagged)

    // 通知触发：回复完成
    if (msg.type === 'result' && notificationManager) {
      notificationManager.show({
        type: 'complete',
        title: '回复完成',
        body: 'Claude 已完成回复',
        channelId
      })
    }
  })

  proc.on('exit', (code) => {
    safeLog('[ClaudeIPC] 进程已退出 [' + channelId + '] 退出码:', code)
    const channel = channels.get(channelId)

    // 用户主动中断：不发崩溃通知，保留 channel 等待用户发新消息时恢复
    if (channel?.interrupted) {
      safeLog('[ClaudeIPC] 用户中断后进程退出 — channelId:', channelId)
      return
    }

    // D-10: 崩溃恢复 — 保留 channel 记录用于恢复，通知渲染进程
    const canRecover = !!channel?.lastSessionId
    if (!persistent) {
      // 通知渲染进程进程已崩溃，提供恢复选项
      const win = BrowserWindow.getAllWindows()[0]
      if (win) {
        win.webContents.send('claude:process-crashed', { channelId, canRecover })
      }
      // 不立即从 channels 中删除（保持 channel 记录用于恢复）
      // channel 会在 handleCloseChannel 或恢复成功后清理
    } else {
      // persistent channel 保持原有行为
      channels.delete(channelId)
    }
  })

  proc.on('error', (err) => {
    safeError('[ClaudeIPC] 进程错误 [' + channelId + ']:', err)
    // 通知触发：进程错误
    if (notificationManager) {
      notificationManager.show({
        type: 'error',
        title: '进程错误',
        body: String(err).slice(0, 100),
        channelId
      })
    }
    channels.delete(channelId)
    sendToWebview({ type: 'close_channel', channelId, error: String(err) })
  })

  proc.start({ claudePath: binaryPath, cwd: cwd || process.cwd(), resumeSessionId, env: procEnv })
  channels.set(channelId, {
    process: proc,
    permissionMode: 'default',
    planText: '',
    pendingToolUse: null,
    permissionResolvers: new Map(),
    sentPermissionRequests: new Set(),
    totalInputTokens: 0,
    totalOutputTokens: 0,
    // D-10: 保存 sessionId 用于崩溃恢复
    lastSessionId: resumeSessionId || null
  })
  launchingChannels.delete(channelId)

  // D-11: 启动心跳检测
  proc.startHealthCheck(() => {
    // D-11: 进程无响应回调 — 通知渲染进程
    safeLog('[ClaudeIPC] 进程无响应 [' + channelId + ']')
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      win.webContents.send('claude:process-unresponsive', { channelId })
    }
  })
}

function handleIoMessage(channelId: string, message: unknown, _done?: boolean): void {
  const channel = channels.get(channelId)
  if (!channel) {
    safeLog('[ClaudeIPC] 未知频道的 io_message:', channelId)
    return
  }

  // 进程被中断后已停止 — 用 --resume 恢复，再发送消息
  if (!channel.process.running && channel.interrupted && channel.lastSessionId) {
    safeLog('[ClaudeIPC] 进程已停止，正在恢复 — channelId:', channelId)
    resumeChannelAndSendMessage(channelId, channel, message)
    return
  }

  const msg = message as Record<string, unknown>
  if (msg?.type === 'user') {
    channel.process.send({
      type: 'user',
      session_id: channel.lastSessionId || '',
      message: msg.message || msg,
      parent_tool_use_id: null
    })
  } else {
    channel.process.send(message)
  }
}

/** 中断后恢复：清理旧进程，用 --resume 重启，再发送用户消息 */
async function resumeChannelAndSendMessage(
  channelId: string,
  channel: Channel,
  message: unknown
): Promise<void> {
  const sessionId = channel.lastSessionId
  if (!sessionId) return

  // 清理旧进程
  channel.process.removeAllListeners()
  for (const resolver of channel.permissionResolvers.values()) {
    clearTimeout(resolver.timeoutId)
  }
  channel.permissionResolvers.clear()
  channel.sentPermissionRequests.clear()

  // 删除 channel 以允许 handleLaunchClaude 创建新的
  channels.delete(channelId)

  try {
    await handleLaunchClaude(channelId, currentCwd, 'default', '', sessionId)
  } catch (err) {
    safeError('[ClaudeIPC] 恢复进程失败:', err)
    return
  }

  // 进程已重启，发送缓冲的消息
  const newChannel = channels.get(channelId)
  if (!newChannel) return

  const msg = message as Record<string, unknown>
  if (msg?.type === 'user') {
    newChannel.process.send({
      type: 'user',
      session_id: newChannel.lastSessionId || '',
      message: msg.message || msg,
      parent_tool_use_id: null
    })
  } else {
    newChannel.process.send(message)
  }
}

/** D-06: 简化 handleInterrupt — 通过 stdin 控制消息中断，超时回退 kill-and-resume */
function handleInterrupt(channelId: string): void {
  safeLog('[ClaudeIPC] handleInterrupt 收到中断请求 — channelId:', channelId)
  const channel = channels.get(channelId)
  if (!channel) {
    safeLog('[ClaudeIPC] handleInterrupt 未找到频道 — channelId:', channelId, '活跃频道:', [...channels.keys()])
    return
  }
  safeLog('[ClaudeIPC] handleInterrupt 找到频道 — channelId:', channelId, '进程运行状态:', channel.process.running)

  if (!channel.process.running) {
    safeLog('[ClaudeIPC] handleInterrupt 进程未运行，跳过')
    return
  }

  // D-01, D-06: 统一通过 stdin 控制消息中断，不区分平台
  channel.process.interrupt()
  safeLog('[ClaudeIPC] handleInterrupt 控制消息已发送 — channelId:', channelId)

  // D-03: 超时回退 — 如果 2 秒后进程仍在运行，回退到 kill-and-resume
  const sessionId = channel.lastSessionId
  if (!sessionId) {
    safeLog('[ClaudeIPC] handleInterrupt 无 sessionId，跳过超时回退设置')
    return
  }

  // 保存引用用于超时回调
  const proc = channel.process

  setTimeout(() => {
    // 进程已退出或 channel 已不存在 — 无需回退
    if (!proc.running) {
      safeLog('[ClaudeIPC] handleInterrupt 超时检查: 进程已退出 — channelId:', channelId)
      return
    }

    const currentChannel = channels.get(channelId)
    if (!currentChannel || currentChannel.process !== proc) {
      return
    }

    // 进程仍在运行 — CLI 未响应控制消息，回退到 kill-and-resume
    safeLog('[ClaudeIPC] handleInterrupt 超时回退: CLI 未响应，执行 kill-and-resume — channelId:', channelId)
    channel.interrupted = true
    channel.pendingToolUse = null
    proc.stop()
  }, 2000)
}

function sendToolPermissionRequest(
  channel: Channel,
  channelId: string,
  toolUseId: string,
  toolName: string,
  inputJson: string
): void {
  if (channel.sentPermissionRequests.has(toolUseId)) return
  channel.sentPermissionRequests.add(toolUseId)

  let inputs: unknown = {}
  try {
    inputs = JSON.parse(inputJson || '{}')
  } catch {
    /* use empty */
  }

  safeLog('[ClaudeIPC] 检测到 tool_use:', toolName, 'id:', toolUseId)

  const requestId = `perm_${Date.now()}_${Math.random().toString(36).slice(2)}`

  // D-12: 创建 resolver 占位，setTimeout 后更新 timeoutId
  const resolver: PermissionResolver = {
    resolve: () => {},
    toolUseId,
    timeoutId: null as unknown as ReturnType<typeof setTimeout>
  }

  const promise = new Promise<unknown>((resolve) => {
    resolver.resolve = resolve
  })

  // D-12: 超时定时器 — 5 分钟后自动拒绝
  resolver.timeoutId = setTimeout(() => {
    if (channel.permissionResolvers.has(requestId)) {
      channel.permissionResolvers.delete(requestId)
      safeLog('[ClaudeIPC] 工具权限请求超时:', requestId)
      channel.process.send({
        type: 'user',
        session_id: channel.lastSessionId || '',
        message: {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: toolUseId, content: '权限请求超时', is_error: true }
          ]
        },
        parent_tool_use_id: toolUseId
      })
    }
  }, 300000)

  // 将 resolver 存入 channel（包含 timeoutId 供后续清理）
  channel.permissionResolvers.set(requestId, resolver)

  sendToWebview({
    type: 'request',
    requestId,
    channelId,
    request: {
      type: 'tool_permission_request',
      toolName,
      inputs,
      suggestions: []
    }
  })

  // 通知触发：工具权限请求
  if (notificationManager) {
    notificationManager.show({
      type: 'permission',
      title: '工具权限请求',
      body: `Claude 请求使用工具: ${toolName}`,
      channelId,
      requestId,
      toolName
    })
  }

  promise.then((response) => {
    clearTimeout(resolver.timeoutId)
    channel.permissionResolvers.delete(requestId)

    const resp = response as
      | { result?: { behavior?: string; updatedInput?: unknown; message?: string } }
      | undefined
    const result = resp?.result

    safeLog('[ClaudeIPC] 工具权限响应:', result?.behavior, '对应:', toolUseId)

    if (result?.behavior === 'allow') {
      const answer = result.updatedInput || inputs
      channel.process.send({
        type: 'user',
        session_id: channel.lastSessionId || '',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: toolUseId,
              content: typeof answer === 'string' ? answer : JSON.stringify(answer)
            }
          ]
        },
        parent_tool_use_id: toolUseId
      })
    } else {
      channel.process.send({
        type: 'user',
        session_id: channel.lastSessionId || '',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: toolUseId,
              content: result?.message || '用户已拒绝',
              is_error: true
            }
          ]
        },
        parent_tool_use_id: toolUseId
      })
    }
  })
}

function handleCloseChannel(channelId: string): void {
  const channel = channels.get(channelId)
  if (!channel) return
  safeLog('[ClaudeIPC] 正在关闭频道:', channelId)
  // D-12: 清理所有 pending 的超时定时器
  for (const resolver of channel.permissionResolvers.values()) {
    clearTimeout(resolver.timeoutId)
  }
  channel.permissionResolvers.clear()
  channel.process.stop()
  channels.delete(channelId)
}

// --- IPC Registration ---

export function registerClaudeWebviewHandlers(): void {
  ipcMain.handle('claude:start', async () => {
    safeLog('[ClaudeIPC] claude:start 已调用（空操作，会话按需创建）')
    return { success: true }
  })

  ipcMain.handle('claude:set-cwd', (_event, cwd: string) => {
    currentCwd = cwd
    addAllowedRoot(cwd)
    safeLog('[ClaudeIPC] 工作目录已更新:', cwd)
    return { success: true }
  })

  ipcMain.on('claude-webview:from-webview', (_event, msg) => {
    safeLog('[ClaudeIPC] 来自 webview:', JSON.stringify(msg).slice(0, 200))

    if (msg.type === 'request') {
      handleWebviewRequest(msg)
      return
    }

    if (msg.type === 'response') {
      const requestId = msg.requestId as string | undefined
      if (requestId) {
        for (const channel of channels.values()) {
          const resolver = channel.permissionResolvers.get(requestId)
          if (resolver) {
            channel.permissionResolvers.delete(requestId)
            resolver.resolve(msg.response)
            return
          }
        }
      }
      safeLog('[ClaudeIPC] 未处理的 webview 响应:', requestId)
      return
    }

    switch (msg.type) {
      case 'launch_claude':
        handleLaunchClaude(
          msg.channelId,
          msg.cwd,
          msg.permissionMode,
          msg.thinkingLevel,
          msg.resumeSessionId
        )
        return
      case 'io_message':
        handleIoMessage(msg.channelId, msg.message, msg.done)
        return
      case 'interrupt_claude':
        handleInterrupt(msg.channelId)
        return
      case 'close_channel':
        handleCloseChannel(msg.channelId)
        return
      case 'trigger_session_history':
        sendToWebview({ type: 'trigger_session_history' })
        return
      default:
        // D-06: WARN 日志 — 记录未处理的消息类型，帮助发现 webview 消息类型不匹配
        safeError('[ClaudeIPC] 未处理的消息类型:', msg.type, '完整消息:', JSON.stringify(msg).slice(0, 300))
    }
  })

  ipcMain.on('claude:send', (_event, text: string) => {
    const firstChannel = channels.values().next().value
    firstChannel?.process.sendUserMessage(text)
  })

  ipcMain.on('claude:stop', () => {
    for (const channel of channels.values()) {
      channel.process.stop()
    }
    channels.clear()
  })

  ipcMain.handle('claude:get-extension-path', async () => {
    const path = await getExtensionPath()
    safeLog('[ClaudeIPC] 扩展路径:', path)
    return path
  })

  ipcMain.handle('claude:start-webview-server', async (_event, extPath: string) => {
    safeLog('[ClaudeIPC] 正在为以下路径启动 webview 服务器:', extPath)
    const port = await startWebviewServer(extPath)
    safeLog('[ClaudeIPC] webview 服务器已启动，端口:', port)
    return port
  })

  ipcMain.handle('claude:list-sessions', async () => {
    return await listSessions(currentCwd)
  })

  ipcMain.handle('claude:get-model', async () => {
    return getModelSetting()
  })

  ipcMain.handle('claude:get-context-usage', async () => {
    const result: Record<string, { inputTokens: number; outputTokens: number }> = {}
    for (const [channelId, ch] of channels) {
      result[channelId] = { inputTokens: ch.totalInputTokens, outputTokens: ch.totalOutputTokens }
    }
    return result
  })

  ipcMain.handle('claude:delete-session', async (_event, sessionId: string) => {
    return await deleteSession(sessionId, currentCwd)
  })

  ipcMain.handle('claude:resume-session', async (_event, channelId: string, sessionId: string) => {
    safeLog('[ClaudeIPC] 正在恢复会话:', sessionId, '频道:', channelId)

    if (channelId && channels.has(channelId)) {
      const channel = channels.get(channelId)!
      channel.process.removeAllListeners()
      channel.process.stop()
      channels.delete(channelId)
    }

    const effectiveChannelId =
      channelId || `ch_${Date.now()}_${Math.random().toString(36).slice(2)}`

    const messages = await getSessionMessages(sessionId, currentCwd)
    for (const obj of messages) {
      sendToWebview({ type: 'io_message', channelId: effectiveChannelId, message: obj })
    }
    safeLog('[ClaudeIPC] 已重放', messages.length, '条消息，会话:', sessionId)

    await handleLaunchClaude(effectiveChannelId, currentCwd, 'default', '', sessionId, true)
    return { success: true, channelId: effectiveChannelId }
  })

  // D-10: 崩溃恢复 — 渲染进程调用此 IPC 恢复已崩溃的 channel
  ipcMain.handle('claude:recover-process', async (_event, channelId: string) => {
    safeLog('[ClaudeIPC] 正在恢复崩溃进程，频道:', channelId)
    const channel = channels.get(channelId)
    if (!channel) {
      return { success: false, error: '频道不存在' }
    }

    const sessionId = channel.lastSessionId
    if (!sessionId) {
      channels.delete(channelId)
      return { success: false, error: '无可恢复的会话 ID' }
    }

    // 清理旧 channel（停止心跳和清理定时器）
    for (const resolver of channel.permissionResolvers.values()) {
      clearTimeout(resolver.timeoutId)
    }
    channel.permissionResolvers.clear()
    channel.process.removeAllListeners()
    channel.process.stop()
    channels.delete(channelId)

    // 使用保存的 sessionId 重新启动
    try {
      await handleLaunchClaude(channelId, currentCwd, 'default', '', sessionId)
      return { success: true, channelId }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  // UX-07: 获取活跃标签对应的会话 ID
  ipcMain.handle('claude:get-active-session-id', async (_event, channelId: string) => {
    const channel = channels.get(channelId)
    return channel?.lastSessionId || null
  })

  // UX-07: 导出会话为 Markdown 文件
  ipcMain.handle(
    'claude:export-session',
    async (_event, sessionId: string, title: string, savePath: string) => {
      safeLog('[ClaudeIPC] 正在导出会话:', sessionId)
      return await exportSessionAsMarkdown(sessionId, title, savePath, currentCwd)
    }
  )
}

// --- Webview Request Handler ---

async function handleWebviewRequest(msg: {
  requestId?: string
  channelId?: string
  request?: { type: string; [key: string]: unknown }
}): Promise<void> {
  const requestType = msg.request?.type
  const requestId = msg.requestId
  const channelId = msg.channelId

  switch (requestType) {
    case 'init': {
      const authStatus = getAuthStatus()
      const settings = getClaudeSettings()
      webviewInitialized = true
      sendToWebview({
        requestId,
        type: 'response',
        response: {
          type: 'init_response',
          state: {
            defaultCwd: currentCwd,
            openNewInTab: false,
            showTerminalBanner: false,
            showReviewUpsellBanner: false,
            isOnboardingEnabled: false,
            isOnboardingDismissed: true,
            authStatus,
            modelSetting: getModelSetting(),
            thinkingLevel: settings.effortLevel || 'high',
            initialPermissionMode: 'default',
            allowDangerouslySkipPermissions: !!settings.skipDangerousModePermissionPrompt,
            platform: 'windows',
            speechToTextEnabled: false,
            speechToTextMicDenied: false,
            marketplaceType: 'none',
            useCtrlEnterToSend: false,
            chromeMcpState: { status: 'disconnected' },
            browserIntegrationSupported: false,
            debuggerMcpState: { status: 'inactive' },
            jupyterMcpState: { status: 'inactive' },
            remoteControlState: { status: 'disconnected' },
            spinnerVerbsConfig: null,
            settings: {
              permissions: {
                allow: settings.permissions?.allow || [],
                deny: settings.permissions?.deny || [],
                ask: settings.permissions?.ask || []
              }
            },
            claudeSettings: {
              effective: {
                permissions: {
                  allow: settings.permissions?.allow || [],
                  deny: settings.permissions?.deny || [],
                  ask: settings.permissions?.ask || [],
                  disableAutoMode: false,
                  disableBypassPermissionsMode: false
                }
              },
              user: settings
            },
            currentRepo: null,
            experimentGates: {}
          }
        }
      })
      for (const pending of pendingMessages) {
        sendToWebview(pending)
      }
      pendingMessages = []
      break
    }
    case 'login': {
      sendToWebview({
        requestId,
        type: 'response',
        response: { type: 'login_response', auth: getAuthStatus() }
      })
      break
    }
    case 'get_claude_state': {
      const settings = getClaudeSettings()
      sendToWebview({
        requestId,
        type: 'response',
        response: {
          type: 'get_claude_state_response',
          config: {
            env: settings.env || {},
            permissions: settings.permissions || {},
            effortLevel: settings.effortLevel || 'high',
            commands: discoverSkills()
          }
        }
      })
      break
    }
    case 'get_current_selection': {
      sendToWebview({
        requestId,
        type: 'response',
        response: { type: 'get_current_selection_response', selection: null }
      })
      break
    }
    case 'get_asset_uris': {
      sendToWebview({
        requestId,
        type: 'response',
        response: { type: 'get_asset_uris_response', uris: {} }
      })
      break
    }
    case 'list_sessions_request': {
      const sessions = await listSessions(currentCwd)
      sendToWebview({
        requestId,
        type: 'response',
        response: { type: 'list_sessions_response', sessions }
      })
      break
    }
    case 'get_session_request': {
      const sessionId = msg.request?.sessionId as string | undefined
      const messages = await getSessionMessages(sessionId || '', currentCwd)
      sendToWebview({
        requestId,
        type: 'response',
        response: { type: 'get_session_response', messages }
      })
      break
    }
    case 'open_file':
    case 'open_diff':
    case 'open_config_file':
    case 'open_claude_in_terminal':
    case 'generate_session_title':
    case 'log_event':
    case 'update_session_state': {
      sendToWebview({
        requestId,
        type: 'response',
        response: { type: `${requestType}_response`, success: true }
      })
      break
    }
    case 'set_model': {
      const model = msg.request?.model as string | undefined
      safeLog('[ClaudeIPC] 设置模型:', model, '频道:', channelId)
      if (model && channelId) {
        const channel = channels.get(channelId)
        if (channel) {
          channel.process.send({ type: 'set_model', model })
        }
      }
      sendToWebview({
        requestId,
        type: 'response',
        response: { type: 'set_model_response', success: true, model: model || 'default' }
      })
      break
    }
    case 'set_thinking_level': {
      const thinkingLevel = msg.request?.thinkingLevel as string | undefined
      if (thinkingLevel && channelId) {
        const channel = channels.get(channelId)
        if (channel) {
          channel.process.send({ type: 'set_thinking_level', thinkingLevel })
        }
      }
      sendToWebview({
        requestId,
        type: 'response',
        response: { type: 'set_thinking_level_response', success: true }
      })
      break
    }
    case 'set_permission_mode': {
      const mode = msg.request?.mode as string | undefined
      safeLog('[ClaudeIPC] 设置权限模式:', mode, '频道:', channelId)
      if (mode && channelId) {
        const channel = channels.get(channelId)
        if (channel) {
          channel.process.send({ type: 'set_permission_mode', mode })
          channel.permissionMode = mode
          channel.planText = ''
        }
      }
      sendToWebview({
        requestId,
        type: 'response',
        response: { type: 'set_permission_mode_response', success: true }
      })
      break
    }
    case 'list_plugins': {
      handleListPlugins(requestId, msg.request)
      break
    }
    case 'install_plugin': {
      handlePluginCommand(requestId, 'install', msg.request)
      break
    }
    case 'uninstall_plugin': {
      handlePluginCommand(requestId, 'uninstall', msg.request)
      break
    }
    case 'set_plugin_enabled': {
      handlePluginCommand(requestId, msg.request?.enabled ? 'enable' : 'disable', msg.request)
      break
    }
    case 'list_marketplaces': {
      handlePluginCommand(requestId, 'marketplace list', msg.request)
      break
    }
    case 'add_marketplace': {
      handlePluginCommand(requestId, 'marketplace add', msg.request)
      break
    }
    case 'remove_marketplace': {
      handlePluginCommand(requestId, 'marketplace remove', msg.request)
      break
    }
    case 'refresh_marketplace': {
      handlePluginCommand(requestId, 'marketplace update', msg.request)
      break
    }
    case 'get_mcp_servers': {
      handleGetMcpServers(channels, sendToWebview, requestId)
      break
    }
    case 'set_mcp_server_enabled': {
      handleMcpServerCommand(channels, sendToWebview, requestId, 'mcp_toggle', msg.request)
      break
    }
    case 'reconnect_mcp_server': {
      handleMcpServerCommand(channels, sendToWebview, requestId, 'mcp_reconnect', msg.request)
      break
    }
    case 'get_context_usage': {
      // 从活跃频道收集 token 用量
      let totalInput = 0
      let totalOutput = 0
      for (const ch of channels.values()) {
        totalInput += ch.totalInputTokens
        totalOutput += ch.totalOutputTokens
      }
      sendToWebview({
        requestId,
        type: 'response',
        response: {
          type: 'get_context_usage_response',
          usage: {
            input_tokens: totalInput,
            output_tokens: totalOutput,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0
          }
        }
      })
      break
    }
    default: {
      safeLog(
        '[ClaudeIPC] 未处理的请求类型:',
        requestType,
        JSON.stringify(msg.request || {}).slice(0, 300)
      )
      sendToWebview({
        requestId,
        type: 'response',
        response: { type: requestType }
      })
      break
    }
  }
}

// --- Plugin Management ---

async function handleListPlugins(
  requestId: string | undefined,
  request: Record<string, unknown> | undefined
): Promise<void> {
  try {
    const includeAvailable = request?.includeAvailable ? ' --available' : ''
    const output = await runClaudeCliCommand(
      ['plugin', 'list', '--json', includeAvailable].filter(Boolean)
    )
    const parsed = JSON.parse(output.trim())
    sendToWebview({
      requestId,
      type: 'response',
      response: { type: 'list_plugins_response', ...parsed }
    })
  } catch (e) {
    safeError('[ClaudeIPC] 列出插件失败:', e)
    sendToWebview({
      requestId,
      type: 'response',
      response: { type: 'list_plugins_response', installed: [], available: [], errors: [String(e)] }
    })
  }
}

async function handlePluginCommand(
  requestId: string | undefined,
  subcommand: string,
  request: Record<string, unknown> | undefined
): Promise<void> {
  try {
    const args = ['plugin']
    if (subcommand.startsWith('marketplace')) {
      const parts = subcommand.split(' ')
      args.push('marketplace', parts[1])
      if (parts[1] === 'add' && request?.source) args.push(String(request.source))
      else if (parts[1] === 'remove' && request?.marketplaceId)
        args.push(String(request.marketplaceId))
      else if (parts[1] === 'update' && request?.marketplaceId)
        args.push(String(request.marketplaceId))
    } else if (subcommand === 'install') {
      args.push('install', String(request?.pluginId || ''))
      if (request?.scope) args.push('--scope', String(request.scope))
    } else if (subcommand === 'uninstall') {
      args.push('uninstall', String(request?.pluginId || ''))
    } else {
      args.push(subcommand, String(request?.pluginId || ''))
    }

    const output = await runClaudeCliCommand(args)
    sendToWebview({
      requestId,
      type: 'response',
      response: { type: `${subcommand.replace(/ /g, '_')}_response`, output: output.trim() }
    })
  } catch (e) {
    sendToWebview({
      requestId,
      type: 'response',
      response: { type: 'error', error: String(e) }
    })
  }
}

export async function shutdownClaude(): Promise<void> {
  for (const [channelId, channel] of channels) {
    safeLog('[ClaudeIPC] 正在关闭频道:', channelId)
    channel.process.stop()
  }
  channels.clear()
}
