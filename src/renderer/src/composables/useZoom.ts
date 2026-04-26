import { useSettingsStore } from '../stores/settings'

/**
 * 应用缩放因子到整个应用
 * D-10: Shell UI 使用 webFrame.setZoomFactor()（通过 preload），webview iframe 使用 CSS zoom
 */
export function applyZoom(factor: number): void {
  const clamped = Math.max(0.8, Math.min(2.0, factor))
  // 通过 preload 暴露的 API 调用 webFrame（渲染进程不能直接 import electron）
  window.api.setZoomFactor(clamped)

  // 同步 CSS zoom 到所有 webview iframe
  document.querySelectorAll('.webview-iframe').forEach((iframe) => {
    ;(iframe as HTMLElement).style.zoom = String(clamped)
  })
}

/**
 * 从 settings store 加载并应用已保存的缩放值
 * 在 App.vue onMounted 时调用
 */
export function loadAndApplyZoom(): void {
  const store = useSettingsStore()
  applyZoom(store.settings.zoomFactor)
}

/**
 * 重置缩放到 100%
 * Ctrl+0 快捷键触发
 */
export function resetZoom(): void {
  const store = useSettingsStore()
  store.update({ zoomFactor: 1.0 })
  applyZoom(1.0)
}
