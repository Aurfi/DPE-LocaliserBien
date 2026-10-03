import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FAQ from '../FAQ.vue'

describe('DPE guidance', () => {
  it('explains source grades without the obsolete consumption-only table', () => {
    const wrapper = mount(FAQ, { global: { stubs: { RouterLink: true } } })
    expect(wrapper.text()).toContain('La consommation seule ne suffit donc pas')
    expect(wrapper.text()).toContain('2,3 à 1,9')
    expect(wrapper.text()).not.toContain('B 51-90')
    expect(wrapper.text()).not.toContain('classe D (173')
    expect(
      wrapper
        .find('a[href="https://www.ecologie.gouv.fr/actualites/evolutions-du-calcul-du-dpe-reponses-vos-questions"]')
        .exists()
    ).toBe(true)
    wrapper.unmount()
  })
  it('describes candidate matching without guaranteeing identification or publication delay', () => {
    const wrapper = mount(FAQ, { global: { stubs: { RouterLink: true } } })
    expect(wrapper.text()).toContain('Plusieurs biens peuvent correspondre')
    expect(wrapper.text()).not.toContain("trouve l'adresse exacte")
    expect(wrapper.text()).not.toContain('1 et 3 semaines')
    wrapper.unmount()
  })
})
