<template>
  <div class="apple-showcase">
    <!-- 导航栏 -->
    <nav class="apple-nav glass-nav">
      <div class="apple-nav-content">
        <h1 class="apple-nav-title">Apple Design System</h1>
        <span class="apple-nav-badge">2025 Liquid Glass</span>
      </div>
    </nav>

    <!-- 主内容 -->
    <main class="apple-main">
      <!-- Hero 区域 -->
      <section class="apple-hero">
        <div class="apple-hero-content">
          <h1 class="apple-hero-title">
            <span class="apple-hero-gradient">Apple级别的</span>
            <br />
            设计系统实现
          </h1>
          <p class="apple-hero-subtitle">
            基于2025 Liquid Glass设计语言，实现像素级完美的用户界面
          </p>
          <div class="apple-hero-actions">
            <AppleButton variant="primary" size="lg" @click="scrollToComponents">
              查看组件
            </AppleButton>
            <AppleButton variant="secondary" size="lg" @click="toggleDarkMode">
              {{ isDark ? '浅色模式' : '深色模式' }}
            </AppleButton>
          </div>
        </div>
      </section>

      <!-- 组件展示 -->
      <section ref="componentsRef" class="apple-section">
        <h2 class="apple-section-title">核心组件</h2>

        <!-- 按钮组件 -->
        <AppleCard variant="glass" class="apple-showcase-card">
          <h3 class="apple-showcase-title">按钮 Buttons</h3>
          <div class="apple-showcase-content">
            <div class="apple-showcase-row">
              <AppleButton variant="primary">主要按钮</AppleButton>
              <AppleButton variant="secondary">次要按钮</AppleButton>
              <AppleButton variant="ghost">幽灵按钮</AppleButton>
              <AppleButton variant="destructive">危险按钮</AppleButton>
              <AppleButton variant="link">链接按钮</AppleButton>
            </div>
            <div class="apple-showcase-row">
              <AppleButton size="sm">小尺寸</AppleButton>
              <AppleButton size="md">中尺寸</AppleButton>
              <AppleButton size="lg">大尺寸</AppleButton>
            </div>
            <div class="apple-showcase-row">
              <AppleButton :loading="true">加载中</AppleButton>
              <AppleButton :disabled="true">禁用状态</AppleButton>
            </div>
          </div>
        </AppleCard>

        <!-- 输入框组件 -->
        <AppleCard variant="glass" class="apple-showcase-card">
          <h3 class="apple-showcase-title">输入框 Inputs</h3>
          <div class="apple-showcase-content">
            <div class="apple-showcase-grid">
              <AppleInput
                v-model="inputValue1"
                label="邮箱地址"
                placeholder="hello@apple.com"
                type="email"
                variant="filled"
              />
              <AppleInput
                v-model="inputValue2"
                label="密码"
                placeholder="输入密码"
                type="password"
                variant="filled"
                clearable
              />
              <AppleInput
                v-model="inputValue3"
                label="搜索"
                placeholder="搜索内容..."
                type="search"
                variant="outlined"
              />
              <AppleInput
                v-model="inputValue4"
                label="电话"
                placeholder="+86 138 0000 0000"
                type="tel"
                variant="outlined"
                helperText="请输入11位手机号"
              />
              <AppleInput
                v-model="inputValue5"
                label="描述"
                placeholder="请输入描述..."
                variant="plain"
                :maxLength="100"
                showCount
              />
              <AppleInput
                v-model="inputValue6"
                label="错误示例"
                placeholder="输入内容"
                variant="filled"
                error="输入格式不正确"
              />
            </div>
          </div>
        </AppleCard>

        <!-- 卡片组件 -->
        <AppleCard variant="glass" class="apple-showcase-card">
          <h3 class="apple-showcase-title">卡片 Cards</h3>
          <div class="apple-showcase-content">
            <div class="apple-showcase-grid">
              <AppleCard variant="glass" interactive>
                <h4 class="apple-card-title">玻璃卡片</h4>
                <p class="apple-card-text">
                  支持Liquid Glass效果，具有光泽和3D交互
                </p>
              </AppleCard>
              <AppleCard variant="elevated">
                <h4 class="apple-card-title">提升卡片</h4>
                <p class="apple-card-text">
                  带有阴影效果的标准卡片样式
                </p>
              </AppleCard>
              <AppleCard variant="filled">
                <h4 class="apple-card-title">填充卡片</h4>
                <p class="apple-card-text">
                  简单的背景填充卡片
                </p>
              </AppleCard>
              <AppleCard variant="outlined">
                <h4 class="apple-card-title">轮廓卡片</h4>
                <p class="apple-card-text">
                  带有边框的轻量级卡片
                </p>
              </AppleCard>
            </div>
          </div>
        </AppleCard>

        <!-- 加载状态 -->
        <AppleCard variant="glass" class="apple-showcase-card">
          <h3 class="apple-showcase-title">加载状态 Loading</h3>
          <div class="apple-showcase-content">
            <div class="apple-showcase-row">
              <div class="apple-loading-demo">
                <AppleLoading type="spinner" />
                <span>旋转加载</span>
              </div>
              <div class="apple-loading-demo">
                <AppleLoading type="dots" />
                <span>点状加载</span>
              </div>
              <div class="apple-loading-demo">
                <AppleLoading type="pulse" />
                <span>脉冲加载</span>
              </div>
            </div>
            <div class="apple-showcase-row">
              <AppleLoading type="bar" :progress="progressValue" />
            </div>
            <div class="apple-showcase-row">
              <AppleLoading type="skeleton" />
            </div>
          </div>
        </AppleCard>
      </section>

      <!-- 设计特性 -->
      <section class="apple-section">
        <h2 class="apple-section-title">设计特性</h2>
        <div class="apple-features">
          <AppleCard variant="glass" class="apple-feature-card" interactive>
            <div class="apple-feature-icon">🎨</div>
            <h3 class="apple-feature-title">Liquid Glass</h3>
            <p class="apple-feature-text">
              2025最新设计语言，模拟真实玻璃的光学特性
            </p>
          </AppleCard>
          <AppleCard variant="glass" class="apple-feature-card" interactive>
            <div class="apple-feature-icon">✨</div>
            <h3 class="apple-feature-title">动态光效</h3>
            <p class="apple-feature-text">
              响应鼠标移动的实时光泽和3D倾斜效果
            </p>
          </AppleCard>
          <AppleCard variant="glass" class="apple-feature-card" interactive>
            <div class="apple-feature-icon">🌓</div>
            <h3 class="apple-feature-title">深色模式</h3>
            <p class="apple-feature-text">
              完美适配深色模式，自动调整玻璃材质
            </p>
          </AppleCard>
          <AppleCard variant="glass" class="apple-feature-card" interactive>
            <div class="apple-feature-icon">📱</div>
            <h3 class="apple-feature-title">触控优化</h3>
            <p class="apple-feature-text">
              44px最小触摸目标，完美的触控反馈
            </p>
          </AppleCard>
          <AppleCard variant="glass" class="apple-feature-card" interactive>
            <div class="apple-feature-icon">🚀</div>
            <h3 class="apple-feature-title">极致性能</h3>
            <p class="apple-feature-text">
              GPU加速动画，确保60fps流畅体验
            </p>
          </AppleCard>
          <AppleCard variant="glass" class="apple-feature-card" interactive>
            <div class="apple-feature-icon">♿</div>
            <h3 class="apple-feature-title">无障碍</h3>
            <p class="apple-feature-text">
              WCAG AAA标准，完整的键盘导航支持
            </p>
          </AppleCard>
        </div>
      </section>

      <!-- 颜色系统 -->
      <section class="apple-section">
        <h2 class="apple-section-title">颜色系统</h2>
        <AppleCard variant="glass" class="apple-showcase-card">
          <div class="apple-colors">
            <div class="apple-color-group">
              <h4 class="apple-color-title">系统颜色</h4>
              <div class="apple-color-grid">
                <div class="apple-color-item">
                  <div class="apple-color-swatch" style="background: rgb(0, 122, 255)"></div>
                  <span>Blue</span>
                </div>
                <div class="apple-color-item">
                  <div class="apple-color-swatch" style="background: rgb(52, 199, 89)"></div>
                  <span>Green</span>
                </div>
                <div class="apple-color-item">
                  <div class="apple-color-swatch" style="background: rgb(255, 159, 10)"></div>
                  <span>Orange</span>
                </div>
                <div class="apple-color-item">
                  <div class="apple-color-swatch" style="background: rgb(255, 59, 48)"></div>
                  <span>Red</span>
                </div>
                <div class="apple-color-item">
                  <div class="apple-color-swatch" style="background: rgb(94, 92, 230)"></div>
                  <span>Purple</span>
                </div>
                <div class="apple-color-item">
                  <div class="apple-color-swatch" style="background: rgb(255, 55, 95)"></div>
                  <span>Pink</span>
                </div>
              </div>
            </div>
          </div>
        </AppleCard>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import AppleButton from '@/components/ui/apple/Button.vue'
import AppleInput from '@/components/ui/apple/Input.vue'
import AppleCard from '@/components/ui/apple/Card.vue'
import AppleLoading from '@/components/ui/apple/Loading.vue'

// 状态
const isDark = ref(false)
const inputValue1 = ref('')
const inputValue2 = ref('')
const inputValue3 = ref('')
const inputValue4 = ref('')
const inputValue5 = ref('')
const inputValue6 = ref('')
const progressValue = ref(0)

// 引用
const componentsRef = ref<HTMLElement>()

// 切换深色模式
const toggleDarkMode = () => {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
}

// 滚动到组件区域
const scrollToComponents = () => {
  componentsRef.value?.scrollIntoView({ behavior: 'smooth' })
}

// 进度条动画
let progressInterval: number

onMounted(() => {
  // 检测系统深色模式
  isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.classList.toggle('dark', isDark.value)

  // 进度条动画
  progressInterval = setInterval(() => {
    progressValue.value = (progressValue.value + 10) % 110
    if (progressValue.value > 100) progressValue.value = 0
  }, 1000) as unknown as number
})

onUnmounted(() => {
  clearInterval(progressInterval)
})
</script>

<style scoped>
/* ===== 页面容器 ===== */
.apple-showcase {
  min-height: 100vh;
  background: rgb(var(--system-background));
}

/* ===== 导航栏 ===== */
.apple-nav {
  position: sticky;
  top: 0;
  height: 52px;
  z-index: 100;
  border-bottom: 0.5px solid rgba(var(--separator));
}

.apple-nav-content {
  max-width: 1200px;
  margin: 0 auto;
  height: 100%;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.apple-nav-title {
  font-size: calc(20px * var(--interface-scale));
  font-weight: 600;
  color: rgba(var(--label));
  letter-spacing: 0.38px;
}

.apple-nav-badge {
  padding: 4px 12px;
  background: rgba(var(--apple-blue), 0.1);
  color: rgb(var(--apple-blue));
  border-radius: 12px;
  font-size: calc(13px * var(--interface-scale));
  font-weight: 500;
}

/* ===== 主内容 ===== */
.apple-main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px 48px;
}

/* ===== Hero 区域 ===== */
.apple-hero {
  padding: 80px 0;
  text-align: center;
}

.apple-hero-content {
  max-width: 800px;
  margin: 0 auto;
}

.apple-hero-title {
  font-size: calc(56px * var(--interface-scale));
  line-height: 1.1;
  font-weight: 700;
  color: rgba(var(--label));
  margin-bottom: 24px;
  letter-spacing: -0.02em;
}

.apple-hero-gradient {
  background: linear-gradient(
    90deg,
    rgb(var(--apple-blue)) 0%,
    rgb(var(--apple-purple)) 50%,
    rgb(var(--apple-pink)) 100%
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.apple-hero-subtitle {
  font-size: calc(22px * var(--interface-scale));
  line-height: 1.4;
  color: rgba(var(--secondary-label));
  margin-bottom: 40px;
  letter-spacing: 0.352px;
}

.apple-hero-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
}

/* ===== 区块 ===== */
.apple-section {
  margin-bottom: 80px;
}

.apple-section-title {
  font-size: calc(34px * var(--interface-scale));
  line-height: 1.2;
  font-weight: 700;
  color: rgba(var(--label));
  margin-bottom: 32px;
  letter-spacing: 0.374px;
}

/* ===== 展示卡片 ===== */
.apple-showcase-card {
  margin-bottom: 24px;
}

.apple-showcase-title {
  font-size: calc(22px * var(--interface-scale));
  font-weight: 600;
  color: rgba(var(--label));
  margin-bottom: 24px;
  letter-spacing: 0.352px;
}

.apple-showcase-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.apple-showcase-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
}

.apple-showcase-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}

/* ===== 加载演示 ===== */
.apple-loading-demo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 20px;
}

.apple-loading-demo span {
  font-size: calc(13px * var(--interface-scale));
  color: rgba(var(--secondary-label));
}

/* ===== 特性卡片 ===== */
.apple-features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 24px;
}

.apple-feature-card {
  text-align: center;
  padding: 32px 24px !important;
}

.apple-feature-icon {
  font-size: calc(48px * var(--interface-scale));
  margin-bottom: 16px;
}

.apple-feature-title {
  font-size: calc(20px * var(--interface-scale));
  font-weight: 600;
  color: rgba(var(--label));
  margin-bottom: 12px;
  letter-spacing: 0.38px;
}

.apple-feature-text {
  font-size: calc(15px * var(--interface-scale));
  line-height: 1.4;
  color: rgba(var(--secondary-label));
  letter-spacing: -0.24px;
}

/* ===== 卡片内容 ===== */
.apple-card-title {
  font-size: calc(17px * var(--interface-scale));
  font-weight: 600;
  color: rgba(var(--label));
  margin-bottom: 8px;
}

.apple-card-text {
  font-size: calc(15px * var(--interface-scale));
  line-height: 1.4;
  color: rgba(var(--secondary-label));
}

/* ===== 颜色系统 ===== */
.apple-colors {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.apple-color-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.apple-color-title {
  font-size: calc(17px * var(--interface-scale));
  font-weight: 600;
  color: rgba(var(--label));
}

.apple-color-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 16px;
}

.apple-color-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.apple-color-swatch {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
}

.apple-color-item span {
  font-size: calc(13px * var(--interface-scale));
  color: rgba(var(--secondary-label));
}

/* ===== 响应式 ===== */
@media (max-width: 768px) {
  .apple-hero-title {
    font-size: calc(40px * var(--interface-scale));
  }

  .apple-hero-subtitle {
    font-size: calc(18px * var(--interface-scale));
  }

  .apple-hero-actions {
    flex-direction: column;
  }

  .apple-section-title {
    font-size: calc(28px * var(--interface-scale));
  }

  .apple-showcase-grid {
    grid-template-columns: 1fr;
  }

  .apple-features {
    grid-template-columns: 1fr;
  }
}

/* ===== 深色模式 ===== */
:global(.dark) .apple-showcase {
  background: rgb(var(--system-background));
}

:global(.dark) .apple-nav-badge {
  background: rgba(10, 132, 255, 0.15);
  color: rgb(10, 132, 255);
}
</style>