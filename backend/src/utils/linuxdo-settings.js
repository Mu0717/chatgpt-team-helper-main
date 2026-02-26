import { getDatabase } from '../database/init.js'

const OAUTH_KEYS = ['linuxdo_client_id', 'linuxdo_client_secret', 'linuxdo_redirect_uri']
const CREDIT_KEYS = ['linuxdo_credit_pid', 'linuxdo_credit_key']
const CONFIG_KEYS = [...new Set([...OAUTH_KEYS, ...CREDIT_KEYS])]

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

export const getLinuxDoOAuthSettingsFromEnv = () => ({
  clientId: String(process.env.LINUXDO_CLIENT_ID || '').trim(),
  clientSecret: String(process.env.LINUXDO_CLIENT_SECRET || ''),
  redirectUri: String(process.env.LINUXDO_REDIRECT_URI || '').trim()
})

export const getLinuxDoCreditSettingsFromEnv = () => ({
  pid: String(process.env.LINUXDO_CREDIT_PID || process.env.CREDIT_PID || '').trim(),
  key: String(process.env.LINUXDO_CREDIT_KEY || process.env.CREDIT_KEY || '')
})

export const invalidateLinuxDoSettingsCache = () => {
  cachedSettings = null
  cachedAt = 0
}

const loadLinuxDoSettingsInternal = async (db, { forceRefresh = false } = {}) => {
  const now = Date.now()
  if (!forceRefresh && cachedSettings && now - cachedAt < CACHE_TTL_MS) {
    return cachedSettings
  }

  const database = db || (await getDatabase())
  const stored = loadSystemConfigMap(database, CONFIG_KEYS)
  const envOauth = getLinuxDoOAuthSettingsFromEnv()
  const envCredit = getLinuxDoCreditSettingsFromEnv()

  const resolveString = (key, fallback) => {
    if (!stored.has(key)) return fallback
    return String(stored.get(key) ?? '')
  }

  const resolveTrimmedString = (key, fallback) => String(resolveString(key, fallback) ?? '').trim()

  const oauthClientSecret = resolveString('linuxdo_client_secret', envOauth.clientSecret)
  const creditKey = resolveString('linuxdo_credit_key', envCredit.key)

  cachedSettings = {
    oauth: {
      clientId: resolveTrimmedString('linuxdo_client_id', envOauth.clientId),
      clientSecret: oauthClientSecret,
      redirectUri: resolveTrimmedString('linuxdo_redirect_uri', envOauth.redirectUri),
      stored: {
        clientId: stored.has('linuxdo_client_id'),
        clientSecret: stored.has('linuxdo_client_secret') && Boolean(String(stored.get('linuxdo_client_secret') ?? '').trim()),
        redirectUri: stored.has('linuxdo_redirect_uri')
      }
    },
    credit: {
      pid: resolveTrimmedString('linuxdo_credit_pid', envCredit.pid),
      key: creditKey,
      stored: {
        pid: stored.has('linuxdo_credit_pid'),
        key: stored.has('linuxdo_credit_key') && Boolean(String(stored.get('linuxdo_credit_key') ?? '').trim())
      }
    }
  }
  cachedAt = now
  return cachedSettings
}

export async function getLinuxDoOAuthSettings(db, options) {
  const settings = await loadLinuxDoSettingsInternal(db, options)
  return settings.oauth
}

export async function getLinuxDoCreditSettings(db, options) {
  const settings = await loadLinuxDoSettingsInternal(db, options)
  return settings.credit
}

