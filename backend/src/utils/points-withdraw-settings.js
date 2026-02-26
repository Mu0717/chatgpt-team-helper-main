import { getDatabase } from '../database/init.js'
import { getSystemConfigValue } from './system-config.js'

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

const parsePositiveInt = (value, fallback) => {
  const parsed = toInt(value, fallback)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

const parseNonNegativeInt = (value, fallback) => {
  const parsed = toInt(value, fallback)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return parsed
}

const readPositiveIntSetting = (database, key, fallback) => {
  const raw = getSystemConfigValue(database, key)
  if (raw == null) return fallback
  return parsePositiveInt(raw, fallback)
}

const readNonNegativeIntSetting = (database, key, fallback) => {
  const raw = getSystemConfigValue(database, key)
  if (raw == null) return fallback
  return parseNonNegativeInt(raw, fallback)
}

export const DEFAULT_WITHDRAW_RATE_POINTS = 1
export const DEFAULT_WITHDRAW_RATE_CASH_CENTS = 100
export const DEFAULT_WITHDRAW_MIN_CASH_CENTS = 1000

export async function getPointsWithdrawSettings(db) {
  const database = db || (await getDatabase())

  const ratePointsFromEnv = parsePositiveInt(process.env.WITHDRAW_RATE_POINTS, DEFAULT_WITHDRAW_RATE_POINTS)
  const rateCashCentsFromEnv = parsePositiveInt(process.env.WITHDRAW_RATE_CASH_CENTS, DEFAULT_WITHDRAW_RATE_CASH_CENTS)
  const minCashCentsFromEnv = parseNonNegativeInt(process.env.WITHDRAW_MIN_CASH_CENTS, DEFAULT_WITHDRAW_MIN_CASH_CENTS)

  const ratePoints = readPositiveIntSetting(database, 'points_withdraw_rate_points', ratePointsFromEnv)
  const rateCashCents = readPositiveIntSetting(database, 'points_withdraw_rate_cash_cents', rateCashCentsFromEnv)
  const minCashCents = readNonNegativeIntSetting(database, 'points_withdraw_min_cash_cents', minCashCentsFromEnv)

  const minPointsFromEnv = parsePositiveInt(process.env.WITHDRAW_MIN_POINTS, 0)
  const minPointsFromCash = rateCashCents > 0 ? Math.ceil((minCashCents * ratePoints) / rateCashCents) : 0
  const minPoints = Math.max(1, Math.max(minPointsFromEnv, minPointsFromCash))

  const stepPointsFromEnv = parsePositiveInt(process.env.WITHDRAW_STEP_POINTS, 0)
  const stepPoints = Math.max(1, stepPointsFromEnv > 0 ? stepPointsFromEnv : ratePoints)

  return {
    ratePoints,
    rateCashCents,
    minCashCents,
    minPoints,
    stepPoints,
  }
}
