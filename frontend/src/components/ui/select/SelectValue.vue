<script setup lang="ts">
import { SelectValue, type SelectValueProps } from 'radix-vue'

defineProps<SelectValueProps & { displayText?: string }>()
</script>

<template>
  <SelectValue v-if="!displayText" v-bind="$props">
    <slot />
  </SelectValue>
  <span v-else class="truncate">{{ displayText }}</span>
</template>
