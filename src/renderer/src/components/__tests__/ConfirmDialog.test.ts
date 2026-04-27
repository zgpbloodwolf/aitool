/**
 * ConfirmDialog 组件单元测试
 *
 * 验证确认对话框的显示/隐藏、确认/取消回调、类型样式
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConfirmDialog from '../ConfirmDialog.vue'

describe('ConfirmDialog', () => {
  // 测试 1: visible=true 时渲染显示
  it('visible=true 时渲染对话框', () => {
    const wrapper = mount(ConfirmDialog, {
      props: {
        visible: true,
        title: '测试标题',
        message: '测试消息'
      }
    })
    expect(wrapper.find('.confirm-dialog').exists()).toBe(true)
    expect(wrapper.find('.dialog-title').text()).toBe('测试标题')
    expect(wrapper.find('.dialog-message').text()).toBe('测试消息')
  })

  // 测试 2: visible=false 时不渲染
  it('visible=false 时不渲染对话框', () => {
    const wrapper = mount(ConfirmDialog, {
      props: {
        visible: false,
        title: '测试标题',
        message: '测试消息'
      }
    })
    expect(wrapper.find('.confirm-dialog').exists()).toBe(false)
  })

  // 测试 3: 点击确认按钮触发 confirm emit
  it('点击确认按钮触发 confirm 事件', async () => {
    const wrapper = mount(ConfirmDialog, {
      props: {
        visible: true,
        title: '测试',
        message: '消息'
      }
    })
    await wrapper.find('.btn-confirm').trigger('click')
    expect(wrapper.emitted('confirm')).toBeTruthy()
    expect(wrapper.emitted('confirm')!.length).toBe(1)
  })

  // 测试 4: 点击取消按钮触发 cancel emit
  it('点击取消按钮触发 cancel 事件', async () => {
    const wrapper = mount(ConfirmDialog, {
      props: {
        visible: true,
        title: '测试',
        message: '消息'
      }
    })
    await wrapper.find('.btn-cancel').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
    expect(wrapper.emitted('cancel')!.length).toBe(1)
  })

  // 测试 5: 点击遮罩层触发 cancel emit
  it('点击遮罩层触发 cancel 事件', async () => {
    const wrapper = mount(ConfirmDialog, {
      props: {
        visible: true,
        title: '测试',
        message: '消息'
      }
    })
    await wrapper.find('.dialog-overlay').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  // 测试 6: type='danger' 时确认按钮有 .btn-danger class
  it("type='danger' 时确认按钮使用 danger 样式", () => {
    const wrapper = mount(ConfirmDialog, {
      props: {
        visible: true,
        title: '测试',
        message: '消息',
        type: 'danger'
      }
    })
    const btn = wrapper.find('.btn-confirm')
    expect(btn.classes()).toContain('danger')
  })

  // 测试 7: type='warning' 时确认按钮有 .btn-warning class
  it("type='warning' 时确认按钮使用 warning 样式", () => {
    const wrapper = mount(ConfirmDialog, {
      props: {
        visible: true,
        title: '测试',
        message: '消息',
        type: 'warning'
      }
    })
    const btn = wrapper.find('.btn-confirm')
    expect(btn.classes()).toContain('warning')
  })

  // 测试 8: 默认 type 为 'info'
  it("未指定 type 时默认使用 info 样式", () => {
    const wrapper = mount(ConfirmDialog, {
      props: {
        visible: true,
        title: '测试',
        message: '消息'
      }
    })
    const btn = wrapper.find('.btn-confirm')
    expect(btn.classes()).toContain('info')
  })

  // 测试 9: 自定义按钮文字
  it('支持自定义确认和取消按钮文字', () => {
    const wrapper = mount(ConfirmDialog, {
      props: {
        visible: true,
        title: '测试',
        message: '消息',
        confirmText: '删除',
        cancelText: '返回'
      }
    })
    expect(wrapper.find('.btn-confirm').text()).toBe('删除')
    expect(wrapper.find('.btn-cancel').text()).toBe('返回')
  })
})
