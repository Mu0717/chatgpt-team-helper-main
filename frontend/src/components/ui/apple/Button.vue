<template>
  <button
    :class="[buttonClasses, className]"
    :type="type"
    :disabled="disabled || loading"
    @click="handleClick"
    @mousedown="handleMouseDown"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseLeave"
    ref="buttonRef"
  >
    <!-- 加载状态 -->
    <Transition name="fade" mode="out-in">
      <span v-if="loading" class="apple-button-loader">
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
          />
        </svg>
      </span>
      <span v-else class="apple-button-content">
        <slot name="icon" />
        <slot />
      </span>
    </Transition>

    <!-- 点击涟漪效果 -->
    <span
      v-if="ripple"
      ref="rippleRef"
      class="apple-button-ripple"
      :style="rippleStyle"
    />
  </button>
</template>

<script setup lang="ts">
import { ref, computed, type PropType } from 'vue'

// 定义属性
const props = defineProps({
  variant: {
    type: String as PropType<'primary' | 'secondary' | 'ghost' | 'destructive' | 'link' | 'success' | 'custom' | 'premium'>,
    default: 'primary'
  },
  size: {
    type: String as PropType<'sm' | 'md' | 'lg'>,
    default: 'md'
  },
  type: {
    type: String as PropType<'button' | 'submit' | 'reset'>,
    default: 'button'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  },
  className: {
    type: String,
    default: ''
  },
  ripple: {
    type: Boolean,
    default: true
  }
})

// 定义事件
const emit = defineEmits(['click'])

// 引用
const buttonRef = ref<HTMLButtonElement>()
const rippleRef = ref<HTMLSpanElement>()

// 涟漪效果状态
const rippleStyle = ref({})
const isPressed = ref(false)

// 计算类名
const buttonClasses = computed(() => {
  const base = 'apple-button'
  const variant = `apple-button-${props.variant}`
  const size = `apple-button-${props.size}`
  const state = [
    props.disabled && 'apple-button-disabled',
    props.loading && 'apple-button-loading',
    isPressed.value && 'apple-button-pressed'
  ].filter(Boolean).join(' ')

  return `${base} ${variant} ${size} ${state}`
})

// 处理点击
const handleClick = (e: MouseEvent) => {
  if (props.disabled || props.loading) return

  // 创建涟漪效果
  if (props.ripple && buttonRef.value) {
    const rect = buttonRef.value.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height)
    const x = e.clientX - rect.left - size / 2
    const y = e.clientY - rect.top - size / 2

    rippleStyle.value = {
      width: `${size}px`,
      height: `${size}px`,
      left: `${x}px`,
      top: `${y}px`,
      animation: 'ripple 600ms ease-out'
    }

    // 重置动画
    setTimeout(() => {
      rippleStyle.value = {}
    }, 600)
  }

  emit('click', e)
}

// 处理鼠标按下
const handleMouseDown = () => {
  if (!props.disabled && !props.loading) {
    isPressed.value = true
  }
}

// 处理鼠标抬起
const handleMouseUp = () => {
  isPressed.value = false
}

// 处理鼠标离开
const handleMouseLeave = () => {
  isPressed.value = false
}
</script>

<style scoped>
/* ===== 基础按钮样式 ===== */
.apple-button {
  /* 布局 */
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;

  /* 尺寸 */
  min-width: 64px;
  white-space: nowrap;

  /* 字体 */
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text";
  font-weight: 400;
  letter-spacing: -0.01em;

  /* 圆角 */
  border-radius: var(--radius-button);

  /* 边框 */
  border: 0.5px solid transparent;
  outline: none;

  /* 过渡 */
  transition: all var(--duration-fast) var(--ease-spring);
  transform-origin: center;

  /* 其他 */
  cursor: pointer;
  user-select: none;
  overflow: hidden;
  -webkit-tap-highlight-color: transparent;
}

/* ===== 尺寸变体 ===== */
.apple-button-sm {
  height: 32px;
  padding: 0 12px;
  font-size: calc(14px * var(--interface-scale));
  line-height: calc(20px * var(--interface-scale));
}

.apple-button-md {
  height: 44px;  /* Apple标准触摸目标 */
  padding: 0 20px;
  font-size: calc(17px * var(--interface-scale));  /* Apple标准字体大小 */
  line-height: calc(22px * var(--interface-scale));
}

.apple-button-lg {
  height: 52px;
  padding: 0 28px;
  font-size: calc(19px * var(--interface-scale));
  line-height: calc(24px * var(--interface-scale));
}

/* ===== 主要按钮 Primary ===== */
.apple-button-primary {
  background: rgb(var(--apple-blue));
  color: white;
  border-color: transparent;
  box-shadow:
    0 1px 2px rgba(var(--apple-blue), 0.2),
    var(--gloss-light);
}

.apple-button-primary:hover:not(:disabled) {
  background: rgb(10, 132, 255);  /* 稍亮的蓝色 */
  transform: translateY(-1px) scale(1.02);
  box-shadow:
    0 4px 12px rgba(var(--apple-blue), 0.25),
    var(--gloss-strong);
}

.apple-button-primary.apple-button-pressed {
  transform: translateY(0) scale(0.98);
  box-shadow:
    0 1px 2px rgba(var(--apple-blue), 0.2),
    inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* ===== 次要按钮 Secondary ===== */
.apple-button-secondary {
  background: rgba(var(--glass-thin));
  color: rgb(var(--apple-blue));
  border: 0.5px solid rgba(var(--glass-border-regular));
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  box-shadow: var(--shadow-sm), var(--gloss-light);
}

.apple-button-secondary:hover:not(:disabled) {
  background: rgba(var(--glass-regular));
  transform: translateY(-1px) scale(1.02);
  box-shadow: var(--shadow-md), var(--gloss-strong);
}

.apple-button-secondary.apple-button-pressed {
  transform: translateY(0) scale(0.98);
  box-shadow: var(--shadow-xs), inset 0 1px 2px rgba(0, 0, 0, 0.05);
}

/* ===== 幽灵按钮 Ghost ===== */
.apple-button-ghost {
  background: transparent;
  color: rgb(var(--apple-blue));
  border-color: transparent;
}

.apple-button-ghost:hover:not(:disabled) {
  background: rgba(var(--apple-blue), 0.08);
  transform: scale(1.02);
}

.apple-button-ghost.apple-button-pressed {
  background: rgba(var(--apple-blue), 0.12);
  transform: scale(0.98);
}

/* ===== 破坏性按钮 Destructive ===== */
.apple-button-destructive {
  background: rgb(var(--apple-red));
  color: white;
  border-color: transparent;
  box-shadow:
    0 1px 2px rgba(var(--apple-red), 0.2),
    var(--gloss-light);
}

.apple-button-destructive:hover:not(:disabled) {
  background: rgb(255, 69, 58);  /* 稍亮的红色 */
  transform: translateY(-1px) scale(1.02);
  box-shadow:
    0 4px 12px rgba(var(--apple-red), 0.25),
    var(--gloss-strong);
}

.apple-button-destructive.apple-button-pressed {
  transform: translateY(0) scale(0.98);
  box-shadow:
    0 1px 2px rgba(var(--apple-red), 0.2),
    inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* ===== 成功按钮 Success ===== */
.apple-button-success {
  background: rgb(var(--apple-green));
  color: white;
  border-color: transparent;
  box-shadow:
    0 1px 2px rgba(var(--apple-green), 0.2),
    var(--gloss-light);
}

.apple-button-success:hover:not(:disabled) {
  background: rgb(48, 209, 88);  /* 稍亮的绿色 */
  transform: translateY(-1px) scale(1.02);
  box-shadow:
    0 4px 12px rgba(var(--apple-green), 0.25),
    var(--gloss-strong);
}

.apple-button-success.apple-button-pressed {
  transform: translateY(0) scale(0.98);
  box-shadow:
    0 1px 2px rgba(var(--apple-green), 0.2),
    inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* ===== 自定义按钮 Custom ===== */
.apple-button-custom {
  background: transparent;
  color: inherit;
  border: none;
  box-shadow: none;
  padding: 0;
  min-width: 0;
  height: auto;
}

/* ===== 尊贵按钮 Premium ===== */
.apple-button-premium {
  background: linear-gradient(135deg, #8B89FF, #FF6B95);
  color: white;
  border-color: transparent;
  box-shadow:
    0 4px 14px 0 rgba(192, 38, 211, 0.39),
    var(--gloss-light);
}

.apple-button-premium:hover:not(:disabled) {
  background: linear-gradient(135deg, #7A78FF, #FF5B85); /* Slightly more saturated on hover */
  transform: translateY(-1px) scale(1.02);
  box-shadow:
    0 6px 20px rgba(192, 38, 211, 0.23),
    var(--gloss-strong);
}

.apple-button-premium.apple-button-pressed {
  transform: translateY(0) scale(0.98);
  box-shadow:
    0 2px 10px rgba(192, 38, 211, 0.12),
    inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* ===== 链接按钮 Link ===== */
.apple-button-link {
  background: transparent;
  color: rgb(var(--apple-blue));
  border: none;
  padding: 0;
  height: auto;
  min-width: auto;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.apple-button-link:hover:not(:disabled) {
  color: rgb(10, 132, 255);
  transform: none;
}

.apple-button-link.apple-button-pressed {
  opacity: 0.7;
  transform: none;
}

/* ===== 状态样式 ===== */

/* 禁用状态 */
.apple-button:disabled,
.apple-button-disabled {
  opacity: 0.3;
  cursor: not-allowed;
  transform: none !important;
}

/* 加载状态 */
.apple-button-loading {
  cursor: wait;
  color: transparent;
}

.apple-button-loader {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  color: currentColor;
}

.apple-button-loading.apple-button-primary .apple-button-loader,
.apple-button-loading.apple-button-destructive .apple-button-loader,
.apple-button-loading.apple-button-premium .apple-button-loader,
.apple-button-loading.apple-button-success .apple-button-loader {
  color: white;
}

.apple-button-loading.apple-button-secondary .apple-button-loader,
.apple-button-loading.apple-button-ghost .apple-button-loader,
.apple-button-loading.apple-button-link .apple-button-loader {
  color: rgb(var(--apple-blue));
}

/* ===== 内容容器 ===== */
.apple-button-content {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

/* ===== 焦点状态 ===== */
.apple-button:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 2px rgba(var(--apple-blue), 0.5),
    var(--shadow-sm);
}

/* ===== 涟漪效果 ===== */
.apple-button-ripple {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.5) 0%, transparent 70%);
  pointer-events: none;
  transform: scale(0);
}

@keyframes ripple {
  to {
    transform: scale(4);
    opacity: 0;
  }
}

/* ===== 过渡动画 ===== */
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--duration-fast) var(--ease-smooth);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ===== 深色模式适配 ===== */
@media (prefers-color-scheme: dark) {
  .apple-button-secondary {
    background: rgba(var(--glass-thin));
    color: rgb(10, 132, 255);
    border-color: rgba(var(--glass-border-regular));
  }

  .apple-button-ghost:hover:not(:disabled) {
    background: rgba(10, 132, 255, 0.12);
  }

  .apple-button-link {
    color: rgb(10, 132, 255);
  }
}

/* ===== 触摸设备优化 ===== */
@media (pointer: coarse) {
  .apple-button {
    min-height: 44px;  /* 确保最小触摸目标 */
  }

  .apple-button-sm {
    min-height: 44px;
    padding: 0 16px;
  }
}

/* ===== 减少动画模式 ===== */
@media (prefers-reduced-motion: reduce) {
  .apple-button {
    transition: none;
  }

  .apple-button-ripple {
    animation: none;
  }
}
</style>