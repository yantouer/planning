import { ref, watch } from 'vue'

const STORAGE_KEY = 'app-settings'

const DEFAULT_SETTINGS = {
  profile: {
    name: '',
    title: '',
    email: ''
  },
  preferences: {
    theme: 'system',
    density: 'default',
    language: 'zh-CN',
    weekStart: 'monday',
    holidayApiUrl: 'https://timor.tech/api/holiday/year/{year}?country=CN&type=YEAR',
    dayStartTime: '08:00',
    dayEndTime: '22:00'
  },
  notifications: {
    desktop: true,
    email: true,
    weeklyReport: true,
    dailyDigest: false
  },
  privacy: {
    showInStats: true,
    shareFocusTime: false
  },
  storage: {
    autoBackup: true,
    backupFrequency: 'weekly'
  },
  ai: {
    models: [
      {
        id: 'default',
        name: '默认模型',
        modelUrl: '',
        apiKey: '',
        modelName: 'gpt-3.5-turbo',
        maxTokens: 2000,
        temperature: 0.7,
        enabled: true
      }
    ],
    selectedModelId: 'default'
  }
}

const loadFromStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return structuredClone(DEFAULT_SETTINGS)
    const saved = JSON.parse(raw)
    // 深合并，保证新增默认字段不会丢失
    return {
      profile: { ...DEFAULT_SETTINGS.profile, ...saved.profile },
      preferences: { ...DEFAULT_SETTINGS.preferences, ...saved.preferences },
      notifications: { ...DEFAULT_SETTINGS.notifications, ...saved.notifications },
      privacy: { ...DEFAULT_SETTINGS.privacy, ...saved.privacy },
      storage: { ...DEFAULT_SETTINGS.storage, ...saved.storage },
      ai: { ...DEFAULT_SETTINGS.ai, ...saved.ai }
    }
  } catch {
    return structuredClone(DEFAULT_SETTINGS)
  }
}

const initial = loadFromStorage()

export const profile = ref(initial.profile)
export const preferences = ref(initial.preferences)
export const notifications = ref(initial.notifications)
export const privacy = ref(initial.privacy)
export const storage = ref(initial.storage)
export const ai = ref(initial.ai)

const saveToStorage = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      profile: profile.value,
      preferences: preferences.value,
      notifications: notifications.value,
      privacy: privacy.value,
      storage: storage.value,
      ai: ai.value
    }))
  } catch {
    // ignore
  }
}

export const resetSettings = () => {
  const defaults = structuredClone(DEFAULT_SETTINGS)
  profile.value = defaults.profile
  preferences.value = defaults.preferences
  notifications.value = defaults.notifications
  privacy.value = defaults.privacy
  storage.value = defaults.storage
  ai.value = defaults.ai
}

watch([profile, preferences, notifications, privacy, storage, ai], saveToStorage, { deep: true })

// AI模型管理函数
export const addModel = (modelData) => {
  const newModel = {
    id: Date.now().toString(),
    name: modelData.name || '新模型',
    modelUrl: modelData.modelUrl || '',
    apiKey: modelData.apiKey || '',
    modelName: modelData.modelName || 'gpt-3.5-turbo',
    maxTokens: modelData.maxTokens || 2000,
    temperature: modelData.temperature || 0.7,
    enabled: true
  }
  ai.value.models.push(newModel)
  return newModel.id
}

export const removeModel = (modelId) => {
  const index = ai.value.models.findIndex(model => model.id === modelId)
  if (index > -1) {
    ai.value.models.splice(index, 1)
    // 如果删除的是当前选中的模型，则选择第一个可用的模型
    if (ai.value.selectedModelId === modelId) {
      const firstModel = ai.value.models.find(model => model.enabled)
      ai.value.selectedModelId = firstModel ? firstModel.id : ''
    }
  }
}

export const updateModel = (modelId, updates) => {
  const model = ai.value.models.find(model => model.id === modelId)
  if (model) {
    Object.assign(model, updates)
  }
}

export const getSelectedModel = () => {
  return ai.value.models.find(model => model.id === ai.value.selectedModelId)
}

export const getEnabledModels = () => {
  return ai.value.models.filter(model => model.enabled)
}
