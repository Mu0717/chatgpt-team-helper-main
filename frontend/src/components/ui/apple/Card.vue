<template>
  <div
    :class="cardClasses"
    :style="cardStyle"
    @click="handleClick"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @mousemove="handleMouseMove"
    ref="cardRef"
  >
    <!-- 光泽层 -->
    <div
      v-if="glossy"
      class="apple-card-gloss"
      :style="glossStyle"
    />

    <!-- 内容 -->
    <div class="apple-card-content">
      <slot />
    </div>

    <!-- 悬停光效 -->
    <div
      v-if="interactive && showLight"
      class="apple-card-light"
      :style="lightStyle"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, type PropType, type CSSProperties } from 'vue'

// 定义属性
const props = defineProps({
  variant: {
    type: String as PropType<'elevated' | 'filled' | 'outlined' | 'glass'>,
    default: 'glass'
  },
  padding: {
    type: String as PropType<'none' | 'sm' | 'md' | 'lg' | 'xl'>,
    default: 'lg'
  },
  interactive: {
    type: Boolean,
    default: false
  },
  clickable: {
    type: Boolean,
    default: false
  },
  glossy: {
    type: Boolean,
    default: true
  },
  radius: {
    type: String as PropType<'sm' | 'md' | 'lg' | 'xl' | 'full'>,
    default: 'lg'
  },
  className: {
    type: String,
    default: ''
  }
})

// 定义事件
const emit = defineEmits(['click'])

// 引用
const cardRef = ref<HTMLDivElement>()

// 状态
const isHovered = ref(false)
const showLight = ref(false)
const mouseX = ref(0)
const mouseY = ref(0)

// 计算类名
const cardClasses = computed(() => {
  const base = 'apple-card'
  const variant = `apple-card-${props.variant}`
  const padding = props.padding !== 'none' ? `apple-card-padding-${props.padding}` : ''
  const radius = `apple-card-radius-${props.radius}`
  const interactive = props.interactive ? 'apple-card-interactive' : ''
  const clickable = props.clickable ? 'apple-card-clickable' : ''
  const hovered = isHovered.value ? 'apple-card-hovered' : ''

  return [base, variant, padding, radius, interactive, clickable, hovered, props.className]
    .filter(Boolean)
    .join(' ')
})

// 卡片样式
const cardStyle = computed<CSSProperties>(() => {
  if (!props.interactive || !isHovered.value) return {}

  // 3D倾斜效果
  const rect = cardRef.value?.getBoundingClientRect()
  if (!rect) return {}

  const centerX = rect.width / 2
  const centerY = rect.height / 2
  const rotateX = ((mouseY.value - centerY) / centerY) * -10
  const rotateY = ((mouseX.value - centerX) / centerX) * 10

  return {
    transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`
  }
})

// 光泽样式
const glossStyle = computed<CSSProperties>(() => {
  if (!isHovered.value) {
    return {
      opacity: 0.5
    }
  }

  const rect = cardRef.value?.getBoundingClientRect()
  if (!rect) return {}

  const angle = Math.atan2(mouseY.value - rect.height / 2, mouseX.value - rect.width / 2)
  const gradientAngle = (angle * 180) / Math.PI + 90

  return {
    opacity: 0.8,
    background: `linear-gradient(${gradientAngle}deg,
      transparent 0%,
      rgba(255, 255, 255, 0.1) 40%,
      rgba(255, 255, 255, 0.2) 50%,
      rgba(255, 255, 255, 0.1) 60%,
      transparent 100%)`
  }
})

// 光效样式
const lightStyle = computed<CSSProperties>(() => {
  return {
    left: `${mouseX.value}px`,
    top: `${mouseY.value}px`
  }
})

// 处理点击
const handleClick = (e: MouseEvent) => {
  if (props.clickable) {
    // 点击波纹效果
    const rect = cardRef.value?.getBoundingClientRect()
    if (rect) {
      const ripple = document.createElement('span')
      ripple.className = 'apple-card-ripple'
      const size = Math.max(rect.width, rect.height)
      const x = e.clientX - rect.left - size / 2
      const y = e.clientY - rect.top - size / 2

      ripple.style.width = `${size}px`
      ripple.style.height = `${size}px`
      ripple.style.left = `${x}px`
      ripple.style.top = `${y}px`

      cardRef.value?.appendChild(ripple)

      setTimeout(() => {
        ripple.remove()
      }, 600)
    }

    emit('click', e)
  }
}

// 处理鼠标进入
const handleMouseEnter = () => {
  if (props.interactive) {
    isHovered.value = true
    showLight.value = true
  }
}

// 处理鼠标离开
const handleMouseLeave = () => {
  isHovered.value = false
  showLight.value = false
}

// 处理鼠标移动
let rafId: number | null = null
const handleMouseMove = (e: MouseEvent) => {
  if (!props.interactive || !cardRef.value) return

  if (rafId) return

  rafId = requestAnimationFrame(() => {
    if (!cardRef.value) return
    const rect = cardRef.value.getBoundingClientRect()
    mouseX.value = e.clientX - rect.left
    mouseY.value = e.clientY - rect.top
    rafId = null
  })
}
</script>

<style scoped>
/* ===== 基础卡片样式 ===== */
.apple-card {
  position: relative;
  display: block;
  width: 100%;
  overflow: hidden;
  transition: all var(--duration-normal) var(--ease-smooth);
  transform-style: preserve-3d;
}

/* ===== 圆角变体 ===== */
.apple-card-radius-sm {
  border-radius: var(--radius-sm);
}

.apple-card-radius-md {
  border-radius: var(--radius-md);
}

.apple-card-radius-lg {
  border-radius: var(--radius-card);
}

.apple-card-radius-xl {
  border-radius: var(--radius-xl);
}

.apple-card-radius-full {
  border-radius: var(--radius-full);
}

/* ===== 内边距变体 ===== */
.apple-card-padding-sm {
  padding: var(--spacing-3);
}

.apple-card-padding-md {
  padding: var(--spacing-4);
}

.apple-card-padding-lg {
  padding: var(--spacing-5);
}

.apple-card-padding-xl {
  padding: var(--spacing-6);
}

/* ===== 卡片变体 ===== */

/* 玻璃卡片（默认） */
.apple-card-glass {
  background: rgba(var(--glass-regular));
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  border: 0.5px solid rgba(var(--glass-border-light));
  box-shadow:
    var(--shadow-md),
    var(--gloss-light);
}

/* 提升卡片 */
.apple-card-elevated {
  background: rgb(var(--system-background));
  border: none;
  box-shadow: var(--shadow-lg);
}

/* 填充卡片 */
.apple-card-filled {
  background: rgb(var(--secondary-system-background));
  border: none;
  box-shadow: none;
}

/* 轮廓卡片 */
.apple-card-outlined {
  background: rgb(var(--system-background));
  border: 0.5px solid rgba(var(--separator));
  box-shadow: none;
}

/* ===== 交互状态 ===== */
.apple-card-interactive {
  cursor: default;
  will-change: transform;
}

.apple-card-clickable {
  cursor: pointer;
}

/* 悬停效果 */
.apple-card-interactive:hover {
  transform: translateY(-2px);
}

.apple-card-glass.apple-card-hovered {
  background: rgba(var(--glass-thick));
  box-shadow:
    var(--shadow-xl),
    var(--gloss-strong);
}

.apple-card-elevated.apple-card-hovered {
  box-shadow: var(--shadow-xl);
}

.apple-card-filled.apple-card-hovered {
  background: rgb(var(--tertiary-system-background));
}

.apple-card-outlined.apple-card-hovered {
  border-color: rgba(var(--opaque-separator));
  background: rgba(var(--quaternary-fill));
}

/* 点击效果 */
.apple-card-clickable:active {
  transform: scale(0.99);
  transition-duration: var(--duration-instant);
}

/* ===== 光泽层 ===== */
.apple-card-gloss {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  border-radius: inherit;
  transition: all var(--duration-normal) var(--ease-smooth);
  background: linear-gradient(
    105deg,
    transparent 0%,
    rgba(255, 255, 255, 0.05) 40%,
    rgba(255, 255, 255, 0.1) 50%,
    rgba(255, 255, 255, 0.05) 60%,
    transparent 100%
  );
}

/* ===== 内容容器 ===== */
.apple-card-content {
  position: relative;
  z-index: 1;
}

/* ===== 悬停光效 ===== */
.apple-card-light {
  position: absolute;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(255, 255, 255, 0.15) 0%,
    rgba(255, 255, 255, 0.05) 40%,
    transparent 70%
  );
  pointer-events: none;
  transform: translate(-50%, -50%);
  opacity: 0;
  animation: fadeIn var(--duration-normal) var(--ease-smooth) forwards;
  filter: blur(20px);
  z-index: 0;
}

@keyframes fadeIn {
  to {
    opacity: 1;
  }
}

/* ===== 点击涟漪 ===== */
.apple-card-ripple {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(var(--apple-blue), 0.2) 0%,
    transparent 70%
  );
  pointer-events: none;
  animation: ripple 600ms ease-out forwards;
  z-index: 2;
}

@keyframes ripple {
  from {
    transform: scale(0);
    opacity: 1;
  }
  to {
    transform: scale(4);
    opacity: 0;
  }
}

/* ===== 深色模式 ===== */
@media (prefers-color-scheme: dark) {
  .apple-card-glass {
    background: rgba(var(--glass-regular));
    border-color: rgba(var(--glass-border-regular));
  }

  .apple-card-elevated {
    background: rgb(var(--secondary-system-background));
    box-shadow:
      var(--shadow-lg),
      inset 0 0.5px 0 rgba(255, 255, 255, 0.05);
  }

  .apple-card-filled {
    background: rgb(var(--tertiary-system-background));
  }

  .apple-card-outlined {
    background: rgb(var(--secondary-system-background));
    border-color: rgba(var(--separator));
  }

  .apple-card-gloss {
    background: linear-gradient(
      105deg,
      transparent 0%,
      rgba(255, 255, 255, 0.02) 40%,
      rgba(255, 255, 255, 0.05) 50%,
      rgba(255, 255, 255, 0.02) 60%,
      transparent 100%
    );
  }

  .apple-card-light {
    background: radial-gradient(
      circle,
      rgba(255, 255, 255, 0.08) 0%,
      rgba(255, 255, 255, 0.03) 40%,
      transparent 70%
    );
  }
}

/* ===== 性能优化 ===== */
@media (hover: none) {
  .apple-card {
    transition: none !important;
    transform: none !important;
  }

  .apple-card-glass {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    box-shadow: var(--shadow-sm);
  }
  .apple-card-gloss,
  .apple-card-light {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .apple-card {
    transition: none;
  }

  .apple-card-light,
  .apple-card-gloss {
    transition: none;
    animation: none;
  }
}

/* ===== 高对比度模式 ===== */
@media (prefers-contrast: high) {
  .apple-card-outlined {
    border-width: 2px;
  }

  .apple-card-glass {
    border-width: 1px;
  }
}
</style>
