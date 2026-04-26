/**
 * 通知系统渲染端集成
 * - 监听通知跳转标签页事件
 * - 监听前台时声音播放事件（D-03: 窗口在前台时不弹通知但仍播放声音）
 */
import { playSound } from './useSound'

/**
 * 注册通知相关的渲染进程事件监听
 * 必须在 App.vue onMounted 中调用
 */
export function useNotification(): void {
  // 通知点击跳转到对应标签页
  window.api.onNotificationFocusTab?.((channelId: string) => {
    // 通过自定义事件通知 ChatPanel 切换标签页
    window.dispatchEvent(new CustomEvent('notification:focus-tab', { detail: channelId }))
  })

  // 前台通知被抑制时仍播放声音
  window.api.onNotificationPlaySound?.((type: string) => {
    playSoundForType(type)
  })
}

function playSoundForType(type: string): void {
  if (type === 'complete') playSound('complete')
  else if (type === 'permission') playSound('permission')
  else if (type === 'error') playSound('error')
}
