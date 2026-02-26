<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authService } from '@/services/api'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AlertCircle, Settings } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

const feature = computed(() => String(route.params.feature || '').trim())
const from = computed(() => String(route.query.from || '').trim())

const meta = computed(() => {
  const key = feature.value
  if (key === 'xhs') {
    return {
      title: '小红书功能未启用',
      description: '小红书订单同步与兑换已被超级管理员禁用。',
      docPath: 'docs/features/小红书.md'
    }
  }
  if (key === 'xianyu') {
    return {
      title: '闲鱼功能未启用',
      description: '闲鱼订单同步与兑换已被超级管理员禁用。',
      docPath: 'docs/features/闲鱼.md'
    }
  }
  if (key === 'payment') {
    return {
      title: '支付功能未启用',
      description: 'ZPAY 购买与支付回调已被超级管理员禁用。',
      docPath: 'docs/features/支付（ZPAY）.md'
    }
  }
  if (key === 'openAccounts') {
    return {
      title: '开放账号功能未启用',
      description: '开放账号页与 Credit 订单相关能力已被超级管理员禁用。',
      docPath: 'docs/features/开放账号.md'
    }
  }
  return {
    title: '功能未启用',
    description: '该功能当前已被禁用，请联系管理员。',
    docPath: 'docs/features'
  }
})

const isAuthenticated = computed(() => authService.isAuthenticated())

const goBack = () => {
  if (from.value) {
    router.push(from.value)
    return
  }
  router.back()
}

const goSettings = () => {
  if (!isAuthenticated.value) {
    router.push('/login')
    return
  }
  router.push('/admin/settings')
}
</script>

<template>
  <div class="mx-auto w-full max-w-2xl px-6 py-10">
    <Card class="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
      <CardHeader class="border-b border-gray-50 bg-gray-50/30 px-6 py-6 sm:px-8">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
            <AlertCircle class="w-5 h-5" />
          </div>
          <div>
            <CardTitle class="text-xl font-bold text-gray-900">{{ meta.title }}</CardTitle>
            <CardDescription class="text-gray-500">{{ meta.description }}</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent class="p-6 sm:p-8 space-y-6">
        <div class="rounded-2xl bg-blue-50/50 border border-blue-100 p-5 space-y-2">
          <p class="text-sm font-semibold text-blue-900">如何启用</p>
          <ul class="list-disc list-inside space-y-1 text-xs text-blue-700/80">
            <li>由超级管理员在「系统设置」→「功能开关」中启用对应功能。</li>
            <li>启用后按文档完成配置：<span class="font-mono">{{ meta.docPath }}</span></li>
          </ul>
        </div>

        <div class="flex flex-col sm:flex-row gap-3">
          <Button type="button" variant="outline" class="h-11 rounded-xl" @click="goBack">
            返回
          </Button>
          <Button type="button" class="h-11 rounded-xl bg-black hover:bg-gray-800 text-white" @click="goSettings">
            <Settings class="w-4 h-4 mr-2" />
            去系统设置
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
