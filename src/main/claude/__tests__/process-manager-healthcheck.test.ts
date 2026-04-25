/**
 * process-manager.ts 心跳检测和崩溃恢复功能的单元测试
 *
 * 测试覆盖：
 * - startHealthCheck 在 intervalMs 后检测到进程不存活时调用 onUnresponsive
 * - stopHealthCheck 清除定时器不再调用 onUnresponsive
 * - resumeSessionId getter 返回 start 时传入的 resumeSessionId
 * - stop() 后同时停止心跳定时器
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ClaudeProcessManager } from '../process-manager'

describe('ClaudeProcessManager - 心跳检测', () => {
  let manager: ClaudeProcessManager

  beforeEach(() => {
    manager = new ClaudeProcessManager()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    manager.stop()
  })

  it('startHealthCheck 在 intervalMs 后检测到进程不存活时调用 onUnresponsive', () => {
    // 模拟进程已启动但不可达
    const onUnresponsive = vi.fn()

    // 使用 vi.spyOn 模拟 process.kill 抛出异常（进程不存在）
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {
      throw new Error('ESRCH: 进程不存在')
    })

    // 先通过 start 启动一个 mock 进程，使 _running 为 true
    // 直接模拟内部状态：需要 process 和 _running
    // 使用 (manager as any) 访问私有成员来设置测试状态
    ;(manager as any)._running = true
    ;(manager as any).process = { pid: 12345, stdin: { destroyed: false } }

    manager.startHealthCheck(onUnresponsive, 30000)

    // 在 intervalMs 之前不应调用
    vi.advanceTimersByTime(29999)
    expect(onUnresponsive).not.toHaveBeenCalled()

    // 到达 intervalMs 后应调用
    vi.advanceTimersByTime(1)
    expect(onUnresponsive).toHaveBeenCalledTimes(1)

    killSpy.mockRestore()
  })

  it('stopHealthCheck 清除定时器后 onUnresponsive 不再被调用', () => {
    const onUnresponsive = vi.fn()
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {
      throw new Error('ESRCH: 进程不存在')
    })

    ;(manager as any)._running = true
    ;(manager as any).process = { pid: 12345 }

    manager.startHealthCheck(onUnresponsive, 30000)
    manager.stopHealthCheck()

    // 推进时间远超 interval，不应调用
    vi.advanceTimersByTime(120000)
    expect(onUnresponsive).not.toHaveBeenCalled()

    killSpy.mockRestore()
  })

  it('resumeSessionId getter 返回 start 时传入的 resumeSessionId', () => {
    // 由于 start() 会 spawn 真实进程，这里直接测试 getter 逻辑
    // 通过设置私有属性来验证 getter
    ;(manager as any)._resumeSessionId = 'test-session-123'

    expect(manager.resumeSessionId).toBe('test-session-123')
  })

  it('resumeSessionId 为 null 时返回 null', () => {
    ;(manager as any)._resumeSessionId = null
    expect(manager.resumeSessionId).toBeNull()
  })

  it('stop() 同时停止心跳定时器', () => {
    const onUnresponsive = vi.fn()
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {
      throw new Error('ESRCH: 进程不存在')
    })

    ;(manager as any)._running = true
    ;(manager as any).process = { pid: 12345, stdin: { end: vi.fn(), destroyed: false }, kill: vi.fn() }

    manager.startHealthCheck(onUnresponsive, 30000)

    // stop() 应同时停止心跳
    manager.stop()

    // 推进时间远超 interval，不应调用
    vi.advanceTimersByTime(120000)
    expect(onUnresponsive).not.toHaveBeenCalled()

    killSpy.mockRestore()
  })

  it('startHealthCheck 在没有进程运行时不调用 onUnresponsive', () => {
    const onUnresponsive = vi.fn()

    // 不设置 _running 和 process（默认值）
    manager.startHealthCheck(onUnresponsive, 30000)

    vi.advanceTimersByTime(60000)
    expect(onUnresponsive).not.toHaveBeenCalled()
  })

  it('startHealthCheck 进程存活时不调用 onUnresponsive', () => {
    const onUnresponsive = vi.fn()

    // 模拟进程存活（process.kill 不抛异常）
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {
      // 进程存在，不抛异常
    })

    ;(manager as any)._running = true
    ;(manager as any).process = { pid: 12345 }

    manager.startHealthCheck(onUnresponsive, 30000)

    vi.advanceTimersByTime(60000)
    expect(onUnresponsive).not.toHaveBeenCalled()

    killSpy.mockRestore()
  })

  it('多次调用 startHealthCheck 只保留最后一次的定时器', () => {
    const onUnresponsive1 = vi.fn()
    const onUnresponsive2 = vi.fn()
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {
      throw new Error('ESRCH: 进程不存在')
    })

    ;(manager as any)._running = true
    ;(manager as any).process = { pid: 12345 }

    manager.startHealthCheck(onUnresponsive1, 30000)
    manager.startHealthCheck(onUnresponsive2, 30000)

    vi.advanceTimersByTime(30000)

    // 只有第二个回调应该被调用
    expect(onUnresponsive1).not.toHaveBeenCalled()
    expect(onUnresponsive2).toHaveBeenCalledTimes(1)

    killSpy.mockRestore()
  })
})
