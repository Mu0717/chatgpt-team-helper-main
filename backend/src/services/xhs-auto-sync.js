import { getXhsConfig, recordXhsSyncResult, syncOrdersFromApi } from './xhs-orders.js'
import { isXhsSyncing, setXhsSyncing } from './xhs-sync-runner.js'
import { sendTelegramBotNotification } from './telegram-notifier.js'
import { getFeatureFlags, isFeatureEnabled } from '../utils/feature-flags.js'

const LABEL = '[XhsAutoSync]'
const DEFAULT_CHECK_INTERVAL_SECONDS = 60
const MIN_CHECK_INTERVAL_SECONDS = 15
const MAX_CHECK_INTERVAL_SECONDS = 3600

const DEFAULT_SYNC_INTERVAL_HOURS = 6
const MIN_SYNC_INTERVAL_HOURS = 1
const MAX_SYNC_INTERVAL_HOURS = 48

const SYNC_OVERLAP_MINUTES = 10

let schedulerTimer = null
let jobInProgress = false
let lastResult = null

function parseBool(value, defaultValue = true) {
  if (value === undefined || value === null) return defaultValue
  if (typeof value === 'boolean') return value
  return ['true', '1', 'yes', 'y', 'on'].includes(String(value).toLowerCase())
}

function clampInteger(value, { min, max, fallback }) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  const normalized = Number.isFinite(parsed) ? parsed : fallback
  return Math.min(max, Math.max(min, normalized))
}

function parseLocalDateTimeToMs(value) {
  if (!value) return null
  const text = String(value).trim()
  if (!text) return null
  const normalized = text.includes('T') ? text : text.replace(' ', 'T')
  const parsed = Date.parse(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

async function runAutoSyncJob(source = 'scheduler') {
  if (jobInProgress) {
    return { success: false, skipped: true, reason: 'job_in_progress' }
  }

  const startedAt = new Date().toISOString()
  jobInProgress = true

  try {
    const features = await getFeatureFlags()
    if (!isFeatureEnabled(features, 'xhs')) {
      lastResult = { success: true, skipped: true, reason: 'feature_disabled', source, startedAt, finishedAt: new Date().toISOString() }
      return lastResult
    }

    const config = await getXhsConfig()

    if (!config?.syncEnabled) {
      lastResult = { success: true, skipped: true, reason: 'disabled', source, startedAt, finishedAt: new Date().toISOString() }
      return lastResult
    }

    if (!config?.authorization || !config?.cookies) {
      lastResult = {
        success: false,
        skipped: true,
        reason: 'missing_credentials',
        source,
        startedAt,
        finishedAt: new Date().toISOString()
      }
      return lastResult
    }

    const intervalHours = clampInteger(config.syncIntervalHours, {
      min: MIN_SYNC_INTERVAL_HOURS,
      max: MAX_SYNC_INTERVAL_HOURS,
      fallback: DEFAULT_SYNC_INTERVAL_HOURS
    })
    const intervalMs = intervalHours * 60 * 60 * 1000
    const nowMs = Date.now()

    const lastSyncMs = parseLocalDateTimeToMs(config.lastSyncAt)
    if (lastSyncMs && nowMs - lastSyncMs < intervalMs) {
      lastResult = { success: true, skipped: true, reason: 'not_due', source, startedAt, finishedAt: new Date().toISOString() }
      return lastResult
    }

    if (isXhsSyncing()) {
      lastResult = { success: true, skipped: true, reason: 'sync_in_progress', source, startedAt, finishedAt: new Date().toISOString() }
      return lastResult
    }

    setXhsSyncing(true)
    try {
      const overlapMs = SYNC_OVERLAP_MINUTES * 60 * 1000
      const startTime = lastSyncMs ? Math.max(0, lastSyncMs - overlapMs) : undefined
      const endTime = nowMs + overlapMs

      console.log(`${LABEL} running`, { intervalHours, startTime, endTime })

      const syncResult = await syncOrdersFromApi({
        authorization: config.authorization,
        cookies: config.cookies,
        extraHeaders: config.extraHeaders || {},
        startTime,
        endTime,
      })

      await recordXhsSyncResult({ success: true })

      lastResult = {
        success: true,
        skipped: false,
        source,
        startedAt,
        finishedAt: new Date().toISOString(),
        result: {
          created: syncResult.created,
          skipped: syncResult.skipped,
          totalFetched: syncResult.totalFetched,
          totalInApi: syncResult.totalInApi,
          pagesFetched: syncResult.pagesFetched,
        },
      }

      console.log(`${LABEL} done`, lastResult.result)

      if (Number(syncResult.created || 0) > 0) {
        await sendTelegramBotNotification(
          [
            '✅ 小红书自动同步完成',
            `新增：${syncResult.created || 0}`,
            `跳过：${syncResult.skipped || 0}`,
            `抓取：${syncResult.totalFetched || 0}`,
          ].join('\n')
        ).catch(() => {})
      }

      return lastResult
    } catch (error) {
      const message = error?.message || '同步失败'
      await recordXhsSyncResult({ success: false, error: message }).catch(() => {})
      lastResult = {
        success: false,
        skipped: false,
        source,
        startedAt,
        finishedAt: new Date().toISOString(),
        error: message,
      }
      console.error(`${LABEL} failed`, { message })

      await sendTelegramBotNotification(
        [
          '❌ 小红书自动同步失败',
          `原因：${message}`
        ].join('\n')
      ).catch(() => {})

      return lastResult
    } finally {
      setXhsSyncing(false)
    }
  } finally {
    jobInProgress = false
  }
}

function scheduleNextRun(intervalMs) {
  if (schedulerTimer) {
    clearTimeout(schedulerTimer)
    schedulerTimer = null
  }

  schedulerTimer = setTimeout(async () => {
    await runAutoSyncJob('scheduler')
    scheduleNextRun(intervalMs)
  }, intervalMs)

  schedulerTimer.unref?.()
}

export function startXhsAutoSyncScheduler() {
  if (!parseBool(process.env.XHS_AUTO_SYNC_SCHEDULER_ENABLED, true)) {
    console.log(`${LABEL} disabled (XHS_AUTO_SYNC_SCHEDULER_ENABLED=false)`)
    return
  }

  const checkIntervalSeconds = clampInteger(process.env.XHS_AUTO_SYNC_CHECK_INTERVAL_SECONDS, {
    min: MIN_CHECK_INTERVAL_SECONDS,
    max: MAX_CHECK_INTERVAL_SECONDS,
    fallback: DEFAULT_CHECK_INTERVAL_SECONDS
  })
  const intervalMs = checkIntervalSeconds * 1000

  console.log(`${LABEL} started`, { checkIntervalSeconds })
  runAutoSyncJob('startup').catch(() => {})
  scheduleNextRun(intervalMs)
}

export function getXhsAutoSyncState() {
  return {
    jobInProgress,
    lastResult,
  }
}

export async function runXhsAutoSyncNow() {
  return runAutoSyncJob('manual')
}
