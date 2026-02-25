<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { events, loadEvents } from '../store/events'

const eventTypes = [
  { value: 'task', label: '任务', color: '#667eea', bgColor: 'linear-gradient(135deg, #667eea 0%, #5a67d8 100%)' },
  { value: 'meeting', label: '会议', color: '#48bb78', bgColor: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)' },
  { value: 'issue', label: '问题', color: '#f56565', bgColor: 'linear-gradient(135deg, #f56565 0%, #e53e3e 100%)' },
  { value: 'reminder', label: '提醒', color: '#ed8936', bgColor: 'linear-gradient(135deg, #ed8936 0%, #dd6b20 100%)' },
  { value: 'other', label: '其他', color: '#718096', bgColor: 'linear-gradient(135deg, #718096 0%, #4a5568 100%)' }
]

const getEventType = (type) => {
  return eventTypes.find(item => item.value === type) || eventTypes[4]
}

const presets = [

  { label: '番茄 25/5', focus: 25, rest: 5 },
  { label: '深度 50/10', focus: 50, rest: 10 },
  { label: '冲刺 90/15', focus: 90, rest: 15 }
]

const selectedPreset = ref(presets[0])
const mode = ref('focus')
const remainingSec = ref(selectedPreset.value.focus * 60)
const running = ref(false)
let timerId = null

const formatClock = (value) => {
  const minutes = Math.floor(value / 60)
  const seconds = value % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const currentLabel = computed(() => (mode.value === 'focus' ? '专注中' : '休息中'))

const progress = computed(() => {
  const total = (mode.value === 'focus' ? selectedPreset.value.focus : selectedPreset.value.rest) * 60
  if (!total) return 0
  const value = Math.round(((total - remainingSec.value) / total) * 100)
  return Math.min(100, Math.max(0, value))
})

const tick = () => {
  if (remainingSec.value > 0) {
    remainingSec.value -= 1
    return
  }
  mode.value = mode.value === 'focus' ? 'rest' : 'focus'
  remainingSec.value = (mode.value === 'focus' ? selectedPreset.value.focus : selectedPreset.value.rest) * 60
  ElMessage.success(mode.value === 'focus' ? '进入专注时间' : '进入休息时间')
}

const startTimer = () => {
  if (running.value) return
  running.value = true
  timerId = window.setInterval(tick, 1000)
}

const pauseTimer = () => {
  running.value = false
  if (timerId) {
    clearInterval(timerId)
    timerId = null
  }
}

const resetTimer = () => {
  pauseTimer()
  mode.value = 'focus'
  remainingSec.value = selectedPreset.value.focus * 60
}

const toggleTimer = () => {
  if (running.value) {
    pauseTimer()
  } else {
    startTimer()
  }
}

const selectPreset = (preset) => {
  selectedPreset.value = preset
  resetTimer()
}

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

const parseDate = (value) => {
  if (!value) return null
  if (value instanceof Date) return startOfDay(value)
  if (typeof value !== 'string') return null
  const [year, month, day] = value.split('-').map(Number)
  if (year && month && day) return new Date(year, month - 1, day)
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return startOfDay(parsed)
}

const getEventRange = (event) => {
  const start = parseDate(event.date)
  const end = parseDate(event.endDate || event.date)
  return { start, end }
}

const isInRange = (event, rangeStart, rangeEnd) => {
  const { start, end } = getEventRange(event)
  if (!start || !end) return false
  return end >= rangeStart && start <= rangeEnd
}

const toDateLabel = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const upcomingRange = computed(() => {
  const today = startOfDay(new Date())
  const end = new Date(today)
  end.setDate(today.getDate() + 6)
  return { start: today, end }
})

const upcomingEvents = computed(() => {
  const { start, end } = upcomingRange.value
  return events.value
    .filter(event => isInRange(event, start, end))
    .sort((a, b) => {
      const aDate = parseDate(a.date)?.getTime() || 0
      const bDate = parseDate(b.date)?.getTime() || 0
      if (aDate !== bDate) return aDate - bDate
      return (a.startTime || 0) - (b.startTime || 0)
    })
    .slice(0, 6)
})

const todayStats = computed(() => {
  const today = startOfDay(new Date())
  const total = events.value.filter(event => isInRange(event, today, today)).length
  const allDay = events.value.filter(event => event.isAllDay && isInRange(event, today, today)).length
  return { total, allDay }
})

const formatTime = (value) => {
  if (value === null || value === undefined) return '--'
  const hours = Math.floor(value)
  const minutes = Math.round((value - hours) * 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

const todayLabel = computed(() => toDateLabel(startOfDay(new Date())))

const todayListItems = computed(() => {
  const today = startOfDay(new Date())
  return events.value
    .filter(event => isInRange(event, today, today))
    .sort((a, b) => {
      if (a.isAllDay && !b.isAllDay) return -1
      if (!a.isAllDay && b.isAllDay) return 1
      return (a.startTime || 0) - (b.startTime || 0)
    })
})

const todayListDoneMap = ref({})

const toggleTodayItem = (id) => {
  todayListDoneMap.value[id] = !todayListDoneMap.value[id]
}

const refreshTodayList = () => {
  loadEvents()
  ElMessage.success('今日清单已刷新')
}

const copyTodayList = async () => {
  const lines = [
    `今日清单（${todayLabel.value}）`,
    ...todayListItems.value.map(event => {
      const timeLabel = event.isAllDay ? '全天' : `${formatTime(event.startTime)}-${formatTime(event.endTime)}`
      return `- ${timeLabel} ${event.title || '未命名事件'}`
    })
  ]
  if (todayListItems.value.length === 0) lines.push('- 暂无事件')
  try {
    await navigator.clipboard.writeText(lines.join('\n'))
    ElMessage.success('已复制今日清单')
  } catch {
    ElMessage.error('复制失败，请手动复制')
  }
}

const QUADRANT_STORAGE_KEY = 'tool-quadrant-tasks'

const quadrantInputs = ref({
  q1: '',
  q2: '',
  q3: '',
  q4: ''
})

const quadrants = ref([
  {
    id: 'q1',
    title: '第一象限',
    tag: '重要且紧急',
    desc: '立刻做',
    color: '#ef4444',
    tasks: []
  },
  {
    id: 'q2',
    title: '第二象限',
    tag: '重要不紧急',
    desc: '重点做，防变紧急',
    color: '#f59e0b',
    tasks: []
  },
  {
    id: 'q3',
    title: '第三象限',
    tag: '紧急不重要',
    desc: '少做 / 授权',
    color: '#3b82f6',
    tasks: []
  },
  {
    id: 'q4',
    title: '第四象限',
    tag: '不紧急不重要',
    desc: '尽量不做',
    color: '#9ca3af',
    tasks: []
  }
])

const loadQuadrants = () => {
  try {
    const raw = localStorage.getItem(QUADRANT_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    quadrants.value = quadrants.value.map(quadrant => ({
      ...quadrant,
      tasks: Array.isArray(parsed?.[quadrant.id]) ? parsed[quadrant.id] : []
    }))
  } catch (error) {
    // ignore
  }
}

const saveQuadrants = () => {
  const payload = quadrants.value.reduce((acc, quadrant) => {
    acc[quadrant.id] = quadrant.tasks
    return acc
  }, {})
  localStorage.setItem(QUADRANT_STORAGE_KEY, JSON.stringify(payload))
}

const addQuadrantTask = (quadrantId) => {
  const text = (quadrantInputs.value[quadrantId] || '').trim()
  if (!text) return
  const target = quadrants.value.find(item => item.id === quadrantId)
  if (!target) return
  target.tasks.unshift({
    id: Date.now() + Math.random(),
    title: text,
    done: false
  })
  quadrantInputs.value[quadrantId] = ''
}

const removeQuadrantTask = (quadrantId, taskId) => {
  const target = quadrants.value.find(item => item.id === quadrantId)
  if (!target) return
  target.tasks = target.tasks.filter(task => task.id !== taskId)
}

watch(quadrants, saveQuadrants, { deep: true })

const quickNote = ref('')
const noteUpdatedAt = ref('')


const saveNote = () => {
  localStorage.setItem('tool-quick-note', quickNote.value)
  const now = new Date()
  noteUpdatedAt.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  localStorage.setItem('tool-quick-note-updated', noteUpdatedAt.value)
  ElMessage.success('便签已保存')
}

const loadNote = () => {
  quickNote.value = localStorage.getItem('tool-quick-note') || ''
  noteUpdatedAt.value = localStorage.getItem('tool-quick-note-updated') || ''
}

onMounted(() => {
  loadEvents()
  loadNote()
  loadQuadrants()
})

onUnmounted(() => {
  pauseTimer()
})
</script>

<template>
  <div class="tools-page">
    <header class="tools-header">
      <div>
        <h2 class="tools-title">工具箱</h2>
        <p class="tools-subtitle">为日程与专注提供即时支持。</p>
      </div>
      <div class="tools-actions">
        <el-button @click="refreshTodayList">刷新今日清单</el-button>
        <el-button type="primary" @click="copyTodayList">复制清单</el-button>
      </div>
    </header>

    <section class="quadrant-section">
      <div class="quadrant-header">
        <div>
          <h3 class="quadrant-title">时间管理・四象限任务清单</h3>
          <p class="quadrant-subtitle">用重要性与紧急性区分任务优先级，聚焦真正重要的事项。</p>
        </div>
        <div class="quadrant-hint">拖延提醒：先做重要且紧急，再安排重要不紧急。</div>
      </div>

      <div class="quadrant-grid">
        <el-card v-for="quadrant in quadrants" :key="quadrant.id" class="quadrant-card" shadow="never">
          <template #header>
            <div class="quadrant-card__header">
              <div>
                <div class="quadrant-card__title">{{ quadrant.title }}</div>
                <div class="quadrant-card__desc">{{ quadrant.tag }}（{{ quadrant.desc }}）</div>
              </div>
              <span class="quadrant-card__tag" :style="{ background: quadrant.color }">{{ quadrant.tag }}</span>
            </div>
          </template>

          <div class="quadrant-input">
            <el-input
              v-model="quadrantInputs[quadrant.id]"
              placeholder="输入任务并回车"
              @keyup.enter="addQuadrantTask(quadrant.id)"
            />
            <el-button type="primary" @click="addQuadrantTask(quadrant.id)">添加</el-button>
          </div>

          <div class="quadrant-list">
            <div v-if="quadrant.tasks.length === 0" class="empty">暂无任务</div>
            <div v-for="task in quadrant.tasks" :key="task.id" class="quadrant-item" :class="{ 'is-done': task.done }">
              <el-checkbox v-model="task.done">{{ task.title }}</el-checkbox>
              <el-button text type="danger" @click="removeQuadrantTask(quadrant.id, task.id)">移除</el-button>
            </div>
          </div>
        </el-card>
      </div>
    </section>
    <el-divider class="settings-divider" />
    <section class="tools-grid">
      <el-card class="tools-card tools-card--tomato" shadow="never">
        <template #header>
          <div class="card-title card-title--tomato">专注计时器(番茄时钟)</div>
        </template>
        <div class="timer timer--tomato">
          <div class="timer__status">
            <span>{{ currentLabel }}</span>
            <strong>{{ formatClock(remainingSec) }}</strong>
          </div>
          <el-progress :percentage="progress" :stroke-width="10" color="#ef4444" />

          <div class="timer__controls">
            <el-button @click="toggleTimer">{{ running ? '暂停' : '开始' }}</el-button>
            <el-button @click="resetTimer">重置</el-button>
          </div>
          <div class="timer__presets">
            <el-button
              v-for="preset in presets"
              :key="preset.label"
              size="small"
              :type="preset.label === selectedPreset.label ? 'primary' : 'default'"
              @click="selectPreset(preset)"
            >
              {{ preset.label }}
            </el-button>
          </div>
        </div>
      </el-card>

      <el-card class="tools-card tools-card--today" shadow="never">
        <template #header>
          <div class="today-card-header">
            <div class="card-title">今日清单</div>
            <span class="today-date-badge">{{ todayLabel }}</span>
          </div>
        </template>

        <div class="today-stats">
          <div class="today-stat-item">
            <span class="today-stat-num">{{ todayListItems.length }}</span>
            <span class="today-stat-label">事项</span>
          </div>
          <div class="today-stat-item">
            <span class="today-stat-num today-stat-num--done">{{ Object.values(todayListDoneMap).filter(Boolean).length }}</span>
            <span class="today-stat-label">已完成</span>
          </div>
          <div class="today-stat-item">
            <span class="today-stat-num today-stat-num--left">{{ todayListItems.length - Object.values(todayListDoneMap).filter(Boolean).length }}</span>
            <span class="today-stat-label">待处理</span>
          </div>
        </div>

        <div class="today-list">
          <div v-if="todayListItems.length === 0" class="today-empty">
            <div class="today-empty__icon">✓</div>
            <div class="today-empty__text">今日暂无安排，放松一下吧！</div>
          </div>
          <div
            v-for="event in todayListItems"
            :key="event.id"
            class="today-item"
            :class="{ 'is-done': todayListDoneMap[event.id] }"
            @click="toggleTodayItem(event.id)"
          >
            <div class="today-item__check" :style="{ borderColor: getEventType(event.type).color, background: todayListDoneMap[event.id] ? getEventType(event.type).color : 'transparent' }">
              <svg v-if="todayListDoneMap[event.id]" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 6l3 3 5-5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="today-item__body">
              <div class="today-item__title">{{ event.title || '未命名事件' }}</div>
              <div class="today-item__meta">
                <span
                  class="today-item__type-dot"
                  :style="{ background: getEventType(event.type).color }"
                ></span>
                <span class="today-item__type-label">{{ getEventType(event.type).label }}</span>
                <span class="today-item__time">{{ event.isAllDay ? '全天' : `${formatTime(event.startTime)} - ${formatTime(event.endTime)}` }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="today-footer">
          <el-button size="small" @click="refreshTodayList">刷新</el-button>
          <el-button size="small" type="primary" @click="copyTodayList">复制清单</el-button>
        </div>
      </el-card>

      <el-card class="tools-card" shadow="never">
        <template #header>
          <div class="card-title">便签速记</div>
        </template>
        <el-input
          v-model="quickNote"
          type="textarea"
          :rows="8"
          class="tools-textarea"
          placeholder="记录灵感或待办要点"
        />
        <div class="note-footer">
          <span>上次保存：{{ noteUpdatedAt || '未保存' }}</span>
          <el-button size="small" type="primary" @click="saveNote">保存便签</el-button>
        </div>
      </el-card>

      <el-card class="tools-card" shadow="never">
        <template #header>
          <div class="card-title">近7天事件</div>
        </template>
        <div class="overview">
          <div class="overview__item">
            <span>今日事件</span>
            <strong>{{ todayStats.total }}</strong>
          </div>
          <div class="overview__item">
            <span>全天事件</span>
            <strong>{{ todayStats.allDay }}</strong>
          </div>
        </div>
        <div class="upcoming-list">
          <div v-if="upcomingEvents.length === 0" class="empty">暂无即将发生的事件</div>
          <div
            v-for="event in upcomingEvents"
            :key="event.id"
            class="upcoming-item"
            :style="{
              borderLeftColor: getEventType(event.type).color,
              background: getEventType(event.type).bgColor
            }"
          >
            <div class="upcoming-item__title">{{ event.title || '未命名事件' }}</div>
            <div class="upcoming-item__meta">
              <span class="upcoming-item__date">{{ event.date }}</span>
              <span>{{ event.isAllDay ? '全天' : `${formatTime(event.startTime)}-${formatTime(event.endTime)}` }}</span>
            </div>
          </div>

        </div>
      </el-card>
    </section>
  </div>
</template>

<style scoped>
.tools-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
  scrollbar-gutter: stable;
}

.tools-page::-webkit-scrollbar {
  width: 8px;
}

.tools-page::-webkit-scrollbar-track {
  background: transparent;
}

.tools-page::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 4px;
}

.tools-page:hover::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
}

.tools-page::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

.tools-page {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}

.tools-page:hover {
  scrollbar-color: rgba(0, 0, 0, 0.35) transparent;
}


.tools-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.tools-title {
  margin: 0 0 6px;
  font-size: 22px;
  font-weight: 600;
  color: #1f2937;
}

.tools-subtitle {
  margin: 0;
  color: #6b7280;
  font-size: 14px;
}

.tools-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.quadrant-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.quadrant-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border-radius: 16px;
  background: linear-gradient(120deg, #eef2ff 0%, #f8fafc 100%);
  border: 1px solid #e5e7eb;
}

.quadrant-title {
  margin: 0 0 6px;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.quadrant-subtitle {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
}

.quadrant-hint {
  font-size: 12px;
  color: #4f46e5;
  background: #eef2ff;
  padding: 8px 12px;
  border-radius: 999px;
  white-space: nowrap;
}

.quadrant-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.quadrant-card {
  border-radius: 14px;
  border: 1px solid #eef2ff;
}

.quadrant-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.quadrant-card__title {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.quadrant-card__desc {
  font-size: 12px;
  color: #6b7280;
}

.quadrant-card__tag {
  font-size: 12px;
  color: #fff;
  padding: 4px 10px;
  border-radius: 999px;
}

.quadrant-input {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.quadrant-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.quadrant-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  background: #f9fafb;
}

.quadrant-item.is-done {
  opacity: 0.6;
  text-decoration: line-through;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}


.tools-card {
  border-radius: 14px;
  border: 1px solid #eef2ff;
}

.tools-card--tomato {
  border-color: rgba(239, 68, 68, 0.25);
  background: linear-gradient(135deg, rgba(254, 226, 226, 0.6) 0%, rgba(255, 247, 237, 0.9) 100%);
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.card-title--tomato {
  color: #b91c1c;
}

.settings-divider {
  margin: 0px 0;
}

.timer {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.timer--tomato .timer__status {
  color: #b91c1c;
}

.timer--tomato .timer__status strong {
  color: #ef4444;
}

.timer--tomato .timer__controls .el-button--default {
  border-color: rgba(239, 68, 68, 0.4);
  color: #b91c1c;
}

.timer--tomato .timer__controls .el-button--default:hover {
  border-color: #ef4444;
  color: #ef4444;
}


.timer__status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  color: #4b5563;
}

.timer__status strong {
  font-size: 28px;
  color: #111827;
}

.timer__controls {
  display: flex;
  gap: 10px;
}

.timer__presets {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.tools-textarea :deep(textarea) {
  font-family: inherit;
}

.note-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  font-size: 12px;
  color: #6b7280;
}

.overview {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.overview__item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border-radius: 10px;
  background: #f9fafb;
  color: #374151;
}

.overview__item strong {
  font-size: 20px;
  color: #111827;
}

.upcoming-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.upcoming-item {
  padding: 10px 12px;
  border-radius: 10px;
  border-left: 4px solid transparent;
  color: #f8fafc;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.08);
}

.upcoming-item__title {
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 6px;
}

.upcoming-item__meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
}

.upcoming-item__date {
  font-weight: 600;
}


.empty {
  font-size: 13px;
  color: #9ca3af;
}

/* ===== 今日清单 ===== */
.tools-card--today {
  border-color: rgba(99, 102, 241, 0.2);
  background: linear-gradient(135deg, rgba(238, 242, 255, 0.7) 0%, rgba(248, 250, 252, 0.95) 100%);
}

.today-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.today-date-badge {
  font-size: 12px;
  color: #6366f1;
  background: rgba(99, 102, 241, 0.1);
  padding: 3px 10px;
  border-radius: 999px;
  font-weight: 500;
}

.today-stats {
  display: flex;
  gap: 0;
  margin-bottom: 14px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(99, 102, 241, 0.12);
}

.today-stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 8px;
  background: rgba(255, 255, 255, 0.7);
  gap: 2px;
  position: relative;
}

.today-stat-item + .today-stat-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 20%;
  height: 60%;
  width: 1px;
  background: rgba(99, 102, 241, 0.12);
}

.today-stat-num {
  font-size: 22px;
  font-weight: 700;
  color: #6366f1;
  line-height: 1;
}

.today-stat-num--done {
  color: #10b981;
}

.today-stat-num--left {
  color: #f59e0b;
}

.today-stat-label {
  font-size: 11px;
  color: #9ca3af;
}

.today-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 220px;
  overflow-y: auto;
  padding-right: 2px;
  margin-bottom: 12px;
}

.today-list::-webkit-scrollbar {
  width: 4px;
}

.today-list::-webkit-scrollbar-track {
  background: transparent;
}

.today-list::-webkit-scrollbar-thumb {
  background: rgba(99, 102, 241, 0.2);
  border-radius: 2px;
}

.today-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 28px 0;
  gap: 8px;
}

.today-empty__icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #818cf8);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #fff;
}

.today-empty__text {
  font-size: 13px;
  color: #9ca3af;
}

.today-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(99, 102, 241, 0.1);
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
  user-select: none;
}

.today-item:hover {
  background: rgba(255, 255, 255, 1);
}

.today-item.is-done {
  opacity: 0.55;
}

.today-item.is-done .today-item__title {
  text-decoration: line-through;
  color: #9ca3af;
}

.today-item__check {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid #6366f1;
  margin-top: 1px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}

.today-item__check svg {
  width: 12px;
  height: 12px;
}

.today-item__body {
  flex: 1;
  min-width: 0;
}

.today-item__title {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.15s;
}

.today-item__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
}

.today-item__type-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.today-item__type-label {
  color: #9ca3af;
}

.today-item__time {
  margin-left: auto;
  font-weight: 500;
  color: #6b7280;
}

.today-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px solid rgba(99, 102, 241, 0.1);
}

@media (max-width: 1024px) {
  .tools-grid,
  .quadrant-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .tools-header,
  .quadrant-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .quadrant-hint {
    white-space: normal;
  }
}

</style>

