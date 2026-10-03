import userEvent from '@testing-library/user-event'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FormulaireRechercheDPE from '../fonctionnalites/dpe/FormulaireRechercheDPE.vue'
import RechercheDPERecente from '../fonctionnalites/dpe/RechercheDPERecente.vue'

const mocks = vi.hoisted(() => ({ geocode: vi.fn(), search: vi.fn() }))
vi.mock('../../utils/utilsGeo.js', () => ({ geocodeAddress: mocks.geocode }))
vi.mock('../../services/recent-dpe.service', () => ({ searchRecentDPE: mocks.search }))

let wrapper
beforeEach(() => {
  mocks.geocode.mockResolvedValue({ lat: 45.76, lon: 4.84 })
  mocks.search.mockResolvedValue({ results: [], totalFound: 0 })
})
afterEach(() => {
  wrapper?.unmount()
  vi.clearAllMocks()
})

const formCases = [
  { name: 'listing', component: FormulaireRechercheDPE, prefix: 'search', model: 'formData' },
  { name: 'nearby', component: RechercheDPERecente, prefix: 'nearby', model: 'searchCriteria' }
]

async function mountValidForm(config) {
  wrapper = mount(config.component, { attachTo: document.body, global: { stubs: { RouterLink: true } } })
  if (config.name === 'listing') {
    await wrapper.get('#search-commune').setValue('Lyon')
    await wrapper.get('#search-surface').setValue('65')
    await wrapper.get('#search-consommation').setValue('173')
  } else {
    await wrapper.get('#nearby-address').setValue('Lyon')
    const optionalFilters = wrapper.get('details')
    optionalFilters.element.open = true
    await optionalFilters.trigger('toggle')
  }
}

for (const config of formCases) {
  describe(`${config.name} numeric inputs`, () => {
    for (const field of ['surface', 'consommation', 'ges']) {
      it.each(['65,5', '65.5'])(`preserves typed %s in ${field} and submits its fractional value`, async value => {
        await mountValidForm(config)
        const input = wrapper.get(`#${config.prefix}-${field}`)
        const user = userEvent.setup()
        await user.clear(input.element)
        await user.type(input.element, value)
        await wrapper.vm.$nextTick()
        expect(input.element.value).toBe(value)
        expect(wrapper.vm[config.model][field]).toBe(value)
        expect(input.attributes('aria-invalid')).toBe('false')
        expect(wrapper.find(`#${config.prefix}-${field}-error`).exists()).toBe(false)
        expect(wrapper.get('button[type="submit"]').element.disabled).toBe(false)
        if (config.name === 'listing') {
          await wrapper.vm.handleSubmit()
          const requestField = { surface: 'surfaceHabitable', consommation: 'consommationEnergie', ges: 'emissionGES' }[
            field
          ]
          expect(wrapper.emitted('search')[0][0][requestField]).toBe(65.5)
        } else {
          await wrapper.vm.searchRecentDPE()
          expect(mocks.search.mock.calls[0][0][field]).toBe(65.5)
        }
        expect(input.element.value).toBe(value)
      })

      it.each(['65,5', '65.5', '65,5 m²', '65 m²'])(
        `preserves pasted %s in ${field}, then recovers after correction`,
        async value => {
          await mountValidForm(config)
          const input = wrapper.get(`#${config.prefix}-${field}`)
          const user = userEvent.setup()
          await user.clear(input.element)
          await user.click(input.element)
          await user.paste(value)
          await wrapper.vm.$nextTick()
          expect(input.element.value).toBe(value)
          const malformed = value.includes('m²')
          expect(input.attributes('aria-invalid')).toBe(String(malformed))
          expect(wrapper.get('button[type="submit"]').element.disabled).toBe(malformed)
          if (!malformed) {
            if (config.name === 'listing') {
              await wrapper.vm.handleSubmit()
              const requestField = {
                surface: 'surfaceHabitable',
                consommation: 'consommationEnergie',
                ges: 'emissionGES'
              }[field]
              expect(wrapper.emitted('search')[0][0][requestField]).toBe(65.5)
              wrapper.vm.resetLoading()
            } else {
              await wrapper.vm.searchRecentDPE()
              expect(mocks.search.mock.calls[0][0][field]).toBe(65.5)
            }
          }
          await input.setValue('65')
          expect(input.attributes('aria-invalid')).toBe('false')
          expect(wrapper.find(`#${config.prefix}-${field}-error`).exists()).toBe(false)
          expect(wrapper.get('button[type="submit"]').element.disabled).toBe(false)
        }
      )
    }

    it.each(['<', '>', '<<65', '65<', '1e3', '-65', '65 m²'])(
      `rejects malformed comparator/text %s before submission`,
      async value => {
        await mountValidForm(config)
        await wrapper.get(`#${config.prefix}-surface`).setValue(value)
        await wrapper.get('form').trigger('submit')
        expect(wrapper.vm[config.model].surface).toBe(value)
        expect(wrapper.get(`#${config.prefix}-surface-error`).text()).toContain('nombre')
        expect(wrapper.emitted('search')).toBeUndefined()
        expect(mocks.geocode).not.toHaveBeenCalled()
      }
    )

    it('preserves valid comparisons in the submitted criteria', async () => {
      await mountValidForm(config)
      await wrapper.get(`#${config.prefix}-surface`).setValue('<65')
      await wrapper.get(`#${config.prefix}-consommation`).setValue('>173')
      await wrapper.get(`#${config.prefix}-ges`).setValue('<6')
      expect(wrapper.get('button[type="submit"]').element.disabled).toBe(false)
      if (config.name === 'listing') {
        await wrapper.vm.handleSubmit()
        expect(wrapper.emitted('search')[0][0]).toMatchObject({
          surfaceHabitable: '<65',
          consommationEnergie: '>173',
          emissionGES: '<6'
        })
      } else {
        await wrapper.vm.searchRecentDPE()
        expect(mocks.search).toHaveBeenCalledWith(
          expect.objectContaining({ surface: '<65', consommation: '>173', ges: '<6' })
        )
      }
    })

    it('does not infer either class from a number; explicit choices remain available', async () => {
      await mountValidForm(config)
      await wrapper.get(`#${config.prefix}-consommation`).setValue('173')
      await wrapper.get(`#${config.prefix}-ges`).setValue('6')
      for (const button of wrapper.findAll('button[aria-label^="Classe"]')) {
        expect(button.attributes('aria-pressed')).toBe('false')
        expect(button.classes()).not.toContain('shadow-sm')
      }
      await wrapper.get('button[aria-label="Classe énergétique C"]').trigger('click')
      await wrapper.get('button[aria-label="Classe GES A"]').trigger('click')
      expect(wrapper.get('button[aria-label="Classe énergétique C"]').attributes('aria-pressed')).toBe('true')
      expect(wrapper.get('button[aria-label="Classe GES A"]').attributes('aria-pressed')).toBe('true')
      expect(wrapper.get(`#${config.prefix}-consommation`).element.value).toBe('')
      expect(wrapper.get(`#${config.prefix}-ges`).element.value).toBe('')
    })
  })
}

describe('empty input rules', () => {
  it('requires listing surface and consumption but accepts empty optional GES', async () => {
    await mountValidForm(formCases[0])
    await wrapper.get('#search-ges').setValue('')
    expect(wrapper.vm.isFormValid).toBe(true)
    await wrapper.get('#search-surface').setValue('')
    await wrapper.get('#search-consommation').setValue('')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('search')).toBeUndefined()
    expect(wrapper.get('#search-surface-error').text()).toBe('Indiquez la surface.')
    expect(wrapper.get('#search-consommation-error').text()).toContain('Indiquez une consommation')
  })

  it('keeps all nearby numeric fields optional and passes empty fields as null', async () => {
    await mountValidForm(formCases[1])
    for (const field of ['surface', 'consommation', 'ges']) await wrapper.get(`#nearby-${field}`).setValue('')
    expect(wrapper.get('button[type="submit"]').element.disabled).toBe(false)
    await wrapper.vm.searchRecentDPE()
    expect(mocks.search).toHaveBeenCalledWith(expect.objectContaining({ surface: null, consommation: null, ges: null }))
  })

  it('replays fractional nearby criteria without truncation', async () => {
    await mountValidForm(formCases[1])
    await wrapper.vm.relaunchSearch({
      address: 'Lyon',
      monthsBack: 1,
      radius: 0.5,
      surface: '65,5',
      consommation: '173.5',
      ges: '<6,5'
    })
    await wrapper.vm.$nextTick()
    expect(wrapper.get('#nearby-surface').element.value).toBe('65,5')
    expect(wrapper.find('#nearby-surface-error').exists()).toBe(false)
    expect(mocks.search).toHaveBeenCalledWith(
      expect.objectContaining({ surface: 65.5, consommation: 173.5, ges: '<6.5' })
    )
  })
})
