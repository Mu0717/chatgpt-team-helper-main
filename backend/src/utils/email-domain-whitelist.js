import { getDatabase } from '../database/init.js'

const normalizeDomain = (value) => {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return ''
  return raw.startsWith('@') ? raw.slice(1) : raw
}

export const parseDomainWhitelist = (value) => {
  if (!value) return []
  if (Array.isArray(value)) {
    return [...new Set(value.map(normalizeDomain).filter(Boolean))]
  }
  return [...new Set(String(value).split(',').map(normalizeDomain).filter(Boolean))]
}

export const getEmailDomainWhitelistFromEnv = () =>
  parseDomainWhitelist(process.env.EMAIL_DOMAIN_WHITELIST || process.env.ALLOWED_EMAIL_DOMAINS || '')

export async function getEmailDomainWhitelist(db) {
  const database = db || (await getDatabase())
  const result = database.exec('SELECT config_value FROM system_config WHERE config_key = ? LIMIT 1', ['email_domain_whitelist'])
  const stored = result[0]?.values?.length ? String(result[0].values[0][0] || '') : ''
  return stored ? parseDomainWhitelist(stored) : getEmailDomainWhitelistFromEnv()
}

export function isEmailDomainAllowed(email, whitelistDomains) {
  const normalizedEmail = String(email ?? '').trim().toLowerCase()
  const at = normalizedEmail.lastIndexOf('@')
  if (at === -1) return false
  const domain = normalizedEmail.slice(at + 1)
  if (!domain) return false

  const whitelist = Array.isArray(whitelistDomains) ? whitelistDomains : []
  if (whitelist.length === 0) return true

  return whitelist.some((item) => {
    const normalized = normalizeDomain(item)
    if (!normalized) return false
    if (normalized.startsWith('.')) {
      const suffix = normalized.slice(1)
      return domain === suffix || domain.endsWith(normalized)
    }
    return domain === normalized
  })
}

