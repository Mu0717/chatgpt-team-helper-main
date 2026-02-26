<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <div
    :class="
      cn(
        'glass-card rounded-apple-lg shadow-apple-md dark:shadow-apple-dark-md transition-all duration-300 ease-apple hover:shadow-apple-xl dark:hover:shadow-apple-dark-lg hover:scale-[1.01]',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
