import express from 'express'
import { getDatabase, saveDatabase } from '../database/init.js'
import { authenticateToken } from '../middleware/auth.js'
import { requireMenu } from '../middleware/rbac.js'
import { authenticateLinuxDoSession } from '../middleware/linuxdo-session.js'
import { verifyTurnstileToken, isTurnstileEnabled } from '../utils/turnstile.js'
import { redeemCodeInternal, RedemptionError } from './redemption-codes.js'

const router = express.Router()

router.use('/admin', authenticateToken, requireMenu('waiting_room'))

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

const WAITING_ROOM_CAPACITY = Math.max(0, toInt(process.env.WAITING_ROOM_MAX_SIZE, 500))
const WAITING_ROOM_MIN_TRUST_LEVEL = Math.max(0, toInt(process.env.WAITING_ROOM_MIN_TRUST_LEVEL, 1))
const WAITING_ROOM_REJOIN_COOLDOWN_DAYS = Math.max(0, toInt(process.env.WAITING_ROOM_REJOIN_COOLDOWN_DAYS, 30))
const ENTRY_FIELDS = `
  id,
  linuxdo_uid,
  linuxdo_username,
  linuxdo_name,
  linuxdo_trust_level,
  email,
  status,
  boarded_at,
  left_at,
  created_at,
  updated_at,
  reserved_code_id,
  reserved_code,
  reserved_at,
  reserved_by,
  queue_position_snapshot
`

const VALID_STATUSES = new Set(['waiting', 'boarded', 'left'])

const getWaitingRoomConfig = () => ({
  capacity: WAITING_ROOM_CAPACITY,
  minTrustLevel: WAITING_ROOM_MIN_TRUST_LEVEL,
  cooldownDays: WAITING_ROOM_REJOIN_COOLDOWN_DAYS,
  enabled: WAITING_ROOM_CAPACITY > 0,
})

const isWaitingRoomEnabled = () => WAITING_ROOM_CAPACITY > 0

const getClientIp = (req) => {
  const cfConnectingIp = req.headers['cf-connecting-ip']
  if (typeof cfConnectingIp === 'string' && cfConnectingIp.trim()) {
    return cfConnectingIp.trim()
  }
  const forwardedFor = req.headers['x-forwarded-for']
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0].trim()
  }
  return req.ip
}

const getColumnValue = (row, columns, columnName, fallbackIndex) => {
  if (!row) return null
  if (Array.isArray(columns) && columns.length > 0) {
    const idx = columns.indexOf(columnName)
    if (idx !== -1) {
      return row[idx]
    }
  }
  if (typeof fallbackIndex === 'number') {
    return row[fallbackIndex]
  }
  return null
}

const mapEntry = (row, columns) => {
  if (!row) return null
  return {
    id: getColumnValue(row, columns, 'id', 0),
    linuxDoUid: getColumnValue(row, columns, 'linuxdo_uid', 1),
    linuxDoUsername: getColumnValue(row, columns, 'linuxdo_username', 2),
    linuxDoName: getColumnValue(row, columns, 'linuxdo_name', 3),
    linuxDoTrustLevel: getColumnValue(row, columns, 'linuxdo_trust_level', 4),
    email: getColumnValue(row, columns, 'email', 5),
    status: getColumnValue(row, columns, 'status', 6),
    boardedAt: getColumnValue(row, columns, 'boarded_at', 7),
    leftAt: getColumnValue(row, columns, 'left_at', 8),
    createdAt: getColumnValue(row, columns, 'created_at', 9),
    updatedAt: getColumnValue(row, columns, 'updated_at', 10),
    reservedCodeId: getColumnValue(row, columns, 'reserved_code_id', 11),
    reservedCode: getColumnValue(row, columns, 'reserved_code', 12),
    reservedAt: getColumnValue(row, columns, 'reserved_at', 13),
    reservedBy: getColumnValue(row, columns, 'reserved_by', 14),
    queuePositionSnapshot: getColumnValue(row, columns, 'queue_position_snapshot', 15),
    queuePosition: getColumnValue(row, columns, 'queue_position', null)
  }
}

const getScalar = result => {
  if (!result || result.length === 0 || result[0].values.length === 0) return 0
  return result[0].values[0][0] || 0
}

const calculateCooldownEndsAt = (boardedAt) => {
  if (!boardedAt || !WAITING_ROOM_REJOIN_COOLDOWN_DAYS) return null
  const boardedDate = new Date(String(boardedAt).replace(' ', 'T'))
  if (Number.isNaN(boardedDate.getTime())) return null
  const cooldownMs = WAITING_ROOM_REJOIN_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
  return new Date(boardedDate.getTime() + cooldownMs).toISOString()
}

const getCooldownResetAt = (db, linuxDoUid) => {
  const result = db.exec(
    `
      SELECT reset_at
      FROM waiting_room_cooldown_resets
      WHERE linuxdo_uid = ?
      LIMIT 1
    `,
    [linuxDoUid]
  )
  if (!result.length || !result[0].values.length) {
    return null
  }
  return result[0].values[0][0] || null
}

const getCooldownInfo = (db, linuxDoUid) => {
  if (!WAITING_ROOM_REJOIN_COOLDOWN_DAYS) {
    return { lastBoardedAt: null, lastBoardedEmail: null, cooldownEndsAt: null, isInCooldown: false, resetAt: null }
  }

  const result = db.exec(
    `
      SELECT boarded_at, email FROM waiting_room_entries
      WHERE linuxdo_uid = ? AND status = 'boarded' AND boarded_at IS NOT NULL
      ORDER BY datetime(boarded_at) DESC
      LIMIT 1
    `,
    [linuxDoUid]
  )
  if (!result.length || !result[0].values.length) {
    return { lastBoardedAt: null, lastBoardedEmail: null, cooldownEndsAt: null, isInCooldown: false, resetAt: null }
  }
  const lastBoardedAt = result[0].values[0][0]
  const lastBoardedEmail = result[0].values[0][1] || null
  const cooldownEndsAt = calculateCooldownEndsAt(lastBoardedAt)
  const resetAt = getCooldownResetAt(db, linuxDoUid)

  if (resetAt && lastBoardedAt) {
    const resetDate = new Date(String(resetAt).replace(' ', 'T'))
    const boardedDate = new Date(String(lastBoardedAt).replace(' ', 'T'))
    if (!Number.isNaN(resetDate.getTime()) && !Number.isNaN(boardedDate.getTime()) && resetDate.getTime() >= boardedDate.getTime()) {
      return { lastBoardedAt, lastBoardedEmail, cooldownEndsAt: null, isInCooldown: false, resetAt }
    }
  }

  if (!cooldownEndsAt) {
    return { lastBoardedAt, lastBoardedEmail, cooldownEndsAt: null, isInCooldown: false, resetAt }
  }
  const isInCooldown = Date.now() < new Date(cooldownEndsAt).getTime()
  return { lastBoardedAt, lastBoardedEmail, cooldownEndsAt, isInCooldown, resetAt }
}

const buildQueueSnapshot = (db, linuxDoUid) => {
  const entryResult = db.exec(
    `
      SELECT ${ENTRY_FIELDS}
      FROM waiting_room_entries
      WHERE linuxdo_uid = ?
      ORDER BY status = 'waiting' DESC, created_at DESC
      LIMIT 1
    `,
    [linuxDoUid]
  )

  const entryRow = entryResult.length > 0 && entryResult[0].values.length > 0 ? entryResult[0].values[0] : null
  const entryColumns = entryResult.length > 0 ? entryResult[0].columns : []
  const totalWaiting = getScalar(db.exec(`SELECT COUNT(*) FROM waiting_room_entries WHERE status = 'waiting'`))
  const boardedCount = getScalar(db.exec(`SELECT COUNT(*) FROM waiting_room_entries WHERE status = 'boarded'`))
  const lastBoardedResult = db.exec(`
    SELECT boarded_at FROM waiting_room_entries
    WHERE status = 'boarded' AND boarded_at IS NOT NULL
    ORDER BY boarded_at DESC
    LIMIT 1
  `)
  const lastBoardedAt = lastBoardedResult.length > 0 && lastBoardedResult[0].values.length > 0
    ? lastBoardedResult[0].values[0][0]
    : null
  const cooldownInfo = getCooldownInfo(db, linuxDoUid)

  let queuePosition = null
  if (entryRow && entryRow[6] === 'waiting') {
    const positionResult = db.exec(
      `
        SELECT COUNT(*) FROM waiting_room_entries
        WHERE status = 'waiting' AND datetime(created_at) <= datetime(?)
      `,
      [entryRow[9]]
    )
    queuePosition = getScalar(positionResult) || 1
  }
  const queuePositionSnapshot = entryRow ? entryRow[15] || null : null

  return {
    entry: mapEntry(entryRow, entryColumns),
    queuePosition,
    queuePositionSnapshot,
    totalWaiting,
    boardedCount,
    lastBoardedAt,
    config: getWaitingRoomConfig(),
    cooldownEndsAt: cooldownInfo.cooldownEndsAt,
    cooldownActive: cooldownInfo.isInCooldown,
    cooldownLastBoardedAt: cooldownInfo.lastBoardedAt,
    cooldownLastBoardedEmail: cooldownInfo.lastBoardedEmail,
    cooldownResetAt: cooldownInfo.resetAt ?? null
  }
}

const normalizeLinuxDoUid = (value = '') => String(value || '').trim()
const normalizeEmail = (value = '') => String(value || '').trim().toLowerCase()
const isValidEmail = (value = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const normalizeTrustLevel = (value) => {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : 0
}

const fetchEntryById = (db, entryId) => {
  const result = db.exec(
    `
      SELECT ${ENTRY_FIELDS}
      FROM waiting_room_entries
      WHERE id = ?
      LIMIT 1
    `,
    [entryId]
  )
  if (!result.length || !result[0].values.length) {
    return null
  }
  return mapEntry(result[0].values[0], result[0].columns)
}

const fetchActiveEntryByUid = (db, linuxDoUid) => {
  const result = db.exec(
    `
      SELECT ${ENTRY_FIELDS}
      FROM waiting_room_entries
      WHERE linuxdo_uid = ? AND status = 'waiting'
      ORDER BY created_at ASC
      LIMIT 1
    `,
    [linuxDoUid]
  )
  if (!result.length || !result[0].values.length) {
    return null
  }
  return mapEntry(result[0].values[0], result[0].columns)
}

const releaseReservedCode = (db, entry, { force = false } = {}) => {
  if (!entry || !entry.reservedCodeId) {
    return { released: false }
  }

  const codeResult = db.exec(
    `SELECT id, is_redeemed FROM redemption_codes WHERE id = ? LIMIT 1`,
    [entry.reservedCodeId]
  )

  const hasCodeRow = codeResult.length > 0 && codeResult[0].values.length > 0
  const isRedeemed = hasCodeRow ? codeResult[0].values[0][1] === 1 : false

  if (isRedeemed && !force) {
    return { released: false, reason: 'code_redeemed' }
  }

  db.run(
    `
      UPDATE waiting_room_entries
      SET reserved_code_id = NULL,
          reserved_code = NULL,
          reserved_at = NULL,
          reserved_by = NULL,
          updated_at = DATETIME('now', 'localtime')
      WHERE id = ?
    `,
    [entry.id]
  )

  if (hasCodeRow) {
    db.run(
      `
        UPDATE redemption_codes
        SET reserved_for_uid = NULL,
            reserved_for_username = NULL,
            reserved_for_entry_id = NULL,
            reserved_at = NULL,
            updated_at = DATETIME('now', 'localtime')
        WHERE id = ?
      `,
      [entry.reservedCodeId]
    )
  }

  return { released: true }
}

const fetchWaitingEntries = (db) => {
  const result = db.exec(
    `
      SELECT ${ENTRY_FIELDS}
      FROM waiting_room_entries
      WHERE status = 'waiting'
      ORDER BY created_at ASC
    `
  )
  if (!result.length || !result[0].values.length) {
    return []
  }
  return result[0].values.map(row => mapEntry(row, result[0].columns))
}

const buildStats = (db) => ({
  waiting: getScalar(db.exec(`SELECT COUNT(*) FROM waiting_room_entries WHERE status = 'waiting'`)),
  boarded: getScalar(db.exec(`SELECT COUNT(*) FROM waiting_room_entries WHERE status = 'boarded'`)),
  left: getScalar(db.exec(`SELECT COUNT(*) FROM waiting_room_entries WHERE status = 'left'`))
})

router.get('/status', authenticateLinuxDoSession, async (req, res) => {
  try {
    const linuxDoUid = normalizeLinuxDoUid(req.linuxdo?.uid)
    if (!linuxDoUid) {
      return res.status(400).json({ error: '缺少 Linux DO UID' })
    }

    const db = await getDatabase()
    const snapshot = buildQueueSnapshot(db, linuxDoUid)
    return res.json(snapshot)
  } catch (error) {
    console.error('[WaitingRoom] 获取状态失败:', error)
    return res.status(500).json({ error: '获取候车室状态失败' })
  }
})

router.post('/join', authenticateLinuxDoSession, async (req, res) => {
  try {
    if (!isWaitingRoomEnabled()) {
      return res.status(403).json({ error: '候车室已关闭，请等待下次开放', code: 'WAITING_ROOM_DISABLED' })
    }

    const { email, turnstileToken = '' } = req.body || {}

    const normalizedUid = normalizeLinuxDoUid(req.linuxdo?.uid)
    const linuxDoUsername = String(req.linuxdo?.username || '').trim()
    const linuxDoName = String(req.linuxdo?.name || '').trim()
    const linuxDoTrustLevel = req.linuxdo?.trustLevel ?? req.linuxdo?.trust_level ?? 0
    const normalizedEmail = normalizeEmail(email)
    const trustLevel = normalizeTrustLevel(linuxDoTrustLevel)
    const normalizedTurnstileToken = String(turnstileToken || '').trim()

    if (!normalizedUid) {
      return res.status(400).json({ error: '缺少 Linux DO UID' })
    }

    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      return res.status(400).json({ error: '请提供有效邮箱' })
    }

    if (await isTurnstileEnabled()) {
      if (!normalizedTurnstileToken) {
        return res.status(400).json({ error: '请先完成人机验证', code: 'TURNSTILE_REQUIRED' })
      }
      const verification = await verifyTurnstileToken(normalizedTurnstileToken, getClientIp(req))
      if (!verification.success) {
        return res.status(403).json({
          error: '人机验证失败，请稍后再试',
          code: 'TURNSTILE_FAILED',
          turnstileErrors: verification.errorCodes || []
        })
      }
    }

    const db = await getDatabase()

    const existingWaiting = db.exec(
      `
        SELECT id FROM waiting_room_entries
        WHERE linuxdo_uid = ? AND status = 'waiting'
        ORDER BY created_at ASC
        LIMIT 1
      `,
      [normalizedUid]
    )

    if (existingWaiting.length > 0 && existingWaiting[0].values.length > 0) {
      const entryId = existingWaiting[0].values[0][0]
      db.run(
        `
          UPDATE waiting_room_entries
          SET email = ?, linuxdo_username = ?, linuxdo_name = ?, linuxdo_trust_level = ?, updated_at = DATETIME('now', 'localtime')
          WHERE id = ?
        `,
        [normalizedEmail, linuxDoUsername || null, linuxDoName || null, trustLevel, entryId]
      )
    } else {
      const { minTrustLevel, capacity } = getWaitingRoomConfig()
      if (trustLevel < minTrustLevel) {
        return res.status(403).json({ error: `候车室仅限达到 Lv.${minTrustLevel} 的 Linux DO 用户加入` })
      }

      const cooldownInfo = getCooldownInfo(db, normalizedUid)
      if (cooldownInfo.isInCooldown) {
        return res.status(403).json({
          error: `您已完成上车，请等待 ${WAITING_ROOM_REJOIN_COOLDOWN_DAYS} 天后再加入候车室`,
          cooldownEndsAt: cooldownInfo.cooldownEndsAt
        })
      }

      const waitingCount = getScalar(db.exec(`SELECT COUNT(*) FROM waiting_room_entries WHERE status = 'waiting'`))
      if (capacity > 0 && waitingCount >= capacity) {
        return res.status(403).json({ error: '候车室已满，请稍后再试' })
      }

      const queuePositionSnapshot = waitingCount + 1

      db.run(
        `
          INSERT INTO waiting_room_entries (linuxdo_uid, linuxdo_username, linuxdo_name, linuxdo_trust_level, email, status, created_at, updated_at, queue_position_snapshot)
          VALUES (?, ?, ?, ?, ?, 'waiting', DATETIME('now', 'localtime'), DATETIME('now', 'localtime'), ?)
        `,
        [normalizedUid, linuxDoUsername || null, linuxDoName || null, trustLevel, normalizedEmail, queuePositionSnapshot]
      )
    }

    saveDatabase()

    const snapshot = buildQueueSnapshot(db, normalizedUid)
    return res.json({
      message: '已加入候车室',
      ...snapshot
    })
  } catch (error) {
    console.error('[WaitingRoom] 加入候车室失败:', error)
    return res.status(500).json({ error: '加入候车室失败，请稍后再试' })
  }
})

router.post('/leave', authenticateLinuxDoSession, async (req, res) => {
  try {
    const linuxDoUid = normalizeLinuxDoUid(req.linuxdo?.uid)
    if (!linuxDoUid) {
      return res.status(400).json({ error: '缺少 Linux DO UID' })
    }
    const db = await getDatabase()
    const entry = fetchActiveEntryByUid(db, linuxDoUid)
    if (!entry) {
      return res.status(404).json({ error: '当前不在候车队列' })
    }

    releaseReservedCode(db, entry)

    db.run(
      `
        UPDATE waiting_room_entries
        SET status = 'left',
            left_at = DATETIME('now', 'localtime'),
            updated_at = DATETIME('now', 'localtime')
        WHERE id = ?
      `,
      [entry.id]
    )
    saveDatabase()
    const snapshot = buildQueueSnapshot(db, linuxDoUid)
    return res.json({
      message: '已离开候车室',
      ...snapshot
    })
  } catch (error) {
    console.error('[WaitingRoom] 离开候车室失败:', error)
    return res.status(500).json({ error: '离开候车室失败，请稍后再试' })
  }
})

router.get('/admin/entries', async (req, res) => {
  try {
    const db = await getDatabase()
    const page = Math.max(1, toInt(req.query.page, 1))
    const pageSize = Math.min(100, Math.max(1, toInt(req.query.pageSize, 20)))
    const statusQuery = String(req.query.status || 'waiting')
    const normalizedStatus = statusQuery === 'all' || !VALID_STATUSES.has(statusQuery)
      ? (statusQuery === 'all' ? 'all' : 'waiting')
      : statusQuery
    const search = String(req.query.search || '').trim().toLowerCase()

    const conditions = []
    const params = []

    if (normalizedStatus !== 'all') {
      conditions.push('status = ?')
      params.push(normalizedStatus)
    }

    if (search) {
      const like = `%${search}%`
      conditions.push(`(
        LOWER(IFNULL(linuxdo_username, '')) LIKE ? OR
        LOWER(IFNULL(linuxdo_name, '')) LIKE ? OR
        LOWER(email) LIKE ? OR
        linuxdo_uid LIKE ? OR
        LOWER(IFNULL(reserved_code, '')) LIKE ?
      )`)
      params.push(like, like, like, `%${search}%`, like)
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const totalResult = db.exec(`SELECT COUNT(*) FROM waiting_room_entries ${whereClause}`, params)
    const total = getScalar(totalResult)

    const offset = (page - 1) * pageSize
    const listParams = [...params, pageSize, offset]
    const listResult = db.exec(
      `
        SELECT ${ENTRY_FIELDS},
          CASE WHEN status = 'waiting' THEN (
            SELECT COUNT(*)
            FROM waiting_room_entries w2
            WHERE w2.status = 'waiting' AND datetime(w2.created_at) <= datetime(waiting_room_entries.created_at)
          ) ELSE NULL END AS queue_position
        FROM waiting_room_entries
        ${whereClause}
        ORDER BY (status = 'waiting') DESC, datetime(created_at) ASC
        LIMIT ? OFFSET ?
      `,
      listParams
    )

    const entries = listResult.length
      ? listResult[0].values.map(row => mapEntry(row, listResult[0].columns))
      : []

    res.json({
      entries,
      pagination: {
        page,
        pageSize,
        total
      },
      stats: buildStats(db),
      config: getWaitingRoomConfig()
    })
  } catch (error) {
    console.error('[WaitingRoom] 获取后台列表失败:', error)
    res.status(500).json({ error: '获取候车室列表失败' })
  }
})

router.post('/admin/entries/:id/bind-code', async (req, res) => {
  try {
    const entryId = Number.parseInt(req.params.id, 10)
    if (!Number.isFinite(entryId)) {
      return res.status(400).json({ error: '无效的候车记录 ID' })
    }

    const { codeId, code } = req.body || {}
    if (!codeId && !code) {
      return res.status(400).json({ error: '请提供要绑定的兑换码' })
    }

    const db = await getDatabase()
    const entry = fetchEntryById(db, entryId)
    if (!entry) {
      return res.status(404).json({ error: '候车记录不存在' })
    }
    if (entry.status !== 'waiting') {
      return res.status(400).json({ error: '仅能为等待中的记录绑定兑换码' })
    }
    if (entry.reservedCodeId) {
      return res.status(400).json({ error: '该记录已绑定兑换码，如需更换请先解除绑定' })
    }

    const normalizedCode = code ? String(code).trim().toUpperCase() : null
    const codeQuery = codeId
      ? 'id = ?'
      : 'UPPER(code) = ?'
    const codeParam = codeId ? [codeId] : [normalizedCode]
    const codeResult = db.exec(
      `
        SELECT id, code, is_redeemed, channel, reserved_for_entry_id
        FROM redemption_codes
        WHERE ${codeQuery}
        LIMIT 1
      `,
      codeParam
    )

    if (!codeResult.length || !codeResult[0].values.length) {
      return res.status(404).json({ error: '兑换码不存在' })
    }

    const [resolvedCodeId, resolvedCode, isRedeemed, codeChannel, reservedEntryId] = codeResult[0].values[0]

    if (isRedeemed === 1) {
      return res.status(400).json({ error: '该兑换码已被使用' })
    }

    if (codeChannel !== 'linux-do') {
      return res.status(400).json({ error: '仅支持绑定 Linux DO 渠道的兑换码' })
    }

    if (reservedEntryId && reservedEntryId !== entry.id) {
      return res.status(409).json({ error: '该兑换码已绑定其他候车记录' })
    }

    db.run(
      `
        UPDATE redemption_codes
        SET reserved_for_uid = ?,
            reserved_for_username = ?,
            reserved_for_entry_id = ?,
            reserved_at = DATETIME('now', 'localtime'),
            updated_at = DATETIME('now', 'localtime')
        WHERE id = ?
      `,
      [entry.linuxDoUid, entry.linuxDoUsername || entry.linuxDoName || null, entry.id, resolvedCodeId]
    )

    db.run(
      `
        UPDATE waiting_room_entries
        SET reserved_code_id = ?,
            reserved_code = ?,
            reserved_at = DATETIME('now', 'localtime'),
            reserved_by = ?,
            updated_at = DATETIME('now', 'localtime')
        WHERE id = ?
      `,
      [resolvedCodeId, resolvedCode, req.user?.username || null, entry.id]
    )

    saveDatabase()
    const updatedEntry = fetchEntryById(db, entry.id)

    res.json({
      message: '已绑定兑换码',
      entry: updatedEntry,
      code: {
        id: resolvedCodeId,
        code: resolvedCode
      }
    })
  } catch (error) {
    console.error('[WaitingRoom] 绑定兑换码失败:', error)
    res.status(500).json({ error: '绑定兑换码失败，请稍后再试' })
  }
})

router.post('/admin/entries/:id/redeem', async (req, res) => {
  try {
    const entryId = Number.parseInt(req.params.id, 10)
    if (!Number.isFinite(entryId)) {
      return res.status(400).json({ error: '无效的候车记录 ID' })
    }

    const db = await getDatabase()
    const entry = fetchEntryById(db, entryId)
    if (!entry) {
      return res.status(404).json({ error: '候车记录不存在' })
    }

    if (entry.status !== 'waiting') {
      return res.status(400).json({ error: '仅能为等待中的记录执行兑换' })
    }

    if (!entry.reservedCode) {
      return res.status(400).json({ error: '该记录未绑定兑换码' })
    }

    if (!entry.email || !isValidEmail(entry.email)) {
      return res.status(400).json({ error: '该记录未配置有效邮箱' })
    }

    const result = await redeemCodeInternal({
      email: entry.email,
      code: entry.reservedCode,
      channel: 'linux-do',
      redeemerUid: entry.linuxDoUid
    })

    const updatedEntry = fetchEntryById(db, entryId)
    return res.json({
      message: '兑换成功',
      entry: updatedEntry || entry,
      data: result.data
    })
  } catch (error) {
    if (error instanceof RedemptionError) {
      return res.status(error.statusCode || 400).json({
        error: error.message,
        message: error.message,
        ...(error.payload || {})
      })
    }
    console.error('[WaitingRoom] 管理员兑换失败:', error)
    return res.status(500).json({ error: '兑换失败，请稍后再试' })
  }
})

router.post('/admin/entries/:id/clear-reservation', async (req, res) => {
  try {
    const entryId = Number.parseInt(req.params.id, 10)
    if (!Number.isFinite(entryId)) {
      return res.status(400).json({ error: '无效的候车记录 ID' })
    }

    const db = await getDatabase()
    const entry = fetchEntryById(db, entryId)
    if (!entry) {
      return res.status(404).json({ error: '候车记录不存在' })
    }

    const releaseResult = releaseReservedCode(db, entry)
    if (!releaseResult.released) {
      if (releaseResult.reason === 'code_redeemed') {
        return res.status(400).json({ error: '兑换码已被使用，无法解除绑定' })
      }
      return res.status(400).json({ error: '当前记录没有绑定兑换码' })
    }

    saveDatabase()
    const updatedEntry = fetchEntryById(db, entry.id)
    res.json({ message: '已解除绑定', entry: updatedEntry })
  } catch (error) {
    console.error('[WaitingRoom] 解除兑换码失败:', error)
    res.status(500).json({ error: '解除兑换码失败，请稍后再试' })
  }
})

router.post('/admin/entries/:id/reset-cooldown', async (req, res) => {
  try {
    const entryId = Number.parseInt(req.params.id, 10)
    if (!Number.isFinite(entryId)) {
      return res.status(400).json({ error: '无效的候车记录 ID' })
    }

    const db = await getDatabase()
    const entry = fetchEntryById(db, entryId)
    if (!entry) {
      return res.status(404).json({ error: '候车记录不存在' })
    }

    if (entry.status !== 'left') {
      return res.status(400).json({ error: '仅可为已离队的成员重置冷却期' })
    }

    if (!entry.linuxDoUid) {
      return res.status(400).json({ error: '该记录缺少 Linux DO UID，无法重置冷却期' })
    }

    db.run(
      `
        INSERT INTO waiting_room_cooldown_resets (linuxdo_uid, reset_at)
        VALUES (?, DATETIME('now', 'localtime'))
        ON CONFLICT(linuxdo_uid)
        DO UPDATE SET reset_at = excluded.reset_at
      `,
      [entry.linuxDoUid]
    )

    saveDatabase()

    res.json({
      message: '冷却期已重置，该成员现在可以重新加入队列',
      entry
    })
  } catch (error) {
    console.error('[WaitingRoom] 重置冷却期失败:', error)
    res.status(500).json({ error: '重置冷却期失败，请稍后再试' })
  }
})

router.post('/admin/entries/:id/status', async (req, res) => {
  try {
    const entryId = Number.parseInt(req.params.id, 10)
    if (!Number.isFinite(entryId)) {
      return res.status(400).json({ error: '无效的候车记录 ID' })
    }
    const nextStatus = String(req.body?.status || '').trim()
    if (!VALID_STATUSES.has(nextStatus)) {
      return res.status(400).json({ error: '无效的状态' })
    }

    const db = await getDatabase()
    const entry = fetchEntryById(db, entryId)
    if (!entry) {
      return res.status(404).json({ error: '候车记录不存在' })
    }

    if (entry.status === nextStatus) {
      return res.json({ message: '状态无变化', entry })
    }

    if (nextStatus === 'waiting') {
      const releaseResult = releaseReservedCode(db, entry)
      if (!releaseResult.released && releaseResult.reason === 'code_redeemed') {
        return res.status(400).json({ error: '兑换码已使用，无法重新排队' })
      }
      db.run(
        `
          UPDATE waiting_room_entries
          SET status = 'waiting',
              boarded_at = NULL,
              left_at = NULL,
              updated_at = DATETIME('now', 'localtime')
          WHERE id = ?
        `,
        [entry.id]
      )
    } else if (nextStatus === 'boarded') {
      db.run(
        `
          UPDATE waiting_room_entries
          SET status = 'boarded',
              boarded_at = COALESCE(boarded_at, DATETIME('now', 'localtime')),
              left_at = NULL,
              updated_at = DATETIME('now', 'localtime')
          WHERE id = ?
        `,
        [entry.id]
      )
    } else if (nextStatus === 'left') {
      releaseReservedCode(db, entry)
      db.run(
        `
          UPDATE waiting_room_entries
          SET status = 'left',
              left_at = DATETIME('now', 'localtime'),
              updated_at = DATETIME('now', 'localtime')
          WHERE id = ?
        `,
        [entry.id]
      )
    }

    saveDatabase()
    const updatedEntry = fetchEntryById(db, entry.id)
    res.json({ message: '状态已更新', entry: updatedEntry })
  } catch (error) {
    console.error('[WaitingRoom] 更新状态失败:', error)
    res.status(500).json({ error: '更新候车状态失败，请稍后再试' })
  }
})

router.post('/admin/clear-queue', async (req, res) => {
  try {
    const db = await getDatabase()
    const waitingEntries = fetchWaitingEntries(db)
    if (!waitingEntries.length) {
      return res.json({ message: '当前没有等待中的用户', cleared: 0 })
    }

    waitingEntries.forEach(entry => {
      releaseReservedCode(db, entry)
      db.run(
        `
          UPDATE waiting_room_entries
          SET status = 'left',
              left_at = DATETIME('now', 'localtime'),
              updated_at = DATETIME('now', 'localtime')
          WHERE id = ?
        `,
        [entry.id]
      )
    })

    saveDatabase()
    res.json({ message: `已清空 ${waitingEntries.length} 位等待用户`, cleared: waitingEntries.length })
  } catch (error) {
    console.error('[WaitingRoom] 清空候车队列失败:', error)
    res.status(500).json({ error: '清空候车队列失败，请稍后再试' })
  }
})

export default router
