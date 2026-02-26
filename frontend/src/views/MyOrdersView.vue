<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { authService, purchaseService, type PurchaseOrder, type PurchaseMyOrdersParams } from '@/services/api'
import { formatShanghaiDate } from '@/lib/datetime'
import { useAppConfigStore } from '@/stores/appConfig'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { Link2, RefreshCw, ShoppingCart, CheckCircle2, Clock, RotateCcw, Ban, AlertCircle } from 'lucide-vue-next'

const router = useRouter()
const appConfigStore = useAppConfigStore()
const { success: showSuccessToast, error: showErrorToast, warning: showWarningToast } = useToast()

const orders = ref<PurchaseOrder[]>([])
const loading = ref(false)
const error = ref('')
const teleportReady = ref(false)

const paginationMeta = ref({ page: 1, pageSize: 20, total: 0 })
const totalPages = computed(() => Math.max(1, Math.ceil(paginationMeta.value.total / paginationMeta.value.pageSize)))

const bindOrderNo = ref('')
const binding = ref(false)

const dateFormatOptions = computed(() => ({
  timeZone: appConfigStore.timezone,
  locale: appConfigStore.locale,
}))

const formatDate = (value?: string | null) => formatShanghaiDate(value, dateFormatOptions.value)

const statusLabel = (status?: string) => {
  if (status === 'paid') return '已支付'
  if (status === 'refunded') return '已退款'
  if (status === 'expired') return '已过期'
  if (status === 'failed') return '失败'
  if (status === 'pending_payment') return '待支付'
  if (status === 'created') return '已创建'
  return status || '未知'
}

const getStatusColor = (status?: string) => {
  switch (status) {
    case 'paid': return 'bg-green-100 text-green-700 border-green-200'
    case 'refunded': return 'bg-purple-100 text-purple-700 border-purple-200'
    case 'pending_payment': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    case 'created': return 'bg-gray-100 text-gray-700 border-gray-200'
    case 'failed': return 'bg-red-100 text-red-700 border-red-200'
    case 'expired': return 'bg-gray-100 text-gray-500 border-gray-200'
    default: return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

const stats = computed(() => {
  const total = paginationMeta.value.total
  const paid = orders.value.filter(o => o.status === 'paid').length
  const refunded = orders.value.filter(o => o.status === 'refunded').length
  const pending = orders.value.filter(o => o.status === 'pending_payment' || o.status === 'created').length
  return { total, paid, refunded, pending }
})

const buildParams = (): PurchaseMyOrdersParams => ({
  page: paginationMeta.value.page,
  pageSize: paginationMeta.value.pageSize,
})

const loadOrders = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await purchaseService.myListOrders(buildParams())
    orders.value = response.orders || []
    paginationMeta.value = response.pagination || { page: 1, pageSize: 20, total: 0 }
  } catch (err: any) {
    if (err?.response?.status === 401 || err?.response?.status === 403) {
      authService.logout()
      router.push('/login')
      return
    }
    const message = err?.response?.data?.error || '加载订单失败'
    error.value = message
    showErrorToast(message)
  } finally {
    loading.value = false
  }
}

const goToPage = (page: number) => {
  if (page < 1 || page > totalPages.value || page === paginationMeta.value.page) return
  paginationMeta.value.page = page
  loadOrders()
}

const bindOrder = async () => {
  const orderNo = bindOrderNo.value.trim()
  if (!orderNo) {
    showWarningToast('请输入订单号')
    return
  }
  binding.value = true
  try {
    await purchaseService.myBindOrder(orderNo)
    showSuccessToast('关联成功')
    bindOrderNo.value = ''
    paginationMeta.value.page = 1
    await loadOrders()
  } catch (err: any) {
    if (err?.response?.status === 401 || err?.response?.status === 403) {
      authService.logout()
      router.push('/login')
      return
    }
    const message = err?.response?.data?.error || '关联失败'
    showErrorToast(message)
  } finally {
    binding.value = false
  }
}

const openPayUrl = (url?: string | null) => {
  const normalized = String(url || '').trim()
  if (!normalized) {
    showErrorToast('缺少支付链接')
    return
  }
  window.open(normalized, '_blank')
}

onMounted(async () => {
  await nextTick()
  teleportReady.value = !!document.getElementById('header-actions')

  if (!authService.isAuthenticated()) {
    router.push('/login')
    return
  }
  await loadOrders()
})

onUnmounted(() => {
  teleportReady.value = false
})
</script>

<template>
  <div class="space-y-8">
    <Teleport v-if="teleportReady" to="#header-actions">
      <Button
        variant="outline"
        class="bg-white border-gray-200 text-gray-700 hover:bg-gray-50 h-10 rounded-xl px-4"
        :disabled="loading"
        @click="loadOrders"
      >
        <RefreshCw class="h-4 w-4 mr-2" :class="loading ? 'animate-spin' : ''" />
        刷新列表
      </Button>
    </Teleport>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col gap-4 hover:shadow-md transition-all duration-300">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-gray-500">总订单</span>
          <div class="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
            <ShoppingCart class="w-5 h-5" />
          </div>
        </div>
        <div>
          <span class="text-3xl font-bold text-gray-900 tracking-tight">{{ stats.total }}</span>
          <span class="text-xs text-gray-400 ml-2">笔</span>
        </div>
      </div>

      <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col gap-4 hover:shadow-md transition-all duration-300">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-gray-500">已支付</span>
          <div class="w-10 h-10 rounded-2xl bg-green-50 flex items-center justify-center text-green-600">
            <CheckCircle2 class="w-5 h-5" />
          </div>
        </div>
        <div>
          <span class="text-3xl font-bold text-gray-900 tracking-tight">{{ stats.paid }}</span>
          <span class="text-xs text-gray-400 ml-2">笔</span>
        </div>
      </div>

      <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col gap-4 hover:shadow-md transition-all duration-300">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-gray-500">待支付</span>
          <div class="w-10 h-10 rounded-2xl bg-yellow-50 flex items-center justify-center text-yellow-600">
            <Clock class="w-5 h-5" />
          </div>
        </div>
        <div>
          <span class="text-3xl font-bold text-gray-900 tracking-tight">{{ stats.pending }}</span>
          <span class="text-xs text-gray-400 ml-2">笔</span>
        </div>
      </div>

      <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col gap-4 hover:shadow-md transition-all duration-300">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-gray-500">已退款</span>
          <div class="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
            <RotateCcw class="w-5 h-5" />
          </div>
        </div>
        <div>
          <span class="text-3xl font-bold text-gray-900 tracking-tight">{{ stats.refunded }}</span>
          <span class="text-xs text-gray-400 ml-2">笔</span>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
      <div class="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
        <div class="space-y-1">
          <h3 class="text-lg font-semibold text-gray-900">关联订单</h3>
          <p class="text-sm text-gray-500">输入订单号，将历史订单绑定到当前账号后即可在此查看。</p>
        </div>

        <div class="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <Input
            v-model="bindOrderNo"
            class="h-10 rounded-xl bg-white"
            placeholder="请输入订单号"
            :disabled="binding"
            @keydown.enter.prevent="bindOrder"
          />
          <Button class="h-10 rounded-xl" :disabled="binding" @click="bindOrder">
            <Link2 class="h-4 w-4 mr-2" :class="binding ? 'animate-pulse' : ''" />
            关联订单
          </Button>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
      <div class="flex items-center justify-between gap-4 mb-4">
        <h3 class="text-lg font-semibold text-gray-900">订单列表</h3>
        <div class="text-sm text-gray-500">第 {{ paginationMeta.page }} / {{ totalPages }} 页</div>
      </div>

      <div v-if="loading" class="py-16 text-center text-gray-500">
        <RefreshCw class="h-5 w-5 inline-block mr-2 animate-spin" />
        加载中…
      </div>

      <div v-else-if="error" class="py-10 rounded-2xl bg-red-50 border border-red-100 px-4">
        <div class="flex items-start gap-3">
          <AlertCircle class="h-5 w-5 text-red-500 mt-0.5" />
          <div>
            <p class="text-sm font-semibold text-red-700">加载失败</p>
            <p class="text-sm text-red-600 mt-1">{{ error }}</p>
          </div>
        </div>
      </div>

      <div v-else-if="orders.length === 0" class="py-16 text-center text-gray-500">
        <Ban class="h-5 w-5 inline-block mr-2" />
        暂无已关联订单
      </div>

      <div v-else class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="text-left text-gray-500 border-b">
              <th class="py-3 pr-4 font-medium">订单号</th>
              <th class="py-3 pr-4 font-medium">商品</th>
              <th class="py-3 pr-4 font-medium">金额</th>
              <th class="py-3 pr-4 font-medium">状态</th>
              <th class="py-3 pr-4 font-medium">创建时间</th>
              <th class="py-3 pr-0 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in orders" :key="order.orderNo" class="border-b last:border-b-0 hover:bg-gray-50/60">
              <td class="py-3 pr-4 font-mono text-xs text-gray-900 whitespace-nowrap">{{ order.orderNo }}</td>
              <td class="py-3 pr-4 text-gray-900">{{ order.productName }}</td>
              <td class="py-3 pr-4 tabular-nums text-gray-900">¥ {{ order.amount }}</td>
              <td class="py-3 pr-4">
                <span class="inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-medium" :class="getStatusColor(order.status)">
                  {{ statusLabel(order.status) }}
                </span>
              </td>
              <td class="py-3 pr-4 text-gray-600 whitespace-nowrap">{{ formatDate(order.createdAt) }}</td>
              <td class="py-3 pr-0 text-right whitespace-nowrap">
                <Button
                  v-if="order.status === 'pending_payment' && order.img"
                  variant="outline"
                  size="sm"
                  class="h-8 text-xs border-gray-200 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                  @click="openPayUrl(order.img)"
                >
                  <Link2 class="h-3 w-3 mr-1.5" />
                  去付款
                </Button>
                <span v-else class="text-gray-300 text-xs">-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="totalPages > 1" class="flex items-center justify-between mt-4">
        <Button variant="outline" class="h-9 rounded-xl" :disabled="paginationMeta.page <= 1" @click="goToPage(paginationMeta.page - 1)">
          上一页
        </Button>
        <div class="text-sm text-gray-500">共 {{ paginationMeta.total }} 笔</div>
        <Button
          variant="outline"
          class="h-9 rounded-xl"
          :disabled="paginationMeta.page >= totalPages"
          @click="goToPage(paginationMeta.page + 1)"
        >
          下一页
        </Button>
      </div>
    </div>
  </div>
</template>
