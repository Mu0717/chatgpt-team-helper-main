import express from 'express'
import { getTurnstileSettings } from '../utils/turnstile-settings.js'
import { getFeatureFlags } from '../utils/feature-flags.js'
import { getChannels } from '../utils/channels.js'

const router = express.Router()

const DEFAULT_TIMEZONE = 'Asia/Shanghai'
const DEFAULT_LOCALE = 'zh-CN'
const DEFAULT_OPEN_ACCOUNTS_MAINTENANCE_MESSAGE = '平台维护中'

const isEnabledFlag = (value, defaultValue = true) => {
  if (value === undefined || value === null || value === '') return Boolean(defaultValue)
  const raw = String(value).trim().toLowerCase()
  return raw !== '0' && raw !== 'false' && raw !== 'off'
}

const isOpenAccountsEnabled = () => isEnabledFlag(process.env.OPEN_ACCOUNTS_ENABLED, true)

const getOpenAccountsMaintenanceMessage = () => {
  const message = String(process.env.OPEN_ACCOUNTS_MAINTENANCE_MESSAGE || DEFAULT_OPEN_ACCOUNTS_MAINTENANCE_MESSAGE).trim()
  return message || DEFAULT_OPEN_ACCOUNTS_MAINTENANCE_MESSAGE
}

router.get('/runtime', async (req, res) => {
  try {
    const timezone = process.env.TZ || DEFAULT_TIMEZONE
    const locale = process.env.APP_LOCALE || DEFAULT_LOCALE
    const openAccountsEnabled = isOpenAccountsEnabled()
    const turnstileSettings = await getTurnstileSettings()
    const turnstileSiteKey = String(turnstileSettings.siteKey || '').trim()
    const features = await getFeatureFlags()
    const { list: channelList } = await getChannels()
    const channels = (channelList || [])
      .filter(channel => channel?.isActive)
      .map(channel => ({
        key: channel.key,
        name: channel.name,
        redeemMode: channel.redeemMode,
        allowCommonFallback: channel.allowCommonFallback,
        isActive: channel.isActive,
        isBuiltin: channel.isBuiltin,
        sortOrder: channel.sortOrder,
        createdAt: channel.createdAt,
        updatedAt: channel.updatedAt,
      }))

    res.json({
      timezone,
      locale,
      turnstileEnabled: Boolean(turnstileSettings.enabled),
      turnstileSiteKey: turnstileSiteKey || null,
      features,
      channels,
      openAccountsEnabled,
      openAccountsMaintenanceMessage: openAccountsEnabled ? null : getOpenAccountsMaintenanceMessage()
    })
  } catch (error) {
    console.error('[Config] runtime error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
