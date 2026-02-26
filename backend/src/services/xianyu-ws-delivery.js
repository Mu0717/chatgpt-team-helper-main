import crypto from 'crypto'

import {
  getXianyuConfig,
  refreshXianyuLogin,
  updateXianyuConfig,
  normalizeXianyuOrderId,
  resolveXianyuDeviceIdFromCookies,
  queryXianyuOrderDetailFromApi,
  transformXianyuApiOrder,
  transformApiOrderForImport,
  importXianyuOrders,
  recordXianyuSyncResult,
  getXianyuOrderImNotifiedAt,
  markXianyuOrderImNotified,
} from './xianyu-orders.js'
import { getFeatureFlags, isFeatureEnabled } from '../utils/feature-flags.js'

const LABEL = '[XianyuWsDelivery]'

const WS_URL = 'wss://wss-goofish.dingtalk.com/'
const WS_HEADERS = {
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Accept-Language': 'zh-CN,zh;q=0.9',
  'Cache-Control': 'no-cache',
  Connection: 'Upgrade',
  Host: 'wss-goofish.dingtalk.com',
  Origin: 'https://www.goofish.com',
  Pragma: 'no-cache',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

const HEARTBEAT_INTERVAL_MS = 15 * 1000
const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAY_MS = 5000
const DEFAULT_SYNC_POLL_INTERVAL_SECONDS = 60

const DEFAULT_DELIVERY_MESSAGE =
  '请访问网页输入邮箱和订单号进行自助激活：https://team.example.com/redeem/xianyu'

const ORDER_STATUS_MESSAGES = [
  '[我已拍下，待付款]',
  '[我已付款，等待你发货]',
  '[已付款，待发货]',
  '[你已发货]',
  '[你已发货，请等待买家确认收货]',
  '[买家确认收货，交易成功]',
  '[你已确认收货，交易成功]',
  '[你关闭了订单，钱款已原路退返]',
  '[未付款，买家关闭了订单]',
  '[记得及时确认收货]',
  '已发货',
  '有蚂蚁森林能量可领'
]

function parseBool(value, defaultValue = true) {
  if (value === undefined || value === null) return defaultValue
  if (typeof value === 'boolean') return value
  return ['true', '1', 'yes', 'y', 'on'].includes(String(value).toLowerCase())
}

function isDebugEnabled() {
  return parseBool(process.env.XIANYU_WS_DELIVERY_DEBUG, false)
}

function isDryRunEnabled() {
  return parseBool(process.env.XIANYU_WS_DELIVERY_DRY_RUN, false)
}

function logDebug(message, meta) {
  if (!isDebugEnabled()) return
  if (meta === undefined) {
    console.log(`${LABEL} ${message}`)
  } else {
    console.log(`${LABEL} ${message}`, meta)
  }
}

function sanitizeLogText(value, maxLen = 120) {
  const raw = value == null ? '' : String(value)
  const trimmed = raw.length > maxLen ? `${raw.slice(0, maxLen)}…` : raw
  return trimmed.replace(/[\r\n\t]+/g, ' ')
}

function generateMid() {
  const randomPart = Math.floor(Math.random() * 1000)
  const timestamp = Date.now()
  return `${randomPart}${timestamp} 0`
}

function generateUuid() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const chars = '0123456789abcdef'
  const sections = [8, 4, 4, 4, 12]
  return sections
    .map(len => Array.from({ length: len }, () => chars[Math.floor(Math.random() * 16)]).join(''))
    .join('-')
}

function parseCookieHeaderToObject(cookiesStr = '') {
  if (!cookiesStr) return {}
  const cookies = {}
  for (const cookie of String(cookiesStr).replace(/; /g, ';').split(';')) {
    const trimmed = cookie.trim()
    const idx = trimmed.indexOf('=')
    if (idx > 0) {
      cookies[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim()
    }
  }
  return cookies
}

function isOrderStatusMessage(content = '') {
  return ORDER_STATUS_MESSAGES.some(msg => String(content || '').includes(msg))
}

function normalizeGoofishChatId(chatIdRaw) {
  const raw = chatIdRaw == null ? '' : String(chatIdRaw)
  return raw.includes('@') ? raw.split('@')[0] : raw
}

function safeToText(data) {
  if (typeof data === 'string') return data
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf-8')
  if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf-8')
  return Buffer.from(data).toString('utf-8')
}

class MessagePackDecoder {
  constructor(data) {
    this.data = data
    this.pos = 0
  }

  readByte() {
    return this.data[this.pos++]
  }

  readBytes(count) {
    const result = this.data.subarray(this.pos, this.pos + count)
    this.pos += count
    return result
  }

  readUint32() {
    const val = this.data.readUInt32BE(this.pos)
    this.pos += 4
    return val
  }

  readString(length) {
    return this.readBytes(length).toString('utf-8')
  }

  decodeArray(size) {
    return Array.from({ length: size }, () => this.decodeValue())
  }

  decodeMap(size) {
    const result = {}
    for (let i = 0; i < size; i++) {
      const key = this.decodeValue()
      result[String(key)] = this.decodeValue()
    }
    return result
  }

  decodeValue() {
    const fmt = this.readByte()

    if (fmt <= 0x7f) return fmt
    if (fmt >= 0x80 && fmt <= 0x8f) return this.decodeMap(fmt & 0x0f)
    if (fmt >= 0x90 && fmt <= 0x9f) return this.decodeArray(fmt & 0x0f)
    if (fmt >= 0xa0 && fmt <= 0xbf) return this.readString(fmt & 0x1f)
    if (fmt === 0xc0) return null
    if (fmt === 0xc2) return false
    if (fmt === 0xc3) return true
    if (fmt === 0xc4) return this.readBytes(this.readByte())
    if (fmt === 0xc5) {
      const len = this.data.readUInt16BE(this.pos)
      this.pos += 2
      return this.readBytes(len)
    }
    if (fmt === 0xc6) return this.readBytes(this.readUint32())
    if (fmt === 0xcc) return this.readByte()
    if (fmt === 0xcd) {
      const val = this.data.readUInt16BE(this.pos)
      this.pos += 2
      return val
    }
    if (fmt === 0xce) return this.readUint32()
    if (fmt === 0xcf) {
      const val = this.data.readBigUInt64BE(this.pos)
      this.pos += 8
      return Number(val)
    }
    if (fmt === 0xd9) return this.readString(this.readByte())
    if (fmt === 0xda) {
      const len = this.data.readUInt16BE(this.pos)
      this.pos += 2
      return this.readString(len)
    }
    if (fmt === 0xdb) return this.readString(this.readUint32())
    if (fmt === 0xdc) {
      const len = this.data.readUInt16BE(this.pos)
      this.pos += 2
      return this.decodeArray(len)
    }
    if (fmt === 0xdd) return this.decodeArray(this.readUint32())
    if (fmt === 0xde) {
      const len = this.data.readUInt16BE(this.pos)
      this.pos += 2
      return this.decodeMap(len)
    }
    if (fmt === 0xdf) return this.decodeMap(this.readUint32())
    if (fmt >= 0xe0) return fmt - 0x100

    throw new Error(`Unknown format: ${fmt.toString(16)}`)
  }

  decode() {
    return this.decodeValue()
  }
}

function decryptMessagePack(data) {
  let padded = data
  const missing = data.length % 4
  if (missing) padded += '='.repeat(4 - missing)

  const decoded = Buffer.from(padded, 'base64')
  const decoder = new MessagePackDecoder(decoded)
  return decoder.decode()
}

function decryptSyncData(data) {
  try {
    const result = decryptMessagePack(data)
    if (result && typeof result === 'object') {
      const msg1 = result['1'] || result[1]
      if (msg1 && typeof msg1 === 'object') {
        const msg10 = msg1['10'] || msg1[10]
        if (msg10 && typeof msg10 === 'object' && 'reminderContent' in msg10) {
          return result
        }
      }
    }
  } catch {
    // ignore
  }

  try {
    const decoded = Buffer.from(data, 'base64').toString('utf-8')
    const parsed = JSON.parse(decoded)
    if (typeof parsed === 'object') {
      if ('chatType' in parsed) return null
      return parsed
    }
  } catch {
    // ignore
  }

  return null
}

function extractOrderIdFromText(text) {
  const match = String(text || '').match(/\b(\d{15,30})\b/)
  return match ? normalizeXianyuOrderId(match[1]) : ''
}

function extractOrderInfo(message) {
  const msg1 = message?.['1'] || message?.[1]
  if (!msg1 || typeof msg1 !== 'object') return null

  const msg10 = msg1?.['10'] || msg1?.[10]
  if (!msg10 || typeof msg10 !== 'object') return null

  const chatId = normalizeGoofishChatId(msg1['2'] || msg1[2] || '')
  const content = msg10.reminderContent || ''
  let orderStatus = ''
  let orderId = ''

  try {
    const bizTag = msg10.bizTag
    if (bizTag) {
      const tag = JSON.parse(bizTag)
      orderStatus = tag?.taskName ? String(tag.taskName) : ''
    }
  } catch {
    // ignore
  }

  try {
    const extJson = msg10.extJson
    if (extJson) {
      const ext = JSON.parse(extJson)
      if (ext.updateKey) {
        const parts = String(ext.updateKey).split(':')
        for (const part of parts) {
          const normalized = String(part || '').match(/^\d{15,30}$/) ? String(part).trim() : ''
          if (normalized) {
            orderId = normalizeXianyuOrderId(normalized)
            break
          }
        }
      }
      if (!orderId && (ext.orderId || ext.bizOrderId)) {
        orderId = extractOrderIdFromText(ext.orderId || ext.bizOrderId)
      }
    }
  } catch {
    // ignore
  }

  if (!orderId && msg10.reminderUrl) {
    const urlMatch = String(msg10.reminderUrl).match(/orderId=(\d+)|bizOrderId=(\d+)/)
    if (urlMatch) {
      orderId = extractOrderIdFromText(urlMatch[1] || urlMatch[2])
    }
  }

  // dxCard / tip fallback
  if (!orderId) {
    try {
      const msg6 = msg1['6'] || msg1[6]
      const msg63 = msg6?.['3'] || msg6?.[3]
      const cardJson = msg63?.['5'] || msg63?.[5]
      if (cardJson) {
        const card = JSON.parse(cardJson)
        const tipOrderId = card?.tip?.argInfo?.args?.orderId
        if (tipOrderId) orderId = extractOrderIdFromText(tipOrderId)

        const tryUrl = (url) => {
          if (!url || orderId) return
          const match = String(url).match(/[?&]id=(\d{15,})|orderId=(\d{15,})|bizOrderId=(\d{15,})/)
          if (match) orderId = extractOrderIdFromText(match[1] || match[2] || match[3])
        }

        tryUrl(card?.dxCard?.item?.main?.targetUrl)
        tryUrl(card?.dxCard?.item?.main?.exContent?.button?.targetUrl)
        tryUrl(card?.dynamicOperation?.changeContent?.dxCard?.item?.main?.targetUrl)
        tryUrl(card?.dynamicOperation?.changeContent?.dxCard?.item?.main?.exContent?.button?.targetUrl)
      }
    } catch {
      // ignore
    }
  }

  const isOrderMessage = isOrderStatusMessage(content) || Boolean(orderStatus) || Boolean(orderId)

  return {
    chatId,
    content,
    isOrderMessage,
    orderId: orderId || undefined
  }
}

let ws = null
let running = false
let connecting = false
let connectionFailures = 0
let heartbeatTimer = null
let lastResult = null
let WebSocketImpl = null
let webSocketImplSource = null
let wsOpenState = 1
let syncPollTimer = null
let syncPollIntervalSeconds = DEFAULT_SYNC_POLL_INTERVAL_SECONDS
let syncPts = null
let messagesPollTimer = null
let messagesPollIntervalSeconds = 0
let messagesPollLimit = 20
let messagesPollChatIds = []
const messagesPollState = new Map()
const pendingRequests = new Map()
const MAX_PENDING_REQUESTS = 200
let rawLoggedMessages = 0
let receivedMessages = 0
let lastReceivedAt = null
let lastReceivedLwp = null
let lastReceivedCode = null
let lastReceivedMid = null
let lastReceivedRequest = null
let lastSyncAt = null
let lastPushAt = null
let lastSyncPollAt = null
let lastMessagesPollAt = null
let lastRegisterAt = null
let lastRegisterCode = null
let lastRegisterOkAt = null
let lastParseErrorAt = null
let lastParseError = null
let lastParseErrorSample = null
let lastOrderEventAt = null
let lastOrderEventOrderId = null
let lastImSentAt = null
let lastImSentOrderId = null
let lastImSkipAt = null
let lastImSkipReason = null

async function resolveWebSocketImpl() {
  if (WebSocketImpl) return WebSocketImpl

  if (typeof globalThis.WebSocket === 'function') {
    WebSocketImpl = globalThis.WebSocket
    webSocketImplSource = 'global'
    wsOpenState = Number(WebSocketImpl.OPEN) || 1
    return WebSocketImpl
  }

  try {
    const mod = await import('ws')
    WebSocketImpl = mod?.default || mod?.WebSocket || mod
    if (typeof WebSocketImpl !== 'function') {
      throw new Error('ws export is not a constructor')
    }
    webSocketImplSource = 'ws'
    wsOpenState = Number(WebSocketImpl.OPEN) || 1
    return WebSocketImpl
  } catch (error) {
    lastResult = {
      success: false,
      skipped: true,
      reason: 'missing_websocket_impl',
      error: error?.message || String(error),
      finishedAt: new Date().toISOString()
    }
    return null
  }
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}

function startHeartbeat() {
  stopHeartbeat()
  heartbeatTimer = setInterval(() => {
    try {
      if (ws?.readyState === wsOpenState) {
        ws.send(JSON.stringify({ lwp: '/!', headers: { mid: generateMid() } }))
      }
    } catch {
      // ignore
    }
  }, HEARTBEAT_INTERVAL_MS)
  heartbeatTimer.unref?.()
}

function stopSyncPoll() {
  if (syncPollTimer) {
    clearInterval(syncPollTimer)
    syncPollTimer = null
  }
}

function stopMessagesPoll() {
  if (messagesPollTimer) {
    clearInterval(messagesPollTimer)
    messagesPollTimer = null
  }
}

function cleanupSocket() {
  stopHeartbeat()
  stopSyncPoll()
  stopMessagesPoll()
  if (ws) {
    try {
      ws.close()
    } catch {
      // ignore
    }
    ws = null
  }
}

function sendAck(headers) {
  if (!ws || ws.readyState !== wsOpenState) return
  const ack = {
    code: 200,
    headers: {
      mid: headers?.mid || generateMid(),
      sid: headers?.sid || ''
    }
  }
  try {
    ws.send(JSON.stringify(ack))
  } catch {
    // ignore
  }
}

function trackPendingRequest(mid, info) {
  if (!mid) return
  pendingRequests.set(String(mid), {
    ...info,
    mid: String(mid),
    sentAt: new Date().toISOString()
  })
  while (pendingRequests.size > MAX_PENDING_REQUESTS) {
    const firstKey = pendingRequests.keys().next().value
    if (!firstKey) break
    pendingRequests.delete(firstKey)
  }
}

function consumePendingRequest(mid) {
  if (!mid) return null
  const key = String(mid)
  const pending = pendingRequests.get(key) || null
  pendingRequests.delete(key)
  return pending
}

function sendWsJson(message, pending) {
  if (!ws || ws.readyState !== wsOpenState) return null
  const headers = (message && typeof message.headers === 'object' && message.headers) ? { ...message.headers } : {}
  const mid = headers.mid || generateMid()
  message.headers = { ...headers, mid }

  if (pending?.kind) {
    trackPendingRequest(mid, {
      kind: String(pending.kind),
      lwp: message?.lwp ? String(message.lwp) : null,
      meta: pending?.meta ?? null,
    })
  }

  try {
    ws.send(JSON.stringify(message))
  } catch {
    // ignore
  }

  return mid
}

function sendTextMessage({ chatId, toUserId, text }) {
  if (!ws || ws.readyState !== wsOpenState) {
    logDebug('sendTextMessage skipped', { reason: 'ws_not_open', readyState: ws?.readyState })
    return false
  }
  if (!chatId || !toUserId || !text || !currentMyId) {
    logDebug('sendTextMessage skipped', {
      reason: 'missing_params',
      chatId: Boolean(chatId),
      toUserId: Boolean(toUserId),
      text: Boolean(text),
      currentMyId: Boolean(currentMyId)
    })
    return false
  }

  const textContent = { contentType: 1, text: { text } }
  const textBase64 = Buffer.from(JSON.stringify(textContent)).toString('base64')

  const msg = {
    lwp: '/r/MessageSend/sendByReceiverScope',
    headers: { mid: generateMid() },
    body: [
      {
        uuid: generateUuid(),
        cid: `${chatId}@goofish`,
        conversationType: 1,
        content: { contentType: 101, custom: { type: 1, data: textBase64 } },
        redPointPolicy: 0,
        extension: { extJson: '{}' },
        ctx: { appVersion: '1.0', platform: 'web' },
        mtags: {},
        msgReadStatusSetting: 1
      },
      { actualReceivers: [`${toUserId}@goofish`, `${currentMyId}@goofish`] }
    ]
  }

  sendWsJson(msg, { kind: 'sendByReceiverScope', meta: { chatId, toUserId } })
  return true
}

function sendSyncAckDiff() {
  if (!ws || ws.readyState !== wsOpenState) return

  // syncPts 未设置时不要用 Number(null)=0 的结果（会导致 pts/timestamp=0）
  const hasPts = syncPts !== null && syncPts !== undefined && String(syncPts).trim() !== ''
  const ptsRaw = hasPts ? Number(syncPts) : NaN
  const ptsVal = Number.isFinite(ptsRaw) && ptsRaw > 0 ? ptsRaw : NaN
  const currentTime = Number.isFinite(ptsVal) ? Math.floor(ptsVal / 1000) : Date.now()
  const syncMsg = {
    lwp: '/r/SyncStatus/ackDiff',
    headers: { mid: generateMid() },
    body: [
      {
        pipeline: 'sync',
        tooLong2Tag: 'PNM,1',
        channel: 'sync',
        topic: 'sync',
        highPts: 0,
        pts: Number.isFinite(ptsVal) ? ptsVal : currentTime * 1000,
        seq: 0,
        timestamp: currentTime
    }
  ]
  }

  sendWsJson(syncMsg, { kind: 'ackDiff' })
}

async function initConnection({ token, deviceId }) {
  if (!ws || ws.readyState !== wsOpenState) return
  const regMsg = {
    lwp: '/reg',
    headers: {
      'cache-header': 'app-key token ua wv',
      'app-key': '444e9908a51d1cb236a27862abc769c9',
      token,
      ua: WS_HEADERS['User-Agent'],
      dt: 'j',
      wv: 'im:3,au:3,sy:6',
      sync: '0,0;0;0;',
      did: deviceId,
      mid: generateMid()
    }
  }

  sendWsJson(regMsg, { kind: 'reg' })
  console.log(`${LABEL} register sent`)

  await new Promise(resolve => setTimeout(resolve, 1000))

  sendSyncAckDiff()
  console.log(`${LABEL} sync ack sent`)
}

const inflightOrders = new Set()
let currentMyId = null

async function handleOrderEvent(orderId, chatId, content) {
  const normalizedOrderId = normalizeXianyuOrderId(orderId)
  if (!normalizedOrderId) return

  if (inflightOrders.has(normalizedOrderId)) {
    return
  }

  inflightOrders.add(normalizedOrderId)

  try {
    lastOrderEventAt = new Date().toISOString()
    lastOrderEventOrderId = normalizedOrderId

    logDebug('handle order event', {
      orderId: normalizedOrderId,
      chatId,
      content: String(content || '').slice(0, 60)
    })

    const notifiedAt = await getXianyuOrderImNotifiedAt(normalizedOrderId)
    if (notifiedAt) {
      lastImSkipAt = new Date().toISOString()
      lastImSkipReason = 'already_notified'
      logDebug('order already notified', { orderId: normalizedOrderId, notifiedAt })
      return
    }

    const config = await getXianyuConfig()
    if (!config?.cookies) {
      console.warn(`${LABEL} skipped order: missing cookies`, { orderId: normalizedOrderId })
      return
    }

    const apiResult = await queryXianyuOrderDetailFromApi({
      orderId: normalizedOrderId,
      cookies: config.cookies
    })

    if (apiResult.cookiesUpdated) {
      await updateXianyuConfig({ cookies: apiResult.cookies })
    }

    const transformed = transformXianyuApiOrder(apiResult.raw, normalizedOrderId)
    if (transformed?.orderId) {
      const entry = transformApiOrderForImport(transformed)
      if (entry?.orderId) {
        await importXianyuOrders([entry])
      }
      await recordXianyuSyncResult({ success: true }).catch(() => {})
    }

    const data = apiResult.raw?.data || null
    const orderStatus = data?.status
    const buyerUserId = data?.peerUserId ? String(data.peerUserId) : ''

    if (!buyerUserId) {
      lastImSkipAt = new Date().toISOString()
      lastImSkipReason = 'missing_buyer_user_id'
      console.warn(`${LABEL} skipped IM: missing buyerUserId`, { orderId: normalizedOrderId, chatId })
      return
    }

    if (!chatId) {
      lastImSkipAt = new Date().toISOString()
      lastImSkipReason = 'missing_chat_id'
      console.warn(`${LABEL} skipped IM: missing chatId`, { orderId: normalizedOrderId, buyerUserId })
      return
    }

    logDebug('order detail loaded', { orderId: normalizedOrderId, orderStatus, buyerUserId })

    // 仅在“待发货(2)”时发送固定发货提示
    if (Number(orderStatus) !== 2) {
      lastImSkipAt = new Date().toISOString()
      lastImSkipReason = `order_status_${orderStatus ?? 'unknown'}`
      console.log(`${LABEL} order not pending shipment, skip IM`, {
        orderId: normalizedOrderId,
        chatId,
        orderStatus,
        content
      })
      return
    }

    const deliveryMessage = String(process.env.XIANYU_WS_DELIVERY_MESSAGE || DEFAULT_DELIVERY_MESSAGE)

    if (isDryRunEnabled()) {
      lastImSkipAt = new Date().toISOString()
      lastImSkipReason = 'dry_run'
      console.log(`${LABEL} dry-run: skip IM send`, { orderId: normalizedOrderId, chatId, buyerUserId })
      return
    }

    const sent = sendTextMessage({
      chatId,
      toUserId: buyerUserId,
      text: deliveryMessage
    })

    if (sent) {
      lastImSentAt = new Date().toISOString()
      lastImSentOrderId = normalizedOrderId
      await markXianyuOrderImNotified(normalizedOrderId, deliveryMessage).catch(() => {})
      console.log(`${LABEL} IM sent`, { orderId: normalizedOrderId, chatId })
    } else {
      lastImSkipAt = new Date().toISOString()
      lastImSkipReason = 'ws_send_failed'
      console.warn(`${LABEL} IM send failed`, { orderId: normalizedOrderId, chatId })
    }
  } catch (error) {
    console.warn(`${LABEL} handleOrderEvent failed`, { orderId: normalizedOrderId, error: error?.message || String(error) })
  } finally {
    inflightOrders.delete(normalizedOrderId)
  }
}

function extractOrderInfoFromUserMessageModel(model) {
  const message = model?.message
  if (!message || typeof message !== 'object') return null

  const chatId = normalizeGoofishChatId(message?.cid || '')
  const ext = message?.extension && typeof message.extension === 'object' ? message.extension : {}
  const content =
    String(ext?.reminderContent || message?.content?.custom?.summary || message?.content?.text || '').trim()

  let orderStatus = ''
  let orderId = ''

  try {
    const bizTag = ext?.bizTag
    if (bizTag) {
      const tag = JSON.parse(bizTag)
      orderStatus = tag?.taskName ? String(tag.taskName) : ''
    }
  } catch {
    // ignore
  }

  try {
    const extJson = ext?.extJson
    if (extJson) {
      const parsed = JSON.parse(extJson)
      if (parsed.updateKey) {
        const parts = String(parsed.updateKey).split(':')
        for (const part of parts) {
          const normalized = String(part || '').match(/^\d{15,30}$/) ? String(part).trim() : ''
          if (normalized) {
            orderId = normalizeXianyuOrderId(normalized)
            break
          }
        }
      }
      if (!orderId && (parsed.orderId || parsed.bizOrderId)) {
        orderId = extractOrderIdFromText(parsed.orderId || parsed.bizOrderId)
      }
    }
  } catch {
    // ignore
  }

  if (!orderId && ext?.reminderUrl) {
    const urlMatch = String(ext.reminderUrl).match(/orderId=(\d+)|bizOrderId=(\d+)/)
    if (urlMatch) {
      orderId = extractOrderIdFromText(urlMatch[1] || urlMatch[2])
    }
  }

  // base64 JSON in content.custom.data (dxCard / tip)
  if (!orderId) {
    const dataB64 = message?.content?.custom?.data
    if (dataB64) {
      try {
        const decoded = Buffer.from(String(dataB64), 'base64').toString('utf-8')
        const parsed = JSON.parse(decoded)

        const tipOrderId = parsed?.tip?.argInfo?.args?.orderId
        if (tipOrderId) orderId = extractOrderIdFromText(tipOrderId)

        const tryUrl = (url) => {
          if (!url || orderId) return
          const match = String(url).match(/[?&]id=(\d{15,})|orderId=(\d{15,})|bizOrderId=(\d{15,})/)
          if (match) orderId = extractOrderIdFromText(match[1] || match[2] || match[3])
        }

        tryUrl(parsed?.dxCard?.item?.main?.targetUrl)
        tryUrl(parsed?.dxCard?.item?.main?.exContent?.button?.targetUrl)
        tryUrl(parsed?.dynamicOperation?.changeContent?.dxCard?.item?.main?.targetUrl)
        tryUrl(parsed?.dynamicOperation?.changeContent?.dxCard?.item?.main?.exContent?.button?.targetUrl)
      } catch {
        // ignore
      }
    }
  }

  const isOrderMessage = isOrderStatusMessage(content) || Boolean(orderStatus) || Boolean(orderId)

  return {
    chatId,
    content,
    isOrderMessage,
    orderId: orderId || undefined,
  }
}

async function handleListUserMessagesResponse(msgData, meta = {}) {
  const body = msgData?.body
  const models = body?.userMessageModels
  if (!Array.isArray(models) || models.length === 0) return false

  const metaChatId = normalizeGoofishChatId(meta?.chatId || '')
  const chatKey = metaChatId || normalizeGoofishChatId(models?.[0]?.message?.cid || '')
  if (!chatKey) return false

  const state = messagesPollState.get(chatKey) || { lastProcessedAt: 0 }
  const lastProcessedAt = Number(state.lastProcessedAt) || 0
  let nextLastProcessedAt = lastProcessedAt

  const sorted = [...models].sort((a, b) => {
    const at = Number(a?.message?.createAt) || 0
    const bt = Number(b?.message?.createAt) || 0
    return at - bt
  })

  logDebug('listUserMessages received', { chatId: chatKey, models: sorted.length, lastProcessedAt })

  for (const model of sorted) {
    const createAt = Number(model?.message?.createAt) || 0
    if (createAt && createAt <= lastProcessedAt) continue
    if (createAt && createAt > nextLastProcessedAt) nextLastProcessedAt = createAt

    const info = extractOrderInfoFromUserMessageModel(model)
    if (!info?.orderId) continue

    logDebug('order message from listUserMessages', {
      orderId: info.orderId,
      chatId: info.chatId,
      content: String(info.content || '').slice(0, 60)
    })

    void handleOrderEvent(info.orderId, info.chatId, info.content).catch(() => {})
  }

  messagesPollState.set(chatKey, { lastProcessedAt: nextLastProcessedAt })
  return true
}

function sendListUserMessages(chatId, { cursor, limit } = {}) {
  const normalizedChatId = normalizeGoofishChatId(chatId)
  if (!normalizedChatId) return null
  if (!ws || ws.readyState !== wsOpenState) return null

  const safeLimit = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(50, Math.floor(Number(limit)))) : 20
  const safeCursor = Number.isFinite(Number(cursor)) ? Number(cursor) : Number.MAX_SAFE_INTEGER

  const msg = {
    lwp: '/r/MessageManager/listUserMessages',
    headers: { mid: generateMid() },
    body: [`${normalizedChatId}@goofish`, false, safeCursor, safeLimit, false]
  }

  return sendWsJson(msg, { kind: 'listUserMessages', meta: { chatId: normalizedChatId } })
}

function startMessagesPollIfConfigured() {
  stopMessagesPoll()

  const rawChatIds = String(process.env.XIANYU_WS_DELIVERY_MESSAGES_POLL_CHAT_IDS || '').trim()
  const chatIds = rawChatIds
    ? rawChatIds
        .split(/[,\s]+/)
        .map(v => normalizeGoofishChatId(v))
        .filter(Boolean)
    : []

  const intervalEnv = Number(process.env.XIANYU_WS_DELIVERY_MESSAGES_POLL_INTERVAL_SECONDS)
  const intervalSeconds = Number.isFinite(intervalEnv) ? Math.max(1, Math.floor(intervalEnv)) : 20
  const limitEnv = Number(process.env.XIANYU_WS_DELIVERY_MESSAGES_POLL_LIMIT)
  const limit = Number.isFinite(limitEnv) ? Math.max(1, Math.min(50, Math.floor(limitEnv))) : 20

  messagesPollIntervalSeconds = chatIds.length ? intervalSeconds : 0
  messagesPollLimit = limit
  messagesPollChatIds = chatIds

  if (!chatIds.length) {
    console.log(`${LABEL} messages poll disabled`)
    return
  }

  console.log(`${LABEL} messages poll enabled`, { intervalSeconds: messagesPollIntervalSeconds, chats: chatIds.length, limit })

  const tick = () => {
    try {
      if (!ws || ws.readyState !== wsOpenState) return
      lastMessagesPollAt = new Date().toISOString()
      for (const chatId of chatIds) {
        sendListUserMessages(chatId, { cursor: Number.MAX_SAFE_INTEGER, limit })
      }
    } catch {
      // ignore
    }
  }

  tick()
  messagesPollTimer = setInterval(tick, messagesPollIntervalSeconds * 1000)
  messagesPollTimer.unref?.()
}

async function handleSyncMessage(msgData) {
  const body = msgData?.body || {}
  let dataList = []

  if (body.syncPushPackage?.data) {
    dataList = body.syncPushPackage.data
  } else if (Array.isArray(body.data)) {
    dataList = body.data
  } else if (Array.isArray(body)) {
    dataList = body
  }

  logDebug('sync data list', { count: Array.isArray(dataList) ? dataList.length : 0 })

  if (!Array.isArray(dataList) || dataList.length === 0) {
    return
  }

  for (const item of dataList) {
    const data = typeof item === 'object' ? (item.data || item) : item
    if (!data || typeof data !== 'string') {
      logDebug('skip non-string sync data', { type: typeof data })
      continue
    }

    const message = decryptSyncData(data)
    if (!message) {
      logDebug('decryptSyncData returned null', { sample: data.slice(0, 32), length: data.length })
      continue
    }

    const info = extractOrderInfo(message)
    if (!info?.orderId) {
      logDebug('no orderId extracted', { content: String(info?.content || '').slice(0, 60) })
      continue
    }

    logDebug('order message detected', {
      orderId: info.orderId,
      chatId: info.chatId,
      content: String(info.content || '').slice(0, 60)
    })

    void handleOrderEvent(info.orderId, info.chatId, info.content).catch(() => {})
  }
}

async function connectOnce() {
  const wsCtor = await resolveWebSocketImpl()
  if (!wsCtor) {
    console.warn(
      `${LABEL} WebSocket is not available. Install dependency and restart: npm install ws --workspace=backend`
    )
    return
  }

  const features = await getFeatureFlags()
  if (!isFeatureEnabled(features, 'xianyu')) {
    lastResult = { success: true, skipped: true, reason: 'feature_disabled', finishedAt: new Date().toISOString() }
    return
  }

  const config = await getXianyuConfig()
  if (!config?.cookies) {
    lastResult = { success: false, skipped: true, reason: 'no_cookies', finishedAt: new Date().toISOString() }
    return
  }

  const cookiesObj = parseCookieHeaderToObject(config.cookies)
  const myId = cookiesObj?.unb ? String(cookiesObj.unb).trim() : ''
  if (!myId) {
    lastResult = { success: false, skipped: true, reason: 'missing_unb', finishedAt: new Date().toISOString() }
    return
  }

  currentMyId = myId

  const tokenResult = await refreshXianyuLogin({ cookies: config.cookies })
  if (tokenResult.cookiesUpdated) {
    await updateXianyuConfig({ cookies: tokenResult.cookies })
  }

  if (!tokenResult.success || !tokenResult.token) {
    lastResult = {
      success: false,
      skipped: true,
      reason: 'token_failed',
      error: tokenResult.error || 'token 为空',
      finishedAt: new Date().toISOString()
    }
    return
  }

  const deviceId = resolveXianyuDeviceIdFromCookies(tokenResult.cookies)

  return new Promise((resolve) => {
    ws = new wsCtor(WS_URL, { headers: WS_HEADERS })

    const onOpen = async () => {
      connectionFailures = 0
      console.log(`${LABEL} WebSocket connected`)

      const configuredPts = Number(process.env.XIANYU_WS_DELIVERY_SYNC_PTS)
      if (Number.isFinite(configuredPts) && configuredPts > 0) {
        syncPts = Math.floor(configuredPts)
      } else {
        syncPts = Date.now() * 1000
      }

      await initConnection({ token: tokenResult.token, deviceId })
      startHeartbeat()

      syncPollIntervalSeconds = Number(process.env.XIANYU_WS_DELIVERY_SYNC_POLL_INTERVAL_SECONDS)
      if (!Number.isFinite(syncPollIntervalSeconds)) {
        syncPollIntervalSeconds = DEFAULT_SYNC_POLL_INTERVAL_SECONDS
      }
      syncPollIntervalSeconds = Math.max(0, Math.floor(syncPollIntervalSeconds))

      stopSyncPoll()
      if (syncPollIntervalSeconds > 0) {
        syncPollTimer = setInterval(() => {
          try {
            if (!ws || ws.readyState !== wsOpenState) return
            lastSyncPollAt = new Date().toISOString()
            logDebug('sync poll sent')
            sendSyncAckDiff()
          } catch {
            // ignore
          }
        }, syncPollIntervalSeconds * 1000)
        syncPollTimer.unref?.()
        console.log(`${LABEL} sync poll enabled`, { intervalSeconds: syncPollIntervalSeconds, pts: syncPts })
      } else {
        console.log(`${LABEL} sync poll disabled`)
      }

      startMessagesPollIfConfigured()
      resolve()
    }

    const onMessage = async (event) => {
      const msgText = safeToText(event.data)
      receivedMessages += 1
      lastReceivedAt = new Date().toISOString()

      let msgData = null
      try {
        msgData = JSON.parse(msgText)
      } catch (error) {
        lastReceivedLwp = null
        lastReceivedCode = null
        lastParseErrorAt = new Date().toISOString()
        lastParseError = error?.message || String(error)
        lastParseErrorSample = sanitizeLogText(msgText, 80)
        logDebug('ws message parse failed', {
          error: error?.message || String(error),
          sample: sanitizeLogText(msgText, 80)
        })
        return
      }

      const lwp = String(msgData?.lwp || '')
      const msgCode = msgData?.code
      const msgMid = msgData?.headers?.mid ? String(msgData.headers.mid) : null
      const pending = msgMid ? consumePendingRequest(msgMid) : null
      lastReceivedLwp = lwp || null
      lastReceivedCode = msgCode ?? null
      lastReceivedMid = msgMid
      lastReceivedRequest = pending?.kind ? String(pending.kind) : null

      const bodyKeys = msgData?.body && typeof msgData.body === 'object' ? Object.keys(msgData.body).slice(0, 8) : []
      logDebug('ws message received', {
        receivedMessages,
        mid: msgMid,
        request: lastReceivedRequest,
        lwp: lastReceivedLwp,
        code: lastReceivedCode,
        bodyKeys,
      })

      if (isDebugEnabled() && parseBool(process.env.XIANYU_WS_DELIVERY_LOG_RAW_MESSAGES, false)) {
        const limitEnv = Number(process.env.XIANYU_WS_DELIVERY_LOG_RAW_LIMIT)
        const limit = Number.isFinite(limitEnv) ? Math.max(1, Math.floor(limitEnv)) : 20
        const maxLenEnv = Number(process.env.XIANYU_WS_DELIVERY_LOG_RAW_MAXLEN)
        const maxLen = Number.isFinite(maxLenEnv) ? Math.max(80, Math.floor(maxLenEnv)) : 800
        if (rawLoggedMessages < limit) {
          rawLoggedMessages += 1
          console.log(`${LABEL} rx raw`, { n: receivedMessages, mid: msgMid, request: lastReceivedRequest })
          console.log(sanitizeLogText(msgText, maxLen))
        }
      }

      // 处理注册响应（有些环境返回 code!=200 且无 lwp）
      if (pending?.kind === 'reg' && !lwp) {
        lastRegisterAt = new Date().toISOString()
        const regCode = msgData?.headers?.code ?? msgCode
        lastRegisterCode = regCode ?? null
        if (regCode === 200 || regCode === '200') {
          lastRegisterOkAt = new Date().toISOString()
          console.log(`${LABEL} register ok`)
        } else {
          console.warn(`${LABEL} register failed`, {
            code: regCode,
            reason: msgData?.body?.reason,
            developerMessage: msgData?.body?.developerMessage,
            scope: msgData?.body?.scope,
          })
        }
        return
      }

      if (pending?.kind === 'ackDiff' && !lwp && msgCode && msgCode !== 200) {
        console.warn(`${LABEL} ackDiff failed`, {
          code: msgCode,
          reason: msgData?.body?.reason,
          developerMessage: msgData?.body?.developerMessage,
        })
        return
      }

      if (pending?.kind === 'listUserMessages' && !lwp && msgCode && msgCode !== 200) {
        console.warn(`${LABEL} listUserMessages failed`, {
          code: msgCode,
          reason: msgData?.body?.reason,
          developerMessage: msgData?.body?.developerMessage,
        })
        return
      }

      // Web 端常见：响应消息 code=200 且无 lwp，需要根据 mid / body 识别
      if (msgCode === 200 && !lwp) {
        if (pending?.kind === 'listUserMessages' || Array.isArray(msgData?.body?.userMessageModels)) {
          const handled = await handleListUserMessagesResponse(msgData, pending?.meta || {})
          if (!handled) {
            logDebug('listUserMessages response ignored', { mid: msgMid })
          }
          return
        }

        const looksLikeSync =
          Boolean(msgData?.body?.syncPushPackage?.data)
          || Array.isArray(msgData?.body?.data)
          || Array.isArray(msgData?.body)

        if (pending?.kind === 'ackDiff' || looksLikeSync) {
          lastSyncAt = new Date().toISOString()
          await handleSyncMessage(msgData)
          return
        }

        return
      }

      if (lwp === '/r') {
        lastRegisterAt = new Date().toISOString()
        const regCode = msgData?.headers?.code ?? msgData?.code
        lastRegisterCode = regCode ?? null
        if (regCode === 200 || regCode === '200') {
          lastRegisterOkAt = new Date().toISOString()
          console.log(`${LABEL} register ok`)
        } else {
          console.warn(`${LABEL} register failed`, { code: regCode })
        }
        return
      }

      if (lwp === '/s/sync' || lwp.toLowerCase().includes('/sync')) {
        lastSyncAt = new Date().toISOString()
        logDebug('sync message received', {
          lwp,
          count:
            msgData?.body?.syncPushPackage?.data?.length
            || msgData?.body?.data?.length
            || (Array.isArray(msgData?.body) ? msgData.body.length : 0)
        })
        sendAck(msgData.headers)
        await handleSyncMessage(msgData)
        return
      }

      if (lwp === '/p') {
        lastPushAt = new Date().toISOString()
        logDebug('push message received', {
          count:
            msgData?.body?.syncPushPackage?.data?.length
            || msgData?.body?.data?.length
            || (Array.isArray(msgData?.body) ? msgData.body.length : 0)
        })
        sendAck(msgData.headers)
        await handleSyncMessage(msgData)
        return
      }

      logDebug('ws message ignored', { lwp: lwp || '(none)', code: msgCode ?? null })
    }

    const onClose = (event) => {
      stopHeartbeat()
      stopSyncPoll()
      stopMessagesPoll()
      console.warn(`${LABEL} WebSocket closed`, { code: event?.code, reason: event?.reason })
      ws = null
      if (running) {
        scheduleReconnect()
      }
    }

    const onError = (event) => {
      lastResult = { success: false, error: event?.message || 'WebSocket error', finishedAt: new Date().toISOString() }
    }

    // Support both WebSocket EventTarget API (global WebSocket) and ws (EventEmitter) APIs.
    if (typeof ws.addEventListener === 'function') {
      ws.addEventListener('open', onOpen)
      ws.addEventListener('message', onMessage)
      ws.addEventListener('close', onClose)
      ws.addEventListener('error', onError)
    } else if (typeof ws.on === 'function') {
      ws.on('open', () => void onOpen())
      ws.on('message', (data) => void onMessage({ data }))
      ws.on('close', (code, reason) => onClose({ code, reason: reason?.toString?.() || reason }))
      ws.on('error', (err) => onError({ message: err?.message || 'WebSocket error', error: err }))
    } else {
      ws.onopen = () => void onOpen()
      ws.onmessage = (event) => void onMessage(event)
      ws.onclose = (event) => onClose(event)
      ws.onerror = (event) => onError(event)
    }
  })
}

function scheduleReconnect() {
  if (!running) return
  if (connectionFailures >= MAX_RECONNECT_ATTEMPTS) {
    console.error(`${LABEL} reached max reconnect attempts, giving up`)
    return
  }
  connectionFailures += 1
  setTimeout(() => {
    void ensureConnected().catch(() => {})
  }, RECONNECT_DELAY_MS)
}

async function ensureConnected() {
  if (!running) return
  if (connecting) return
  if (ws?.readyState === wsOpenState) return

  connecting = true
  try {
    await connectOnce()
  } catch (error) {
    lastResult = { success: false, error: error?.message || String(error), finishedAt: new Date().toISOString() }
    scheduleReconnect()
  } finally {
    connecting = false
  }
}

export function startXianyuWsDeliveryBot() {
  if (!parseBool(process.env.XIANYU_WS_DELIVERY_ENABLED, false)) {
    console.log(`${LABEL} disabled (XIANYU_WS_DELIVERY_ENABLED=false)`)
    return
  }

  if (running) return

  running = true
  console.log(`${LABEL} starting...`, { debug: isDebugEnabled(), dryRun: isDryRunEnabled() })
  void ensureConnected().catch(() => {})
}

export function stopXianyuWsDeliveryBot() {
  running = false
  connecting = false
  cleanupSocket()
  lastResult = { success: true, stoppedAt: new Date().toISOString() }
  console.log(`${LABEL} stopped`)
}

export function getXianyuWsDeliveryState() {
  return {
    running,
    connecting,
    connected: ws?.readyState === wsOpenState,
    impl: webSocketImplSource,
    reconnectAttempts: connectionFailures,
    lastResult,
    stats: {
      receivedMessages,
      lastReceivedAt,
      lastReceivedLwp,
      lastReceivedCode,
      lastReceivedMid,
      lastReceivedRequest,
      lastSyncAt,
      lastPushAt,
      lastSyncPollAt,
      lastMessagesPollAt,
      lastRegisterAt,
      lastRegisterCode,
      lastRegisterOkAt,
      lastParseErrorAt,
      lastParseError,
      lastParseErrorSample,
      lastOrderEventAt,
      lastOrderEventOrderId,
      lastImSentAt,
      lastImSentOrderId,
      lastImSkipAt,
      lastImSkipReason,
      syncPollIntervalSeconds,
      syncPts,
      messagesPollIntervalSeconds,
      messagesPollLimit,
      messagesPollChats: messagesPollChatIds.length,
      dryRun: isDryRunEnabled(),
    }
  }
}

export async function triggerXianyuWsDelivery({ orderId, chatId, content } = {}) {
  const normalizedOrderId = normalizeXianyuOrderId(orderId)
  if (!normalizedOrderId) {
    throw new Error('无效的闲鱼订单号')
  }
  const normalizedChatId = normalizeGoofishChatId(chatId)
  if (!normalizedChatId) {
    throw new Error('缺少 chatId（会话ID）')
  }

  await handleOrderEvent(normalizedOrderId, normalizedChatId, content || '')
  return { orderId: normalizedOrderId, chatId: normalizedChatId }
}
