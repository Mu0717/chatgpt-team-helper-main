import { getDatabase } from '../database/init.js'

const CONFIG_KEYS = ['turnstile_secret_key', 'turnstile_site_key']

const CACHE_TTL_MS = 60 * 1000
let cachedSettings = null
let cachedAt = 0

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

export const getTurnstileSettingsFromEnv = () => {
  const secretKey = String(
    process.env.CLOUDFLARE_TURNSTILE_SECRET ||
      process.env.TURNSTILE_SECRET_KEY ||
      ''
  ).trim()
  const siteKey = String(
    process.env.TURNSTILE_SITE_KEY ||
      process.env.CLOUDFLARE_TURNSTILE_SITE_KEY ||
      process.env.VITE_TURNSTILE_SITE_KEY ||
      ''
  ).trim()
  return { secretKey, siteKey }
}

export const invalidateTurnstileSettingsCache = () => {
  cachedSettings = null
  cachedAt = 0
}

export async function getTurnstileSettings(db, { forceRefresh = false } = {}) {
  const now = Date.now()
  if (!forceRefresh && cachedSettings && now - cachedAt < CACHE_TTL_MS) {
    return cachedSettings
  }

  const database = db || (await getDatabase())
  const stored = loadSystemConfigMap(database, CONFIG_KEYS)
  const env = getTurnstileSettingsFromEnv()

  const resolveString = (key, fallback) => {
    if (!stored.has(key)) return fallback
    return String(stored.get(key) ?? '')
  }

  const secretKey = String(resolveString('turnstile_secret_key', env.secretKey) ?? '').trim()
  const siteKey = String(resolveString('turnstile_site_key', env.siteKey) ?? '').trim()

  cachedSettings = {
    secretKey,
    siteKey,
    enabled: Boolean(secretKey && siteKey),
    stored: {
      secretKey: stored.has('turnstile_secret_key') && Boolean(String(stored.get('turnstile_secret_key') ?? '').trim()),
      siteKey: stored.has('turnstile_site_key') && Boolean(String(stored.get('turnstile_site_key') ?? '').trim())
    }
  }
  cachedAt = now
  return cachedSettings
}

