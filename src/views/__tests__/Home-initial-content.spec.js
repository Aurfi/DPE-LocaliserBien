import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useRecherches } from '../../stores/useRecherches.js'
import Home from '../Home.vue'

let wrapper

afterEach(async () => {
  wrapper?.unmount()
  useRecherches().setHistoryEnabled(false)
  await vi.dynamicImportSettled()
})

describe('initial Home content', () => {
  it.each([false, true])('renders the form, tabs and opted-in history together (history: %s)', historyEnabled => {
    localStorage.getItem.mockImplementation(key =>
      key === 'dpe_recent_searches'
        ? JSON.stringify([{ commune: '75001', surface: 65, resultCount: 1, timestamp: 1791000000000 }])
        : null
    )
    useRecherches().setHistoryEnabled(historyEnabled)
    wrapper = mount(Home, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
          RechercheDPERecente: true,
          HistoriqueRechercheDPE: true,
          AnimationTriangulation: true,
          DPEResults: true,
          RecentDPEResults: true
        }
      }
    })
    // Deliberately do not flush promises: these elements need to share the
    // first render, not arrive in an async-component update after it paints.
    expect(wrapper.get('h1').text()).toBe('Retrouver un bien grâce à son DPE')
    expect(wrapper.get('nav[aria-label="Type de recherche"]').isVisible()).toBe(true)
    expect(wrapper.get('#search-commune').isVisible()).toBe(true)
    expect(wrapper.find('h2').exists()).toBe(historyEnabled)
    if (historyEnabled) expect(wrapper.get('h2').text()).toBe('Recherches récentes')
  })
})
