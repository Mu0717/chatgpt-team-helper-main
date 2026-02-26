import axios from 'axios'
import { getTelegramSettings } from '../utils/telegram-settings.js'
import { getDatabase } from '../database/init.js'

const LABEL = '[Telegram Notify]'
const TELEGRAM_API_BASE_URL = 'https://api.telegram.org'
const TELEGRAM_TEXT_LIMIT = 3900

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

const parseChatIds = (value) => {
  const raw = String(value || '')
  return raw
    .split(',')
    .map(id => String(id || '').trim())
    .filter(Boolean)
}

const normalizeMessage = (value) => {
  const text = typeof value === 'string' ? value : (value != null ? String(value) : '')
  const trimmed = text.trim()
  if (!trimmed) return ''
  if (trimmed.length <= TELEGRAM_TEXT_LIMIT) return trimmed
  return `${trimmed.slice(0, TELEGRAM_TEXT_LIMIT)}…`
}

const fetchSuperAdminTelegramChatIds = async (db) => {
  const database = db || (await getDatabase())
  try {
    const result = database.exec(
      `
        SELECT DISTINCT u.telegram_id
        FROM users u
        JOIN user_roles ur ON ur.user_id = u.id
        JOIN roles r ON r.id = ur.role_id
        WHERE TRIM(COALESCE(u.telegram_id, '')) != ''
          AND r.role_key = 'super_admin'
        ORDER BY u.id ASC
      `
    )
    const rows = result[0]?.values || []
    return rows
      .map(row => String(row?.[0] ?? '').trim())
      .filter(Boolean)
  } catch (error) {
    console.warn(`${LABEL} fallback recipients query failed`, { message: error?.message || String(error) })
    return []
  }
}

const resolveRecipients = async (settings, { overrideChatIds, db } = {}) => {
  const chatIdsRaw =
    overrideChatIds !== undefined
      ? overrideChatIds
      : (String(settings?.notifyChatIds || '').trim() || String(settings?.allowedUserIds || '').trim())
  const parsed = parseChatIds(chatIdsRaw)

  if (parsed.length > 0) return parsed
  // If callers explicitly provided chatIds (even empty), don't fallback.
  if (overrideChatIds !== undefined) return []

  return fetchSuperAdminTelegramChatIds(db)
}

export async function sendTelegramBotNotification(message, { db = null, chatIds } = {}) {
  const settings = await getTelegramSettings(db, { forceRefresh: false })
  if (!settings?.notifyEnabled) {
    return { ok: false, skipped: true, reason: 'disabled' }
  }
  const token = String(settings?.token || '').trim()
  if (!token) {
    console.warn(`${LABEL} token missing, skipped`)
    return { ok: false, skipped: true, reason: 'missing_token' }
  }

  const recipients = await resolveRecipients(settings, { overrideChatIds: chatIds, db })
  if (recipients.length === 0) {
    console.warn(`${LABEL} recipients missing, skipped`)
    return { ok: false, skipped: true, reason: 'missing_recipients' }
  }

  const text = normalizeMessage(message)
  if (!text) {
    return { ok: false, skipped: true, reason: 'empty_message' }
  }

  const timeoutMs = Math.max(1000, toInt(settings?.notifyTimeoutMs, 8000))
  const client = axios.create({
    baseURL: `${TELEGRAM_API_BASE_URL}/bot${token}`,
    timeout: timeoutMs,
    validateStatus: () => true
  })

  const results = await Promise.allSettled(
    recipients.map(chatId =>
      client.post('/sendMessage', {
        chat_id: chatId,
        text,
        disable_web_page_preview: true
      })
    )
  )

  const failures = []
  let sent = 0
  results.forEach((result, index) => {
    const chatId = recipients[index]
    if (result.status !== 'fulfilled') {
      failures.push({ chatId, error: result.reason?.message || String(result.reason) })
      return
    }
    const response = result.value
    const ok = Boolean(response?.data?.ok)
    if (ok) {
      sent += 1
      return
    }
    failures.push({
      chatId,
      status: response?.status,
      description: response?.data?.description || response?.statusText || 'send_failed'
    })
  })

  if (sent === 0) {
    console.warn(`${LABEL} send failed`, { failures: failures.slice(0, 3), totalFailures: failures.length })
    return { ok: false, sent, failed: failures.length, failures }
  }

  if (failures.length > 0) {
    console.warn(`${LABEL} partial failure`, { sent, failed: failures.length })
  }

  return { ok: true, sent, failed: failures.length }
}
