// 窗口-频道双向映射注册表 (UX-11)
// 维护 BrowserWindow ID 与 Claude 频道 ID 的关联关系

export class WindowChannelRegistry {
  // 窗口 ID → 该窗口下的所有频道 ID
  private windowChannels = new Map<number, Set<string>>()
  // 频道 ID → 所属窗口 ID
  private channelWindow = new Map<string, number>()

  /** 注册新窗口 */
  registerWindow(windowId: number): void {
    if (!this.windowChannels.has(windowId)) {
      this.windowChannels.set(windowId, new Set())
    }
  }

  /** 注销窗口，清理所有关联频道映射 */
  unregisterWindow(windowId: number): void {
    const channels = this.windowChannels.get(windowId)
    if (channels) {
      for (const channelId of channels) {
        this.channelWindow.delete(channelId)
      }
      this.windowChannels.delete(windowId)
    }
  }

  /** 注册频道到窗口 */
  registerChannel(windowId: number, channelId: string): void {
    this.registerWindow(windowId)
    this.windowChannels.get(windowId)!.add(channelId)
    this.channelWindow.set(channelId, windowId)
  }

  /** 注销单个频道 */
  unregisterChannel(channelId: string): void {
    const windowId = this.channelWindow.get(channelId)
    if (windowId !== undefined) {
      const channels = this.windowChannels.get(windowId)
      if (channels) {
        channels.delete(channelId)
      }
      this.channelWindow.delete(channelId)
    }
  }

  /** 迁移频道到新窗口（拖拽出窗口时使用） */
  migrateChannel(channelId: string, newWindowId: number): void {
    const oldWindowId = this.channelWindow.get(channelId)
    if (oldWindowId !== undefined) {
      const channels = this.windowChannels.get(oldWindowId)
      if (channels) {
        channels.delete(channelId)
      }
    }
    this.registerChannel(newWindowId, channelId)
  }

  /** 查询频道所属窗口 ID */
  getWindowIdByChannel(channelId: string): number | undefined {
    return this.channelWindow.get(channelId)
  }

  /** 查询窗口的所有频道 */
  getChannelsByWindow(windowId: number): string[] {
    const channels = this.windowChannels.get(windowId)
    return channels ? [...channels] : []
  }
}
