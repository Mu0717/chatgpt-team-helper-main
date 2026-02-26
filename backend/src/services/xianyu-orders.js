import crypto from 'crypto'
import { getDatabase, saveDatabase } from '../database/init.js'

export const XIANYU_CHANNEL = 'xianyu'
export const XIANYU_ORDER_ID_REGEX = /^\d{6,30}$/

const ORDER_STATUS_TEXT = {
  0: '获取中',
  1: '待付款',
  2: '待发货',
  3: '待收货',
  4: '交易成功',
  6: '已关闭',
}

const ORDER_DETAIL_ENDPOINT = 'https://h5api.m.goofish.com/h5/mtop.idle.web.trade.order.detail/1.0/'
const SIGN_APP_KEY = '34839810'
const TOKEN_ENDPOINT = 'https://h5api.m.goofish.com/h5/mtop.taobao.idlemessage.pc.login.token/1.0/'
const PASSPORT_HAS_LOGIN_ENDPOINT = 'https://passport.goofish.com/newlogin/hasLogin.do'
const TOKEN_DATA_APP_KEY = '444e9908a51d1cb236a27862abc769c9'
const SESSION_EXPIRED_ERRORS = ['FAIL_SYS_SESSION_EXPIRED', 'SESSION_EXPIRED']

const generateSign = (t, token, data) => {
  const msg = `${token}&${t}&${SIGN_APP_KEY}&${data}`
  return crypto.createHash('md5').update(msg).digest('hex')
}

const parseCookieHeaderToObject = (cookiesStr = '') => {
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

let cachedDeviceId = null
let cachedDeviceUserId = null

const generateDeviceId = (userId = '') => {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
  const result = []
  for (let i = 0; i < 36; i++) {
    if ([8, 13, 18, 23].includes(i)) {
      result.push('-')
    } else if (i === 14) {
      result.push('4')
    } else if (i === 19) {
      const randVal = Math.floor(Math.random() * 16)
      result.push(chars[(randVal & 0x3) | 0x8])
    } else {
      result.push(chars[Math.floor(Math.random() * 16)])
    }
  }
  const base = result.join('')
  const suffix = String(userId || '').trim()
  return suffix ? `${base}-${suffix}` : base
}

const resolveDeviceIdFromCookies = (cookiesStr = '') => {
  const cookies = parseCookieHeaderToObject(cookiesStr)
  const userId = cookies?.unb ? String(cookies.unb).trim() : ''
  if (cachedDeviceId && cachedDeviceUserId === userId) {
    return cachedDeviceId
  }
  cachedDeviceUserId = userId
  cachedDeviceId = generateDeviceId(userId)
  return cachedDeviceId
}

// 给其他模块复用（保持 token 获取与 WebSocket 注册 did 一致）
export const resolveXianyuDeviceIdFromCookies = resolveDeviceIdFromCookies

const isSessionExpiredError = (message = '') => SESSION_EXPIRED_ERRORS.some(flag => String(message || '').includes(flag))

const shouldAttemptAuthRefresh = (message = '') => {
  const normalized = String(message || '')
  if (!normalized) return false
  if (isSessionExpiredError(normalized)) return true
  return normalized.includes('TOKEN') || normalized.includes('SESSION')
}

const stringifyCookies = (cookiesObj = {}) =>
  Object.entries(cookiesObj)
    .filter(([key]) => key)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ')

const mergeCookies = (oldCookiesStr = '', newCookiesObj = {}) => {
  const merged = parseCookieHeaderToObject(oldCookiesStr)
  for (const [key, value] of Object.entries(newCookiesObj || {})) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      merged[key] = String(value)
    }
  }
  return stringifyCookies(merged)
}

const parseSetCookieHeaders = (setCookieHeaders = []) => {
  const cookies = {}
  for (const header of setCookieHeaders) {
    const parts = String(header || '').split(';')
    if (!parts.length) continue
    const cookiePart = parts[0].trim()
    const idx = cookiePart.indexOf('=')
    if (idx > 0) {
      const name = cookiePart.slice(0, idx).trim()
      const value = cookiePart.slice(idx + 1).trim()
      if (name) cookies[name] = value
    }
  }
  return cookies
}

/**
 * 将各种格式的 Cookie 转换为标准 HTTP Cookie 字符串
 * 支持格式：
 * 1. 浏览器扩展导出的 JSON 数组：[{name, value, ...}, ...]
 * 2. 简单键值对 JSON：{"name": "value", ...}
 * 3. 已经是标准 Cookie 字符串：name=value; name2=value2
 */
function parseCookiesToString(cookies) {
  if (!cookies) return ''

  if (typeof cookies === 'string' && !cookies.trim().startsWith('[') && !cookies.trim().startsWith('{')) {
    return cookies.trim()
  }

  let parsed
  try {
    parsed = typeof cookies === 'string' ? JSON.parse(cookies) : cookies
  } catch {
    return String(cookies).trim()
  }

  if (Array.isArray(parsed)) {
    return parsed
      .filter(c => c && c.name && c.value !== undefined)
      .map(c => `${c.name}=${c.value}`)
      .join('; ')
  }

  if (typeof parsed === 'object' && parsed !== null) {
    return Object.entries(parsed)
      .filter(([key, value]) => key && value !== undefined)
      .map(([key, value]) => `${key}=${value}`)
      .join('; ')
  }

  return String(cookies).trim()
}

const mapOrderRow = (row = []) => ({
  id: row[0],
  orderId: row[1],
  orderStatus: row[2] || null,
  orderTime: row[3] || null,
  nickname: row[4] || null,
  status: row[5] || 'pending',
  userEmail: row[6] || null,
  assignedCodeId: row[7] || null,
  assignedCode: row[8] || null,
  isUsed: row[9] === 1,
  extractedAt: row[10],
  reservedAt: row[11],
  usedAt: row[12],
  createdAt: row[13],
  updatedAt: row[14],
  redemptionCode: row[15] || null,
  redemptionChannel: row[16] || null,
  actualPaid: row[17] ?? null,
})

async function ensureConfigRow() {
  const db = await getDatabase()
  const result = db.exec('SELECT id FROM xianyu_config LIMIT 1')
  if (result.length === 0 || result[0].values.length === 0) {
    db.run(`INSERT INTO xianyu_config (sync_enabled, sync_interval_hours, updated_at) VALUES (0, 6, DATETIME('now', 'localtime'))`)
    await saveDatabase()
    return 1
  }
  return result[0].values[0][0]
}

export function normalizeXianyuOrderId(value = '') {
  if (!value) return ''
  const normalized = String(value).trim()
  return XIANYU_ORDER_ID_REGEX.test(normalized) ? normalized : ''
}

export async function getXianyuConfig() {
  const db = await getDatabase()
  await ensureConfigRow()
  const result = db.exec(`
    SELECT id, cookies, last_sync_at, last_success_at, sync_enabled, sync_interval_hours, last_error, error_count, updated_at
    FROM xianyu_config
    LIMIT 1
  `)
  if (result.length === 0 || result[0].values.length === 0) {
    return null
  }
  const row = result[0].values[0]
  return {
    id: row[0],
    cookies: row[1],
    lastSyncAt: row[2],
    lastSuccessAt: row[3],
    syncEnabled: row[4] === 1,
    syncIntervalHours: row[5],
    lastError: row[6],
    errorCount: row[7] || 0,
    updatedAt: row[8],
    cookiesConfigured: Boolean(row[1]),
  }
}

export async function updateXianyuConfig({ cookies, syncEnabled, syncIntervalHours } = {}) {
  const db = await getDatabase()
  const configId = await ensureConfigRow()
  const updates = []
  const params = []

  if (cookies !== undefined) {
    updates.push('cookies = ?')
    params.push(cookies ? parseCookiesToString(cookies) : null)
    updates.push('last_error = NULL')
    updates.push('error_count = 0')
  }

  if (typeof syncEnabled === 'boolean') {
    updates.push('sync_enabled = ?')
    params.push(syncEnabled ? 1 : 0)
  }

  if (typeof syncIntervalHours === 'number' && !Number.isNaN(syncIntervalHours)) {
    updates.push('sync_interval_hours = ?')
    params.push(syncIntervalHours)
  }

  if (updates.length === 0) {
    return getXianyuConfig()
  }

  updates.push("updated_at = DATETIME('now', 'localtime')")

  db.run(
    `UPDATE xianyu_config SET ${updates.join(', ')} WHERE id = ?`,
    [...params, configId],
  )
  await saveDatabase()
  return getXianyuConfig()
}

export async function recordXianyuSyncResult({ success, error = null }) {
  const db = await getDatabase()
  await ensureConfigRow()
  if (success) {
    db.run(`
      UPDATE xianyu_config
      SET last_sync_at = DATETIME('now', 'localtime'),
          last_success_at = DATETIME('now', 'localtime'),
          last_error = NULL,
          error_count = 0,
          updated_at = DATETIME('now', 'localtime')
    `)
  } else {
    db.run(`
      UPDATE xianyu_config
      SET last_sync_at = DATETIME('now', 'localtime'),
          last_error = ?,
          error_count = error_count + 1,
          updated_at = DATETIME('now', 'localtime')
    `, [error || '未知错误'])
  }
  await saveDatabase()
}

export async function importXianyuOrders(orderEntries = []) {
  if (!Array.isArray(orderEntries) || orderEntries.length === 0) {
    return { created: 0, skipped: 0, total: 0 }
  }

  const normalizeActualPaid = (value) => {
    if (value === undefined || value === null) return null
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null
    }
    const normalized = String(value).trim()
    if (!normalized) return null
    const cleaned = normalized.replace(/[^\d.-]/g, '')
    const parsed = Number(cleaned)
    return Number.isFinite(parsed) ? parsed : null
  }

  const preparedEntries = orderEntries
    .map(entry => {
      if (typeof entry === 'string') {
        return { orderId: entry }
      }
      if (entry && typeof entry === 'object') {
        return {
          orderId: entry.orderId || entry.order_id || entry.tid || entry.tradeId || '',
          orderTime: entry.orderTime || entry.order_time || entry.time || null,
          orderStatus: entry.orderStatus || entry.order_status || entry.statusText || entry.status || null,
          nickname: entry.nickname || entry.buyerNickname || entry.nickName || null,
          actualPaid: entry.actualPaid ?? entry.actual_paid ?? entry.price ?? null,
        }
      }
      return null
    })
    .map(entry => {
      if (!entry) return null
      const normalizedId = normalizeXianyuOrderId(entry.orderId)
      if (!normalizedId) return null
      return {
        orderId: normalizedId,
        orderTime: entry.orderTime ? String(entry.orderTime).trim() : null,
        orderStatus: entry.orderStatus ? String(entry.orderStatus).trim() : null,
        nickname: entry.nickname ? String(entry.nickname).trim() : null,
        actualPaid: normalizeActualPaid(entry.actualPaid),
      }
    })
    .filter(Boolean)

  if (preparedEntries.length === 0) {
    return { created: 0, skipped: 0, total: 0 }
  }

  const entriesById = new Map()
  preparedEntries.forEach(entry => {
    const existing = entriesById.get(entry.orderId)
    if (!existing) {
      entriesById.set(entry.orderId, entry)
    } else {
      if (!existing.orderTime && entry.orderTime) existing.orderTime = entry.orderTime
      if (entry.orderStatus && (!existing.orderStatus || (existing.orderStatus !== '已关闭' && entry.orderStatus === '已关闭'))) {
        existing.orderStatus = entry.orderStatus
      }
      if (!existing.nickname && entry.nickname) existing.nickname = entry.nickname
      if (existing.actualPaid == null && entry.actualPaid != null) existing.actualPaid = entry.actualPaid
    }
  })

  const uniqueIds = Array.from(entriesById.keys())
  const db = await getDatabase()

  const existingMap = new Map()
  if (uniqueIds.length > 0) {
    const placeholders = uniqueIds.map(() => '?').join(',')
    const existingResult = db.exec(
      `SELECT order_id, order_time, order_status, nickname, actual_paid FROM xianyu_orders WHERE order_id IN (${placeholders})`,
      uniqueIds,
    )
    if (existingResult.length > 0) {
      existingResult[0].values.forEach(row => {
        existingMap.set(row[0], {
          orderTime: row[1],
          orderStatus: row[2] || null,
          nickname: row[3] || null,
          actualPaid: row[4] ?? null,
        })
      })
    }
  }

  let created = 0
  let skipped = 0
  uniqueIds.forEach(orderId => {
    const entry = entriesById.get(orderId)
    if (!entry) return
    if (existingMap.has(orderId)) {
      const currentEntry = existingMap.get(orderId)
      let updated = false
      const updates = []
      const params = []
      if (entry.orderTime && !currentEntry.orderTime) {
        updates.push('order_time = ?')
        params.push(entry.orderTime)
        updated = true
        currentEntry.orderTime = entry.orderTime
      }
      if (entry.orderStatus && entry.orderStatus !== currentEntry.orderStatus) {
        updates.push('order_status = ?')
        params.push(entry.orderStatus)
        updated = true
        currentEntry.orderStatus = entry.orderStatus
      }
      if (entry.nickname && !currentEntry.nickname) {
        updates.push('nickname = ?')
        params.push(entry.nickname)
        updated = true
        currentEntry.nickname = entry.nickname
      }
      if (entry.actualPaid != null && currentEntry.actualPaid == null) {
        updates.push('actual_paid = ?')
        params.push(entry.actualPaid)
        updated = true
        currentEntry.actualPaid = entry.actualPaid
      }
      if (updated) {
        updates.push("updated_at = DATETIME('now', 'localtime')")
        db.run(
          `
            UPDATE xianyu_orders
            SET ${updates.join(', ')}
            WHERE order_id = ?
          `,
          [...params, orderId]
        )
      }
      skipped += 1
      return
    }

    db.run(
      `
        INSERT INTO xianyu_orders (
          order_id,
          order_time,
          order_status,
          nickname,
          actual_paid,
          status,
          is_used,
          extracted_at,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, 'pending', 0, DATETIME('now', 'localtime'), DATETIME('now', 'localtime'), DATETIME('now', 'localtime'))
      `,
      [orderId, entry.orderTime, entry.orderStatus, entry.nickname, entry.actualPaid],
    )
    created += 1
  })

  if (created > 0) {
    await saveDatabase()
  }

  return {
    created,
    skipped,
    total: entriesById.size,
  }
}

export async function clearXianyuOrders() {
  const db = await getDatabase()
  const countResult = db.exec('SELECT COUNT(*) FROM xianyu_orders')
  const total = countResult[0]?.values[0]?.[0] || 0
  db.run('DELETE FROM xianyu_orders')
  await saveDatabase()
  return { cleared: total }
}

export async function deleteXianyuOrder(id) {
  const db = await getDatabase()
  const existing = db.exec('SELECT id FROM xianyu_orders WHERE id = ?', [id])
  if (!existing[0]?.values?.length) {
    return { deleted: false, reason: '订单不存在' }
  }
  db.run('DELETE FROM xianyu_orders WHERE id = ?', [id])
  await saveDatabase()
  return { deleted: true }
}

export async function getXianyuOrderStats() {
  const db = await getDatabase()
  const totalResult = db.exec('SELECT COUNT(*) FROM xianyu_orders')
  const usedResult = db.exec('SELECT COUNT(*) FROM xianyu_orders WHERE is_used = 1')
  const todayResult = db.exec(`
    SELECT COUNT(*) FROM xianyu_orders
    WHERE DATE(created_at) = DATE('now', 'localtime')
  `)

  const total = totalResult[0]?.values[0]?.[0] || 0
  const used = usedResult[0]?.values[0]?.[0] || 0
  const today = todayResult[0]?.values[0]?.[0] || 0

  return {
    total,
    used,
    pending: total - used,
    today,
  }
}

export async function getXianyuOrders({ limit = 100, offset = 0 } = {}) {
  const db = await getDatabase()
  const result = db.exec(
    `
      SELECT o.id, o.order_id, o.order_status, o.order_time, o.nickname, o.status, o.user_email, o.assigned_code_id,
             o.assigned_code, o.is_used, o.extracted_at, o.reserved_at, o.used_at,
             o.created_at, o.updated_at, rc.code as redemption_code, rc.channel, o.actual_paid
      FROM xianyu_orders o
      LEFT JOIN redemption_codes rc ON rc.id = o.assigned_code_id
      ORDER BY
        CASE WHEN o.order_time IS NULL THEN 1 ELSE 0 END ASC,
        o.order_time DESC,
        o.created_at DESC
      LIMIT ? OFFSET ?
    `,
    [limit, offset],
  )

  if (result.length === 0 || result[0].values.length === 0) {
    return []
  }

  return result[0].values.map(mapOrderRow)
}

export async function getXianyuOrderById(orderId) {
  const normalized = normalizeXianyuOrderId(orderId)
  if (!normalized) return null
  const db = await getDatabase()
  const result = db.exec(
    `
      SELECT o.id, o.order_id, o.order_status, o.order_time, o.nickname, o.status, o.user_email, o.assigned_code_id,
             o.assigned_code, o.is_used, o.extracted_at, o.reserved_at, o.used_at,
             o.created_at, o.updated_at, rc.code as redemption_code, rc.channel, o.actual_paid
      FROM xianyu_orders o
      LEFT JOIN redemption_codes rc ON rc.id = o.assigned_code_id
      WHERE o.order_id = ?
      LIMIT 1
    `,
    [normalized],
  )

  if (result.length === 0 || result[0].values.length === 0) {
    return null
  }

  return mapOrderRow(result[0].values[0])
}

export async function getXianyuOrderImNotifiedAt(orderId) {
  const normalized = normalizeXianyuOrderId(orderId)
  if (!normalized) return null
  const db = await getDatabase()
  const result = db.exec(
    'SELECT im_notified_at FROM xianyu_orders WHERE order_id = ? LIMIT 1',
    [normalized]
  )
  const row = result?.[0]?.values?.[0] || null
  const value = row?.[0] || null
  return value ? String(value) : null
}

export async function markXianyuOrderImNotified(orderId, message) {
  const normalized = normalizeXianyuOrderId(orderId)
  if (!normalized) return { success: false, error: 'invalid_order_id' }

  const db = await getDatabase()
  const text = message == null ? null : String(message)

  db.run(
    `
      UPDATE xianyu_orders
      SET im_notified_at = DATETIME('now', 'localtime'),
          im_notified_message = ?,
          updated_at = DATETIME('now', 'localtime')
      WHERE order_id = ?
    `,
    [text, normalized]
  )

  // 如果订单行不存在，写入最小占位记录
  db.run(
    `
      INSERT OR IGNORE INTO xianyu_orders (
        order_id,
        status,
        is_used,
        extracted_at,
        created_at,
        updated_at,
        im_notified_at,
        im_notified_message
      )
      VALUES (
        ?,
        'pending',
        0,
        DATETIME('now', 'localtime'),
        DATETIME('now', 'localtime'),
        DATETIME('now', 'localtime'),
        DATETIME('now', 'localtime'),
        ?
      )
    `,
    [normalized, text]
  )

  await saveDatabase()
  return { success: true }
}

export async function markXianyuOrderRedeemed(orderRowId, codeId, code, email) {
  const db = await getDatabase()
  db.run(
    `
      UPDATE xianyu_orders
      SET status = 'redeemed',
          user_email = ?,
          assigned_code_id = ?,
          assigned_code = ?,
          is_used = 1,
          used_at = DATETIME('now', 'localtime'),
          updated_at = DATETIME('now', 'localtime')
      WHERE id = ?
    `,
    [email, codeId, code, orderRowId],
  )
  await saveDatabase()
}

const requestXianyuHasLogin = async (cookiesStr, retryCount = 0) => {
  try {
    const cookiesObj = parseCookieHeaderToObject(cookiesStr)

    const params = new URLSearchParams({
      appName: 'xianyu',
      fromSite: '77'
    })

    const formData = new URLSearchParams({
      hid: cookiesObj['unb'] || '',
      ltl: 'true',
      appName: 'xianyu',
      appEntrance: 'web',
      _csrf_token: cookiesObj['XSRF-TOKEN'] || '',
      umidToken: '',
      hsiz: cookiesObj['cookie2'] || '',
      bizParams: 'taobaoBizLoginFrom=web',
      mainPage: 'false',
      isMobile: 'false',
      lang: 'zh_CN',
      returnUrl: '',
      fromSite: '77',
      isIframe: 'true',
      documentReferer: 'https://www.goofish.com/',
      defaultView: 'hasLogin',
      umidTag: 'SERVER',
      deviceId: cookiesObj['cna'] || ''
    })

    const res = await fetch(`${PASSPORT_HAS_LOGIN_ENDPOINT}?${params}`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
        origin: 'https://www.goofish.com',
        referer: 'https://www.goofish.com/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        cookie: cookiesStr,
      },
      body: formData.toString()
    })

    const setCookieHeaders = res.headers?.getSetCookie?.() || []
    const updatedCookiesObj = parseSetCookieHeaders(setCookieHeaders)
    const mergedCookies = Object.keys(updatedCookiesObj).length ? mergeCookies(cookiesStr, updatedCookiesObj) : cookiesStr
    const cookiesUpdated = mergedCookies !== cookiesStr

    const resJson = await res.json().catch(() => null)
    const success = Boolean(resJson?.content?.success)
    if (success) {
      return { success: true, cookies: mergedCookies, cookiesUpdated, raw: resJson }
    }

    if (retryCount < 1) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return requestXianyuHasLogin(mergedCookies, retryCount + 1)
    }

    return {
      success: false,
      cookies: mergedCookies,
      cookiesUpdated,
      raw: resJson,
      error: resJson ? JSON.stringify(resJson) : 'hasLogin 验证失败'
    }
  } catch (error) {
    if (retryCount < 1) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return requestXianyuHasLogin(cookiesStr, retryCount + 1)
    }
    return {
      success: false,
      cookies: cookiesStr,
      cookiesUpdated: false,
      error: error?.message || 'hasLogin 请求失败'
    }
  }
}

const requestXianyuToken = async (cookiesStr, deviceId) => {
  const cookiesObj = parseCookieHeaderToObject(cookiesStr)
  const rawH5Token = cookiesObj['_m_h5_tk']
  const h5Token = rawH5Token ? String(rawH5Token).split('_')[0] : ''
  if (!h5Token) {
    return { success: false, cookies: cookiesStr, cookiesUpdated: false, error: 'Cookie 缺少 _m_h5_tk' }
  }

  const timestamp = Date.now().toString()
  const dataVal = JSON.stringify({
    appKey: TOKEN_DATA_APP_KEY,
    deviceId: deviceId || ''
  })
  const sign = generateSign(timestamp, h5Token, dataVal)

  const params = new URLSearchParams({
    jsv: '2.7.2',
    appKey: SIGN_APP_KEY,
    t: timestamp,
    sign,
    v: '1.0',
    type: 'originaljson',
    accountSite: 'xianyu',
    dataType: 'json',
    timeout: '20000',
    api: 'mtop.taobao.idlemessage.pc.login.token',
    sessionOption: 'AutoLoginOnly'
  })

  const res = await fetch(`${TOKEN_ENDPOINT}?${params}`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
      origin: 'https://www.goofish.com',
      referer: 'https://www.goofish.com/',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      cookie: cookiesStr,
    },
    body: `data=${encodeURIComponent(dataVal)}`
  })

  const setCookieHeaders = res.headers?.getSetCookie?.() || []
  const updatedCookiesObj = parseSetCookieHeaders(setCookieHeaders)
  const mergedCookies = Object.keys(updatedCookiesObj).length ? mergeCookies(cookiesStr, updatedCookiesObj) : cookiesStr
  const cookiesUpdated = mergedCookies !== cookiesStr

  const resJson = await res.json().catch(() => null)
  const retMsg = Array.isArray(resJson?.ret) ? resJson.ret.join(', ') : ''
  const success = Array.isArray(resJson?.ret)
    && resJson.ret.some(r => String(r).includes('SUCCESS'))
    && Boolean(resJson?.data?.accessToken)

  if (success) {
    return {
      success: true,
      token: resJson.data.accessToken,
      cookies: mergedCookies,
      cookiesUpdated,
      raw: resJson
    }
  }

  return {
    success: false,
    cookies: mergedCookies,
    cookiesUpdated,
    raw: resJson,
    error: retMsg || 'token 请求失败'
  }
}

export async function refreshXianyuLogin({ cookies } = {}) {
  let cookiesStr = parseCookiesToString(cookies)
  if (!cookiesStr) {
    const config = await getXianyuConfig().catch(() => null)
    cookiesStr = parseCookiesToString(config?.cookies)
  }

  if (!cookiesStr) {
    return { success: false, cookies: '', cookiesUpdated: false, error: '缺少 cookies' }
  }

  const originalCookies = cookiesStr
  const deviceId = resolveDeviceIdFromCookies(cookiesStr)

  let tokenResult = await requestXianyuToken(cookiesStr, deviceId)
  cookiesStr = tokenResult.cookies

  if (!tokenResult.success && tokenResult.cookiesUpdated) {
    tokenResult = await requestXianyuToken(cookiesStr, deviceId)
    cookiesStr = tokenResult.cookies
  }

  if (!tokenResult.success && isSessionExpiredError(tokenResult.error || '')) {
    const loginResult = await requestXianyuHasLogin(cookiesStr)
    cookiesStr = loginResult.cookies

    if (loginResult.cookiesUpdated) {
      tokenResult = await requestXianyuToken(cookiesStr, deviceId)
      cookiesStr = tokenResult.cookies

      if (!tokenResult.success && tokenResult.cookiesUpdated) {
        tokenResult = await requestXianyuToken(cookiesStr, deviceId)
        cookiesStr = tokenResult.cookies
      }
    }

    if (!tokenResult.success && loginResult.success) {
      tokenResult = await requestXianyuToken(cookiesStr, deviceId)
      cookiesStr = tokenResult.cookies
    }

    if (!tokenResult.success && loginResult.error && !tokenResult.error) {
      tokenResult.error = loginResult.error
    }
  }

  return {
    success: Boolean(tokenResult.success),
    token: tokenResult.token || null,
    cookies: cookiesStr,
    cookiesUpdated: cookiesStr !== originalCookies,
    error: tokenResult.success ? null : (tokenResult.error || '续期失败')
  }
}

export async function refreshXianyuLoginAndPersist() {
  const config = await getXianyuConfig()
  if (!config?.cookies) {
    return { success: false, skipped: true, cookiesUpdated: false, error: '请先配置 Cookie' }
  }

  const result = await refreshXianyuLogin({ cookies: config.cookies })
  if (result.cookiesUpdated) {
    await updateXianyuConfig({ cookies: result.cookies })
  }
  return { ...result, persisted: Boolean(result.cookiesUpdated) }
}

export async function queryXianyuOrderDetailFromApi({ orderId, cookies, autoRefresh = true } = {}) {
  const normalizedOrderId = normalizeXianyuOrderId(orderId)
  if (!normalizedOrderId) {
    throw new Error('请输入有效的闲鱼订单号')
  }

  let cookiesStr = parseCookiesToString(cookies)
  if (!cookiesStr) {
    throw new Error('缺少 cookies 参数')
  }

  const originalCookies = cookiesStr

  const ensureH5Token = async () => {
    const cookiesObj = parseCookieHeaderToObject(cookiesStr)
    const rawH5Token = cookiesObj['_m_h5_tk']
    const h5Token = rawH5Token ? String(rawH5Token).split('_')[0] : ''
    if (h5Token) return h5Token

    if (!autoRefresh) {
      return ''
    }

    const loginResult = await requestXianyuHasLogin(cookiesStr)
    cookiesStr = loginResult.cookies

    const refreshedCookiesObj = parseCookieHeaderToObject(cookiesStr)
    const refreshedRaw = refreshedCookiesObj['_m_h5_tk']
    return refreshedRaw ? String(refreshedRaw).split('_')[0] : ''
  }

  const doRequest = async () => {
    const h5Token = await ensureH5Token()
    if (!h5Token) {
      return { success: false, error: "Cookie 缺少 _m_h5_tk，请重新登录闲鱼后复制 Cookie", raw: null }
    }

    const timestamp = Date.now().toString()
    const dataVal = JSON.stringify({ tid: normalizedOrderId })
    const sign = generateSign(timestamp, h5Token, dataVal)

    const params = new URLSearchParams({
      jsv: '2.7.2',
      appKey: SIGN_APP_KEY,
      t: timestamp,
      sign,
      v: '1.0',
      type: 'originaljson',
      accountSite: 'xianyu',
      dataType: 'json',
      timeout: '20000',
      api: 'mtop.idle.web.trade.order.detail',
      sessionOption: 'AutoLoginOnly'
    })

    const res = await fetch(`${ORDER_DETAIL_ENDPOINT}?${params}`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
        origin: 'https://www.goofish.com',
        referer: 'https://www.goofish.com/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        cookie: cookiesStr,
      },
      body: `data=${encodeURIComponent(dataVal)}`
    })

    const setCookieHeaders = res.headers?.getSetCookie?.() || []
    const updatedCookiesObj = parseSetCookieHeaders(setCookieHeaders)
    if (Object.keys(updatedCookiesObj).length) {
      cookiesStr = mergeCookies(cookiesStr, updatedCookiesObj)
    }

    const resJson = await res.json().catch(() => null)
    if (!resJson) {
      return { success: false, error: '闲鱼订单接口返回为空', raw: null }
    }

    const retMsg = Array.isArray(resJson?.ret) ? resJson.ret.join(', ') : ''
    const success = Array.isArray(resJson?.ret) && resJson.ret.some(r => String(r).includes('SUCCESS'))
    if (!success) {
      return { success: false, error: retMsg || '闲鱼订单接口请求失败', raw: resJson }
    }

    return { success: true, error: null, raw: resJson }
  }

  let result = await doRequest()

  if (!result.success && autoRefresh && shouldAttemptAuthRefresh(result.error || '')) {
    const refreshResult = await refreshXianyuLogin({ cookies: cookiesStr })
    if (refreshResult.cookiesUpdated) {
      cookiesStr = refreshResult.cookies
    }

    const retried = await doRequest()
    if (!retried.success) {
      const suffix = refreshResult.success ? '' : `（续期失败：${refreshResult.error || '未知错误'}）`
      throw new Error(`${retried.error || '闲鱼订单接口请求失败'}${suffix}`)
    }
    result = retried
  }

  if (!result.success) {
    throw new Error(result.error || '闲鱼订单接口请求失败')
  }

  return {
    raw: result.raw,
    orderId: normalizedOrderId,
    cookies: cookiesStr,
    cookiesUpdated: cookiesStr !== originalCookies,
  }
}

export function transformXianyuApiOrder(apiResult, requestedOrderId = '') {
  const data = apiResult?.data
  if (!data) return null

  const resolvedOrderId =
    normalizeXianyuOrderId(requestedOrderId)
    || normalizeXianyuOrderId(data?.utArgs?.orderId)
    || normalizeXianyuOrderId(data?.utArgs?.orderId ? String(data.utArgs.orderId) : '')
    || normalizeXianyuOrderId(data?.orderId ? String(data.orderId) : '')

  const orderInfoVO = data.components?.find(c => c && c.render === 'orderInfoVO')?.data
  const itemInfo = orderInfoVO?.itemInfo
  const orderInfoList = orderInfoVO?.orderInfoList || []

  const pick = (title) => orderInfoList.find(i => i && i.title === title)?.value

  const buyerNickname = pick('买家昵称') || null
  const orderTime = pick('下单时间') || null
  const payTime = pick('付款时间') || null
  const shipTime = pick('发货时间') || null
  const completeTime = pick('成交时间') || null

  const status = data.status
  const statusText = data.utArgs?.orderMainTitle || ORDER_STATUS_TEXT[status] || data.utArgs?.orderStatusName || '未知状态'
  const price = itemInfo?.price ?? orderInfoVO?.priceInfo?.amount?.value ?? null
  const itemTitle = itemInfo?.title || null

  return {
    orderId: resolvedOrderId || (data.orderId ? String(data.orderId) : null),
    status,
    statusText,
    price,
    itemTitle,
    buyerNickname,
    orderTime,
    payTime,
    shipTime,
    completeTime,
    raw: data,
  }
}

export function transformApiOrderForImport(order) {
  if (!order) return null
  return {
    orderId: order.orderId,
    orderTime: order.orderTime || null,
    orderStatus: order.statusText || null,
    nickname: order.buyerNickname || null,
    actualPaid: order.price ?? null,
  }
}
