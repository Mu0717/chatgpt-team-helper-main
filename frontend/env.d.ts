/// <reference types="vite/client" />

interface TurnstileRenderOptions {
  sitekey: string
  callback?: (token: string) => void
  'error-callback'?: () => void
  'expired-callback'?: () => void
  action?: string
  cData?: string
  size?: 'invisible' | 'normal' | 'compact' | 'flexible'
  theme?: 'light' | 'dark' | 'auto'
}

interface TurnstileExecuteOptions {
  action?: string
  cData?: string
}

interface Turnstile {
  render: (container: string | HTMLElement, options: TurnstileRenderOptions) => string
  execute: (widgetId: string, options?: TurnstileExecuteOptions) => void
  reset: (widgetId?: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

export {}
