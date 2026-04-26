import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

/**
 * 关闭窗口行为类型 (D-11)
 * - minimize: 最小化到托盘
 * - quit: 退出应用
 * - ask: 每次询问
 */
export type CloseBehavior = 'minimize' | 'quit' | 'ask'

/**
 * 设置状态接口 — 所有用户偏好配置项
 */
export interface SettingsState {
  // 声音提示 (D-08)
  soundEnabled: boolean // 声音总开关，默认关闭
  soundVolume: number // 音量 0~1，默认 0.5
  soundComplete: boolean // 回复完成提示音
  soundPermission: boolean // 权限请求提示音
  soundError: boolean // 错误提示音

  // 缩放 (D-09)
  zoomFactor: number // 缩放比例 0.8~2.0，默认 1.0

  // 桌面通知
  notifyEnabled: boolean // 通知总开关，默认开启
  notifyComplete: boolean // 回复完成通知
  notifyPermission: boolean // 权限请求通知
  notifyPlan: boolean // 方案选择通知
  notifyReply: boolean // 文本回复通知
  notifyError: boolean // 错误通知

  // 自动更新 (D-14)
  skippedVersion: string | null // 跳过的版本号，默认 null

  // 托盘行为 (D-11)
  closeBehavior: CloseBehavior // 关闭窗口行为，默认 'ask'
}

/** localStorage 存储键名 */
const SETTINGS_KEY = 'aitools-settings'

/** 默认设置值 */
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

  closeBehavior: 'ask'
}

/**
 * 设置 Store — 管理 Pinia 状态，自动持久化到 localStorage
 *
 * 使用 composition API 模式，与 workspace.ts 保持一致。
 * 深度监听 settings 对象变化，自动写入 localStorage。
 */
export const useSettingsStore = defineStore('settings', () => {
  // 从 localStorage 加载已有设置，未找到则使用默认值
  const raw = localStorage.getItem(SETTINGS_KEY)
  const initial: SettingsState = raw ? { ...DEFAULTS, ...safeParse(raw) } : { ...DEFAULTS }

  // 响应式状态引用
  const soundEnabled = ref(initial.soundEnabled)
  const soundVolume = ref(initial.soundVolume)
  const soundComplete = ref(initial.soundComplete)
  const soundPermission = ref(initial.soundPermission)
  const soundError = ref(initial.soundError)

  const zoomFactor = ref(initial.zoomFactor)

  const notifyEnabled = ref(initial.notifyEnabled)
  const notifyComplete = ref(initial.notifyComplete)
  const notifyPermission = ref(initial.notifyPermission)
  const notifyPlan = ref(initial.notifyPlan)
  const notifyReply = ref(initial.notifyReply)
  const notifyError = ref(initial.notifyError)

  const skippedVersion = ref<string | null>(initial.skippedVersion)

  const closeBehavior = ref<CloseBehavior>(initial.closeBehavior)

  // 将所有 ref 聚合为一个响应式对象，用于 watch deep
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
    closeBehavior: initial.closeBehavior
  })

  // 深度监听：settings 变更自动写入 localStorage
  watch(
    settings,
    (newVal) => {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newVal))
    },
    { deep: true }
  )

  // ---- 便捷计算属性 ----

  /** 声音是否启用 */
  const isSoundEnabled = computed(() => settings.value.soundEnabled)

  /** 通知是否启用 */
  const isNotifyEnabled = computed(() => settings.value.notifyEnabled)

  /** 当前缩放比例 */
  const currentZoomFactor = computed(() => settings.value.zoomFactor)

  /** 当前关闭行为 */
  const currentCloseBehavior = computed(() => settings.value.closeBehavior)

  // ---- 操作方法 ----

  /**
   * 批量更新设置项
   * @param patch - 要更新的部分设置字段
   */
  function update(patch: Partial<SettingsState>): void {
    for (const [key, value] of Object.entries(patch)) {
      if (key in settings.value) {
        // 类型安全赋值
        ;(settings.value as Record<string, unknown>)[key] = value
      }
    }
  }

  /** 重置缩放到默认值 */
  function resetZoom(): void {
    settings.value.zoomFactor = DEFAULTS.zoomFactor
  }

  /**
   * 设置跳过的版本号
   * @param version - 要跳过的版本，null 表示清除跳过
   */
  function setSkippedVersion(version: string | null): void {
    settings.value.skippedVersion = version
  }

  return {
    // 响应式状态
    settings,
    // 便捷计算属性
    isSoundEnabled,
    isNotifyEnabled,
    currentZoomFactor,
    currentCloseBehavior,
    // 操作方法
    update,
    resetZoom,
    setSkippedVersion
  }
})

/**
 * 安全解析 JSON 字符串，解析失败返回空对象
 * @param raw - JSON 字符串
 */
function safeParse(raw: string): Partial<SettingsState> {
  try {
    return JSON.parse(raw) as Partial<SettingsState>
  } catch {
    return {}
  }
}
