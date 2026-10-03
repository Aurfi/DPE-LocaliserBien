import { mount, RouterLinkStub } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FAQ from '../FAQ.vue'

function mountGuide() {
  return mount(FAQ, { global: { stubs: { RouterLink: RouterLinkStub } } })
}

describe('DPE guidance', () => {
  it('explains source grades without the obsolete consumption-only table', () => {
    const wrapper = mountGuide()
    const guidance = wrapper.findAll('details').find(answer => answer.text().includes('classe officielle'))
    expect(guidance.text()).toContain('La consommation seule ne suffit donc pas')
    expect(guidance.text()).toContain('2,3 à 1,9')
    expect(guidance.text()).toContain('Ne convertissez pas vous-même la consommation totale')
    expect(guidance.text()).toContain('attestation officielle')
    expect(wrapper.text()).not.toContain('B 51-90')
    expect(wrapper.text()).not.toContain('classe D (173')
    expect(
      guidance
        .find('a[href="https://www.ecologie.gouv.fr/actualites/evolutions-du-calcul-du-dpe-reponses-vos-questions"]')
        .exists()
    ).toBe(true)
    wrapper.unmount()
  })

  it('describes candidate matching without guaranteeing identification or publication delay', () => {
    const wrapper = mountGuide()
    const results = wrapper.find('#resultats[aria-labelledby="guide-resultats"]')
    expect(results.text()).toContain('Plusieurs biens peuvent correspondre')
    expect(results.text()).toContain('pas une probabilité d’identification')
    expect(results.text()).toContain('sans confirmer')
    expect(wrapper.text()).not.toContain("trouve l'adresse exacte")
    expect(wrapper.text()).not.toContain('1 et 3 semaines')
    wrapper.unmount()
  })

  it('puts both search modes and their actual criteria before supplementary answers', () => {
    const wrapper = mountGuide()
    expect(wrapper.findAll('h1')).toHaveLength(1)
    expect(wrapper.findAll('h2').map(heading => heading.text())).toEqual([
      'Retrouver un bien à partir d’une annonce',
      'Explorer les biens à proximité',
      'Lire les résultats',
      'Questions utiles'
    ])
    const criteria = wrapper.find('dl')
    expect(criteria.findAll('dt')).toHaveLength(3)
    expect(criteria.text()).toContain('ville ou le code postal')
    expect(criteria.text()).toContain('kWh/m²/an')
    expect(criteria.text()).toContain('classe de A à G')
    expect(criteria.text()).toContain('kgCO₂/m²/an ou la classe climat')
    expect(criteria.text()).toContain('facultatifs')
    const nearby = wrapper.find('[aria-labelledby="guide-proximite"]')
    expect(nearby.text()).toContain('une adresse, choisissez un rayon et une période')
    expect(nearby.text()).toContain('Vérifiez l’adresse retenue en tête des résultats')
    expect(nearby.text()).toContain('ne signifie pas que le logement est en vente ou en location')
    wrapper.unmount()
  })

  it('keeps supplementary help in native closed disclosures with one clear return link', () => {
    const wrapper = mountGuide()
    const answers = wrapper.findAll('details')
    expect(answers).toHaveLength(4)
    for (const answer of answers) {
      expect(answer.attributes('open')).toBeUndefined()
      expect(answer.element.firstElementChild.tagName).toBe('SUMMARY')
      expect(answer.find('summary').text()).not.toBe('')
    }
    const links = wrapper.findAllComponents(RouterLinkStub)
    expect(links.filter(link => link.props('to') === '/')).toHaveLength(1)
    expect(links.find(link => link.props('to') === '/').text()).toBe('Revenir à la recherche')
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.find('svg').exists()).toBe(false)
    wrapper.unmount()
  })

  it('links official sources and privacy guidance and describes the restored inline map', () => {
    const wrapper = mountGuide()
    expect(wrapper.find('a[href="https://data.ademe.fr/"]').exists()).toBe(true)
    expect(wrapper.find('a[href="https://observatoire-dpe-audit.ademe.fr/"]').exists()).toBe(true)
    for (const link of wrapper.findAll('a[href^="https://"]')) {
      expect(link.attributes('target')).toBe('_blank')
      expect(link.attributes('rel')).toBe('noopener noreferrer')
    }
    expect(
      wrapper.findAllComponents(RouterLinkStub).some(link => link.props('to') === '/mentions-legales#vie-privee')
    ).toBe(true)
    expect(wrapper.text()).toContain('L’historique est désactivé par défaut')
    expect(wrapper.text()).toContain('Ouvrir la fiche d’un résultat charge une carte Google Maps')
    expect(wrapper.text()).toContain('Google reçoit la localisation du bien')
    expect(wrapper.text()).not.toContain('cartes externes ne sont ouvertes que')
    // Reading help itself must not load a third-party map or other remote media.
    expect(wrapper.find('iframe, img, video').exists()).toBe(false)
    wrapper.unmount()
  })
})
