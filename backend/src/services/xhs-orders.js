import { getDatabase, saveDatabase } from '../database/init.js'

export const XHS_CHANNEL = 'xhs'
export const XHS_ORDER_NUMBER_REGEX = /^P[0-9A-Z]{6,}$/i

/**
 * 解析 curl 命令提取请求头和 Cookie
 * @param {string} curlCommand - 完整的 curl 命令字符串
 * @returns {Object} 包含 headers 和 cookies 的对象
 */
export function parseCurlCommand(curlCommand) {
  if (!curlCommand || typeof curlCommand !== 'string') {
    return { headers: {}, cookies: '' }
  }

  const headers = {}
  let cookies = ''

  // 提取 -H 'header: value' 格式的请求头
  const headerRegex = /-H\s+['"]([^'"]+)['"]/g
  let match
  while ((match = headerRegex.exec(curlCommand)) !== null) {
    const headerLine = match[1]
    const colonIndex = headerLine.indexOf(':')
    if (colonIndex > 0) {
      const key = headerLine.substring(0, colonIndex).trim().toLowerCase()
      const value = headerLine.substring(colonIndex + 1).trim()
      headers[key] = value
    }
  }

  // 提取 -b 'cookies' 格式的 Cookie
  const cookieRegex = /-b\s+['"]([^'"]+)['"]/
  const cookieMatch = curlCommand.match(cookieRegex)
  if (cookieMatch) {
    cookies = cookieMatch[1]
  }

  // 如果没有 -b，尝试从 headers 中获取 cookie
  if (!cookies && headers['cookie']) {
    cookies = headers['cookie']
  }

  return { headers, cookies }
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

  // 如果已经是标准 Cookie 字符串格式（包含 = 且不是 JSON）
  if (typeof cookies === 'string' && !cookies.trim().startsWith('[') && !cookies.trim().startsWith('{')) {
    return cookies.trim()
  }

  let parsed
  try {
    parsed = typeof cookies === 'string' ? JSON.parse(cookies) : cookies
  } catch {
    // 解析失败，假设已经是标准格式
    return String(cookies).trim()
  }

  // 格式1：浏览器扩展导出的数组格式 [{name, value}, ...]
  if (Array.isArray(parsed)) {
    return parsed
      .filter(c => c && c.name && c.value !== undefined)
      .map(c => `${c.name}=${c.value}`)
      .join('; ')
  }

  // 格式2：简单键值对对象 {name: value, ...}
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
  orderNumber: row[1],
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
  const result = db.exec('SELECT id FROM xhs_config LIMIT 1')
  if (result.length === 0 || result[0].values.length === 0) {
    db.run(`INSERT INTO xhs_config (sync_enabled, sync_interval_hours, updated_at) VALUES (0, 6, DATETIME('now', 'localtime'))`)
    await saveDatabase()
    return 1
  }
  return result[0].values[0][0]
}

export function normalizeXhsOrderNumber(value = '') {
  if (!value) return ''
  const normalized = String(value).trim().toUpperCase()
  return XHS_ORDER_NUMBER_REGEX.test(normalized) ? normalized : ''
}

export async function getXhsConfig() {
  const db = await getDatabase()
  await ensureConfigRow()
  const result = db.exec(`
    SELECT id, cookies, authorization, extra_headers, last_sync_at, last_success_at, sync_enabled,
           sync_interval_hours, last_error, error_count, updated_at
    FROM xhs_config
    LIMIT 1
  `)
  if (result.length === 0 || result[0].values.length === 0) {
    return null
  }
  const row = result[0].values[0]
  let extraHeaders = null
  try {
    extraHeaders = row[3] ? JSON.parse(row[3]) : null
  } catch {
    extraHeaders = null
  }
  return {
    id: row[0],
    cookies: row[1],
    authorization: row[2],
    extraHeaders,
    lastSyncAt: row[4],
    lastSuccessAt: row[5],
    syncEnabled: row[6] === 1,
    syncIntervalHours: row[7],
    lastError: row[8],
    errorCount: row[9] || 0,
    updatedAt: row[10],
    cookiesConfigured: Boolean(row[1]),
    authorizationConfigured: Boolean(row[2]),
    extraHeadersConfigured: Boolean(row[3]),
  }
}

export async function updateXhsConfig({ cookies, authorization, extraHeaders, syncEnabled, syncIntervalHours }) {
  const db = await getDatabase()
  const configId = await ensureConfigRow()
  const updates = []
  const params = []

  if (cookies !== undefined) {
    updates.push('cookies = ?')
    params.push(cookies)
    updates.push('last_error = NULL')
    updates.push('error_count = 0')
  }

  if (authorization !== undefined) {
    updates.push('authorization = ?')
    params.push(authorization)
  }

  if (extraHeaders !== undefined) {
    updates.push('extra_headers = ?')
    params.push(extraHeaders ? JSON.stringify(extraHeaders) : null)
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
    return getXhsConfig()
  }

  updates.push("updated_at = DATETIME('now', 'localtime')")

  db.run(
    `UPDATE xhs_config SET ${updates.join(', ')} WHERE id = ?`,
    [...params, configId],
  )
  await saveDatabase()
  return getXhsConfig()
}

export async function recordXhsSyncResult({ success, error = null }) {
  const db = await getDatabase()
  await ensureConfigRow()
  if (success) {
    db.run(`
      UPDATE xhs_config
      SET last_sync_at = DATETIME('now', 'localtime'),
          last_success_at = DATETIME('now', 'localtime'),
          last_error = NULL,
          error_count = 0,
          updated_at = DATETIME('now', 'localtime')
    `)
  } else {
    db.run(`
      UPDATE xhs_config
      SET last_sync_at = DATETIME('now', 'localtime'),
          last_error = ?,
          error_count = error_count + 1,
          updated_at = DATETIME('now', 'localtime')
    `, [error || '未知错误'])
  }
  await saveDatabase()
}

export async function importXhsOrders(orderEntries = []) {
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
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }

  const preparedEntries = orderEntries
    .map(entry => {
      if (typeof entry === 'string') {
        return { orderNumber: entry, orderTime: null }
      }
      if (entry && typeof entry === 'object') {
        return {
          orderNumber: entry.orderNumber || entry.order_number || entry.code || '',
          orderTime: entry.orderTime || entry.order_time || entry.time || null,
          orderStatus: entry.orderStatus || entry.order_status || entry.statusText || entry.status || null,
          nickname: entry.nickname || entry.nickName || entry.userNickname || null,
          actualPaid: entry.actualPaid ?? entry.actual_paid ?? null,
        }
      }
      return null
    })
    .map(entry => {
      if (!entry) return null
      const normalizedNumber = normalizeXhsOrderNumber(entry.orderNumber)
      if (!normalizedNumber) return null
      return {
        orderNumber: normalizedNumber,
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

  const entriesByNumber = new Map()
  preparedEntries.forEach(entry => {
    const existing = entriesByNumber.get(entry.orderNumber)
      if (!existing) {
        entriesByNumber.set(entry.orderNumber, entry)
      } else {
        if (!existing.orderTime && entry.orderTime) {
          existing.orderTime = entry.orderTime
        }
        if (entry.orderStatus && (!existing.orderStatus || (existing.orderStatus !== '已关闭' && entry.orderStatus === '已关闭'))) {
          existing.orderStatus = entry.orderStatus
        }
        if (!existing.nickname && entry.nickname) {
          existing.nickname = entry.nickname
        }
        if (existing.actualPaid == null && entry.actualPaid != null) {
          existing.actualPaid = entry.actualPaid
        }
      }
  })

  const uniqueNumbers = Array.from(entriesByNumber.keys())
  const db = await getDatabase()

  const existingMap = new Map()
  if (uniqueNumbers.length > 0) {
    const placeholders = uniqueNumbers.map(() => '?').join(',')
    const existingResult = db.exec(
      `SELECT order_number, order_time, order_status, nickname, actual_paid FROM xhs_orders WHERE order_number IN (${placeholders})`,
      uniqueNumbers,
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
  uniqueNumbers.forEach(orderNumber => {
    const entry = entriesByNumber.get(orderNumber)
    if (!entry) return
    if (existingMap.has(orderNumber)) {
      const currentEntry = existingMap.get(orderNumber)
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
            UPDATE xhs_orders
            SET ${updates.join(', ')}
            WHERE order_number = ?
          `,
          [...params, orderNumber]
        )
      }
      skipped += 1
      return
    }

    db.run(
      `
	        INSERT INTO xhs_orders (
	          order_number,
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
	      [orderNumber, entry.orderTime, entry.orderStatus, entry.nickname, entry.actualPaid],
	    )
	    created += 1
	  })

  if (created > 0) {
    await saveDatabase()
  }

  return {
    created,
    skipped,
    total: entriesByNumber.size,
  }
}

export async function clearXhsOrders() {
  const db = await getDatabase()
  const countResult = db.exec('SELECT COUNT(*) FROM xhs_orders')
  const total = countResult[0]?.values[0]?.[0] || 0
  db.run('DELETE FROM xhs_orders')
  await saveDatabase()
  return { cleared: total }
}

export async function deleteXhsOrder(id) {
  const db = await getDatabase()
  const existing = db.exec('SELECT id FROM xhs_orders WHERE id = ?', [id])
  if (!existing[0]?.values?.length) {
    return { deleted: false, reason: '订单不存在' }
  }
  db.run('DELETE FROM xhs_orders WHERE id = ?', [id])
  await saveDatabase()
  return { deleted: true }
}

export async function getXhsOrderStats() {
  const db = await getDatabase()
  const totalResult = db.exec('SELECT COUNT(*) FROM xhs_orders')
  const usedResult = db.exec('SELECT COUNT(*) FROM xhs_orders WHERE is_used = 1')
  const todayResult = db.exec(`
    SELECT COUNT(*) FROM xhs_orders
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

export async function getXhsOrders({ limit = 100, offset = 0 } = {}) {
  const db = await getDatabase()
  const result = db.exec(
    `
      SELECT o.id, o.order_number, o.order_status, o.order_time, o.nickname, o.status, o.user_email, o.assigned_code_id,
             o.assigned_code, o.is_used, o.extracted_at, o.reserved_at, o.used_at,
             o.created_at, o.updated_at, rc.code as redemption_code, rc.channel, o.actual_paid
      FROM xhs_orders o
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

export async function getXhsOrderByNumber(orderNumber) {
  const normalized = normalizeXhsOrderNumber(orderNumber)
  if (!normalized) return null
  const db = await getDatabase()
  const result = db.exec(
    `
      SELECT o.id, o.order_number, o.order_status, o.order_time, o.nickname, o.status, o.user_email, o.assigned_code_id,
             o.assigned_code, o.is_used, o.extracted_at, o.reserved_at, o.used_at,
             o.created_at, o.updated_at, rc.code as redemption_code, rc.channel, o.actual_paid
      FROM xhs_orders o
      LEFT JOIN redemption_codes rc ON rc.id = o.assigned_code_id
      WHERE o.order_number = ?
      LIMIT 1
    `,
    [normalized],
  )

  if (result.length === 0 || result[0].values.length === 0) {
    return null
  }

  return mapOrderRow(result[0].values[0])
}

export async function markXhsOrderRedeemed(orderId, codeId, code, email) {
  const db = await getDatabase()
  db.run(
    `
      UPDATE xhs_orders
      SET status = 'redeemed',
          user_email = ?,
          assigned_code_id = ?,
          assigned_code = ?,
          is_used = 1,
          used_at = DATETIME('now', 'localtime'),
          updated_at = DATETIME('now', 'localtime')
      WHERE id = ?
    `,
    [email, codeId, code, orderId],
  )
  await saveDatabase()
}

/**
 * 从小红书API查询订单
 * @param {Object} options - 查询选项
 * @param {string} options.authorization - 授权token
 * @param {string} options.cookies - Cookie字符串
 * @param {Object} [options.extraHeaders] - 额外的请求头（如 x-s, x-s-common, x-t）
 * @param {string} [options.searchKeyword] - 搜索关键词（订单号）
 * @param {number} [options.pageNo=1] - 页码
 * @param {number} [options.pageSize=20] - 每页数量
 * @param {number} [options.startTime] - 开始时间戳
 * @param {number} [options.endTime] - 结束时间戳
 * @returns {Promise<Object>} 订单查询结果
 */
export async function queryXhsOrdersFromApi(options) {
  const {
    authorization,
    cookies,
    extraHeaders = {},
    searchKeyword = '',
    pageNo = 1,
    pageSize = 20,
    startTime,
    endTime,
  } = options

  if (!authorization) {
    throw new Error('缺少 authorization 参数')
  }
  if (!cookies) {
    throw new Error('缺少 cookies 参数')
  }

  // 默认查询最近6个月的订单
  const now = Date.now()
  const sixMonthsAgo = now - 180 * 24 * 60 * 60 * 1000
  const queryStartTime = startTime || sixMonthsAgo
  const queryEndTime = endTime || now

  const requestBody = {
    page_no: pageNo,
    page_size: pageSize,
    multi_search_field: searchKeyword,
    order_tag_list: [],
    order_type_list: [],
    promise_ship_time_type_list: [],
    after_sale_status_list: [],
    status: [],
    time_range_list: [
      {
        time_type: 3,
        start_time: queryStartTime,
        end_time: queryEndTime,
      },
    ],
    seller_mark_priority_list: [],
    seller_mark_note_status_list: [],
    overdue_status: -2,
    sort_by: {
      sort_field: 'ordered_at',
      desc: true,
    },
    need_declare_info: true,
    need_declare_times: true,
    allow_es_fallback: true,
  }

  // 基础请求头
  const headers = {
    accept: 'application/json, text/plain, */*',
    'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
    authorization: authorization,
    'bill-type': 'xhs',
    'cache-control': 'no-cache',
    'content-type': 'application/json',
    cookie: parseCookiesToString(cookies),
    origin: 'https://ark.xiaohongshu.com',
    pragma: 'no-cache',
    referer: 'https://ark.xiaohongshu.com/app-order/order/query',
    'user-agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  }

  // 添加额外的请求头（如 x-s, x-s-common, x-t）
  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      const lowerKey = key.toLowerCase()
      // 只添加必要的额外头，跳过已有的基础头
      if (value && !headers[lowerKey]) {
        headers[lowerKey] = value
      }
    }
  }

  console.log('[XHS API] 发送请求，包含请求头:', Object.keys(headers).join(', '))

  const response = await fetch(
    'https://ark.xiaohongshu.com/api/edith/fulfillment/order/page',
    {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    },
  )

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`小红书API请求失败: ${response.status} ${response.statusText} ${errorText}`)
  }

  const data = await response.json()

  if (data.code !== 0 || !data.success) {
    throw new Error(`小红书API返回错误: ${data.msg || '未知错误'}`)
  }

  return data
}

/**
 * 将小红书API返回的订单数据转换为本地格式
 * @param {Object} apiPackage - API返回的单个package对象
 * @returns {Object} 转换后的订单对象
 */
export function transformXhsApiOrder(apiPackage) {
  const skuInfo = apiPackage.skus?.[0] || {}
  const scskuInfo = skuInfo.scskus?.[0] || {}

  return {
    packageId: apiPackage.packageId,
    orderId: apiPackage.orderId,
    status: apiPackage.status,
    statusDesc: apiPackage.statusDesc,
    orderedAt: apiPackage.orderedAt,
    paidAt: apiPackage.paidAt,
    finishedAt: apiPackage.finishedAt,
    actualPaid: apiPackage.actualPaid,
    totalOrderAmount: apiPackage.totalOrderAmount,
    shippingFee: apiPackage.shippingFee,
    sellerDiscountAmount: apiPackage.sellerDiscountAmount,
    userInfo: {
      nickName: apiPackage.userInfo?.nickName || '',
      phone: apiPackage.userInfo?.phone || '',
      address: apiPackage.userInfo?.address || '',
    },
    sku: {
      name: scskuInfo.name || skuInfo.skuName || '',
      specification: scskuInfo.specification || skuInfo.skuSpecification || '',
      quantity: scskuInfo.quantity || skuInfo.skuQuantity || 1,
      paidAmount: scskuInfo.paidAmount || skuInfo.skuTotalPaidAmount || 0,
      soldPrice: scskuInfo.soldPrice || skuInfo.skuSoldPrice || 0,
      image: scskuInfo.image || skuInfo.image || '',
    },
    expressNo: skuInfo.expressNo || apiPackage.expressNo || '',
    expressCompanyName: skuInfo.expressCompanyName || apiPackage.expressCompanyName || '',
    afterSaleStatus: apiPackage.afterSaleStatus,
    afterSaleStatusDesc: apiPackage.afterSaleStatusDesc,
    orderTags: apiPackage.orderTagList || [],
  }
}

/**
 * 将小红书API订单数据转换为本地数据库格式
 * @param {Object} apiPackage - API返回的单个package对象
 * @returns {Object} 适合导入数据库的订单对象
 */
export function transformApiOrderForImport(apiPackage) {
  return {
    orderNumber: apiPackage.packageId,
    orderTime: apiPackage.orderedAt || null,
    orderStatus: apiPackage.statusDesc || null,
    nickname: apiPackage.userInfo?.nickName || null,
    actualPaid: apiPackage.actualPaid ?? null,
  }
}

/**
 * 使用API分页同步所有订单到数据库
 * @param {Object} options - 同步选项
 * @param {string} options.authorization - 授权token
 * @param {string} options.cookies - Cookie字符串
 * @param {Object} [options.extraHeaders] - 额外的请求头（如 x-s, x-s-common, x-t）
 * @param {string} [options.searchKeyword] - 搜索关键词
 * @param {number} [options.pageSize=50] - 每页数量
 * @param {number} [options.maxPages=100] - 最大页数限制
 * @param {number} [options.startTime] - 开始时间戳
 * @param {number} [options.endTime] - 结束时间戳
 * @param {function} [options.onProgress] - 进度回调
 * @returns {Promise<Object>} 同步结果
 */
export async function syncOrdersFromApi(options) {
  const {
    authorization,
    cookies,
    extraHeaders = {},
    searchKeyword = '',
    pageSize = 50,
    maxPages = 100,
    startTime,
    endTime,
    onProgress,
  } = options

  let allOrders = []
  let currentPage = 1
  let totalFetched = 0
  let totalInApi = 0
  let hasMore = true

  console.log('[XHS API Sync] 开始分页同步订单...')

  while (hasMore && currentPage <= maxPages) {
    try {
      const apiResult = await queryXhsOrdersFromApi({
        authorization,
        cookies,
        extraHeaders,
        searchKeyword,
        pageNo: currentPage,
        pageSize,
        startTime,
        endTime,
      })

      const packages = apiResult.data?.packages || []
      totalInApi = apiResult.data?.total || 0

      if (packages.length === 0) {
        hasMore = false
        break
      }

      // 转换为数据库导入格式
      const ordersForImport = packages.map(transformApiOrderForImport)
      allOrders.push(...ordersForImport)
      totalFetched += packages.length

      console.log(`[XHS API Sync] 第${currentPage}页: 获取${packages.length}条订单，累计${totalFetched}/${totalInApi}`)

      if (onProgress) {
        onProgress({
          currentPage,
          pagesFetched: currentPage,
          ordersFetched: totalFetched,
          totalOrders: totalInApi,
        })
      }

      // 判断是否还有更多数据
      if (totalFetched >= totalInApi || packages.length < pageSize) {
        hasMore = false
      } else {
        currentPage++
        // 添加延迟避免请求过快
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    } catch (error) {
      console.error(`[XHS API Sync] 第${currentPage}页获取失败:`, error.message)
      throw error
    }
  }

  console.log(`[XHS API Sync] 分页获取完成，共${allOrders.length}条订单，开始导入数据库...`)

  // 导入到数据库
  const importResult = await importXhsOrders(allOrders)

  console.log(`[XHS API Sync] 同步完成: 新增${importResult.created}条，跳过${importResult.skipped}条`)

  return {
    success: true,
    totalFetched: allOrders.length,
    totalInApi,
    pagesFetched: currentPage,
    ...importResult,
  }
}
