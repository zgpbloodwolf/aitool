# WeChat Headless AI Integration Design

**Date:** 2026-04-24

**Status:** Draft for review

**Goal**

Integrate the copied `openclaw-weixin` WeChat plugin capabilities into `aitool` so users can scan a QR code, bring one or more WeChat bot accounts online, receive private-chat text and image messages from WeChat, route those messages into background AI conversations powered by either Claude or Codex, and send the AI replies back to WeChat while also exposing account state and conversation state inside the desktop app.

## Background

The current project at `C:\Users\45057\Desktop\aitool` is an Electron + Vue desktop shell. Its existing core runtime centers on:

- Electron main-process services in `src/main`
- A preload bridge in `src/preload`
- Renderer-side UI and state in `src/renderer/src`
- Existing Claude/Codex-facing UI flows that are tied to foreground webview/tab interactions

The copied `openclaw-weixin` directory already implements substantial WeChat-channel logic, but it is not a generic SDK. It is an OpenClaw channel plugin that depends on `openclaw/plugin-sdk` for:

- channel registration
- session routing
- reply dispatching
- plugin runtime lifecycle
- authorization hooks

Because `aitool` does not currently host the OpenClaw runtime, the recommended path is not to embed OpenClaw wholesale. Instead, `aitool` should reuse the plugin's protocol-heavy pieces and provide its own thin host layer.

## User Decisions Locked In

The following product decisions were confirmed during design:

- AI engine selection must be configurable and support both `Claude` and `Codex`
- Conversation isolation must be configurable, with default behavior as one conversation per WeChat contact
- First release should allow all private-chat users to talk to the bot without a whitelist
- First release must support inbound `text + image`
- Inbound images should be passed into AI for understanding, not only acknowledged
- The desktop app must display WeChat account state and WeChat conversation lists
- If the selected engine supports streaming, replies should be sent in chunks; otherwise fall back to one-shot replies

## Recommended Architecture

Adopt **Option 2: headless AI session manager + WeChat channel adapter inside `aitool`**.

### Why this option

This option best fits the current project because it:

- reuses the WeChat protocol implementation that already exists in `openclaw-weixin`
- avoids embedding the full OpenClaw runtime into an Electron shell that already has its own process model
- cleanly supports background processing, which is required for WeChat-driven conversations
- allows Claude and Codex to be abstracted behind one internal engine interface
- keeps UI state, protocol state, and AI execution state under one app-owned architecture

### Options considered

#### Option 1: embed full OpenClaw runtime

Pros:

- least change to plugin-facing code
- closer to original plugin architecture

Cons:

- significantly increases app complexity
- introduces a second large runtime model into the desktop app
- complicates packaging, debugging, and ownership boundaries

#### Option 2: build a thin app-native host layer

Pros:

- best fit for current codebase
- keeps control in Electron main process
- easier to align with existing Claude/Codex app behavior

Cons:

- requires explicit adaptation work instead of running `channel.ts` unchanged

#### Option 3: split WeChat into a separate sidecar process/service

Pros:

- isolates failures
- keeps main app lighter

Cons:

- worse first-release operability
- more process orchestration and more fragmented logs/state
- more moving parts for users and maintainers

## System Overview

The target runtime is composed of five cooperating layers:

1. **WeChat protocol layer**
   Handles QR login, token persistence, long-polling, message send, message receive, and media upload/download.

2. **WeChat channel manager**
   Owns account lifecycle, worker startup/shutdown, reconnect logic, and overall per-account runtime state.

3. **Conversation store**
   Serves as the canonical source for account state, conversation state, message summaries, routing, and error state.

4. **Headless AI session manager**
   Maintains one background AI session per conversation key, routes to Claude or Codex, serializes work per conversation, and emits structured reply events.

5. **Renderer console**
   Presents account management, QR login state, conversation list, message summaries, engine selection, and error visibility inside the desktop app.

## High-Level Request Flow

1. A WeChat user sends a private text or image message.
2. A per-account polling worker receives the message from the WeChat backend.
3. The protocol adapter normalizes raw WeChat data into an internal canonical message envelope.
4. The conversation store computes the conversation key using the configured isolation mode.
5. The headless AI session manager loads or creates a background AI session for that key.
6. The session manager resolves the selected engine using override priority rules.
7. The engine worker streams or returns the AI response.
8. The message bridge converts AI output into WeChat send payloads.
9. The protocol adapter sends the reply back to WeChat.
10. Renderer-side stores update account and conversation views for the desktop UI.

## Core Behavioral Rules

### Engine selection

Engine resolution priority is:

1. conversation-level override
2. account-level default
3. global default

This means the system can support:

- a global default engine for all WeChat traffic
- per-account default engines
- per-conversation manual overrides for exceptional cases

### Conversation isolation

Supported modes:

- `per-contact` (default)
- `shared`

Conversation keys:

- `per-contact`: `wechat:${accountId}:${peerUserId}`
- `shared`: `wechat:${accountId}:shared`

Default release behavior uses `per-contact`.

### Reply behavior

If the chosen engine supports streaming:

- accumulate deltas
- flush to WeChat in chunks after a minimum threshold or idle timeout
- flush final content on completion

If the chosen engine does not support streaming:

- send one final reply when complete

Suggested defaults:

- `minChars = 120`
- `idleFlushMs = 2500`

### Message scope

First release scope:

- inbound text
- inbound images
- outbound text

Explicitly out of scope for first release:

- voice understanding
- group chat
- AI-generated image return path
- invite/whitelist control
- human handoff workflows

## Module Design

## Main-Process Modules

### `src/main/wechat/protocol-adapter.ts`

Responsibilities:

- wrap QR login start/wait APIs
- send WeChat text replies
- send WeChat image replies
- download inbound images to local temp files
- expose normalized receive/send helpers

Non-responsibilities:

- AI routing
- UI-facing state storage
- account policy decisions

### `src/main/wechat/account-store.ts`

Responsibilities:

- persist sensitive per-account credentials in sidecar files
- maintain account index
- load/save token, base URL, user ID, display metadata

Sensitive storage must stay outside ordinary renderer state.

### `src/main/wechat/channel-manager.ts`

Responsibilities:

- manage multiple WeChat accounts
- start/stop one poller per active account
- reconnect after failures
- surface per-account runtime state
- publish inbound messages into the app pipeline

### `src/main/wechat/conversation-store.ts`

Responsibilities:

- store account records
- store conversation records
- store recent message previews
- store processing/error state
- resolve conversation keys

This is the canonical state source for renderer WeChat pages.

### `src/main/wechat/message-bridge.ts`

Responsibilities:

- convert raw inbound WeChat events into canonical internal messages
- convert canonical AI replies into WeChat outbound payloads
- hide WeChat-specific protocol details such as `contextToken` from higher-level UI code

### `src/main/wechat/headless-session-manager.ts`

Responsibilities:

- maintain background AI sessions without depending on renderer tabs or iframes
- enforce serial processing per conversation key
- resolve engine selection
- call Claude or Codex workers
- emit structured reply events

### `src/main/wechat/engine/claude-worker.ts`

Responsibilities:

- adapt the background input/output contract to Claude
- expose a consistent async event stream to the session manager

### `src/main/wechat/engine/codex-worker.ts`

Responsibilities:

- adapt the background input/output contract to Codex
- expose a consistent async event stream to the session manager

### `src/main/wechat/types.ts`

Responsibilities:

- define app-owned types for account state, conversation state, canonical messages, engine routing, and reply events

### `src/main/ipc/wechat.ts`

Responsibilities:

- register WeChat IPC handlers
- expose account and conversation state to the preload layer
- expose QR login start/wait methods
- expose engine and isolation configuration actions

## Renderer Modules

### `src/renderer/src/stores/wechat.ts`

Responsibilities:

- fetch account list and conversation list
- subscribe to state updates from the main process
- expose data to renderer components

### `src/renderer/src/components/wechat/WeChatAccountsPanel.vue`

Responsibilities:

- start QR login
- show login state and current online accounts
- toggle account enabled state
- set default engine
- set isolation mode

### `src/renderer/src/components/wechat/WeChatConversationsPanel.vue`

Responsibilities:

- show conversation list
- show current engine per conversation
- show last message preview
- show processing and error indicators

## Proposed Internal Data Model

```ts
type EngineType = 'claude' | 'codex'
type IsolationMode = 'per-contact' | 'shared'

interface WeChatAccountRecord {
  accountId: string
  userId?: string
  displayName?: string
  baseUrl: string
  enabled: boolean
  connected: boolean
  defaultEngine: EngineType | null
  sessionIsolationMode: IsolationMode
  lastConnectedAt?: number
  lastInboundAt?: number
  lastOutboundAt?: number
  lastError?: string | null
}

interface WeChatConversationRecord {
  conversationKey: string
  accountId: string
  peerUserId: string
  peerDisplayName?: string
  engine: EngineType
  aiSessionId: string
  processing: boolean
  lastMessagePreview?: string
  lastInboundAt?: number
  lastOutboundAt?: number
  lastError?: string | null
}

interface CanonicalMessage {
  messageId: string
  accountId: string
  peerUserId: string
  direction: 'inbound' | 'outbound'
  type: 'text' | 'image'
  text?: string
  imagePath?: string
  imageUrl?: string
  contextToken?: string
  timestamp: number
}

interface EngineRoutingConfig {
  globalDefaultEngine: EngineType
  accountOverrides: Record<string, EngineType>
}
```

## Message-Flow Rules

### Inbound text

- normalize text into `CanonicalMessage`
- enqueue into the conversation-specific serial queue
- route to the current engine
- return text reply to WeChat

### Inbound image

- download image to local temp storage
- create canonical message with `imagePath`
- send image along with any text caption to the selected engine
- return text reply to WeChat

### Repeated inbound messages while a conversation is running

Per-conversation requests must be serialized.

Behavior:

- exactly one active AI request per conversation key
- new messages join that conversation queue
- later messages are processed only after the current request finishes

This avoids out-of-order context updates and mixed replies.

## Storage Strategy

### Sensitive sidecar storage

Store these outside renderer-facing config:

- token
- base URL
- user ID

Recommended location:

- `%APPDATA%/aitool/wechat/accounts/<accountId>.json`

### Non-sensitive app config

May live in app-managed config/state:

- account enabled flag
- account display name
- account default engine
- account isolation mode

### Runtime-only state

Keep in memory or a lightweight state cache:

- current processing flags
- queued request count
- live reply aggregation
- transient connection errors

## Reuse vs Rewrite Strategy

### Reuse directly or with light adaptation

From `openclaw-weixin`, the following pieces should be reused wherever practical:

- `src/api/api.ts`
- `src/api/types.ts`
- `src/auth/login-qr.ts`
- `src/auth/accounts.ts` (with path/config decoupling)
- `src/messaging/inbound.ts`
- `src/messaging/send.ts`
- `src/messaging/send-media.ts`
- `src/monitor/monitor.ts` (with runtime dependency removal)

### Rewrite for `aitool`

The following pieces should not be used as-is because they are too tied to OpenClaw runtime behavior:

- `src/channel.ts`
- `src/runtime.ts`
- `src/messaging/process-message.ts`
- `src/auth/pairing.ts`

These must be replaced by `aitool`-owned manager, bridge, and session orchestration code.

## Risks and Mitigations

### Risk 1: existing foreground webview chat path is not suitable for background WeChat traffic

Mitigation:

- create a dedicated `headless-session-manager`
- do not try to drive WeChat through renderer iframe tabs

### Risk 2: Claude and Codex differ in background interaction shape

Mitigation:

- introduce one app-owned engine worker interface
- keep business logic unaware of engine-specific transport details

Suggested interface:

```ts
interface AIEngineWorker {
  sendMessage(input: EngineInput): AsyncIterable<EngineEvent>
  shutdown(sessionId: string): Promise<void>
}
```

### Risk 3: losing WeChat `contextToken` breaks reply continuity

Mitigation:

- store `contextToken` per `accountId + peerUserId`
- ensure send paths always retrieve and pass the newest token

### Risk 4: image handling adds temp-file and failure complexity

Mitigation:

- centralize image download and cleanup
- add explicit fallback replies for failed image processing
- keep first release to image understanding only

### Risk 5: parallel processing can corrupt conversation continuity

Mitigation:

- enforce one active job per conversation key
- process each conversation with a serial queue

## Implementation Order

### Phase 1: WeChat protocol loop without AI

Deliver:

- QR login
- account persistence
- online account startup
- inbound text receive
- fixed-text reply

### Phase 2: headless AI text path

Deliver:

- background session manager
- Claude/Codex engine adapters
- conversation store
- text request/response loop

### Phase 3: image understanding

Deliver:

- inbound image download
- canonical image message bridge
- image-to-AI path

### Phase 4: desktop account and conversation UI

Deliver:

- account page
- conversation list page
- live state and error display

### Phase 5: operational polish

Deliver:

- streaming chunk policy
- reconnect behavior
- logs and observability improvements
- conversation-level engine override UI

## First Release Definition of Done

The first release is considered complete when all of the following are true:

- a user can log a WeChat account into the app by QR scan
- the app shows account online/offline state
- private WeChat text messages reach the selected AI engine
- private WeChat image messages reach the selected AI engine as images
- AI text replies are sent back to WeChat
- conversations are isolated per contact by default
- account-level default engine can be configured to Claude or Codex
- the desktop app shows account state and WeChat conversation lists
- users can see recent errors and processing status in the app

## Explicitly Deferred

The following are intentionally deferred beyond first release:

- voice input understanding
- group chat support
- AI-generated image return path
- whitelist/invite workflows
- advanced human handoff
- multi-device synchronization

## File Structure Recommendation

The minimum recommended first implementation footprint is:

- `src/main/wechat/types.ts`
- `src/main/wechat/account-store.ts`
- `src/main/wechat/protocol-adapter.ts`
- `src/main/wechat/channel-manager.ts`
- `src/main/wechat/conversation-store.ts`
- `src/main/wechat/message-bridge.ts`
- `src/main/wechat/headless-session-manager.ts`
- `src/main/wechat/engine/claude-worker.ts`
- `src/main/wechat/engine/codex-worker.ts`
- `src/main/ipc/wechat.ts`
- `src/preload/index.ts`
- `src/renderer/src/stores/wechat.ts`
- `src/renderer/src/components/wechat/WeChatAccountsPanel.vue`
- `src/renderer/src/components/wechat/WeChatConversationsPanel.vue`

## Open Questions

There are no blocking product-definition questions remaining for the first design pass.

Future implementation may still need engine-specific technical validation for:

- the exact background session contract for Claude
- the exact background session contract for Codex
- the best renderer integration point for the new WeChat pages

Those are implementation questions, not design blockers.
