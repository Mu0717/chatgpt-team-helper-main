<template>
  <div class="apple-datetime-wrapper" ref="wrapperRef">
    <!-- 触发器 -->
    <div
      class="apple-datetime-trigger"
      :class="{ 'is-focused': isOpen, 'is-disabled': disabled }"
      @click.stop.prevent="togglePicker"
    >
      <div class="apple-datetime-display">
        <span v-if="displayValue" class="apple-datetime-value">{{ displayValue }}</span>
        <span v-else class="apple-datetime-placeholder">{{ placeholder }}</span>
      </div>
      <div class="apple-datetime-icon">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" stroke-width="1.5"/>
          <path d="M3 8H17" stroke="currentColor" stroke-width="1.5"/>
          <path d="M7 2V5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M13 2V5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
    </div>

    <!-- 弹出选择器 -->
    <Teleport to="body">
      <Transition name="apple-picker">
        <div
          v-if="isOpen"
          class="apple-datetime-overlay"
          @click.self.stop="closePicker"
          @pointerdown.stop
          @mousedown.stop
          @focusin.stop
        >
          <div class="apple-datetime-picker" ref="pickerRef" @click.stop @pointerdown.stop @mousedown.stop @focusin.stop>
            <!-- 头部 -->
            <div class="apple-picker-header">
              <button type="button" class="apple-picker-cancel" @click.stop="handleCancel">取消</button>
              <span class="apple-picker-title">选择时间</span>
              <button type="button" class="apple-picker-confirm" @click.stop="handleConfirm">确定</button>
            </div>

            <!-- 日期选择 -->
            <div class="apple-picker-date">
              <div class="apple-picker-month-nav">
                <button type="button" class="apple-nav-btn" @click.stop="prevMonth">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M12 15L7 10L12 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <span class="apple-current-month">{{ currentMonthLabel }}</span>
                <button type="button" class="apple-nav-btn" @click.stop="nextMonth">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M8 5L13 10L8 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
              </div>

              <!-- 星期头 -->
              <div class="apple-weekdays">
                <span v-for="day in weekdays" :key="day">{{ day }}</span>
              </div>

              <!-- 日期网格 -->
              <div class="apple-days-grid">
                <button
                  v-for="(day, index) in calendarDays"
                  :key="index"
                  type="button"
                  class="apple-day-btn"
                  :class="{
                    'is-other-month': day.isOtherMonth,
                    'is-today': day.isToday,
                    'is-selected': day.isSelected
                  }"
                  @click.stop="selectDate(day)"
                >
                  {{ day.date }}
                </button>
              </div>
            </div>

            <!-- 时间选择 -->
            <div class="apple-picker-time">
              <div class="apple-time-label">时间</div>
              <div class="apple-time-wheels">
                <!-- 小时 -->
                <div class="apple-wheel-container">
                  <div class="apple-wheel" ref="hourWheelRef" @scroll="onHourScroll">
                    <div class="apple-wheel-padding"></div>
                    <div
                      v-for="h in hours"
                      :key="h"
                      class="apple-wheel-item"
                      :class="{ 'is-selected': h === selectedHour }"
                      @click.stop="selectHour(h)"
                    >
                      {{ String(h).padStart(2, '0') }}
                    </div>
                    <div class="apple-wheel-padding"></div>
                  </div>
                  <div class="apple-wheel-highlight"></div>
                </div>
                <span class="apple-time-separator">:</span>
                <!-- 分钟 -->
                <div class="apple-wheel-container">
                  <div class="apple-wheel" ref="minuteWheelRef" @scroll="onMinuteScroll">
                    <div class="apple-wheel-padding"></div>
                    <div
                      v-for="m in minutes"
                      :key="m"
                      class="apple-wheel-item"
                      :class="{ 'is-selected': m === selectedMinute }"
                      @click.stop="selectMinute(m)"
                    >
                      {{ String(m).padStart(2, '0') }}
                    </div>
                    <div class="apple-wheel-padding"></div>
                  </div>
                  <div class="apple-wheel-highlight"></div>
                </div>
                <span class="apple-time-separator">:</span>
                <!-- 秒 -->
                <div class="apple-wheel-container">
                  <div class="apple-wheel" ref="secondWheelRef" @scroll="onSecondScroll">
                    <div class="apple-wheel-padding"></div>
                    <div
                      v-for="s in seconds"
                      :key="s"
                      class="apple-wheel-item"
                      :class="{ 'is-selected': s === selectedSecond }"
                      @click.stop="selectSecond(s)"
                    >
                      {{ String(s).padStart(2, '0') }}
                    </div>
                    <div class="apple-wheel-padding"></div>
                  </div>
                  <div class="apple-wheel-highlight"></div>
                </div>
              </div>
            </div>

            <!-- 快捷选项 -->
            <div class="apple-picker-shortcuts">
              <button type="button" class="apple-shortcut-btn" @click.stop="setNow">现在</button>
              <button type="button" class="apple-shortcut-btn" @click.stop="setTomorrow">明天</button>
              <button type="button" class="apple-shortcut-btn" @click.stop="setNextWeek">下周</button>
              <button type="button" class="apple-shortcut-btn" @click.stop="setNextMonth">下月</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  modelValue?: string
  placeholder?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const wrapperRef = ref<HTMLElement>()
const pickerRef = ref<HTMLElement>()
const hourWheelRef = ref<HTMLElement>()
const minuteWheelRef = ref<HTMLElement>()
const secondWheelRef = ref<HTMLElement>()

const isOpen = ref(false)
const viewYear = ref(new Date().getFullYear())
const viewMonth = ref(new Date().getMonth())
const selectedYear = ref(new Date().getFullYear())
const selectedMonth = ref(new Date().getMonth())
const selectedDate = ref(new Date().getDate())
const selectedHour = ref(0)
const selectedMinute = ref(0)
const selectedSecond = ref(0)

const weekdays = ['日', '一', '二', '三', '四', '五', '六']
const hours = Array.from({ length: 24 }, (_, i) => i)
const minutes = Array.from({ length: 60 }, (_, i) => i)
const seconds = Array.from({ length: 60 }, (_, i) => i)

const ITEM_HEIGHT = 36

// 显示值
const displayValue = computed(() => {
  if (!props.modelValue) return ''
  // datetime-local 格式: YYYY-MM-DDTHH:mm:ss
  const match = props.modelValue.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/)
  if (match) {
    const [, year, month, day, hour, minute, second] = match
    return `${year}年${month}月${day}日 ${hour}:${minute}:${second}`
  }
  return props.modelValue
})

// 当前月份标签
const currentMonthLabel = computed(() => {
  return `${viewYear.value}年${viewMonth.value + 1}月`
})

// 日历天数
const calendarDays = computed(() => {
  const days: Array<{
    date: number
    year: number
    month: number
    isOtherMonth: boolean
    isToday: boolean
    isSelected: boolean
  }> = []

  const firstDay = new Date(viewYear.value, viewMonth.value, 1)
  const lastDay = new Date(viewYear.value, viewMonth.value + 1, 0)
  const startDay = firstDay.getDay()
  const daysInMonth = lastDay.getDate()

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`
  const selectedStr = `${selectedYear.value}-${selectedMonth.value}-${selectedDate.value}`

  // 上月填充
  const prevMonth = new Date(viewYear.value, viewMonth.value, 0)
  const prevMonthDays = prevMonth.getDate()
  for (let i = startDay - 1; i >= 0; i--) {
    const date = prevMonthDays - i
    const year = viewMonth.value === 0 ? viewYear.value - 1 : viewYear.value
    const month = viewMonth.value === 0 ? 11 : viewMonth.value - 1
    days.push({
      date,
      year,
      month,
      isOtherMonth: true,
      isToday: `${year}-${month}-${date}` === todayStr,
      isSelected: `${year}-${month}-${date}` === selectedStr
    })
  }

  // 当月
  for (let date = 1; date <= daysInMonth; date++) {
    days.push({
      date,
      year: viewYear.value,
      month: viewMonth.value,
      isOtherMonth: false,
      isToday: `${viewYear.value}-${viewMonth.value}-${date}` === todayStr,
      isSelected: `${viewYear.value}-${viewMonth.value}-${date}` === selectedStr
    })
  }

  // 下月填充
  const remaining = 42 - days.length
  for (let date = 1; date <= remaining; date++) {
    const year = viewMonth.value === 11 ? viewYear.value + 1 : viewYear.value
    const month = viewMonth.value === 11 ? 0 : viewMonth.value + 1
    days.push({
      date,
      year,
      month,
      isOtherMonth: true,
      isToday: `${year}-${month}-${date}` === todayStr,
      isSelected: `${year}-${month}-${date}` === selectedStr
    })
  }

  return days
})

// 解析 modelValue
const parseModelValue = () => {
  if (!props.modelValue) {
    const now = new Date()
    selectedYear.value = now.getFullYear()
    selectedMonth.value = now.getMonth()
    selectedDate.value = now.getDate()
    selectedHour.value = now.getHours()
    selectedMinute.value = now.getMinutes()
    selectedSecond.value = now.getSeconds()
    viewYear.value = now.getFullYear()
    viewMonth.value = now.getMonth()
    return
  }

  const match = props.modelValue.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/)
  if (match) {
    const year = match[1]!
    const month = match[2]!
    const day = match[3]!
    const hour = match[4]!
    const minute = match[5]!
    const second = match[6]!
    selectedYear.value = parseInt(year)
    selectedMonth.value = parseInt(month) - 1
    selectedDate.value = parseInt(day)
    selectedHour.value = parseInt(hour)
    selectedMinute.value = parseInt(minute)
    selectedSecond.value = parseInt(second)
    viewYear.value = parseInt(year)
    viewMonth.value = parseInt(month) - 1
  }
}

// 生成输出值
const generateOutput = () => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${selectedYear.value}-${pad(selectedMonth.value + 1)}-${pad(selectedDate.value)}T${pad(selectedHour.value)}:${pad(selectedMinute.value)}:${pad(selectedSecond.value)}`
}

// 切换选择器
const togglePicker = () => {
  if (props.disabled) return
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    parseModelValue()
    nextTick(() => {
      scrollToSelected()
    })
  }
}

const closePicker = () => {
  isOpen.value = false
}

// 滚动到选中项
const scrollToSelected = () => {
  if (hourWheelRef.value) {
    hourWheelRef.value.scrollTop = selectedHour.value * ITEM_HEIGHT
  }
  if (minuteWheelRef.value) {
    minuteWheelRef.value.scrollTop = selectedMinute.value * ITEM_HEIGHT
  }
  if (secondWheelRef.value) {
    secondWheelRef.value.scrollTop = selectedSecond.value * ITEM_HEIGHT
  }
}

// 月份导航
const prevMonth = () => {
  if (viewMonth.value === 0) {
    viewMonth.value = 11
    viewYear.value--
  } else {
    viewMonth.value--
  }
}

const nextMonth = () => {
  if (viewMonth.value === 11) {
    viewMonth.value = 0
    viewYear.value++
  } else {
    viewMonth.value++
  }
}

// 选择日期
const selectDate = (day: { date: number; year: number; month: number }) => {
  selectedYear.value = day.year
  selectedMonth.value = day.month
  selectedDate.value = day.date
  viewYear.value = day.year
  viewMonth.value = day.month
}

// 时间滚轮处理
let hourScrollTimer: ReturnType<typeof setTimeout> | null = null
let minuteScrollTimer: ReturnType<typeof setTimeout> | null = null
let secondScrollTimer: ReturnType<typeof setTimeout> | null = null

const onHourScroll = () => {
  if (hourScrollTimer) clearTimeout(hourScrollTimer)
  hourScrollTimer = setTimeout(() => {
    if (hourWheelRef.value) {
      const index = Math.round(hourWheelRef.value.scrollTop / ITEM_HEIGHT)
      selectedHour.value = Math.max(0, Math.min(23, index))
      hourWheelRef.value.scrollTo({ top: selectedHour.value * ITEM_HEIGHT, behavior: 'smooth' })
    }
  }, 100)
}

const onMinuteScroll = () => {
  if (minuteScrollTimer) clearTimeout(minuteScrollTimer)
  minuteScrollTimer = setTimeout(() => {
    if (minuteWheelRef.value) {
      const index = Math.round(minuteWheelRef.value.scrollTop / ITEM_HEIGHT)
      selectedMinute.value = Math.max(0, Math.min(59, index))
      minuteWheelRef.value.scrollTo({ top: selectedMinute.value * ITEM_HEIGHT, behavior: 'smooth' })
    }
  }, 100)
}

const onSecondScroll = () => {
  if (secondScrollTimer) clearTimeout(secondScrollTimer)
  secondScrollTimer = setTimeout(() => {
    if (secondWheelRef.value) {
      const index = Math.round(secondWheelRef.value.scrollTop / ITEM_HEIGHT)
      selectedSecond.value = Math.max(0, Math.min(59, index))
      secondWheelRef.value.scrollTo({ top: selectedSecond.value * ITEM_HEIGHT, behavior: 'smooth' })
    }
  }, 100)
}

const selectHour = (h: number) => {
  selectedHour.value = h
  if (hourWheelRef.value) {
    hourWheelRef.value.scrollTo({ top: h * ITEM_HEIGHT, behavior: 'smooth' })
  }
}

const selectMinute = (m: number) => {
  selectedMinute.value = m
  if (minuteWheelRef.value) {
    minuteWheelRef.value.scrollTo({ top: m * ITEM_HEIGHT, behavior: 'smooth' })
  }
}

const selectSecond = (s: number) => {
  selectedSecond.value = s
  if (secondWheelRef.value) {
    secondWheelRef.value.scrollTo({ top: s * ITEM_HEIGHT, behavior: 'smooth' })
  }
}

// 快捷选项
const setNow = () => {
  const now = new Date()
  selectedYear.value = now.getFullYear()
  selectedMonth.value = now.getMonth()
  selectedDate.value = now.getDate()
  selectedHour.value = now.getHours()
  selectedMinute.value = now.getMinutes()
  selectedSecond.value = now.getSeconds()
  viewYear.value = now.getFullYear()
  viewMonth.value = now.getMonth()
  nextTick(scrollToSelected)
}

const setTomorrow = () => {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  selectedYear.value = tomorrow.getFullYear()
  selectedMonth.value = tomorrow.getMonth()
  selectedDate.value = tomorrow.getDate()
  viewYear.value = tomorrow.getFullYear()
  viewMonth.value = tomorrow.getMonth()
}

const setNextWeek = () => {
  const nextWeek = new Date()
  nextWeek.setDate(nextWeek.getDate() + 7)
  selectedYear.value = nextWeek.getFullYear()
  selectedMonth.value = nextWeek.getMonth()
  selectedDate.value = nextWeek.getDate()
  viewYear.value = nextWeek.getFullYear()
  viewMonth.value = nextWeek.getMonth()
}

const setNextMonth = () => {
  const nextMonth = new Date()
  nextMonth.setMonth(nextMonth.getMonth() + 1)
  selectedYear.value = nextMonth.getFullYear()
  selectedMonth.value = nextMonth.getMonth()
  selectedDate.value = nextMonth.getDate()
  viewYear.value = nextMonth.getFullYear()
  viewMonth.value = nextMonth.getMonth()
}

// 确认/取消
const handleConfirm = () => {
  emit('update:modelValue', generateOutput())
  closePicker()
}

const handleCancel = () => {
  closePicker()
}

// 点击外部关闭
const handleClickOutside = (e: MouseEvent) => {
  if (!isOpen.value) return
  const target = e.target as Node
  if (wrapperRef.value?.contains(target)) return
  if (pickerRef.value?.contains(target)) return
  closePicker()
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
  if (hourScrollTimer) clearTimeout(hourScrollTimer)
  if (minuteScrollTimer) clearTimeout(minuteScrollTimer)
  if (secondScrollTimer) clearTimeout(secondScrollTimer)
})

watch(() => props.modelValue, parseModelValue, { immediate: true })
</script>

<style scoped>
/* 包装器 */
.apple-datetime-wrapper {
  position: relative;
  width: 100%;
}

/* 触发器 */
.apple-datetime-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 0 16px;
  background: rgba(120, 120, 128, 0.08);
  border: 1px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.apple-datetime-trigger:hover:not(.is-disabled) {
  background: rgba(120, 120, 128, 0.12);
}

.apple-datetime-trigger.is-focused {
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(0, 122, 255, 0.5);
  box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.1);
}

.apple-datetime-trigger.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.apple-datetime-display {
  flex: 1;
  min-width: 0;
}

.apple-datetime-value {
  font-size: 15px;
  font-weight: 400;
  color: #1d1d1f;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
}

.apple-datetime-placeholder {
  font-size: 15px;
  color: rgba(60, 60, 67, 0.4);
}

.apple-datetime-icon {
  flex-shrink: 0;
  color: rgba(60, 60, 67, 0.5);
  margin-left: 8px;
}

/* 弹出层 */
.apple-datetime-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

/* 选择器面板 */
.apple-datetime-picker {
  width: 340px;
  max-height: 90vh;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.98);
  border-radius: 20px;
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.25),
    0 0 0 1px rgba(0, 0, 0, 0.05);
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
}

/* 头部 */
.apple-picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.apple-picker-title {
  font-size: 17px;
  font-weight: 600;
  color: #1d1d1f;
}

.apple-picker-cancel,
.apple-picker-confirm {
  padding: 8px 12px;
  font-size: 17px;
  font-weight: 400;
  color: #007aff;
  background: none;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.apple-picker-cancel:hover,
.apple-picker-confirm:hover {
  background: rgba(0, 122, 255, 0.1);
}

.apple-picker-confirm {
  font-weight: 600;
}

/* 日期选择区域 */
.apple-picker-date {
  padding: 16px 20px;
}

.apple-picker-month-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.apple-current-month {
  font-size: 17px;
  font-weight: 600;
  color: #1d1d1f;
}

.apple-nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  color: #007aff;
  background: none;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.apple-nav-btn:hover {
  background: rgba(0, 122, 255, 0.1);
}

.apple-nav-btn:active {
  transform: scale(0.95);
}

/* 星期头 */
.apple-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 8px;
}

.apple-weekdays span {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(60, 60, 67, 0.5);
}

/* 日期网格 */
.apple-days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.apple-day-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  font-size: 17px;
  font-weight: 400;
  color: #1d1d1f;
  background: none;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.apple-day-btn:hover:not(.is-selected) {
  background: rgba(0, 0, 0, 0.04);
}

.apple-day-btn.is-other-month {
  color: rgba(60, 60, 67, 0.3);
}

.apple-day-btn.is-today {
  color: #007aff;
  font-weight: 600;
}

.apple-day-btn.is-selected {
  color: white;
  background: #007aff;
  font-weight: 600;
}

/* 时间选择区域 */
.apple-picker-time {
  padding: 16px 20px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.apple-time-label {
  font-size: 13px;
  font-weight: 600;
  color: rgba(60, 60, 67, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
}

.apple-time-wheels {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.apple-wheel-container {
  position: relative;
  width: 60px;
  height: 108px;
  overflow: hidden;
}

.apple-wheel {
  height: 100%;
  overflow-y: scroll;
  scroll-snap-type: y mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.apple-wheel::-webkit-scrollbar {
  display: none;
}

.apple-wheel-padding {
  height: 36px;
}

.apple-wheel-item {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  font-size: 20px;
  font-weight: 400;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Mono', monospace;
  font-variant-numeric: tabular-nums;
  color: rgba(60, 60, 67, 0.6);
  cursor: pointer;
  scroll-snap-align: center;
  transition: all 0.15s ease;
}

.apple-wheel-item.is-selected {
  color: #1d1d1f;
  font-weight: 600;
}

.apple-wheel-highlight {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 36px;
  transform: translateY(-50%);
  background: rgba(120, 120, 128, 0.08);
  border-radius: 8px;
  pointer-events: none;
}

.apple-time-separator {
  font-size: 24px;
  font-weight: 600;
  color: #1d1d1f;
}

/* 快捷选项 */
.apple-picker-shortcuts {
  display: flex;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.apple-shortcut-btn {
  flex: 1;
  padding: 10px 12px;
  font-size: 14px;
  font-weight: 500;
  color: #007aff;
  background: rgba(0, 122, 255, 0.1);
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.apple-shortcut-btn:hover {
  background: rgba(0, 122, 255, 0.15);
}

.apple-shortcut-btn:active {
  transform: scale(0.98);
}

/* 动画 */
.apple-picker-enter-active,
.apple-picker-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.apple-picker-enter-active .apple-datetime-picker,
.apple-picker-leave-active .apple-datetime-picker {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.apple-picker-enter-from,
.apple-picker-leave-to {
  opacity: 0;
}

.apple-picker-enter-from .apple-datetime-picker,
.apple-picker-leave-to .apple-datetime-picker {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}

/* 深色模式 */
@media (prefers-color-scheme: dark) {
  .apple-datetime-trigger {
    background: rgba(120, 120, 128, 0.2);
  }

  .apple-datetime-trigger:hover:not(.is-disabled) {
    background: rgba(120, 120, 128, 0.28);
  }

  .apple-datetime-trigger.is-focused {
    background: rgba(30, 30, 30, 0.9);
    border-color: rgba(10, 132, 255, 0.5);
  }

  .apple-datetime-value {
    color: #f5f5f7;
  }

  .apple-datetime-placeholder {
    color: rgba(235, 235, 245, 0.4);
  }

  .apple-datetime-icon {
    color: rgba(235, 235, 245, 0.5);
  }

  .apple-datetime-picker {
    background: rgba(44, 44, 46, 0.98);
  }

  .apple-picker-header {
    border-color: rgba(255, 255, 255, 0.08);
  }

  .apple-picker-title {
    color: #f5f5f7;
  }

  .apple-picker-cancel,
  .apple-picker-confirm {
    color: #0a84ff;
  }

  .apple-picker-cancel:hover,
  .apple-picker-confirm:hover {
    background: rgba(10, 132, 255, 0.15);
  }

  .apple-current-month {
    color: #f5f5f7;
  }

  .apple-nav-btn {
    color: #0a84ff;
  }

  .apple-nav-btn:hover {
    background: rgba(10, 132, 255, 0.15);
  }

  .apple-weekdays span {
    color: rgba(235, 235, 245, 0.5);
  }

  .apple-day-btn {
    color: #f5f5f7;
  }

  .apple-day-btn:hover:not(.is-selected) {
    background: rgba(255, 255, 255, 0.08);
  }

  .apple-day-btn.is-other-month {
    color: rgba(235, 235, 245, 0.3);
  }

  .apple-day-btn.is-today {
    color: #0a84ff;
  }

  .apple-day-btn.is-selected {
    background: #0a84ff;
  }

  .apple-picker-time {
    border-color: rgba(255, 255, 255, 0.08);
  }

  .apple-time-label {
    color: rgba(235, 235, 245, 0.5);
  }

  .apple-wheel-item {
    color: rgba(235, 235, 245, 0.6);
  }

  .apple-wheel-item.is-selected {
    color: #f5f5f7;
  }

  .apple-wheel-highlight {
    background: rgba(120, 120, 128, 0.2);
  }

  .apple-time-separator {
    color: #f5f5f7;
  }

  .apple-picker-shortcuts {
    border-color: rgba(255, 255, 255, 0.08);
  }

  .apple-shortcut-btn {
    color: #0a84ff;
    background: rgba(10, 132, 255, 0.15);
  }

  .apple-shortcut-btn:hover {
    background: rgba(10, 132, 255, 0.25);
  }
}
</style>
