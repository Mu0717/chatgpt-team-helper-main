<template>
  <div class="apple-input-wrapper" :class="wrapperClasses">
    <!-- 标签 -->
    <label
      v-if="label"
      :for="inputId"
      class="apple-input-label"
      :class="{ 'sr-only': srOnlyLabel }"
    >
      {{ label }}
      <span v-if="required" class="apple-input-required">*</span>
    </label>

    <!-- 输入框容器 -->
    <div class="apple-input-container" :class="containerClasses">
      <!-- 前缀图标 -->
      <span v-if="$slots.prefix || prefixIcon" class="apple-input-prefix">
        <slot name="prefix">
          <component :is="prefixIcon" v-if="prefixIcon" />
        </slot>
      </span>

      <!-- 输入框 -->
      <input
        :id="inputId"
        ref="inputRef"
        v-model="modelValue"
        :type="type"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :required="required"
        :autocomplete="autocomplete"
        :aria-label="ariaLabel || label"
        :aria-invalid="!!error"
        :aria-describedby="error ? `${inputId}-error` : undefined"
        class="apple-input"
        :class="inputClasses"
        @focus="handleFocus"
        @blur="handleBlur"
        @input="handleInput"
        @keydown="handleKeydown"
      />

      <!-- 清除按钮 -->
      <button
        v-if="clearable && modelValue && !disabled && !readonly"
        type="button"
        class="apple-input-clear"
        @click="handleClear"
        :aria-label="`清除${label || '输入'}`"
      >
        <svg width="16" height="16" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="6" fill="currentColor" opacity="0.3" />
          <path
            d="M10.5 5.5L5.5 10.5M5.5 5.5L10.5 10.5"
            stroke="white"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
      </button>

      <!-- 后缀图标 -->
      <span v-if="$slots.suffix || suffixIcon" class="apple-input-suffix">
        <slot name="suffix">
          <component :is="suffixIcon" v-if="suffixIcon" />
        </slot>
      </span>

      <!-- 加载状态 -->
      <span v-if="loading" class="apple-input-loading">
        <svg class="animate-spin" width="16" height="16" viewBox="0 0 16 16">
          <circle
            cx="8"
            cy="8"
            r="6"
            stroke="currentColor"
            stroke-width="2"
            fill="none"
            stroke-dasharray="30"
            stroke-dashoffset="10"
            stroke-linecap="round"
            opacity="0.5"
          />
        </svg>
      </span>
    </div>

    <!-- 辅助文本 -->
    <div v-if="helperText && !error" class="apple-input-helper">
      {{ helperText }}
    </div>

    <!-- 错误信息 -->
    <div v-if="error" :id="`${inputId}-error`" class="apple-input-error" role="alert">
      {{ error }}
    </div>

    <!-- 字符计数 -->
    <div v-if="showCount && maxLength" class="apple-input-count">
      <span :class="{ 'text-red-500': modelValue.length > maxLength }">
        {{ modelValue.length }}
      </span>
      / {{ maxLength }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, type PropType } from 'vue'

// 定义属性
const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  type: {
    type: String as PropType<'text' | 'password' | 'email' | 'number' | 'tel' | 'url' | 'search'>,
    default: 'text'
  },
  label: String,
  placeholder: String,
  helperText: String,
  error: String,
  size: {
    type: String as PropType<'sm' | 'md' | 'lg'>,
    default: 'md'
  },
  variant: {
    type: String as PropType<'filled' | 'outlined' | 'plain'>,
    default: 'filled'
  },
  disabled: Boolean,
  readonly: Boolean,
  required: Boolean,
  clearable: Boolean,
  loading: Boolean,
  srOnlyLabel: Boolean,
  autocomplete: String,
  ariaLabel: String,
  prefixIcon: Object,
  suffixIcon: Object,
  maxLength: Number,
  showCount: Boolean,
  autoFocus: Boolean
})

// 定义事件
const emit = defineEmits(['update:modelValue', 'focus', 'blur', 'clear', 'enter'])

// 引用
const inputRef = ref<HTMLInputElement>()
const inputId = ref(`apple-input-${Math.random().toString(36).substr(2, 9)}`)

// 状态
const isFocused = ref(false)

// 双向绑定
const modelValue = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

// 计算类名
const wrapperClasses = computed(() => [
  props.disabled && 'apple-input-disabled',
  props.error && 'apple-input-has-error'
])

const containerClasses = computed(() => [
  `apple-input-container-${props.variant}`,
  `apple-input-container-${props.size}`,
  isFocused.value && 'apple-input-container-focused',
  props.disabled && 'apple-input-container-disabled',
  props.readonly && 'apple-input-container-readonly',
  props.error && 'apple-input-container-error'
])

const inputClasses = computed(() => [
  `apple-input-${props.size}`
])

// 处理聚焦
const handleFocus = (e: FocusEvent) => {
  isFocused.value = true
  emit('focus', e)
}

// 处理失焦
const handleBlur = (e: FocusEvent) => {
  isFocused.value = false
  emit('blur', e)
}

// 处理输入
const handleInput = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (props.maxLength && target.value.length > props.maxLength) {
    target.value = target.value.slice(0, props.maxLength)
  }
}

// 处理键盘事件
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    emit('enter', e)
  }
}

// 处理清除
const handleClear = () => {
  modelValue.value = ''
  emit('clear')
  inputRef.value?.focus()
}

// 自动聚焦
onMounted(() => {
  if (props.autoFocus && inputRef.value) {
    inputRef.value.focus()
  }
})
</script>

<style scoped>
/* ===== 包装容器 ===== */
.apple-input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

/* ===== 标签 ===== */
.apple-input-label {
  font-size: calc(15px * var(--interface-scale));
  line-height: calc(20px * var(--interface-scale));
  font-weight: 500;
  color: rgba(var(--label));
  letter-spacing: calc(-0.24px * var(--interface-scale));
}

.apple-input-required {
  color: rgb(var(--apple-red));
  margin-left: 2px;
}

/* ===== 输入框容器 ===== */
.apple-input-container {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  border-radius: var(--radius-input);
  transition: all var(--duration-fast) var(--ease-smooth);
  overflow: hidden;
}

/* 填充变体 */
.apple-input-container-filled {
  background: rgba(var(--tertiary-fill));
  border: 0.5px solid transparent;
}

.apple-input-container-filled:hover:not(.apple-input-container-disabled) {
  background: rgba(var(--secondary-fill));
}

.apple-input-container-filled.apple-input-container-focused {
  background: rgba(var(--glass-regular));
  border-color: rgba(var(--apple-blue));
  box-shadow:
    0 0 0 3px rgba(var(--apple-blue), 0.1),
    var(--gloss-light);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

/* 轮廓变体 */
.apple-input-container-outlined {
  background: transparent;
  border: 0.5px solid rgba(var(--separator));
}

.apple-input-container-outlined:hover:not(.apple-input-container-disabled) {
  border-color: rgba(var(--opaque-separator));
  background: rgba(var(--quaternary-fill));
}

.apple-input-container-outlined.apple-input-container-focused {
  background: rgba(var(--glass-ultra-thin));
  border-color: rgba(var(--apple-blue));
  box-shadow: 0 0 0 3px rgba(var(--apple-blue), 0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

/* 无边框变体 */
.apple-input-container-plain {
  background: transparent;
  border: none;
  border-bottom: 0.5px solid rgba(var(--separator));
  border-radius: 0;
}

.apple-input-container-plain:hover:not(.apple-input-container-disabled) {
  border-bottom-color: rgba(var(--opaque-separator));
}

.apple-input-container-plain.apple-input-container-focused {
  border-bottom-color: rgba(var(--apple-blue));
  box-shadow: 0 1px 0 0 rgba(var(--apple-blue));
}

/* 尺寸 */
.apple-input-container-sm {
  height: 32px;
  padding: 0 12px;
}

.apple-input-container-md {
  height: 44px;  /* Apple标准高度 */
  padding: 0 16px;
}

.apple-input-container-lg {
  height: 52px;
  padding: 0 20px;
}

/* 错误状态 */
.apple-input-container-error {
  border-color: rgba(var(--apple-red), 0.5);
}

.apple-input-container-error.apple-input-container-focused {
  border-color: rgba(var(--apple-red));
  box-shadow: 0 0 0 3px rgba(var(--apple-red), 0.1);
}

/* 禁用状态 */
.apple-input-container-disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* 只读状态 */
.apple-input-container-readonly {
  background: rgba(var(--quaternary-fill));
}

/* ===== 输入框 ===== */
.apple-input {
  flex: 1;
  width: 100%;
  height: 100%;
  background: transparent;
  border: none;
  outline: none;
  color: rgba(var(--label));
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text";
  -webkit-font-smoothing: antialiased;
}

.apple-input::placeholder {
  color: rgba(var(--placeholder-text));
}

.apple-input:disabled {
  cursor: not-allowed;
}

/* 尺寸 */
.apple-input-sm {
  font-size: calc(14px * var(--interface-scale));
  line-height: calc(20px * var(--interface-scale));
}

.apple-input-md {
  font-size: calc(17px * var(--interface-scale));  /* Apple标准 */
  line-height: calc(22px * var(--interface-scale));
  letter-spacing: calc(-0.408px * var(--interface-scale));
}

.apple-input-lg {
  font-size: calc(19px * var(--interface-scale));
  line-height: calc(24px * var(--interface-scale));
  letter-spacing: calc(-0.456px * var(--interface-scale));
}

/* ===== 前缀和后缀 ===== */
.apple-input-prefix,
.apple-input-suffix {
  display: flex;
  align-items: center;
  color: rgba(var(--secondary-label));
  flex-shrink: 0;
}

.apple-input-prefix {
  margin-right: 8px;
}

.apple-input-suffix {
  margin-left: 8px;
}

/* ===== 清除按钮 ===== */
.apple-input-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin-left: 8px;
  background: none;
  border: none;
  color: rgba(var(--secondary-label));
  cursor: pointer;
  transition: all var(--duration-instant) var(--ease-smooth);
  flex-shrink: 0;
}

.apple-input-clear:hover {
  color: rgba(var(--label));
  transform: scale(1.1);
}

.apple-input-clear:active {
  transform: scale(0.9);
}

/* ===== 加载状态 ===== */
.apple-input-loading {
  position: absolute;
  right: 16px;
  display: flex;
  align-items: center;
  color: rgba(var(--secondary-label));
  pointer-events: none;
}

/* ===== 辅助文本 ===== */
.apple-input-helper {
  font-size: calc(13px * var(--interface-scale));
  line-height: calc(18px * var(--interface-scale));
  color: rgba(var(--secondary-label));
  letter-spacing: calc(-0.078px * var(--interface-scale));
}

/* ===== 错误信息 ===== */
.apple-input-error {
  font-size: calc(13px * var(--interface-scale));
  line-height: calc(18px * var(--interface-scale));
  color: rgb(var(--apple-red));
  letter-spacing: calc(-0.078px * var(--interface-scale));
}

/* ===== 字符计数 ===== */
.apple-input-count {
  font-size: calc(12px * var(--interface-scale));
  line-height: calc(16px * var(--interface-scale));
  color: rgba(var(--tertiary-label));
  text-align: right;
  margin-top: -4px;
}

/* ===== 搜索类型特殊样式 ===== */
input[type="search"]::-webkit-search-cancel-button {
  -webkit-appearance: none;
}

/* ===== 数字类型特殊样式 ===== */
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* ===== 密码类型特殊样式 ===== */
input[type="password"] {
  letter-spacing: 0.2em;
}

input[type="password"]::placeholder {
  letter-spacing: normal;
}

/* ===== 深色模式 ===== */
@media (prefers-color-scheme: dark) {
  .apple-input-container-filled {
    background: rgba(var(--tertiary-fill));
  }

  .apple-input-container-filled.apple-input-container-focused {
    background: rgba(var(--glass-regular));
    border-color: rgba(10, 132, 255);
  }

  .apple-input-container-outlined.apple-input-container-focused {
    border-color: rgba(10, 132, 255);
  }
}

/* ===== 触摸设备优化 ===== */
@media (pointer: coarse) {
  .apple-input-container {
    min-height: 44px;
  }

  .apple-input-container-sm {
    min-height: 44px;
  }
}

/* ===== 动画 ===== */
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* ===== 无障碍 ===== */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>