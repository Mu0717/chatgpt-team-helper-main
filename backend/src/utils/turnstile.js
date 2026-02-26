import axios from 'axios'
import { getTurnstileSettings } from './turnstile-settings.js'

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

const getTurnstileSecret = async (db, options) => {
  const settings = await getTurnstileSettings(db, options)
  return String(settings?.secretKey || '').trim()
}

export const isTurnstileEnabled = async (db, options) => {
  const settings = await getTurnstileSettings(db, options)
  return Boolean(settings?.enabled)
}

export const verifyTurnstileToken = async (token = '', remoteIp = '') => {
  const secret = await getTurnstileSecret()
  if (!secret) {
    return { success: true, errorCodes: [] }
  }

  const normalizedToken = String(token || '').trim()
  if (!normalizedToken) {
    return { success: false, errorCodes: ['missing-input-response'] }
  }

  try {
    const params = new URLSearchParams()
    params.append('secret', secret)
    params.append('response', normalizedToken)
    if (remoteIp) {
      params.append('remoteip', remoteIp)
    }

    const response = await axios.post(
      TURNSTILE_VERIFY_URL,
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: Number.parseInt(process.env.TURNSTILE_TIMEOUT_MS || '5000', 10) || 5000
      }
    )

    const data = response.data || {}
    return {
      success: Boolean(data.success),
      errorCodes: data['error-codes'] || [],
      action: data.action,
      cdata: data.cdata
    }
  } catch (error) {
    console.error('[Turnstile] 验证请求失败:', error?.response?.data || error.message || error)
    return { success: false, errorCodes: ['verification-error'] }
  }
}
