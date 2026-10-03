import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import ModaleDetailsDPE from '../fonctionnalites/dpe/ModaleDetailsDPE.vue'
import ModaleProprietee from '../fonctionnalites/recherche/ModaleProprietee.vue'
import CarteBien from '../partages/CarteBien.vue'

const wrappers = []
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
})

describe('construction display across result cards and detail dialogs', () => {
  it.each([
    [1, 'Inconnue'],
    ['1', 'Inconnue'],
    [1985, '1985'],
    ['1948-1974', '1948-1974'],
    ['avant 1948', 'avant 1948']
  ])('consistently displays %s as %s without rewriting source data', (value, expected) => {
    const property = {
      id: 'legacy-construction-fixture',
      numeroDPE: 'legacy-construction-fixture',
      surfaceHabitable: 69.29,
      anneeConstruction: value,
      isLegacyData: true,
      rawData: { annee_construction: value }
    }
    const fixtures = [
      [CarteBien, { result: property, index: 0, yearBuilt: value }],
      [ModaleProprietee, { property, yearBuilt: String(value) }],
      [ModaleDetailsDPE, { property, show: true }]
    ]
    for (const [component, props] of fixtures) {
      const wrapper = mount(component, { props })
      wrappers.push(wrapper)
      expect(wrapper.get('[data-construction-year]').text()).toBe(expected)
    }
    expect(property.anneeConstruction).toBe(value)
    expect(property.rawData.annee_construction).toBe(value)
  })
})
