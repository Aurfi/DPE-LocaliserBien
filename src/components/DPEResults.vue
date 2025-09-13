<template>
  <div class="max-w-7xl mx-auto px-4 py-6">
    <!-- Error state -->
    <div v-if="searchResult.searchStrategy === 'ERROR'" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6 mb-6">
      <div class="flex items-start">
        <div class="flex-shrink-0">
          <svg class="h-6 w-6 text-red-400 dark:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-800 dark:text-red-200">
            Erreur lors de la recherche
          </h3>
          <div class="mt-2 text-sm text-red-700 dark:text-red-300">
            <p>{{ searchResult.diagnostics && searchResult.diagnostics[0] ? searchResult.diagnostics[0] : 'Une erreur est survenue lors de la recherche. Veuillez réessayer.' }}</p>
          </div>
          <div class="mt-4">
            <button 
              @click="$emit('newSearch')"
              class="text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300"
            >
              Nouvelle recherche →
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- En-tête des résultats -->
    <div v-else class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm px-5 py-4 mb-6">
      <div class="flex flex-col gap-4">
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
          <button 
            @click="$emit('newSearch')"
            class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors sm:ml-4"
            title="Fermer"
          >
            <X class="w-6 h-6" />
          </button>
        </div>
        
        <!-- Sorting dropdown - moved to separate row on mobile -->
        <div v-if="filteredResults.length > 3" class="flex items-center gap-2">
          <span class="text-sm text-gray-600 dark:text-gray-400">Trier :</span>
          <div class="relative flex-1 sm:flex-initial">
            <select 
              v-model="sortBy"
              @change="sortResults"
              class="w-full sm:w-auto appearance-none bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm rounded-lg px-3 py-2 pr-8 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors cursor-pointer"
            >
              <option value="score">Score</option>
              <option value="distance" v-if="hasDistanceData">Distance</option>
              <option value="surface">Surface</option>
              <option value="etage" v-if="shouldShowEtageSort">Étage</option>
              <option value="date-desc">DPE récent</option>
              <option value="date-asc">DPE ancien</option>
              <option value="construction-desc">Construction récente</option>
              <option value="construction-asc">Construction ancienne</option>
            </select>
            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500 dark:text-gray-400">
              <ChevronDown class="w-4 h-4" />
            </div>
          </div>
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
              {{ (result.communeDisplay || result.commune || 'Localisation inconnue') + ' - ' + (result.codePostalDisplay || result.codePostal || result.codePostalADEME || '') }}
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
            </div>
          </div>

          <!-- Informations clés -->
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
            <!-- Surface -->
            <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
              <div class="text-xs text-gray-500 dark:text-gray-400">Surface</div>
              <div class="font-bold text-gray-800 dark:text-gray-200">{{ result.surfaceHabitable }} m²</div>
            </div>
            
            <!-- Étage (si disponible) -->
            <div v-if="getFloorDisplay(result)" class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
              <div class="text-xs text-gray-500 dark:text-gray-400">Étage</div>
              <div class="font-bold text-gray-800 dark:text-gray-200">
                {{ getFloorDisplay(result) }}
              </div>
            </div>
            
            <!-- Année de construction -->
            <div v-if="result.anneeConstruction" class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2" :class="{ 'col-span-2 sm:col-span-1': !getFloorDisplay(result) }">
              <div class="text-xs text-gray-500 dark:text-gray-400">Construction</div>
              <div class="font-bold text-gray-800 dark:text-gray-200">{{ formatYearDisplay(result.anneeConstruction) }}</div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex justify-center mt-auto pt-3 border-t border-gray-100 dark:border-gray-700">
            <button
              v-if="!result.hasIncompleteData"
              @click.stop="showDetails(result)"
              class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 font-medium text-sm py-2 px-4 transition-colors flex items-center justify-center gap-1"
            >
              <ExternalLink class="w-3.5 h-3.5" />
              Voir détails
            </button>
            <button 
              v-if="result.hasIncompleteData"
              @click.stop="showRawDataForResult(result)"
              class="text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-medium text-sm py-2 px-4 transition-colors flex items-center justify-center gap-1"
            >
              <Database class="w-3.5 h-3.5" />
              Voir données brutes
            </button>
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

    <!-- Modal données brutes -->
    <DonneesBrutesModal
      :show="showRawDataModal"
      :dpeData="rawDataProperty"
      @close="showRawDataModal = false"
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
  Database,
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
import DonneesBrutesModal from './DonneesBrutesModal.vue'
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
    Database,
    FileText,
    Globe,
    Grid2x2Check,
    Grid2x2X,
    Grid2x2Plus,
    Building2,
    X,
    ExternalLink,
    Trash2,
    DonneesBrutesModal,
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
      showRawDataModal: false,
      rawDataProperty: null,
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
      sortBy: 'score' // Tri par défaut par score
    }
  },
  computed: {
    filteredResults() {
      if (!this.searchResult?.results) return []

      // D'abord filtrer les résultats masqués
      let results = this.searchResult.results.filter((_, index) => !this.hiddenResults.has(index))

      // Ensuite appliquer le tri
      if (this.sortBy === 'distance' && this.hasDistanceData) {
        // Tri par distance (croissant - plus proche en premier)
        results = [...results].sort((a, b) => {
          const distA = a.distance !== undefined ? a.distance : Infinity
          const distB = b.distance !== undefined ? b.distance : Infinity
          return distA - distB
        })
      } else if (this.sortBy === 'surface') {
        // Tri par surface (décroissant - plus grand en premier)
        results = [...results].sort((a, b) => {
          const surfA = a.surfaceHabitable || 0
          const surfB = b.surfaceHabitable || 0
          return surfB - surfA
        })
      } else if (this.sortBy === 'etage') {
        // Tri par étage (croissant - RDC en premier, puis étages supérieurs)
        results = [...results].sort((a, b) => {
          // Extraire l'étage numérique
          const getFloorNumber = result => {
            const display = this.getFloorDisplay(result)
            if (!display) return 999 // Mettre à la fin si pas d'étage
            if (display === 'RDC') return 0
            const match = display.match(/\d+/)
            return match ? parseInt(match[0], 10) : 999
          }

          const floorA = getFloorNumber(a)
          const floorB = getFloorNumber(b)

          // Si même étage, trier par score
          if (floorA === floorB) {
            const scoreA = a.matchScore || 0
            const scoreB = b.matchScore || 0
            return scoreB - scoreA
          }

          return floorA - floorB
        })
      } else if (this.sortBy === 'construction-asc') {
        // Tri par année de construction (croissant - ancien en premier)
        results = [...results].sort((a, b) => {
          const yearA = this.extractYearFromValue(a.anneeConstruction) || 9999
          const yearB = this.extractYearFromValue(b.anneeConstruction) || 9999
          return yearA - yearB
        })
      } else if (this.sortBy === 'construction-desc') {
        // Tri par année de construction (décroissant - récent en premier)
        results = [...results].sort((a, b) => {
          const yearA = this.extractYearFromValue(a.anneeConstruction) || 0
          const yearB = this.extractYearFromValue(b.anneeConstruction) || 0
          return yearB - yearA
        })
      } else if (this.sortBy === 'date-desc') {
        // Tri par date (décroissant - plus récent en premier)
        results = [...results].sort((a, b) => {
          const dateA = a.dateVisite ? new Date(a.dateVisite).getTime() : 0
          const dateB = b.dateVisite ? new Date(b.dateVisite).getTime() : 0
          return dateB - dateA
        })
      } else if (this.sortBy === 'date-asc') {
        // Tri par date (croissant - plus ancien en premier)
        results = [...results].sort((a, b) => {
          const dateA = a.dateVisite ? new Date(a.dateVisite).getTime() : 0
          const dateB = b.dateVisite ? new Date(b.dateVisite).getTime() : 0
          return dateA - dateB
        })
      } else {
        // Par défaut : tri par score (décroissant - meilleure correspondance en premier)
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
    },

    shouldShowEtageSort() {
      // Ne montrer l'option que si on a au moins 3 résultats avec des étages différents
      if (!this.searchResult?.results || this.searchResult.results.length < 3) return false

      const etages = this.searchResult.results
        .map(r => {
          // Extraire l'étage numérique pour comparaison
          const display = this.getFloorDisplay(r)
          if (!display) return null
          if (display === 'RDC') return 0
          const match = display.match(/\d+/)
          return match ? parseInt(match[0], 10) : null
        })
        .filter(e => e !== null)

      // Vérifier qu'on a au moins 3 étages et qu'ils ne sont pas tous identiques
      if (etages.length < 3) return false
      const uniqueEtages = new Set(etages)
      return uniqueEtages.size > 1
    }
  },
  mounted() {
    // Ajouter l'écouteur pour la touche Escape
    window.addEventListener('keydown', this.handleEscapeKey)
    window.addEventListener('click', this.hideContextMenu)
  },
  unmounted() {
    // Nettoyer l'écouteur d'événements
    window.removeEventListener('keydown', this.handleEscapeKey)
    window.removeEventListener('click', this.hideContextMenu)
    // Nettoyer le débordement du body si le modal était ouvert
    document.body.style.overflow = ''
  },
  methods: {
    extractYearFromValue(value) {
      // Extraire l'année d'une valeur qui peut être une année simple ou une plage (ex: "1948-1974")
      if (!value) return null
      const strValue = String(value)
      // Chercher le premier nombre à 4 chiffres
      const match = strValue.match(/(\d{4})/)
      return match ? parseInt(match[1], 10) : null
    },

    formatYearDisplay(value) {
      // Formater l'affichage de l'année (garder les plages comme "1948-1974")
      return value || 'N/A'
    },

    sortResults() {
      // Le tri est géré de manière réactive dans la propriété calculée
      // Cette méthode sert juste à déclencher le recalcul lors du changement de la liste déroulante
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

      // Corriger les problèmes d'encodage
      address = address.replace(/â€™/g, "'")
      address = address.replace(/â€/g, "'")

      // Supprimer tous les codes postaux (5 chiffres)
      address = address.replace(/\s+\d{5}\s*/g, ' ')

      // Supprimer les noms de ville - essayer à la fois la commune enrichie et la commune ADEME originale
      if (result.communeADEME) {
        // Supprimer le nom de ville ADEME original
        const ademeRegex = new RegExp(`\\s*${result.communeADEME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'gi')
        address = address.replace(ademeRegex, ' ')
      }

      // Essayer aussi de supprimer juste "Aix-en-Provence" si c'est dans la commune enrichie
      address = address.replace(/\s*Aix-en-Provence\s*/gi, ' ')

      // Supprimer tous les motifs de type ville restants à la fin
      address = address.replace(/\s+[A-Za-zÀ-ÿ-]+$/g, '')

      // Nettoyer les espaces multiples et couper
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
      // Données de la propriété chargées

      // Définir la propriété - l'adresse devrait déjà être enrichie depuis le service
      this.selectedProperty = result

      // Empêcher le défilement de l'arrière-plan quand le modal est ouvert
      document.body.style.overflow = 'hidden'
    },

    closeModal() {
      this.selectedProperty = null
      // Réactiver le défilement de l'arrière-plan
      document.body.style.overflow = ''
    },

    showRawDataForResult(result) {
      this.rawDataProperty = result
      this.showRawDataModal = true
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
        // Trouver l'index original dans les résultats non filtrés
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

      // Plus de 2 ans : afficher en années et mois
      const totalMonths = Math.floor(diffDays / 30)
      if (totalMonths >= 24) {
        const years = Math.floor(totalMonths / 12)
        const months = totalMonths % 12
        if (months === 0) {
          return `${years} an${years > 1 ? 's' : ''}`
        }
        return `${years} an${years > 1 ? 's' : ''} et ${months} mois`
      }

      return `${totalMonths} mois`
    },

    getGoogleMapsEmbedUrlForProperty(property) {
      if (!property) return ''

      // Priorité: 1) adresse enrichie, 2) adresse BAN brute d'ADEME, 3) coordonnées
      const adresse = property.adresseComplete || property.rawData?.adresse_ban || property.rawData?.geo_adresse
      const codePostal = property.codePostal || property.rawData?.code_postal_ban || property.rawData?.code_postal_brut
      const commune = property.commune || property.rawData?.nom_commune_ban || property.rawData?.nom_commune_brut

      // Construire l'adresse complète pour Google Maps si on a une adresse
      let address = null
      if (adresse && codePostal && commune) {
        const region = getGoogleRegionLabel(codePostal)
        address = `${adresse}, ${codePostal} ${commune}, ${region}`
      }

      // Google Maps utilisera l'adresse si disponible, sinon les coordonnées
      return getGoogleMapsEmbedUrl(property.latitude, property.longitude, address)
    },

    getGeoportailUrlForProperty(property) {
      if (!property) return null
      return getGeoportailUrl(property.latitude, property.longitude)
    },

    getGoogleMapsUrl(result) {
      // Forcer la requête par adresse pour que Google différencie les DOM-TOM
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
      // Convertir les évaluations textuelles en échelle numérique
      const ratings = {
        insuffisante: { level: 1, max: 5, label: 'Insuffisante', color: 'text-red-600 dark:text-red-400' },
        moyenne: { level: 3, max: 5, label: 'Moyenne', color: 'text-yellow-600 dark:text-yellow-400' },
        bonne: { level: 4, max: 5, label: 'Bonne', color: 'text-green-600 dark:text-green-400' },
        'très bonne': { level: 5, max: 5, label: 'Très bonne', color: 'text-green-700 dark:text-green-300' }
      }

      // Normaliser : minuscules, supprimer espaces et gérer les variations
      const normalized = (quality || '').toLowerCase().trim().replace(/\s+/g, ' ')

      // Vérifier aussi sans accents en cas de problèmes d'encodage
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
      // Moyennes françaises pour contexte
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
      // Clarifier la terminologie de ventilation
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
      // Gérer les scores NaN ou invalides
      if (Number.isNaN(score) || score === null || score === undefined) {
        return 'bg-gray-400 text-white'
      }

      // Couleur basée sur le score réel sur 100
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
      // Gérer les scores NaN ou invalides
      if (Number.isNaN(score) || score === null || score === undefined) {
        return 'bg-gray-500/40 text-gray-700 dark:text-gray-300 border border-gray-500/50'
      }

      // Infobulle glassmorphique avec couleur correspondant au score - opacité augmentée pour meilleure visibilité
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
      // Si nous avons un champ etage direct qui n'est PAS 0, l'utiliser
      if (
        result.etage !== null &&
        result.etage !== undefined &&
        result.etage !== '' &&
        result.etage !== 0 &&
        result.etage !== '0'
      ) {
        return `Étage: ${result.etage}`
      }

      // Sinon, TOUJOURS essayer d'analyser depuis complementRefLogement (y compris RDC)
      const parsed = this.parseLocalisation(result.complementRefLogement)
      if (parsed) {
        return parsed
      }

      // Si rien n'est trouvé, ne rien afficher
      return null
    },

    parseLocalisation(text) {
      if (!text) return ''

      // Convertir en chaîne et nettoyer
      const str = String(text).trim()
      if (!str) return ''

      // Priorité 1 : Rechercher "étage" ou "etage" explicite avec un numéro
      // C'est le motif le plus fiable
      const etageMatch = str.match(/[ÉEé]tage\s*[:;#n°]?\s*°?\s*(\d+)/i)
      if (etageMatch) {
        const floorNum = etageMatch[1]
        return floorNum === '0' ? 'RDC' : `Étage: ${floorNum}`
      }

      // Priorité 2 : Rechercher les motifs ordinaux AVEC le mot "étage"
      // ex. : "1er étage", "2ème étage", "3e étage"
      if (str.toLowerCase().includes('étage') || str.toLowerCase().includes('etage')) {
        const ordinalWithEtage = str.match(/(\d+)\s*(?:er|ère|eme|ème|e|è)\s*[éÉ]tage/i)
        if (ordinalWithEtage) {
          return `Étage: ${ordinalWithEtage[1]}`
        }
      }

      // Priorité 3 : Vérifier RDC (rez-de-chaussée) - diverses orthographes
      if (str.match(/\b(RDC|rez[\s-]?de[\s-]?chauss[ée]e?|res[\s-]?de[\s-]?chauss[ée]e?|rez|RC)\b/i)) {
        return 'RDC'
      }

      // Priorité 4 : Rechercher les ordinaux autonomes UNIQUEMENT au début et sans autres termes de bâtiment
      // ex. : "3ème gauche" mais PAS "Bat. 3, 2ème"
      const standaloneOrdinal = str.match(/^(\d+)\s*(?:er|ère|eme|ème|è|e)\s*(?:gauche|droite|fond|face)?$/i)
      if (standaloneOrdinal) {
        return `Étage: ${standaloneOrdinal[1]}`
      }

      // Priorité 5 : Rechercher les abréviations comme "Et. 3" ou "Etg 2" mais être strict
      const abbreviationMatch = str.match(/\b[EÉé]t[g]?\.?\s+(\d+)\b/i)
      if (abbreviationMatch && !str.match(/\b(bat|esc|appt|stage|etagere)\b/i)) {
        return `Étage: ${abbreviationMatch[1]}`
      }

      // Si impossible d'extraire l'info étage avec confiance, retourner une chaîne vide
      // C'est plus sûr que d'afficher une information potentiellement incorrecte
      return ''
    },

    getScoreTooltip(result) {
      if (!this.searchCriteria) return ''

      // Afficher "Correspondance exacte" uniquement si le score est de 100%
      if (result.matchScore && Math.round(result.matchScore) === 100) {
        return 'Correspondance exacte'
      }

      // Construire une liste très courte des principales différences
      const diffs = []

      // Fonction d'aide pour analyser les valeurs de comparaison
      const parseValue = value => {
        if (!value) return null
        const strValue = value.toString().trim()
        // Supprimer les opérateurs < ou > et analyser le nombre
        if (strValue.startsWith('<') || strValue.startsWith('>')) {
          return parseInt(strValue.substring(1), 10)
        }
        return parseInt(strValue, 10)
      }

      // Différence de surface
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

      // Différence de consommation
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

      // Différence GES
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

      // Vérifier le code postal
      const searchPostal = this.searchCriteria.commune?.match(/\d{5}/)?.[0]
      const resultPostal = result.codePostal || result.codePostalADEME
      if (searchPostal && resultPostal && searchPostal !== resultPostal) {
        diffs.push('Code Postal') // Indicateur de code postal différent
      }

      // Retourner seulement les différences, très concis (ou chaîne vide si aucune différence)
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

      // Tolérance : 1m² pour les biens <100m², 1% pour les biens plus grands
      const tolerance = searchSurface < 100 ? 1 : searchSurface * 0.01
      const isMatch = absDiff <= tolerance

      if (isMatch) {
        return this.iconComponents.Grid2x2Check // Dans la tolérance
      } else if (diff > 0) {
        return this.iconComponents.Grid2x2Plus // m² supplémentaires
      } else {
        return this.iconComponents.Grid2x2X // m² manquants
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
        return 'text-green-600' // Correspondance parfaite
      } else if (percentDiff <= 5) {
        return 'text-green-500' // Vert clair
      } else if (percentDiff <= 10) {
        return 'text-yellow-500' // Jaune
      } else if (percentDiff <= 20) {
        return 'text-orange-500' // Orange
      } else if (percentDiff <= 50) {
        return 'text-orange-600' // Orange foncé
      } else {
        return 'text-red-600' // Rouge pour > 50% de différence
      }
    },

    getDeptAverage(type) {
      if (!this.departmentAverages || !this.selectedProperty) return null

      // Trouver la plage de surface appropriée
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

      // Gérer les cas limites pour les surfaces très petites ou très grandes
      if (!range && this.departmentAverages.surfaceRanges.length > 0) {
        if (surface < 15) {
          range = this.departmentAverages.surfaceRanges[0]
        } else if (surface > 150) {
          range = this.departmentAverages.surfaceRanges[this.departmentAverages.surfaceRanges.length - 1]
        }
      }

      if (!range) return null

      // Retourner la valeur de consommation appropriée
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

      // Analyser la chaîne de plage de dates (format : "2022-09-11 to present")
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

      // Trouver la plage de surface appropriée
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

      // Gérer les cas limites pour les surfaces très petites ou très grandes
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
