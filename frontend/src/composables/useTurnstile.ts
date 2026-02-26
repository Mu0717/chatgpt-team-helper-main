import { storeToRefs } from 'pinia'
import { useAppConfigStore } from '@/stores/appConfig'

const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const FALLBACK_TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim()
type TurnstileWidgetSize = 'invisible' | 'compact' | 'normal' | 'flexible'
const VALID_WIDGET_SIZES = new Set<TurnstileWidgetSize>(['invisible', 'compact', 'normal', 'flexible'])
const SKIP_WIDGET_SIZE_VALUES = new Set(['managed', 'auto', ''])
const DEFAULT_WIDGET_SIZE: TurnstileWidgetSize = 'invisible'
const TURNSTILE_EXECUTE_TIMEOUT_MS = 25000

const resolveTurnstileSize = (): TurnstileWidgetSize | null => {
  const rawValue = (import.meta.env.VITE_TURNSTILE_WIDGET_SIZE ?? '').trim().toLowerCase()
  if (SKIP_WIDGET_SIZE_VALUES.has(rawValue)) {
    return rawValue ? null : DEFAULT_WIDGET_SIZE
  }
  if (VALID_WIDGET_SIZES.has(rawValue as TurnstileWidgetSize)) {
    return rawValue as TurnstileWidgetSize
  }
  return DEFAULT_WIDGET_SIZE
}

const TURNSTILE_WIDGET_SIZE = resolveTurnstileSize()

type ExecuteOptions = {
  action?: string
  cData?: string
}

type PendingHandlers = {
  resolve: (token: string) => void
  reject: (error: Error) => void
} | null

type InternalTurnstileRenderOptions = {
  sitekey: string
  callback?: (token: string) => void
  'error-callback'?: () => void
  'expired-callback'?: () => void
  action?: string
  cData?: string
  size?: TurnstileWidgetSize
}

let scriptLoadingPromise: Promise<void> | null = null
let widgetId: string | null = null
let widgetContainer: HTMLDivElement | null = null
let pendingHandlers: PendingHandlers = null
let activeSiteKey: string | null = null

const createTurnstileError = (message: string) => {
  const error = new Error(message)
  error.name = 'TurnstileError'
  return error
}

const loadTurnstileScript = async () => {
  if (typeof window === 'undefined') {
    return
  }

  if (window.turnstile) {
    return
  }

  if (!scriptLoadingPromise) {
    scriptLoadingPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = TURNSTILE_SCRIPT_SRC
      script.async = true
      script.defer = true
      script.onload = () => resolve()
      script.onerror = () => {
        scriptLoadingPromise = null
        reject(createTurnstileError('无法加载人机验证脚本，请稍后再试'))
      }
      document.head.appendChild(script)
    })
  }

  return scriptLoadingPromise
}

const ensureTurnstileWidget = async (siteKey: string) => {
  if (!siteKey || typeof window === 'undefined') {
    return null
  }

  await loadTurnstileScript()

  if (!window.turnstile) {
    throw createTurnstileError('人机验证初始化失败，请刷新页面后重试')
  }

  if (!widgetContainer) {
    widgetContainer = document.createElement('div')
    widgetContainer.style.position = 'fixed'
    widgetContainer.style.bottom = 'calc(12px + env(safe-area-inset-bottom))'
    widgetContainer.style.right = 'calc(12px + env(safe-area-inset-right))'
    widgetContainer.style.zIndex = '2147483647'
    widgetContainer.style.minWidth = '1px'
    widgetContainer.style.minHeight = '1px'
    document.body.appendChild(widgetContainer)
  }

  if (!widgetId || activeSiteKey !== siteKey) {
    if (widgetId && typeof window.turnstile?.remove === 'function') {
      try {
        window.turnstile.remove(widgetId)
      } catch {
        // ignore removal failure and continue with re-render
      }
    } else if (widgetId && typeof window.turnstile?.reset === 'function') {
      window.turnstile.reset(widgetId)
    }
    widgetId = null
    if (widgetContainer) {
      widgetContainer.innerHTML = ''
    }

    const renderOptions: InternalTurnstileRenderOptions = {
      sitekey: siteKey,
      callback: (token: string) => {
        pendingHandlers?.resolve(token)
        pendingHandlers = null
      },
      'error-callback': () => {
        if (pendingHandlers) {
          pendingHandlers.reject(createTurnstileError('人机验证失败，请重试'))
          pendingHandlers = null
        }
      },
      'expired-callback': () => {
        if (widgetId && window.turnstile) {
          window.turnstile.reset(widgetId)
        }
      }
    }
    if (TURNSTILE_WIDGET_SIZE) {
      renderOptions.size = TURNSTILE_WIDGET_SIZE
    }
    widgetId = window.turnstile.render(widgetContainer, renderOptions)
    activeSiteKey = siteKey
  }

  return widgetId
}

export const useTurnstile = () => {
  const appConfigStore = useAppConfigStore()
  const { resolvedTurnstileSiteKey, resolvedTurnstileEnabled } = storeToRefs(appConfigStore)

  const getSiteKey = () => {
    const runtimeKey = resolvedTurnstileSiteKey.value || ''
    return (runtimeKey || FALLBACK_TURNSTILE_SITE_KEY || '').trim()
  }

  const prepareTurnstile = async () => {
    const siteKey = getSiteKey()
    if (!siteKey || typeof window === 'undefined') {
      return
    }

    await ensureTurnstileWidget(siteKey)
  }

  const executeTurnstile = async (options?: ExecuteOptions): Promise<string | null> => {
    const siteKey = getSiteKey()
    if (!siteKey || typeof window === 'undefined') {
      return null
    }

    const currentWidgetId =
      widgetId && activeSiteKey === siteKey && window.turnstile
        ? widgetId
        : await ensureTurnstileWidget(siteKey)
    const turnstile = window.turnstile
    if (!currentWidgetId || !turnstile) {
      throw createTurnstileError('人机验证暂时不可用，请稍后再试')
    }

    return new Promise<string>((resolve, reject) => {
      if (pendingHandlers) {
        try {
          pendingHandlers.reject(createTurnstileError('人机验证已取消，请重试'))
        } finally {
          pendingHandlers = null
        }
      }

      let timeoutId: number | null = null
      const clearTimeoutIfNeeded = () => {
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId)
          timeoutId = null
        }
      }

      pendingHandlers = {
        resolve: (token: string) => {
          clearTimeoutIfNeeded()
          resolve(token)
        },
        reject: (error: Error) => {
          clearTimeoutIfNeeded()
          reject(error)
        }
      }

      timeoutId = window.setTimeout(() => {
        if (!pendingHandlers) return
        try {
          pendingHandlers.reject(createTurnstileError('人机验证超时，请重试'))
        } finally {
          pendingHandlers = null
          if (widgetId && window.turnstile) {
            window.turnstile.reset(widgetId)
          }
        }
      }, TURNSTILE_EXECUTE_TIMEOUT_MS)

      try {
        turnstile.execute(currentWidgetId, options ?? {})
      } catch (error) {
        clearTimeoutIfNeeded()
        pendingHandlers = null
        reject(createTurnstileError('无法启动人机验证，请稍后再试'))
      }
    })
  }

  const resetTurnstile = () => {
    if (pendingHandlers) {
      try {
        pendingHandlers.reject(createTurnstileError('人机验证已取消，请重试'))
      } finally {
        pendingHandlers = null
      }
    }
    if (widgetId && typeof window !== 'undefined') {
      window.turnstile?.reset(widgetId)
    }
  }

  return {
    prepareTurnstile,
    executeTurnstile,
    resetTurnstile,
    turnstileEnabled: resolvedTurnstileEnabled
  }
}
