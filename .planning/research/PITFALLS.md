# Domain Pitfalls: Electron App Wrapping Claude Code CLI

**Domain:** Desktop Electron app hosting Claude Code CLI via child_process + webview shim
**Researched:** 2026-04-24
**Context:** Bug fix -- 429 rate limit errors after adding context usage display

---

## Critical Pitfalls

### Pitfall 1: In-Flight Message Mutation Triggers Duplicate API Calls

**What goes wrong:** The IPC handler in `claude-webview.ts` mutates `result` messages (from `claude.exe` stdout) before forwarding to the webview. Lines 202-214 modify the `msg` object in-place by setting `total_cost_usd` and `modelUsage`. Because JavaScript objects are passed by reference, this mutation happens on the same object that may be logged, queued in `pendingMessages`, or re-processed. If the webview receives the mutated message and sends it back (e.g., via a re-render cycle or a retry), the injected fields could cause the CLI to misinterpret the message and issue an extra API call.

**Why it happens:** The code treats the NDJSON output from `claude.exe` as mutable data. The `proc.on('message', ...)` callback receives a parsed JSON object, mutates it, then passes it along. There is no defensive copy.

**Consequences:** Extra API requests to the Zhipu AI proxy, each counting against the concurrent request limit. With Zhipu's strict concurrency limits (as low as 1 concurrent request for Lite plans), even one extra call can trigger 429.

**Prevention:** Deep-clone the message before mutation, or better yet, inject `modelUsage` into a separate wrapper object rather than mutating the original:
```typescript
// Instead of mutating msg:
// result.modelUsage = { ... }
// result.total_cost_usd = 0

// Create a wrapper:
const tagged = {
  type: 'io_message',
  channelId,
  message: msg,
  // Attach supplementary data without touching msg
  supplementaryModelUsage: !msg.modelUsage ? buildModelUsage() : undefined
}
```
Alternatively, perform the mutation on a shallow copy: `const patched = { ...msg }` and only mutate `patched`.

**Detection:**
- Enable verbose logging of the exact bytes written to `claude.exe` stdin.
- Count the number of API calls per user message. If more than 1, mutation is likely the cause.
- Check if the webview ever sends a `result`-type message back through `handleIoMessage`.

**Phase to address:** Immediate -- this is the most likely root cause of the 429 bug.

---

### Pitfall 2: Zhipu AI Proxy Concurrency vs. Official Anthropic API

**What goes wrong:** Code that works perfectly with the official Anthropic API (which has generous rate limits) fails with Zhipu AI's proxy because Zhipu enforces much stricter concurrency limits. The error message "429 -- your account has reached the rate limit" from Zhipu is triggered by concurrent request counts, not just requests-per-minute.

**Why it happens:** Zhipu's rate limit model is fundamentally different from Anthropic's:
- **Zhipu**: Limits *concurrent* requests per account (not per minute). Lite plan = 1 project, Pro = 1-2, Max = 2+. Error code 1302.
- **Anthropic**: Limits by tokens-per-minute and requests-per-minute, with much higher ceilings.
- **Peak hours** (weekdays, 15:00-18:00 especially): Zhipu applies dynamic throttling at the platform level (error code 1305).
- A single Claude Code user prompt triggers 5-30 underlying model calls (context analysis, code generation, error correction, subagent calls). Each of these counts as a concurrent request.

The custom Electron host may inadvertently increase concurrency because:
1. The webview's `get_context_usage` request handler iterates all channels and accumulates token counts synchronously -- but if the webview polls this frequently, each poll is a message round-trip that may trigger webview re-renders.
2. The `setInterval` badge re-inserter (every 2 seconds in `webview-server.ts`) causes DOM mutations that may trigger React re-renders in the webview, potentially causing message re-sends.

**Consequences:** Any additional API call beyond what VS Code would make pushes the user over Zhipu's concurrency limit, causing 429 errors that do not occur in VS Code.

**Prevention:**
- Reduce any unnecessary API-triggering activity to zero.
- Audit all message flows to ensure the Electron host adds exactly zero extra API calls compared to VS Code.
- Consider adding a request deduplication layer in the IPC handler.
- Monitor the `api_retry` system messages (already handled in `ChatPanel.vue` line 68-75) to track how often retries happen.

**Detection:**
- Compare the number of HTTP requests made to `open.bigmodel.cn` during a single user message in VS Code vs. the Electron app.
- Log timestamps of every `stdin.write` call to `claude.exe` and look for unexpected duplicates.

**Phase to address:** Immediate -- understanding the Zhipu concurrency model is essential for fixing the 429 bug.

**Sources:**
- [Zhipu AI Rate Limit Documentation](https://docs.bigmodel.cn/cn/api/rate-limit) -- HIGH confidence
- [Zhipu AI Claude API Compatibility](https://docs.bigmodel.cn/cn/guide/develop/claude/introduction) -- HIGH confidence
- [V2EX: Zhipu Code Plan 429 Issues](https://www.v2ex.com/t/1203291) -- MEDIUM confidence

---

### Pitfall 3: `session_id: ''` Prevents Session Continuity, Causes New Conversations

**What goes wrong:** In `process-manager.ts` line 98 and `claude-webview.ts` lines 262-266, every user message is sent with `session_id: ''`. An empty session ID tells Claude CLI to create a new conversation context each time rather than continuing the existing one. This means every message might trigger a fresh API initialization sequence.

**Why it happens:** The code hardcodes `session_id: ''` in `sendUserMessage()` and `handleIoMessage()`. The CLI is launched with `--resume <sessionId>` for session resumption (line 37), but subsequent user messages within that session still send empty session IDs. It is unclear whether the CLI ignores the session_id field when using `--resume`, or whether the empty value causes the CLI to re-initialize.

**Consequences:**
- If the CLI treats empty `session_id` as "new session," each user message triggers a separate API call sequence, multiplying the number of concurrent requests.
- Session state (conversation history, tool results) may be lost between messages, causing the model to re-process context.
- Combined with Zhipu's strict concurrency limits, this could easily trigger 429.

**Prevention:**
- Track the actual session ID from the CLI's initial output and pass it in subsequent messages.
- Examine the CLI's stdout for the session ID (likely in a `system` message with `subtype: 'init'`) and store it in the Channel interface.
- Pass the real session ID in all `send()` calls instead of empty string.

**Detection:**
- Log the full `claude.exe` stdout and look for session IDs.
- Check if VS Code passes a real session ID in its user messages.

**Phase to address:** Immediate -- investigate as part of 429 fix. If the CLI handles `--resume` correctly and ignores the `session_id` field, this is harmless. If not, it is a direct cause of the 429.

---

### Pitfall 4: WebView `setInterval` DOM Manipulation Causes React Re-renders

**What goes wrong:** The context usage badge in `webview-server.ts` (lines 283-289) uses `setInterval` every 2 seconds to re-insert a badge DOM element. When React re-renders the toolbar (which happens frequently during streaming), the badge is removed from the DOM. The `setInterval` detects this and re-inserts it. Each re-insertion triggers a DOM mutation that may cause the webview's React component to re-render again.

**Why it happens:** The Claude Code webview is a React application. Direct DOM manipulation outside of React's control (imperative insertion of a `<span>` element) fights with React's virtual DOM reconciliation. When React re-renders, it replaces the DOM subtree, removing the injected badge. The `setInterval` then re-inserts it, creating a mutation loop.

**Consequences:**
- The mutation loop causes unnecessary React re-renders during streaming.
- Each re-render may cause the webview to recalculate layout and re-send certain messages to the host.
- During active streaming, this creates a feedback loop: stream event arrives -> DOM update -> badge removed -> setInterval re-inserts -> React re-renders -> potential message round-trip.
- This loop is absent in VS Code (which does not have the badge injection), explaining why VS Code works fine.

**Prevention:**
- Use `MutationObserver` instead of `setInterval` to watch for the specific DOM change (badge removal) and re-insert only when needed, with a debounce.
- Or, better: use the webview's `postMessage` API to update the badge from outside the React tree, avoiding DOM mutation entirely.
- Or, best: inject the badge as a React portal or via a webview-exposed API hook rather than direct DOM manipulation.

**Detection:**
- Open DevTools on the webview iframe and profile React re-renders during streaming.
- Check if removing the `setInterval` badge code (commenting it out) stops the 429 errors.

**Phase to address:** Immediate -- this is a primary suspect for the 429 bug. The `setInterval` was added in the same commits that introduced the 429 issue.

---

### Pitfall 5: WebView Message Listener Processed Twice -- `from-extension` Echo

**What goes wrong:** In `webview-server.ts`, there are two `window.addEventListener('message', ...)` handlers. The first one (line 136-138) is a pass-through that does nothing with the message. The second one (line 142-186) handles `trigger_session_history`. A third handler (line 190-193) handles `claude-incoming` events. The badge script (line 232-240) adds a FOURTH `message` handler.

When the ChatPanel (`ChatPanel.vue` line 261-263) forwards messages to the iframe via `iframe.contentWindow.postMessage({ type: 'from-extension', message: msg }, '*')`, this triggers ALL message handlers in the iframe. The badge handler extracts usage data and calls `updateBadge()`. But the `from-extension` message is also received by the webview's own internal message handler (the one that processes Claude Code events).

**Why it happens:** Using `window.postMessage` with `'*'` as the target origin means every listener receives every message. There is no filtering by origin or by a unique message type. The message flow is:
1. Main process sends `io_message` to renderer via IPC.
2. ChatPanel receives it, calls `iframe.contentWindow.postMessage(...)`.
3. The iframe's `window.postMessage` triggers all listeners.
4. The webview's internal handler processes the message (potentially causing API activity).
5. The badge handler also processes the same message (benign but adds overhead).

**Consequences:** If the webview's internal handler processes the same message twice (once from the direct forward and once from an echo), it could cause duplicate API calls.

**Prevention:**
- Use a unique message type prefix for IPC-to-webview messages to avoid confusion with webview-internal messages.
- Verify that the webview does not echo messages back through `postMessage` in a way that creates a loop.

**Detection:**
- Add logging to every `postMessage` call and trace the full message flow for a single user interaction.
- Check if any message appears in the flow more than once.

**Phase to address:** Investigation -- verify during 429 debug whether messages are being duplicated.

---

## Moderate Pitfalls

### Pitfall 6: `modelUsage` Injection with Wrong Model Key

**What goes wrong:** Lines 207-213 inject `modelUsage` with a key derived from `settings.env?.ANTHROPIC_MODEL || ''`. If the model string is empty (no `ANTHROPIC_MODEL` env var set), the key becomes `''` (empty string), resulting in `{'': {contextWindow: 128000, maxOutputTokens: 16384}}`. The webview likely looks for the modelUsage by the actual model name and will not find it, potentially causing the webview to make additional API calls to determine model capabilities.

**Prevention:** Use a fallback model name that matches what Zhipu actually reports (e.g., `'glm-5.1'` or `'default'`). Check what model name the CLI reports in its `result` messages.

**Phase to address:** During 429 fix -- verify the model key is correct.

---

### Pitfall 7: `result` Message Logging at 1000 Chars Slows IPC

**What goes wrong:** Line 130 was changed from `JSON.stringify(msg).slice(0, 150)` to `JSON.stringify(msg).slice(0, msg.type === 'result' ? 1000 : 150)`. The `JSON.stringify()` call still serializes the entire message object before slicing. For large `result` messages (which can contain full conversation history), this is an expensive operation performed on every message, including streaming events.

**Prevention:** Use a conditional approach that only serializes what is needed for logging, or use a fast stringify that truncates early.

**Phase to address:** Low priority -- performance, not correctness issue.

---

### Pitfall 8: Windows SIGINT Handling for CLI Interrupt

**What goes wrong:** In `process-manager.ts` lines 122-128, the `interrupt()` method sends `SIGINT` to the process. On Windows, `process.kill(pid, 'SIGINT')` triggers `CTRL_BREAK_EVENT` which `claude.exe` may or may not handle gracefully. If `claude.exe` does not handle it, the process is terminated rather than interrupted, losing the current conversation state.

**Prevention:** Test interrupt behavior on Windows specifically. Consider sending a JSON message to stdin that requests an interrupt (if the CLI supports it) rather than relying on signals.

**Phase to address:** Future -- not related to current 429 bug.

---

### Pitfall 9: WebView CSP Allows Broad `connect-src`

**What goes wrong:** The Content Security Policy in `webview-server.ts` line 84 includes `connect-src 'self' http://127.0.0.1:* blob: data: ws://localhost:*`. This allows the webview to make HTTP requests to any port on localhost and WebSocket connections to localhost. If the webview has any JavaScript that makes fetch requests (e.g., for model info, session data, or telemetry), these requests could hit local services or trigger unexpected network activity.

**Prevention:** Tighten the CSP to only allow connections to the specific webview server port.

**Phase to address:** Low priority -- security hardening, not directly related to 429.

---

### Pitfall 10: Pending Messages Queue Flushed Without Ordering Guarantee

**What goes wrong:** Lines 217-221 queue messages when the webview is not initialized. When `init` response is sent (line 566-569), all pending messages are flushed. However, the webview's React application may not be fully ready to process these messages when they arrive in rapid succession. If the webview processes messages asynchronously, the order may be lost, causing state corruption.

**Prevention:** Add a small delay between flushing pending messages, or wait for the webview to acknowledge readiness before flushing.

**Phase to address:** Low priority -- only affects startup race condition.

---

## Minor Pitfalls

### Pitfall 11: Hardcoded `contextWindow: 128000`

**What goes wrong:** Line 212 hardcodes `contextWindow: 128000`. Zhipu's GLM-5.1 actually supports 200K context. The hardcoded value understates the context window, making the usage percentage badge display incorrectly (showing higher usage than actual).

**Prevention:** Read the context window from the model's actual specification or from Zhipu's API response.

**Phase to address:** After 429 fix -- cosmetic issue.

---

### Pitfall 12: `get_context_usage` Webview Request Aggregates All Channels

**What goes wrong:** Lines 731-751 aggregate token usage across ALL channels. If multiple tabs are open, the reported usage is the sum of all channels, not the active channel. This is inconsistent with the per-channel tracking in the `channels` Map.

**Prevention:** Pass the `channelId` in the request and return usage for only that channel.

**Phase to address:** Low priority -- UX inconsistency.

---

### Pitfall 13: `acquireVsCodeApi` Singleton Pattern Assumption

**What goes wrong:** The shim in `webview-server.ts` line 208 returns a singleton API object. VS Code's real `acquireVsCodeApi` also returns a singleton, but it throws if called more than once per panel. The shim does not enforce this. If the webview calls `acquireVsCodeApi()` multiple times (which some versions of the Claude Code extension might do during re-initialization), the shim returns the same object, which is correct behavior but may mask bugs.

**Prevention:** Consider logging a warning on second call. Not a functional issue.

**Phase to address:** Not applicable -- informational only.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| 429 bug fix | In-flight mutation (Pitfall 1) + setInterval loop (Pitfall 4) | Clone messages; use MutationObserver; remove setInterval |
| 429 bug fix | Empty session_id (Pitfall 3) | Track and pass real session ID from CLI output |
| 429 bug fix | Zhipu concurrency limits (Pitfall 2) | Audit all API-triggering paths; compare with VS Code |
| Session management | Empty session_id preventing resume (Pitfall 3) | Capture session ID from CLI init output |
| Token tracking | Wrong model key in modelUsage (Pitfall 6) | Use actual model name from CLI output |
| Future features | WebView message echo (Pitfall 5) | Use unique message type prefixes |

---

## Root Cause Hypothesis for the 429 Bug

Based on the code analysis, the most likely root causes (in order of probability):

1. **The `setInterval` badge re-inserter (Pitfall 4)** -- Added in the same commits that introduced the bug. Creates a DOM mutation loop during streaming that may trigger additional API activity through the webview's React re-render cycle.

2. **The `modelUsage`/`total_cost_usd` mutation on `result` messages (Pitfall 1)** -- Added in the same commits. Mutates messages in-place, which could cause the webview to re-process them and trigger additional API calls.

3. **Empty `session_id` (Pitfall 3)** -- Has existed since the beginning but combined with the above changes, may have been masked previously.

**Recommended debugging order:**
1. Comment out the `setInterval` badge code entirely. Test if 429 goes away.
2. If yes, replace `setInterval` with `MutationObserver` + debounce.
3. If no, deep-clone messages before mutation (Pitfall 1).
4. If still failing, investigate session_id handling (Pitfall 3).

---

## Sources

- [Zhipu AI Rate Limit Documentation](https://docs.bigmodel.cn/cn/api/rate-limit) -- HIGH confidence, official docs
- [Zhipu AI Claude API Compatibility](https://docs.bigmodel.cn/cn/guide/develop/claude/introduction) -- HIGH confidence, official docs
- [GitHub Issue #24594: stream-json undocumented](https://github.com/anthropics/claude-code/issues/24594) -- HIGH confidence, official repo
- [GitHub Issue #771: Claude Code can't be spawned from node.js](https://github.com/anthropics/claude-code/issues/771) -- HIGH confidence
- [GitHub Issue #5034: Duplicate entries in session .jsonl](https://github.com/anthropics/claude-code/issues/5034) -- MEDIUM confidence
- [Canopy: Standalone macOS app hosting Claude Code webview](https://github.com/Saqoosha/Canopy) -- HIGH confidence, reference implementation
- [V2EX: Zhipu Code Plan 429 issues](https://www.v2ex.com/t/1203291) -- MEDIUM confidence, community reports
- [Zhipu AI rate limit controversy](https://www.80aj.com/2026/02/11/zhipu-ai-overcapacity-controversy/) -- LOW confidence, blog post
- [Stack Overflow: Claude CLI child process no output](https://stackoverflow.com/questions/79826420/calling-claude-cli-as-a-child-process-yields-no-output) -- MEDIUM confidence
- [Claude Code CLI flags reference](https://www.mager.co/blog/2026-04-17-claude-code-cli-flags/) -- MEDIUM confidence
