<script setup lang="ts">
import { useSettingsStore, type CloseBehavior } from '../stores/settings'

const settingsStore = useSettingsStore()

const emit = defineEmits<{
  (e: 'close'): void
}>()

/** 关闭行为选项 */
const closeOptions: { value: CloseBehavior; label: string }[] = [
  { value: 'minimize', label: '最小化到托盘' },
  { value: 'quit', label: '退出应用' },
  { value: 'ask', label: '每次询问' }
]
</script>

<template>
  <Transition name="drawer">
    <div v-if="true" class="settings-backdrop" @click="emit('close')">
      <div class="settings-drawer" @click.stop>
        <!-- 头部 -->
        <div class="drawer-header">
          <span class="drawer-title">设置</span>
          <button class="drawer-close" @click="emit('close')">&times;</button>
        </div>

        <!-- 滚动内容区 -->
        <div class="drawer-body">

          <!-- 声音提示 (D-08) -->
          <section class="settings-section">
            <h3 class="section-title">声音提示</h3>
            <label class="setting-row">
              <span class="setting-label">声音提示</span>
              <input
                type="checkbox"
                class="toggle-switch"
                :checked="settingsStore.settings.soundEnabled"
                @change="settingsStore.update({ soundEnabled: !settingsStore.settings.soundEnabled })"
              />
            </label>
            <template v-if="settingsStore.settings.soundEnabled">
              <label class="setting-row">
                <span class="setting-label">音量 {{ Math.round(settingsStore.settings.soundVolume * 100) }}%</span>
                <input
                  type="range"
                  class="slider"
                  min="0"
                  max="1"
                  step="0.05"
                  :value="settingsStore.settings.soundVolume"
                  @input="settingsStore.update({ soundVolume: Number(($event.target as HTMLInputElement).value) })"
                />
              </label>
              <label class="setting-row">
                <span class="setting-label">回复完成</span>
                <input
                  type="checkbox"
                  class="toggle-switch"
                  :checked="settingsStore.settings.soundComplete"
                  @change="settingsStore.update({ soundComplete: !settingsStore.settings.soundComplete })"
                />
              </label>
              <label class="setting-row">
                <span class="setting-label">权限请求</span>
                <input
                  type="checkbox"
                  class="toggle-switch"
                  :checked="settingsStore.settings.soundPermission"
                  @change="settingsStore.update({ soundPermission: !settingsStore.settings.soundPermission })"
                />
              </label>
              <label class="setting-row">
                <span class="setting-label">错误</span>
                <input
                  type="checkbox"
                  class="toggle-switch"
                  :checked="settingsStore.settings.soundError"
                  @change="settingsStore.update({ soundError: !settingsStore.settings.soundError })"
                />
              </label>
            </template>
          </section>

          <!-- 缩放 (D-09) -->
          <section class="settings-section">
            <h3 class="section-title">缩放</h3>
            <label class="setting-row">
              <span class="setting-label">{{ Math.round(settingsStore.settings.zoomFactor * 100) }}%</span>
              <input
                type="range"
                class="slider"
                min="0.8"
                max="2.0"
                step="0.1"
                :value="settingsStore.settings.zoomFactor"
                @input="settingsStore.update({ zoomFactor: Number(($event.target as HTMLInputElement).value) })"
              />
            </label>
            <button
              class="reset-btn"
              @click="settingsStore.resetZoom()"
            >
              重置 (Ctrl+0)
            </button>
          </section>

          <!-- 通知 -->
          <section class="settings-section">
            <h3 class="section-title">桌面通知</h3>
            <label class="setting-row">
              <span class="setting-label">桌面通知</span>
              <input
                type="checkbox"
                class="toggle-switch"
                :checked="settingsStore.settings.notifyEnabled"
                @change="settingsStore.update({ notifyEnabled: !settingsStore.settings.notifyEnabled })"
              />
            </label>
            <template v-if="settingsStore.settings.notifyEnabled">
              <label class="setting-row">
                <span class="setting-label">回复完成</span>
                <input
                  type="checkbox"
                  class="toggle-switch"
                  :checked="settingsStore.settings.notifyComplete"
                  @change="settingsStore.update({ notifyComplete: !settingsStore.settings.notifyComplete })"
                />
              </label>
              <label class="setting-row">
                <span class="setting-label">权限请求</span>
                <input
                  type="checkbox"
                  class="toggle-switch"
                  :checked="settingsStore.settings.notifyPermission"
                  @change="settingsStore.update({ notifyPermission: !settingsStore.settings.notifyPermission })"
                />
              </label>
              <label class="setting-row">
                <span class="setting-label">方案选择</span>
                <input
                  type="checkbox"
                  class="toggle-switch"
                  :checked="settingsStore.settings.notifyPlan"
                  @change="settingsStore.update({ notifyPlan: !settingsStore.settings.notifyPlan })"
                />
              </label>
              <label class="setting-row">
                <span class="setting-label">文本回复</span>
                <input
                  type="checkbox"
                  class="toggle-switch"
                  :checked="settingsStore.settings.notifyReply"
                  @change="settingsStore.update({ notifyReply: !settingsStore.settings.notifyReply })"
                />
              </label>
              <label class="setting-row">
                <span class="setting-label">错误</span>
                <input
                  type="checkbox"
                  class="toggle-switch"
                  :checked="settingsStore.settings.notifyError"
                  @change="settingsStore.update({ notifyError: !settingsStore.settings.notifyError })"
                />
              </label>
            </template>
          </section>

          <!-- 自动更新 (D-14) -->
          <section class="settings-section">
            <h3 class="section-title">更新</h3>
            <div class="setting-info">
              <span class="info-label">自动检查更新</span>
              <span class="info-desc">启动时检查新版本，更新需手动确认</span>
            </div>
          </section>

          <!-- 托盘行为 (D-11) -->
          <section class="settings-section">
            <h3 class="section-title">关闭窗口时</h3>
            <div
              v-for="opt in closeOptions"
              :key="opt.value"
              class="setting-row radio-row"
              @click="settingsStore.update({ closeBehavior: opt.value })"
            >
              <input
                type="radio"
                name="close-behavior"
                :value="opt.value"
                :checked="settingsStore.settings.closeBehavior === opt.value"
                class="radio-input"
                @click.stop="settingsStore.update({ closeBehavior: opt.value })"
              />
              <span class="setting-label">{{ opt.label }}</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* 遮罩层 — 半透明黑色背景 */
.settings-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 100;
  display: flex;
  justify-content: flex-end;
}

/* 抽屉面板 — 从右侧滑出 */
.settings-drawer {
  width: 360px;
  height: 100%;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: -4px 0 16px rgba(0, 0, 0, 0.3);
}

/* 头部 */
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.drawer-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.drawer-close {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 20px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.drawer-close:hover {
  color: var(--error);
}

/* 滚动内容区 */
.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

/* 设置分组 */
.settings-section {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}

.settings-section:last-child {
  border-bottom: none;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
}

/* 单行设置项 */
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  cursor: pointer;
}

.setting-label {
  font-size: 13px;
  color: var(--text-primary);
}

/* 切换开关样式 */
.toggle-switch {
  -webkit-appearance: none;
  appearance: none;
  width: 36px;
  height: 20px;
  background: var(--bg-tertiary);
  border-radius: 10px;
  position: relative;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
}

.toggle-switch:checked {
  background: var(--accent);
}

.toggle-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--text-primary);
  transition: transform 0.2s;
}

.toggle-switch:checked::after {
  transform: translateX(16px);
}

/* 滑块样式 */
.slider {
  -webkit-appearance: none;
  appearance: none;
  width: 120px;
  height: 4px;
  background: var(--bg-tertiary);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
  flex-shrink: 0;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  transition: transform 0.1s;
}

.slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.slider::-webkit-slider-thumb:active {
  transform: scale(1.1);
}

/* 重置按钮 */
.reset-btn {
  margin-top: 8px;
  padding: 4px 12px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.reset-btn:hover {
  background: var(--border);
  color: var(--text-primary);
}

/* 信息展示行 */
.setting-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 13px;
  color: var(--text-primary);
}

.info-desc {
  font-size: 12px;
  color: var(--text-muted);
}

/* 单选按钮行 */
.radio-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
}

.radio-input {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border: 2px solid var(--border);
  border-radius: 50%;
  cursor: pointer;
  position: relative;
  flex-shrink: 0;
  transition: border-color 0.15s;
}

.radio-input:checked {
  border-color: var(--accent);
}

.radio-input:checked::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
}

.radio-row .setting-label {
  cursor: pointer;
}

/* 抽屉过渡动画 */
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.25s ease;
}

.drawer-enter-active .settings-drawer,
.drawer-leave-active .settings-drawer {
  transition: transform 0.25s ease;
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-from .settings-drawer,
.drawer-leave-to .settings-drawer {
  transform: translateX(100%);
}
</style>
