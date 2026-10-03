import { shallowMount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AmbiguousCommuneError } from '../../utils/communeDirectory.js'
import Home from '../Home.vue'

vi.mock('../../services/dpe-search.service.js', () => ({
  // biome-ignore lint/complexity/useArrowFunction: Vitest 4 constructor mocks must be constructable.
  default: vi.fn(function () {
    return { search: vi.fn().mockRejectedValue(new AmbiguousCommuneError()) }
  })
}))

let wrapper
afterEach(async () => {
  wrapper?.unmount()
  vi.useRealTimers()
  // Shallow-mounted async components can still be resolving their modules.
  // Finish that work before Vitest tears down this file's environment.
  await vi.dynamicImportSettled()
})

describe('actionable commune ambiguity', () => {
  it('keeps the form visible, stops loading and displays a postcode clarification', async () => {
    const resetLoading = vi.fn()
    wrapper = shallowMount(Home, {
      global: {
        stubs: {
          FormulaireRechercheDPE: {
            template: '<form data-test="search-form"></form>',
            methods: { resetLoading }
          }
        }
      }
    })
    await wrapper.vm.handleSearch({ commune: 'Saint-Denis' })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="alert"]').text()).toBe('Plusieurs communes portent ce nom. Précisez le code postal.')
    expect(wrapper.find('[data-test="search-form"]').isVisible()).toBe(true)
    expect(wrapper.vm.searchResults).toBeNull()
    expect(wrapper.vm.showAnimation).toBe(false)
    expect(wrapper.vm.animationTimeout).toBeNull()
    expect(resetLoading).toHaveBeenCalledTimes(1)
  })
})

describe('search loading interruption', () => {
  it('does not display a stale response after returning to the form', async () => {
    wrapper = shallowMount(Home)
    let finishSearch
    wrapper.vm.dpeService.search = vi.fn(
      () =>
        new Promise(resolve => {
          finishSearch = resolve
        })
    )
    const pending = wrapper.vm.handleSearch({ commune: 'Lyon' })
    expect(wrapper.vm.showAnimation).toBe(true)
    wrapper.vm.handleNewSearch()
    finishSearch({ results: [], totalFound: 0 })
    await pending
    expect(wrapper.vm.searchResults).toBeNull()
    expect(wrapper.vm.showAnimation).toBe(false)
  })

  it('keeps a real pending request visible beyond the old animation deadline', async () => {
    vi.useFakeTimers()
    wrapper = shallowMount(Home)
    let finishSearch
    wrapper.vm.dpeService.search = vi.fn(
      () =>
        new Promise(resolve => {
          finishSearch = resolve
        })
    )
    const pending = wrapper.vm.handleSearch({ commune: 'Lyon' })
    vi.advanceTimersByTime(11000)
    expect(wrapper.vm.showAnimation).toBe(true)
    expect(wrapper.vm.animationTimeout).toBeNull()
    wrapper.vm.handleNewSearch()
    finishSearch({ results: [], totalFound: 0 })
    await pending
    vi.useRealTimers()
  })

  it('ignores nearby results after returning to the form', async () => {
    wrapper = shallowMount(Home)
    wrapper.vm.handleRechercheDPERecenteStarted({ address: 'Lyon' })
    wrapper.vm.handleNewSearch()
    await wrapper.vm.handleRecentDPEResults({ address: 'Lyon' }, { results: [], totalFound: 0 })
    expect(wrapper.vm.recentDPEResults).toBeNull()
    expect(wrapper.vm.showAnimation).toBe(false)
  })
})
