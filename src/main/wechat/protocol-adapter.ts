import { createDecipheriv, randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface WeChatQrStartResult {
  sessionKey: string
  qrUrl?: string
  message: string
}

export interface WeChatQrWaitResult {
  connected: boolean
  accountId?: string
  userId?: string
  baseUrl?: string
  token?: string
  message: string
}

export interface WeChatInboundImage {
  encryptedQueryParam: string
  aesKeyBase64?: string
}

export interface WeChatInboundMessage {
  messageId: string
  peerUserId: string
  timestamp: number
  contextToken?: string
  text?: string
  image?: WeChatInboundImage
}

export interface WeChatUpdatesResult {
  cursor: string
  messages: WeChatInboundMessage[]
}

interface ActiveQrLogin {
  sessionKey: string
  qrCode: string
  qrUrl: string
  startedAt: number
}

interface FetchQrResponse {
  qrcode: string
  qrcode_img_content: string
}

interface PollQrResponse {
  status: 'wait' | 'scaned' | 'confirmed' | 'expired'
  bot_token?: string
  ilink_bot_id?: string
  baseurl?: string
  ilink_user_id?: string
}

interface RawWeChatTextItem {
  text?: string
}

interface RawWeChatImageItem {
  media?: {
    encrypt_query_param?: string
    aes_key?: string
  }
  aeskey?: string
}

interface RawWeChatItem {
  type?: number
  text_item?: RawWeChatTextItem
  image_item?: RawWeChatImageItem
}

interface RawWeChatMessage {
  message_id?: number
  client_id?: string
  from_user_id?: string
  create_time_ms?: number
  context_token?: string
  item_list?: RawWeChatItem[]
}

interface RawWeChatUpdatesResponse {
  ret?: number
  errcode?: number
  errmsg?: string
  msgs?: RawWeChatMessage[]
  get_updates_buf?: string
}

const ACTIVE_LOGIN_TTL_MS = 5 * 60_000
const DEFAULT_QR_TIMEOUT_MS = 480_000
const DEFAULT_QR_POLL_TIMEOUT_MS = 35_000
const DEFAULT_API_TIMEOUT_MS = 15_000
const DEFAULT_ILINK_BOT_TYPE = '3'
const DEFAULT_CDN_BASE_URL = 'https://novac2c.cdn.weixin.qq.com/c2c'

const activeLogins = new Map<string, ActiveQrLogin>()

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`
}

function isActiveLoginFresh(login: ActiveQrLogin): boolean {
  return Date.now() - login.startedAt < ACTIVE_LOGIN_TTL_MS
}

function purgeExpiredLogins(): void {
  for (const [sessionKey, login] of activeLogins.entries()) {
    if (!isActiveLoginFresh(login)) {
      activeLogins.delete(sessionKey)
    }
  }
}

async function fetchJson<T>(url: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '(unreadable)')
      throw new Error(`${response.status} ${response.statusText}: ${body}`)
    }

    return (await response.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

async function fetchQrCode(baseUrl: string, botType: string): Promise<FetchQrResponse> {
  const url = new URL(
    `ilink/bot/get_bot_qrcode?bot_type=${encodeURIComponent(botType)}`,
    ensureTrailingSlash(baseUrl)
  )

  return fetchJson<FetchQrResponse>(url.toString(), { method: 'GET' }, DEFAULT_API_TIMEOUT_MS)
}

async function pollQrStatus(baseUrl: string, qrCode: string): Promise<PollQrResponse> {
  const url = new URL(
    `ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrCode)}`,
    ensureTrailingSlash(baseUrl)
  )

  try {
    return await fetchJson<PollQrResponse>(
      url.toString(),
      {
        method: 'GET',
        headers: {
          'iLink-App-ClientVersion': '1'
        }
      },
      DEFAULT_QR_POLL_TIMEOUT_MS
    )
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { status: 'wait' }
    }
    throw error
  }
}

function buildSendMessageBody(params: {
  toUserId: string
  text: string
  contextToken?: string
  clientId: string
}): Record<string, unknown> {
  return {
    msg: {
      from_user_id: '',
      to_user_id: params.toUserId,
      client_id: params.clientId,
      message_type: 1000,
      message_state: 1,
      item_list: [
        {
          type: 1,
          text_item: {
            text: params.text
          }
        }
      ],
      context_token: params.contextToken ?? undefined
    },
    base_info: {
      channel_version: 'aitool'
    }
  }
}

function parseInboundText(items: RawWeChatItem[] | undefined): string | undefined {
  const textItem = items?.find((item) => item.type === 1 && item.text_item?.text)
  return textItem?.text_item?.text?.trim() || undefined
}

function parseInboundImage(items: RawWeChatItem[] | undefined): WeChatInboundImage | undefined {
  const imageItem = items?.find((item) => item.type === 2 && item.image_item?.media?.encrypt_query_param)
  if (!imageItem?.image_item?.media?.encrypt_query_param) {
    return undefined
  }

  const hexAesKey = imageItem.image_item.aeskey?.trim()
  const aesKeyBase64 = hexAesKey
    ? Buffer.from(hexAesKey, 'hex').toString('base64')
    : imageItem.image_item.media.aes_key?.trim() || undefined

  return {
    encryptedQueryParam: imageItem.image_item.media.encrypt_query_param,
    aesKeyBase64
  }
}

function parseAesKey(aesKeyBase64: string): Buffer {
  const decoded = Buffer.from(aesKeyBase64, 'base64')
  if (decoded.length === 16) {
    return decoded
  }

  if (decoded.length === 32 && /^[0-9a-fA-F]{32}$/.test(decoded.toString('ascii'))) {
    return Buffer.from(decoded.toString('ascii'), 'hex')
  }

  throw new Error(`Unsupported WeChat aes_key payload length: ${decoded.length}`)
}

function detectImageExtension(buffer: Buffer): string {
  if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return '.png'
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return '.jpg'
  }

  if (buffer.length >= 4 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return '.gif'
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return '.webp'
  }

  return '.bin'
}

export async function startQrLogin(
  baseUrl: string,
  accountId?: string,
  botType = DEFAULT_ILINK_BOT_TYPE
): Promise<WeChatQrStartResult> {
  const sessionKey = accountId?.trim() || randomUUID()

  purgeExpiredLogins()

  const existing = activeLogins.get(sessionKey)
  if (existing && isActiveLoginFresh(existing)) {
    return {
      sessionKey,
      qrUrl: existing.qrUrl,
      message: '二维码已生成，请继续扫码登录。'
    }
  }

  const qrResponse = await fetchQrCode(baseUrl, botType)
  activeLogins.set(sessionKey, {
    sessionKey,
    qrCode: qrResponse.qrcode,
    qrUrl: qrResponse.qrcode_img_content,
    startedAt: Date.now()
  })

  return {
    sessionKey,
    qrUrl: qrResponse.qrcode_img_content,
    message: '请使用微信扫码完成绑定。'
  }
}

export async function waitQrLogin(
  sessionKey: string,
  baseUrl: string,
  timeoutMs = DEFAULT_QR_TIMEOUT_MS
): Promise<WeChatQrWaitResult> {
  const login = activeLogins.get(sessionKey)
  if (!login) {
    return {
      connected: false,
      message: '当前没有进行中的扫码登录会话。'
    }
  }

  if (!isActiveLoginFresh(login)) {
    activeLogins.delete(sessionKey)
    return {
      connected: false,
      message: '二维码已过期，请重新发起登录。'
    }
  }

  const deadline = Date.now() + Math.max(timeoutMs, 1_000)

  while (Date.now() < deadline) {
    const result = await pollQrStatus(baseUrl, login.qrCode)

    if (result.status === 'confirmed' && result.ilink_bot_id) {
      activeLogins.delete(sessionKey)
      return {
        connected: true,
        accountId: result.ilink_bot_id,
        userId: result.ilink_user_id,
        baseUrl: result.baseurl ?? baseUrl,
        token: result.bot_token,
        message: '微信账号连接成功。'
      }
    }

    if (result.status === 'expired') {
      activeLogins.delete(sessionKey)
      return {
        connected: false,
        message: '二维码已过期，请重新生成。'
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }

  activeLogins.delete(sessionKey)
  return {
    connected: false,
    message: '等待扫码登录超时，请重试。'
  }
}

export async function getUpdates(params: {
  baseUrl: string
  token: string
  cursor?: string
}): Promise<WeChatUpdatesResult> {
  const url = new URL('ilink/bot/getupdates', ensureTrailingSlash(params.baseUrl))
  const response = await fetchJson<RawWeChatUpdatesResponse>(
    url.toString(),
    {
      method: 'POST',
      headers: {
        AuthorizationType: 'ilink_bot_token',
        Authorization: `Bearer ${params.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        get_updates_buf: params.cursor ?? '',
        base_info: {
          channel_version: 'aitool'
        }
      })
    },
    DEFAULT_QR_POLL_TIMEOUT_MS
  )

  if ((response.ret ?? 0) !== 0 || (response.errcode ?? 0) !== 0) {
    throw new Error(response.errmsg || `WeChat getupdates failed: ret=${response.ret} errcode=${response.errcode}`)
  }

  return {
    cursor: response.get_updates_buf ?? params.cursor ?? '',
    messages: (response.msgs ?? [])
      .map((message): WeChatInboundMessage | null => {
        const peerUserId = message.from_user_id?.trim()
        if (!peerUserId) {
          return null
        }

        const text = parseInboundText(message.item_list)
        const image = parseInboundImage(message.item_list)
        if (!text && !image) {
          return null
        }

        return {
          messageId: String(message.message_id ?? message.client_id ?? randomUUID()),
          peerUserId,
          timestamp: message.create_time_ms ?? Date.now(),
          contextToken: message.context_token,
          text,
          image
        }
      })
      .filter((message): message is WeChatInboundMessage => Boolean(message))
  }
}

export async function downloadWeChatImageToTemp(
  image: WeChatInboundImage,
  cdnBaseUrl = DEFAULT_CDN_BASE_URL
): Promise<string> {
  const url = `${cdnBaseUrl}/download?encrypted_query_param=${encodeURIComponent(image.encryptedQueryParam)}`
  const response = await fetch(url)

  if (!response.ok) {
    const body = await response.text().catch(() => '(unreadable)')
    throw new Error(`WeChat CDN download failed: ${response.status} ${response.statusText}: ${body}`)
  }

  const encryptedBytes = Buffer.from(await response.arrayBuffer())
  const bytes = image.aesKeyBase64
    ? (() => {
        const decipher = createDecipheriv('aes-128-ecb', parseAesKey(image.aesKeyBase64!), null)
        return Buffer.concat([decipher.update(encryptedBytes), decipher.final()])
      })()
    : encryptedBytes

  const dir = join(tmpdir(), 'aitool-wechat-inbound')
  await mkdir(dir, { recursive: true })
  const filePath = join(dir, `${randomUUID()}${detectImageExtension(bytes)}`)
  await writeFile(filePath, bytes)
  return filePath
}

export async function sendWeChatText(params: {
  baseUrl: string
  token: string
  toUserId: string
  text: string
  contextToken?: string
}): Promise<{ messageId: string }> {
  const clientId = randomUUID()
  const body = buildSendMessageBody({
    toUserId: params.toUserId,
    text: params.text,
    contextToken: params.contextToken,
    clientId
  })
  const url = new URL('ilink/bot/sendmessage', ensureTrailingSlash(params.baseUrl))

  await fetchJson(
    url.toString(),
    {
      method: 'POST',
      headers: {
        AuthorizationType: 'ilink_bot_token',
        Authorization: `Bearer ${params.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    },
    DEFAULT_API_TIMEOUT_MS
  )

  return { messageId: clientId }
}
