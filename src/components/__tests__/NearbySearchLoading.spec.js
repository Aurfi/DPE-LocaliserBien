import { shallowMount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RechercheDPERecente from '../fonctionnalites/dpe/RechercheDPERecente.vue'

const mocks = vi.hoisted(() => ({ geocode: vi.fn(), search: vi.fn() }))
vi.mock('../../utils/utilsGeo.js', () => ({ geocodeAddress: mocks.geocode }))
vi.mock('../../services/recent-dpe.service', () => ({ searchRecentDPE: mocks.search }))

let wrapper
afterEach(() => {
  wrapper?.unmount()
  vi.clearAllMocks()
})

describe('nearby search loading interruptions', () => {
  it('ignores geocoding completed after cancellation', async () => {
    let finish
    mocks.geocode.mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve
        })
    )
    wrapper = shallowMount(RechercheDPERecente)
    wrapper.vm.searchCriteria.address = 'Lyon'
    const pending = wrapper.vm.searchRecentDPE()
    wrapper.vm.cancelSearch()
    finish({ lat: 45.76, lon: 4.84 })
    await pending
    expect(wrapper.emitted('search-started')).toBeUndefined()
    expect(mocks.search).not.toHaveBeenCalled()
    expect(wrapper.vm.loading).toBe(false)
  })
  it('does not start a duplicate request on repeated submit', async () => {
    let finish
    mocks.geocode.mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve
        })
    )
    wrapper = shallowMount(RechercheDPERecente)
    wrapper.vm.searchCriteria.address = 'Lyon'
    const first = wrapper.vm.searchRecentDPE()
    await wrapper.vm.searchRecentDPE()
    expect(mocks.geocode).toHaveBeenCalledTimes(1)
    wrapper.vm.cancelSearch()
    finish({ lat: 45.76, lon: 4.84 })
    await first
  })

  it('ignores cancelled DPE results and preserves a newer retry', async () => {
    let finishOldSearch
    mocks.geocode.mockResolvedValue({ lat: 45.76, lon: 4.84 })
    mocks.search
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            finishOldSearch = resolve
          })
      )
      .mockResolvedValueOnce({ results: [], totalFound: 0, marker: 'new' })
    wrapper = shallowMount(RechercheDPERecente)
    wrapper.vm.searchCriteria.address = 'Lyon'
    const first = wrapper.vm.searchRecentDPE()
    await Promise.resolve()
    wrapper.vm.cancelSearch()
    wrapper.vm.searchCriteria.address = 'Paris'
    await wrapper.vm.searchRecentDPE()
    finishOldSearch({ results: [], totalFound: 0, marker: 'old' })
    await first

    expect(wrapper.emitted('search-results')).toHaveLength(1)
    expect(wrapper.emitted('search-results')[0][0].address).toBe('Paris')
    expect(wrapper.emitted('search-results')[0][1].marker).toBe('new')
    expect(wrapper.vm.loading).toBe(false)
  })
})
