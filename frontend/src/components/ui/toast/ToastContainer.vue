<script setup lang="ts">
import { computed } from 'vue'
import { useToast } from './useToast'

const { toasts, dismiss } = useToast()

const typeStyles = computed(() => ({
  success: {
    border: 'border-emerald-200/80',
    background: 'bg-emerald-50/95',
    text: 'text-emerald-900',
    accent: 'bg-emerald-500'
  },
  error: {
    border: 'border-rose-200/80',
    background: 'bg-rose-50/95',
    text: 'text-rose-900',
    accent: 'bg-rose-500'
  },
  warning: {
    border: 'border-amber-200/80',
    background: 'bg-amber-50/95',
    text: 'text-amber-900',
    accent: 'bg-amber-500'
  },
  info: {
    border: 'border-blue-200/80',
    background: 'bg-blue-50/95',
    text: 'text-blue-900',
    accent: 'bg-blue-500'
  }
}))
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed inset-0 z-[1000] flex flex-col items-end gap-3 px-4 py-6 sm:top-4 sm:right-4 sm:left-auto sm:w-[420px] sm:px-0">
      <TransitionGroup name="toast" tag="div" class="flex w-full flex-col gap-3">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="pointer-events-auto relative w-full overflow-hidden rounded-apple-md border shadow-apple-lg backdrop-blur"
          :class="[
            typeStyles[toast.type].border,
            typeStyles[toast.type].background,
            typeStyles[toast.type].text
          ]"
        >
          <div class="flex items-start gap-3 px-4 py-3">
            <span
              class="mt-1 inline-flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-full"
              :class="typeStyles[toast.type].accent"
            />
            <div class="flex-1 space-y-1">
              <p class="text-apple-sm font-semibold">{{ toast.title }}</p>
              <p v-if="toast.description" class="text-apple-sm text-apple-gray-600">{{ toast.description }}</p>
            </div>
            <button
              class="rounded-full px-2 py-1 text-apple-xs text-apple-gray-500 transition hover:bg-white/60 hover:text-apple-gray-700"
              type="button"
              aria-label="关闭提示"
              @click="dismiss(toast.id)"
            >
              ✕
            </button>
          </div>
          <span
            class="absolute bottom-0 left-0 h-0.5 w-full opacity-70"
            :class="typeStyles[toast.type].accent"
          />
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.24s ease, opacity 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}
</style>
