import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { searchRecentDPE } from '../../services/recent-dpe.service.js'
import ResultatsDpeRecents from '../fonctionnalites/dpe/ResultatsDpeRecents.vue'
import CarteBien from '../partages/CarteBien.vue'

vi.mock('../../utils/utilsGeo.js', () => ({
  geocodeAddress: vi.fn().mockResolvedValue({
    lat: 48.86,
    lon: 2.35,
    formattedAddress: '12 rue du Test 75001 Paris',
    postalCode: '75001',
    city: 'Paris'
  }),
  calculateDistance: vi.fn().mockReturnValue(0.5)
}))

let wrapper
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  wrapper?.unmount()
  vi.unstubAllGlobals()
})

async function renderMappedSurface(surface, fields = {}) {
  const raw = {
    numero_dpe: 'sparse',
    adresse_ban: '12 rue du Test 75001 Paris',
    surface_habitable_logement: surface,
    ...fields
  }
  fetch
    .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [raw] }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })
  const results = await searchRecentDPE({ address: '12 rue du Test', monthsBack: 6, radius: 1 })
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(results.results).toHaveLength(1)
  wrapper = mount(ResultatsDpeRecents, { props: { results }, global: { stubs: { RetourEnHaut: true } } })
  return { card: wrapper.getComponent(CarteBien), mapped: results.results[0] }
}

describe('recent DPE sparse API rows through real service mapping and dialogs', () => {
  it.each([undefined, null, '', ' ', 'invalid', NaN, Infinity, false])(
    'keeps an absent or malformed surface unknown through the service and UI: %j',
    async surface => {
      const { card, mapped } = await renderMappedSurface(surface)
      if (surface == null) expect(mapped.surfaceHabitable).toBeNull()
      expect(card.props('surface')).toBeNull()
      expect(card.text()).toContain('Non renseignée')
      expect(card.text()).not.toMatch(/NaN|Invalid Date|0 m²/)
      await card.trigger('click')
      const dialog = wrapper.get('[role="dialog"]')
      expect(dialog.text()).toContain('Surface non renseignée')
      expect(dialog.text()).not.toMatch(/0m²|0 kWh\/m²\/an|0 kg\/m²\/an/)
      expect(dialog.find('a[href*="explore.data.gouv.fr"]').exists()).toBe(false)
    }
  )

  it.each([
    [0, 0],
    ['0', 0],
    [65.4, 65.4],
    ['65.7', 65.7]
  ])('preserves a known source surface %s as %s in cards and dialogs', async (surface, exact) => {
    const { card } = await renderMappedSurface(surface)
    expect(card.props('surface')).toBe(exact)
    await card.trigger('click')
    expect(wrapper.get('[role="dialog"]').text()).toContain(`${exact}m²`)
  })
})

describe('nearby card and dialog retain the diagnostic source fields', () => {
  it('keeps fractional surface and establishment date when the visit was on a different day', async () => {
    const { card, mapped } = await renderMappedSurface(65.9, {
      date_etablissement_dpe: '2024-05-12',
      date_visite_diagnostiqueur: '2024-05-07'
    })
    expect(mapped.surfaceHabitable).toBe(65.9)
    expect(mapped.dateVisite).toBe('2024-05-12')
    expect(card.props('surface')).toBe(65.9)
    expect(card.text()).toContain('65.9 m²')
    expect(card.props('dateTooltip')).toBe('12 mai 2024')
    await card.trigger('click')
    const dialog = wrapper.get('[data-modal-layer="property"]')
    expect(dialog.text()).toContain('65.9m²')
    expect(dialog.text()).toContain('12 mai 2024')
    expect(dialog.text()).not.toContain('7 mai 2024')
  })

  it.each([undefined, null, '', 'invalid'])(
    'does not relabel a visit date as the diagnostic date when establishment is %j',
    async date => {
      const { card, mapped } = await renderMappedSurface(null, {
        date_etablissement_dpe: date,
        date_visite_diagnostiqueur: '2024-05-07'
      })
      expect(mapped.date_visite_diagnostiqueur).toBe('2024-05-07')
      expect(card.props('dateTooltip')).toBeNull()
      await card.trigger('click')
      const dialog = wrapper.get('[data-modal-layer="property"]')
      expect(dialog.text()).toContain('Surface non renseignée')
      expect(dialog.text()).not.toContain('Date du diagnostic')
      expect(dialog.text()).not.toContain('7 mai 2024')
    }
  )
})
