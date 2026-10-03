import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import AnimationTriangulation from '../animations/AnimationTriangulation.vue'

describe('honest, lightweight search loading', () => {
  it('waits for real data and completes without a decorative delay', async () => {
    const onComplete = vi.fn()
    const wrapper = mount(AnimationTriangulation, { props: { commune: 'Lyon', onComplete } })
    expect(wrapper.get('[role="status"]').attributes('aria-busy')).toBe('true')
    expect(wrapper.text()).toContain('Consultation des données publiques DPE')
    expect(wrapper.text()).not.toContain('%')
    expect(wrapper.text()).not.toContain('satellites')
    expect(onComplete).not.toHaveBeenCalled()
    await wrapper.setProps({ isDataReady: true })
    expect(onComplete).toHaveBeenCalledTimes(1)
    await wrapper.setProps({ resultsCount: 3 })
    expect(onComplete).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('handles results that are ready before the async component mounts', () => {
    const onComplete = vi.fn()
    const wrapper = mount(AnimationTriangulation, { props: { commune: '13008', onComplete, isDataReady: true } })
    expect(onComplete).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('has no timeout that can reveal an incomplete search', () => {
    vi.useFakeTimers()
    const onComplete = vi.fn()
    const wrapper = mount(AnimationTriangulation, { props: { commune: 'Paris', onComplete } })
    vi.advanceTimersByTime(60000)
    expect(onComplete).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    wrapper.unmount()
    vi.useRealTimers()
  })
  it('lets the user return to the criteria while data is pending', async () => {
    const wrapper = mount(AnimationTriangulation, { props: { commune: 'Lyon', onComplete: vi.fn() } })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    wrapper.unmount()
  })
})
