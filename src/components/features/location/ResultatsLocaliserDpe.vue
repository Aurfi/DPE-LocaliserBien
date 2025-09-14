<template>
  <div class="max-w-7xl mx-auto px-4 py-6">
    <!-- Error state -->
    <ErrorState
      v-if="searchResult.searchStrategy === 'ERROR'"
      title="Erreur lors de la recherche"
      :message="searchResult.diagnostics && searchResult.diagnostics[0] ? searchResult.diagnostics[0] : 'Une erreur est survenue lors de la recherche. Veuillez réessayer.'"
      :action="{ label: 'Nouvelle recherche', handler: () => $emit('newSearch') }"
    />

    <!-- Header -->
    <ResultsHeader
      v-if="searchResult.searchStrategy !== 'ERROR'"
      :title="`${filteredResults.length} résultat${filteredResults.length > 1 ? 's' : ''} affiché${filteredResults.length > 1 ? 's' : ''}`"
      :hiddenCount="hiddenResults.size"
      :statusText="getMatchStatusText()"
      :statusClass="getMatchStatusClass()"
      :subtitle="`Autour de ${getSearchLocation()}${searchCriteria?.distance ? ` (rayon: ${searchCriteria.distance} km)` : ''}`"
      :showCloseButton="true"
      :showSort="filteredResults.length > 3"
      v-model:sortBy="sortBy"
      :sortOptions="sortOptions"
      @close="$emit('newSearch')"
    />

    <!-- Empty state -->
    <EmptyState
      v-if="filteredResults.length === 0 && searchResult.searchStrategy !== 'ERROR'"
      :icon="OctagonX"
      title="Aucun résultat trouvé"
      description="Impossible de trouver un DPE correspondant à ces informations."
    />

    <!-- Results grid -->
    <div v-if="searchResult.searchStrategy !== 'ERROR' && filteredResults.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      <ResultCard
        v-for="(result, index) in filteredResults"
        :key="index"
        :result="result"
        :index="index"
        :dateDisplay="result.dateVisite ? `il y a ${getDaysAgo(result.dateVisite)}` : null"
        :dateTooltip="result.dateVisite ? formatDate(result.dateVisite) : null"
        :distance="result.distance"
        :distanceTooltip="result.distance !== undefined ? `Distance estimée depuis ${searchResult?.isMultiCommune ? 'le centre' : 'la mairie'}` : null"
        :propertyType="getPropertyType(result)"
        :score="result.matchScore"
        :scoreTooltip="getScoreTooltip(result)"
        :address="getFormattedAddress(result)"
        :location="`${result.communeDisplay || result.commune || 'Localisation inconnue'} - ${result.codePostalDisplay || result.codePostal || result.codePostalADEME || ''}`"
        :surface="result.surfaceHabitable"
        :floor="getFloorDisplay(result)"
        :yearBuilt="formatYearDisplay(result.anneeConstruction)"
        :hasIncompleteData="result.hasIncompleteData"
        :isLegacy="result.isLegacyData"
        @click="showDetails"
        @hide="hideResult"
        @show-raw-data="showRawDataForResult"
      />
    </div>

    <!-- Modals -->
    <PropertyModal
      v-if="selectedProperty"
      :property="selectedProperty"
      :formattedAddress="selectedProperty.adresseComplete || getFormattedAddress(selectedProperty)"
      :commune="selectedProperty.communeDisplay || selectedProperty.commune"
      :surface="selectedProperty.surfaceHabitable"
      :matchScore="selectedProperty.matchScore"
      :energyClass="selectedProperty.classeDPE"
      :mapUrl="getGoogleMapsEmbedUrlForProperty(selectedProperty)"
      :geoportailUrl="getGeoportailUrlForProperty(selectedProperty)"
      :propertyType="selectedProperty.typeBien === 'appartement' ? 'Appartement' : selectedProperty.typeBien === 'maison' ? 'Maison' : selectedProperty.typeBien"
      :floor="selectedProperty.typeBien === 'appartement' && selectedProperty.etage ? selectedProperty.etage : null"
      :yearBuilt="selectedProperty.anneeConstruction ? String(selectedProperty.anneeConstruction) : null"
      :location="selectedProperty.complementRefLogement"
      :numberOfLevels="selectedProperty.nombreNiveaux"
      :ceilingHeight="selectedProperty.hauteurSousPlafond"
      :diagnosisDate="selectedProperty.dateVisite ? formatDate(selectedProperty.dateVisite) : null"
      :energyConsumption="selectedProperty.consommationEnergie"
      :gesEmissions="selectedProperty.emissionGES"
      :departmentAverages="departmentAverages"
      @close="closeModal()"
      @show-details="showDPEDetails = true"
    />

    <DPEDetailsModal
      :show="showDPEDetails"
      :property="selectedProperty"
      :departmentAverages="departmentAverages"
      @close="showDPEDetails = false"
    />

    <DonneesBrutesModal
      :show="showRawDataModal"
      :dpeData="rawDataProperty"
      @close="showRawDataModal = false"
    />

    <ScrollToTop />
  </div>
</template>

<script>
import { OctagonX } from 'lucide-vue-next'
import { useResultsHandling } from '../../../composables/useResultsHandling'
import {
  cleanAddress,
  extractYearFromValue,
  formatDate,
  formatYearDisplay,
  getDaysAgo,
  getFloorDisplay,
  getPropertyType
} from '../../../utils/dpeFormatters'
import { getGeoportailUrl, getGoogleMapsEmbedUrl } from '../../../utils/mapUtils'
import ScrollToTop from '../../base/ScrollToTop.vue'
import ErrorState from '../../results/ErrorState.vue'
import EmptyState from '../../shared/EmptyState.vue'
import ResultCard from '../../shared/ResultCard.vue'
import ResultsHeader from '../../shared/ResultsHeader.vue'
import DonneesBrutesModal from '../dpe/DonneesBrutesModal.vue'
import DPEDetailsModal from '../dpe/DPEDetailsModal.vue'
import PropertyModal from '../search/PropertyModal.vue'

export default {
  name: 'ResultatsLocaliserDpe',
  components: {
    DonneesBrutesModal,
    PropertyModal,
    DPEDetailsModal,
    ScrollToTop,
    ErrorState,
    EmptyState,
    ResultCard,
    ResultsHeader
  },
  props: {
    searchResult: {
      type: Object,
      required: true
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
  emits: ['newSearch'],
  setup() {
    const {
      selectedProperty,
      showDPEDetails,
      showRawDataModal,
      rawDataProperty,
      hiddenResults,
      showDetails,
      closeModal,
      showRawDataForResult,
      setupEventListeners,
      cleanupEventListeners
    } = useResultsHandling()

    return {
      OctagonX,
      selectedProperty,
      showDPEDetails,
      showRawDataModal,
      rawDataProperty,
      hiddenResults,
      showDetails,
      closeModal,
      showRawDataForResult,
      setupEventListeners,
      cleanupEventListeners
    }
  },
  data() {
    return {
      sortBy: 'score'
    }
  },
  computed: {
    sortOptions() {
      const options = [
        { value: 'score', label: 'Score' },
        { value: 'surface', label: 'Surface' },
        { value: 'date-desc', label: 'DPE récent' },
        { value: 'date-asc', label: 'DPE ancien' },
        { value: 'construction-desc', label: 'Construction récente' },
        { value: 'construction-asc', label: 'Construction ancienne' }
      ]

      if (this.hasDistanceData) {
        options.splice(1, 0, { value: 'distance', label: 'Distance' })
      }

      if (this.shouldShowEtageSort) {
        options.splice(3, 0, { value: 'etage', label: 'Étage' })
      }

      return options
    },

    filteredResults() {
      if (!this.searchResult?.results) return []

      let results = this.searchResult.results.filter((_, index) => !this.hiddenResults.has(index))

      // Apply sorting
      if (this.sortBy === 'distance' && this.hasDistanceData) {
        results = [...results].sort((a, b) => {
          const distA = a.distance !== undefined ? a.distance : Infinity
          const distB = b.distance !== undefined ? b.distance : Infinity
          return distA - distB
        })
      } else if (this.sortBy === 'surface') {
        results = [...results].sort((a, b) => (b.surfaceHabitable || 0) - (a.surfaceHabitable || 0))
      } else if (this.sortBy === 'etage') {
        results = [...results].sort((a, b) => {
          const getFloorNumber = result => {
            const display = this.getFloorDisplay(result)
            if (!display) return 999
            if (display === 'RDC') return 0
            const match = display.match(/\d+/)
            return match ? parseInt(match[0], 10) : 999
          }
          return getFloorNumber(a) - getFloorNumber(b)
        })
      } else if (this.sortBy === 'construction-asc') {
        results = [...results].sort((a, b) => {
          const yearA = this.extractYearFromValue(a.anneeConstruction) || 9999
          const yearB = this.extractYearFromValue(b.anneeConstruction) || 9999
          return yearA - yearB
        })
      } else if (this.sortBy === 'construction-desc') {
        results = [...results].sort((a, b) => {
          const yearA = this.extractYearFromValue(a.anneeConstruction) || 0
          const yearB = this.extractYearFromValue(b.anneeConstruction) || 0
          return yearB - yearA
        })
      } else if (this.sortBy === 'date-desc') {
        results = [...results].sort((a, b) => {
          const dateA = a.dateVisite ? new Date(a.dateVisite).getTime() : 0
          const dateB = b.dateVisite ? new Date(b.dateVisite).getTime() : 0
          return dateB - dateA
        })
      } else if (this.sortBy === 'date-asc') {
        results = [...results].sort((a, b) => {
          const dateA = a.dateVisite ? new Date(a.dateVisite).getTime() : 0
          const dateB = b.dateVisite ? new Date(b.dateVisite).getTime() : 0
          return dateA - dateB
        })
      } else {
        // Default: sort by score
        results = [...results].sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
      }

      return results
    },

    hasDistanceData() {
      return this.searchResult?.results?.some(r => r.distance !== undefined)
    },

    shouldShowEtageSort() {
      if (!this.searchResult?.results || this.searchResult.results.length < 3) return false
      const etages = this.searchResult.results
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
    }
  },
  mounted() {
    this.setupEventListeners()
  },
  unmounted() {
    this.cleanupEventListeners()
  },
  methods: {
    // Import formatting functions from utils
    extractYearFromValue,
    formatYearDisplay,
    formatDate,
    getDaysAgo,
    getFloorDisplay,
    getPropertyType,

    getMatchStatusText() {
      if (!this.searchResult?.results?.length) return ''
      const perfectMatches = this.searchResult.results.filter(r => r.matchScore === 100).length
      if (perfectMatches === 0) {
        return 'Aucune correspondance parfaite'
      } else if (perfectMatches === 1) {
        return 'Une correspondance parfaite'
      } else {
        return `${perfectMatches} correspondances parfaites - vérifiez la vue satellite`
      }
    },

    getMatchStatusClass() {
      if (!this.searchResult?.results?.length) return 'text-gray-500 dark:text-gray-400'
      const perfectMatches = this.searchResult.results.filter(r => r.matchScore === 100).length
      if (perfectMatches === 0) {
        return 'text-amber-600 dark:text-amber-400 font-medium'
      } else if (perfectMatches === 1) {
        return 'text-green-600 dark:text-green-400 font-medium'
      } else {
        return 'text-orange-600 dark:text-orange-400 font-medium'
      }
    },

    getFormattedAddress(result) {
      return cleanAddress(result.adresseComplete, result.communeADEME)
    },

    hideResult(index) {
      if (index !== null && index >= 0) {
        const originalIndex = this.searchResult.results.findIndex((_result, i) => {
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

    getSearchLocation() {
      if (this.searchCriteria?.commune && this.searchCriteria?.codePostal) {
        return `${this.searchCriteria.codePostal} ${this.searchCriteria.commune}`
      }
      if (this.searchCriteria?.commune) {
        return this.searchCriteria.commune
      }
      if (this.searchCriteria?.codePostal) {
        return `code postal ${this.searchCriteria.codePostal}`
      }
      return 'la zone recherchée'
    },

    getGoogleMapsEmbedUrlForProperty(property) {
      if (!property) return ''

      // Get both address and coordinates
      const adresse = property.adresseComplete || property.rawData?.adresse_ban || property.rawData?.geo_adresse
      const lat = property.latitude
      const lon = property.longitude

      // Pass both coordinates and address for best results
      // Coordinates ensure accurate pin placement, address provides context
      return getGoogleMapsEmbedUrl(lat, lon, adresse)
    },

    getGeoportailUrlForProperty(property) {
      if (!property) return null
      return getGeoportailUrl(property.latitude, property.longitude)
    },

    getScoreTooltip(result) {
      if (!this.searchCriteria) return ''
      if (result.matchScore && Math.round(result.matchScore) === 100) {
        return 'Correspondance exacte'
      }
      const diffs = []
      const parseValue = value => {
        if (!value) return null
        const strValue = value.toString().trim()
        if (strValue.startsWith('<') || strValue.startsWith('>')) {
          return parseInt(strValue.substring(1), 10)
        }
        return parseInt(strValue, 10)
      }

      if (this.searchCriteria.surfaceHabitable && result.surfaceHabitable) {
        const searchSurface = parseValue(this.searchCriteria.surfaceHabitable)
        if (searchSurface) {
          const diff = Math.round(result.surfaceHabitable - searchSurface)
          if (Math.abs(diff) > 0) {
            const sign = diff > 0 ? '+' : ''
            diffs.push(`${sign}${diff}m²`)
          }
        }
      }

      if (this.searchCriteria.consommationEnergie && result.consommationEnergie) {
        const searchConso = parseValue(this.searchCriteria.consommationEnergie)
        if (searchConso) {
          const diff = Math.round(result.consommationEnergie - searchConso)
          if (diff !== 0) {
            const sign = diff > 0 ? '+' : ''
            diffs.push(`${sign}${diff}kWh`)
          }
        }
      }

      if (this.searchCriteria.emissionGES && result.emissionGES) {
        const searchGES = parseValue(this.searchCriteria.emissionGES)
        if (searchGES) {
          const diff = Math.round(result.emissionGES - searchGES)
          if (diff !== 0) {
            const sign = diff > 0 ? '+' : ''
            diffs.push(`${sign}${diff}kg`)
          }
        }
      }

      return diffs.join(' ')
    }
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