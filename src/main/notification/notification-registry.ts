/**
 * 通知管理器共享引用模块
 * 避免 index.ts 和 claude-webview.ts 之间的循环依赖
 */
import type { NotificationManager } from './notification-manager'

export let notificationManager: NotificationManager | null = null

export function setNotificationManager(mgr: NotificationManager): void {
  notificationManager = mgr
}
