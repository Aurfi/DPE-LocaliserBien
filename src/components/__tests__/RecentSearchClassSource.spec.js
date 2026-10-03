import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import RecherchesRecentes from '../fonctionnalites/recherche/RecherchesRecentes.vue'

const fixture = vi.hoisted(() => ({ recentSearches: { value: [] } }))
vi.mock('../../stores/useRecherches.js', () => ({ useRecherches: () => fixture }))

describe('recent search class provenance', () => {
  it('keeps numeric criteria without inventing energy or climate grades', () => {
    fixture.recentSearches.value = [
      { commune: '13080', surface: 65, consommation: 173, ges: 6, timestamp: Date.now(), resultsCount: 1 }
    ]
    const wrapper = mount(RecherchesRecentes)
    expect(wrapper.text()).toContain('173 kWh')
    expect(wrapper.find('[data-testid="history-energy-class"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="history-ges-class"]').exists()).toBe(false)
    wrapper.unmount()
  })
  it('preserves explicitly selected advert classes', () => {
    fixture.recentSearches.value = [
      { commune: '13080', surface: 65, energyClass: 'C', gesClass: 'B', timestamp: Date.now(), resultsCount: 1 }
    ]
    const wrapper = mount(RecherchesRecentes)
    expect(wrapper.get('[data-testid="history-energy-class"]').text()).toBe('C')
    expect(wrapper.get('[data-testid="history-ges-class"]').text()).toBe('B')
    wrapper.unmount()
  })
})
