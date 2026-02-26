<template>
  <RedeemShell>
    <div class="relative w-full">
      <div
        class="waiting-room-scale-wrapper"
        :style="scaleWrapperStyle"
      >
        <div
          v-if="isRedirecting || isFetchingUser"
          class="w-full rounded-3xl bg-white/70 dark:bg-black/30 border border-white/40 dark:border-white/10 backdrop-blur-2xl p-6 flex flex-col items-center text-center gap-3 shadow-xl"
        >
        <div class="h-10 w-10 rounded-full bg-[#007AFF]/10 flex items-center justify-center">
          <span class="h-5 w-5 rounded-full border-2 border-[#007AFF] border-dashed animate-spin"></span>
        </div>
        <div class="space-y-1">
          <p class="text-lg font-semibold text-[#1d1d1f] dark:text-white">
            {{ isRedirecting ? '正在前往 Linux DO 授权' : '正在连接 Linux DO' }}
          </p>
          <p class="text-sm text-[#86868b]">请稍候，我们正在确认您的身份...</p>
        </div>
      </div>

      <div
        v-else-if="oauthError && !linuxDoUser"
        class="w-full rounded-3xl bg-white/70 dark:bg-black/30 border border-white/40 dark:border-white/10 backdrop-blur-2xl p-6 flex flex-col gap-4 shadow-xl"
      >
        <div class="flex items-center gap-3 text-left">
          <div class="h-10 w-10 rounded-full bg-[#FF3B30]/10 text-[#FF3B30] flex items-center justify-center">
            <AlertCircle class="h-5 w-5" />
          </div>
          <div>
            <p class="text-base font-semibold text-[#1d1d1f] dark:text-white">授权失败</p>
            <p class="text-sm text-[#86868b]">{{ oauthError }}</p>
          </div>
        </div>
        <AppleButton
          variant="secondary"
          class="w-full justify-center"
          @click="handleReauthorize"
        >
          重新连接 Linux DO
        </AppleButton>
      </div>

      <template v-else-if="linuxDoUser">
        <div class="text-center space-y-4">
          <div class="inline-flex items-center gap-2.5 rounded-full bg-white/60 dark:bg-white/10 backdrop-blur-xl border border-white/40 dark:border-white/10 px-4 py-1.5 shadow-sm">
            <span class="text-[13px] font-medium text-gray-600 dark:text-gray-300 tracking-wide">Linux DO 已连接</span>
            <button
              type="button"
              class="group relative flex items-center justify-center h-4 w-4 text-[#007AFF] hover:text-[#005FCC] transition"
              @click="goToLinuxRedeem"
              aria-label="前往兑换页面"
            >
              <svg class="h-4 w-4" viewBox="0 0 16 16" fill="none">
                <path d="M4 5h8m0 0-2-2m2 2-2 2M12 11H4m0 0 2 2m-2-2 2-2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <span class="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/80 text-white text-[10px] px-2 py-0.5 opacity-0 transition group-hover:opacity-100">
                前往兑换
              </span>
            </button>
          </div>
          <div class="space-y-2">
            <div class="flex flex-wrap items-center justify-center gap-2">
              <h1 class="text-[32px] sm:text-[40px] leading-tight font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 drop-shadow-sm animate-gradient-x">
                Linux DO 专属候车室
              </h1>
              <div
                v-if="queueConfig"
                class="relative group z-50 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#007AFF] shadow-[0_0_10px_rgba(0,122,255,0.35)] cursor-help"
                aria-label="候车室规则"
              >
                <span class="absolute inline-flex h-full w-full rounded-full bg-[#007AFF]/40 animate-ping" aria-hidden="true"></span>
                <span class="h-1.5 w-1.5 rounded-full bg-white"></span>
                <div
                  class="pointer-events-none absolute left-full top-1/2 ml-3 w-60 -translate-y-1/2 rounded-2xl border border-white/60 dark:border-white/10 bg-white/95 dark:bg-white/5 p-4 text-left text-xs text-[#4b5563] dark:text-[#e5e7eb] opacity-0 translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 shadow-xl backdrop-blur-2xl"
                >
                  <p class="text-sm font-semibold text-[#1d1d1f] dark:text-white mb-2">候车室规则</p>
                  <ul class="space-y-1.5 leading-relaxed">
                    <li>• 候车室上限：{{ queueConfig.capacity ? `${queueConfig.capacity} 人` : '无限制' }}</li>
                    <li>• 最低等级：Lv.{{ queueConfig.minTrustLevel }}</li>
                    <li>• 冷却期：{{ queueConfig.cooldownDays }} 天</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="relative group perspective-1000">
          <div class="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-[2rem] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200 animate-tilt"></div>
          <AppleCard
            variant="glass"
            class="relative mt-6 overflow-hidden shadow-2xl shadow-black/10 border border-white/40 dark:border-white/10 ring-1 ring-black/5 backdrop-blur-3xl transition-all duration-500 hover:shadow-3xl hover:scale-[1.01] animate-float"
          >
            <div class="p-6 sm:p-8 space-y-6">
            <form @submit.prevent="submitWaitingRoom" class="space-y-6">
              <div
                class="space-y-2 group animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100 fill-mode-backwards"
                :class="{ 'animate-shake': formErrorMessage && !formData.email }"
              >
                <AppleInput
                  v-model.trim="formData.email"
                  label="待邀请邮箱"
                  placeholder="name@example.com"
                  type="email"
                  variant="filled"
                  :disabled="isSubmitting"
                  helperText="我们会根据排队顺序邀请该邮箱加入 ChatGPT Team"
                  :error="formData.email && !isValidEmail ? '请输入有效的邮箱格式' : ''"
                  class="transition-all duration-300 group-hover:translate-x-1"
                />
              </div>

              <div
                v-if="restrictionMessages.length && !isWaiting"
                class="space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 fill-mode-backwards"
              >
                <div
                  v-for="message in restrictionMessages"
                  :key="message"
                  class="flex gap-3 items-start rounded-2xl bg-[#FF9F0A]/10 border border-[#FF9F0A]/20 p-4 text-sm text-[#a15c00] dark:text-[#FF9F0A]"
                >
                  <AlertCircle class="h-4 w-4 text-[#FF9F0A] mt-0.5" />
                  <span>{{ message }}</span>
                </div>
              </div>

              <div class="pt-1.5 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 fill-mode-backwards">
                <AppleButton
                  type="submit"
                  variant="primary"
                  size="md"
                  class="w-full h-[44px] text-[15px] font-medium shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                  :loading="isSubmitting"
                  :disabled="isSubmitDisabled"
                >
                  {{ currentEntry ? '更新候车邮箱' : '进入候车室' }}
                </AppleButton>
              </div>

              <div
                v-if="isWaiting"
                class="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-250 fill-mode-backwards"
              >
                <AppleButton
                  type="button"
                  variant="secondary"
                  size="md"
                  class="w-full h-[42px] text-[14px] font-medium border border-white/60 dark:border-white/10 shadow-sm hover:scale-[1.01]"
                  :loading="isLeavingQueue"
                  :disabled="isLeavingQueue || isSubmitting"
                  @click="handleLeaveQueue"
                >
                  离开候车队列
                </AppleButton>
              </div>
            </form>

            <div
              v-if="successMessage"
              class="absolute inset-0 z-20 flex items-center justify-center p-6 bg-white/60 dark:bg-black/60 backdrop-blur-md rounded-[2rem] animate-in fade-in duration-300"
            >
              <div class="w-full rounded-2xl bg-[#34C759]/10 border border-[#34C759]/20 p-5 flex gap-4 shadow-lg backdrop-blur-xl">
                <div class="flex-shrink-0 mt-0.5">
                  <div class="h-6 w-6 rounded-full bg-[#34C759] flex items-center justify-center shadow-sm">
                    <CheckCircle2 class="h-4 w-4 text-white" />
                  </div>
                </div>
                <div class="flex-1 space-y-2">
                  <h3 class="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">{{ successMessage }}</h3>
                  <p class="text-[14px] text-[#1d1d1f]/80 dark:text-white/80">
                    当前排在第 {{ queueStatus.queuePosition ?? '—' }} 位，我们会按照先后顺序完成邀请。
                  </p>
                  <div class="pt-2">
                    <button
                      type="button"
                      class="text-xs text-[#007AFF] hover:text-[#005FCC] font-medium transition"
                      @click="successMessage = ''"
                    >
                      继续编辑
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="formErrorMessage" class="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out-expo">
              <div class="rounded-2xl bg-[#FF3B30]/10 border border-[#FF3B30]/20 p-5 flex gap-4">
                <div class="flex-shrink-0 mt-0.5">
                  <div class="h-6 w-6 rounded-full bg-[#FF3B30] flex items-center justify-center shadow-sm">
                    <AlertCircle class="h-4 w-4 text-white" />
                  </div>
                </div>
                <div class="flex-1">
                  <h3 class="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">提交失败</h3>
                  <p class="mt-1 text-[14px] text-[#1d1d1f]/80 dark:text-white/80">{{ formErrorMessage }}</p>
                </div>
              </div>
            </div>
            </div>
          </AppleCard>
        </div>

        <div class="rounded-3xl bg-white/80 dark:bg-white/5 border border-white/50 dark:border-white/10 backdrop-blur-2xl shadow-2xl p-5 space-y-4 mt-5">
          <div class="flex flex-wrap gap-4 text-sm text-gray-700 dark:text-gray-300">
            <div class="flex-1 min-w-[140px] rounded-2xl bg-[#f3f6ff]/80 dark:bg-white/10 border border-white/60 dark:border-white/10 p-5 backdrop-blur-sm">
              <p class="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-400 font-medium mb-1">我的排队序号</p>
              <p class="text-3xl font-semibold text-[#1d1d1f] dark:text-white">
                {{ queueStatus.queuePosition ?? '—' }}
              </p>
            </div>
            <div class="flex-1 min-w-[140px] rounded-2xl bg-[#f3f6ff]/80 dark:bg-white/10 border border-white/60 dark:border-white/10 p-5 backdrop-blur-sm">
              <p class="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-400 font-medium mb-1">候车人数</p>
              <p class="text-3xl font-semibold text-[#1d1d1f] dark:text-white">
                <template v-if="queueConfig?.capacity">
                  {{ queueStatus.totalWaiting }} / {{ queueConfig.capacity }}
                </template>
                <template v-else>
                  {{ queueStatus.totalWaiting }}
                </template>
              </p>
            </div>
            <div class="flex-1 min-w-[140px] rounded-2xl bg-[#f3f6ff]/80 dark:bg-white/10 border border-white/60 dark:border-white/10 p-5 backdrop-blur-sm">
              <p class="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-400 font-medium mb-1">已上车人数</p>
              <p class="text-3xl font-semibold text-[#1d1d1f] dark:text-white">
                {{ queueStatus.boardedCount }}
              </p>
            </div>
            <div class="flex-1 min-w-[140px] rounded-2xl bg-[#f3f6ff]/80 dark:bg-white/10 border border-white/60 dark:border-white/10 p-5 backdrop-blur-sm">
              <p class="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-400 font-medium mb-1">最近一位上车时间</p>
              <p class="text-lg font-semibold text-[#1d1d1f] dark:text-white">
                {{ lastBoardedText }}
              </p>
            </div>
          </div>

          <div class="rounded-2xl bg-white/90 dark:bg-white/5 border border-white/50 dark:border-white/10 p-5 space-y-3">
            <template v-if="isUnderCooldown && !isWaiting">
              <p class="text-sm font-semibold text-[#1d1d1f] dark:text-white">冷却信息</p>
              <div class="space-y-2 text-sm text-[#86868b]">
                <div class="flex items-center justify-between">
                  <span>上次上车时间</span>
                  <span class="font-semibold text-[#1d1d1f] dark:text-white">
                    {{ cooldownBoardedText || '—' }}
                  </span>
                </div>
                <div class="flex items-center justify-between">
                  <span>上次上车邮箱</span>
                  <span class="font-semibold text-[#1d1d1f] dark:text-white">
                    {{ cooldownLastBoardedEmail || '—' }}
                  </span>
                </div>
                <div class="flex items-center justify-between">
                  <span>冷却结束时间</span>
                  <span class="font-semibold text-[#FF9F0A]">
                    {{ cooldownText || '—' }}
                  </span>
                </div>
              </div>
            </template>
            <template v-else>
              <p class="text-sm font-semibold text-[#1d1d1f] dark:text-white">我的排队信息</p>
              <div v-if="queueLoaded" class="space-y-2 text-sm text-[#86868b]">
                <div class="flex items-center justify-between">
                  <span>提交的邮箱</span>
                  <span class="font-semibold text-[#1d1d1f] dark:text-white">
                    {{ currentEntry?.email || '尚未提交' }}
                  </span>
                </div>
                <div class="flex items-center justify-between">
                  <span>排队状态</span>
                  <span
                    class="font-semibold"
                    :class="entryStatusClass"
                  >
                    {{ entryStatusLabel }}
                  </span>
                </div>
                <div class="flex items-center justify-between">
                  <span>当前序号</span>
                  <span class="font-semibold text-[#1d1d1f] dark:text-white">{{ queueStatus.queuePosition ?? '—' }}</span>
                </div>
              </div>
              <p v-else class="text-sm text-[#86868b]">正在同步候车室数据...</p>
            </template>
          </div>
        </div>
      </template>

      </div>

      <LinuxDoUserPopover
        v-if="linuxDoUser"
        :user="linuxDoUser"
        :avatar-url="avatarUrl"
        :display-name="linuxDoDisplayName"
        :trust-level-label="trustLevelLabel"
        @reauthorize="handleReauthorize"
      />
    </div>
  </RedeemShell>
</template>

<script setup lang="ts">
import AppleButton from '@/components/ui/apple/Button.vue'
import AppleCard from '@/components/ui/apple/Card.vue'
import AppleInput from '@/components/ui/apple/Input.vue'
import RedeemShell from '@/components/RedeemShell.vue'
import LinuxDoUserPopover from '@/components/LinuxDoUserPopover.vue'
import { useLinuxDoAuthSession } from '@/composables/useLinuxDoAuthSession'
import { useTurnstile } from '@/composables/useTurnstile'
import { getCurrentInterfaceScale, isApplePlatform } from '@/lib/interfaceScale'
import { formatShanghaiDate } from '@/lib/datetime'
import { isEmail } from '@/lib/validation'
import { waitingRoomService, type WaitingRoomConfig, type WaitingRoomEntry, type WaitingRoomSnapshot } from '@/services/api'
import { AlertCircle, CheckCircle2 } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const formData = ref({ email: '' })
const lastSnapshotEmail = ref<string | null>(null)
const isEmailDirty = ref(false)
const isSubmitting = ref(false)
const formErrorMessage = ref('')
const successMessage = ref('')
const queueLoaded = ref(false)
const queueStatus = ref({
  queuePosition: null as number | null,
  totalWaiting: 0,
  boardedCount: 0,
  lastBoardedAt: null as string | null,
})
const currentEntry = ref<WaitingRoomEntry | null>(null)
const autoRefreshTimer = ref<number | null>(null)
const queueConfig = ref<WaitingRoomConfig | null>(null)
const cooldownEndsAt = ref<string | null>(null)
const cooldownLastBoardedAt = ref<string | null>(null)
const cooldownLastBoardedEmail = ref<string | null>(null)
const isLeavingQueue = ref(false)
const wrapperScale = ref(1)
const enableScale = ref(false)
let scaleCleanup: (() => void) | null = null
const router = useRouter()
const { executeTurnstile, resetTurnstile, turnstileEnabled } = useTurnstile()

const isTurnstileError = (error: unknown): error is Error =>
  Boolean(error && typeof error === 'object' && (error as Error).name === 'TurnstileError')

const createTurnstileError = (message: string) => {
  const turnstileError = new Error(message)
  turnstileError.name = 'TurnstileError'
  return turnstileError
}

const {
  linuxDoUser,
  sessionToken,
  oauthError,
  isRedirecting,
  isFetchingUser,
  redeemerUid,
  avatarUrl,
  trustLevelLabel,
  linuxDoDisplayName,
  handleReauthorize,
} = useLinuxDoAuthSession({ redirectRouteName: 'waiting-room' })

const scaleWrapperStyle = computed(() => {
  if (!enableScale.value) return undefined
  const scale = wrapperScale.value || 1
  if (scale === 1) return undefined
  return {
    transform: `scale(${scale})`,
    transformOrigin: 'top center'
  }
})

const linuxDoTrustLevel = computed(() => linuxDoUser.value?.trust_level ?? 0)
const isWaiting = computed(() => currentEntry.value?.status === 'waiting')

const isValidEmail = computed(() => isEmail(formData.value.email))

const meetsTrustRequirement = computed(() => {
  const required = queueConfig.value?.minTrustLevel ?? 0
  if (!required) return true
  return linuxDoTrustLevel.value >= required
})

const isUnderCooldown = computed(() => {
  if (!cooldownEndsAt.value) return false
  const ends = new Date(cooldownEndsAt.value)
  if (Number.isNaN(ends.getTime())) return false
  return ends.getTime() > Date.now()
})

const queueCapacityValue = computed(() => queueConfig.value?.capacity ?? 0)

const isWaitingRoomEnabled = computed(() => queueConfig.value?.enabled ?? true)

const isQueueFull = computed(() => {
  if (!queueCapacityValue.value) return false
  if (isWaiting.value) return false
  return queueStatus.value.totalWaiting >= queueCapacityValue.value
})

const canModifyQueue = computed(() => {
  if (!isWaitingRoomEnabled.value) return false
  if (!redeemerUid.value) return false
  if (isWaiting.value) return true
  return meetsTrustRequirement.value && !isUnderCooldown.value && !isQueueFull.value
})

const isSubmitDisabled = computed(() => isSubmitting.value || !isValidEmail.value || !canModifyQueue.value)

const entryStatusLabel = computed(() => {
  if (!currentEntry.value) return '未排队'
  if (currentEntry.value.status === 'boarded') return '已上车'
  if (currentEntry.value.status === 'left') return '已退出'
  return '等待中'
})

const entryStatusClass = computed(() => {
  if (!currentEntry.value) return 'text-[#86868b]'
  if (currentEntry.value.status === 'boarded') return 'text-[#34C759]'
  if (currentEntry.value.status === 'left') return 'text-[#86868b]'
  return 'text-[#FF9F0A]'
})

const lastBoardedText = computed(() => formatDateTime(queueStatus.value.lastBoardedAt))

const formatDateTime = (value: string | null) => {
  if (!value) return '暂无记录'
  const formatted = formatShanghaiDate(value)
  return formatted === '-' ? '暂无记录' : formatted
}

const restrictionMessages = computed(() => {
  if (isWaiting.value) return []
  const messages: string[] = []
  if (!isWaitingRoomEnabled.value) {
    messages.push('候车室已关闭，请等待下次开放')
    return messages
  }
  if (!meetsTrustRequirement.value && queueConfig.value?.minTrustLevel) {
    messages.push(`候车室需要 Linux DO 等级 Lv.${queueConfig.value.minTrustLevel} 及以上才能加入`)
  }
  if (isUnderCooldown.value && cooldownEndsAt.value) {
    messages.push(`您已完成上车，请在 ${formatDateTime(cooldownEndsAt.value)} 之后再尝试加入候车室`)
  }
  if (isQueueFull.value && queueConfig.value?.capacity) {
    messages.push(`候车室当前已满（上限 ${queueConfig.value.capacity} 人），请稍后再试`)
  }
  return messages
})

const cooldownText = computed(() => {
  if (!cooldownEndsAt.value) return ''
  return formatDateTime(cooldownEndsAt.value)
})

const cooldownBoardedText = computed(() => {
  if (!cooldownLastBoardedAt.value) return ''
  return formatDateTime(cooldownLastBoardedAt.value)
})

const applySnapshot = (snapshot: WaitingRoomSnapshot) => {
  const isSnapshotWaiting = snapshot.entry?.status === 'waiting'
  const effectiveQueuePosition = isSnapshotWaiting
    ? (snapshot.queuePosition ?? snapshot.queuePositionSnapshot ?? null)
    : null
  queueStatus.value = {
    queuePosition: effectiveQueuePosition,
    totalWaiting: snapshot.totalWaiting ?? 0,
    boardedCount: snapshot.boardedCount ?? 0,
    lastBoardedAt: snapshot.lastBoardedAt ?? null,
  }
  queueLoaded.value = true
  currentEntry.value = snapshot.entry
  queueConfig.value = snapshot.config ?? queueConfig.value
  cooldownEndsAt.value = snapshot.cooldownEndsAt ?? null
  cooldownLastBoardedAt.value = snapshot.cooldownLastBoardedAt ?? null
  cooldownLastBoardedEmail.value = snapshot.cooldownLastBoardedEmail ?? null
  if (snapshot.entry?.email) {
    const snapshotEmail = snapshot.entry.email
    lastSnapshotEmail.value = snapshotEmail
    if (!isEmailDirty.value || !formData.value.email) {
      formData.value.email = snapshotEmail
    }
    isEmailDirty.value = formData.value.email !== snapshotEmail
  } else if (!snapshot.entry && !isEmailDirty.value) {
    formData.value.email = ''
    lastSnapshotEmail.value = null
  }
}

const loadQueueStatus = async () => {
  if (!sessionToken.value) return
  try {
    const snapshot = await waitingRoomService.getStatus(sessionToken.value)
    applySnapshot(snapshot)
  } catch (error: any) {
    console.error('[WaitingRoom] 获取状态失败', error)
  }
}

const submitWaitingRoom = async () => {
  if (!sessionToken.value) {
    formErrorMessage.value = '尚未获取 Linux DO session token，请刷新后重试'
    return
  }
  if (!isValidEmail.value) {
    formErrorMessage.value = '请填写有效邮箱'
    return
  }
  if (!canModifyQueue.value) {
    formErrorMessage.value = restrictionMessages.value[0] || '暂时无法加入候车室'
    return
  }

  isSubmitting.value = true
  formErrorMessage.value = ''
  successMessage.value = ''
  let turnstileToken: string | null = null

  try {
    if (turnstileEnabled.value) {
      turnstileToken = await executeTurnstile({ action: 'waiting_room_join' })
      if (!turnstileToken) {
        throw createTurnstileError('请完成验证后再提交')
      }
    }

    const payload = {
      email: formData.value.email.trim().toLowerCase(),
      turnstileToken: turnstileToken || undefined
    }
    const snapshot = await waitingRoomService.joinQueue(sessionToken.value, payload)
    successMessage.value = snapshot.message || '已进入候车室'
    applySnapshot(snapshot)
  } catch (error: any) {
    if (isTurnstileError(error)) {
      formErrorMessage.value = error.message || '人机验证失败，请稍后再试'
    } else {
      const apiError = error.response?.data
      formErrorMessage.value = apiError?.error || '加入候车室失败，请稍后再试'
      if (apiError?.cooldownEndsAt) {
        cooldownEndsAt.value = apiError.cooldownEndsAt
      }
    }
  } finally {
    isSubmitting.value = false
    if (turnstileEnabled.value) {
      resetTurnstile()
    }
  }
}

const handleLeaveQueue = async () => {
  if (!sessionToken.value) return
  isLeavingQueue.value = true
  formErrorMessage.value = ''
  successMessage.value = ''
  try {
    const snapshot = await waitingRoomService.leaveQueue(sessionToken.value)
    successMessage.value = snapshot.message || '已离开候车室'
    applySnapshot(snapshot)
  } catch (error: any) {
    formErrorMessage.value = error.response?.data?.error || '离开候车室失败，请稍后再试'
  } finally {
    isLeavingQueue.value = false
  }
}

const startAutoRefresh = () => {
  if (typeof window === 'undefined') return
  stopAutoRefresh()
  autoRefreshTimer.value = window.setInterval(() => {
    loadQueueStatus()
  }, 15000)
}

const stopAutoRefresh = () => {
  if (autoRefreshTimer.value) {
    clearInterval(autoRefreshTimer.value)
    autoRefreshTimer.value = null
  }
}

const goToLinuxRedeem = () => {
  router.push({ name: 'linux-do-redeem' })
}

watch(
  () => redeemerUid.value,
  value => {
    stopAutoRefresh()
    if (value) {
      queueLoaded.value = false
      loadQueueStatus()
      startAutoRefresh()
    } else {
      queueLoaded.value = false
      currentEntry.value = null
      cooldownEndsAt.value = null
    }
  }
)

watch(
  () => formData.value.email,
  value => {
    if (lastSnapshotEmail.value === null) {
      isEmailDirty.value = Boolean(value)
      return
    }
    isEmailDirty.value = value !== lastSnapshotEmail.value
  }
)

onMounted(() => {
  if (typeof window === 'undefined') return
  // Disable scaling for this view as the new design is compact enough
  enableScale.value = false
})

onBeforeUnmount(() => {
  stopAutoRefresh()
  if (scaleCleanup) {
    scaleCleanup()
    scaleCleanup = null
  }
})
</script>

<style scoped>
.delay-100 {
  animation-delay: 100ms;
}

.delay-200 {
  animation-delay: 200ms;
}

.fill-mode-backwards {
  animation-fill-mode: backwards;
}

.waiting-room-scale-wrapper {
  width: 100%;
  transform-origin: top center;
  transition: transform 0.25s ease;
}

.animate-gradient-x {
  background-size: 200% 200%;
  animation: gradient-x 8s ease infinite;
}

@keyframes gradient-x {
  0%, 100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

.animate-float {
  animation: float-card 6s ease-in-out infinite;
}

@keyframes float-card {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.perspective-1000 {
  perspective: 1000px;
}
</style>
