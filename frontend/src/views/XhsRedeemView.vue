<template>
  <RedeemShell>
    <div class="text-center space-y-6">
      <div class="inline-flex items-center gap-2.5 rounded-full bg-white/60 dark:bg-white/10 backdrop-blur-xl border border-white/40 dark:border-white/10 px-4 py-1.5 shadow-sm transition-transform hover:scale-105 duration-300 cursor-default">
        <span class="relative flex h-2.5 w-2.5">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FF2D55]"></span>
        </span>
        <span class="text-[13px] font-medium text-gray-600 dark:text-gray-300 tracking-wide">小红书订单专用 · 自动匹配兑换码</span>
      </div>

      <div class="space-y-3">
        <h1 class="text-[40px] leading-tight font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-red-500 to-orange-400 dark:from-pink-400 dark:via-red-400 dark:to-orange-300 drop-shadow-sm animate-gradient-x">
          小红书订单兑换
        </h1>
      </div>
    </div>

    <div class="relative group perspective-1000">
      <div class="absolute -inset-1 bg-gradient-to-r from-pink-500 via-red-500 to-orange-400 rounded-[2rem] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200 animate-tilt"></div>
      <AppleCard
        variant="glass"
        class="relative overflow-hidden shadow-2xl shadow-black/10 border border-white/40 dark:border-white/10 ring-1 ring-black/5 backdrop-blur-3xl transition-all duration-500 hover:shadow-3xl hover:scale-[1.01] animate-float"
      >
        <div class="p-8 sm:p-10 space-y-8">
          <form @submit.prevent="handleRedeem" class="space-y-8">
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
                helperText="请输入你用来登录ChatGPT的邮箱"
                :error="formData.email && !isValidEmail ? '请输入有效的邮箱格式' : ''"
                class="transition-all duration-300 group-hover:translate-x-1"
              />
            </div>

            <div
              class="space-y-2 group animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 fill-mode-backwards"
              :class="{ 'animate-shake': errorMessage && !formData.orderNumber }"
            >
              <AppleInput
                v-model="formData.orderNumber"
                label="小红书订单号"
                placeholder="PXXXXXXXXXXXXXX"
                type="text"
                variant="filled"
                :disabled="isLoading"
                helperText="订单号可在小红书订单列表中查看（通常以 P 开头）"
                :error="formData.orderNumber && !isValidOrderNumber ? '订单号格式不正确，请输入以 P 开头的订单号' : ''"
                @input="handleOrderInput"
                class="transition-all duration-300 group-hover:translate-x-1"
              />
            </div>

            <div class="pt-2 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 fill-mode-backwards">
              <AppleButton
                type="submit"
                variant="primary"
                size="lg"
                class="w-full h-[50px] text-[17px] font-medium shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                :loading="isLoading"
                :disabled="isLoading"
              >
                {{ submitButtonLabel }}
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
                <h3 class="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">兑换成功！</h3>
                <div class="text-[14px] text-[#1d1d1f]/80 dark:text-white/80 space-y-3">
                  <p>系统已完成兑换并将您加入 ChatGPT Team 账号。</p>
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
                      请留意邮箱邀请，接受后即可登录使用。
                    </template>
                    <template v-else>
                      如未收到自动邀请，请联系管理员协助添加。
                    </template>
                  </p>
                  <div class="pt-1">
                    <button
                      type="button"
                      class="text-xs text-[#FF2D55] hover:text-[#c81c42] font-medium transition"
                      @click="successInfo = null"
                    >
                      继续兑换
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
                <h3 class="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">兑换失败</h3>
                <p class="mt-1 text-[14px] text-[#1d1d1f]/80 dark:text-white/80">{{ errorMessage }}</p>
              </div>
            </div>
          </div>

          <div class="pt-6 border-t border-gray-200/60 dark:border-white/10 space-y-3">
            <h4 class="text-[13px] font-semibold text-[#86868b] uppercase tracking-wider">使用说明</h4>
            <ul class="space-y-3 text-[14px] text-[#1d1d1f]/70 dark:text-white/70">
              <li class="flex items-start gap-3">
                <span class="h-1.5 w-1.5 rounded-full bg-[#FF2D55] mt-2 flex-shrink-0"></span>
                <RouterLink
                  to="/redeem/account-recovery"
                  class="text-[#FF2D55] hover:text-[#c81c42] font-medium transition"
                >
                  掉号补录请点此处
                </RouterLink>
              </li>
              <li class="flex items-start gap-3">
                <span class="h-1.5 w-1.5 rounded-full bg-[#FF2D55] mt-2 flex-shrink-0"></span>
                <span>兑换失败/未收到邀请邮件，请直接发送邮箱给客服处理（请不要发截图哦～）</span>
              </li>
              <li class="flex items-start gap-3">
                <span class="h-1.5 w-1.5 rounded-full bg-[#FF2D55] mt-2 flex-shrink-0"></span>
                <span>兑换通常需要 30-60 秒，请耐心等待并保持页面打开，系统完成后会自动提示</span>
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
import { redemptionCodeService } from '@/services/api'
import { EMAIL_REGEX } from '@/lib/validation'
import type { RedeemSuccessInfo } from '@/composables/useRedeemForm'
import { AlertCircle, CheckCircle2 } from 'lucide-vue-next'

const ORDER_REGEX = /^P[0-9A-Z]{6,}$/

const formData = ref({
  email: '',
  orderNumber: ''
})
const isLoading = ref(false)
const loadingStage = ref<'idle' | 'check' | 'sync' | 'redeem'>('idle')
const errorMessage = ref('')
const successInfo = ref<RedeemSuccessInfo | null>(null)

const isValidEmail = computed(() => {
  if (!formData.value.email) return true
  return EMAIL_REGEX.test(formData.value.email.trim())
})

const isValidOrderNumber = computed(() => {
  if (!formData.value.orderNumber) return true
  return ORDER_REGEX.test(formData.value.orderNumber.trim().toUpperCase())
})

const submitButtonLabel = computed(() => {
  if (!isLoading.value) {
    return '立即兑换'
  }
  if (loadingStage.value === 'check') {
    return '正在查询订单...'
  }
  if (loadingStage.value === 'sync') {
    return '正在同步订单...'
  }
  return '正在兑换...'
})

const handleOrderInput = (value: string | Event) => {
  let input = ''
  if (typeof value === 'string') {
    input = value
  } else {
    input = (value.target as HTMLInputElement).value
  }
  formData.value.orderNumber = input.toUpperCase().replace(/[^0-9A-Z]/g, '')
}

const handleRedeem = async () => {
  errorMessage.value = ''
  successInfo.value = null

  const normalizedEmail = formData.value.email.trim()
  const normalizedOrderNumber = formData.value.orderNumber.trim().toUpperCase()

  if (!normalizedEmail) {
    errorMessage.value = '请输入邮箱地址'
    return
  }

  if (!isValidEmail.value) {
    errorMessage.value = '请输入有效的邮箱地址'
    return
  }

  if (!normalizedOrderNumber) {
    errorMessage.value = '请输入小红书订单号'
    return
  }

  if (!isValidOrderNumber.value) {
    errorMessage.value = '订单号格式不正确，请检查后重试'
    return
  }

  isLoading.value = true
  loadingStage.value = 'check'
  try {
    const checkResponse = await redemptionCodeService.checkXhsOrder({
      orderNumber: normalizedOrderNumber
    })

    let orderExists = Boolean(checkResponse.data?.order)

    if (!orderExists) {
      loadingStage.value = 'sync'
      await redemptionCodeService.syncXhsOrder({
        orderNumber: normalizedOrderNumber
      })
      const verifyResponse = await redemptionCodeService.checkXhsOrder({
        orderNumber: normalizedOrderNumber
      })
      orderExists = Boolean(verifyResponse.data?.order)
      if (!orderExists) {
        throw new Error('未找到对应订单，请确认订单号是否正确')
      }
    }

    loadingStage.value = 'redeem'
    const response = await redemptionCodeService.redeemXhsOrder({
      email: normalizedEmail,
      orderNumber: normalizedOrderNumber
    })
    successInfo.value = {
      accountEmail: response.data.data.accountEmail,
      userCount: response.data.data.userCount,
      inviteStatus: response.data.data.inviteStatus
    }
    formData.value = {
      email: '',
      orderNumber: ''
    }
  } catch (error: any) {
    const status = error?.response?.status
    const errorCode = error?.response?.data?.errorCode
    const raw =
      error?.response?.data?.error ||
      error?.response?.data?.message ||
      error?.message ||
      ''
    const message = typeof raw === 'string' && raw.trim() ? raw : '兑换失败，请稍后再试'

    const shouldContactSupport =
      errorCode === 'xhs_codes_not_configured' ||
      errorCode === 'xhs_no_today_codes' ||
      errorCode === 'xhs_today_codes_exhausted' ||
      errorCode === 'xhs_codes_unavailable' ||
      (status === 503 && message.includes('小红书') && message.includes('兑换码') && message.includes('今日'))

    errorMessage.value = shouldContactSupport ? '暂无可用兑换码，请联系管理员补货' : message
  } finally {
    isLoading.value = false
    loadingStage.value = 'idle'
  }
}
</script>

<style scoped>
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
</style>
