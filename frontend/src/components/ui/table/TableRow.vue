<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <tr :class="cn('border-b transition-all duration-200 ease-apple hover:bg-apple-gray-50 dark:hover:bg-apple-gray-800 data-[state=selected]:bg-apple-gray-100 dark:data-[state=selected]:bg-apple-gray-800', props.class)">
    <slot />
  </tr>
</template>
