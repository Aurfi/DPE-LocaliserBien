<template>
  <div v-if="results" class="mt-8 max-w-6xl mx-auto">
    <!-- Header -->
    <ResultsHeader
      :title="`${filteredResults.length} résultat${filteredResults.length > 1 ? 's' : ''} affiché${filteredResults.length > 1 ? 's' : ''}`"
      :hiddenCount="hiddenResults.size"
      :subtitle="`Autour de ${results.searchAddress}`"
      :subtitleExtra="`(rayon: ${results.searchRadius} km)`"
      :showCloseButton="true"
      :showSort="filteredResults.length > 3"
      v-model:sortBy="sortBy"
      :sortOptions="sortOptions"
      @close="$emit('clear-results')"
    />

    <!-- Empty state -->
    <EmptyState
      v-if="filteredResults.length === 0"
      :icon="OctagonX"
      title="Aucun résultat trouvé"
      description="Impossible de trouver un DPE correspondant à ces informations."
    />

    <!-- Results grid -->
    <div v-if="filteredResults.length > 0" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <ResultCard
        v-for="(dpe, index) in filteredResults"
        :key="dpe.numero_dpe"
        :result="dpe"
        :index="index"
        :dateDisplay="formatDate(dpe.date_etablissement_dpe)"
        :dateTooltip="formatFullDate(dpe.date_etablissement_dpe)"
        :distance="dpe._distance"
        :propertyType="getPropertyType(dpe)"
        :address="getAddressWithoutCityAndPostcode(dpe)"
        :location="`${dpe.nom_commune_ban || dpe.nom_commune_brut || 'Localisation inconnue'} - ${dpe.code_postal_ban || dpe.code_postal_brut || ''}`"
        :surface="Math.round(dpe.surfaceHabitable)"
        :floor="getFloorDisplay(dpe)"
        :yearBuilt="formatYearDisplay(dpe.anneeConstruction)"
        :hasIncompleteData="false"
        :isLegacy="false"
        @click="showDetails"
        @hide="hideResult"
      />
    </div>

    <!-- Modals -->
    <PropertyModal
      v-if="selectedProperty"
      :property="selectedProperty"
      :formattedAddress="selectedProperty.adresse_ban || selectedProperty.adresse_brut || getFormattedAddress(selectedProperty)"
      :commune="selectedProperty.nom_commune_ban || selectedProperty.nom_commune_brut"
      :surface="Math.round(selectedProperty.surfaceHabitable || selectedProperty.surface_habitable_logement || selectedProperty.surface_habitable || 0)"
      :energyClass="selectedProperty.etiquette_dpe"
      :mapUrl="selectedProperty._geopoint ? getGoogleMapsEmbedUrlForDPE(selectedProperty) : null"
      :geoportailUrl="getGeoportailUrl(getLatitudeFromGeopoint(selectedProperty._geopoint), getLongitudeFromGeopoint(selectedProperty._geopoint))"
      :propertyType="selectedProperty.typeBien || selectedProperty.type_batiment"
      :floor="selectedProperty.typeBien && selectedProperty.typeBien.toLowerCase().includes('appartement') && selectedProperty.etage ? selectedProperty.etage : null"
      :location="selectedProperty.complementRefLogement"
      :yearBuilt="selectedProperty.anneeConstruction ? String(selectedProperty.anneeConstruction) : null"
      :numberOfLevels="selectedProperty.nombreNiveaux"
      :ceilingHeight="selectedProperty.hauteurSousPlafond"
      :diagnosisDate="selectedProperty.date_visite_diagnostiqueur ? formatFullDate(selectedProperty.date_visite_diagnostiqueur) : null"
      :energyConsumption="Math.round(selectedProperty.consommationEnergie || selectedProperty.conso_5_usages_par_m2_ep || selectedProperty.consommation_energie || 0) || null"
      :gesEmissions="Math.round(selectedProperty.emissionGES || selectedProperty.emission_ges_5_usages_par_m2 || selectedProperty.estimation_ges || 0) || null"
      :departmentAverages="departmentAverages"
      @close="closeModal()"
      @show-details="showDPEDetails = true"
    />

    <DPEDetailsModal
      :show="showDPEDetails && !!selectedProperty"
      :property="selectedProperty || {}"
      :departmentAverages="departmentAverages"
      @close="showDPEDetails = false"
    />

    <ScrollToTop />
  </div>
</template>

<script>
import { OctagonX } from 'lucide-vue-next'
import { useResultsHandling } from '../../../composables/useResultsHandling'
import {
  extractYearFromValue,
  formatYearDisplay,
  getFloorDisplay as getFloorDisplayUtil
} from '../../../utils/dpeFormatters'
import {
  getGeoportailUrl,
  getGoogleMapsEmbedUrl,
  getLatitudeFromGeopoint,
  getLongitudeFromGeopoint
} from '../../../utils/mapUtils'
import ScrollToTop from '../../base/ScrollToTop.vue'
import EmptyState from '../../shared/EmptyState.vue'
import ResultCard from '../../shared/ResultCard.vue'
import ResultsHeader from '../../shared/ResultsHeader.vue'
import PropertyModal from '../search/PropertyModal.vue'
import DPEDetailsModal from './DPEDetailsModal.vue'

export default {
  name: 'ResultatsDpeRecents',
  components: {
    PropertyModal,
    DPEDetailsModal,
    ScrollToTop,
    EmptyState,
    ResultCard,
    ResultsHeader
  },
  props: {
    results: {
      type: Object,
      default: null
    },
    searchCriteria: {
      type: Object,
      default: null
    },
    departmentAverages: {
      type: Object,
      default: null
    }
  },
  emits: ['clear-results'],
  setup() {
    const {
      selectedProperty,
      showDPEDetails,
      hiddenResults,
      showDetails,
      closeModal,
      setupEventListeners,
      cleanupEventListeners
    } = useResultsHandling()

    return {
      OctagonX,
      selectedProperty,
      showDPEDetails,
      hiddenResults,
      showDetails,
      closeModal,
      setupEventListeners,
      cleanupEventListeners
    }
  },
  data() {
    return {
      sortBy: 'distance' // Default sort by distance for recent searches
    }
  },
  computed: {
    sortOptions() {
      const options = [
        { value: 'distance', label: 'Distance' },
        { value: 'surface', label: 'Surface' },
        { value: 'date-desc', label: 'DPE récent' },
        { value: 'date-asc', label: 'DPE ancien' },
        { value: 'construction-desc', label: 'Construction récente' },
        { value: 'construction-asc', label: 'Construction ancienne' }
      ]

      if (this.shouldShowEtageSort) {
        options.splice(2, 0, { value: 'etage', label: 'Étage' })
      }

      return options
    },

    shouldShowEtageSort() {
      if (!this.results?.results || this.results.results.length < 3) return false
      const etages = this.results.results
        .map(r => {
          const display = this.getFloorDisplay(r)
          if (!display) return null
          if (display === 'RDC') return 0
          const match = display.match(/\d+/)
          return match ? parseInt(match[0], 10) : null
        })
        .filter(e => e !== null)
      if (etages.length < 3) return false
      const uniqueEtages = new Set(etages)
      return uniqueEtages.size > 1
    },

    filteredResults() {
      if (!this.results?.results) return []

      let results = this.results.results.filter((_, index) => !this.hiddenResults.has(index))

      // Apply sorting
      if (this.sortBy === 'surface') {
        const targetSurface = this.searchCriteria?.surface ? parseFloat(this.searchCriteria.surface) : null
        if (targetSurface) {
          results = [...results].sort((a, b) => {
            const surfA = a.surfaceHabitable || 0
            const surfB = b.surfaceHabitable || 0
            const diffA = Math.abs(surfA - targetSurface)
            const diffB = Math.abs(surfB - targetSurface)
            return diffA - diffB
          })
        } else {
          results = [...results].sort((a, b) => (b.surfaceHabitable || 0) - (a.surfaceHabitable || 0))
        }
      } else if (this.sortBy === 'etage') {
        results = [...results].sort((a, b) => {
          const getFloorNumber = result => {
            const display = this.getFloorDisplay(result)
            if (!display) return 999
            if (display === 'RDC') return 0
            const match = display.match(/\d+/)
            return match ? parseInt(match[0], 10) : 999
          }
          const floorA = getFloorNumber(a)
          const floorB = getFloorNumber(b)
          if (floorA === floorB) {
            const distA = a._distance !== undefined ? a._distance : Infinity
            const distB = b._distance !== undefined ? b._distance : Infinity
            return distA - distB
          }
          return floorA - floorB
        })
      } else if (this.sortBy === 'construction-asc') {
        results = [...results].sort((a, b) => {
          const yearA = extractYearFromValue(a.anneeConstruction) || 9999
          const yearB = extractYearFromValue(b.anneeConstruction) || 9999
          return yearA - yearB
        })
      } else if (this.sortBy === 'construction-desc') {
        results = [...results].sort((a, b) => {
          const yearA = extractYearFromValue(a.anneeConstruction) || 0
          const yearB = extractYearFromValue(b.anneeConstruction) || 0
          return yearB - yearA
        })
      } else if (this.sortBy === 'date-desc') {
        results = [...results].sort((a, b) => {
          const dateA = a.date_etablissement_dpe ? new Date(a.date_etablissement_dpe).getTime() : 0
          const dateB = b.date_etablissement_dpe ? new Date(b.date_etablissement_dpe).getTime() : 0
          return dateB - dateA
        })
      } else if (this.sortBy === 'date-asc') {
        results = [...results].sort((a, b) => {
          const dateA = a.date_etablissement_dpe ? new Date(a.date_etablissement_dpe).getTime() : 0
          const dateB = b.date_etablissement_dpe ? new Date(b.date_etablissement_dpe).getTime() : 0
          return dateA - dateB
        })
      } else {
        // Default: sort by distance with exact match detection
        results = [...results].sort((a, b) => {
          const normalizeAddr = addr => (addr || '').toLowerCase().replace(/\s+/g, ' ').trim()
          const searchAddr = normalizeAddr(this.results?.fullSearchAddress || this.results?.searchAddress || '')

          const aMatchesSearch = normalizeAddr(a.adresse_ban || a.adresseComplete) === searchAddr
          const bMatchesSearch = normalizeAddr(b.adresse_ban || b.adresseComplete) === searchAddr

          const aIsExact = a._isExactMatch || aMatchesSearch
          const bIsExact = b._isExactMatch || bMatchesSearch

          if (aIsExact && !bIsExact) return -1
          if (!aIsExact && bIsExact) return 1

          const distA = a._distance !== undefined ? a._distance : a.distance !== undefined ? a.distance : Infinity
          const distB = b._distance !== undefined ? b._distance : b.distance !== undefined ? b.distance : Infinity
          return distA - distB
        })
      }

      return results
    }
  },
  mounted() {
    this.setupEventListeners()
  },
  unmounted() {
    this.cleanupEventListeners()
  },
  methods: {
    formatYearDisplay,

    hideResult(index) {
      if (index !== null && index >= 0) {
        const originalIndex = this.results.results.findIndex((_result, i) => {
          let count = 0
          for (let j = 0; j <= i; j++) {
            if (!this.hiddenResults.has(j)) {
              if (count === index) return true
              count++
            }
          }
          return false
        })
        if (originalIndex !== -1) {
          this.hiddenResults.add(originalIndex)
        }
      }
    },

    formatDate(dateStr) {
      const date = new Date(dateStr)
      const now = new Date()
      const diffTime = Math.abs(now - date)
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      if (diffDays === 0) return "Aujourd'hui"
      if (diffDays === 1) return 'Hier'
      if (diffDays < 7) return `Il y a ${diffDays} jours`
      if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} semaines`

      const totalMonths = Math.floor(diffDays / 30)
      if (totalMonths >= 24) {
        const years = Math.floor(totalMonths / 12)
        const months = totalMonths % 12
        if (months === 0) {
          return `Il y a ${years} an${years > 1 ? 's' : ''}`
        }
        return `Il y a ${years} an${years > 1 ? 's' : ''} et ${months} mois`
      }

      if (totalMonths > 0) {
        return `Il y a ${totalMonths} mois`
      }

      return date.toLocaleDateString('fr-FR')
    },

    formatFullDate(dateStr) {
      return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    },

    getFormattedAddress(dpe) {
      let address = ''
      if (dpe.adresse_ban && /^\d/.test(dpe.adresse_ban.trim())) {
        address = dpe.adresse_ban
      } else if (dpe.adresse_ban && dpe.adresse_brut && /^\d+/.test(dpe.adresse_brut.trim())) {
        const streetNumber = dpe.adresse_brut.match(/^\d+[a-z]?\s*/i)[0].trim()
        address = `${streetNumber} ${dpe.adresse_ban}`
      } else {
        address = dpe.adresse_ban || dpe.adresse_brut || 'Adresse non disponible'
      }
      return address.replace(/â€™/g, "'")
    },

    getAddressWithoutCityAndPostcode(dpe) {
      let address = this.getFormattedAddress(dpe)
      const cityName = dpe.nom_commune_ban || dpe.nom_commune_brut
      const postcode = dpe.code_postal_ban || dpe.code_postal_brut

      if (postcode) {
        address = address.replace(new RegExp(`\\b${postcode}\\b`, 'g'), '').trim()
      }

      if (cityName) {
        const cityRegex = new RegExp(`,?\\s*${cityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*,?`, 'gi')
        address = address.replace(cityRegex, ' ').trim()
      }

      address = address.replace(/,\s*,/g, ',').replace(/,\s*$/, '').trim()
      return address
    },

    getPropertyType(dpe) {
      if (dpe.type_batiment) {
        const type = dpe.type_batiment.toLowerCase()
        if (type.includes('appartement')) return 'appartement'
        if (type.includes('maison')) return 'maison'
      }
      return null
    },

    getFloorDisplay(result) {
      // Adapter for recent DPE data structure
      const adapted = {
        etage: result.etage,
        complementRefLogement: result.complementRefLogement,
        typeBien: result.type_batiment,
        nombreNiveaux: result.nombreNiveaux
      }
      return getFloorDisplayUtil(adapted)
    },

    getGoogleMapsEmbedUrlForDPE(dpe) {
      if (!dpe) return ''

      // Get both address and coordinates
      const adresse = dpe.adresse_ban || dpe.adresse_brut
      let lat = null
      let lon = null

      if (dpe._geopoint) {
        lat = getLatitudeFromGeopoint(dpe._geopoint)
        lon = getLongitudeFromGeopoint(dpe._geopoint)
      }

      // Pass both coordinates and address for best results
      // Coordinates ensure accurate pin placement, address provides context
      return getGoogleMapsEmbedUrl(lat, lon, adresse, 19)
    },

    getLatitudeFromGeopoint,
    getLongitudeFromGeopoint,
    getGeoportailUrl
  }
}
</script>

<style scoped>
/* Animations pour les résultats */
.grid > div {
  animation: fadeInUp 0.6s ease-out;
}

.grid > div:nth-child(2) {
  animation-delay: 0.1s;
}

.grid > div:nth-child(3) {
  animation-delay: 0.2s;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>