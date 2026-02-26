const sessionStore = new Map()
const cleanupTimers = new Map()

function scheduleCleanup(sessionId, expiresAtMs) {
  if (cleanupTimers.has(sessionId)) {
    clearTimeout(cleanupTimers.get(sessionId))
  }

  const delay = Math.max(0, expiresAtMs - Date.now())
  const timer = setTimeout(() => {
    sessionStore.delete(sessionId)
    cleanupTimers.delete(sessionId)
  }, delay)

  if (typeof timer.unref === 'function') {
    timer.unref()
  }

  cleanupTimers.set(sessionId, timer)
}

export function setOAuthSession(sessionId, payload, ttlMs = 10 * 60 * 1000) {
  const expiresAtMs = payload.expiresAt
    ? new Date(payload.expiresAt).getTime()
    : Date.now() + ttlMs

  const record = {
    ...payload,
    expiresAt: new Date(expiresAtMs).toISOString()
  }

  sessionStore.set(sessionId, record)
  scheduleCleanup(sessionId, expiresAtMs)

  return record
}

export function getOAuthSession(sessionId) {
  const record = sessionStore.get(sessionId)
  if (!record) {
    return null
  }

  const expiresAtMs = new Date(record.expiresAt).getTime()
  if (expiresAtMs <= Date.now()) {
    sessionStore.delete(sessionId)
    if (cleanupTimers.has(sessionId)) {
      clearTimeout(cleanupTimers.get(sessionId))
      cleanupTimers.delete(sessionId)
    }
    return null
  }

  return record
}

export function deleteOAuthSession(sessionId) {
  sessionStore.delete(sessionId)
  if (cleanupTimers.has(sessionId)) {
    clearTimeout(cleanupTimers.get(sessionId))
    cleanupTimers.delete(sessionId)
  }
}
