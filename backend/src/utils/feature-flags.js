import { getDatabase } from '../database/init.js'

const FEATURE_FLAG_KEYS = [
  'feature_xhs_enabled',
  'feature_xianyu_enabled',
  'feature_payment_enabled',
  'feature_open_accounts_enabled'
]

const DEFAULT_FEATURE_FLAGS = Object.freeze({
  xhs: true,
  xianyu: true,
  payment: true,
  openAccounts: true
})

const CACHE_TTL_MS = 30 * 1000
let cachedFlags = null
let cachedAt = 0

const parseBool = (value, fallback = true) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (value === undefined || value === null) return Boolean(fallback)
  const normalized = String(value).trim().toLowerCase()
  if (!normalized) return Boolean(fallback)
  return ['true', '1', 'yes', 'y', 'on'].includes(normalized)
}

const loadSystemConfigMap = (database, keys) => {
  if (!database) return new Map()
  const list = Array.isArray(keys) && keys.length ? keys : FEATURE_FLAG_KEYS
  const placeholders = list.map(() => '?').join(',')
  const result = database.exec(
    `SELECT config_key, config_value FROM system_config WHERE config_key IN (${placeholders})`,
    list
  )
  const map = new Map()
  const rows = result[0]?.values || []
  for (const row of rows) {
    map.set(String(row?.[0] ?? ''), String(row?.[1] ?? ''))
  }
  return map
}

export const invalidateFeatureFlagsCache = () => {
  cachedFlags = null
  cachedAt = 0
}

export async function getFeatureFlags(db, { forceRefresh = false } = {}) {
  const now = Date.now()
  if (!forceRefresh && cachedFlags && now - cachedAt < CACHE_TTL_MS) {
    return cachedFlags
  }

  const database = db || (await getDatabase())
  const stored = loadSystemConfigMap(database, FEATURE_FLAG_KEYS)

  const resolveEnabled = (key, fallback) => {
    if (!stored.has(key)) return Boolean(fallback)
    return parseBool(stored.get(key), fallback)
  }

  cachedFlags = {
    xhs: resolveEnabled('feature_xhs_enabled', DEFAULT_FEATURE_FLAGS.xhs),
    xianyu: resolveEnabled('feature_xianyu_enabled', DEFAULT_FEATURE_FLAGS.xianyu),
    payment: resolveEnabled('feature_payment_enabled', DEFAULT_FEATURE_FLAGS.payment),
    openAccounts: resolveEnabled('feature_open_accounts_enabled', DEFAULT_FEATURE_FLAGS.openAccounts)
  }
  cachedAt = now
  return cachedFlags
}

export const isFeatureEnabled = (flags, featureKey) => {
  const normalized = String(featureKey || '').trim()
  if (!normalized) return true
  const map = flags && typeof flags === 'object' ? flags : DEFAULT_FEATURE_FLAGS
  if (normalized === 'xhs') return Boolean(map.xhs)
  if (normalized === 'xianyu') return Boolean(map.xianyu)
  if (normalized === 'payment') return Boolean(map.payment)
  if (normalized === 'openAccounts') return Boolean(map.openAccounts)
  return true
}

