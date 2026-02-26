<template>
  <RedeemShell :maxWidth="'max-w-[560px]'">
    <div class="text-center space-y-6">
      <div
        class="inline-flex items-center gap-2.5 rounded-full bg-white/60 dark:bg-white/10 backdrop-blur-xl border border-white/40 dark:border-white/10 px-4 py-1.5 shadow-sm transition-transform hover:scale-105 duration-300 cursor-default"
      >
        <span class="relative flex h-2.5 w-2.5">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#34C759]"></span>
        </span>
        <span class="text-[13px] font-medium text-gray-600 dark:text-gray-300 tracking-wide">订单查询</span>
      </div>

      <div class="space-y-3">
        <h1
          class="text-[40px] leading-tight font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 via-blue-500 to-cyan-500 dark:from-emerald-400 dark:via-blue-400 dark:to-cyan-400 drop-shadow-sm animate-gradient-x"
        >
          查询订单
        </h1>
        <p class="text-[15px] text-[#86868b]">
          输入下单邮箱与订单号，查询订单状态。
          <RouterLink class="text-[#007AFF] hover:text-[#005FCC] font-medium" to="/purchase">返回购买</RouterLink>
        </p>
      </div>
    </div>

    <div class="relative group perspective-1000">
      <div
        class="absolute -inset-1 bg-gradient-to-r from-emerald-500 via-blue-500 to-cyan-500 rounded-[2rem] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200 animate-tilt"
      ></div>
      <AppleCard
        variant="glass"
        class="relative overflow-hidden shadow-2xl shadow-black/10 border border-white/40 dark:border-white/10 ring-1 ring-black/5 backdrop-blur-3xl transition-all duration-500 hover:shadow-3xl hover:scale-[1.01] animate-float"
      >
        <div class="p-8 sm:p-10 space-y-8">
          <form class="space-y-6" @submit.prevent="handleQuery">
            <AppleInput
              v-model.trim="email"
              label="邮箱地址"
              placeholder="name@example.com"
              type="email"
              variant="filled"
              :disabled="loading"
              helperText="请填写下单时使用的邮箱"
              :error="email && !isValidEmail ? '请输入有效的邮箱格式' : ''"
            />

            <AppleInput
              v-model.trim="orderNo"
              label="订单号"
              placeholder="20250101123045123456"
              type="text"
              variant="filled"
              :disabled="loading"
              helperText="支付创建的商户订单号"
            />

            <AppleButton type="submit" variant="primary" size="lg" class="w-full h-[50px]" :loading="loading" :disabled="loading">
              {{ loading ? '正在查询...' : '查询订单' }}
            </AppleButton>
          </form>

          <div v-if="errorMessage" class="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out-expo">
            <div class="rounded-2xl bg-[#FF3B30]/10 border border-[#FF3B30]/20 p-5 flex gap-4">
              <div class="flex-shrink-0 mt-0.5">
                <div class="h-6 w-6 rounded-full bg-[#FF3B30] flex items-center justify-center shadow-sm">
                  <AlertCircle class="h-4 w-4 text-white" />
                </div>
              </div>
              <div class="flex-1">
                <h3 class="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">查询失败</h3>
                <p class="mt-1 text-[14px] text-[#1d1d1f]/80 dark:text-white/80">{{ errorMessage }}</p>
              </div>
            </div>
          </div>

          <div v-if="result?.order" class="rounded-2xl bg-white/50 dark:bg-black/20 border border-black/5 dark:border-white/10 p-5 space-y-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-[13px] text-[#86868b]">订单号</p>
                <p class="text-[15px] font-semibold tabular-nums text-[#1d1d1f] dark:text-white">{{ result.order.orderNo }}</p>
              </div>
              <div class="text-right">
                <p class="text-[13px] text-[#86868b]">状态</p>
                <p class="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">{{ statusLabel(result.order.status) }}</p>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <p class="text-[13px] text-[#86868b]">金额</p>
                <p class="text-[15px] font-semibold tabular-nums text-[#1d1d1f] dark:text-white">¥ {{ result.order.amount }}</p>
              </div>
              <div class="text-right">
                <p class="text-[13px] text-[#86868b]">有效期</p>
                <p class="text-[15px] font-semibold tabular-nums text-[#1d1d1f] dark:text-white">{{ result.order.serviceDays }} 天</p>
              </div>
            </div>

            <div class="text-[13px] text-[#86868b]">
              退款仅支持后台处理，如需退款请联系管理员。
            </div>
          </div>
        </div>
      </AppleCard>
    </div>
  </RedeemShell>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import RedeemShell from '@/components/RedeemShell.vue'
import AppleCard from '@/components/ui/apple/Card.vue'
import AppleInput from '@/components/ui/apple/Input.vue'
import AppleButton from '@/components/ui/apple/Button.vue'
import { purchaseService, type PurchaseOrderQueryResponse } from '@/services/api'
import { EMAIL_REGEX } from '@/lib/validation'
import { AlertCircle } from 'lucide-vue-next'

const email = ref('')
const orderNo = ref('')
const loading = ref(false)
const errorMessage = ref('')
const result = ref<PurchaseOrderQueryResponse | null>(null)

const isValidEmail = computed(() => {
  if (!email.value) return true
  return EMAIL_REGEX.test(email.value.trim())
})

const statusLabel = (status?: string) => {
  if (status === 'paid') return '已支付'
  if (status === 'refunded') return '已退款'
  if (status === 'expired') return '已过期'
  if (status === 'failed') return '失败'
  if (status === 'pending_payment') return '待支付'
  return status || '未知'
}

const handleQuery = async () => {
  errorMessage.value = ''
  result.value = null

  const normalizedEmail = email.value.trim()
  const normalizedOrderNo = orderNo.value.trim()

  if (!normalizedEmail) {
    errorMessage.value = '请输入邮箱地址'
    return
  }
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    errorMessage.value = '请输入有效的邮箱地址'
    return
  }
  if (!normalizedOrderNo) {
    errorMessage.value = '请输入订单号'
    return
  }

  loading.value = true
  try {
    result.value = await purchaseService.getOrder(normalizedOrderNo, normalizedEmail, { sync: true })
  } catch (error: any) {
    errorMessage.value = error?.response?.data?.error || '查询失败，请稍后再试'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.ease-out-expo {
  transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
}
</style>
