import { getDatabase } from '../database/init.js'

const CONFIG_KEYS = ['zpay_base_url', 'zpay_pid', 'zpay_key']
const DEFAULT_ZPAY_BASE_URL = 'https://zpayz.cn'

const CACHE_TTL_MS = 60 * 1000
let cachedSettings = null
let cachedAt = 0

const normalizeBaseUrl = (value) => {
  const raw = String(value || '').trim()
  const normalized = raw.replace(/\/+$/, '')
  return normalized || DEFAULT_ZPAY_BASE_URL
}

const loadSystemConfigMap = (database, keys) => {
  if (!database) return new Map()
  const list = Array.isArray(keys) && keys.length ? keys : CONFIG_KEYS
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

export const getZpaySettingsFromEnv = () => ({
  baseUrl: normalizeBaseUrl(process.env.ZPAY_BASE_URL || DEFAULT_ZPAY_BASE_URL),
  pid: String(process.env.ZPAY_PID || '').trim(),
  key: String(process.env.ZPAY_KEY || '').trim()
})

export const invalidateZpaySettingsCache = () => {
  cachedSettings = null
  cachedAt = 0
}

export async function getZpaySettings(db, { forceRefresh = false } = {}) {
  const now = Date.now()
  if (!forceRefresh && cachedSettings && now - cachedAt < CACHE_TTL_MS) {
    return cachedSettings
  }

  const database = db || (await getDatabase())
  const stored = loadSystemConfigMap(database, CONFIG_KEYS)
  const env = getZpaySettingsFromEnv()

  const resolveString = (key, fallback) => {
    if (!stored.has(key)) return fallback
    return String(stored.get(key) ?? '')
  }

  const resolveTrimmedString = (key, fallback) => String(resolveString(key, fallback) ?? '').trim()

  const baseUrlRaw = resolveTrimmedString('zpay_base_url', env.baseUrl)
  const pid = resolveTrimmedString('zpay_pid', env.pid)
  const key = String(resolveString('zpay_key', env.key) ?? '').trim()

  cachedSettings = {
    baseUrl: normalizeBaseUrl(baseUrlRaw),
    pid,
    key,
    stored: {
      baseUrl: stored.has('zpay_base_url'),
      pid: stored.has('zpay_pid'),
      key: stored.has('zpay_key') && Boolean(String(stored.get('zpay_key') ?? '').trim())
    }
  }
  cachedAt = now
  return cachedSettings
}

