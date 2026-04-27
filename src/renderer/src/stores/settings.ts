import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

export type CloseBehavior = 'minimize' | 'quit' | 'ask'
export type ThemeMode = 'dark' | 'light' | 'system'

export interface SettingsState {
  soundEnabled: boolean
  soundVolume: number
  soundComplete: boolean
  soundPermission: boolean
  soundError: boolean
  zoomFactor: number
  notifyEnabled: boolean
  notifyComplete: boolean
  notifyPermission: boolean
  notifyPlan: boolean
  notifyReply: boolean
  notifyError: boolean
  skippedVersion: string | null
  closeBehavior: CloseBehavior
  theme: ThemeMode
}

const SETTINGS_KEY = 'aitools-settings'

const DEFAULTS: SettingsState = {
  soundEnabled: false,
  soundVolume: 0.5,
  soundComplete: true,
  soundPermission: true,
  soundError: true,
  zoomFactor: 1.0,
  notifyEnabled: true,
  notifyComplete: true,
  notifyPermission: true,
  notifyPlan: true,
  notifyReply: true,
  notifyError: true,
  skippedVersion: null,
  closeBehavior: 'ask',
  theme: 'dark'
}

export const useSettingsStore = defineStore('settings', () => {
  const raw = localStorage.getItem(SETTINGS_KEY)
  const initial: SettingsState = raw ? { ...DEFAULTS, ...safeParse(raw) } : { ...DEFAULTS }

  // 响应式状态 — 聚合为单一对象，用于 watch deep
  const settings = ref<SettingsState>({
    soundEnabled: initial.soundEnabled,
    soundVolume: initial.soundVolume,
    soundComplete: initial.soundComplete,
    soundPermission: initial.soundPermission,
    soundError: initial.soundError,
    zoomFactor: initial.zoomFactor,
    notifyEnabled: initial.notifyEnabled,
    notifyComplete: initial.notifyComplete,
    notifyPermission: initial.notifyPermission,
    notifyPlan: initial.notifyPlan,
    notifyReply: initial.notifyReply,
    notifyError: initial.notifyError,
    skippedVersion: initial.skippedVersion,
    closeBehavior: initial.closeBehavior,
    theme: initial.theme
  })

  watch(
    settings,
    (newVal) => {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newVal))
    },
    { deep: true }
  )

  const isSoundEnabled = computed(() => settings.value.soundEnabled)
  const isNotifyEnabled = computed(() => settings.value.notifyEnabled)
  const currentZoomFactor = computed(() => settings.value.zoomFactor)
  const currentCloseBehavior = computed(() => settings.value.closeBehavior)
  const currentTheme = computed(() => settings.value.theme)

  function update(patch: Partial<SettingsState>): void {
    for (const [key, value] of Object.entries(patch)) {
      if (key in settings.value) {
        ;(settings.value as Record<string, unknown>)[key] = value
      }
    }
  }

  function resetZoom(): void {
    settings.value.zoomFactor = DEFAULTS.zoomFactor
  }

  function setSkippedVersion(version: string | null): void {
    settings.value.skippedVersion = version
  }

  return {
    settings,
    isSoundEnabled,
    isNotifyEnabled,
    currentZoomFactor,
    currentCloseBehavior,
    currentTheme,
    update,
    resetZoom,
    setSkippedVersion
  }
})

function safeParse(raw: string): Partial<SettingsState> {
  try {
    return JSON.parse(raw) as Partial<SettingsState>
  } catch {
    return {}
  }
}
