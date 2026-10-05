import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MentionsLegales from '../MentionsLegales.vue'

let wrapper

function mountPage() {
  wrapper = mount(MentionsLegales, {
    global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } }
  })
  return wrapper
}

afterEach(() => {
  wrapper?.unmount()
  vi.unstubAllEnvs()
})

describe('legal and privacy copy', () => {
  it('shows concise public information without draft or publisher-anonymity text', () => {
    const page = mountPage()
    expect(page.get('h1').text()).toBe('Mentions légales et vie privée')
    expect(page.findAll('section')).toHaveLength(5)
    expect(page.find('[role="note"]').exists()).toBe(false)
    expect(page.text()).not.toMatch(
      /projet de notice|en cours de validation|restent à préciser|doivent être confirmés|notice finalisée|seront précisées|non professionnel|anonymat|LCEN|confiance dans l’économie numérique|Google Fonts|polices/i
    )
    expect(page.find('a[href*="legifrance"]').exists()).toBe(false)
  })

  it('retains the host, configured contact, public sources, licence and matching limits', () => {
    vi.stubEnv('VITE_SITE_NAME', 'LocaliserBien')
    vi.stubEnv('VITE_CONTACT_EMAIL', 'contact@localiserbien.fr')
    const page = mountPage()
    expect(page.text()).toContain('OVH SAS, 2 rue Kellermann, 59100 Roubaix, France.')
    expect(page.findAll('a[href="mailto:contact@localiserbien.fr"]')).toHaveLength(2)
    for (const href of [
      'https://data.ademe.fr/datasets/dpe03existant',
      'https://data.ademe.fr/datasets/dpe-france',
      'https://geoservices.ign.fr/',
      'https://www.data.gouv.fr/pages/legal/licences/etalab-2.0',
      'https://www.cnil.fr/fr/mes-demarches/les-droits-pour-maitriser-vos-donnees-personnelles',
      '/THIRD_PARTY_NOTICES.txt'
    ]) {
      expect(page.get(`a[href="${href}"]`).attributes('rel')).toBe('noopener noreferrer')
    }
    expect(page.text()).toContain('il ne confirme pas l’identité du bien et ne remplace pas un diagnostic officiel')
    expect(page.text()).toContain('Les données peuvent être anciennes, incomplètes ou comporter des erreurs.')
  })

  it('describes browser queries, the embedded map connection and concise contact processing', () => {
    const page = mountPage()
    expect(page.text()).toContain('Votre navigateur interroge directement l’ADEME')
    expect(page.text()).toContain('le service de géocodage de l’IGN')
    expect(page.text()).toContain('L’application ne conserve pas d’historique centralisé des recherches.')
    expect(page.text()).toContain('L’affichage de la carte dans une fiche de bien établit une connexion à Google Maps.')
    expect(page.text()).toContain('Google reçoit l’adresse et/ou les coordonnées du bien')
    expect(page.text()).toContain('dont votre adresse IP')
    expect(page.text()).not.toMatch(/sans carte|pas.*carte Google intégrée|uniquement.*lien externe/i)
    expect(page.text()).toContain(
      'Votre adresse e-mail et votre message sont utilisés uniquement pour répondre à votre demande.'
    )
    expect(page.text()).not.toMatch(/messagerie passe par|redirigés vers|Gmail/i)
  })

  it('keeps storage limits and explicit deletion semantics on the privacy page', () => {
    const page = mountPage()
    expect(page.text()).toContain('L’historique est désactivé par défaut.')
    expect(page.text()).toContain('jusqu’à dix recherches par mode')
    expect(page.text()).toContain('Il n’y a pas d’expiration automatique des entrées.')
    expect(page.text()).toContain('Vous pouvez supprimer une entrée ou effacer les historiques.')
    expect(page.text()).toContain(
      'Désactiver l’option arrête l’enregistrement et masque les listes sans effacer automatiquement les données déjà présentes.'
    )
    expect(page.text()).toContain(
      'Les paramètres de votre navigateur permettent également d’effacer les données du site.'
    )
  })
})
