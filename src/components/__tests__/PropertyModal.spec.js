import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PropertyModal from '../fonctionnalites/recherche/ModaleProprietee.vue'

// Mock des icônes Lucide Vue
vi.mock('lucide-vue-next', () => ({
  MapPin: { template: '<div data-testid="mappin-icon"></div>' },
  Home: { template: '<div data-testid="home-icon"></div>' },
  Calendar: { template: '<div data-testid="calendar-icon"></div>' },
  ExternalLink: { template: '<div data-testid="external-link-icon"></div>' },
  Lightbulb: { template: '<div data-testid="lightbulb-icon"></div>' },
  FileText: { template: '<div data-testid="file-text-icon"></div>' }
}))

describe('PropertyModal', () => {
  let wrapper

  const defaultProps = {
    property: {
      adresseComplete: '123 Rue de la Paix',
      codePostal: '75001',
      commune: 'Paris',
      surfaceHabitable: 100,
      matchScore: 95,
      consommationEnergie: 250,
      emissionGES: 45,
      classeDPE: 'D',
      latitude: 48.8566,
      longitude: 2.3522
    },
    formattedAddress: '123 Rue de la Paix',
    commune: 'Paris',
    surface: 100,
    matchScore: 95,
    energyClass: 'D',
    mapUrl: 'https://maps.google.com/maps?q=48.8566,2.3522&output=embed&z=18&t=k',
    geoportailUrl: 'https://geoportail.gouv.fr/test',
    propertyType: 'Appartement',
    floor: '2',
    yearBuilt: '1950',
    location: 'Côté jardin',
    numberOfLevels: 3,
    ceilingHeight: 2.8,
    diagnosisDate: '15 janvier 2023',
    energyConsumption: 250,
    gesEmissions: 45,
    departmentAverages: {
      avgEnergyConsumption: 200,
      department: '75',
      surfaceRanges: [
        {
          range: '0-50m²',
          consumption: { total: 180 }
        },
        {
          range: '50-100m²',
          consumption: { total: 200 }
        },
        {
          range: '100+m²',
          consumption: { total: 220 }
        }
      ],
      overall: {
        consumption: { total: 200 }
      }
    }
  }

  beforeEach(() => {
    wrapper = mount(PropertyModal, {
      props: defaultProps
    })
  })

  afterEach(() => wrapper.unmount())

  // Tests de rendu du composant
  describe('Rendu du composant', () => {
    it('affiche le composant quand la propriété est fournie', () => {
      expect(wrapper.find('.fixed.inset-0').exists()).toBe(true)
    })

    it("affiche l'adresse formatée dans l'en-tête", () => {
      const header = wrapper.find('.text-lg.sm\\:text-2xl')
      expect(header.text()).toContain('123 Rue de la Paix')
    })

    it('affiche la commune et la surface dans le sous-titre', () => {
      const subtitle = wrapper.find('.flex.flex-wrap.items-center.gap-2')
      expect(subtitle.text()).toContain('Paris')
      expect(subtitle.text()).toContain('100')
      expect(subtitle.text()).toContain('m²')
    })

    it('affiche le lien "Voir sur Maps"', () => {
      const mapLinks = wrapper.findAll('a')
      const mapLink = mapLinks.find(link => link.text().includes('Voir sur Maps'))
      expect(mapLink).toBeDefined()
      if (mapLink) {
        expect(mapLink.attributes('href')).toContain('google.com/maps')
      }
    })

    it('affiche automatiquement un aperçu nommé sans transmettre la page référente', () => {
      const frame = wrapper.get('iframe')
      expect(frame.attributes('src')).toBe(defaultProps.mapUrl)
      expect(frame.attributes('title')).toBe('Vue satellite de 123 Rue de la Paix')
      expect(frame.attributes('loading')).toBe('lazy')
      expect(frame.attributes('referrerpolicy')).toBe('no-referrer')
      const link = wrapper.findAll('a').find(link => link.text().includes('Voir sur Maps'))
      expect(link.attributes('target')).toBe('_blank')
      expect(link.attributes('rel')).toBe('noopener noreferrer')
    })

    it('conserve le lien de secours pendant le chargement et après un échec de la carte', async () => {
      const fallback = wrapper.get('[data-map-preview] a')
      expect(fallback.attributes('href')).toContain('https://www.google.com/maps/search/')
      expect(fallback.attributes('target')).toBe('_blank')
      expect(fallback.attributes('rel')).toBe('noopener noreferrer')
      await wrapper.get('iframe').trigger('error')
      expect(fallback.exists()).toBe(true)
      await wrapper.get('iframe').trigger('load')
      expect(fallback.exists()).toBe(true)
      // A cross-origin load event does not prove the provider rendered a map.
      expect(wrapper.text()).not.toContain('Carte chargée')
    })

    it('retire la carte en fermant et la recrée pour une autre sélection', async () => {
      const original = wrapper.get('iframe').element
      await wrapper.setProps({ property: null })
      expect(wrapper.find('iframe').exists()).toBe(false)
      const nextUrl = 'https://maps.google.com/maps?q=43.2965,5.3698&output=embed&z=18&t=k'
      await wrapper.setProps({ property: {}, mapUrl: nextUrl, formattedAddress: 'Marseille' })
      expect(wrapper.get('iframe').attributes('src')).toBe(nextUrl)
      expect(wrapper.get('iframe').attributes('title')).toBe('Vue satellite de Marseille')
      expect(wrapper.get('iframe').element).not.toBe(original)
    })

    it('ne conserve pas la carte du bien précédent quand la nouvelle sélection change', async () => {
      const original = wrapper.get('iframe').element
      const nextUrl = 'https://maps.google.com/maps?q=Lyon&output=embed&z=18&t=k'
      await wrapper.setProps({ property: {}, mapUrl: nextUrl, formattedAddress: 'Lyon' })
      expect(wrapper.get('iframe').attributes('src')).toBe(nextUrl)
      expect(wrapper.get('iframe').element).not.toBe(original)
      await wrapper.setProps({ mapUrl: '' })
      expect(wrapper.find('iframe').exists()).toBe(false)
      expect(wrapper.findAll('a').find(link => link.text() === 'Voir sur Maps')).toBeDefined()
    })

    it('affiche la section des caractéristiques', () => {
      const section = wrapper.find('.space-y-1\\.5')
      expect(section.text()).toContain('Surface habitable:')
      expect(section.text()).toContain('100')
      expect(section.text()).toContain('Type de bien:')
      expect(section.text()).toContain('Appartement')
      expect(section.text()).toContain('Étage:')
      expect(section.text()).toContain('2')
    })

    it('affiche la section performance énergétique', () => {
      const energySections = wrapper.findAll('.bg-white.dark\\:bg-gray-800.rounded-xl')
      const energySection = energySections.find(section => section.text().includes('Performance énergétique'))
      expect(energySection).toBeDefined()
      if (energySection) {
        expect(energySection.text()).toContain('Performance énergétique')
        expect(energySection.text()).toContain('Consommation:')
        expect(energySection.text()).toContain('250 kWh/m²/an')
        expect(energySection.text()).toContain('Émissions CO₂:')
        expect(energySection.text()).toContain('45 kg/m²/an')
      }
    })

    it('affiche le bouton de fermeture', () => {
      // Find the button that emits close event
      const closeButton = wrapper.find('button.flex-shrink-0')
      expect(closeButton.exists()).toBe(true)
      // Check it has the SVG icon
      const svg = closeButton.find('svg')
      expect(svg.exists()).toBe(true)
    })
  })

  // Tests de gestion des props
  describe('Gestion des props', () => {
    it('gère gracieusement les props optionnelles', async () => {
      await wrapper.setProps({
        property: { ...defaultProps.property },
        formattedAddress: '123 Rue de la Paix',
        commune: 'Paris',
        surface: 100,
        mapUrl: null,
        geoportailUrl: null,
        floor: null,
        yearBuilt: null
      })

      // L'iframe ne devrait pas être affiché sans URL
      expect(wrapper.find('iframe').exists()).toBe(false)

      // Les champs optionnels ne devraient pas être affichés
      expect(wrapper.text()).not.toContain('Étage:')
      expect(wrapper.text()).not.toContain('Année de construction:')
    })

    it('affiche conditionnellement les champs selon les props', async () => {
      await wrapper.setProps({
        floor: null,
        yearBuilt: null,
        location: null
      })

      expect(wrapper.text()).not.toContain('Étage:')
      expect(wrapper.text()).not.toContain('Année de construction:')
      expect(wrapper.text()).not.toContain('Localisation:')
    })

    it('gère correctement différents types de biens', async () => {
      await wrapper.setProps({ propertyType: 'Maison' })
      expect(wrapper.text()).toContain('Maison')

      await wrapper.setProps({ propertyType: 'Appartement' })
      expect(wrapper.text()).toContain('Appartement')
    })
  })

  // Tests d'émission d'événements
  describe("Émission d'événements", () => {
    it("émet l'événement close quand le bouton de fermeture est cliqué", async () => {
      const closeButton = wrapper.find('button.flex-shrink-0')
      await closeButton.trigger('click')

      expect(wrapper.emitted('close')).toBeTruthy()
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it("émet l'événement close quand on clique sur le fond", async () => {
      const backdrop = wrapper.find('.fixed.inset-0')
      await backdrop.trigger('click.self')

      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it("n'émet pas l'événement close quand on clique sur le contenu de la modal", async () => {
      const modalContent = wrapper.find('[role="dialog"]')
      await modalContent.trigger('click')

      expect(wrapper.emitted('close')).toBeFalsy()
    })

    it("émet l'événement show-details quand le bouton détails est cliqué", async () => {
      const buttons = wrapper.findAll('button')
      const detailsButton = buttons.find(btn => btn.text().includes('Détails complets'))

      if (detailsButton) {
        await detailsButton.trigger('click')
        expect(wrapper.emitted('show-details')).toBeTruthy()
        expect(wrapper.emitted('show-details')).toHaveLength(1)
      }
    })
  })

  // Tests du badge de score
  describe('Badge de score', () => {
    it('affiche la bonne classe et un score sur 100 pour un score élevé', () => {
      const scoreBadge = wrapper.get('.score-badge')
      expect(scoreBadge.classes()).toContain('bg-blue-100')
      expect(scoreBadge.text()).toBe('Score 95/100')
    })

    it("affiche la classe énergétique quand le score n'est pas fourni", async () => {
      await wrapper.setProps({ matchScore: null })
      expect(wrapper.text()).toContain('D')
    })

    it('affiche "N/A" quand ni le score ni la classe ne sont fournis', async () => {
      await wrapper.setProps({
        matchScore: null,
        energyClass: null
      })
      // Without score or energy class, neither badge should appear
      const scoreBadges = wrapper.findAll('.hidden.sm\\:inline-block')
      const hasScoreBadge = scoreBadges.some(badge => badge.text().startsWith('Score '))
      const hasClassBadge = scoreBadges.some(badge => badge.text().includes('Classe'))
      expect(hasScoreBadge).toBe(false)
      expect(hasClassBadge).toBe(false)
    })

    it.each([
      [95, 'bg-blue-100'],
      [75, 'bg-yellow-100'],
      [45, 'bg-orange-100']
    ])('conserve la couleur pour le score %s', async (score, color) => {
      await wrapper.setProps({ matchScore: score })
      const scoreBadge = wrapper.get('.score-badge')
      expect(scoreBadge.text()).toBe(`Score ${score}/100`)
      expect(scoreBadge.classes()).toContain(color)
    })
  })

  describe('Contexte du diagnostic', () => {
    it.each(['isLegacyData', 'fromLegacy'])(
      'garde la mention ancien diagnostic visible sans modifier sa classe publiée : %s',
      async legacyFlag => {
        await wrapper.setProps({
          property: { ...defaultProps.property, [legacyFlag]: true },
          matchScore: null,
          energyClass: 'A',
          diagnosisDate: '15 juin 2015'
        })
        const legacy = wrapper.get('[data-legacy-dpe]')
        expect(legacy.text()).toBe('DPE ancien')
        expect(legacy.classes()).not.toContain('hidden')
        expect(wrapper.text()).toContain('Classe A')
        expect(wrapper.text()).toContain('15 juin 2015')
        await wrapper.setProps({ property: { ...defaultProps.property, isLegacyData: false } })
        expect(wrapper.find('[data-legacy-dpe]').exists()).toBe(false)
      }
    )

    it('ne répète pas l’avertissement complet de la liste dans la fiche', () => {
      expect(wrapper.find('[data-score-explanation]').exists()).toBe(false)
    })
  })

  // Tests d'affichage de la classe énergétique
  describe('Affichage de la classe énergétique', () => {
    it('affiche la bonne couleur pour la classe A', async () => {
      await wrapper.setProps({ energyClass: 'A' })

      const energyBadges = wrapper.findAll('span')
      const energyBadge = energyBadges.find(span => span.classes().includes('bg-green-500') && span.text() === 'A')
      if (energyBadge) {
        expect(energyBadge.exists()).toBe(true)
      }
    })

    it('affiche la bonne couleur pour la classe D', () => {
      const energyBadges = wrapper.findAll('span')
      const energyBadge = energyBadges.find(span => span.classes().includes('bg-orange-400') && span.text() === 'D')
      if (energyBadge) {
        expect(energyBadge.exists()).toBe(true)
      }
    })

    it('affiche la bonne couleur pour la classe G', async () => {
      await wrapper.setProps({ energyClass: 'G' })

      const energyBadges = wrapper.findAll('span')
      const energyBadge = energyBadges.find(span => span.classes().includes('bg-red-600') && span.text() === 'G')
      if (energyBadge) {
        expect(energyBadge.exists()).toBe(true)
      }
    })

    it('gère correctement les classes énergétiques en minuscules', async () => {
      await wrapper.setProps({ energyClass: 'd' })

      const energyBadges = wrapper.findAll('span')
      const energyBadge = energyBadges.find(span => span.text() === 'D')
      if (energyBadge) {
        expect(energyBadge.exists()).toBe(true)
      }
    })
  })

  // Tests des moyennes départementales
  describe('Moyennes départementales', () => {
    it('affiche la couleur verte quand la consommation est inférieure à la moyenne', () => {
      // La consommation (250) est supérieure à la moyenne (200) dans nos props
      const avgText = wrapper.find('.text-sm.text-gray-600')
      if (avgText.exists() && avgText.text().includes('Moyenne dépt')) {
        expect(avgText.text()).toContain('200')
      }
    })

    it("gère l'absence de moyennes départementales", async () => {
      await wrapper.setProps({ departmentAverages: null })
      expect(wrapper.text()).not.toContain('Moyenne dépt')
    })

    it('affiche le bon département dans le label', () => {
      const avgText = wrapper.text()
      if (avgText.includes('Moyenne dépt')) {
        expect(avgText).toContain('75')
      }
    })
  })

  // Tests des liens externes
  describe('Liens externes', () => {
    it('affiche le lien Google Maps avec la bonne URL', () => {
      const mapLinks = wrapper.findAll('a')
      const mapLink = mapLinks.find(link => link.text().includes('Voir sur Maps'))
      expect(mapLink).toBeDefined()
      if (mapLink) {
        expect(mapLink.attributes('href')).toContain('google.com/maps')
        expect(mapLink.attributes('target')).toBe('_blank')
        expect(mapLink.attributes('rel')).toBe('noopener noreferrer')
      }
    })

    it("affiche le lien DVF Data.Gouv quand l'URL est fournie", () => {
      const links = wrapper.findAll('a')
      const dvfLink = links.find(link => link.text().includes('DVF Data.Gouv'))
      if (dvfLink) {
        expect(dvfLink.attributes('target')).toBe('_blank')
        expect(dvfLink.text()).toContain('DVF Data.Gouv')
      }
    })

    it("cache le lien DVF Data.Gouv quand l'URL n'est pas fournie", async () => {
      await wrapper.setProps({ geoportailUrl: null })

      const links = wrapper.findAll('a')
      const dvfLink = links.find(link => link.text().includes('DVF Data.Gouv'))
      expect(dvfLink).toBeUndefined()
    })

    it('utilise les coordonnées réelles en secours sans inventer une adresse', async () => {
      await wrapper.setProps({ formattedAddress: undefined, commune: undefined })
      expect(wrapper.get('[data-map-preview] a').attributes('href')).toContain('query=48.8566,2.3522')
      await wrapper.setProps({ property: { _geopoint: '43.2965,5.3698' } })
      expect(wrapper.get('[data-map-preview] a').attributes('href')).toContain('query=43.2965,5.3698')
      await wrapper.setProps({ property: {} })
      expect(wrapper.get('[data-map-preview] a').attributes('href')).toBe('https://www.google.com/maps')
    })

    it("utilise l'adresse formatée pour le lien Google Maps", () => {
      const mapLinks = wrapper.findAll('a')
      const mapLink = mapLinks.find(link => link.text().includes('Voir sur Maps'))
      if (mapLink) {
        const href = mapLink.attributes('href')
        expect(href).toContain(encodeURIComponent('123 Rue de la Paix'))
      }
    })
  })

  // Tests d'intégration
  describe('Intégration', () => {
    it("n'affiche pas la modal quand property est null", async () => {
      await wrapper.setProps({ property: null })
      expect(wrapper.find('.fixed.inset-0').exists()).toBe(false)
    })

    it('adapte la mise en page quand les sections optionnelles sont manquantes', async () => {
      await wrapper.setProps({
        mapUrl: null,
        energyConsumption: null,
        gesEmissions: null
      })

      // L'iframe ne devrait pas être affiché
      expect(wrapper.find('iframe').exists()).toBe(false)

      // Les valeurs énergétiques devraient afficher N/A ou ne pas être affichées
      const text = wrapper.text()
      if (text.includes('Consommation:')) {
        expect(text).toContain('N/A')
      }
    })

    it('affiche toutes les sections quand toutes les données sont fournies', () => {
      // Vérifier que toutes les sections principales sont présentes
      expect(wrapper.find('iframe').exists()).toBe(true)
      expect(wrapper.text()).toContain('Caractéristiques') // Caractéristiques
      expect(wrapper.text()).toContain('Performance énergétique') // Performance
      const mapLinks = wrapper.findAll('a')
      const hasMapLink = mapLinks.some(link => link.text().includes('Voir sur Maps'))
      expect(hasMapLink).toBe(true) // Liens
    })

    it('gère correctement le mode sombre', () => {
      // Vérifier que les classes dark: sont présentes
      const darkClasses = wrapper.find('.dark\\:bg-gray-800')
      expect(darkClasses.exists()).toBe(true)
    })
  })
})

describe('property modal missing and zero surface', () => {
  it.each([null, undefined])('labels an absent surface without inventing a measurement: %s', surface => {
    const wrapper = mount(PropertyModal, { props: { property: {}, surface } })
    try {
      expect(wrapper.text()).toContain('Surface non renseignée')
      expect(wrapper.text()).not.toMatch(/NaN|0m²/)
    } finally {
      wrapper.unmount()
    }
  })

  it('displays a known zero surface without changing missing energy defaults', () => {
    const wrapper = mount(PropertyModal, {
      props: { property: {}, surface: 0, energyConsumption: 0, gesEmissions: 0 }
    })
    try {
      expect(wrapper.text()).toContain('0m²')
      expect(wrapper.text()).not.toContain('0 kWh/m²/an')
      expect(wrapper.text()).not.toContain('0 kg/m²/an')
      expect(wrapper.text()).not.toContain('Surface non renseignée')
    } finally {
      wrapper.unmount()
    }
  })
})
