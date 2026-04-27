import type { ClaudeProcessManager } from './process-manager'

export function handleGetMcpServers(
  channels: Map<string, { process: ClaudeProcessManager }>,
  sendToWebview: (msg: unknown) => void,
  requestId: string | undefined
): void {
  const firstChannel = channels.values().next().value
  if (!firstChannel) {
    sendToWebview({
      requestId,
      type: 'response',
      response: { type: 'get_mcp_servers_response', mcpServers: [] }
    })
    return
  }

  const queryId = `mcp_status_${Date.now()}`
  const timeout = setTimeout(() => {
    firstChannel.process.removeListener('message', handler)
    sendToWebview({
      requestId,
      type: 'response',
      response: { type: 'get_mcp_servers_response', mcpServers: [] }
    })
  }, 5000)

  const handler = (msg: Record<string, unknown>) => {
    if (msg.subtype === 'mcp_status' || msg.type === 'mcp_status') {
      clearTimeout(timeout)
      firstChannel.process.removeListener('message', handler)
      const servers = (msg.mcpServers || []) as Array<{ name: string; status: string; error?: string }>
      sendToWebview({
        requestId,
        type: 'response',
        response: {
          type: 'get_mcp_servers_response',
          mcpServers: servers.filter(s => s.name !== 'claude-vscode')
        }
      })
    }
  }

  firstChannel.process.on('message', handler)
  firstChannel.process.send({ type: 'query', subtype: 'mcp_status', queryId })
}

export function handleMcpServerCommand(
  channels: Map<string, { process: ClaudeProcessManager }>,
  sendToWebview: (msg: unknown) => void,
  requestId: string | undefined,
  action: string,
  request: Record<string, unknown> | undefined
): void {
  const channelId = request?.channelId as string
  const channel = channelId ? channels.get(channelId) : channels.values().next().value
  if (!channel) {
    sendToWebview({ requestId, type: 'response', response: { type: `${action}_response` } })
    return
  }

  channel.process.send({
    type: action,
    serverName: request?.serverName,
    enabled: request?.enabled
  })

  sendToWebview({ requestId, type: 'response', response: { type: `${action}_response` } })
}
