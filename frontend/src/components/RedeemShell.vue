<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { authService } from '@/services/api'
import { ChevronDown } from 'lucide-vue-next'

const props = defineProps({
  maxWidth: {
    type: String,
    default: 'max-w-[480px]'
  },
  showUserStatusBar: {
    type: Boolean,
    default: false,
  }
})

const router = useRouter()

const currentUser = ref(authService.getCurrentUser())
const syncCurrentUser = () => {
  currentUser.value = authService.getCurrentUser()
}

const isAuthenticated = computed(() => Boolean(currentUser.value) && authService.isAuthenticated())
const displayName = computed(() => {
  const user = currentUser.value
  const username = String(user?.username || '').trim()
  if (username) return username
  const email = String(user?.email || '').trim()
  return email
})
const avatarText = computed(() => (displayName.value.charAt(0) || 'U').toUpperCase())

const isUserPopoverOpen = ref(false)
const userButtonRef = ref<HTMLElement | null>(null)
const userPopoverRef = ref<HTMLElement | null>(null)

const toggleUserPopover = () => {
  if (!isAuthenticated.value) return
  isUserPopoverOpen.value = !isUserPopoverOpen.value
}

const handleClickOutside = (event: MouseEvent) => {
  if (!isUserPopoverOpen.value) return
  const target = event.target as Node | null
  if (!target) return
  if (userButtonRef.value?.contains(target) || userPopoverRef.value?.contains(target)) {
    return
  }
  isUserPopoverOpen.value = false
}

const handleLogout = () => {
  isUserPopoverOpen.value = false
  authService.logout()
  router.push('/login')
}

onMounted(() => {
  window.addEventListener('auth-updated', syncCurrentUser)
  if (props.showUserStatusBar) {
    window.addEventListener('click', handleClickOutside)
  }
})

onUnmounted(() => {
  window.removeEventListener('auth-updated', syncCurrentUser)
  window.removeEventListener('click', handleClickOutside)
})

watch(isAuthenticated, (value) => {
  if (!value) isUserPopoverOpen.value = false
})
</script>

<template>
  <div class="min-h-screen w-full overflow-hidden relative flex items-start justify-center pt-12 sm:pt-24 pb-12 px-4 sm:px-6 lg:px-8">
    <div
      v-if="props.showUserStatusBar"
      class="fixed top-4 right-4 sm:top-8 sm:right-12 z-30 flex items-start justify-end gap-3"
    >
      <template v-if="isAuthenticated">
        <div class="flex flex-col items-end gap-3">
          <button
            ref="userButtonRef"
            type="button"
            class="flex items-center gap-3 rounded-full bg-white/90 dark:bg-black/60 border border-white/70 dark:border-white/20 px-2.5 py-1.5 shadow-lg shadow-black/10 backdrop-blur-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl"
            :aria-expanded="isUserPopoverOpen"
            @click="toggleUserPopover"
          >
            <div class="h-10 w-10 rounded-2xl bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center font-semibold">
              {{ avatarText }}
            </div>
            <div class="hidden sm:flex flex-col items-start min-w-0">
              <span class="text-sm font-semibold text-[#1d1d1f] dark:text-white truncate max-w-[180px]">{{ displayName }}</span>
              <span class="text-xs text-[#86868b] truncate max-w-[180px]">{{ currentUser?.email || '' }}</span>
            </div>
            <ChevronDown
              class="h-4 w-4 text-[#86868b] transition-transform duration-200"
              :class="{ 'rotate-180 text-[#007AFF]': isUserPopoverOpen }"
            />
          </button>

          <div
            v-if="isUserPopoverOpen"
            ref="userPopoverRef"
            class="w-[260px] sm:w-[320px] rounded-3xl bg-white/95 dark:bg-neutral-900/90 border border-white/70 dark:border-white/10 backdrop-blur-2xl shadow-2xl shadow-black/20 p-5 space-y-4"
          >
            <div class="flex items-center gap-4">
              <div class="h-16 w-16 rounded-2xl bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center text-2xl font-semibold">
                {{ avatarText }}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-base font-semibold text-[#1d1d1f] dark:text-white truncate">{{ displayName }}</p>
                <p class="text-sm text-[#86868b] truncate">{{ currentUser?.email || '' }}</p>
                <p v-if="currentUser?.id" class="text-xs text-[#a0a0a5] mt-1">ID #{{ currentUser.id }}</p>
              </div>
            </div>

            <div class="grid gap-2">
              <RouterLink
                to="/admin"
                class="h-10 inline-flex items-center justify-center rounded-2xl bg-[#f6faff] dark:bg-white/5 border border-white/60 dark:border-white/10 text-[#007AFF] font-medium transition-colors hover:bg-blue-50/80 dark:hover:bg-white/10"
                @click="isUserPopoverOpen = false"
              >
                进入后台
              </RouterLink>
              <button
                type="button"
                class="h-10 inline-flex items-center justify-center rounded-2xl bg-[#fff5f5] dark:bg-white/5 border border-white/60 dark:border-white/10 text-[#FF3B30] font-medium transition-colors hover:bg-red-50/80 dark:hover:bg-white/10"
                @click="handleLogout"
              >
                退出登录
              </button>
            </div>
          </div>
        </div>
      </template>

      <template v-else>
        <RouterLink
          to="/login"
          class="h-10 inline-flex items-center rounded-full bg-white/90 dark:bg-black/60 border border-white/70 dark:border-white/20 px-4 text-[13px] font-medium text-gray-700 dark:text-gray-200 shadow-lg shadow-black/10 backdrop-blur-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl"
        >
          登录
        </RouterLink>
        <RouterLink
          to="/register"
          class="h-10 inline-flex items-center rounded-full bg-gray-900 text-white px-4 text-[13px] font-medium shadow-lg shadow-black/10 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl hover:bg-black"
        >
          注册
        </RouterLink>
      </template>
    </div>

    <div class="absolute inset-0 z-0 overflow-hidden bg-[#fbfbfd] dark:bg-[#000000]">
      <div class="aurora-blob blob-1"></div>
      <div class="aurora-blob blob-2"></div>
      <div class="aurora-blob blob-3"></div>
      <div class="absolute inset-0 bg-white/40 dark:bg-black/20 backdrop-blur-3xl"></div>
      <div class="absolute inset-0 opacity-[0.015] dark:opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
    </div>
    <div :class="['w-full relative z-10 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out-expo', maxWidth]">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.aurora-blob {
  position: absolute;
  filter: blur(80px);
  opacity: 0.8;
  animation: float 18s infinite ease-in-out alternate;
  mix-blend-mode: normal;
}

.blob-1 {
  top: -20%;
  left: -20%;
  width: 700px;
  height: 700px;
  background: radial-gradient(circle, #60a5fa, #3b82f6);
  animation-delay: 0s;
  opacity: 0.7;
}

.blob-2 {
  top: 10%;
  right: -20%;
  width: 800px;
  height: 800px;
  background: radial-gradient(circle, #c084fc, #a855f7);
  animation-delay: -6s;
  opacity: 0.6;
}

.blob-3 {
  bottom: -20%;
  left: 10%;
  width: 900px;
  height: 900px;
  background: radial-gradient(circle, #f472b6, #ec4899);
  animation-delay: -12s;
  opacity: 0.6;
}

@keyframes float {
  0% {
    transform: translate(0, 0) rotate(0deg) scale(1);
  }
  25% {
    transform: translate(40px, -60px) rotate(15deg) scale(1.15);
  }
  50% {
    transform: translate(-30px, 40px) rotate(-10deg) scale(0.9);
  }
  75% {
    transform: translate(20px, -30px) rotate(5deg) scale(1.05);
  }
  100% {
    transform: translate(0, 0) rotate(0deg) scale(1);
  }
}

:global(.dark) .aurora-blob {
  mix-blend-mode: screen;
  opacity: 0.4;
}

:global(.dark) .blob-1 {
  background: radial-gradient(circle, #0284c7, #0369a1);
}

:global(.dark) .blob-2 {
  background: radial-gradient(circle, #7c3aed, #6d28d9);
}

:global(.dark) .blob-3 {
  background: radial-gradient(circle, #db2777, #be185d);
}
</style>
