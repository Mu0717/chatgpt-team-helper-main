<template>
  <div class="fixed top-4 right-4 sm:top-8 sm:right-12 z-30 flex flex-col items-end gap-3">
    <div class="flex items-center gap-3">
      <a
        v-if="props.githubRepoUrl"
        :href="props.githubRepoUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="h-[52px] w-[52px] inline-flex items-center justify-center rounded-full bg-white/90 dark:bg-black/60 border border-white/70 dark:border-white/20 shadow-lg shadow-black/10 backdrop-blur-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl"
        aria-label="Open GitHub repository"
        title="GitHub"
      >
        <Github class="h-5 w-5 text-[#1d1d1f] dark:text-white" />
      </a>

      <button
        ref="buttonRef"
        type="button"
        class="flex items-center gap-3 rounded-full bg-white/90 dark:bg-black/60 border border-white/70 dark:border-white/20 px-2.5 py-1.5 shadow-lg shadow-black/10 backdrop-blur-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl"
        :aria-expanded="isOpen"
        @click="toggle"
      >
        <img
          v-if="props.avatarUrl"
          :src="props.avatarUrl"
          alt="avatar"
          class="h-10 w-10 rounded-2xl border border-white/80 object-cover shadow"
        />
        <div
          v-else
          class="h-10 w-10 rounded-2xl bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center font-semibold"
        >
          {{ userInitial }}
        </div>
        <div class="hidden sm:flex flex-col items-start">
          <span class="text-sm font-semibold text-[#1d1d1f] dark:text-white">{{ props.displayName }}</span>
          <span class="text-xs text-[#86868b]">UID #{{ props.user?.id }}</span>
        </div>
        <ChevronDown
          class="h-4 w-4 text-[#86868b] transition-transform duration-200"
          :class="{ 'rotate-180 text-[#007AFF]': isOpen }"
        />
      </button>
    </div>

    <div
      v-if="isOpen"
      ref="popoverRef"
      class="w-[260px] sm:w-[320px] rounded-3xl bg-white/95 dark:bg-neutral-900/90 border border-white/70 dark:border-white/10 backdrop-blur-2xl shadow-2xl shadow-black/20 p-5 space-y-4"
    >
      <div class="flex items-center gap-4">
        <img
          v-if="props.avatarUrl"
          :src="props.avatarUrl"
          alt="avatar"
          class="h-16 w-16 rounded-2xl border border-white/80 object-cover shadow"
        />
        <div
          v-else
          class="h-16 w-16 rounded-2xl bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center text-2xl font-semibold"
        >
          {{ userInitial }}
        </div>
        <div class="flex-1">
          <p class="text-base font-semibold text-[#1d1d1f] dark:text-white">{{ props.displayName }}</p>
          <p class="text-sm text-[#86868b]">@{{ props.user?.username }}</p>
          <p class="text-xs text-[#a0a0a5] mt-1">UID #{{ props.user?.id }}</p>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3 text-sm text-[#86868b]">
        <div class="rounded-2xl bg-[#f6faff] dark:bg-white/5 border border-white/60 dark:border-white/10 p-3">
          <p class="text-xs uppercase tracking-wide text-[#86868b]">信任等级</p>
          <p class="text-lg font-semibold text-[#1d1d1f] dark:text-white">{{ props.trustLevelLabel }}</p>
        </div>
        <div class="rounded-2xl bg-[#f6faff] dark:bg-white/5 border border-white/60 dark:border-white/10 p-3">
          <p class="text-xs uppercase tracking-wide text-[#86868b]">账号状态</p>
          <p class="text-lg font-semibold" :class="statusClass">
            {{ statusLabel }}
          </p>
        </div>
      </div>
      <AppleButton variant="ghost" size="sm" class="w-full justify-center text-[#007AFF]" @click="handleSwitchAccount">
        切换账号
      </AppleButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppleButton from '@/components/ui/apple/Button.vue'
import { ChevronDown, Github } from 'lucide-vue-next'
import type { LinuxDoUser } from '@/services/api'

const props = defineProps<{
  user: LinuxDoUser
  avatarUrl: string
  displayName: string
  trustLevelLabel: string
  githubRepoUrl?: string
}>()

const emit = defineEmits<{
  (event: 'reauthorize'): void
}>()

const isOpen = ref(false)
const buttonRef = ref<HTMLElement | null>(null)
const popoverRef = ref<HTMLElement | null>(null)

const userInitial = computed(() => {
  const display = (props.displayName || '').trim()
  if (display) return display.charAt(0).toUpperCase()
  const username = props.user?.username || ''
  if (username) return username.charAt(0).toUpperCase()
  return '?'
})

const statusLabel = computed(() => (props.user?.active ? '活跃' : '已停用'))
const statusClass = computed(() => (props.user?.active ? 'text-[#34C759]' : 'text-[#FF3B30]'))

const toggle = () => {
  isOpen.value = !isOpen.value
}

const handleClickOutside = (event: MouseEvent) => {
  if (!isOpen.value) return
  const target = event.target as Node | null
  if (!target) return
  if (buttonRef.value?.contains(target) || popoverRef.value?.contains(target)) {
    return
  }
  isOpen.value = false
}

const handleSwitchAccount = () => {
  isOpen.value = false
  emit('reauthorize')
}

onMounted(() => {
  window.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  window.removeEventListener('click', handleClickOutside)
})

watch(
  () => props.user?.id,
  () => {
    isOpen.value = false
  }
)
</script>
