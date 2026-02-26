<template>
  <Transition :name="transition" mode="out-in">
    <div v-if="loading" class="apple-loading" :class="loadingClasses">
      <!-- 旋转加载器 -->
      <div v-if="type === 'spinner'" class="apple-loading-spinner">
        <svg :width="size" :height="size" viewBox="0 0 48 48">
          <circle
            cx="24"
            cy="24"
            r="20"
            stroke="currentColor"
            stroke-width="3"
            fill="none"
            stroke-dasharray="90"
            stroke-dashoffset="15"
            stroke-linecap="round"
            class="apple-loading-spinner-circle"
          />
        </svg>
      </div>

      <!-- 点状加载器 -->
      <div v-else-if="type === 'dots'" class="apple-loading-dots">
        <span
          v-for="i in 3"
          :key="i"
          class="apple-loading-dot"
          :style="{ animationDelay: `${(i - 1) * 0.15}s` }"
        />
      </div>

      <!-- 脉冲加载器 -->
      <div v-else-if="type === 'pulse'" class="apple-loading-pulse">
        <span class="apple-loading-pulse-ring" />
        <span class="apple-loading-pulse-ring" style="animation-delay: 0.5s" />
        <span class="apple-loading-pulse-ring" style="animation-delay: 1s" />
      </div>

      <!-- 进度条加载器 -->
      <div v-else-if="type === 'bar'" class="apple-loading-bar">
        <div class="apple-loading-bar-track">
          <div
            class="apple-loading-bar-fill"
            :style="{ width: `${progress}%` }"
          />
        </div>
        <span v-if="showProgress" class="apple-loading-bar-label">
          {{ progress }}%
        </span>
      </div>

      <!-- 骨架屏加载器 -->
      <div v-else-if="type === 'skeleton'" class="apple-loading-skeleton">
        <slot name="skeleton">
          <!-- 默认骨架屏 -->
          <div class="apple-skeleton-card">
            <div class="apple-skeleton-header">
              <div class="apple-skeleton-avatar" />
              <div class="apple-skeleton-lines">
                <div class="apple-skeleton-line" style="width: 60%" />
                <div class="apple-skeleton-line" style="width: 40%" />
              </div>
            </div>
            <div class="apple-skeleton-content">
              <div class="apple-skeleton-line" />
              <div class="apple-skeleton-line" />
              <div class="apple-skeleton-line" style="width: 80%" />
            </div>
          </div>
        </slot>
      </div>

      <!-- 加载文字 -->
      <span v-if="text && type !== 'skeleton'" class="apple-loading-text">
        {{ text }}
      </span>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'

// 定义属性
const props = defineProps({
  loading: {
    type: Boolean,
    default: true
  },
  type: {
    type: String as PropType<'spinner' | 'dots' | 'pulse' | 'bar' | 'skeleton'>,
    default: 'spinner'
  },
  size: {
    type: Number,
    default: 48
  },
  color: {
    type: String as PropType<'primary' | 'white' | 'black' | 'current'>,
    default: 'primary'
  },
  text: String,
  progress: {
    type: Number,
    default: 0
  },
  showProgress: {
    type: Boolean,
    default: true
  },
  overlay: {
    type: Boolean,
    default: false
  },
  blur: {
    type: Boolean,
    default: false
  },
  transition: {
    type: String as PropType<'fade' | 'scale' | 'slide'>,
    default: 'fade'
  },
  className: String
})

// 计算类名
const loadingClasses = computed(() => [
  `apple-loading-${props.color}`,
  props.overlay && 'apple-loading-overlay',
  props.blur && 'apple-loading-blur',
  props.className
])
</script>

<style scoped>
/* ===== 基础加载容器 ===== */
.apple-loading {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

/* ===== 颜色变体 ===== */
.apple-loading-primary {
  color: rgb(var(--apple-blue));
}

.apple-loading-white {
  color: white;
}

.apple-loading-black {
  color: black;
}

.apple-loading-current {
  color: currentColor;
}

/* ===== 覆盖层模式 ===== */
.apple-loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(var(--system-background), 0.9);
  z-index: 9999;
}

.apple-loading-blur {
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

/* ===== 旋转加载器 ===== */
.apple-loading-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
}

.apple-loading-spinner-circle {
  animation: spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
  transform-origin: center;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
    stroke-dashoffset: 15;
  }
  50% {
    stroke-dashoffset: 90;
  }
  100% {
    transform: rotate(360deg);
    stroke-dashoffset: 15;
  }
}

/* ===== 点状加载器 ===== */
.apple-loading-dots {
  display: flex;
  align-items: center;
  gap: 8px;
}

.apple-loading-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: currentColor;
  animation: dot-pulse 1.5s ease-in-out infinite;
}

@keyframes dot-pulse {
  0%, 80%, 100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  40% {
    opacity: 1;
    transform: scale(1);
  }
}

/* ===== 脉冲加载器 ===== */
.apple-loading-pulse {
  position: relative;
  width: 48px;
  height: 48px;
}

.apple-loading-pulse-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100%;
  height: 100%;
  border: 2px solid currentColor;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
}

@keyframes pulse-ring {
  0% {
    transform: translate(-50%, -50%) scale(0.5);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(1.5);
    opacity: 0;
  }
}

/* ===== 进度条加载器 ===== */
.apple-loading-bar {
  width: 200px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.apple-loading-bar-track {
  height: 6px;
  background: rgba(var(--tertiary-fill));
  border-radius: 3px;
  overflow: hidden;
  position: relative;
}

.apple-loading-bar-fill {
  height: 100%;
  background: currentColor;
  border-radius: 3px;
  transition: width var(--duration-normal) var(--ease-smooth);
  position: relative;
  overflow: hidden;
}

.apple-loading-bar-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.3) 50%,
    transparent 100%
  );
  animation: shimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.apple-loading-bar-label {
  font-size: calc(13px * var(--interface-scale));
  line-height: 18px;
  color: rgba(var(--secondary-label));
  text-align: center;
}

/* ===== 骨架屏 ===== */
.apple-loading-skeleton {
  width: 100%;
}

.apple-skeleton-card {
  padding: 20px;
  background: rgba(var(--glass-regular));
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border: 0.5px solid rgba(var(--glass-border-light));
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-sm);
}

.apple-skeleton-header {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.apple-skeleton-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(
    90deg,
    rgba(var(--tertiary-fill)) 0%,
    rgba(var(--secondary-fill)) 50%,
    rgba(var(--tertiary-fill)) 100%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

.apple-skeleton-lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
}

.apple-skeleton-line {
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(
    90deg,
    rgba(var(--tertiary-fill)) 0%,
    rgba(var(--secondary-fill)) 50%,
    rgba(var(--tertiary-fill)) 100%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

.apple-skeleton-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

@keyframes skeleton-shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

/* ===== 加载文字 ===== */
.apple-loading-text {
  font-size: calc(15px * var(--interface-scale));
  line-height: 20px;
  color: rgba(var(--secondary-label));
  letter-spacing: -0.24px;
}

/* ===== 过渡动画 ===== */

/* 淡入淡出 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--duration-normal) var(--ease-smooth);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 缩放 */
.scale-enter-active,
.scale-leave-active {
  transition: all var(--duration-normal) var(--ease-spring);
}

.scale-enter-from {
  opacity: 0;
  transform: scale(0.9);
}

.scale-leave-to {
  opacity: 0;
  transform: scale(1.1);
}

/* 滑动 */
.slide-enter-active,
.slide-leave-active {
  transition: all var(--duration-normal) var(--ease-smooth);
}

.slide-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.slide-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

/* ===== 深色模式 ===== */
@media (prefers-color-scheme: dark) {
  .apple-loading-overlay {
    background: rgba(var(--system-background), 0.9);
  }

  .apple-loading-primary {
    color: rgb(10, 132, 255);
  }
}

/* ===== 减少动画模式 ===== */
@media (prefers-reduced-motion: reduce) {
  .apple-loading-spinner-circle,
  .apple-loading-dot,
  .apple-loading-pulse-ring,
  .apple-skeleton-avatar,
  .apple-skeleton-line {
    animation: none;
  }

  .apple-loading-bar-fill::after {
    animation: none;
  }
}
</style>