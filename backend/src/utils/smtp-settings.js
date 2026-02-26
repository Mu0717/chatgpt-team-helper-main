import { getDatabase } from '../database/init.js'

const SMTP_CONFIG_KEYS = [
  'smtp_host',
  'smtp_port',
  'smtp_secure',
  'smtp_user',
  'smtp_pass',
  'smtp_from',
  'admin_alert_email'
]

const CACHE_TTL_MS = 60 * 1000
let cachedSettings = null
let cachedAt = 0

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function parseBool(value, fallback = false) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (value === undefined || value === null) return Boolean(fallback)
  const normalized = String(value).trim().toLowerCase()
  if (!normalized) return Boolean(fallback)
  return ['true', '1', 'yes', 'y', 'on'].includes(normalized)
}

const loadSystemConfigMap = (database, keys) => {
  if (!database) return new Map()
  const list = Array.isArray(keys) && keys.length ? keys : SMTP_CONFIG_KEYS
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

export const getSmtpSettingsFromEnv = () => {
  const host = String(process.env.SMTP_HOST || '').trim()
  const port = Math.max(1, Math.min(65535, toInt(process.env.SMTP_PORT, 465)))
  const secure = parseBool(process.env.SMTP_SECURE ?? true, true)
  const user = String(process.env.SMTP_USER || '').trim()
  const pass = String(process.env.SMTP_PASS || '')
  const from = String(process.env.SMTP_FROM || '').trim()
  const adminAlertEmail = String(process.env.ADMIN_ALERT_EMAIL || '').trim()

  return {
    smtp: { host, port, secure, user, pass, from },
    adminAlertEmail
  }
}

export const invalidateSmtpSettingsCache = () => {
  cachedSettings = null
  cachedAt = 0
}

export async function getSmtpSettings(db, { forceRefresh = false } = {}) {
  const now = Date.now()
  if (!forceRefresh && cachedSettings && now - cachedAt < CACHE_TTL_MS) {
    return cachedSettings
  }

  const database = db || (await getDatabase())
  const stored = loadSystemConfigMap(database, SMTP_CONFIG_KEYS)
  const env = getSmtpSettingsFromEnv()

  const resolveString = (key, fallback) => {
    if (!stored.has(key)) return fallback
    return String(stored.get(key) ?? '')
  }

  const resolveTrimmedString = (key, fallback) => String(resolveString(key, fallback) ?? '').trim()

  const host = resolveTrimmedString('smtp_host', env.smtp.host)

  const portRaw = stored.has('smtp_port') ? String(stored.get('smtp_port') ?? '') : null
  const portParsed = portRaw === null ? env.smtp.port : toInt(portRaw, env.smtp.port)
  const port = Math.max(1, Math.min(65535, portParsed))

  let secure = env.smtp.secure
  if (stored.has('smtp_secure')) {
    const raw = String(stored.get('smtp_secure') ?? '').trim()
    if (raw) {
      secure = parseBool(raw, env.smtp.secure)
    }
  }

  const user = resolveTrimmedString('smtp_user', env.smtp.user)
  const pass = resolveString('smtp_pass', env.smtp.pass)
  const from = resolveTrimmedString('smtp_from', env.smtp.from)
  const adminAlertEmail = resolveTrimmedString('admin_alert_email', env.adminAlertEmail)

  cachedSettings = {
    smtp: { host, port, secure, user, pass, from },
    adminAlertEmail,
    stored: {
      smtpHost: stored.has('smtp_host'),
      smtpPort: stored.has('smtp_port'),
      smtpSecure: stored.has('smtp_secure'),
      smtpUser: stored.has('smtp_user'),
      smtpPass: stored.has('smtp_pass') && Boolean(String(stored.get('smtp_pass') ?? '').trim()),
      smtpFrom: stored.has('smtp_from'),
      adminAlertEmail: stored.has('admin_alert_email')
    }
  }
  cachedAt = now
  return cachedSettings
}

