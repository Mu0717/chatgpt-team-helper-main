<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { authService, purchaseService, userService, type PurchaseMyOrdersSummaryResponse } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { Copy, Link2, RefreshCw, Ticket, Users, Coins, ShoppingCart, CheckCircle2, Clock, RotateCcw, Lock, UserRound } from 'lucide-vue-next'

const router = useRouter()

const currentUser = ref(authService.getCurrentUser())
const inviteEnabled = computed<boolean | null>(() => {
  const value = currentUser.value?.inviteEnabled
  if (value === undefined || value === null) return null
  return Boolean(value)
})
const syncCurrentUser = () => {
  currentUser.value = authService.getCurrentUser()
}

const { success: showSuccessToast, error: showErrorToast } = useToast()

const inviteCode = ref<string | null>(null)
const inviteLink = computed(() => {
  if (!inviteCode.value) return ''
  try {
    const url = new URL('/register', window.location.origin)
    url.searchParams.set('invite', inviteCode.value)
    return url.toString()
  } catch {
    return `/register?invite=${encodeURIComponent(inviteCode.value)}`
  }
})

const points = ref(0)
const invitedCount = ref(0)

const inviteLoading = ref(false)
const inviteError = ref('')
const summaryLoading = ref(false)
const summaryError = ref('')
const inviteSummaryLoaded = ref(false)

const orderSummary = ref<PurchaseMyOrdersSummaryResponse | null>(null)
const orderSummaryLoading = ref(false)
const orderSummaryError = ref('')

const usernameDraft = ref('')
const usernameLoading = ref(false)
const usernameError = ref('')

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordLoading = ref(false)
const passwordError = ref('')

const statusLabel = (status?: string) => {
  if (status === 'paid') return '已支付'
  if (status === 'refunded') return '已退款'
  if (status === 'expired') return '已过期'
  if (status === 'failed') return '失败'
  if (status === 'pending_payment') return '待支付'
  if (status === 'created') return '已创建'
  return status || '未知'
}

const loadInviteSummary = async () => {
  summaryError.value = ''
  summaryLoading.value = true
  try {
    const result = await userService.getInviteSummary()
    inviteCode.value = result.inviteCode
    points.value = Number(result.points || 0)
    invitedCount.value = Number(result.invitedCount || 0)
  } catch (err: any) {
    summaryError.value = err.response?.data?.error || '加载失败'
  } finally {
    summaryLoading.value = false
  }
}

const loadInviteSummaryOnce = async () => {
  if (inviteSummaryLoaded.value) return
  inviteSummaryLoaded.value = true
  await loadInviteSummary()
}

const loadOrderSummary = async () => {
  orderSummaryError.value = ''
  orderSummaryLoading.value = true
  try {
    orderSummary.value = await purchaseService.myOrdersSummary()
  } catch (err: any) {
    orderSummaryError.value = err.response?.data?.error || '加载订单概览失败'
  } finally {
    orderSummaryLoading.value = false
  }
}

const generateInviteCode = async () => {
  inviteError.value = ''
  inviteLoading.value = true
  try {
    await userService.generateInviteCode()
    await loadInviteSummary()
    showSuccessToast('邀请码已生成')
  } catch (err: any) {
    inviteError.value = err.response?.data?.error || '生成邀请码失败'
    showErrorToast(inviteError.value)
  } finally {
    inviteLoading.value = false
  }
}

const updateUsername = async () => {
  usernameError.value = ''
  const next = usernameDraft.value.trim()
  if (!next) {
    usernameError.value = '请输入用户名'
    showErrorToast(usernameError.value)
    return
  }
  if (next.length > 64) {
    usernameError.value = '用户名过长'
    showErrorToast(usernameError.value)
    return
  }
  if (String(currentUser.value?.username || '').trim() === next) {
    showSuccessToast('用户名未变化')
    return
  }

  usernameLoading.value = true
  try {
    const result = await userService.updateUsername(next)
    if (result?.user) {
      authService.setCurrentUser(result.user)
      currentUser.value = result.user
    }
    showSuccessToast(result?.message || '用户名已更新')
  } catch (err: any) {
    usernameError.value = err.response?.data?.error || '修改用户名失败'
    showErrorToast(usernameError.value)
  } finally {
    usernameLoading.value = false
  }
}

const updatePassword = async () => {
  passwordError.value = ''
  if (!currentPassword.value || !newPassword.value || !confirmPassword.value) {
    passwordError.value = '请填写所有字段'
    showErrorToast(passwordError.value)
    return
  }
  if (newPassword.value.length < 6) {
    passwordError.value = '新密码至少需要 6 个字符'
    showErrorToast(passwordError.value)
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = '两次输入的密码不一致'
    showErrorToast(passwordError.value)
    return
  }

  passwordLoading.value = true
  try {
    await userService.changePassword(currentPassword.value, newPassword.value)
    showSuccessToast('密码已更新')
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (err: any) {
    passwordError.value = err.response?.data?.error || '修改密码失败'
    showErrorToast(passwordError.value)
  } finally {
    passwordLoading.value = false
  }
}

const copyText = async (value: string, successMessage: string) => {
  if (!value) return
  try {
    await navigator.clipboard.writeText(value)
    showSuccessToast(successMessage)
  } catch (error) {
    console.error('Copy failed', error)
    showErrorToast('复制失败，请手动复制')
  }
}

watch(inviteEnabled, async (enabled) => {
  if (enabled === true) {
    await loadInviteSummaryOnce()
  }
})

onMounted(async () => {
  window.addEventListener('auth-updated', syncCurrentUser)
  usernameDraft.value = String(currentUser.value?.username || '').trim()

  try {
    const me = await userService.getMe()
    authService.setCurrentUser(me)
    currentUser.value = me
    usernameDraft.value = String(me?.username || '').trim()
  } catch (error: any) {
    if (error?.response?.status === 401 || error?.response?.status === 403) {
      authService.logout()
      router.push('/login')
      return
    }
  }

  await loadOrderSummary()
  if (inviteEnabled.value) {
    await loadInviteSummaryOnce()
  }
})

onUnmounted(() => {
  window.removeEventListener('auth-updated', syncCurrentUser)
})
</script>

<template>
  <div class="space-y-8">
    <div v-if="inviteEnabled" class="grid gap-8 lg:grid-cols-3">
      <Card class="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
        <CardHeader class="border-b border-gray-50 bg-gray-50/30 px-8 py-6">
          <CardTitle class="text-xl font-bold text-gray-900">我的信息</CardTitle>
          <CardDescription class="text-gray-500">
            {{ currentUser?.username || 'User' }}（{{ currentUser?.email || '-' }}）
          </CardDescription>
        </CardHeader>
        <CardContent class="p-8 space-y-4">
          <div class="grid gap-4">
            <div class="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50/40 px-5 py-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Users class="w-5 h-5" />
                </div>
                <div>
                  <div class="text-sm font-semibold text-gray-900">已邀请人数</div>
                  <div class="text-xs text-gray-500">通过你的链接注册的用户数</div>
                </div>
              </div>
              <div class="text-2xl font-bold text-gray-900">{{ invitedCount }}</div>
            </div>

            <div class="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50/40 px-5 py-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Coins class="w-5 h-5" />
                </div>
                <div>
                  <div class="text-sm font-semibold text-gray-900">我的积分</div>
                  <div class="text-xs text-gray-500">被邀请用户每下单 +5</div>
                </div>
              </div>
              <div class="text-2xl font-bold text-gray-900">{{ points }}</div>
            </div>
          </div>

          <div v-if="summaryError" class="text-sm text-red-600">
            {{ summaryError }}
          </div>

          <Button
            variant="outline"
            class="w-full h-11 rounded-xl bg-white border-gray-200"
            :disabled="summaryLoading"
            @click="loadInviteSummary"
          >
            <RefreshCw class="w-4 h-4 mr-2" :class="summaryLoading ? 'animate-spin' : ''" />
            刷新
          </Button>
        </CardContent>
      </Card>

      <Card class="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden lg:col-span-2">
        <CardHeader class="border-b border-gray-50 bg-gray-50/30 px-8 py-6">
          <CardTitle class="text-xl font-bold text-gray-900">邀请链接</CardTitle>
          <CardDescription class="text-gray-500">新用户通过此链接注册后，系统会自动填写邀请码且不可编辑。</CardDescription>
        </CardHeader>
        <CardContent class="p-8 space-y-5">
          <div class="grid gap-4">
            <div>
              <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Ticket class="w-4 h-4" />
                邀请码
              </div>
              <div class="flex flex-col sm:flex-row gap-3 items-stretch">
                <Input
                  :model-value="inviteCode || ''"
                  readonly
                  placeholder="尚未生成"
                  class="h-11 bg-gray-50 border-gray-200 rounded-xl font-mono"
                />
                <div class="flex gap-3">
                  <Button
                    class="h-11 rounded-xl bg-black hover:bg-gray-800 text-white"
                    :disabled="inviteLoading"
                    @click="generateInviteCode"
                  >
                    {{ inviteCode ? '重新获取' : '生成邀请码' }}
                  </Button>
                  <Button
                    variant="outline"
                    class="h-11 rounded-xl bg-white border-gray-200"
                    :disabled="!inviteCode"
                    @click="copyText(inviteCode || '', '邀请码已复制')"
                  >
                    <Copy class="w-4 h-4 mr-2" />
                    复制
                  </Button>
                </div>
              </div>
              <div v-if="inviteError" class="text-sm text-red-600 mt-2">
                {{ inviteError }}
              </div>
            </div>

            <div>
              <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Link2 class="w-4 h-4" />
                邀请注册链接
              </div>
              <div class="flex flex-col sm:flex-row gap-3 items-stretch">
                <Input
                  :model-value="inviteLink"
                  readonly
                  placeholder="请先生成邀请码"
                  class="h-11 bg-gray-50 border-gray-200 rounded-xl font-mono"
                />
                <Button
                  variant="outline"
                  class="h-11 rounded-xl bg-white border-gray-200"
                  :disabled="!inviteLink"
                  @click="copyText(inviteLink, '邀请链接已复制')"
                >
                  <Copy class="w-4 h-4 mr-2" />
                  复制链接
                </Button>
              </div>
              <div class="text-xs text-gray-500 mt-2">
                提示：被邀请的新用户每下一单，你将获得 5 积分。
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <div class="grid gap-8 lg:grid-cols-2">
      <Card class="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
        <CardHeader class="border-b border-gray-50 bg-gray-50/30 px-8 py-6">
          <CardTitle class="text-xl font-bold text-gray-900">订单预览</CardTitle>
          <CardDescription class="text-gray-500">查看你的订单概览与最近订单。</CardDescription>
        </CardHeader>
        <CardContent class="p-8 space-y-6">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50/40 px-5 py-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <ShoppingCart class="w-5 h-5" />
                </div>
                <div>
                  <div class="text-sm font-semibold text-gray-900">总订单</div>
                  <div class="text-xs text-gray-500">已绑定到本账号</div>
                </div>
              </div>
              <div class="text-2xl font-bold text-gray-900">{{ orderSummary?.total ?? 0 }}</div>
            </div>

            <div class="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50/40 px-5 py-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center">
                  <CheckCircle2 class="w-5 h-5" />
                </div>
                <div>
                  <div class="text-sm font-semibold text-gray-900">已支付</div>
                  <div class="text-xs text-gray-500">支付成功的订单</div>
                </div>
              </div>
              <div class="text-2xl font-bold text-gray-900">{{ orderSummary?.paid ?? 0 }}</div>
            </div>

            <div class="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50/40 px-5 py-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-yellow-50 text-yellow-600 flex items-center justify-center">
                  <Clock class="w-5 h-5" />
                </div>
                <div>
                  <div class="text-sm font-semibold text-gray-900">待支付</div>
                  <div class="text-xs text-gray-500">已创建/待支付</div>
                </div>
              </div>
              <div class="text-2xl font-bold text-gray-900">{{ orderSummary?.pending ?? 0 }}</div>
            </div>

            <div class="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50/40 px-5 py-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <RotateCcw class="w-5 h-5" />
                </div>
                <div>
                  <div class="text-sm font-semibold text-gray-900">已退款</div>
                  <div class="text-xs text-gray-500">退款完成的订单</div>
                </div>
              </div>
              <div class="text-2xl font-bold text-gray-900">{{ orderSummary?.refunded ?? 0 }}</div>
            </div>
          </div>

          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div class="text-sm font-semibold text-gray-900">最近订单</div>
              <Button
                variant="outline"
                class="h-9 rounded-xl bg-white border-gray-200"
                :disabled="orderSummaryLoading"
                @click="loadOrderSummary"
              >
                <RefreshCw class="w-4 h-4 mr-2" :class="orderSummaryLoading ? 'animate-spin' : ''" />
                刷新
              </Button>
            </div>

            <div v-if="orderSummaryError" class="text-sm text-red-600">
              {{ orderSummaryError }}
            </div>

            <div v-if="orderSummaryLoading && !orderSummary" class="py-6 text-sm text-gray-500">
              加载中…
            </div>

            <div v-else-if="(orderSummary?.recentOrders || []).length === 0" class="py-6 text-sm text-gray-500">
              暂无订单
            </div>

            <div v-else class="divide-y divide-gray-100 rounded-2xl border border-gray-100 overflow-hidden">
              <div
                v-for="item in orderSummary?.recentOrders || []"
                :key="item.orderNo"
                class="flex items-center justify-between px-5 py-4 bg-white"
              >
                <div class="min-w-0">
                  <div class="text-sm font-semibold text-gray-900 truncate">
                    {{ item.productName }}
                  </div>
                  <div class="text-xs text-gray-500 font-mono truncate">
                    {{ item.orderNo }}
                  </div>
                </div>
                <div class="text-right flex-shrink-0">
                  <div class="text-sm font-semibold text-gray-900">
                    {{ item.amount }}
                  </div>
                  <div class="text-xs text-gray-500">
                    {{ statusLabel(item.status) }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="flex flex-col sm:flex-row gap-3">
            <Button
              class="h-11 rounded-xl bg-black hover:bg-gray-800 text-white"
              @click="router.push('/admin/my-orders')"
            >
              查看我的订单
            </Button>
            <Button
              variant="outline"
              class="h-11 rounded-xl bg-white border-gray-200"
              @click="router.push('/purchase')"
            >
              去下单
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card class="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
        <CardHeader class="border-b border-gray-50 bg-gray-50/30 px-8 py-6">
          <CardTitle class="text-xl font-bold text-gray-900">账号设置</CardTitle>
          <CardDescription class="text-gray-500">修改用户名与密码。</CardDescription>
        </CardHeader>
        <CardContent class="p-8 space-y-8">
          <div class="space-y-4">
            <div class="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <UserRound class="w-4 h-4 text-gray-500" />
              修改用户名
            </div>
            <div class="space-y-2">
              <Label class="text-xs font-semibold text-gray-500 uppercase tracking-wider">用户名</Label>
              <Input
                v-model="usernameDraft"
                class="h-11 bg-gray-50 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                placeholder="请输入新用户名"
                :disabled="usernameLoading"
              />
              <div v-if="usernameError" class="text-sm text-red-600">
                {{ usernameError }}
              </div>
            </div>
            <Button
              class="h-11 rounded-xl bg-black hover:bg-gray-800 text-white"
              :disabled="usernameLoading"
              @click="updateUsername"
            >
              {{ usernameLoading ? '保存中...' : '保存用户名' }}
            </Button>
          </div>

          <div class="h-px bg-gray-100"></div>

          <div class="space-y-4">
            <div class="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Lock class="w-4 h-4 text-gray-500" />
              修改密码
            </div>
            <div class="space-y-2">
              <Label class="text-xs font-semibold text-gray-500 uppercase tracking-wider">当前密码</Label>
              <Input
                v-model="currentPassword"
                type="password"
                class="h-11 bg-gray-50 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                placeholder="请输入当前密码"
                :disabled="passwordLoading"
              />
            </div>
            <div class="space-y-2">
              <Label class="text-xs font-semibold text-gray-500 uppercase tracking-wider">新密码</Label>
              <Input
                v-model="newPassword"
                type="password"
                class="h-11 bg-gray-50 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                placeholder="至少 6 个字符"
                :disabled="passwordLoading"
              />
            </div>
            <div class="space-y-2">
              <Label class="text-xs font-semibold text-gray-500 uppercase tracking-wider">确认新密码</Label>
              <Input
                v-model="confirmPassword"
                type="password"
                class="h-11 bg-gray-50 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                placeholder="再次输入新密码"
                :disabled="passwordLoading"
                @keydown.enter.prevent="updatePassword"
              />
              <div v-if="passwordError" class="text-sm text-red-600">
                {{ passwordError }}
              </div>
            </div>
            <Button
              class="h-11 rounded-xl bg-black hover:bg-gray-800 text-white"
              :disabled="passwordLoading"
              @click="updatePassword"
            >
              {{ passwordLoading ? '提交中...' : '修改密码' }}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>

  </div>
</template>
