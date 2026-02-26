import { ref } from 'vue'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastOptions {
  title?: string
  description?: string
  type?: ToastType
  duration?: number
}

export interface ToastMessage extends Required<ToastOptions> {
  id: number
}

const DEFAULT_DURATION = 3200
const DEFAULT_TITLE: Record<ToastType, string> = {
  success: '操作成功',
  error: '出现问题',
  info: '提示',
  warning: '注意'
}

const toasts = ref<ToastMessage[]>([])
let idCounter = 0

const removeToast = (id: number) => {
  toasts.value = toasts.value.filter(toast => toast.id !== id)
}

const addToast = (options: ToastOptions | string, type: ToastType = 'info') => {
  const normalized: ToastOptions = typeof options === 'string'
    ? { description: options, type }
    : { ...options, type: options.type || type }

  const id = ++idCounter
  const toast: ToastMessage = {
    id,
    title: normalized.title || DEFAULT_TITLE[normalized.type || 'info'],
    description: normalized.description || '',
    type: normalized.type || 'info',
    duration: normalized.duration ?? DEFAULT_DURATION
  }

  toasts.value = [...toasts.value, toast]

  if (toast.duration !== 0) {
    window.setTimeout(() => removeToast(id), toast.duration)
  }

  return id
}

export const useToast = () => {
  return {
    toasts,
    toast: (options: ToastOptions | string) => addToast(options, 'info'),
    success: (options: ToastOptions | string) => addToast(options, 'success'),
    error: (options: ToastOptions | string) => addToast(options, 'error'),
    warning: (options: ToastOptions | string) => addToast(options, 'warning'),
    info: (options: ToastOptions | string) => addToast(options, 'info'),
    dismiss: removeToast
  }
}
