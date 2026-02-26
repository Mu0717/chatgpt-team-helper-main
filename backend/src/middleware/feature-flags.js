import { getFeatureFlags, isFeatureEnabled } from '../utils/feature-flags.js'

const DEFAULT_MESSAGES = {
  xhs: '小红书功能未启用，请联系管理员',
  xianyu: '闲鱼功能未启用，请联系管理员',
  payment: '支付功能未启用，请联系管理员',
  openAccounts: '开放账号功能未启用，请联系管理员'
}

export const requireFeatureEnabled = (featureKey, options = {}) => {
  const normalized = String(featureKey || '').trim()
  const message = String(options.message || DEFAULT_MESSAGES[normalized] || '功能未启用，请联系管理员').trim()
  const code = String(options.code || 'FEATURE_DISABLED').trim() || 'FEATURE_DISABLED'

  return async (req, res, next) => {
    try {
      const flags = await getFeatureFlags()
      if (!isFeatureEnabled(flags, normalized)) {
        return res.status(403).json({
          error: message,
          code,
          feature: normalized
        })
      }
      next()
    } catch (error) {
      console.error('[FeatureFlags] check failed:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }
}

