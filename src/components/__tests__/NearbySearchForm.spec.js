import { shallowMount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RechercheDPERecente from '../fonctionnalites/dpe/RechercheDPERecente.vue'

const mocks = vi.hoisted(() => ({ geocode: vi.fn(), search: vi.fn() }))
vi.mock('../../utils/utilsGeo.js', () => ({ geocodeAddress: mocks.geocode }))
vi.mock('../../services/recent-dpe.service', () => ({ searchRecentDPE: mocks.search }))

let wrapper
beforeEach(() => {
  mocks.geocode.mockResolvedValue({ lat: 45.76, lon: 4.84 })
  mocks.search.mockResolvedValue({ results: [], totalFound: 0 })
  wrapper = shallowMount(RechercheDPERecente)
})
afterEach(() => {
  wrapper.unmount()
  vi.resetAllMocks()
})

async function toggleFilters(open) {
  // Dispatch the native event: DOM emulation does not implement keyboard default actions.
  const details = wrapper.get('details')
  details.element.open = open
  await details.trigger('toggle')
}

const savedSearch = overrides => ({ address: 'Lyon', monthsBack: 1, radius: 0.5, ...overrides })

const deferred = () => {
  let resolve
  const promise = new Promise(finish => {
    resolve = finish
  })
  return { promise, resolve }
}

describe('nearby optional filter disclosure', () => {
  it('keeps essential inputs and the sole submit outside initially closed native details', () => {
    const details = wrapper.get('details')
    expect(details.element.open).toBe(false)
    expect(details.element.firstElementChild.tagName).toBe('SUMMARY')
    expect(wrapper.get('summary').text()).toContain('Filtres facultatifs')
    expect(wrapper.get('summary').text()).toContain('Surface, type de bien, énergie, GES')
    expect(wrapper.get('summary').attributes('role')).toBeUndefined()
    expect(wrapper.get('summary').attributes('tabindex')).toBeUndefined()
    for (const id of ['address', 'monthsBack', 'radius']) {
      expect(wrapper.get(`#nearby-${id}`).element.closest('details')).toBeNull()
    }
    for (const id of ['surface', 'consommation', 'ges']) {
      expect(wrapper.get(`#nearby-${id}`).element.closest('details')).toBe(details.element)
    }
    expect(details.findAll('button')).toHaveLength(16)
    expect(wrapper.findAll('button[type="submit"]')).toHaveLength(1)
    expect(details.element.nextElementSibling).toBe(wrapper.get('button[type="submit"]').element)
    expect(wrapper.get('#nearby-address').attributes('required')).toBeDefined()
  })

  it('submits an address-only search with unchanged default criteria while optional filters stay closed', async () => {
    await wrapper.get('#nearby-address').setValue('Lyon')
    await wrapper.vm.searchRecentDPE()
    expect(mocks.search).toHaveBeenCalledWith({
      address: 'Lyon',
      monthsBack: 1,
      radius: 0.5,
      surface: null,
      typeBien: null,
      consommation: null,
      ges: null,
      energyClasses: [],
      gesClasses: []
    })
    expect(wrapper.get('details').element.open).toBe(false)
  })

  it('preserves values and shows every active criterion when the user closes and reopens filters', async () => {
    await toggleFilters(true)
    await wrapper.get('#nearby-surface').setValue('65,5')
    await wrapper.get('button[title="Maison"]').trigger('click')
    await wrapper.get('button[aria-label="Classe énergétique C"]').trigger('click')
    await wrapper.get('button[aria-label="Classe énergétique D"]').trigger('click')
    await wrapper.get('#nearby-ges').setValue('0')
    await toggleFilters(false)

    expect(wrapper.get('details').element.open).toBe(false)
    const summary = wrapper.get('summary').text()
    for (const text of ['4 actifs', 'Surface : 65,5 m²', 'Maison', 'Énergie : C, D', 'GES : 0 kgCO₂/m²/an']) {
      expect(summary).toContain(text)
    }
    await wrapper.get('#nearby-address').setValue('Paris')
    // Editing required criteria must not unexpectedly reopen a disclosure the user closed.
    expect(wrapper.get('details').element.open).toBe(false)
    await toggleFilters(true)
    expect(wrapper.get('#nearby-surface').element.value).toBe('65,5')
    expect(wrapper.get('#nearby-ges').element.value).toBe('0')
    expect(wrapper.get('button[title="Maison"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('#nearby-consommation').element.disabled).toBe(true)
    await wrapper.vm.searchRecentDPE()
    expect(mocks.search).toHaveBeenCalledWith(
      expect.objectContaining({ surface: 65.5, typeBien: 'maison', energyClasses: ['C', 'D'], ges: 0 })
    )
  })

  it('reveals restored numeric, property and class filters, including explicit zero', async () => {
    await wrapper.vm.relaunchSearch(
      savedSearch({ surface: '>65.5', typeBien: 'appartement', consommation: 173.5, gesClasses: ['A', 'B'] })
    )
    expect(wrapper.get('details').element.open).toBe(true)
    expect(wrapper.get('summary').text()).toContain('4 actifs')
    expect(wrapper.get('summary').text()).toContain('Consommation : 173.5 kWh/m²/an')
    expect(wrapper.get('summary').text()).toContain('GES : A, B')
    await toggleFilters(false)
    await wrapper.vm.relaunchSearch(savedSearch({ ges: 0 }))
    expect(wrapper.get('details').element.open).toBe(true)
    expect(wrapper.get('summary').text()).toContain('1 actif)')
    expect(wrapper.get('summary').text()).toContain('GES : 0 kgCO₂/m²/an')
    expect(wrapper.get('summary').text()).not.toContain('Consommation :')
  })

  it('reopens an unchanged active saved search and collapses a restored unfiltered search', async () => {
    await wrapper.vm.relaunchSearch(savedSearch({ surface: 65.5 }))
    await toggleFilters(false)
    await wrapper.vm.relaunchSearch(savedSearch({ surface: 65.5 }))
    expect(wrapper.get('details').element.open).toBe(true)
    await wrapper.vm.relaunchSearch(savedSearch({}))
    expect(wrapper.get('details').element.open).toBe(false)
    expect(wrapper.get('summary').text()).not.toContain('actif')
    expect(wrapper.get('#nearby-surface').element.value).toBe('')
    expect(mocks.search).toHaveBeenLastCalledWith(
      expect.objectContaining({
        surface: null,
        consommation: null,
        ges: null,
        typeBien: null,
        energyClasses: [],
        gesClasses: []
      })
    )
  })

  it('keeps invalid values visible on restoration and explains a disabled submit even when collapsed', async () => {
    await wrapper.vm.relaunchSearch(savedSearch({ surface: '65 m²' }))
    expect(wrapper.get('details').element.open).toBe(true)
    expect(wrapper.get('#nearby-surface').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('#nearby-surface-error').text()).toContain('nombre')
    expect(mocks.geocode).not.toHaveBeenCalled()
    await toggleFilters(false)
    expect(wrapper.get('summary').text()).toContain('Un filtre est à corriger.')
    expect(wrapper.get('button[type="submit"]').element.disabled).toBe(true)
    await toggleFilters(true)
    await wrapper.get('#nearby-surface').setValue('65,5')
    expect(wrapper.get('summary').text()).not.toContain('corriger')
    expect(wrapper.get('button[type="submit"]').element.disabled).toBe(false)
  })

  it('does not collapse controls while the user clears the last filter or keep an empty filter count', async () => {
    await toggleFilters(true)
    await wrapper.get('#nearby-surface').setValue('65')
    await wrapper.get('#nearby-surface').setValue(' ')
    expect(wrapper.get('details').element.open).toBe(true)
    expect(wrapper.get('summary').text()).not.toContain('actif')
    await toggleFilters(false)
    expect(wrapper.get('details').element.open).toBe(false)
  })
})

describe('nearby address failure recovery', () => {
  it.each([
    null,
    undefined,
    {},
    { lat: 45.76 },
    { lat: '45.76', lon: 4.84 },
    { lat: Number.NaN, lon: 4.84 },
    { lat: 45.76, lon: Number.POSITIVE_INFINITY },
    { lat: 91, lon: 4.84 },
    { lat: 45.76, lon: -181 }
  ])('handles unusable geocoding %j without starting DPE search or showing an internal exception', async geoData => {
    mocks.geocode.mockResolvedValue(geoData)
    await wrapper.get('#nearby-address').setValue('zzzzzzzzzzzz')
    await wrapper.vm.searchRecentDPE()
    expect(wrapper.get('[role="alert"]').text()).toBe(
      'Adresse introuvable. Vérifiez la rue, la ville ou le code postal, puis réessayez.'
    )
    expect(wrapper.get('#nearby-address').element.value).toBe('zzzzzzzzzzzz')
    expect(wrapper.get('button[type="submit"]').element.disabled).toBe(false)
    expect(wrapper.vm.loading).toBe(false)
    expect(wrapper.emitted('search-started')).toBeUndefined()
    expect(wrapper.emitted('search-error')).toHaveLength(1)
    expect(mocks.search).not.toHaveBeenCalled()
  })

  it('lets a corrected address retry succeed and clears the previous alert', async () => {
    mocks.geocode.mockResolvedValueOnce(null).mockResolvedValueOnce({ lat: 0, lon: 0 })
    await wrapper.get('#nearby-address').setValue('zzzzzzzzzzzz')
    await wrapper.vm.searchRecentDPE()
    await wrapper.get('#nearby-address').setValue('Nouvelle adresse')
    await wrapper.vm.searchRecentDPE()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.emitted('search-results')).toHaveLength(1)
    expect(wrapper.emitted('search-started')[0][0].coordinates).toEqual({ lat: 0, lon: 0 })
    expect(mocks.search).toHaveBeenCalledOnce()
    expect(wrapper.vm.loading).toBe(false)
  })

  it.each(['geocode', 'search'])('uses a French retry message for unexpected %s exceptions', async stage => {
    mocks[stage].mockRejectedValue(new TypeError("Cannot read properties of null (reading 'lat')"))
    await wrapper.get('#nearby-address').setValue('Lyon')
    await wrapper.vm.searchRecentDPE()
    expect(wrapper.get('[role="alert"]').text()).toBe(
      'La recherche n’a pas pu aboutir. Veuillez réessayer dans quelques instants.'
    )
    expect(wrapper.vm.loading).toBe(false)
    expect(wrapper.get('button[type="submit"]').element.disabled).toBe(false)
  })

  it.each([null, undefined, { lat: 91, lon: 0 }])(
    'ignores stale invalid geocoding %j after cancellation and a newer search',
    async staleResult => {
      const older = deferred()
      mocks.geocode.mockReturnValueOnce(older.promise)
      await wrapper.get('#nearby-address').setValue('Ancienne adresse')
      const pending = wrapper.vm.searchRecentDPE()
      wrapper.vm.cancelSearch()
      await wrapper.get('#nearby-address').setValue('Lyon')
      await wrapper.vm.searchRecentDPE()
      older.resolve(staleResult)
      await pending
      expect(wrapper.find('[role="alert"]').exists()).toBe(false)
      expect(wrapper.emitted('search-error')).toBeUndefined()
      expect(wrapper.emitted('search-results')).toHaveLength(1)
      expect(mocks.search).toHaveBeenCalledOnce()
      expect(wrapper.vm.loading).toBe(false)
    }
  )

  it('ignores invalid geocoding completed after the form unmounts', async () => {
    const older = deferred()
    mocks.geocode.mockReturnValueOnce(older.promise)
    await wrapper.get('#nearby-address').setValue('Ancienne adresse')
    const pending = wrapper.vm.searchRecentDPE()
    wrapper.unmount()
    older.resolve(null)
    await pending
    expect(wrapper.emitted('search-error')).toBeUndefined()
    expect(mocks.search).not.toHaveBeenCalled()
    expect(wrapper.vm.loading).toBe(false)
  })
})
