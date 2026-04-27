<!--
  ContextMenu - 通用右键菜单组件

  使用 Catppuccin Mocha/Latte 主题 CSS 变量，
  支持菜单项图标、禁用状态、窗口边界检测。
  通过 Teleport 渲染到 body 层级，避免 z-index 层叠问题。
-->
<script setup lang="ts">
/** 菜单项定义 */
export interface MenuItem {
  /** 显示文本 */
  label: string
  /** 动作标识 */
  action: string
  /** 可选图标（Unicode 字符） */
  icon?: string
  /** 是否禁用 */
  disabled?: boolean
}

const props = defineProps<{
  /** 是否可见 */
  visible: boolean
  /** 菜单出现位置 X 坐标 */
  x: number
  /** 菜单出现位置 Y 坐标 */
  y: number
  /** 菜单项列表 */
  items: MenuItem[]
}>()

const emit = defineEmits<{
  /** 选中菜单项时触发 */
  (e: 'select', action: string): void
  /** 关闭菜单时触发（点击外部区域） */
  (e: 'close'): void
}>()

/** 点击遮罩层关闭菜单 */
function handleClickOutside(): void {
  emit('close')
}

/** 点击菜单项，触发选中事件并关闭 */
function handleSelect(action: string): void {
  emit('select', action)
  emit('close')
}

/** 计算菜单位置，检查窗口边界防止溢出 */
function getMenuStyle(): Record<string, string> {
  let left = props.x
  let top = props.y
  // 估算菜单尺寸（200px 宽，每项 36px 高）
  const estimatedWidth = 200
  const estimatedHeight = props.items.length * 36
  if (left + estimatedWidth > window.innerWidth) {
    left = window.innerWidth - estimatedWidth - 8
  }
  if (top + estimatedHeight > window.innerHeight) {
    top = window.innerHeight - estimatedHeight - 8
  }
  return {
    left: `${left}px`,
    top: `${top}px`
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="context-menu">
      <div v-if="visible" class="context-menu-overlay" @click="handleClickOutside">
        <div class="context-menu" :style="getMenuStyle()">
          <div
            v-for="item in items"
            :key="item.action"
            class="context-menu-item"
            :class="{ disabled: item.disabled }"
            @click="item.disabled ? undefined : handleSelect(item.action)"
          >
            <span v-if="item.icon" class="menu-icon">{{ item.icon }}</span>
            <span class="menu-label">{{ item.label }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.context-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
}

.context-menu {
  position: fixed;
  min-width: 160px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px 0;
  box-shadow: 0 4px 12px var(--shadow-color);
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 13px;
}

.context-menu-item:hover:not(.disabled) {
  background: var(--bg-tertiary);
}

.context-menu-item.disabled {
  color: var(--text-muted);
  cursor: default;
}

.menu-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.menu-label {
  white-space: nowrap;
}

/* 淡入淡出动画 */
.context-menu-enter-active,
.context-menu-leave-active {
  transition: opacity 0.15s ease;
}

.context-menu-enter-from,
.context-menu-leave-to {
  opacity: 0;
}
</style>
