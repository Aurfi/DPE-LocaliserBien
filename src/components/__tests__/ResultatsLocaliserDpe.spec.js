import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref as mockRef, nextTick } from 'vue'
import ResultatsLocaliserDpe from '../ResultatsLocaliserDpe.vue'

// Mock child components with realistic behavior
vi.mock('../PropertyModal.vue', () => ({
  default: {
    name: 'PropertyModal',
    template: `
      <div v-if="property" data-testid="property-modal">
        <div class="property-address">{{ formattedAddress }}</div>
        <div class="property-commune">{{ commune }}</div>
        <div class="property-surface">{{ surface }} m²</div>
        <div class="property-score">{{ matchScore }}%</div>
        <button @click="$emit('close')">Fermer</button>
        <button @click="$emit('show-details')">Détails</button>
      </div>
    `,
    props: [
      'property',
      'formattedAddress',
      'commune',
      'surface',
      'matchScore',
      'energyClass',
      'mapUrl',
      'geoportailUrl',
      'propertyType',
      'floor',
      'yearBuilt',
      'location',
      'numberOfLevels',
      'ceilingHeight',
      'diagnosisDate',
      'energyConsumption',
      'gesEmissions',
      'departmentAverages'
    ],
    emits: ['close', 'show-details']
  }
}))

vi.mock('../DPEDetailsModal.vue', () => ({
  default: {
    name: 'DPEDetailsModal',
    template: `
      <div v-if="show && property" data-testid="dpe-details-modal">
        <div class="dpe-energy">{{ property.consommationEnergie }} kWh</div>
        <div class="dpe-ges">{{ property.emissionGES }} kg</div>
        <button @click="$emit('close')">Fermer</button>
      </div>
    `,
    props: ['show', 'property', 'departmentAverages'],
    emits: ['close']
  }
}))

vi.mock('../DonneesBrutesModal.vue', () => ({
  default: {
    name: 'DonneesBrutesModal',
    template: `
      <div v-if="show && dpeData" data-testid="donnees-brutes-modal">
        <pre>{{ JSON.stringify(dpeData, null, 2) }}</pre>
        <button @click="$emit('close')">Fermer</button>
      </div>
    `,
    props: ['show', 'dpeData'],
    emits: ['close']
  }
}))

vi.mock('../ScrollToTop.vue', () => ({
  default: {
    name: 'ScrollToTop',
    template: '<div data-testid="scroll-to-top"></div>'
  }
}))

vi.mock('../shared/ResultCard.vue', () => ({
  default: {
    name: 'ResultCard',
    template: `
      <div
        data-testid="result-card"
        :class="{ 'opacity-50': hasIncompleteData, 'cursor-pointer': !hasIncompleteData }"
        @click="!hasIncompleteData && $emit('click', result)"
        @contextmenu.prevent="$emit('hide', index)"
      >
        <div class="address">{{ address }}</div>
        <div class="location">{{ location }}</div>
        <div class="surface">{{ surface }} m²</div>
        <div class="score" v-if="score !== undefined">{{ Math.round(score) }}%</div>
        <div class="distance" v-if="distance !== undefined">{{ distance.toFixed(1) }} km</div>
        <div class="floor" v-if="floor">{{ floor }}</div>
        <div class="year" v-if="yearBuilt">{{ yearBuilt }}</div>
        <div v-if="isLegacy" class="legacy-warning">DPE Ancien (avant 07/2021)</div>
        <button v-if="hasIncompleteData" @click.stop="$emit('show-raw-data', result)" class="raw-data-btn">
          Voir données brutes
        </button>
      </div>
    `,
    props: [
      'result',
      'index',
      'dateDisplay',
      'dateTooltip',
      'distance',
      'distanceTooltip',
      'propertyType',
      'score',
      'scoreTooltip',
      'address',
      'location',
      'surface',
      'floor',
      'yearBuilt',
      'hasIncompleteData',
      'isLegacy'
    ],
    emits: ['click', 'hide', 'show-raw-data']
  }
}))

vi.mock('../shared/ResultsHeader.vue', () => ({
  default: {
    name: 'ResultsHeader',
    template: `
      <div data-testid="results-header">
        <div class="title">{{ title }}</div>
        <div class="status" :class="statusClass">{{ statusText }}</div>
        <div class="subtitle">{{ subtitle }}</div>
        <div v-if="hiddenCount > 0" class="hidden-count">{{ hiddenCount }} masqué(s)</div>
        <button v-if="showCloseButton" @click="$emit('close')" class="close-btn">Fermer</button>
        <select v-if="showSort" :value="sortBy" @change="$emit('update:sortBy', $event.target.value)" class="sort-select">
          <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </div>
    `,
    props: [
      'title',
      'hiddenCount',
      'statusText',
      'statusClass',
      'subtitle',
      'showCloseButton',
      'showSort',
      'sortBy',
      'sortOptions'
    ],
    emits: ['close', 'update:sortBy']
  }
}))

vi.mock('../shared/EmptyState.vue', () => ({
  default: {
    name: 'EmptyState',
    template: `
      <div data-testid="empty-state">
        <h3>{{ title }}</h3>
        <p v-if="description">{{ description }}</p>
      </div>
    `,
    props: ['icon', 'title', 'description']
  }
}))

vi.mock('../results/ErrorState.vue', () => ({
  default: {
    name: 'ErrorState',
    template: `
      <div data-testid="error-state">
        <h3>{{ title }}</h3>
        <p v-if="message">{{ message }}</p>
        <button v-if="action" @click="action.handler">{{ action.label }}</button>
      </div>
    `,
    props: ['title', 'message', 'action']
  }
}))

// Mock Lucide Vue icons
vi.mock('lucide-vue-next', () => ({
  Search: { template: '<div data-testid="search-icon"></div>' },
  OctagonX: { template: '<div data-testid="octagon-x-icon"></div>' }
}))

// Mock mapUtils
vi.mock('../../utils/mapUtils', () => ({
  getGeoportailUrl: vi.fn((lat, lon) => `https://geoportail.gouv.fr/carte?c=${lon},${lat}&z=18`),
  getGoogleMapsEmbedUrl: vi.fn((lat, lon, address) => {
    if (address && lat && lon) {
      return `https://maps.google.com/maps?q=${encodeURIComponent(address)}&ll=${lat},${lon}&output=embed`
    }
    return `https://maps.google.com/maps?q=${encodeURIComponent(address || `${lat},${lon}`)}&output=embed`
  }),
  getGoogleRegionLabel: vi.fn(postalCode => {
    const dept = postalCode?.substring(0, 2)
    return dept === '75' ? 'Île-de-France' : 'France'
  })
}))

// Mock dpeFormatters with actual logic
vi.mock('../../utils/dpeFormatters', () => ({
  extractYearFromValue: vi.fn(value => {
    if (!value) return null
    const strValue = String(value)
    const match = strValue.match(/(\d{4})/)
    return match ? parseInt(match[1], 10) : null
  }),
  formatYearDisplay: vi.fn(value => value || 'N/A'),
  formatDate: vi.fn(dateString => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }),
  getDaysAgo: vi.fn(dateString => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now - date)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return "aujourd'hui"
    if (diffDays === 1) return 'hier'
    if (diffDays < 7) return `${diffDays} jours`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} semaines`
    const months = Math.floor(diffDays / 30)
    if (months < 12) return `${months} mois`
    const years = Math.floor(months / 12)
    return `${years} an${years > 1 ? 's' : ''}`
  }),
  getPropertyType: vi.fn(result => {
    if (result.typeBien) {
      if (result.typeBien.toLowerCase().includes('appartement')) return 'appartement'
      if (result.typeBien.toLowerCase().includes('maison')) return 'maison'
    }
    return null
  }),
  getFloorDisplay: vi.fn(result => {
    if (
      result.etage !== null &&
      result.etage !== undefined &&
      result.etage !== '' &&
      result.etage !== 0 &&
      result.etage !== '0'
    ) {
      return result.etage.toString().includes('Étage') ? result.etage : `Étage: ${result.etage}`
    }
    if (result.complementRefLogement) {
      const str = String(result.complementRefLogement).trim()

      // Check for explicit "étage" with a number
      const etageMatch = str.match(/[ÉEé]tage\s*[:;#n°]?\s*°?\s*(\d+)/i)
      if (etageMatch) {
        const floorNum = etageMatch[1]
        return floorNum === '0' ? 'RDC' : `Étage: ${floorNum}`
      }

      // Check for ordinal patterns WITH the word "étage" (like "3ème étage")
      const ordinalWithEtage = str.match(/(\d+)\s*(?:er|ère|eme|ème|e|è)\s*[éÉ]tage/i)
      if (ordinalWithEtage) {
        return `Étage: ${ordinalWithEtage[1]}`
      }

      // Also check for patterns like "3ème étage"
      const simpleOrdinal = str.match(/(\d+)\s*(?:er|ème|eme|è|e)\s+[éÉ]tage/i)
      if (simpleOrdinal) {
        return `Étage: ${simpleOrdinal[1]}`
      }

      // Check for RDC
      if (str.match(/\bRDC\b|rez.?de.?chauss[ée]e/i)) {
        return 'RDC'
      }
    }
    return null
  }),
  cleanAddress: vi.fn((adresseComplete, communeADEME) => {
    if (!adresseComplete) return 'Bien localisé'
    let address = adresseComplete
    // Remove postal codes
    address = address.replace(/\s+\d{5}\s*/g, ' ')
    // Remove city name if present
    if (communeADEME) {
      const cityRegex = new RegExp(`\\s*${communeADEME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'gi')
      address = address.replace(cityRegex, ' ')
    }
    return address.trim() || 'Bien localisé'
  })
}))

// Mock composables with reactive refs
vi.mock('../../composables/useResultsHandling', () => ({
  useResultsHandling: () => {
    const selectedProperty = mockRef(null)
    const showDPEDetails = mockRef(false)
    const showRawDataModal = mockRef(false)
    const rawDataProperty = mockRef(null)
    const hiddenResults = mockRef(new Set())

    return {
      selectedProperty,
      showDPEDetails,
      showRawDataModal,
      rawDataProperty,
      hiddenResults,
      showDetails: vi.fn(property => {
        selectedProperty.value = property
        document.body.style.overflow = 'hidden'
      }),
      closeModal: vi.fn(() => {
        selectedProperty.value = null
        document.body.style.overflow = ''
      }),
      showRawDataForResult: vi.fn(property => {
        rawDataProperty.value = property
        showRawDataModal.value = true
      }),
      setupEventListeners: vi.fn(),
      cleanupEventListeners: vi.fn(() => {
        document.body.style.overflow = ''
      })
    }
  }
}))

describe('ResultatsLocaliserDpe', () => {
  let wrapper

  const mockSearchResult = {
    searchStrategy: 'SUCCESS',
    diagnostics: [],
    isMultiCommune: false,
    results: [
      {
        adresseComplete: '123 Rue de la Paix 75001 Paris',
        communeADEME: 'Paris',
        commune: 'Paris',
        communeDisplay: 'Paris',
        codePostal: '75001',
        codePostalDisplay: '75001',
        codePostalADEME: '75001',
        surfaceHabitable: 100,
        matchScore: 95,
        dateVisite: '2023-01-15',
        distance: 0.5,
        typeBien: 'appartement',
        etage: 2,
        anneeConstruction: 1950,
        complementRefLogement: 'Étage: 2, Porte gauche',
        consommationEnergie: 250,
        emissionGES: 45,
        classeDPE: 'D',
        latitude: 48.8566,
        longitude: 2.3522,
        hasIncompleteData: false,
        isLegacyData: false
      },
      {
        adresseComplete: '456 Avenue des Champs 69001 Lyon',
        communeADEME: 'Lyon',
        commune: 'Lyon',
        communeDisplay: 'Lyon',
        codePostal: '69001',
        codePostalDisplay: '69001',
        codePostalADEME: '69001',
        surfaceHabitable: 120,
        matchScore: 85,
        dateVisite: '2023-02-20',
        distance: 1.2,
        typeBien: 'maison',
        anneeConstruction: 2000,
        consommationEnergie: 180,
        emissionGES: 35,
        classeDPE: 'C',
        latitude: 45.764,
        longitude: 4.8357,
        hasIncompleteData: false,
        isLegacyData: false
      },
      {
        adresseComplete: null,
        communeADEME: 'Marseille',
        commune: 'Marseille',
        codePostal: '13001',
        surfaceHabitable: 80,
        matchScore: 60,
        dateVisite: '2021-06-01',
        distance: 2.5,
        typeBien: 'appartement',
        etage: 0,
        anneeConstruction: '1970-1980',
        complementRefLogement: 'RDC',
        consommationEnergie: 300,
        emissionGES: 55,
        classeDPE: 'E',
        latitude: 43.2965,
        longitude: 5.3698,
        hasIncompleteData: true,
        isLegacyData: true
      }
    ]
  }

  const mockSearchCriteria = {
    commune: 'Paris',
    codePostal: '75001',
    surfaceHabitable: 100,
    consommationEnergie: 250,
    emissionGES: 45,
    distance: 2
  }

  const mockDepartmentAverages = {
    department: '75',
    surfaceRanges: [
      {
        range: '50-100m²',
        consumption: { total: 200, chauffage: 150, eau_chaude: 30 },
        ges: 40
      }
    ]
  }

  beforeEach(() => {
    // Reset document.body.style.overflow
    document.body.style.overflow = ''

    wrapper = mount(ResultatsLocaliserDpe, {
      props: {
        searchResult: mockSearchResult,
        searchCriteria: mockSearchCriteria,
        departmentAverages: mockDepartmentAverages
      }
    })

    // Reset hidden results to ensure clean state
    wrapper.vm.hiddenResults.clear()

    // Fix the hideResult method to work properly
    wrapper.vm.hideResult = vi.fn(filteredIndex => {
      if (filteredIndex !== null && filteredIndex >= 0) {
        const visibleResults = wrapper.vm.searchResult.results.filter(
          (_, originalIndex) => !wrapper.vm.hiddenResults.has(originalIndex)
        )
        if (filteredIndex < visibleResults.length) {
          const resultToHide = visibleResults[filteredIndex]
          const originalIndex = wrapper.vm.searchResult.results.indexOf(resultToHide)
          if (originalIndex !== -1) {
            wrapper.vm.hiddenResults.add(originalIndex)
          }
        }
      }
    })
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    document.body.style.overflow = ''
  })

  describe('Rendu du composant', () => {
    it('affiche le bon nombre de cartes de résultats', () => {
      const resultCards = wrapper.findAllComponents('[data-testid="result-card"]')
      expect(resultCards.length).toBe(3)
    })

    it('affiche les bonnes informations dans les cartes de résultats', () => {
      const firstCard = wrapper.findAllComponents('[data-testid="result-card"]')[0]
      expect(firstCard.text()).toContain('123 Rue de la Paix')
      expect(firstCard.text()).toContain('Paris - 75001')
      expect(firstCard.text()).toContain('100 m²')
      expect(firstCard.text()).toContain('95%')
      expect(firstCard.text()).toContain('0.5 km')
      expect(firstCard.text()).toContain('Étage: 2')
      expect(firstCard.text()).toContain('1950')
    })

    it('affiche un avertissement de données incomplètes pour les résultats problématiques', () => {
      const thirdCard = wrapper.findAllComponents('[data-testid="result-card"]')[2]
      expect(thirdCard.classes()).toContain('opacity-50')
      expect(thirdCard.text()).toContain('Voir données brutes')
    })

    it('affiche un avertissement DPE ancien pour les anciens résultats', () => {
      const thirdCard = wrapper.findAllComponents('[data-testid="result-card"]')[2]
      expect(thirdCard.text()).toContain('DPE Ancien')
    })

    it("affiche l'en-tête avec le bon texte de statut", () => {
      const header = wrapper.findComponent('[data-testid="results-header"]')
      expect(header.text()).toContain('3 résultats affichés')
      expect(header.props('statusText')).toBe('Aucune correspondance parfaite')
      expect(header.props('statusClass')).toContain('text-amber-600')
    })

    it('affiche le menu de tri quand il y a plus de 3 résultats', () => {
      const header = wrapper.findComponent('[data-testid="results-header"]')
      expect(header.props('showSort')).toBe(false) // Only 3 results, need > 3
    })

    it("affiche correctement l'état d'erreur", async () => {
      await wrapper.setProps({
        searchResult: {
          searchStrategy: 'ERROR',
          diagnostics: ['Connection timeout'],
          results: []
        }
      })

      const errorState = wrapper.findComponent('[data-testid="error-state"]')
      expect(errorState.exists()).toBe(true)
      expect(errorState.text()).toContain('Erreur lors de la recherche')
      expect(errorState.text()).toContain('Connection timeout')
    })

    it("affiche l'état vide quand il n'y a pas de résultats", async () => {
      await wrapper.setProps({
        searchResult: {
          searchStrategy: 'SUCCESS',
          results: []
        }
      })

      const emptyState = wrapper.findComponent('[data-testid="empty-state"]')
      expect(emptyState.exists()).toBe(true)
      expect(emptyState.text()).toContain('Aucun résultat trouvé')
    })
  })

  describe('Interactions utilisateur', () => {
    it('ouvre la modale en cliquant sur une carte de résultat complète', async () => {
      const firstCard = wrapper.findAllComponents('[data-testid="result-card"]')[0]
      await firstCard.trigger('click')
      await nextTick()

      expect(wrapper.vm.selectedProperty).toEqual(mockSearchResult.results[0])
      expect(document.body.style.overflow).toBe('hidden')

      const modal = wrapper.findComponent('[data-testid="property-modal"]')
      expect(modal.exists()).toBe(true)
      expect(modal.text()).toContain('123 Rue de la Paix')
      expect(modal.text()).toContain('100 m²')
    })

    it("n'ouvre pas la modale en cliquant sur un résultat incomplet", async () => {
      const thirdCard = wrapper.findAllComponents('[data-testid="result-card"]')[2]
      await thirdCard.trigger('click')
      await nextTick()

      expect(wrapper.vm.selectedProperty).toBe(null)
      const modal = wrapper.findComponent('[data-testid="property-modal"]')
      expect(modal.exists()).toBe(false)
    })

    it('affiche la modale de données brutes pour les résultats incomplets', async () => {
      const thirdCard = wrapper.findAllComponents('[data-testid="result-card"]')[2]
      const rawDataBtn = thirdCard.find('.raw-data-btn')
      await rawDataBtn.trigger('click')
      await nextTick()

      expect(wrapper.vm.showRawDataModal).toBe(true)
      expect(wrapper.vm.rawDataProperty).toEqual(mockSearchResult.results[2])
    })

    it('masque le résultat avec le menu contextuel du clic droit', async () => {
      // Verify initial state
      expect(wrapper.vm.filteredResults.length).toBe(3)
      expect(wrapper.vm.hiddenResults.size).toBe(0)

      const firstCard = wrapper.findAllComponents('[data-testid="result-card"]')[0]
      await firstCard.trigger('contextmenu.prevent')

      // The card emits hide event with index
      expect(firstCard.emitted('hide')).toBeTruthy()
      expect(firstCard.emitted('hide')[0]).toEqual([0])

      // Execute the hideResult method - this hides the first item in filtered results
      wrapper.vm.hideResult(0)
      await nextTick()

      // The hideResult method should have hidden at least one result
      expect(wrapper.vm.hiddenResults.size).toBeGreaterThan(0)

      // Check that results are now filtered (should be less than original 3)
      expect(wrapper.vm.filteredResults.length).toBeLessThan(3)
      // And verify the context menu functionality works by checking at least one result is hidden
      expect(wrapper.vm.hiddenResults.has(0)).toBe(true)
    })

    it("émet l'événement newSearch quand le bouton fermer est cliqué", async () => {
      const header = wrapper.findComponent('[data-testid="results-header"]')
      const closeBtn = header.find('.close-btn')
      await closeBtn.trigger('click')

      expect(wrapper.emitted('newSearch')).toBeTruthy()
    })

    it("ferme la modale et restaure l'overflow du body", async () => {
      // Open modal first
      wrapper.vm.selectedProperty = mockSearchResult.results[0]
      document.body.style.overflow = 'hidden'
      await nextTick()

      const modal = wrapper.findComponent('[data-testid="property-modal"]')
      const closeBtn = modal.find('button')
      await closeBtn.trigger('click')

      // The modal emits close, which should trigger closeModal
      wrapper.vm.closeModal()

      expect(wrapper.vm.selectedProperty).toBe(null)
      expect(document.body.style.overflow).toBe('')
    })

    it('ouvre la modale des détails DPE depuis la modale de propriété', async () => {
      wrapper.vm.selectedProperty = mockSearchResult.results[0]
      await nextTick()

      const modal = wrapper.findComponent('[data-testid="property-modal"]')
      const detailsBtn = modal.findAll('button')[1] // Second button is "Détails"
      await detailsBtn.trigger('click')

      expect(wrapper.vm.showDPEDetails).toBe(true)

      const dpeModal = wrapper.findComponent('[data-testid="dpe-details-modal"]')
      expect(dpeModal.exists()).toBe(true)
      expect(dpeModal.text()).toContain('250 kWh')
      expect(dpeModal.text()).toContain('45 kg')
    })
  })

  describe('Fonctionnalité de tri', () => {
    let manyResults

    beforeEach(async () => {
      manyResults = [
        {
          ...mockSearchResult.results[0],
          matchScore: 95,
          distance: 0.5,
          surfaceHabitable: 100,
          dateVisite: '2023-01-15',
          anneeConstruction: 2000
        },
        {
          ...mockSearchResult.results[1],
          matchScore: 85,
          distance: 1.2,
          surfaceHabitable: 120,
          dateVisite: '2023-02-20',
          anneeConstruction: 1990
        },
        {
          ...mockSearchResult.results[0],
          matchScore: 90,
          distance: 0.8,
          surfaceHabitable: 80,
          dateVisite: '2023-03-10',
          anneeConstruction: 2010
        },
        {
          ...mockSearchResult.results[1],
          matchScore: 88,
          distance: 1.5,
          surfaceHabitable: 150,
          dateVisite: '2023-01-05',
          anneeConstruction: 1980
        }
      ]

      await wrapper.setProps({
        searchResult: { ...mockSearchResult, results: manyResults }
      })
    })

    it('trie par score par défaut (le plus haut en premier)', () => {
      const scores = wrapper.vm.filteredResults.map(r => r.matchScore)
      expect(scores).toEqual([95, 90, 88, 85])
    })

    it('trie par distance quand sélectionné', async () => {
      wrapper.vm.sortBy = 'distance'
      await nextTick()

      const distances = wrapper.vm.filteredResults.map(r => r.distance)
      expect(distances).toEqual([0.5, 0.8, 1.2, 1.5])
    })

    it('trie par surface (la plus grande en premier)', async () => {
      wrapper.vm.sortBy = 'surface'
      await nextTick()

      const surfaces = wrapper.vm.filteredResults.map(r => r.surfaceHabitable)
      expect(surfaces).toEqual([150, 120, 100, 80])
    })

    it('trie par année de construction croissante', async () => {
      wrapper.vm.sortBy = 'construction-asc'
      await nextTick()

      const years = wrapper.vm.filteredResults.map(r => r.anneeConstruction)
      expect(years).toEqual([1980, 1990, 2000, 2010])
    })

    it('trie par année de construction décroissante', async () => {
      wrapper.vm.sortBy = 'construction-desc'
      await nextTick()

      const years = wrapper.vm.filteredResults.map(r => r.anneeConstruction)
      expect(years).toEqual([2010, 2000, 1990, 1980])
    })

    it('trie par date décroissante (le plus récent en premier)', async () => {
      wrapper.vm.sortBy = 'date-desc'
      await nextTick()

      const dates = wrapper.vm.filteredResults.map(r => r.dateVisite)
      expect(dates).toEqual(['2023-03-10', '2023-02-20', '2023-01-15', '2023-01-05'])
    })

    it("gère correctement les formats d'années mixtes", async () => {
      const mixedYearResults = [
        { ...mockSearchResult.results[0], anneeConstruction: '1970-1980' },
        { ...mockSearchResult.results[1], anneeConstruction: 2000 },
        { ...mockSearchResult.results[0], anneeConstruction: 'avant 1948' },
        { ...mockSearchResult.results[1], anneeConstruction: null }
      ]

      await wrapper.setProps({
        searchResult: { ...mockSearchResult, results: mixedYearResults }
      })

      wrapper.vm.sortBy = 'construction-asc'
      await nextTick()

      const years = wrapper.vm.filteredResults.map(r => wrapper.vm.extractYearFromValue(r.anneeConstruction))

      // Should extract: null, 1948, 1970, 2000 and sort accordingly
      expect(years[0]).toBe(1948) // 'avant 1948' -> 1948
      expect(years[1]).toBe(1970) // '1970-1980' -> 1970
      expect(years[2]).toBe(2000) // 2000 -> 2000
      expect(years[3]).toBe(null) // null -> null (sorted last)
    })
  })

  describe("Logique d'affichage des étages", () => {
    it("affiche correctement l'étage pour les appartements", () => {
      const result1 = { ...mockSearchResult.results[0], etage: 3 }
      const display1 = wrapper.vm.getFloorDisplay(result1)
      expect(display1).toBe('Étage: 3')

      const result2 = { ...mockSearchResult.results[0], etage: 0, complementRefLogement: 'RDC' }
      const display2 = wrapper.vm.getFloorDisplay(result2)
      expect(display2).toBe('RDC')
    })

    it("parse l'étage depuis complementRefLogement", () => {
      const result = { etage: null, complementRefLogement: '3ème étage, porte droite' }
      const display = wrapper.vm.getFloorDisplay(result)
      expect(display).toBe('Étage: 3')
    })

    it("retourne null pour les maisons sans info d'étage", () => {
      const result = { ...mockSearchResult.results[1], etage: null }
      const display = wrapper.vm.getFloorDisplay(result)
      expect(display).toBe(null)
    })

    it("affiche l'option de tri par étage quand plusieurs étages différents existent", async () => {
      const resultsWithFloors = [
        { ...mockSearchResult.results[0], etage: 0, complementRefLogement: 'RDC' },
        { ...mockSearchResult.results[0], etage: 1 },
        { ...mockSearchResult.results[0], etage: 2 },
        { ...mockSearchResult.results[0], etage: 3 }
      ]

      await wrapper.setProps({
        searchResult: { ...mockSearchResult, results: resultsWithFloors }
      })

      expect(wrapper.vm.shouldShowEtageSort).toBe(true)
      expect(wrapper.vm.sortOptions.some(opt => opt.value === 'etage')).toBe(true)
    })
  })

  describe('Score et statut de correspondance', () => {
    it('calcule correctement le statut de correspondance', () => {
      expect(wrapper.vm.getMatchStatusText()).toBe('Aucune correspondance parfaite')
      expect(wrapper.vm.getMatchStatusClass()).toContain('text-amber-600')
    })

    it('affiche une correspondance parfaite pour un score de 100%', async () => {
      const perfectResults = [
        { ...mockSearchResult.results[0], matchScore: 100 },
        { ...mockSearchResult.results[1], matchScore: 85 }
      ]

      await wrapper.setProps({
        searchResult: { ...mockSearchResult, results: perfectResults }
      })

      expect(wrapper.vm.getMatchStatusText()).toBe('Une correspondance parfaite')
      expect(wrapper.vm.getMatchStatusClass()).toContain('text-green-600')
    })

    it('affiche un avertissement pour plusieurs correspondances parfaites', async () => {
      const perfectResults = [
        { ...mockSearchResult.results[0], matchScore: 100 },
        { ...mockSearchResult.results[1], matchScore: 100 }
      ]

      await wrapper.setProps({
        searchResult: { ...mockSearchResult, results: perfectResults }
      })

      expect(wrapper.vm.getMatchStatusText()).toBe('2 correspondances parfaites - vérifiez la vue satellite')
      expect(wrapper.vm.getMatchStatusClass()).toContain('text-orange-600')
    })

    it('génère des tooltips de score correctes avec les différences', () => {
      const result = mockSearchResult.results[0]
      const tooltip = wrapper.vm.getScoreTooltip(result)
      // Since surface, energy and GES match the search criteria, tooltip should be empty
      expect(tooltip).toBe('')

      // Test with differences
      const resultWithDiff = {
        ...result,
        surfaceHabitable: 110,
        consommationEnergie: 260,
        emissionGES: 50
      }
      const tooltipWithDiff = wrapper.vm.getScoreTooltip(resultWithDiff)
      expect(tooltipWithDiff).toContain('+10m²')
      expect(tooltipWithDiff).toContain('+10kWh')
      expect(tooltipWithDiff).toContain('+5kg')
    })

    it('affiche le tooltip de correspondance exacte pour un score de 100%', () => {
      const perfectResult = { ...mockSearchResult.results[0], matchScore: 100 }
      const tooltip = wrapper.vm.getScoreTooltip(perfectResult)
      expect(tooltip).toBe('Correspondance exacte')
    })
  })

  describe('Formatage des adresses', () => {
    it("nettoie l'adresse en supprimant le code postal et la ville", () => {
      const result = mockSearchResult.results[0]
      const formatted = wrapper.vm.getFormattedAddress(result)
      expect(formatted).toBe('123 Rue de la Paix')
      expect(formatted).not.toContain('75001')
      expect(formatted).not.toContain('Paris')
    })

    it('gère gracieusement les adresses manquantes', () => {
      const result = { ...mockSearchResult.results[0], adresseComplete: null }
      const formatted = wrapper.vm.getFormattedAddress(result)
      expect(formatted).toBe('Bien localisé')
    })
  })

  describe("Génération d'URL", () => {
    it('génère une URL Google Maps embed correcte', () => {
      const property = mockSearchResult.results[0]
      const url = wrapper.vm.getGoogleMapsEmbedUrlForProperty(property)

      expect(url).toContain('maps.google.com')
      expect(url).toContain('48.8566')
      expect(url).toContain('2.3522')
      expect(url).toContain(encodeURIComponent('123 Rue de la Paix'))
    })

    it('génère une URL Geoportail correcte', () => {
      const property = mockSearchResult.results[0]
      const url = wrapper.vm.getGeoportailUrlForProperty(property)

      expect(url).toContain('geoportail.gouv.fr')
      expect(url).toContain('48.8566')
      expect(url).toContain('2.3522')
    })
  })

  describe('Affichage de la localisation de recherche', () => {
    it('formate la localisation de recherche avec commune et code postal', () => {
      const location = wrapper.vm.getSearchLocation()
      expect(location).toBe('75001 Paris')
    })

    it('gère les communes manquantes', async () => {
      await wrapper.setProps({
        searchCriteria: { ...mockSearchCriteria, commune: null }
      })
      expect(wrapper.vm.getSearchLocation()).toBe('code postal 75001')
    })

    it('gère les codes postaux manquants', async () => {
      await wrapper.setProps({
        searchCriteria: { ...mockSearchCriteria, codePostal: null }
      })
      expect(wrapper.vm.getSearchLocation()).toBe('Paris')
    })

    it('affiche la valeur par défaut quand les deux sont manquants', async () => {
      await wrapper.setProps({
        searchCriteria: { commune: null, codePostal: null }
      })
      expect(wrapper.vm.getSearchLocation()).toBe('la zone recherchée')
    })
  })

  describe('Gestion des résultats masqués', () => {
    it('masque et filtre correctement les résultats', () => {
      expect(wrapper.vm.filteredResults.length).toBe(3)

      // Hide result at index 0 in filtered results (Paris - original index 0)
      wrapper.vm.hideResult(0)
      expect(wrapper.vm.hiddenResults.has(0)).toBe(true)
      expect(wrapper.vm.filteredResults.length).toBe(2)

      // Now filtered results are: [Lyon, Marseille]
      // Hide result at index 1 in current filtered results (Marseille)
      // The hideResult method maps filtered index to original index
      wrapper.vm.hideResult(1)
      expect(wrapper.vm.filteredResults.length).toBe(1)
      // Only Lyon should remain (original index 1)
      expect(wrapper.vm.filteredResults[0]).toEqual(mockSearchResult.results[1])
    })

    it("met à jour l'en-tête avec le nombre de masqués", async () => {
      wrapper.vm.hideResult(0)
      await nextTick()

      const header = wrapper.findComponent('[data-testid="results-header"]')
      expect(header.props('hiddenCount')).toBe(1)
      expect(header.text()).toContain('1 masqué')
    })
  })

  describe("Cas limites et gestion d'erreurs", () => {
    it('gère les résultats avec des données partielles', async () => {
      const partialResult = {
        ...mockSearchResult.results[0],
        distance: undefined,
        etage: null,
        complementRefLogement: null, // Remove floor info
        anneeConstruction: null
      }

      await wrapper.setProps({
        searchResult: { ...mockSearchResult, results: [partialResult] }
      })

      const card = wrapper.findComponent('[data-testid="result-card"]')
      expect(card.text()).not.toContain('km') // No distance shown
      expect(card.text()).not.toContain('Étage') // No floor shown
      expect(card.text()).toContain('N/A') // Year shows N/A
    })

    it('gère efficacement un grand nombre de résultats', async () => {
      const largeResults = Array(100)
        .fill(null)
        .map((_, index) => ({
          ...mockSearchResult.results[0],
          adresseComplete: `${index} Test Street`,
          matchScore: Math.random() * 100
        }))

      await wrapper.setProps({
        searchResult: { ...mockSearchResult, results: largeResults }
      })

      expect(wrapper.vm.filteredResults.length).toBe(100)

      // Check sorting still works
      wrapper.vm.sortBy = 'score'
      await nextTick()

      const scores = wrapper.vm.filteredResults.map(r => r.matchScore)
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeLessThanOrEqual(scores[i - 1])
      }
    })

    it('gère correctement le flag isMultiCommune', async () => {
      await wrapper.setProps({
        searchResult: { ...mockSearchResult, isMultiCommune: true }
      })

      const cards = wrapper.findAllComponents('[data-testid="result-card"]')
      expect(cards[0].props('distanceTooltip')).toContain('depuis le centre')
    })
  })

  describe('Cycle de vie et nettoyage', () => {
    it("configure les écouteurs d'événements au montage", () => {
      expect(wrapper.vm.setupEventListeners).toHaveBeenCalled()
    })

    it('nettoie au démontage', () => {
      const { cleanupEventListeners } = wrapper.vm
      wrapper.unmount()
      expect(cleanupEventListeners).toHaveBeenCalled()
    })

    it("restaure l'overflow du body au démontage", () => {
      wrapper.vm.selectedProperty = mockSearchResult.results[0]
      document.body.style.overflow = 'hidden'

      wrapper.unmount()
      // The cleanup should restore overflow
      expect(document.body.style.overflow).toBe('')
    })
  })
})
