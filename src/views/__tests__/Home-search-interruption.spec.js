import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RechercheDPERecente from '../../components/fonctionnalites/dpe/RechercheDPERecente.vue'
import { useRecherches } from '../../stores/useRecherches.js'
import Home from '../Home.vue'

const mocks = vi.hoisted(() => ({ geocode: vi.fn(), locate: vi.fn(), nearby: vi.fn() }))
vi.mock('../../utils/utilsGeo.js', () => ({ geocodeAddress: mocks.geocode }))
vi.mock('../../services/dpe-search.service.js', () => ({
  // biome-ignore lint/complexity/useArrowFunction: Vitest 4 constructor mocks must be constructable.
  default: vi.fn(function () {
    return { search: mocks.locate }
  })
}))
vi.mock('../../services/recent-dpe.service', () => ({ searchRecentDPE: mocks.nearby }))
vi.mock('../../utils/departmentAverages.js', () => ({
  loadDepartmentAveragesForResults: vi.fn().mockResolvedValue(null)
}))

const deferred = () => {
  let resolve
  const promise = new Promise(finish => {
    resolve = finish
  })
  return { promise, resolve }
}

let wrapper
afterEach(async () => {
  wrapper?.unmount()
  // Vue's async component modules can still be resolving after unmount.
  // Await them before environment teardown, as in Home-routing.spec.js.
  await vi.dynamicImportSettled()
  vi.clearAllMocks()
})

const mountHome = () =>
  mount(Home, {
    global: {
      stubs: {
        RechercheDPERecente,
        FormulaireRechercheDPE: { template: '<form></form>', methods: { resetLoading() {} } },
        NavigationOnglets: true,
        RecherchesRecentes: true,
        HistoriqueRechercheDPE: true,
        DPEResults: true,
        RecentDPEResults: true,
        AnimationTriangulation: true
      }
    }
  })

describe('search mode interruptions', () => {
  it('completes either search immediately with history disabled and writes no criteria to storage', async () => {
    useRecherches().setHistoryEnabled(false)
    localStorage.setItem.mockClear()
    mocks.locate.mockResolvedValue({ results: [{ matchScore: 100 }], totalFound: 1 })
    mocks.geocode.mockResolvedValue({ lat: 45.76, lon: 4.84 })
    mocks.nearby.mockResolvedValue({ results: [{}], totalFound: 1 })
    wrapper = mountHome()
    await flushPromises()
    await wrapper.vm.handleSearch({ commune: '75001', surfaceHabitable: 65.5, consommationEnergie: 173.5 })
    expect(wrapper.vm.searchResults.totalFound).toBe(1)
    await wrapper.vm.handleNewSearch()
    await wrapper.vm.handleTabChange('recent')
    const form = wrapper.getComponent(RechercheDPERecente)
    form.vm.searchCriteria.address = 'Lyon'
    await form.vm.searchRecentDPE()
    expect(mocks.nearby).toHaveBeenCalledOnce()
    expect(wrapper.vm.recentDPEResults.totalFound).toBe(1)
    expect(localStorage.setItem).not.toHaveBeenCalled()
  })

  it('cancels pending nearby geocoding when changing tabs', async () => {
    const geocode = deferred()
    mocks.geocode.mockReturnValue(geocode.promise)
    wrapper = mountHome()
    await flushPromises()
    await wrapper.vm.handleTabChange('recent')
    const form = wrapper.getComponent(RechercheDPERecente)
    form.vm.searchCriteria.address = 'Lyon'
    const pending = form.vm.searchRecentDPE()

    await wrapper.vm.handleTabChange('locate')
    expect(form.vm.loading).toBe(false)
    geocode.resolve({ lat: 45.76, lon: 4.84 })
    await pending

    expect(mocks.nearby).not.toHaveBeenCalled()
    expect(form.emitted('search-started')).toBeUndefined()
    expect(wrapper.vm.showAnimation).toBe(false)
    expect(wrapper.vm.recentDPEResults).toBeNull()
  })

  it.each([true, false])(
    'preserves a newer locate search when an older nearby geocode resolves (tab change: %s)',
    async changeTab => {
      const geocode = deferred()
      const locate = deferred()
      mocks.geocode.mockReturnValue(geocode.promise)
      mocks.locate.mockReturnValue(locate.promise)
      mocks.nearby.mockResolvedValue({ results: [], totalFound: 0 })
      wrapper = mountHome()
      await flushPromises()
      await wrapper.vm.handleTabChange('recent')
      const form = wrapper.getComponent(RechercheDPERecente)
      form.vm.searchCriteria.address = 'Old nearby query'
      const olderSearch = form.vm.searchRecentDPE()

      if (changeTab) await wrapper.vm.handleTabChange('locate')
      const newerSearch = wrapper.vm.handleSearch({ commune: 'New locate query' })
      geocode.resolve({ lat: 45.76, lon: 4.84 })
      await olderSearch
      const expected = { results: [], totalFound: 0, searchLocation: 'New locate query' }
      locate.resolve(expected)
      await newerSearch

      expect(mocks.nearby).not.toHaveBeenCalled()
      expect(wrapper.vm.searchResults).toMatchObject(expected)
      expect(wrapper.vm.searchCriteria.commune).toBe('New locate query')
      expect(wrapper.vm.recentDPEResults).toBeNull()
    }
  )
})
