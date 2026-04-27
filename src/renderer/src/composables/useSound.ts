import { useSettingsStore } from '../stores/settings'

// 缓存 Audio 实例，避免每次播放都重新创建
const audioCache = new Map<string, HTMLAudioElement>()

function getAudio(name: string): HTMLAudioElement {
  if (!audioCache.has(name)) {
    // resources/ 是 ASAR-unpacked，开发模式从项目根目录读取，生产模式从 process.resourcesPath 读取
    // 声音默认关闭，文件缺失不影响功能
    const audio = new Audio()
    audioCache.set(name, audio)
  }
  return audioCache.get(name)!
}

/**
 * 播放声音提示
 * @param name 事件类型: 'complete' | 'permission' | 'error'
 */
export function playSound(name: 'complete' | 'permission' | 'error'): void {
  const store = useSettingsStore()

  // 全局声音开关
  if (!store.settings.soundEnabled) return

  // 按事件类型检查单独开关
  const toggleMap: Record<string, boolean> = {
    complete: store.settings.soundComplete,
    permission: store.settings.soundPermission,
    error: store.settings.soundError
  }

  if (!toggleMap[name]) return

  const audio = getAudio(name)

  // 尝试设置音频路径（开发模式和生产模式路径不同）
  if (!audio.src) {
    try {
      // @ts-ignore — electron renderer with sandbox:false can access process
      const resPath = typeof process !== 'undefined' && process.resourcesPath
        ? `${process.resourcesPath}/resources/sounds/${name}.wav`
        : `resources/sounds/${name}.wav`
      audio.src = resPath
    } catch {
      // 路径解析失败，静默忽略（声音默认关闭）
      return
    }
  }

  audio.volume = store.settings.soundVolume
  audio.currentTime = 0
  audio.play().catch(() => {
    // 忽略自动播放策略限制或文件不存在的错误
  })
}
