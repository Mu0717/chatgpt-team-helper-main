<template>
  <RedeemShell>
    <div class="relative w-full">
      <div
        class="linuxdo-redeem-scale-wrapper"
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
              @click="goToWaitingRoom"
              aria-label="前往候车室"
            >
              <svg class="h-4 w-4" viewBox="0 0 16 16" fill="none">
                <path d="M4 5h8m0 0-2-2m2 2-2 2M12 11H4m0 0 2 2m-2-2 2-2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <span class="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/80 text-white text-[10px] px-2 py-0.5 opacity-0 transition group-hover:opacity-100">
                前往候车室
              </span>
            </button>
          </div>
          <div class="space-y-2">
            <h1 class="text-[32px] sm:text-[40px] leading-tight font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 drop-shadow-sm animate-gradient-x">
              Linux DO 专属兑换
            </h1>
          </div>
        </div>

        <div class="relative group perspective-1000">
          <div class="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-[2rem] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200 animate-tilt"></div>
          <AppleCard
            variant="glass"
            class="relative mt-6 overflow-hidden shadow-2xl shadow-black/10 border border-white/40 dark:border-white/10 ring-1 ring-black/5 backdrop-blur-3xl transition-all duration-500 hover:shadow-3xl hover:scale-[1.01] animate-float"
          >
            <div class="p-6 sm:p-8 space-y-6">
            <form @submit.prevent="submitRedeem" class="space-y-6">
              <div
                class="space-y-2 group animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100 fill-mode-backwards"
                :class="{ 'animate-shake': errorMessage && !formData.email }"
              >
                <AppleInput
                  v-model.trim="formData.email"
                  label="邮箱地址"
                  placeholder="name@example.com"
                  type="email"
                  variant="filled"
                  :disabled="isLoading"
                  helperText="请填写 ChatGPT 账号邮箱，将用于接收邀请邮件"
                  :error="formData.email && !isValidEmail ? '请输入有效的邮箱格式' : ''"
                  class="transition-all duration-300 group-hover:translate-x-1"
                />
              </div>

              <div
                class="space-y-2 group animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 fill-mode-backwards"
                :class="{ 'animate-shake': errorMessage && !formData.code }"
              >
                <AppleInput
                  v-model="formData.code"
                  label="兑换码"
                  placeholder="XXXX-XXXX-XXXX"
                  type="text"
                  variant="filled"
                  :disabled="isLoading"
                  helperText="格式：XXXX-XXXX-XXXX（自动转大写）"
                  :error="formData.code && !isValidCode ? '兑换码格式应为 XXXX-XXXX-XXXX' : ''"
                  @input="handleCodeInput"
                  class="transition-all duration-300 group-hover:translate-x-1"
                />
              </div>

              <div class="pt-2 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 fill-mode-backwards">
                <AppleButton
                  type="submit"
                  variant="primary"
                  size="lg"
                  class="w-full h-[50px] text-[17px] font-medium shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                  :loading="isLoading"
                  :disabled="isLoading"
                >
                  {{ isLoading ? '正在兑换...' : '立即兑换' }}
                </AppleButton>
              </div>
            </form>

            <div v-if="successInfo" class="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out-expo">
              <div class="rounded-2xl bg-[#34C759]/10 border border-[#34C759]/20 p-5 flex gap-4">
                <div class="flex-shrink-0 mt-0.5">
                  <div class="h-6 w-6 rounded-full bg-[#34C759] flex items-center justify-center shadow-sm">
                    <CheckCircle2 class="h-4 w-4 text-white" />
                  </div>
                </div>
                <div class="flex-1 space-y-3">
                  <h3 class="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">兑换成功！</h3>
                  <div class="text-[14px] text-[#1d1d1f]/80 dark:text-white/80 space-y-3">
                    <p>您已成功兑换并加入 ChatGPT Team 账号。</p>
                    <div class="bg-white/50 dark:bg-black/20 rounded-xl p-3 border border-black/5 dark:border-white/10 space-y-1.5">
                      <p class="flex justify-between">
                        <span class="text-[#86868b]">当前成员数</span>
                        <span class="font-medium tabular-nums">{{ successInfo.userCount }} / 5</span>
                      </p>
                      <p v-if="successInfo.inviteStatus" class="flex justify-between items-center">
                        <span class="text-[#86868b]">邀请状态</span>
                        <span
                          class="px-2 py-0.5 rounded-md text-[12px] font-medium"
                          :class="successInfo.inviteStatus.includes('已发送') ? 'bg-[#34C759]/10 text-[#34C759]' : 'bg-[#FF9F0A]/10 text-[#FF9F0A]'"
                        >
                          {{ successInfo.inviteStatus }}
                        </span>
                      </p>
                    </div>
                    <p class="text-[13px] leading-normal text-[#86868b]">
                      <template v-if="successInfo.inviteStatus && successInfo.inviteStatus.includes('已发送')">
                        请查看邮箱并接收邀请邮件，然后登录 ChatGPT 使用。
                      </template>
                      <template v-else>
                        如未收到自动邀请，请联系管理员手动添加。
                      </template>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="errorMessage" class="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out-expo">
              <div class="rounded-2xl bg-[#FF3B30]/10 border border-[#FF3B30]/20 p-5 flex gap-4">
                <div class="flex-shrink-0 mt-0.5">
                  <div class="h-6 w-6 rounded-full bg-[#FF3B30] flex items-center justify-center shadow-sm">
                    <AlertCircle class="h-4 w-4 text-white" />
                  </div>
                </div>
                <div class="flex-1">
                  <h3 class="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">兑换失败</h3>
                  <p class="mt-1 text-[14px] text-[#1d1d1f]/80 dark:text-white/80">{{ errorMessage }}</p>
                </div>
              </div>
            </div>
            </div>
          </AppleCard>
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
import { useRedeemForm } from '@/composables/useRedeemForm'
import { useLinuxDoAuthSession } from '@/composables/useLinuxDoAuthSession'
import { getCurrentInterfaceScale, isApplePlatform } from '@/lib/interfaceScale'
import { AlertCircle, CheckCircle2 } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const {
  formData,
  isLoading,
  errorMessage,
  successInfo,
  isValidEmail,
  isValidCode,
  handleCodeInput,
  handleRedeem,
} = useRedeemForm('linux-do')

const router = useRouter()
const wrapperScale = ref(1)
const enableScale = ref(false)
let scaleCleanup: (() => void) | null = null

const {
  linuxDoUser,
  sessionToken,
  oauthError,
  isRedirecting,
  isFetchingUser,
  avatarUrl,
  trustLevelLabel,
  linuxDoDisplayName,
  handleReauthorize,
} = useLinuxDoAuthSession({ redirectRouteName: 'linux-do-redeem' })

const scaleWrapperStyle = computed(() => {
  if (!enableScale.value) return undefined
  const scale = wrapperScale.value || 1
  if (scale === 1) return undefined
  return {
    transform: `scale(${scale})`,
    transformOrigin: 'top center'
  }
})

const submitRedeem = async () => {
  if (!sessionToken.value) {
    errorMessage.value = '尚未获取 Linux DO session token，请重新授权'
    return
  }
  await handleRedeem({
    linuxDoSessionToken: sessionToken.value,
  })
}

const goToWaitingRoom = () => {
  router.push({ name: 'waiting-room' })
}

onMounted(() => {
  if (typeof window === 'undefined') return
  // Disable scaling for this view as the new design is compact enough
  enableScale.value = false
})

onBeforeUnmount(() => {
  if (scaleCleanup) {
    scaleCleanup()
    scaleCleanup = null
  }
})
</script>

<style scoped>
.ease-out-expo {
  transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-4px);
  }
  75% {
    transform: translateX(4px);
  }
}

.animate-shake {
  animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
}

.delay-100 {
  animation-delay: 100ms;
}

.delay-200 {
  animation-delay: 200ms;
}

.delay-300 {
  animation-delay: 300ms;
}

.fill-mode-backwards {
  animation-fill-mode: backwards;
}

.linuxdo-redeem-scale-wrapper {
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
