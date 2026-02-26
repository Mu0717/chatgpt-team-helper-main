import { getDatabase } from '../database/init.js'

const CONFIG_KEYS = [
  'telegram_bot_token',
  'telegram_allowed_user_ids',
  'telegram_notify_enabled',
  'telegram_notify_chat_ids',
  'telegram_notify_timeout_ms'
]

const CACHE_TTL_MS = 60 * 1000
let cachedSettings = null
let cachedAt = 0

const parseBool = (value, fallback = true) => {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'boolean') return value
  const normalized = String(value).trim().toLowerCase()
  if (!normalized) return fallback
  return ['true', '1', 'yes', 'y', 'on'].includes(normalized)
}

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

const clampInteger = (value, { min, max, fallback }) => {
  const parsed = toInt(value, fallback)
  const normalized = Number.isFinite(parsed) ? parsed : fallback
  return Math.min(max, Math.max(min, normalized))
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

export const getTelegramSettingsFromEnv = () => ({
  token: String(process.env.TELEGRAM_BOT_TOKEN || '').trim(),
  allowedUserIds: String(process.env.TELEGRAM_ALLOWED_USER_IDS || '').trim(),
  notifyEnabled: parseBool(process.env.TELEGRAM_NOTIFY_ENABLED, true),
  notifyChatIds: String(process.env.TELEGRAM_NOTIFY_CHAT_IDS || '').trim(),
  notifyTimeoutMs: clampInteger(process.env.TELEGRAM_NOTIFY_TIMEOUT_MS, {
    min: 1000,
    max: 120000,
    fallback: 8000
  })
})

export const invalidateTelegramSettingsCache = () => {
  cachedSettings = null
  cachedAt = 0
}

export async function getTelegramSettings(db, { forceRefresh = false } = {}) {
  const now = Date.now()
  if (!forceRefresh && cachedSettings && now - cachedAt < CACHE_TTL_MS) {
    return cachedSettings
  }

  const database = db || (await getDatabase())
  const stored = loadSystemConfigMap(database, CONFIG_KEYS)
  const env = getTelegramSettingsFromEnv()

  const resolveString = (key, fallback) => {
    if (!stored.has(key)) return fallback
    return String(stored.get(key) ?? '')
  }

  const token = String(resolveString('telegram_bot_token', env.token) ?? '').trim()
  const allowedUserIds = String(resolveString('telegram_allowed_user_ids', env.allowedUserIds) ?? '').trim()
  const notifyEnabled = parseBool(resolveString('telegram_notify_enabled', env.notifyEnabled), env.notifyEnabled)
  const notifyChatIds = String(resolveString('telegram_notify_chat_ids', env.notifyChatIds) ?? '').trim()
  const notifyTimeoutMs = clampInteger(resolveString('telegram_notify_timeout_ms', env.notifyTimeoutMs), {
    min: 1000,
    max: 120000,
    fallback: env.notifyTimeoutMs
  })

  cachedSettings = {
    token,
    allowedUserIds,
    notifyEnabled,
    notifyChatIds,
    notifyTimeoutMs,
    stored: {
      token: stored.has('telegram_bot_token') && Boolean(String(stored.get('telegram_bot_token') ?? '').trim()),
      allowedUserIds: stored.has('telegram_allowed_user_ids'),
      notifyEnabled: stored.has('telegram_notify_enabled'),
      notifyChatIds: stored.has('telegram_notify_chat_ids'),
      notifyTimeoutMs: stored.has('telegram_notify_timeout_ms')
    }
  }
  cachedAt = now
  return cachedSettings
}
