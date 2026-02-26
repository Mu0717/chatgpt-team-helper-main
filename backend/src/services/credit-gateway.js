import crypto from 'crypto'
import axios from 'axios'
import { getLinuxDoCreditSettings } from '../utils/linuxdo-settings.js'

const safeSnippet = (value, limit = 420) => {
  if (value == null) return ''
  const raw = typeof value === 'string' ? value : (() => {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  })()
  const normalized = raw.replace(/\s+/g, ' ').trim()
  if (normalized.length <= limit) return normalized
  return `${normalized.slice(0, limit)}…`
}

const md5 = (value) => crypto.createHash('md5').update(String(value), 'utf8').digest('hex')

const isCloudflareChallenge = (contentType, bodyText) => {
  const ct = String(contentType || '').toLowerCase()
  if (!ct.includes('text/html')) return false
  const text = String(bodyText || '')
  if (!text) return false
  return text.includes('Just a moment') || text.includes('_cf_chl_opt') || text.includes('challenge-platform')
}

const normalizeGatewayResponseData = (raw) => {
  if (raw == null) return { data: null, rawText: '' }
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return { data: null, rawText: '' }
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed)
        return { data: parsed, rawText: trimmed }
      } catch {
        return { data: null, rawText: trimmed }
      }
    }
    return { data: null, rawText: trimmed }
  }
  return { data: raw, rawText: '' }
}

export const buildCreditSign = (params, key) => {
  const entries = Object.entries(params || {})
    .filter(([k, v]) => {
      if (!k) return false
      if (k === 'sign' || k === 'sign_type') return false
      if (v === undefined || v === null) return false
      const str = String(v).trim()
      return str.length > 0
    })
    .sort(([a], [b]) => (a === b ? 0 : a > b ? 1 : -1))
    .map(([k, v]) => `${k}=${String(v).trim()}`)
    .join('&')

  return md5(`${entries}${key}`)
}

const parseMoney = (value) => {
  const parsed = Number.parseFloat(String(value ?? ''))
  if (!Number.isFinite(parsed)) return null
  return Math.round(parsed * 100) / 100
}

export const formatCreditMoney = (value) => {
  const parsed = parseMoney(value)
  if (parsed === null) return null
  if (parsed <= 0) return null
  return parsed.toFixed(2)
}

export const getCreditGatewayConfig = async (db, options) => {
  const creditSettings = await getLinuxDoCreditSettings(db, options)
  const pid = String(creditSettings?.pid || '').trim()
  const key = String(creditSettings?.key || '').trim()
  const baseUrlRaw = String(process.env.LINUXDO_CREDIT_BASE_URL || process.env.CREDIT_BASE_URL || 'https://credit.linux.do/epay').trim()
  const baseUrl = baseUrlRaw.replace(/\/+$/, '')
  return { pid, key, baseUrl }
}

const extractPayingOrderNo = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  try {
    const url = new URL(raw)
    return String(url.searchParams.get('order_no') || '').trim()
  } catch {
    return ''
  }
}

export const createCreditTransferService = async ({ outTradeNo, title, money, notifyUrl, returnUrl, device, timeoutMs }) => {
  const { pid, key, baseUrl } = await getCreditGatewayConfig()
  if (!pid || !key) {
    return { ok: false, error: 'missing_config' }
  }

  const amount = formatCreditMoney(money)
  if (!amount) {
    return { ok: false, error: 'invalid_money' }
  }

  const params = {
    pid,
    type: 'epay',
    out_trade_no: String(outTradeNo || '').trim(),
    name: String(title || '').trim() || 'Linux DO Credit',
    money: amount
  }

  if (notifyUrl) params.notify_url = String(notifyUrl).trim()
  if (returnUrl) params.return_url = String(returnUrl).trim()
  if (device) params.device = String(device).trim()

  const sign = buildCreditSign({ ...params, sign_type: 'MD5' }, key)
  const form = new URLSearchParams()
  Object.entries({ ...params, sign, sign_type: 'MD5' }).forEach(([k, v]) => form.append(k, String(v)))

  const requestUrl = `${baseUrl}/pay/submit.php`
  const resolvedTimeout = Number.isFinite(Number(timeoutMs)) ? Math.max(1000, Number(timeoutMs)) : 15000
  console.info('[CreditGateway] create transfer submit', {
    url: requestUrl,
    pid,
    outTradeNo: params.out_trade_no || null,
    type: params.type || null,
    name: params.name || null,
    money: params.money || null,
    notifyUrl: params.notify_url || null,
    returnUrl: params.return_url || null,
    device: params.device || null,
    signType: 'MD5',
    signPrefix: sign ? String(sign).slice(0, 8) : null,
    signLength: sign ? String(sign).length : 0,
    timeoutMs: resolvedTimeout
  })

  try {
    const response = await axios.post(`${baseUrl}/pay/submit.php`, form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: resolvedTimeout,
      maxRedirects: 0,
      validateStatus: () => true
    })

    const locationHeader = String(response?.headers?.location || '').trim()
    const payUrl = locationHeader ? new URL(locationHeader, baseUrl).toString() : ''
    const payingOrderNo = extractPayingOrderNo(payUrl)

    if (response.status >= 300 && response.status < 400 && payUrl) {
      console.info('[CreditGateway] create transfer redirected', {
        status: response.status,
        location: payUrl,
        payingOrderNo: payingOrderNo || null
      })
      return { ok: true, payUrl, amount, payingOrderNo: payingOrderNo || null }
    }

    const contentType = String(response?.headers?.['content-type'] || '')
    const normalized = normalizeGatewayResponseData(response?.data)
    const data = normalized.data
    const rawText = normalized.rawText
    const cfChallenge = isCloudflareChallenge(contentType, rawText)

    const msg = data?.error_msg
      ? String(data.error_msg)
      : data?.msg
        ? String(data.msg)
        : cfChallenge
          ? 'cloudflare_challenge'
          : rawText
            ? safeSnippet(rawText)
            : `create_failed_http_${response.status}`

    console.warn('[CreditGateway] create transfer failed', {
      status: response.status,
      contentType: contentType || null,
      message: msg,
      bodySnippet: safeSnippet(rawText || data)
    })

    return {
      ok: false,
      error: cfChallenge ? 'cf_challenge' : 'create_failed',
      status: response.status,
      contentType,
      message: msg,
      bodySnippet: safeSnippet(rawText || data)
    }
  } catch (error) {
    console.error('[CreditGateway] create transfer error', { message: error?.message || String(error) })
    return {
      ok: false,
      error: 'network_error',
      message: error?.message || String(error)
    }
  }
}

export const queryCreditOrder = async ({ tradeNo, outTradeNo }) => {
  const { pid, key, baseUrl } = await getCreditGatewayConfig()
  if (!pid || !key) {
    return { ok: false, error: 'missing_config' }
  }

  const normalizedTradeNo = String(tradeNo || '').trim()
  const normalizedOutTradeNo = String(outTradeNo || '').trim()
  if (!normalizedTradeNo && !normalizedOutTradeNo) {
    return { ok: false, error: 'missing_order_no' }
  }

  const params = {
    act: 'order',
    pid,
    key,
    ...(normalizedTradeNo ? { trade_no: normalizedTradeNo } : {}),
    ...(normalizedOutTradeNo ? { out_trade_no: normalizedOutTradeNo } : {})
  }

  try {
    const response = await axios.get(`${baseUrl}/api.php`, {
      params,
      timeout: 15000,
      validateStatus: () => true
    })

    if (response.status === 404) {
      const normalizedNotFound = normalizeGatewayResponseData(response?.data)
      return {
        ok: false,
        error: 'not_found',
        status: response.status,
        bodySnippet: safeSnippet(normalizedNotFound.rawText || normalizedNotFound.data)
      }
    }

    const contentType = String(response?.headers?.['content-type'] || '')
    const normalized = normalizeGatewayResponseData(response?.data)
    const data = normalized.data
    const rawText = normalized.rawText
    const cfChallenge = isCloudflareChallenge(contentType, rawText || response?.data)

    if (response.status !== 200) {
      return {
        ok: false,
        error: cfChallenge ? 'cf_challenge' : `http_${response.status}`,
        contentType,
        bodySnippet: safeSnippet(rawText || response?.data)
      }
    }

    if (!data || typeof data !== 'object') {
      return {
        ok: false,
        error: 'invalid_response',
        contentType,
        bodySnippet: safeSnippet(rawText || response?.data)
      }
    }

    const code = Number(data.code)
    if (code !== 1) {
      return {
        ok: false,
        error: 'query_failed',
        code,
        msg: data.msg ? String(data.msg) : '',
        data
      }
    }

    return { ok: true, data }
  } catch (error) {
    return {
      ok: false,
      error: 'network_error',
      message: error?.message || String(error)
    }
  }
}

export const refundCreditOrder = async ({ tradeNo, outTradeNo, money }) => {
  const { pid, key, baseUrl } = await getCreditGatewayConfig()
  if (!pid || !key) {
    return { ok: false, error: 'missing_config' }
  }

  const normalizedTradeNo = String(tradeNo || '').trim()
  const normalizedOutTradeNo = String(outTradeNo || '').trim()
  if (!normalizedTradeNo) {
    return { ok: false, error: 'missing_trade_no' }
  }

  const refundMoney = formatCreditMoney(money)
  if (!refundMoney) {
    return { ok: false, error: 'invalid_money' }
  }

  const form = new URLSearchParams()
  form.append('pid', pid)
  form.append('key', key)
  form.append('trade_no', normalizedTradeNo)
  form.append('money', refundMoney)
  if (normalizedOutTradeNo) {
    form.append('out_trade_no', normalizedOutTradeNo)
  }

  const requestUrl = `${baseUrl}/api.php`
  console.info('[CreditGateway] refund order request', {
    url: requestUrl,
    pid,
    tradeNo: normalizedTradeNo,
    outTradeNo: normalizedOutTradeNo || null,
    money: refundMoney
  })

  try {
    const response = await axios.post(requestUrl, form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
      validateStatus: () => true
    })

    const contentType = String(response?.headers?.['content-type'] || '')
    const normalized = normalizeGatewayResponseData(response?.data)
    const data = normalized.data
    const rawText = normalized.rawText
    const cfChallenge = isCloudflareChallenge(contentType, rawText || response?.data)

    if (response.status !== 200) {
      console.warn('[CreditGateway] refund order failed', {
        status: response.status,
        contentType: contentType || null,
        bodySnippet: safeSnippet(rawText || response?.data)
      })
      return {
        ok: false,
        error: cfChallenge ? 'cf_challenge' : `http_${response.status}`,
        contentType,
        bodySnippet: safeSnippet(rawText || response?.data)
      }
    }

    if (!data || typeof data !== 'object') {
      console.warn('[CreditGateway] refund order invalid response', {
        status: response.status,
        contentType: contentType || null,
        bodySnippet: safeSnippet(rawText || response?.data)
      })
      return {
        ok: false,
        error: 'invalid_response',
        contentType,
        bodySnippet: safeSnippet(rawText || response?.data)
      }
    }

    const code = Number(data.code)
    if (code !== 1) {
      console.warn('[CreditGateway] refund order rejected', {
        status: response.status,
        contentType: contentType || null,
        code,
        msg: data.msg ? String(data.msg) : '',
        bodySnippet: safeSnippet(rawText || data)
      })
      return {
        ok: false,
        error: 'refund_failed',
        code,
        msg: data.msg ? String(data.msg) : '',
        data
      }
    }

    console.info('[CreditGateway] refund order succeeded', {
      tradeNo: normalizedTradeNo,
      outTradeNo: normalizedOutTradeNo || null,
      money: refundMoney,
      msg: data.msg ? String(data.msg) : ''
    })
    return { ok: true, data }
  } catch (error) {
    console.error('[CreditGateway] refund order error', { message: error?.message || String(error) })
    return {
      ok: false,
      error: 'network_error',
      message: error?.message || String(error)
    }
  }
}
