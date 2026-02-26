import { getDatabase } from '../database/init.js'
import crypto from 'crypto'

const CACHE_TTL_MS = 60 * 1000

let cachedKey = null
let cacheTimestamp = 0

const normalizeKey = (value) => (typeof value === 'string' ? value.trim() : '')

const timingSafeEqual = (a, b) => {
  const left = normalizeKey(a)
  const right = normalizeKey(b)
  if (!left || !right) return false
  const leftBuf = Buffer.from(left)
  const rightBuf = Buffer.from(right)
  if (leftBuf.length !== rightBuf.length) return false
  return crypto.timingSafeEqual(leftBuf, rightBuf)
}

async function fetchApiKeyFromDatabase() {
  const db = await getDatabase()
  const result = db.exec('SELECT config_value FROM system_config WHERE config_key = "auto_boarding_api_key"')

  if (result.length > 0 && result[0].values.length > 0) {
    return normalizeKey(result[0].values[0][0])
  }

  return normalizeKey(process.env.AUTO_BOARDING_API_KEY)
}

export async function getExpectedApiKey(forceRefresh = false) {
  const now = Date.now()

  if (!forceRefresh && cachedKey && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedKey
  }

  cachedKey = await fetchApiKeyFromDatabase()
  cacheTimestamp = now
  return cachedKey
}

export async function apiKeyAuth(req, res, next) {
  try {
    const apiKey = normalizeKey(req.headers['x-api-key'])
    const expectedApiKey = await getExpectedApiKey()

    if (!expectedApiKey) {
      return res.status(503).json({ error: 'API key 未配置，接口已禁用' })
    }

    if (!timingSafeEqual(apiKey, expectedApiKey)) {
      return res.status(401).json({ error: 'Unauthorized: Invalid API key' })
    }

    next()
  } catch (error) {
    console.error('API Key 验证失败:', error)
    res.status(500).json({ error: 'Failed to validate API key' })
  }
}
