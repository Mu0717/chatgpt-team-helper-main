<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authService } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const router = useRouter()
const route = useRoute()

const email = ref('')
const code = ref('')
const password = ref('')
const confirmPassword = ref('')
const inviteCode = ref('')
const inviteLocked = ref(false)

const error = ref('')
const success = ref('')
const loading = ref(false)
const sendingCode = ref(false)
const countdown = ref(0)

let countdownTimer: number | null = null

const startCountdown = (seconds: number) => {
  if (countdownTimer) {
    window.clearInterval(countdownTimer)
    countdownTimer = null
  }
  countdown.value = seconds
  countdownTimer = window.setInterval(() => {
    countdown.value = Math.max(0, countdown.value - 1)
    if (countdown.value <= 0 && countdownTimer) {
      window.clearInterval(countdownTimer)
      countdownTimer = null
    }
  }, 1000)
}

onUnmounted(() => {
  if (countdownTimer) {
    window.clearInterval(countdownTimer)
    countdownTimer = null
  }
})

const applyInviteFromQuery = () => {
  const raw = route.query.invite ?? route.query.inviteCode ?? route.query.code
  const value = Array.isArray(raw) ? raw[0] : raw
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (normalized) {
    inviteCode.value = normalized
    inviteLocked.value = true
  } else {
    inviteLocked.value = false
  }
}

onMounted(() => {
  applyInviteFromQuery()
})

watch(() => route.query, () => applyInviteFromQuery(), { deep: true })

const handleSendCode = async () => {
  error.value = ''
  success.value = ''

  const trimmedEmail = email.value.trim().toLowerCase()
  if (!trimmedEmail) {
    error.value = '请输入邮箱'
    return
  }

  sendingCode.value = true
  try {
    await authService.sendRegisterCode(trimmedEmail)
    success.value = '验证码已发送，请检查邮箱'
    startCountdown(60)
  } catch (err: any) {
    error.value = err.response?.data?.error || '发送验证码失败，请重试'
  } finally {
    sendingCode.value = false
  }
}

const handleRegister = async () => {
  error.value = ''
  success.value = ''
  loading.value = true

  try {
    const trimmedEmail = email.value.trim().toLowerCase()
    if (!trimmedEmail) {
      error.value = '请输入邮箱'
      return
    }
    if (!code.value.trim()) {
      error.value = '请输入验证码'
      return
    }
    if (!password.value || password.value.length < 6) {
      error.value = '密码至少需要 6 个字符'
      return
    }
    if (password.value !== confirmPassword.value) {
      error.value = '两次输入的密码不一致'
      return
    }

    await authService.register({
      email: trimmedEmail,
      code: code.value.trim(),
      password: password.value,
      ...(inviteCode.value.trim() ? { inviteCode: inviteCode.value.trim() } : {}),
    })

    router.push('/admin')
  } catch (err: any) {
    error.value = err.response?.data?.error || '注册失败，请重试'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="relative min-h-screen w-full overflow-hidden bg-white flex items-center justify-center font-sans">
    <!-- 液态流体背景 -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div class="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-300 rounded-full mix-blend-multiply filter blur-[80px] opacity-70 animate-blob"></div>
      <div class="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-yellow-200 rounded-full mix-blend-multiply filter blur-[80px] opacity-70 animate-blob animation-delay-2000"></div>
      <div class="absolute bottom-[-20%] left-[20%] w-[500px] h-[500px] bg-pink-300 rounded-full mix-blend-multiply filter blur-[80px] opacity-70 animate-blob animation-delay-4000"></div>
      <div class="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-300 rounded-full mix-blend-multiply filter blur-[80px] opacity-70 animate-blob animation-delay-6000"></div>
    </div>

    <div class="relative z-10 w-full max-w-[440px] mx-4">
      <div class="relative overflow-hidden rounded-3xl bg-white/40 backdrop-blur-xl border border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.05)] p-8 md:p-10 transition-all duration-500 hover:shadow-[0_8px_40px_rgba(0,0,0,0.08)]">
        <div class="mb-8 text-center">
          <h1 class="text-3xl font-semibold text-gray-900 tracking-tight mb-2">创建账号</h1>
          <p class="text-sm text-gray-500 font-medium">使用邮箱完成注册</p>
        </div>

        <form @submit.prevent="handleRegister" class="space-y-5">
          <div class="space-y-2">
            <Label for="email" class="text-xs font-medium text-gray-500 ml-1 uppercase tracking-wider">邮箱</Label>
            <Input
              id="email"
              v-model="email"
              type="email"
              placeholder="name@example.com"
              required
              class="h-12 rounded-2xl bg-white/50 border-transparent hover:bg-white/80 focus:bg-white focus:border-blue-400/30 focus:ring-4 focus:ring-blue-100 transition-all duration-300 placeholder:text-gray-400 font-medium text-gray-700"
            />
          </div>

          <div class="space-y-2">
            <Label for="code" class="text-xs font-medium text-gray-500 ml-1 uppercase tracking-wider">验证码</Label>
            <div class="flex gap-3">
              <Input
                id="code"
                v-model="code"
                type="text"
                inputmode="numeric"
                placeholder="6 位数字"
                required
                class="h-12 rounded-2xl bg-white/50 border-transparent hover:bg-white/80 focus:bg-white focus:border-blue-400/30 focus:ring-4 focus:ring-blue-100 transition-all duration-300 placeholder:text-gray-400 font-medium text-gray-700"
              />
              <Button
                type="button"
                class="h-12 rounded-2xl bg-gray-900 hover:bg-black text-white font-medium px-4"
                :disabled="sendingCode || countdown > 0"
                @click="handleSendCode"
              >
                {{ countdown > 0 ? `${countdown}s` : (sendingCode ? '发送中...' : '发送验证码') }}
              </Button>
            </div>
          </div>

          <div class="space-y-2">
            <Label for="password" class="text-xs font-medium text-gray-500 ml-1 uppercase tracking-wider">密码</Label>
            <Input
              id="password"
              v-model="password"
              type="password"
              placeholder="至少 6 个字符"
              required
              class="h-12 rounded-2xl bg-white/50 border-transparent hover:bg-white/80 focus:bg-white focus:border-blue-400/30 focus:ring-4 focus:ring-blue-100 transition-all duration-300 placeholder:text-gray-400 font-medium text-gray-700"
            />
          </div>

          <div class="space-y-2">
            <Label for="confirmPassword" class="text-xs font-medium text-gray-500 ml-1 uppercase tracking-wider">确认密码</Label>
            <Input
              id="confirmPassword"
              v-model="confirmPassword"
              type="password"
              placeholder="再次输入密码"
              required
              class="h-12 rounded-2xl bg-white/50 border-transparent hover:bg-white/80 focus:bg-white focus:border-blue-400/30 focus:ring-4 focus:ring-blue-100 transition-all duration-300 placeholder:text-gray-400 font-medium text-gray-700"
            />
          </div>

          <div class="space-y-2">
            <Label for="inviteCode" class="text-xs font-medium text-gray-500 ml-1 uppercase tracking-wider">
              邀请码{{ inviteLocked ? '（来自邀请链接）' : '（可选）' }}
            </Label>
            <Input
              id="inviteCode"
              v-model="inviteCode"
              type="text"
              :readonly="inviteLocked"
              placeholder="填写邀请码可关联邀请人"
              class="h-12 rounded-2xl bg-white/50 border-transparent hover:bg-white/80 focus:bg-white focus:border-blue-400/30 focus:ring-4 focus:ring-blue-100 transition-all duration-300 placeholder:text-gray-400 font-medium text-gray-700"
            />
            <div v-if="inviteLocked" class="text-xs text-gray-500">
              已从邀请链接自动填写，无法修改。
            </div>
          </div>

          <div v-if="error" class="text-sm text-red-500 bg-red-50/80 border border-red-100 rounded-xl px-4 py-3 animate-in fade-in slide-in-from-bottom-2">
            {{ error }}
          </div>

          <div v-if="success" class="text-sm text-green-600 bg-green-50/80 border border-green-100 rounded-xl px-4 py-3 animate-in fade-in slide-in-from-bottom-2">
            {{ success }}
          </div>

          <Button
            type="submit"
            class="w-full h-12 rounded-2xl bg-gray-900 hover:bg-black text-white font-medium text-[15px] shadow-lg shadow-gray-200/50 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 mt-2"
            :disabled="loading"
          >
            <span v-if="loading" class="mr-2 w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
            {{ loading ? '正在注册...' : '注 册' }}
          </Button>

          <div class="text-center text-sm text-gray-500 font-medium">
            已有账号？
            <router-link to="/login" class="text-gray-900 hover:underline">去登录</router-link>
          </div>
        </form>
      </div>

      <div class="mt-8 text-center">
        <p class="text-xs text-gray-400 font-medium">© 2026 Boarding System</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes blob {
  0% { transform: translate(0px, 0px) scale(1); }
  33% { transform: translate(30px, -50px) scale(1.1); }
  66% { transform: translate(-20px, 20px) scale(0.9); }
  100% { transform: translate(0px, 0px) scale(1); }
}

.animate-blob {
  animation: blob 7s infinite;
}

.animation-delay-2000 {
  animation-delay: 2s;
}

.animation-delay-4000 {
  animation-delay: 4s;
}

.animation-delay-6000 {
  animation-delay: 6s;
}
</style>
