import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRecherches } from '../../stores/useRecherches.js'
import FormulaireRechercheDPE from '../fonctionnalites/dpe/FormulaireRechercheDPE.vue'
import HistoriqueRechercheDPE from '../fonctionnalites/dpe/HistoriqueRechercheDPE.vue'
import RechercheDPERecente from '../fonctionnalites/dpe/RechercheDPERecente.vue'
import RecherchesRecentes from '../fonctionnalites/recherche/RecherchesRecentes.vue'

const mocks = vi.hoisted(() => ({ search: vi.fn(), geocode: vi.fn() }))
vi.mock('../../utils/utilsGeo.js', () => ({ geocodeAddress: mocks.geocode }))
vi.mock('../../services/recent-dpe.service', () => ({ searchRecentDPE: mocks.search }))
let wrappers = []
const mountForm = component => {
  const wrapper = mount(component, { global: { stubs: { RouterLink: true } } })
  wrappers.push(wrapper)
  return wrapper
}
const savedRecord = key => JSON.parse(localStorage.setItem.mock.calls.filter(([name]) => name === key).at(-1)[1])[0]
beforeEach(() => {
  useRecherches().clearSearchHistory('all')
  useRecherches().setHistoryEnabled(true)
  mocks.geocode.mockResolvedValue({ lat: 48.85, lon: 2.35 })
  mocks.search.mockResolvedValue({ totalFound: 1, results: [{}] })
})
afterEach(() => {
  for (const wrapper of wrappers) wrapper.unmount()
  wrappers = []
  vi.clearAllMocks()
})

describe('fractional and zero-GES history round trips', () => {
  it.each(['0', '0.0', '0,0', '6,5', '>6,5', ''])(
    'preserves listing fractions and GES %s through save and replay',
    async ges => {
      const form = mountForm(FormulaireRechercheDPE)
      await form.get('#search-commune').setValue('75001')
      await form.get('#search-surface').setValue('65,5')
      await form.get('#search-consommation').setValue('173.5')
      await form.get('#search-ges').setValue(ges)
      await form.get('[aria-label="Rechercher une maison"]').trigger('click')
      await form.vm.handleSubmit()
      const request = form.emitted('search')[0][0]
      const expectedGES = ges === '' ? null : ges.startsWith('>') ? '>6.5' : ges === '6,5' ? 6.5 : 0
      expect(request).toMatchObject({ surfaceHabitable: 65.5, consommationEnergie: 173.5, emissionGES: expectedGES })
      expect(form.get('#search-surface').element.value).toBe('65,5')
      expect(form.get('#search-ges').element.value).toBe(ges)
      useRecherches().saveSearch(request, 1)
      const saved = savedRecord('dpe_recent_searches')
      expect(saved).toMatchObject({ surface: 65.5, consommation: 173.5, ges: expectedGES, typeBien: 'maison' })
      localStorage.getItem.mockReturnValueOnce(JSON.stringify([saved]))
      useRecherches().loadRecentSearches()
      const history = mountForm(RecherchesRecentes)
      await history.get('[role="button"]').trigger('click')
      expect(history.emitted('relaunch-search')[0][0]).toMatchObject({
        surfaceHabitable: 65.5,
        consommationEnergie: 173.5,
        emissionGES: expectedGES,
        typeBien: 'maison'
      })
    }
  )
  it.each(['0', '0.0', '0,0', '6,5', '<6.5', ''])(
    'preserves nearby fractions and GES %s through save and replay',
    async ges => {
      const form = mountForm(RechercheDPERecente)
      await form.get('#nearby-address').setValue('Paris')
      await form.get('#nearby-surface').setValue('>65,5')
      await form.get('#nearby-consommation').setValue('173,5')
      await form.get('#nearby-ges').setValue(ges)
      form.vm.selectPropertyType('appartement')
      await form.vm.searchRecentDPE()
      const expectedGES = ges === '' ? null : ges.startsWith('<') ? '<6.5' : ges === '6,5' ? 6.5 : 0
      expect(form.get('#nearby-surface').element.value).toBe('>65,5')
      expect(form.get('#nearby-ges').element.value).toBe(ges)
      const saved = savedRecord('recent_dpe_searches')
      expect(saved).toMatchObject({ surface: '>65.5', consommation: 173.5, ges: expectedGES, typeBien: 'appartement' })
      localStorage.getItem.mockReturnValueOnce(JSON.stringify([saved]))
      useRecherches().loadRecentDPESearches()
      const history = mountForm(HistoriqueRechercheDPE)
      await form.get('#nearby-surface').setValue('100')
      await form.get('#nearby-consommation').setValue('300')
      await form.get('#nearby-ges').setValue('50')
      form.vm.selectPropertyType('maison')
      await history.get('[role="button"]').trigger('click')
      // Home passes this component-emitted payload to the nearby form unchanged.
      await form.vm.relaunchSearch(history.emitted('relaunch-search')[0][0])
      expect(mocks.search.mock.calls.at(-1)[0]).toMatchObject({
        surface: '>65.5',
        consommation: 173.5,
        ges: expectedGES,
        typeBien: 'appartement'
      })
    }
  )
  it('does not inherit newer consumption or GES when replaying an older history entry without them', async () => {
    const form = mountForm(RechercheDPERecente)
    await form.get('#nearby-consommation').setValue('173.5')
    await form.get('#nearby-ges').setValue('0.0')
    await form.vm.relaunchSearch({ address: 'Paris', monthsBack: 1, radius: 1, surface: 65.5 })
    expect(mocks.search.mock.calls.at(-1)[0]).toMatchObject({ surface: 65.5, consommation: null, ges: null })
  })
})
