# Technology Stack

**Project:** AI Tools - Electron Claude Code Desktop Client (Bug Fix)
**Researched:** 2026-04-24
**Bug:** Messages result in no response + 429 rate limit after adding context usage display

## Recommended Stack (Current, No Changes)

This is a bug-fix milestone. The stack is already chosen and must not change. Documentation below maps every component's role in the message flow and its relevance to the 429 bug.

### Core Framework

| Technology | Version | Purpose | Why Relevant to Bug |
|------------|---------|---------|---------------------|
| Electron | 35 | Desktop window host | IPC bridge between renderer and main process carries all CLI/webview messages |
| electron-vite | - | Build tooling | Not relevant to bug |
| Vue 3 | 3.x | Renderer UI framework | ChatPanel.vue routes messages between iframes and main process |
| Pinia | - | State management | Not relevant to bug |
| TypeScript | - | Language | Not relevant to bug |

### CLI Integration

| Technology | Version | Purpose | Why Relevant to Bug |
|------------|---------|---------|---------------------|
| Claude Code CLI (`claude.exe`) | - | AI backend, spawned as child process | The actual process making API calls to Zhipu proxy; 429 originates here |
| `child_process.spawn` | Node built-in | Process spawning | Creates the CLI process with pipe stdio |
| `readline` | Node built-in | NDJSON line parsing | Each stdout line is one stream-json message; parsing failures could lose data |
| stream-json protocol | - | Bidirectional CLI communication | Input/output format; defines all message types in play |

### API Proxy

| Technology | Version | Purpose | Why Relevant to Bug |
|------------|---------|---------|---------------------|
| Zhipu AI API proxy | - | Anthropic API proxy at `open.bigmodel.cn/api/anthropic` | **Source of 429 error**. Concurrent request limits, not just rate-per-minute |
| Model: GLM-5.1 | - | Underlying model | Model name may be non-standard in `ANTHROPIC_MODEL` env var, affecting `modelUsage` key |

### Webview Hosting

| Technology | Version | Purpose | Why Relevant to Bug |
|------------|---------|---------|---------------------|
| Local HTTP server | Node `http` | Serves Claude Code VS Code extension webview files | Host HTML contains the injected context badge script |
| VS Code extension webview files | - | Claude Code's React UI | Expects `acquireVsCodeApi` shim and specific message protocol |
| `acquireVsCodeApi` shim | Custom JS | Bridges webview messages to Electron IPC | Routes `postMessage` to parent frame for IPC relay |

### Supporting Libraries

| Library | Purpose | When Used | Relevance to Bug |
|---------|---------|-----------|------------------|
| `safeLog` / `safeError` (logger.ts) | File logging to `~/.claude/aitools-dev.log` | All debug logging | Check logs for message flow tracing |
| `resolveClaudeBinary` (binary-resolver.ts) | Finds `claude.exe` path | At channel creation | Not relevant to bug |
| `session-store.ts` | Session history persistence | Session list/restore | Not relevant to bug |

---

## End-to-End Message Flow

This is the complete path a user message takes, with every component and the bug-introducing changes marked.

### 1. User Input (Webview iframe)

```
User types in Claude Code webview input
  -> webview calls acquireVsCodeApi().postMessage(msg)
  -> window.parent.postMessage({ type: 'claude-webview-message', message: msg }, '*')
```

### 2. Renderer Relay (ChatPanel.vue)

```
ChatPanel.vue receives iframe message via @message handler
  -> handleIframeMessage() extracts channelId from tab mapping
  -> window.api.sendToClaudeWebview({ type: 'io_message', channelId, message: msg })
  -> IPC bridge to main process
```

### 3. Main Process IPC (claude-webview.ts)

```
ipcMain handler receives 'send-to-claude-webview'
  -> routes to handleIoMessage()
  -> channel.process.send(msg) writes JSON + '\n' to claude.exe stdin
```

### 4. Claude CLI Processing

```
claude.exe receives NDJSON on stdin
  -> parses user message
  -> makes API call to ANTHROPIC_BASE_URL (Zhipu proxy)
  -> streams response events on stdout as NDJSON lines
```

### 5. Response Stream Back

```
ClaudeProcessManager readline 'line' event
  -> JSON.parse(line) -> emit('message', msg)
  -> claude-webview.ts handler receives msg

  === BUG-INTRODUCING CODE (commits e452bd0, d7f382b) ===

  -> [NEW] if msg.type === 'stream_event': extract usage tokens, store on Channel
  -> [NEW] if msg.type === 'result': inject modelUsage { [model]: { contextWindow: 128000, maxOutputTokens: 16384 } }
  -> [NEW] if msg.type === 'result': inject total_cost_usd = 0 if undefined
  ========================================================

  -> send via IPC to renderer
```

### 6. Renderer Forward (ChatPanel.vue)

```
ChatPanel.vue receives 'on-claude-webview-message' IPC event
  -> forwardToWebview(channelId, msg)
  -> iframe.contentWindow.postMessage({ type: 'from-extension', message: msg }, '*')
```

### 7. Webview Receives (iframe)

```
Webview receives message event
  -> Internal React app processes the message
  -> Updates UI (chat messages, tool results, etc.)

  === BUG-INTRODUCING CODE (webview-server.ts injected script) ===

  -> [NEW] Badge script listens for 'from-extension' messages
  -> [NEW] Extracts stream_event usage for token counting
  -> [NEW] Updates/inserts context percentage badge in DOM
  -> [NEW] setInterval every 2000ms re-inserts badge if React removed it
  ================================================================
```

---

## The 429 Bug: Root Cause Analysis

### What the Bug-Introducing Commits Changed

**Commit `e452bd0`** (feat: add context usage statistics and display):
1. Added `totalInputTokens` and `totalOutputTokens` fields to `Channel` interface
2. Added `stream_event` handler to track token usage per channel
3. Added `modelUsage` injection into `result` messages (lines 201-214)
4. Added `total_cost_usd = 0` injection for result messages without it
5. Changed `get_context_usage` handler from returning `null` to returning aggregated token data

**Commit `d7f382b`** (optimize context display):
1. Moved context badge from ChatPanel.vue into webview-server.ts HTML generation
2. Badge now runs inside the webview iframe directly, listening to all messages

### How These Changes Can Cause 429 Rate Limiting

The 429 error from Zhipu AI means **concurrent request limit exceeded**, not just requests-per-minute. The following mechanisms explain how the changes could cause this:

#### Suspect 1: `get_context_usage` Response Triggers Webview Polling (HIGH probability)

The webview's internal React code likely has a context management system that polls `get_context_usage`. Before the bug commits, this handler returned `null` (a no-op). After the commits, it returns real token data. This could:

- Activate a context compaction feature that was previously dormant
- Trigger the webview to initiate auto-compaction, which sends additional messages to the CLI
- The CLI then makes additional API calls to perform compaction, increasing concurrent requests

**Evidence:** The `modelUsage` injection specifically sets `contextWindow: 128000`. The webview's built-in context progress bar compares current usage against this limit. When usage approaches the limit, the webview may auto-trigger compaction -- which sends more messages to the CLI, which makes more API calls, hitting the concurrent limit.

#### Suspect 2: `modelUsage` Key Is Empty String (MEDIUM probability)

```typescript
const model = settings.env?.ANTHROPIC_MODEL || ''
result.modelUsage = { [model]: { contextWindow: 128000, maxOutputTokens: 16384 } }
```

If `ANTHROPIC_MODEL` is not set in `~/.claude/settings.json` (or is set to `glm-5.1` which the webview does not recognize), the `modelUsage` object has an empty or unknown key. The webview's internal code may:

- Fail to match the model key, causing errors that trigger retries
- Misinterpret the data and make additional API calls
- Fall into an error recovery loop that sends repeated requests

**How to verify:** Check `~/.claude/settings.json` for the value of `env.ANTHROPIC_MODEL`. If empty or set to `glm-5.1`, this is likely contributing.

#### Suspect 3: `total_cost_usd = 0` Override (LOW-MEDIUM probability)

```typescript
if (result.total_cost_usd === undefined) {
  result.total_cost_usd = 0
}
```

The webview may use `total_cost_usd` to determine if a conversation turn completed successfully. Setting it to `0` when the CLI did not provide it could cause the webview to think the turn was free/invalid, potentially triggering retry logic or additional requests.

#### Suspect 4: Badge Script `message` Event Listener Conflict (LOW probability)

The injected badge script in `webview-server.ts` adds a `message` event listener on `window`:

```javascript
window.addEventListener('message', function(e) {
  var data = e.data;
  if (!data || data.type !== 'from-extension') return;
  var msg = data.message && data.message.message ? data.message.message : null;
  if (!msg || msg.type !== 'stream_event' || !msg.event) return;
  // ...
});
```

This listener does not call `stopPropagation()` or `preventDefault()`, so it should not interfere. However, the `setInterval` every 2000ms doing DOM manipulation could cause React reconciliation churn.

#### Suspect 5: Context Badge DOM Manipulation Triggers React Re-renders (LOW probability)

The `setInterval` re-inserting the badge every 2 seconds when React removes it could create a feedback loop: React renders -> removes badge -> setInterval re-inserts -> React re-renders -> repeat. This is unlikely to cause 429 directly but could degrade performance.

### Most Likely Root Cause Chain

```
1. User sends message
2. CLI makes API call -> gets response -> streams events
3. result message arrives -> modelUsage injected with empty/unknown model key
4. get_context_usage now returns real data instead of null
5. Webview's context management activates (was dormant before)
6. Webview may auto-trigger compaction or retry
7. Additional messages sent to CLI
8. CLI makes additional concurrent API calls
9. Zhipu proxy rejects with 429 (concurrent limit exceeded)
```

### Why VS Code Works Fine

In VS Code, the Claude Code extension:
- Runs in the official extension host, which handles `modelUsage` natively
- The extension provides correct model metadata from the API response itself
- `get_context_usage` returns API-provided data, not injected data
- No `modelUsage` injection is needed because the API provides it
- The official extension's context management works correctly with proper model keys

---

## Zhipu AI API Proxy Behavior

### What It Is

Zhipu AI (智谱 AI) provides an Anthropic-compatible API proxy at `open.bigmodel.cn/api/anthropic`. It translates Anthropic API format to their own GLM model infrastructure.

### Rate Limiting Behavior

| Limit Type | Behavior | Evidence |
|------------|----------|----------|
| Concurrent requests | Strict limit; 429 = "concurrent request limit exceeded" | Error message: "您的账户已达到速率限制" |
| Requests per minute | Likely also limited | Standard for API proxies |
| Token-based limits | Likely; unknown specifics | Standard for API proxies |

**Key insight:** The 429 from Zhipu is triggered by **concurrent** requests, not total requests. If the Electron client makes multiple simultaneous API calls (e.g., one for the user message + one for compaction), it hits this limit faster than VS Code's single-call pattern.

### Configuration

- Base URL: `open.bigmodel.cn/api/anthropic`
- Auth: Via `ANTHROPIC_AUTH_TOKEN` in `~/.claude/settings.json`
- Model: GLM-5.1 (set via `ANTHROPIC_MODEL` env var)

---

## Claude Code CLI Stream-JSON Protocol

### Input Format

NDJSON on stdin. Each line is a JSON object.

**User message format** (from `process-manager.ts`):
```json
{
  "type": "user",
  "session_id": "",
  "message": {
    "role": "user",
    "content": [{ "type": "text", "text": "..." }]
  },
  "parent_tool_use_id": null
}
```

### Output Format

NDJSON on stdout. Message types observed in code:

| Type | Purpose | Fields of Interest |
|------|---------|-------------------|
| `init` | Session initialization | Session metadata |
| `assistant` | Full assistant message | Complete message content |
| `content_block_start` | Streaming block start | Block type, text |
| `content_block_delta` | Streaming text delta | Incremental text |
| `content_block_stop` | Block complete | - |
| `stream_event` | API-level streaming event | **`usage`** (input_tokens, output_tokens) |
| `result` | Turn complete | **`total_cost_usd`**, **`modelUsage`**, `session_id`, `duration_ms` |
| `system` | System messages | Subtypes: `init`, `hook_started`, `hook_response`, **`api_retry`**, `result` |

### CLI Launch Arguments

```
--output-format stream-json    NDJSON output on stdout
--verbose                      Include extra event types
--input-format stream-json     Accept NDJSON input on stdin
--include-partial-messages     Include content_block_delta events
--include-hook-events          Include hook_started/hook_response events
--resume <session_id>          Resume existing session
```

---

## Webview Communication Protocol

### Message Types (Webview -> Main Process)

Sent via `acquireVsCodeApi().postMessage()`:

| Type | Purpose |
|------|---------|
| User chat input | Sends user message to CLI |
| Tool permission response | Approve/deny tool use |
| `get_context_usage` | Request current token usage |
| `set_model` | Change model selection |
| `init` | Initialize webview session |
| MCP-related messages | Manage MCP servers |

### Message Types (Main Process -> Webview)

Sent via `iframe.contentWindow.postMessage({ type: 'from-extension', message: ... })`:

| Type | Purpose |
|------|---------|
| `assistant` | Assistant message content |
| `content_block_*` | Streaming content |
| `stream_event` | API-level events including usage |
| `result` | Turn completion with cost/usage |
| `system` | System messages, retries, errors |
| Tool permission requests | Ask user to approve/deny |

### IPC Bridge Map

```
Webview (iframe)
  |
  | postMessage({ type: 'claude-webview-message', message })
  v
ChatPanel.vue (renderer)
  |
  | window.api.sendToClaudeWebview({ type: 'io_message', channelId, message })
  v
ipcMain (main process)
  |
  | handleIoMessage() -> channel.process.send(msg) -> stdin
  v
claude.exe
  |
  | stdout NDJSON -> readline -> emit('message')
  v
claude-webview.ts handler
  |
  | [BUG CODE: token tracking, modelUsage injection]
  | BrowserWindow.webContents.send('on-claude-webview-message', tagged)
  v
ChatPanel.vue (renderer)
  |
  | forwardToWebview() -> iframe.postMessage({ type: 'from-extension', message })
  v
Webview (iframe)
  |
  | [BUG CODE: badge script listens for stream_event usage]
```

---

## Alternatives Considered (For Fix Approach Only)

| Approach | Description | Why Not / When to Use |
|----------|-------------|----------------------|
| Revert both commits | Remove all context usage code | Nuclear option; loses a working feature. Use only if no targeted fix works |
| Remove modelUsage injection only | Keep token tracking, remove the injected data | Targeted; tests whether Suspect 1/2 is root cause. Recommended first step |
| Remove get_context_usage response | Return null again | Tests Suspect 1. Quick diagnostic |
| Fix model key to match expected format | Use a known model name as key | Fixes Suspect 2. Low risk |
| Remove badge setInterval | Change to MutationObserver or remove periodic re-insertion | Fixes Suspect 5. Unlikely to be root cause |
| Add request deduplication | Prevent duplicate API calls | Defensive; addresses symptom not cause |

---

## Installation

No changes needed. This is a bug-fix milestone on existing stack.

---

## Diagnostic Steps (Recommended Investigation Order)

1. **Check `~/.claude/settings.json`** for `env.ANTHROPIC_MODEL` value. If empty, this explains the empty model key in `modelUsage`.

2. **Temporarily remove the `modelUsage` injection** (lines 201-214 in `claude-webview.ts`) and test. If the bug disappears, the injection is the trigger.

3. **Temporarily revert `get_context_usage` handler** to return `null` and test. If the bug disappears, the webview's context management was being activated.

4. **Add logging** before and after every `send()` call in `ClaudeProcessManager` to count exactly how many messages are sent per user turn. Compare count with and without the bug commits.

5. **Check Zhipu AI dashboard** for concurrent request metrics during the test.

---

## Sources

- Project source code analysis (primary source, HIGH confidence)
- Claude Code stream-json protocol: avasdream.com blog + web search results (MEDIUM confidence)
- Zhipu AI rate limiting: web search for "智谱AI API速率限制 429" (MEDIUM confidence)
- Git diffs for commits `e452bd0` and `d7f382b` (HIGH confidence)
- Claude Code Context7 documentation lookup (MEDIUM confidence)
