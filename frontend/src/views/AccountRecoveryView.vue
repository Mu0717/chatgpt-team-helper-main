<template>
  <RedeemShell>
    <div class="text-center space-y-6">
      <div class="inline-flex items-center gap-2.5 rounded-full bg-white/60 dark:bg-white/10 backdrop-blur-xl border border-white/40 dark:border-white/10 px-4 py-1.5 shadow-sm transition-transform hover:scale-105 duration-300 cursor-default">
        <span class="relative flex h-2.5 w-2.5">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#34C759]"></span>
        </span>
        <span class="text-[13px] font-medium text-gray-600 dark:text-gray-300 tracking-wide">补录通道 · 30天内有效</span>
      </div>

      <div class="space-y-3">
        <h1 class="text-[40px] leading-tight font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 via-blue-500 to-cyan-500 dark:from-emerald-400 dark:via-blue-400 dark:to-cyan-400 drop-shadow-sm animate-gradient-x">
          账号补录
        </h1>
        <p class="text-[15px] text-[#86868b]">
          输入下单邮箱，我们会查找30天内订单记录并重新发送邀请。
        </p>
      </div>
    </div>

    <div class="relative group perspective-1000">
      <div class="absolute -inset-1 bg-gradient-to-r from-emerald-500 via-blue-500 to-cyan-500 rounded-[2rem] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200 animate-tilt"></div>
      <AppleCard
        variant="glass"
        class="relative overflow-hidden shadow-2xl shadow-black/10 border border-white/40 dark:border-white/10 ring-1 ring-black/5 backdrop-blur-3xl transition-all duration-500 hover:shadow-3xl hover:scale-[1.01] animate-float"
      >
        <div class="p-8 sm:p-10 space-y-8">
          <form @submit.prevent="handleRecover" class="space-y-8">
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
                helperText="请填写下单时使用的邮箱地址"
                :error="formData.email && !isValidEmail ? '请输入有效的邮箱格式' : ''"
                class="transition-all duration-300 group-hover:translate-x-1"
              />
            </div>

            <div class="pt-2 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 fill-mode-backwards">
              <AppleButton
                type="submit"
                variant="primary"
                size="lg"
                class="w-full h-[50px] text-[17px] font-medium shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                :loading="isLoading"
                :disabled="isLoading"
              >
                {{ isLoading ? '正在补录...' : '提交补录' }}
              </AppleButton>
            </div>
          </form>

          <div
            v-if="successInfo"
            class="absolute inset-0 z-20 flex items-center justify-center p-6 bg-white/60 dark:bg-black/60 backdrop-blur-md rounded-[2rem] animate-in fade-in duration-300"
          >
            <div class="w-full rounded-2xl bg-[#34C759]/10 border border-[#34C759]/20 p-5 flex gap-4 shadow-lg backdrop-blur-xl">
              <div class="flex-shrink-0 mt-0.5">
                <div class="h-6 w-6 rounded-full bg-[#34C759] flex items-center justify-center shadow-sm">
                  <CheckCircle2 class="h-4 w-4 text-white" />
                </div>
              </div>
              <div class="flex-1 space-y-3">
                <h3 class="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">
                  {{ successInfo.recoveryMode === 'not-needed' ? '无需补录' : '补录完成' }}
                </h3>
                <div class="text-[14px] text-[#1d1d1f]/80 dark:text-white/80 space-y-3">
                  <p v-if="successInfo.recoveryMode === 'not-needed'">
                    当前工作空间仍可访问，无需补录。
                  </p>
                  <p v-else-if="successInfo.recoveryMode === 'open-account'">
                    系统已重新匹配开放账号并发送邀请。
                  </p>
                  <p v-else>
                    系统已重新发送邀请，请查收邮箱。
                  </p>
                  <div class="bg-white/50 dark:bg-black/20 rounded-xl p-3 border border-black/5 dark:border-white/10 space-y-1.5">
                    <p class="flex justify-between">
                      <span class="text-[#86868b]">账号邮箱</span>
                      <span class="font-medium">{{ successInfo.accountEmail }}</span>
                    </p>
                    <p v-if="successInfo.userCount !== null && successInfo.userCount !== undefined" class="flex justify-between">
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
                    <p v-if="windowEndsLabel" class="flex justify-between items-center">
                      <span class="text-[#86868b]">补录截止</span>
                      <span class="font-medium tabular-nums">{{ windowEndsLabel }}</span>
                    </p>
                  </div>
                  <p class="text-[13px] leading-normal text-[#86868b]">
                    如果未收到邀请邮件，请检查垃圾箱或联系客服处理。
                  </p>
                  <div class="pt-1">
                    <button
                      type="button"
                      class="text-xs text-[#34C759] hover:text-[#248a3d] font-medium transition"
                      @click="successInfo = null"
                    >
                      {{ successInfo.recoveryMode === 'not-needed' ? '知道了' : '继续补录' }}
                    </button>
                  </div>
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
                <h3 class="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">补录失败</h3>
                <p class="mt-1 text-[14px] text-[#1d1d1f]/80 dark:text-white/80">{{ errorMessage }}</p>
              </div>
            </div>
          </div>

          <div class="pt-6 border-t border-gray-200/60 dark:border-white/10">
            <h4 class="text-[13px] font-semibold text-[#86868b] uppercase tracking-wider mb-4">使用提示</h4>
            <ul class="space-y-3 text-[14px] text-[#1d1d1f]/70 dark:text-white/70">
              <li class="flex items-start gap-3">
                <span class="h-1.5 w-1.5 rounded-full bg-[#34C759] mt-2 flex-shrink-0"></span>
                <span>仅支持近30天内订单补录，账号不可用时可多次补录。</span>
              </li>
              <li class="flex items-start gap-3">
                <span class="h-1.5 w-1.5 rounded-full bg-[#34C759] mt-2 flex-shrink-0"></span>
                <span>补录有效期以原始订单时间为准，补录不会延长有效期。</span>
              </li>
              <li class="flex items-start gap-3">
                <span class="h-1.5 w-1.5 rounded-full bg-[#34C759] mt-2 flex-shrink-0"></span>
                <span>请确认邮箱与下单邮箱一致，避免匹配失败。</span>
              </li>
              <li class="flex items-start gap-3">
                <span class="h-1.5 w-1.5 rounded-full bg-[#34C759] mt-2 flex-shrink-0"></span>
                <span>补录失败或未收到邀请，请联系人工客服处理。</span>
              </li>
              <li class="flex items-start gap-3">
                <span class="h-1.5 w-1.5 rounded-full bg-[#34C759] mt-2 flex-shrink-0"></span>
                <span>若提示无需补录，说明当前工作空间仍可正常访问。</span>
              </li>
            </ul>
          </div>
        </div>
      </AppleCard>
    </div>
  </RedeemShell>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import AppleButton from '@/components/ui/apple/Button.vue'
import AppleCard from '@/components/ui/apple/Card.vue'
import AppleInput from '@/components/ui/apple/Input.vue'
import RedeemShell from '@/components/RedeemShell.vue'
import { redemptionCodeService, type AccountRecoveryData } from '@/services/api'
import { EMAIL_REGEX } from '@/lib/validation'
import { AlertCircle, CheckCircle2 } from 'lucide-vue-next'

const formData = ref({
  email: ''
})
const isLoading = ref(false)
const errorMessage = ref('')
const successInfo = ref<AccountRecoveryData | null>(null)

const isValidEmail = computed(() => {
  if (!formData.value.email) return true
  return EMAIL_REGEX.test(formData.value.email.trim())
})

const windowEndsLabel = computed(() => {
  if (!successInfo.value?.windowEndsAt) return ''
  const parsed = new Date(successInfo.value.windowEndsAt)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleString('zh-CN', { hour12: false })
})

const handleRecover = async () => {
  errorMessage.value = ''
  successInfo.value = null

  const normalizedEmail = formData.value.email.trim()

  if (!normalizedEmail) {
    errorMessage.value = '请输入邮箱地址'
    return
  }

  if (!isValidEmail.value) {
    errorMessage.value = '请输入有效的邮箱地址'
    return
  }

  isLoading.value = true

  try {
    const response = await redemptionCodeService.recoverAccount({ email: normalizedEmail })
    successInfo.value = response.data.data
    formData.value.email = ''
  } catch (error: any) {
    if (error.response?.data?.message) {
      errorMessage.value = error.response.data.message
    } else if (error.response?.status === 404) {
      errorMessage.value = '30天内不存在订单，请联系客服'
    } else if (error.response?.status === 503) {
      errorMessage.value = '暂无可用账号，请稍后再试'
    } else {
      errorMessage.value = '网络错误，请稍后重试'
    }
  } finally {
    isLoading.value = false
  }
}
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

.fill-mode-backwards {
  animation-fill-mode: backwards;
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
