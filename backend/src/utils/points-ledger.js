const toInt = (value, fallback = 0) => {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

const normalizeOptionalString = (value) => {
  if (value === undefined || value === null) return null
  const trimmed = String(value).trim()
  return trimmed ? trimmed : null
}

export const safeInsertPointsLedgerEntry = (
  db,
  { userId, deltaPoints, pointsBefore, pointsAfter, action, refType, refId, remark } = {}
) => {
  if (!db) return null

  const normalizedUserId = toInt(userId, 0)
  if (!normalizedUserId) return null

  const normalizedDelta = toInt(deltaPoints, 0)
  if (!normalizedDelta) return null

  const normalizedAction = String(action || '').trim()
  if (!normalizedAction) return null

  const before = toInt(pointsBefore, NaN)
  const after = toInt(pointsAfter, NaN)

  const resolvedBefore = Number.isFinite(before) ? before : (Number.isFinite(after) ? after - normalizedDelta : 0)
  const resolvedAfter = Number.isFinite(after) ? after : resolvedBefore + normalizedDelta

  const resolvedRefType = normalizeOptionalString(refType)
  const resolvedRefId = normalizeOptionalString(refId)
  const resolvedRemark = normalizeOptionalString(remark)

  try {
    db.run(
      `
        INSERT INTO points_ledger (
          user_id, delta_points, points_before, points_after, action,
          ref_type, ref_id, remark
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        normalizedUserId,
        normalizedDelta,
        resolvedBefore,
        resolvedAfter,
        normalizedAction,
        resolvedRefType,
        resolvedRefId,
        resolvedRemark
      ]
    )

    const row = db.exec('SELECT last_insert_rowid()')[0]?.values?.[0]
    const id = row ? Number(row[0]) : 0
    return Number.isFinite(id) && id > 0 ? id : null
  } catch (error) {
    console.warn('[PointsLedger] insert failed', error?.message || error)
    return null
  }
}

export const listUserPointsLedger = (db, { userId, limit = 20, beforeId } = {}) => {
  if (!db) return []
  const normalizedUserId = toInt(userId, 0)
  if (!normalizedUserId) return []

  const normalizedLimit = Math.min(100, Math.max(1, toInt(limit, 20)))
  const normalizedBeforeId = beforeId != null ? toInt(beforeId, 0) : 0

  const params = [normalizedUserId]
  const whereParts = ['user_id = ?']
  if (normalizedBeforeId > 0) {
    whereParts.push('id < ?')
    params.push(normalizedBeforeId)
  }
  params.push(normalizedLimit)

  const result = db.exec(
    `
      SELECT id, delta_points, points_before, points_after, action, ref_type, ref_id, remark, created_at
      FROM points_ledger
      WHERE ${whereParts.join(' AND ')}
      ORDER BY id DESC
      LIMIT ?
    `,
    params
  )

  const rows = result[0]?.values || []
  return rows.map(row => ({
    id: Number(row[0] || 0),
    deltaPoints: Number(row[1] || 0),
    pointsBefore: Number(row[2] || 0),
    pointsAfter: Number(row[3] || 0),
    action: row[4] ? String(row[4]) : '',
    refType: row[5] ? String(row[5]) : null,
    refId: row[6] ? String(row[6]) : null,
    remark: row[7] ? String(row[7]) : null,
    createdAt: row[8] ? String(row[8]) : null,
  }))
}

