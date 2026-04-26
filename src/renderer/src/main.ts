import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './assets/main.css'
import { useSettingsStore } from './stores/settings'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')

// 主题系统初始化 (05-01)
function applyTheme(mode: string): void {
  let resolved: 'dark' | 'light'
  if (mode === 'system') {
    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } else {
    resolved = mode as 'dark' | 'light'
  }
  document.documentElement.setAttribute('data-theme', resolved)
  // 通知主进程当前 resolved 主题（用于 webview/通知窗口同步）
  window.api?.updateTheme(mode as 'dark' | 'light' | 'system', resolved)
}

// 初始化主题 — 读取用户设置并应用
const settingsStore = useSettingsStore()
applyTheme(settingsStore.settings.theme)

// 监听设置中 theme 变化，自动应用
watch(() => settingsStore.settings.theme, (newTheme) => {
  applyTheme(newTheme)
})

// 监听主进程发来的系统主题变化通知（仅 'system' 模式下响应）
window.api?.onThemeSystemChanged((resolvedTheme) => {
  if (settingsStore.settings.theme === 'system') {
    document.documentElement.setAttribute('data-theme', resolvedTheme)
    // 通知主进程更新 resolved 值
    window.api?.updateTheme('system', resolvedTheme)
  }
})
