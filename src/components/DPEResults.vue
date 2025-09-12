<template>
  <div class="max-w-7xl mx-auto px-4 py-6">
    <!-- En-tête des résultats -->
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm px-5 py-4 mb-6">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div class="flex-1">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {{ filteredResults.length }} résultat{{ filteredResults.length > 1 ? 's' : '' }} affiché{{ filteredResults.length > 1 ? 's' : '' }} 
            <span v-if="hiddenResults.size > 0" class="text-sm text-gray-500 dark:text-gray-400">({{ hiddenResults.size }} masqué{{ hiddenResults.size > 1 ? 's' : '' }})</span>
          </h2>
          <p class="text-sm mt-1" :class="getMatchStatusClass()">
            {{ getMatchStatusText() }}
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Autour de {{ getSearchLocation() }}
            <span v-if="searchCriteria?.distance" class="text-gray-400 dark:text-gray-500"> (rayon: {{ searchCriteria.distance }} km)</span>
          </p>
        </div>
        <div class="flex items-center gap-3">
          <!-- Sorting dropdown - only show if more than 3 results -->
          <div v-if="filteredResults.length > 3" class="relative">
            <select 
              v-model="sortBy"
              @change="sortResults"
              class="appearance-none bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-sm rounded-lg px-3 py-2 pr-8 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors cursor-pointer"
            >
              <option value="score">Trier par score</option>
              <option value="distance" v-if="hasDistanceData">Trier par distance</option>
              <option value="surface">Trier par surface</option>
              <option value="date-desc">Trier du plus récent au plus ancien</option>
              <option value="date-asc">Trier du plus ancien au plus récent</option>
            </select>
            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500 dark:text-gray-400">
              <ChevronDown class="w-4 h-4" />
            </div>
          </div>
          <button 
            @click="$emit('newSearch')"
            class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title="Fermer"
          >
            <X class="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>

    <!-- Message si aucun résultat -->
    <div v-if="filteredResults.length === 0" class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-8 text-center">
      <div class="mb-4">
        <div class="bg-gray-100 dark:bg-gray-700 rounded-full p-4 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
          <Search class="w-10 h-10 text-gray-500 dark:text-gray-400" />
        </div>
        <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Aucun résultat trouvé</h3>
        <p class="text-gray-600 dark:text-gray-400">
          Impossible de localiser ce bien avec ces informations.
        </p>
      </div>
    </div>

    <!-- Context Menu -->
    <div 
      v-if="contextMenu.show"
      class="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[120px]"
      :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
    >
      <button
        @click="hideResult(contextMenu.index)"
        class="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center gap-2"
      >
        <Trash2 class="w-4 h-4" />
        Masquer
      </button>
    </div>

    <!-- Grille des résultats -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      <div 
        v-for="(result, index) in filteredResults" 
        :key="index"
        class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all duration-200 flex flex-col h-full"
        :class="{ 'cursor-pointer': !result.hasIncompleteData, 'cursor-not-allowed opacity-90': result.hasIncompleteData }"
        @click="!result.hasIncompleteData && showDetails(result)"
        @contextmenu.prevent="showContextMenu($event, index)"
      >
        <div class="p-5 flex flex-col h-full">
          <!-- Date, distance et score -->
          <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-3">
            <div class="flex items-center gap-1 relative inline-block group">
              <Calendar class="w-3.5 h-3.5" />
              <span v-if="result.dateVisite">il y a {{ getDaysAgo(result.dateVisite) }}</span>
              <!-- Date tooltip -->
              <div v-if="result.dateVisite" class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-10 backdrop-blur-md shadow-lg bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                {{ formatDate(result.dateVisite) }}
              </div>
            </div>
            <div class="flex items-center gap-3">
              <div v-if="result.distance !== undefined" class="relative inline-block group">
                <span class="text-gray-600 dark:text-gray-400 text-sm">{{ result.distance.toFixed(1) }} km</span>
                <!-- Distance tooltip -->
                <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-10 backdrop-blur-md shadow-lg bg-gray-500/20 text-gray-700 dark:text-gray-300 border border-gray-500/30">
                  Distance estimée depuis {{ searchResult?.isMultiCommune ? 'le centre' : 'la mairie' }}
                </div>
              </div>
              <!-- Icône du type de bien -->
              <Home v-if="getAddressType(result) === 'maison'" class="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <Building2 v-else-if="getAddressType(result) === 'appartement'" class="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <Home v-else class="w-4 h-4 text-gray-300 dark:text-gray-600" />
              <!-- Score de correspondance -->
              <div class="relative inline-block group">
                <span 
                  :class="getScoreBadgeClass(result.matchScore)" 
                  class="inline-block px-2 py-0.5 rounded text-xs font-bold"
                >
                  {{ isNaN(result.matchScore) ? 0 : Math.round(result.matchScore) }}%
                </span>
                <!-- Glassmorphic tooltip -->
                <div 
                  v-if="getScoreTooltip(result)" 
                  :class="getTooltipClass(result.matchScore)"
                  class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-10 backdrop-blur-md shadow-lg"
                >
                  {{ getScoreTooltip(result) }}
                </div>
              </div>
            </div>
          </div>
          
          <!-- Adresse -->
          <div class="min-h-[4rem] mb-4">
            <h3 v-if="!result.hasIncompleteData" class="font-semibold text-gray-900 dark:text-gray-100 text-base mb-1 line-clamp-2">
              {{ getFormattedAddress(result) }}
            </h3>
            <h3 v-else class="font-semibold text-amber-700 dark:text-amber-400 text-base mb-1">
              Adresse non disponible
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ result.communeDisplay || result.commune || 'Localisation inconnue' }}
            </p>
          </div>
          
          <!-- Legacy DPE Warning -->
          <div v-if="result.isLegacyData" class="mb-3">
            <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg px-3 py-2">
              <div class="flex items-center gap-2">
                <svg class="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
                <span class="text-xs font-medium text-amber-700 dark:text-amber-300">DPE Ancien (avant 07/2021)</span>
              </div>
              <div v-if="result.hasIncompleteData" class="mt-1.5">
                <a 
                  v-if="result.ademeUrl"
                  :href="result.ademeUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 underline inline-flex items-center gap-1"
                  @click.stop
                >
                  Voir sur ADEME
                  <ExternalLink class="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          <!-- Informations clés -->
          <div class="flex items-center justify-between mb-4">
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Surface</p>
              <p class="text-base font-semibold text-gray-900 dark:text-gray-100">{{ result.surfaceHabitable }} m²</p>
            </div>
            <div v-if="result.anneeConstruction" class="text-center">
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Année</p>
              <p class="text-base font-semibold text-gray-900 dark:text-gray-100">{{ result.anneeConstruction }}</p>
            </div>
            <div v-if="result.typeBien === 'appartement' && getFloorDisplay(result)" class="text-right">
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Étage</p>
              <p class="text-base font-semibold text-gray-900 dark:text-gray-100">
                {{ getFloorDisplay(result) }}
              </p>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex gap-3 mt-auto pt-3 border-t border-gray-100 dark:border-gray-700">
            <button
              v-if="!result.hasIncompleteData"
              @click.stop="showDetails(result)"
              class="flex-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 font-medium text-sm py-2 transition-colors flex items-center justify-center gap-1"
            >
              <ExternalLink class="w-3.5 h-3.5" />
              Voir détails
            </button>
            <a 
              v-if="result.hasIncompleteData && result.ademeUrl"
              :href="result.ademeUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="flex-1 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-medium text-sm py-2 transition-colors flex items-center justify-center gap-1"
              @click.stop
            >
              <ExternalLink class="w-3.5 h-3.5" />
              Voir sur ADEME
            </a>
            <a 
              v-if="!result.hasIncompleteData"
              :href="getGoogleMapsUrl(result)"
              target="_blank"
              rel="noopener noreferrer"
              class="flex-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm py-2 transition-colors text-center"
              @click.stop
            >
              Voir sur Maps
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal détails avec Google Maps -->
    <PropertyModal
      v-if="selectedProperty"
      :property="selectedProperty"
      :formattedAddress="getFormattedAddress(selectedProperty)"
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

    <!-- Modal détails DPE complets -->
    <DPEDetailsModal
      :show="showDPEDetails"
      :property="selectedProperty"
      :departmentAverages="departmentAverages"
      @close="showDPEDetails = false"
    />

    <!-- Floating scroll to top button -->
    <ScrollToTop />

  </div>
</template>

<script>
import {
  Building,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ExternalLink,
  FileText,
  Globe,
  Grid2x2Check,
  Grid2x2X,
  Home,
  Lightbulb,
  MapPin,
  Search,
  Target,
  Trash2,
  Trophy,
  X
} from 'lucide-vue-next'
import {
  getGeoportailUrl,
  getGoogleMapsEmbedUrl,
  getGoogleMapsSearchUrl,
  getGoogleRegionLabel
} from '../utils/mapUtils'
import DPEDetailsModal from './DPEDetailsModal.vue'
import Grid2x2Plus from './icons/Grid2x2Plus.vue'
import PropertyModal from './PropertyModal.vue'
import ScrollToTop from './ScrollToTop.vue'

export default {
  name: 'DPEResults',
  components: {
    Target,
    Search,
    Lightbulb,
    Trophy,
    Home,
    MapPin,
    Building,
    Calendar,
    Check,
    ChevronDown,
    FileText,
    Globe,
    Grid2x2Check,
    Grid2x2X,
    Grid2x2Plus,
    Building2,
    X,
    ExternalLink,
    Trash2,
    PropertyModal,
    DPEDetailsModal,
    ScrollToTop
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
  data() {
    return {
      selectedProperty: null,
      showDPEDetails: false,
      iconComponents: {
        Grid2x2Check,
        Grid2x2X,
        Grid2x2Plus
      },
      contextMenu: {
        show: false,
        x: 0,
        y: 0,
        index: null
      },
      hiddenResults: new Set(),
      sortBy: 'score' // Default sort by score
    }
  },
  computed: {
    filteredResults() {
      if (!this.searchResult?.results) return []

      // First filter out hidden results
      let results = this.searchResult.results.filter((_, index) => !this.hiddenResults.has(index))

      // Then apply sorting
      if (this.sortBy === 'distance' && this.hasDistanceData) {
        // Sort by distance (ascending - closest first)
        results = [...results].sort((a, b) => {
          const distA = a.distance !== undefined ? a.distance : Infinity
          const distB = b.distance !== undefined ? b.distance : Infinity
          return distA - distB
        })
      } else if (this.sortBy === 'surface') {
        // Sort by surface (descending - largest first)
        results = [...results].sort((a, b) => {
          const surfA = a.surfaceHabitable || 0
          const surfB = b.surfaceHabitable || 0
          return surfB - surfA
        })
      } else if (this.sortBy === 'date-desc') {
        // Sort by date (descending - most recent first)
        results = [...results].sort((a, b) => {
          const dateA = a.dateVisite ? new Date(a.dateVisite).getTime() : 0
          const dateB = b.dateVisite ? new Date(b.dateVisite).getTime() : 0
          return dateB - dateA
        })
      } else if (this.sortBy === 'date-asc') {
        // Sort by date (ascending - oldest first)
        results = [...results].sort((a, b) => {
          const dateA = a.dateVisite ? new Date(a.dateVisite).getTime() : 0
          const dateB = b.dateVisite ? new Date(b.dateVisite).getTime() : 0
          return dateA - dateB
        })
      } else {
        // Default: sort by score (descending - best match first)
        results = [...results].sort((a, b) => {
          const scoreA = a.matchScore || 0
          const scoreB = b.matchScore || 0
          return scoreB - scoreA
        })
      }

      return results
    },

    hasDistanceData() {
      return this.searchResult?.results?.some(r => r.distance !== undefined)
    }
  },
  mounted() {
    // Add escape key listener
    window.addEventListener('keydown', this.handleEscapeKey)
    window.addEventListener('click', this.hideContextMenu)
  },
  unmounted() {
    // Clean up event listener
    window.removeEventListener('keydown', this.handleEscapeKey)
    window.removeEventListener('click', this.hideContextMenu)
    // Clean up body overflow if modal was open
    document.body.style.overflow = ''
  },
  methods: {
    sortResults() {
      // The sorting is handled reactively in the computed property
      // This method is just to trigger re-computation when dropdown changes
    },

    shouldPulse(_result, index) {
      // Pulse seulement si c'est le premier ET qu'il est le seul avec le meilleur score
      if (index !== 0) return false

      const firstScore = this.searchResult.results[0]?.matchScore
      const sameScoreCount = this.searchResult.results.filter(r => r.matchScore === firstScore).length

      return sameScoreCount === 1
    },

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

    getDifferenceBubbleClass(score) {
      if (score >= 90) return 'bg-green-100 text-green-700 border border-green-200'
      if (score >= 70) return 'bg-yellow-100 text-yellow-700 border border-yellow-200'
      return 'bg-orange-100 text-orange-700 border border-orange-200'
    },

    getSurfaceDifference(result) {
      if (this.searchCriteria?.surfaceHabitable && result.surfaceHabitable) {
        const diff = Math.abs(result.surfaceHabitable - this.searchCriteria.surfaceHabitable)
        if (diff > 1) {
          // Afficher dès qu'il y a plus de 1m² de différence
          const sign = result.surfaceHabitable > this.searchCriteria.surfaceHabitable ? '+' : '-'
          return `${sign}${Math.round(diff)} m²`
        }
      }
      return ''
    },

    getConsoDifference(result) {
      if (this.searchCriteria?.consommationEnergie && result.consommationEnergie) {
        const diff = Math.abs(result.consommationEnergie - this.searchCriteria.consommationEnergie)
        if (diff > 0) {
          // Afficher tout écart
          const sign = result.consommationEnergie > this.searchCriteria.consommationEnergie ? '+' : '-'
          return `${sign}${Math.round(diff)} kWh`
        }
      }
      return ''
    },

    getGESDifference(result) {
      if (this.searchCriteria?.emissionGES && result.emissionGES) {
        const diff = Math.abs(result.emissionGES - this.searchCriteria.emissionGES)
        if (diff > 0) {
          // Afficher tout écart
          const sign = result.emissionGES > this.searchCriteria.emissionGES ? '+' : '-'
          return `${sign}${Math.round(diff)} CO₂`
        }
      }
      return ''
    },

    getFormattedAddress(result) {
      if (!result.adresseComplete) return 'Bien localisé'

      // Enlever le code postal et la ville de l'adresse s'ils sont présents
      let address = result.adresseComplete

      // Fix encoding issues
      address = address.replace(/â€™/g, "'")
      address = address.replace(/â€/g, "'")

      // Remove all postal codes (5 digits)
      address = address.replace(/\s+\d{5}\s*/g, ' ')

      // Remove city names - try both the enriched commune and the original ADEME commune
      if (result.communeADEME) {
        // Remove the original ADEME city name
        const ademeRegex = new RegExp(`\\s*${result.communeADEME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'gi')
        address = address.replace(ademeRegex, ' ')
      }

      // Also try to remove just "Aix-en-Provence" if it's in the enriched commune
      address = address.replace(/\s*Aix-en-Provence\s*/gi, ' ')

      // Remove any remaining city-like patterns at the end
      address = address.replace(/\s+[A-Za-zÀ-ÿ-]+$/g, '')

      // Clean up multiple spaces and trim
      address = address.trim().replace(/\s+/g, ' ')

      return address || 'Bien localisé'
    },

    getMatchIndicatorClass(score) {
      if (score >= 90) return 'bg-green-100 text-green-700 border border-green-300'
      if (score >= 70) return 'bg-yellow-100 text-yellow-700 border border-yellow-300'
      return 'bg-orange-100 text-orange-700 border border-orange-300'
    },

    getMatchLabel(score) {
      if (score >= 90) return 'Excellent'
      if (score >= 70) return 'Bon'
      return 'Partiel'
    },

    showDetails(result) {
      // Property data loaded

      // Set the property - address should already be enriched from service
      this.selectedProperty = result

      // Prevent background scrolling when modal is open
      document.body.style.overflow = 'hidden'
    },

    closeModal() {
      this.selectedProperty = null
      // Re-enable background scrolling
      document.body.style.overflow = ''
    },

    handleEscapeKey(event) {
      if (event.key === 'Escape' && this.selectedProperty) {
        this.closeModal()
      }
    },

    showContextMenu(event, index) {
      event.stopPropagation()
      this.contextMenu = {
        show: true,
        x: event.clientX,
        y: event.clientY,
        index: index
      }
    },

    hideContextMenu() {
      this.contextMenu.show = false
    },

    hideResult(index) {
      if (index !== null && index >= 0) {
        // Find the original index in the unfiltered results
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
        this.hideContextMenu()
      }
    },

    getSearchSummary() {
      if (!this.searchCriteria) return ''

      const parts = []
      if (this.searchCriteria.surfaceHabitable) {
        parts.push(`${this.searchCriteria.surfaceHabitable}m²`)
      }
      if (this.searchCriteria.commune) {
        parts.push(this.searchCriteria.commune)
      }
      if (this.searchCriteria.codePostal) {
        parts.push(this.searchCriteria.codePostal)
      }

      return parts.join(' • ')
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

    formatDate(dateString) {
      if (!dateString) return ''
      const date = new Date(dateString)
      return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    },

    formatShortDate(dateString) {
      if (!dateString) return ''
      const date = new Date(dateString)
      return date.toLocaleDateString('fr-FR', {
        month: '2-digit',
        year: 'numeric'
      })
    },

    getDaysAgo(dateString) {
      if (!dateString) return ''
      const date = new Date(dateString)
      const now = new Date()
      const diffTime = Math.abs(now - date)
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      if (diffDays === 0) return "aujourd'hui"
      if (diffDays === 1) return 'hier'
      if (diffDays < 7) return `${diffDays} jours`
      if (diffDays < 14) return '1 semaine'
      if (diffDays < 21) return '2 semaines'
      if (diffDays < 30) return '3 semaines'
      if (diffDays < 60) return '1 mois'
      if (diffDays < 90) return '2 mois'
      return `${Math.floor(diffDays / 30)} mois`
    },

    getGoogleMapsEmbedUrlForProperty(property) {
      if (!property) return ''
      const region = getGoogleRegionLabel(property.codePostal)
      const address = `${property.adresseComplete}, ${property.codePostal} ${property.commune}, ${region}`
      return getGoogleMapsEmbedUrl(property.latitude, property.longitude, address)
    },

    getGeoportailUrlForProperty(property) {
      if (!property) return null
      return getGeoportailUrl(property.latitude, property.longitude)
    },

    getGoogleMapsUrl(result) {
      // Force address-first query for Google to disambiguate DOM-TOM
      const region = getGoogleRegionLabel(result.codePostal)
      const address = `${result.adresseComplete}, ${result.codePostal} ${result.commune}, ${region}`
      return getGoogleMapsSearchUrl(result.latitude, result.longitude, address)
    },
    getDPEBadgeClass(classe) {
      const styles = {
        A: 'bg-green-500 text-white',
        B: 'bg-green-400 text-white',
        C: 'bg-yellow-400 text-gray-900',
        D: 'bg-orange-400 text-white',
        E: 'bg-orange-600 text-white',
        F: 'bg-red-500 text-white',
        G: 'bg-red-700 text-white'
      }
      return styles[classe] || 'bg-gray-400 text-white'
    },

    getInsulationRating(quality) {
      // Convert text ratings to numerical scale
      const ratings = {
        insuffisante: { level: 1, max: 5, label: 'Insuffisante', color: 'text-red-600 dark:text-red-400' },
        moyenne: { level: 3, max: 5, label: 'Moyenne', color: 'text-yellow-600 dark:text-yellow-400' },
        bonne: { level: 4, max: 5, label: 'Bonne', color: 'text-green-600 dark:text-green-400' },
        'très bonne': { level: 5, max: 5, label: 'Très bonne', color: 'text-green-700 dark:text-green-300' }
      }

      // Normalize: lowercase, trim, and handle variations
      const normalized = (quality || '').toLowerCase().trim().replace(/\s+/g, ' ')

      // Also check without accents in case of encoding issues
      const withoutAccents = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

      return (
        ratings[normalized] ||
        ratings[withoutAccents] || {
          level: 0,
          max: 5,
          label: quality || 'Non renseigné',
          color: 'text-gray-500 dark:text-gray-400'
        }
      )
    },

    getConsumptionContext(value, type) {
      // French averages for context
      const averages = {
        chauffage: 110, // kWh/m²/an
        eauChaude: 35, // kWh/m²/an
        eclairage: 5, // kWh/m²/an
        auxiliaires: 15 // kWh/m²/an
      }

      const avg = averages[type] || 0
      if (!avg || !value) return ''

      const ratio = value / avg
      if (ratio < 0.7) return 'Très économe'
      if (ratio < 0.9) return 'Économe'
      if (ratio < 1.1) return 'Moyenne'
      if (ratio < 1.3) return 'Élevée'
      return 'Très élevée'
    },

    getVentilationLabel(type) {
      // Clarify ventilation terminology
      const labels = {
        'Avant 2012': 'Ventilation naturelle ou VMC simple flux ancienne',
        'Après 2012': 'VMC conforme RT2012 (simple ou double flux)',
        'VMC simple flux': 'VMC simple flux',
        'VMC double flux': 'VMC double flux avec récupération de chaleur',
        'Ventilation naturelle': 'Ventilation naturelle (ouvertures)',
        'VMC hygro B': 'VMC hygro B (débit variable)'
      }
      return labels[type] || type
    },

    getScoreBadgeClass(score) {
      // Handle NaN or invalid scores
      if (Number.isNaN(score) || score === null || score === undefined) {
        return 'bg-gray-400 text-white'
      }

      // Color based on actual score out of 100
      const roundedScore = Math.round(score)
      if (roundedScore >= 90) return 'bg-green-500 text-white'
      if (roundedScore >= 80) return 'bg-green-400 text-white'
      if (roundedScore >= 70) return 'bg-yellow-400 text-gray-900'
      if (roundedScore >= 60) return 'bg-orange-400 text-white'
      if (roundedScore >= 50) return 'bg-orange-500 text-white'
      if (roundedScore >= 40) return 'bg-orange-600 text-white'
      if (roundedScore >= 30) return 'bg-red-500 text-white'
      if (roundedScore >= 20) return 'bg-red-600 text-white'
      return 'bg-red-700 text-white'
    },

    getTooltipClass(score) {
      // Handle NaN or invalid scores
      if (Number.isNaN(score) || score === null || score === undefined) {
        return 'bg-gray-500/40 text-gray-700 dark:text-gray-300 border border-gray-500/50'
      }

      // Glassmorphic tooltip with color matching the score - increased opacity for better visibility
      const roundedScore = Math.round(score)
      if (roundedScore >= 90) return 'bg-green-500/40 text-green-700 dark:text-green-300 border border-green-500/50'
      if (roundedScore >= 80) return 'bg-green-400/40 text-green-600 dark:text-green-300 border border-green-400/50'
      if (roundedScore >= 70) return 'bg-yellow-400/40 text-yellow-700 dark:text-yellow-300 border border-yellow-400/50'
      if (roundedScore >= 60) return 'bg-orange-400/40 text-orange-700 dark:text-orange-300 border border-orange-400/50'
      if (roundedScore >= 50) return 'bg-orange-500/40 text-orange-700 dark:text-orange-300 border border-orange-500/50'
      if (roundedScore >= 40) return 'bg-orange-600/40 text-orange-800 dark:text-orange-300 border border-orange-600/50'
      if (roundedScore >= 30) return 'bg-red-500/40 text-red-700 dark:text-red-300 border border-red-500/50'
      if (roundedScore >= 20) return 'bg-red-600/40 text-red-700 dark:text-red-300 border border-red-600/50'
      return 'bg-red-700/40 text-red-800 dark:text-red-300 border border-red-700/50'
    },

    getAddressType(result) {
      if (result.typeBien) {
        if (result.typeBien.toLowerCase().includes('appartement')) {
          return 'appartement'
        }
        if (result.typeBien.toLowerCase().includes('maison')) {
          return 'maison'
        }
      }
      return null
    },

    getFloorDisplay(result) {
      // If we have a direct etage field that is NOT 0, use it
      if (
        result.etage !== null &&
        result.etage !== undefined &&
        result.etage !== '' &&
        result.etage !== 0 &&
        result.etage !== '0'
      ) {
        return `Étage: ${result.etage}`
      }

      // Otherwise, ALWAYS try to parse from complementRefLogement (including RDC)
      const parsed = this.parseLocalisation(result.complementRefLogement)
      if (parsed) {
        return parsed
      }

      // If we can't find anything, don't display anything
      return null
    },

    parseLocalisation(text) {
      if (!text) return ''

      // Convert to string and trim
      const str = String(text).trim()
      if (!str) return ''

      // Priority 1: Look for explicit "étage" or "etage" with a number
      // This is the most reliable pattern
      const etageMatch = str.match(/[ÉEé]tage\s*[:;#n°]?\s*°?\s*(\d+)/i)
      if (etageMatch) {
        const floorNum = etageMatch[1]
        return floorNum === '0' ? 'RDC' : `Étage: ${floorNum}`
      }

      // Priority 2: Look for ordinal patterns WITH the word "étage"
      // e.g., "1er étage", "2ème étage", "3e étage"
      if (str.toLowerCase().includes('étage') || str.toLowerCase().includes('etage')) {
        const ordinalWithEtage = str.match(/(\d+)\s*(?:er|ère|eme|ème|e|è)\s*[éÉ]tage/i)
        if (ordinalWithEtage) {
          return `Étage: ${ordinalWithEtage[1]}`
        }
      }

      // Priority 3: Check for RDC (ground floor) - various spellings
      if (str.match(/\b(RDC|rez[\s-]?de[\s-]?chauss[ée]e?|res[\s-]?de[\s-]?chauss[ée]e?|rez|RC)\b/i)) {
        return 'RDC'
      }

      // Priority 4: Look for standalone ordinals ONLY at the beginning and without other building terms
      // e.g., "3ème gauche" but NOT "Bat. 3, 2ème"
      const standaloneOrdinal = str.match(/^(\d+)\s*(?:er|ère|eme|ème|è|e)\s*(?:gauche|droite|fond|face)?$/i)
      if (standaloneOrdinal) {
        return `Étage: ${standaloneOrdinal[1]}`
      }

      // Priority 5: Look for abbreviations like "Et. 3" or "Etg 2" but be strict
      const abbreviationMatch = str.match(/\b[EÉé]t[g]?\.?\s+(\d+)\b/i)
      if (abbreviationMatch && !str.match(/\b(bat|esc|appt|stage|etagere)\b/i)) {
        return `Étage: ${abbreviationMatch[1]}`
      }

      // If we can't confidently extract floor info, return empty string
      // This is safer than showing potentially wrong information
      return ''
    },

    getScoreTooltip(result) {
      if (!this.searchCriteria) return ''

      // Only show "Correspondance exacte" if score is 100%
      if (result.matchScore && Math.round(result.matchScore) === 100) {
        return 'Correspondance exacte'
      }

      // Build very short list of main differences
      const diffs = []

      // Helper function to parse comparison values
      const parseValue = value => {
        if (!value) return null
        const strValue = value.toString().trim()
        // Remove < or > operators and parse the number
        if (strValue.startsWith('<') || strValue.startsWith('>')) {
          return parseInt(strValue.substring(1), 10)
        }
        return parseInt(strValue, 10)
      }

      // Surface difference
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

      // Consumption difference
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

      // GES difference
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

      // Check postal code
      const searchPostal = this.searchCriteria.commune?.match(/\d{5}/)?.[0]
      const resultPostal = result.codePostal || result.codePostalADEME
      if (searchPostal && resultPostal && searchPostal !== resultPostal) {
        diffs.push('📍') // Different location indicator
      }

      // Return just the differences, very concise (or empty string if no diffs)
      return diffs.join(' ')
    },

    getSurfaceIcon(result) {
      if (!this.searchCriteria?.surfaceHabitable || !result.surfaceHabitable) {
        return this.iconComponents.Grid2x2Check
      }

      const searchSurface = this.searchCriteria.surfaceHabitable
      const resultSurface = result.surfaceHabitable
      const diff = resultSurface - searchSurface
      const absDiff = Math.abs(diff)
      const _percentDiff = Math.abs((diff / searchSurface) * 100)

      // Tolerance: 1m² for properties <100m², 1% for larger properties
      const tolerance = searchSurface < 100 ? 1 : searchSurface * 0.01
      const isMatch = absDiff <= tolerance

      if (isMatch) {
        return this.iconComponents.Grid2x2Check // Within tolerance
      } else if (diff > 0) {
        return this.iconComponents.Grid2x2Plus // Extra m²
      } else {
        return this.iconComponents.Grid2x2X // Missing m²
      }
    },

    getSurfaceIconClass(result) {
      if (!this.searchCriteria?.surfaceHabitable || !result.surfaceHabitable) {
        return 'text-green-600'
      }

      const searchSurface = this.searchCriteria.surfaceHabitable
      const resultSurface = result.surfaceHabitable
      const percentDiff = Math.abs(((resultSurface - searchSurface) / searchSurface) * 100)

      if (percentDiff <= 1) {
        return 'text-green-600' // Perfect match
      } else if (percentDiff <= 5) {
        return 'text-green-500' // Light green
      } else if (percentDiff <= 10) {
        return 'text-yellow-500' // Yellow
      } else if (percentDiff <= 20) {
        return 'text-orange-500' // Orange
      } else if (percentDiff <= 50) {
        return 'text-orange-600' // Dark orange
      } else {
        return 'text-red-600' // Red for > 50% difference
      }
    },

    getDeptAverage(type) {
      if (!this.departmentAverages || !this.selectedProperty) return null

      // Find the appropriate surface range
      const surface = this.selectedProperty.surfaceHabitable
      let range = null

      for (const surfaceRange of this.departmentAverages.surfaceRanges) {
        const [min, max] = surfaceRange.range
          .replace('m²', '')
          .replace('+', '-999')
          .split('-')
          .map(n => parseInt(n, 10))
        if (surface >= min && (max === 999 || surface <= max)) {
          range = surfaceRange
          break
        }
      }

      // Handle edge cases for very small or very large surfaces
      if (!range && this.departmentAverages.surfaceRanges.length > 0) {
        if (surface < 15) {
          range = this.departmentAverages.surfaceRanges[0]
        } else if (surface > 150) {
          range = this.departmentAverages.surfaceRanges[this.departmentAverages.surfaceRanges.length - 1]
        }
      }

      if (!range) return null

      // Return the appropriate consumption value
      if (type === 'total') {
        return range.consumption.total
      } else if (type === 'chauffage') {
        return range.consumption.chauffage
      } else if (type === 'eau_chaude') {
        return range.consumption.eau_chaude
      } else if (type === 'ges') {
        return range.ges
      }

      return null
    },

    formatDateRange(dateRange) {
      if (!dateRange) return 'sept. 2022 → présent'

      // Parse the date range string (format: "2022-09-11 to present")
      const match = dateRange.match(/(\d{4})-(\d{2})-(\d{2}) to (.+)/)
      if (!match) return dateRange

      const [, year, month, , end] = match
      const months = {
        '01': 'janv.',
        '02': 'févr.',
        '03': 'mars',
        '04': 'avr.',
        '05': 'mai',
        '06': 'juin',
        '07': 'juil.',
        '08': 'août',
        '09': 'sept.',
        10: 'oct.',
        11: 'nov.',
        12: 'déc.'
      }

      const startDate = `${months[month]} ${year}`
      const endDate = end === 'present' ? 'présent' : end

      return `${startDate} → ${endDate}`
    },

    getDeptRangeInfo() {
      if (!this.departmentAverages || !this.selectedProperty) return null

      // Find the appropriate surface range
      const surface = this.selectedProperty.surfaceHabitable
      let range = null

      for (const surfaceRange of this.departmentAverages.surfaceRanges) {
        const [min, max] = surfaceRange.range
          .replace('m²', '')
          .replace('+', '-999')
          .split('-')
          .map(n => parseInt(n, 10))
        if (surface >= min && (max === 999 || surface <= max)) {
          range = surfaceRange
          break
        }
      }

      // Handle edge cases for very small or very large surfaces
      if (!range && this.departmentAverages.surfaceRanges.length > 0) {
        if (surface < 15) {
          range = this.departmentAverages.surfaceRanges[0]
        } else if (surface > 150) {
          range = this.departmentAverages.surfaceRanges[this.departmentAverages.surfaceRanges.length - 1]
        }
      }

      return range
    }
  }
}
</script>

<style scoped>
/* Animations pour les résultats */
.bg-white {
  animation: fadeInUp 0.6s ease-out;
}

.bg-white:nth-child(2) {
  animation-delay: 0.1s;
}

.bg-white:nth-child(3) {
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
