import { getDatabase, saveDatabase } from '../database/init.js'
import { releaseOpenAccountsOrderCode } from './open-accounts-redemption.js'
import { withLocks } from '../utils/locks.js'
import { getFeatureFlags, isFeatureEnabled } from '../utils/feature-flags.js'

const LABEL = '[OrderExpirationSweeper]'

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

const isEnabled = () => {
  const raw = String(process.env.ORDER_EXPIRATION_SWEEPER_ENABLED ?? 'true').trim().toLowerCase()
  return raw !== '0' && raw !== 'false' && raw !== 'off'
}

const intervalSeconds = () => Math.max(10, toInt(process.env.ORDER_EXPIRATION_SWEEPER_INTERVAL_SECONDS, 60))
const initialDelayMs = () => Math.max(1000, toInt(process.env.ORDER_EXPIRATION_SWEEPER_INITIAL_DELAY_MS, 30_000))

const purchaseExpireMinutes = () => Math.max(5, toInt(process.env.PURCHASE_ORDER_EXPIRE_MINUTES, 15))
const creditExpireMinutes = () => Math.max(5, toInt(process.env.CREDIT_ORDER_EXPIRE_MINUTES, 15))

const cleanupExpiredPurchaseOrders = (db, expireMinutes) => {
  if (!db) return { expired: 0, released: 0 }

  const threshold = `-${Math.max(5, expireMinutes)} minutes`
  const result = db.exec(
    `
      SELECT order_no, code_id
      FROM purchase_orders
      WHERE paid_at IS NULL
        AND status IN ('created', 'pending_payment')
        AND created_at <= DATETIME('now', 'localtime', ?)
    `,
    [threshold]
  )

  const rows = result[0]?.values || []
  if (!rows.length) return { expired: 0, released: 0 }

  let released = 0
  for (const row of rows) {
    const orderNo = row[0]
    const codeId = row[1]
    db.run(
      `UPDATE purchase_orders SET status = 'expired', updated_at = DATETIME('now', 'localtime') WHERE order_no = ? AND paid_at IS NULL`,
      [orderNo]
    )
    if (codeId) {
      db.run(
        `
          UPDATE redemption_codes
          SET reserved_for_order_no = NULL,
              reserved_for_order_email = NULL,
              reserved_at = NULL,
              updated_at = DATETIME('now', 'localtime')
          WHERE id = ?
            AND is_redeemed = 0
            AND reserved_for_order_no = ?
        `,
        [codeId, orderNo]
      )
      released += 1
    }
  }

  return { expired: rows.length, released }
}

const cleanupExpiredCreditOrders = (db, expireMinutes) => {
  if (!db) return { expired: 0, released: 0 }

  const threshold = `-${Math.max(5, expireMinutes)} minutes`
  const result = db.exec(
    `
      SELECT order_no
      FROM credit_orders
      WHERE paid_at IS NULL
        AND status IN ('created', 'pending_payment')
        AND created_at <= DATETIME('now', 'localtime', ?)
    `,
    [threshold]
  )

  const rows = result[0]?.values || []
  if (!rows.length) return { expired: 0, released: 0 }

  let released = 0
  for (const row of rows) {
    const orderNo = row[0]
    db.run(
      `UPDATE credit_orders SET status = 'expired', updated_at = DATETIME('now', 'localtime') WHERE order_no = ? AND paid_at IS NULL`,
      [orderNo]
    )
    releaseOpenAccountsOrderCode(db, orderNo)
    released += 1
  }

  return { expired: rows.length, released }
}

export const startOrderExpirationSweeper = () => {
  if (!isEnabled()) {
    console.log(`${LABEL} disabled`)
    return () => {}
  }

  let running = false
  const runOnce = async () => {
    if (running) return
    running = true

    try {
      const db = await getDatabase()
      const features = await getFeatureFlags()
      const paymentEnabled = isFeatureEnabled(features, 'payment')
      const openAccountsEnabled = isFeatureEnabled(features, 'openAccounts')
      const purchaseExpire = purchaseExpireMinutes()
      const creditExpire = creditExpireMinutes()

      let purchaseOutcome = { expired: 0, released: 0 }
      let creditOutcome = { expired: 0, released: 0 }

      try {
        if (paymentEnabled) {
          await withLocks(['purchase'], async () => {
            purchaseOutcome = cleanupExpiredPurchaseOrders(db, purchaseExpire)
          })
        }
      } catch (error) {
        console.warn(`${LABEL} cleanup purchase orders failed`, { message: error?.message || String(error) })
      }

      try {
        if (openAccountsEnabled) {
          creditOutcome = cleanupExpiredCreditOrders(db, creditExpire)
        }
      } catch (error) {
        console.warn(`${LABEL} cleanup credit orders failed`, { message: error?.message || String(error) })
      }

      const changed = purchaseOutcome.expired > 0 || purchaseOutcome.released > 0 || creditOutcome.expired > 0 || creditOutcome.released > 0
      if (changed) {
        await saveDatabase()
        console.log(`${LABEL} expired orders cleaned`, {
          purchaseExpired: purchaseOutcome.expired,
          purchaseReleased: purchaseOutcome.released,
          creditExpired: creditOutcome.expired,
          creditReleased: creditOutcome.released
        })
      }
    } catch (error) {
      console.error(`${LABEL} run failed`, { message: error?.message || String(error) })
    } finally {
      running = false
    }
  }

  const delay = initialDelayMs()
  const interval = intervalSeconds()

  const initialTimer = setTimeout(() => {
    void runOnce()
  }, delay)

  const intervalTimer = setInterval(() => {
    void runOnce()
  }, interval * 1000)

  console.log(`${LABEL} started`, {
    intervalSeconds: interval,
    initialDelayMs: delay,
    purchaseExpireMinutes: purchaseExpireMinutes(),
    creditExpireMinutes: creditExpireMinutes()
  })

  return () => {
    clearTimeout(initialTimer)
    clearInterval(intervalTimer)
  }
}
