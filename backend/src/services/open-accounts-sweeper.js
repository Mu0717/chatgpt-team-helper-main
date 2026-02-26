import { getDatabase, saveDatabase } from '../database/init.js'
import { withLocks } from '../utils/locks.js'
import { formatProxyForLog, loadProxyList } from '../utils/proxy.js'
import { AccountSyncError, deleteAccountUser, fetchAccountUsersList, syncAccountInviteCount, syncAccountUserCount } from './account-sync.js'
import { sendOpenAccountsSweeperReportEmail } from './email-service.js'
import { getFeatureFlags, isFeatureEnabled } from '../utils/feature-flags.js'

const DEFAULT_INTERVAL_HOURS = 1
const DEFAULT_MAX_JOINED = 6
const DEFAULT_CREATED_WITHIN_DAYS = 15

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

const isEnabled = () => {
  const raw = String(process.env.OPEN_ACCOUNTS_SWEEPER_ENABLED ?? 'true').trim().toLowerCase()
  return raw !== '0' && raw !== 'false' && raw !== 'off'
}

const isEnabledFlag = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === '') return Boolean(defaultValue)
  const raw = String(value).trim().toLowerCase()
  return raw !== '0' && raw !== 'false' && raw !== 'off'
}

const runOnStartup = () => isEnabledFlag(process.env.OPEN_ACCOUNTS_SWEEPER_RUN_ON_STARTUP, false)

// 间隔小时数，默认1小时
const intervalHours = () => Math.max(1, toInt(process.env.OPEN_ACCOUNTS_SWEEPER_INTERVAL_HOURS, DEFAULT_INTERVAL_HOURS))
const maxJoined = () => Math.max(0, toInt(process.env.OPEN_ACCOUNTS_MAX_JOINED, DEFAULT_MAX_JOINED))
const concurrency = () => Math.max(1, toInt(process.env.OPEN_ACCOUNTS_SWEEPER_CONCURRENCY, 3))
const createdWithinDays = () => Math.max(0, toInt(process.env.OPEN_ACCOUNTS_SWEEPER_CREATED_WITHIN_DAYS, DEFAULT_CREATED_WITHIN_DAYS))

const parseTime = (value) => {
  const time = Date.parse(String(value || ''))
  return Number.isFinite(time) ? time : 0
}

const fetchAllStandardUsers = async (accountId, { proxy } = {}) => {
  const limit = 100
  let offset = 0
  let total = null
  const items = []

  while (total === null || items.length < total) {
    const page = await fetchAccountUsersList(accountId, { userListParams: { offset, limit, query: '' }, proxy })
    total = typeof page.total === 'number' ? page.total : items.length
    items.push(...(page.items || []))
    if (!page.items || page.items.length === 0) break
    offset += page.items.length
    if (offset > 2000) break
  }

  return (items || []).filter(item => String(item.role || '').toLowerCase() === 'standard-user')
}

const enforceAccountCapacity = async (accountId, { maxJoinedCount, proxy } = {}) => {
  // Sync joined count first; the API's total is authoritative.
  const { account } = await syncAccountUserCount(accountId, { userListParams: { offset: 0, limit: 1, query: '' }, proxy })
  const joined = Number(account?.userCount || 0)

  if (joined <= maxJoinedCount) {
    // Still refresh invite count so card page stays reasonably up to date.
    await syncAccountInviteCount(accountId, { inviteListParams: { offset: 0, limit: 1, query: '' }, proxy })
    return { kicked: 0, joined }
  }

  const candidates = await fetchAllStandardUsers(accountId, { proxy })
  if (candidates.length === 0) {
    await syncAccountInviteCount(accountId, { inviteListParams: { offset: 0, limit: 1, query: '' }, proxy })
    return { kicked: 0, joined, reason: 'no_standard_users' }
  }

  const sortedByJoinTimeDesc = [...candidates].sort((a, b) => parseTime(b.created_time) - parseTime(a.created_time))
  const toKick = sortedByJoinTimeDesc.slice(0, Math.max(0, joined - maxJoinedCount))

  let kicked = 0
  for (const user of toKick) {
    try {
      await deleteAccountUser(accountId, user.id, { userListParams: { offset: 0, limit: 1, query: '' }, proxy })
      const email = String(user.email || '').trim().toLowerCase()
	      if (email) {
	        const db = await getDatabase()
	        db.run(
	          `
	            UPDATE linuxdo_users
	            SET current_open_account_id = NULL,
	                current_open_account_email = NULL,
	                updated_at = DATETIME('now', 'localtime')
	            WHERE current_open_account_id = ?
	              AND (lower(email) = ? OR lower(current_open_account_email) = ?)
	          `,
	          [accountId, email, email]
	        )
	        saveDatabase()
	      }
      kicked += 1
    } catch (error) {
      const status = error instanceof AccountSyncError ? error.status : undefined
      console.warn('[OpenAccountsSweeper] kick failed', { accountId, userId: user?.id, status, message: error?.message || String(error) })
      break
    }
  }

  // Refresh counts for card page after kicking.
  const { account: updatedAccount } = await syncAccountUserCount(accountId, { userListParams: { offset: 0, limit: 1, query: '' }, proxy })
  await syncAccountInviteCount(accountId, { inviteListParams: { offset: 0, limit: 1, query: '' }, proxy })

  return { kicked, joined: Number(updatedAccount?.userCount || 0) }
}

export const startOpenAccountsOvercapacitySweeper = () => {
  if (!isEnabled()) {
    console.log('[OpenAccountsSweeper] disabled')
    return () => {}
  }

  let running = false
  const runOnce = async () => {
    if (running) return
    running = true
    const startedAt = new Date()
    try {
      const features = await getFeatureFlags()
      if (!isFeatureEnabled(features, 'openAccounts')) return

      const db = await getDatabase()
	      const windowDays = createdWithinDays()
	      const result = windowDays > 0
	        ? db.exec(
	            `SELECT id, email FROM gpt_accounts WHERE is_open = 1 AND COALESCE(is_banned, 0) = 0 AND created_at >= DATETIME('now', 'localtime', ?)`,
	            [`-${windowDays} days`]
	          )
	        : db.exec('SELECT id, email FROM gpt_accounts WHERE is_open = 1 AND COALESCE(is_banned, 0) = 0')
      const accountRows = (result[0]?.values || [])
        .map(row => {
          const id = Number(row[0])
          const email = String(row[1] || '')
          const emailPrefix = email.split('@')[0] || ''
          return Number.isFinite(id) ? { id, emailPrefix } : null
        })
        .filter(Boolean)
      if (accountRows.length === 0) return

      const max = maxJoined()
      const workerCount = Math.min(concurrency(), accountRows.length)
      const queue = [...accountRows]
      const proxies = loadProxyList()
      let proxyCursor = 0
      const pickProxy = () => (proxies.length ? proxies[(proxyCursor++) % proxies.length] : null)
      const results = []
      const failures = []
      let totalKicked = 0

      const worker = async () => {
        while (queue.length > 0) {
          const item = queue.shift()
          if (!item) return
          const { id, emailPrefix } = item
          const proxyEntry = pickProxy()
          const proxy = proxyEntry?.url || null
          const proxyLabel = proxyEntry ? formatProxyForLog(proxyEntry.url) : null
          await withLocks([`acct:${id}`], async () => {
            try {
              const outcome = await enforceAccountCapacity(id, { maxJoinedCount: max, proxy })
              const kicked = Number(outcome?.kicked || 0)
              const joined = Number(outcome?.joined || 0)
              const didKick = kicked > 0
              totalKicked += kicked
              results.push({
                accountId: id,
                emailPrefix,
                joined,
                didKick,
                kicked,
                note: outcome?.reason === 'no_standard_users' ? '无可踢用户' : (kicked ? '超员已处理' : '')
              })
              if (kicked) console.log('[OpenAccountsSweeper] kicked', { accountId: id, count: kicked })
            } catch (error) {
              console.error('[OpenAccountsSweeper] sweep error', {
                accountId: id,
                proxy: proxyLabel,
                message: error?.message || String(error)
              })
              failures.push({ accountId: id, emailPrefix, error: error?.message || String(error) })
            }
          })
        }
      }

      await Promise.all(Array.from({ length: workerCount }, worker))

      const finishedAt = new Date()

      // 按邮箱名称排序
      results.sort((a, b) => (a.emailPrefix || '').localeCompare(b.emailPrefix || ''))
      failures.sort((a, b) => (a.emailPrefix || '').localeCompare(b.emailPrefix || ''))

      try {
        await sendOpenAccountsSweeperReportEmail({
          startedAt,
          finishedAt,
          maxJoined: max,
          scanCreatedWithinDays: windowDays,
          scannedCount: accountRows.length,
          totalKicked,
          results,
          failures
        })
      } catch (error) {
        console.warn('[OpenAccountsSweeper] send email failed', error?.message || error)
      }
    } finally {
      running = false
    }
  }

  // 计算下一个整点执行时间
  const getNextScheduledTime = () => {
    const now = new Date()
    const hours = intervalHours()
    // 计算下一个整点（基于间隔小时数）
    const currentHour = now.getHours()
    // 找到下一个符合间隔的整点小时
    const nextHour = Math.ceil((currentHour + 1) / hours) * hours
    const next = new Date(now)
    next.setHours(nextHour % 24, 0, 0, 0)
    // 如果计算出的时间已经过了，加一天
    if (next <= now) {
      next.setDate(next.getDate() + 1)
      next.setHours(0, 0, 0, 0)
    }
    return next
  }

  // 调度下一次执行
  let scheduledTimer = null
  const scheduleNext = () => {
    const nextTime = getNextScheduledTime()
    const delay = nextTime.getTime() - Date.now()
    console.log('[OpenAccountsSweeper] next run scheduled at', nextTime.toISOString(), `(in ${Math.round(delay / 1000 / 60)} minutes)`)
    scheduledTimer = setTimeout(async () => {
      await runOnce()
      scheduleNext()
    }, delay)
  }

  // 直接开始整点调度，不在启动时执行
  scheduleNext()

  if (runOnStartup()) {
    runOnce().catch(error => {
      console.warn('[OpenAccountsSweeper] startup run failed', error?.message || error)
    })
  }

  console.log('[OpenAccountsSweeper] started', {
    intervalHours: intervalHours(),
    maxJoined: maxJoined(),
    concurrency: concurrency(),
    runOnStartup: runOnStartup(),
    createdWithinDays: createdWithinDays()
  })

  return () => {
    if (scheduledTimer) clearTimeout(scheduledTimer)
  }
}
