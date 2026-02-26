<template>
  <div class="relative w-full" :class="props.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'">
    <div class="relative h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 flex items-center justify-between transition-all focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-500">
      <span v-if="displayValue" class="text-sm font-mono text-gray-700 truncate">{{ displayValue }}</span>
      <span v-else class="text-sm text-gray-400 truncate">{{ props.placeholder || '选择时间' }}</span>
      <CalendarClock class="w-4 h-4 text-gray-400 shrink-0 ml-3" />

      <input
        ref="inputRef"
        class="absolute inset-0 w-full h-full opacity-0"
        :class="props.disabled ? 'cursor-not-allowed' : 'cursor-pointer'"
        type="datetime-local"
        step="1"
        :value="props.modelValue || ''"
        :disabled="props.disabled"
        :aria-label="props.placeholder || '选择时间'"
        @input="handleInput"
        @click="handleClick"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { CalendarClock } from 'lucide-vue-next'

const props = defineProps<{
  modelValue?: string
  placeholder?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const inputRef = ref<HTMLInputElement | null>(null)

const displayValue = computed(() => {
  const value = String(props.modelValue || '').trim()
  if (!value) return ''
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) return value
  const year = match[1]!
  const month = match[2]!
  const day = match[3]!
  const hour = match[4]!
  const minute = match[5]!
  const second = match[6] || '00'
  return `${year}年${month}月${day}日 ${hour}:${minute}:${second}`
})

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement | null
  emit('update:modelValue', target?.value || '')
}

const handleClick = () => {
  if (props.disabled) return
  const input = inputRef.value as (HTMLInputElement & { showPicker?: () => void }) | null
  try {
    input?.showPicker?.()
  } catch {
    // ignore
  }
}
</script>
