# Feature Landscape: Context Usage Display Changes & 429 Root Cause

**Domain:** Debugging 429 rate limit error caused by context usage display feature additions
**Researched:** 2026-04-24
**Confidence:** HIGH (source code directly analyzed)

## Executive Summary

The context usage display feature (commits `e452bd0` and `d7f382b`) added four distinct mechanisms across two code layers. Analysis of the Claude Code webview's bundled JavaScript (v2.1.119) reveals that the `modelUsage` injection into `result` messages is the most likely trigger for changed webview behavior. The webview has an internal context progress component (`Rt1`) that is conditionally rendered based on `contextWindow > 0` and usage percentage. Before the changes, `contextWindow` was always `0` (the default), meaning the progress bar was always hidden. After injecting `contextWindow: 128000`, the webview now activates its internal context management UI, which has side effects including re-renders and potential request patterns.

However, the **direct cause of 429** is most likely NOT any of the context usage features themselves, but rather a pre-existing issue that these changes made worse or that is coincidental. The context usage changes are all local (IPC, DOM injection, message forwarding) and do not make API calls. The 429 comes from Zhipu AI's API proxy.

## Feature Analysis: What Changed

### Feature 1: Token Tracking on `stream_event` (claude-webview.ts:190-199)
**Status:** PASSIVE -- No API calls generated
**Impact on 429:** NONE
**Confidence:** HIGH

This code reads `usage` data from `stream_event` messages that are already flowing from `claude.exe`. It stores `input_tokens` and `output_tokens` into the `Channel` object. This is a pure data extraction from existing message traffic. It does not generate any new messages, API calls, or requests.

```typescript
if (msg.type === 'stream_event') {
  const usage = (msg.event as Record<string, unknown>)?.usage
  if (usage) {
    if (usage.input_tokens) ch.totalInputTokens = usage.input_tokens
    if (usage.output_tokens) ch.totalOutputTokens = usage.output_tokens
  }
}
```

### Feature 2: `modelUsage` Injection into `result` Messages (claude-webview.ts:201-214)
**Status:** MESSAGE MODIFICATION -- Changes data sent to webview
**Impact on 429:** INDIRECT (triggers webview behavior change)
**Confidence:** HIGH

This code injects two fields into every `result` message before forwarding it to the webview:
1. `total_cost_usd = 0`
2. `modelUsage = { [modelName]: { contextWindow: 128000, maxOutputTokens: 16384 } }`

**Critical finding from webview source analysis:**

The webview's `result` handler checks `$.total_cost_usd !== undefined` to decide whether to update `usageData`. Before this change, `total_cost_usd` was absent (undefined), so the webview NEVER updated `usageData.contextWindow` from result messages -- it remained at the initial value of `0`.

After this change, every `result` message triggers:
```javascript
// Webview internal code (from index.js analysis)
if ($.total_cost_usd !== void 0) {
  let Z = this.usageData.value
  let J = this.currentMainLoopModel.value
  let Y = $.modelUsage?.[J || ""]
  let X = Y?.contextWindow ?? Z.contextWindow
  let Q = Y?.maxOutputTokens ?? Z.maxOutputTokens
  this.usageData.value = {
    totalTokens: Z.totalTokens,
    totalCost: $.total_cost_usd,
    contextWindow: X,
    maxOutputTokens: Q
  }
}
```

The model key lookup (`modelUsage[currentMainLoopModel]`) may FAIL if `ANTHROPIC_MODEL` from settings doesn't match what the CLI reports as `currentMainLoopModel`. The `currentMainLoopModel` is set from the `system` init message's `model` field, which comes from `claude.exe`'s actual model identifier. The code uses `settings.env?.ANTHROPIC_MODEL || ''` as the key, but this may differ from the CLI's reported model name.

When the lookup fails: `Y` is undefined, so it falls back to `Z.contextWindow` (still 0) and `Z.maxOutputTokens` (still 0). However, `totalCost` is now set to `0` instead of remaining unset.

**Key behavioral change:** Setting `total_cost_usd = 0` makes the webview think cost tracking is active, which may influence its request patterns.

### Feature 3: Webview Badge Script (webview-server.ts:226-290)
**Status:** PASSIVE -- Listens to messages, manipulates DOM
**Impact on 429:** NONE (with one caveat)
**Confidence:** HIGH

The badge script in the hosted HTML page:
1. Listens for `from-extension` messages containing `stream_event` data
2. Extracts `usage.input_tokens + usage.output_tokens`
3. Creates a DOM `<span>` badge showing percentage
4. Re-inserts badge every 2 seconds via `setInterval` if React re-rendered it away

**Caveat:** The `setInterval` runs every 2 seconds, performing a `document.contains()` check and potentially a `querySelector` + `insertBefore`. This is purely DOM work and does NOT trigger any IPC messages back to the main process. It does NOT call `acquireVsCodeApi().postMessage()`.

### Feature 4: `get_context_usage` Handler (claude-webview.ts:467-473 and 731-753)
**Status:** REACTIVE -- Only responds to webview requests
**Impact on 429:** NONE
**Confidence:** HIGH

Two implementation points:
1. IPC handler `claude:get-context-usage` -- called from renderer via preload
2. Webview request handler for `get_context_usage` -- called from webview via message passing

Both are request-response: they only execute when something asks for data. They do not poll or initiate communication.

**Important:** The webview HAS a `getContextUsage()` method but analysis of the bundled code shows it is NOT called on any timer or automatically. It exists as an API method but is only invoked on user action (not found in any `useEffect` or `setInterval` in the webview bundle).

### Feature 5 (removed in d7f382b): ChatPanel.vue Token Polling
**Status:** REMOVED -- Was present in e452bd0, removed in d7f382b
**Impact on 429:** Was making IPC calls every 2 seconds (now removed)
**Confidence:** HIGH

The first commit added a `setInterval(pollTokens, 2000)` in ChatPanel.vue that called `window.api.claudeGetContextUsage()` every 2 seconds. This made an IPC roundtrip to the main process every 2 seconds. This was removed in the second commit when the badge was moved into the webview HTML itself.

**This polling did NOT cause API calls to Zhipu AI.** It was purely local Electron IPC. But it may have caused performance issues or interference with the message flow.

## Features Working Correctly

| Feature | How It Works | Why Correct |
|---------|-------------|-------------|
| Token tracking on stream_event | Extracts usage data from existing message traffic | Pure data read, no side effects |
| Badge DOM injection in webview | Creates span element showing percentage | Purely visual, no message generation |
| `get_context_usage` IPC handler | Returns stored token counts | Correct request-response pattern |
| Webview request handler for `get_context_usage` | Returns token counts to webview | Correct request-response pattern |

## Features Potentially Causing Issues

| Feature | Risk Level | Mechanism | Evidence |
|---------|-----------|-----------|----------|
| `modelUsage` injection | HIGH | Triggers webview internal context management UI activation | Webview code shows `contextWindow > 0` enables the progress bar component and compact button |
| `total_cost_usd = 0` injection | MEDIUM | Makes webview think cost tracking is active | Webview checks `total_cost_usd !== undefined` to enter the usage update path |
| Model key mismatch | MEDIUM | `modelUsage[key]` lookup fails, leaving `contextWindow` at 0 | `ANTHROPIC_MODEL` env var may not match CLI's reported model name |

## Anti-Features (Things That Should NOT Be Happening)

| Anti-Feature | Why It's Bad | Evidence | Status |
|-------------|-------------|----------|--------|
| Webview sending extra API requests triggered by context data | Would directly cause 429 | No evidence found in webview code of automatic API calls based on context window size | NOT happening |
| Webview auto-compacting without user action | Would send `/compact` message causing new API calls | Webview only sends `/compact` when user clicks the compact button (`onClick:J` where `J = () => { J("/compact") }`) | NOT happening |
| Token polling making outbound API calls | Would cause continuous API traffic | Polling was Electron IPC only, never reached claude.exe or API | NOT happening |
| Badge setInterval causing message loops | Would create cascading request chains | Badge setInterval is DOM-only, does not call `postMessage` | NOT happening |

## Root Cause Hypotheses (Ordered by Likelihood)

### Hypothesis 1: The changes are coincidental, not causal (MOST LIKELY)
**Confidence:** MEDIUM

The 429 error comes from Zhipu AI's rate limiting. None of the code changes make API calls. The user may have hit a rate limit that would have happened regardless. **Evidence for:** All added code is local IPC/DOM manipulation. **Evidence against:** User reports it worked before and breaks after these changes.

**Recommendation:** Verify by reverting the two commits and testing. If 429 still happens, the changes are not the cause.

### Hypothesis 2: `modelUsage` injection triggers webview behavior that sends extra messages to claude.exe
**Confidence:** MEDIUM

Setting `total_cost_usd = 0` and `modelUsage` causes the webview to enter a code path it previously skipped. While no automatic API calls were found in the webview code, the webview may send additional `io_message` or request messages that we haven't traced. These messages could cause `claude.exe` to make additional API calls.

**Evidence:** The webview's `result` handler now executes additional React state updates. React re-renders could trigger effects that send messages. The MCP server panel has a `setInterval` of 2000ms that polls MCP server status -- this runs when the MCP panel is open but is not related to context usage.

### Hypothesis 3: The `result` message modification breaks message flow ordering
**Confidence:** LOW

The code mutates the `result` message object (`result.total_cost_usd = 0`, `result.modelUsage = {...}`) before forwarding it. If the `result` message is somehow larger or has unexpected fields, it could confuse the webview's message processing and cause retry loops.

### Hypothesis 4: Increased logging causes I/O blocking
**Confidence:** LOW

The log line was changed from `JSON.stringify(msg).slice(0, 150)` to `slice(0, msg.type === 'result' ? 1000 : 150)`. For `result` messages, this serializes and logs up to 1000 characters instead of 150. This is negligible I/O and unlikely to cause issues.

## Feature Dependencies

```
stream_event from claude.exe
  --> Feature 1: Token tracking (stores data in Channel)
  --> Feature 3: Badge script (reads usage from forwarded messages)

result message from claude.exe
  --> Feature 2: modelUsage injection (modifies message before forwarding)
  --> Webview internal: usageData update (triggered by total_cost_usd !== undefined)
  --> Webview internal: context progress bar (rendered when contextWindow > 0 and usage > 50%)

Webview request: get_context_usage
  --> Feature 4: handler returns token counts
  --> Only called on user action (NOT automatic)

(IPC) claude:get-context-usage
  --> Feature 4: handler returns token counts
  --> Was polled every 2s in e452bd0 (removed in d7f382b)
```

## MVP Fix Recommendation

**Priority 1 (Quick test):** Revert `modelUsage` and `total_cost_usd` injection. If 429 stops, the injection is the trigger. If it continues, the issue is elsewhere.

**Priority 2 (If injection is the cause):** Only inject `modelUsage` when the webview explicitly requests it via `get_context_usage`, not on every `result` message. This avoids triggering the webview's internal context management activation.

**Priority 3 (Defensive):** Ensure the model key in `modelUsage` matches what the CLI reports. The current code uses `settings.env?.ANTHROPIC_MODEL` but `currentMainLoopModel` is set from the `system` init message and may differ.

## Sources

- `src/main/ipc/claude-webview.ts` -- Full source analyzed (828 lines)
- `src/main/claude/webview-server.ts` -- Full source analyzed (295 lines)
- `src/renderer/src/components/ChatPanel.vue` -- Full source analyzed (830 lines)
- `src/preload/index.ts` -- Full source analyzed (77 lines)
- `~/.vscode/extensions/anthropic.claude-code-2.1.119-win32-x64/webview/index.js` -- Webview bundle analyzed (2045 lines, minified)
- Git diffs for commits `e452bd0` and `d7f382b` -- Exact change analysis
