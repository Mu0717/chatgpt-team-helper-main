import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { linuxDoAuthService, type LinuxDoUser } from '@/services/api'

interface UseLinuxDoAuthOptions {
  redirectRouteName: string
  cacheKey?: string
}

const DEFAULT_CACHE_KEY = 'linuxdo-user-cache'
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000 // 1 day

export function useLinuxDoAuthSession(options: UseLinuxDoAuthOptions) {
  const route = useRoute()
  const router = useRouter()
  const cacheKey = options.cacheKey || DEFAULT_CACHE_KEY

  const linuxDoUser = ref<LinuxDoUser | null>(null)
  const sessionToken = ref('')
  const oauthError = ref('')
  const isRedirecting = ref(false)
  const isFetchingUser = ref(false)

  const redeemerUid = computed(() => (linuxDoUser.value?.id ? String(linuxDoUser.value.id) : ''))

  const redirectUri = computed(() => {
    if (typeof window === 'undefined') return ''
    const resolved = router.resolve({ name: options.redirectRouteName })
    return `${window.location.origin}${resolved.href}`
  })

  const avatarUrl = computed(() => {
    const template = linuxDoUser.value?.avatar_template
    if (!template) return ''
    const url = template.includes('{size}') ? template.replace('{size}', '160') : template
    if (url.startsWith('http')) return url
    return `https://linux.do${url}`
  })

  const linuxDoDisplayName = computed(() => linuxDoUser.value?.name || linuxDoUser.value?.username || '')

  const trustLevelLabel = computed(() => {
    const level = linuxDoUser.value?.trust_level ?? 0
    const labels = ['访客', '新手', '成员', '常客', '核心成员']
    return labels[level] ?? `Lv.${level}`
  })

  const saveCachedSession = (session: { user: LinuxDoUser; sessionToken?: string | null }) => {
    if (typeof window === 'undefined') return
    const payload = {
      user: session.user,
      sessionToken: session.sessionToken || '',
      expiresAt: Date.now() + CACHE_DURATION_MS
    }
    try {
      window.localStorage.setItem(cacheKey, JSON.stringify(payload))
    } catch (error) {
      console.warn('缓存 Linux DO 用户信息失败:', error)
    }
  }

  const loadCachedSession = (): { user: LinuxDoUser; sessionToken: string } | null => {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem(cacheKey)
      if (!raw) return null
      const payload = JSON.parse(raw)
      if (!payload?.user || !payload?.expiresAt) {
        window.localStorage.removeItem(cacheKey)
        return null
      }
      if (Date.now() > payload.expiresAt) {
        window.localStorage.removeItem(cacheKey)
        return null
      }
      return {
        user: payload.user as LinuxDoUser,
        sessionToken: typeof payload.sessionToken === 'string' ? payload.sessionToken : ''
      }
    } catch (error) {
      console.warn('读取 Linux DO 缓存失败:', error)
      window.localStorage.removeItem(cacheKey)
      return null
    }
  }

  const clearCachedUser = () => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.removeItem(cacheKey)
    } catch {
      // ignore
    }
  }

  const clearOauthQuery = async () => {
    const currentQuery = { ...route.query } as Record<string, any>
    let changed = false
    ;['code', 'error', 'state'].forEach(key => {
      if (key in currentQuery) {
        delete currentQuery[key]
        changed = true
      }
    })
    if (changed) {
      await router.replace({ path: route.path, query: currentQuery })
    }
  }

  const exchangeCode = async (code: string) => {
    if (!redirectUri.value) return
    isFetchingUser.value = true
    oauthError.value = ''
    try {
      const response = await linuxDoAuthService.exchangeCode(code, redirectUri.value)
      linuxDoUser.value = response.user
      sessionToken.value = response.sessionToken ? String(response.sessionToken) : ''
      if (response.user) {
        saveCachedSession({ user: response.user, sessionToken: sessionToken.value })
      }
      await clearOauthQuery()
    } catch (error: any) {
      oauthError.value = error.response?.data?.error || 'Linux DO 授权失败，请稍后重试'
    } finally {
      isFetchingUser.value = false
    }
  }

  const startAuthorization = async () => {
    if (!redirectUri.value) return
    oauthError.value = ''
    isRedirecting.value = true
    try {
      const { url } = await linuxDoAuthService.getAuthorizeUrl(redirectUri.value)
      window.location.href = url
    } catch (error: any) {
      oauthError.value = error.response?.data?.error || '获取授权地址失败，请稍后再试'
      isRedirecting.value = false
    }
  }

  const handleReauthorize = () => {
    linuxDoUser.value = null
    sessionToken.value = ''
    clearCachedUser()
    startAuthorization()
  }

  onMounted(async () => {
    if (typeof window === 'undefined') return
    const code = route.query.code as string | undefined
    const oauthErrorParam = route.query.error as string | undefined

    if (oauthErrorParam) {
      oauthError.value = decodeURIComponent(oauthErrorParam)
      await clearOauthQuery()
      return
    }

    if (code) {
      await exchangeCode(code)
    } else {
      const cachedSession = loadCachedSession()
      if (cachedSession) {
        linuxDoUser.value = cachedSession.user
        sessionToken.value = cachedSession.sessionToken
        if (!sessionToken.value) {
          clearCachedUser()
          await startAuthorization()
        }
      } else {
        await startAuthorization()
      }
    }
  })

  return {
    linuxDoUser,
    sessionToken,
    oauthError,
    isRedirecting,
    isFetchingUser,
    redeemerUid,
    redirectUri,
    avatarUrl,
    trustLevelLabel,
    linuxDoDisplayName,
    handleReauthorize
  }
}
