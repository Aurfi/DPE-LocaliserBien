<template>
  <div v-if="results" class="mt-8 max-w-6xl mx-auto">
    <!-- En-tête des résultats -->
    <div class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-3xl shadow-xl p-6 mb-6 border border-white/50 dark:border-gray-700/50">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-xl font-bold text-gray-800 dark:text-gray-200">
            {{ filteredResults.length }} résultat{{ filteredResults.length > 1 ? 's' : '' }} affiché{{ filteredResults.length > 1 ? 's' : '' }}
            <span v-if="hiddenResults.size > 0" class="text-sm text-gray-500 dark:text-gray-400">({{ hiddenResults.size }} masqué{{ hiddenResults.size > 1 ? 's' : '' }})</span>
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Autour de {{ results.searchAddress }}
            <span class="text-xs text-gray-500 dark:text-gray-500">(rayon: {{ results.searchRadius }} km)</span>
          </p>
        </div>
        <button
          @click="$emit('clear-results')"
          class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          <X class="w-6 h-6" />
        </button>
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

    <!-- Liste des résultats -->
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="(dpe, index) in filteredResults"
        :key="dpe.numero_dpe"
        class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-5 relative border border-white/50 dark:border-gray-700/50 hover:scale-105 transform cursor-pointer flex flex-col h-full"
        @click="showDetails(dpe)"
        @contextmenu.prevent="showContextMenu($event, index)"
      >
        <!-- Date du DPE et icône type de bien -->
        <div class="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-3">
          <div class="flex items-center gap-1">
            <Calendar class="w-4 h-4" />
            {{ formatDate(dpe.date_etablissement_dpe) }}
          </div>
          <div class="flex items-center gap-2">
            <!-- Icône du type de bien -->
            <Home v-if="getPropertyType(dpe) === 'maison'" class="w-4 h-4 text-gray-400 dark:text-gray-500" />
            <Building2 v-else-if="getPropertyType(dpe) === 'appartement'" class="w-4 h-4 text-gray-400 dark:text-gray-500" />
            <Home v-else class="w-4 h-4 text-gray-300 dark:text-gray-600" />
            <span class="text-xs">
              {{ Math.round(dpe._distance * 10) / 10 }} km
            </span>
          </div>
        </div>

        <!-- Adresse -->
        <div class="font-semibold text-gray-800 dark:text-gray-200 mb-3 min-h-[3rem] line-clamp-2">
          {{ getFormattedAddress(dpe) }}
        </div>

        <!-- Infos principales -->
        <div class="grid grid-cols-2 gap-3 mb-3">
          <!-- Surface -->
          <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
            <div class="text-xs text-gray-500 dark:text-gray-400">Surface</div>
            <div class="font-bold text-gray-800 dark:text-gray-200">{{ Math.round(dpe.surface_habitable_logement) }} m²</div>
          </div>

          <!-- Classe énergétique -->
          <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
            <div class="text-xs text-gray-500 dark:text-gray-400">Classe</div>
            <div class="flex items-center">
              <span :class="['font-bold px-2 py-1 rounded text-sm', getClasseColor(dpe.etiquette_dpe)]">
                {{ dpe.etiquette_dpe || 'N/A' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-2 mt-auto pt-3 border-t border-gray-100 dark:border-gray-700">
          <button
            @click.stop="showDetails(dpe)"
            class="flex-1 flex items-center justify-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 font-medium transition-colors"
          >
            <ExternalLink class="w-4 h-4" />
            Voir détails
          </button>
          <a
            :href="`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(getFormattedAddress(dpe) + ' ' + dpe.code_postal_ban + ' ' + dpe.nom_commune_ban)}`"
            target="_blank"
            @click.stop
            class="flex-1 flex items-center justify-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
          >
            Voir sur Maps
          </a>
        </div>
      </div>
    </div>

    <!-- Modal détails -->
    <!-- Modal avec PropertyModal -->
    <PropertyModal
      v-if="selectedDPE"
      :property="selectedDPE"
      :formattedAddress="getFormattedAddress(selectedDPE)"
      :commune="selectedDPE.nom_commune_ban"
      :surface="Math.round(selectedDPE.surface_habitable_logement)"
      :energyClass="selectedDPE.etiquette_dpe"
      :mapUrl="selectedDPE._geopoint ? getGoogleMapsEmbedUrlForDPE(selectedDPE) : null"
      :geoportailUrl="getGeoportailUrl(getLatitudeFromGeopoint(selectedDPE._geopoint), getLongitudeFromGeopoint(selectedDPE._geopoint))"
      :propertyType="selectedDPE.typeBien || selectedDPE.type_batiment"
      :floor="selectedDPE.typeBien && selectedDPE.typeBien.toLowerCase().includes('appartement') && selectedDPE.etage ? selectedDPE.etage : null"
      :location="selectedDPE.complementRefLogement"
      :yearBuilt="selectedDPE.anneeConstruction ? String(selectedDPE.anneeConstruction) : null"
      :numberOfLevels="selectedDPE.nombreNiveaux"
      :ceilingHeight="selectedDPE.hauteurSousPlafond"
      :diagnosisDate="selectedDPE.date_visite_diagnostiqueur ? formatFullDate(selectedDPE.date_visite_diagnostiqueur) : null"
      :energyConsumption="selectedDPE.consommationEnergie ? Math.round(selectedDPE.consommationEnergie) : null"
      :gesEmissions="selectedDPE.emissionGES ? Math.round(selectedDPE.emissionGES) : null"
      :departmentAverages="departmentAverages"
      @close="closeModal()"
      @show-details="handleShowDetails"
    />
    
    <!-- Modal détails DPE complets -->
    <DPEDetailsModal
      :show="showDPEDetails && !!selectedDPE"
      :property="selectedDPE || {}"
      :departmentAverages="departmentAverages"
      @close="showDPEDetails = false"
    />
    
    <!-- Floating scroll to top button -->
    <ScrollToTop />
  </div>
</template>

<script>
import { Building2, Calendar, ExternalLink, Home, Trash2, X } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import {
  getGeoportailUrl,
  getGoogleMapsEmbedUrl,
  getLatitudeFromGeopoint,
  getLongitudeFromGeopoint
} from '../utils/mapUtils'
import DPEDetailsModal from './DPEDetailsModal.vue'
import PropertyModal from './PropertyModal.vue'
import ScrollToTop from './ScrollToTop.vue'

export default {
  name: 'RecentDPEResults',
  components: {
    Calendar,
    X,
    ExternalLink,
    Home,
    Building2,
    Trash2,
    PropertyModal,
    DPEDetailsModal,
    ScrollToTop
  },
  props: {
    results: {
      type: Object,
      default: null
    },
    departmentAverages: {
      type: Object,
      default: null
    }
  },
  emits: ['clear-results'],
  setup(props) {
    const selectedDPE = ref(null)
    const showDPEDetails = ref(false)
    const contextMenu = ref({
      show: false,
      x: 0,
      y: 0,
      index: null
    })
    const hiddenResults = ref(new Set())

    // Computed property for filtered results
    const filteredResults = computed(() => {
      if (!props.results?.results) return []
      return props.results.results.filter((_, index) => !hiddenResults.value.has(index))
    })

    const formatDate = dateStr => {
      const date = new Date(dateStr)
      const now = new Date()
      const diffTime = Math.abs(now - date)
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      if (diffDays === 0) return "Aujourd'hui"
      if (diffDays === 1) return 'Hier'
      if (diffDays < 7) return `Il y a ${diffDays} jours`
      if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} semaines`
      if (diffDays < 365) return `Il y a ${Math.floor(diffDays / 30)} mois`

      return date.toLocaleDateString('fr-FR')
    }

    const formatFullDate = dateStr => {
      return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    }

    const getClasseColor = classe => {
      const colors = {
        A: 'bg-green-500 text-white',
        B: 'bg-green-400 text-white',
        C: 'bg-yellow-400 text-gray-800',
        D: 'bg-orange-400 text-white',
        E: 'bg-orange-500 text-white',
        F: 'bg-red-500 text-white',
        G: 'bg-red-600 text-white'
      }
      return colors[classe?.toUpperCase()] || 'bg-gray-400 text-white'
    }

    const getGESColor = classe => {
      const colors = {
        A: 'bg-purple-500 text-white',
        B: 'bg-purple-400 text-white',
        C: 'bg-indigo-400 text-white',
        D: 'bg-blue-400 text-white',
        E: 'bg-teal-400 text-white',
        F: 'bg-cyan-500 text-white',
        G: 'bg-gray-600 text-white'
      }
      return colors[classe?.toUpperCase()] || 'bg-gray-400 text-white'
    }

    const getFormattedAddress = dpe => {
      let address = ''

      // If adresse_ban already has a number, use it as is
      if (dpe.adresse_ban && /^\d/.test(dpe.adresse_ban.trim())) {
        address = dpe.adresse_ban
      }
      // If adresse_ban doesn't have a number but adresse_brut does, combine them
      else if (dpe.adresse_ban && dpe.adresse_brut && /^\d+/.test(dpe.adresse_brut.trim())) {
        const streetNumber = dpe.adresse_brut.match(/^\d+[a-z]?\s*/i)[0].trim()
        address = `${streetNumber} ${dpe.adresse_ban}`
      }
      // Otherwise use adresse_ban or adresse_brut as fallback
      else {
        address = dpe.adresse_ban || dpe.adresse_brut || 'Adresse non disponible'
      }

      // Fix encoding issues
      return address.replace(/â€™/g, "'")
    }

    const getPropertyType = dpe => {
      if (dpe.type_batiment) {
        const type = dpe.type_batiment.toLowerCase()
        if (type.includes('appartement')) return 'appartement'
        if (type.includes('maison')) return 'maison'
      }
      return null
    }

    const getGoogleMapsEmbedUrlForDPE = dpe => {
      if (!dpe || !dpe._geopoint) return ''
      const lat = getLatitudeFromGeopoint(dpe._geopoint)
      const lon = getLongitudeFromGeopoint(dpe._geopoint)
      // Use address as fallback if needed
      const address = dpe.nom_rue_ban
        ? `${dpe.nom_rue_ban}, ${dpe.code_postal_ban} ${dpe.nom_commune_ban}, France`
        : null
      return getGoogleMapsEmbedUrl(lat, lon, address, 19)
    }

    const showDetails = dpe => {
      selectedDPE.value = dpe
      document.body.style.overflow = 'hidden'
    }

    const closeModal = () => {
      selectedDPE.value = null
      showDPEDetails.value = false
      document.body.style.overflow = ''
    }

    const handleShowDetails = () => {
      showDPEDetails.value = true
    }

    const handleEscapeKey = e => {
      if (e.key === 'Escape' && selectedDPE.value) {
        closeModal()
      }
    }

    const showContextMenu = (event, index) => {
      event.stopPropagation()
      contextMenu.value = {
        show: true,
        x: event.clientX,
        y: event.clientY,
        index: index
      }
    }

    const hideContextMenu = () => {
      contextMenu.value.show = false
    }

    const hideResult = index => {
      if (index !== null && index >= 0) {
        // Find the original index in the unfiltered results
        const originalIndex = props.results.results.findIndex((_result, i) => {
          let count = 0
          for (let j = 0; j <= i; j++) {
            if (!hiddenResults.value.has(j)) {
              if (count === index) return true
              count++
            }
          }
          return false
        })

        if (originalIndex !== -1) {
          hiddenResults.value.add(originalIndex)
        }
        hideContextMenu()
      }
    }

    // Add event listener for escape key when component is mounted
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleEscapeKey)
      window.addEventListener('click', hideContextMenu)
    }

    return {
      selectedDPE,
      showDPEDetails,
      contextMenu,
      hiddenResults,
      filteredResults,
      departmentAverages: props.departmentAverages,
      formatDate,
      formatFullDate,
      getClasseColor,
      getGESColor,
      getFormattedAddress,
      getPropertyType,
      getGoogleMapsEmbedUrlForDPE,
      getLatitudeFromGeopoint,
      getLongitudeFromGeopoint,
      getGeoportailUrl,
      showDetails,
      closeModal,
      handleShowDetails,
      showContextMenu,
      hideContextMenu,
      hideResult
    }
  },
  unmounted() {
    // Clean up event listener and body overflow
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleEscapeKey)
      window.removeEventListener('click', this.hideContextMenu)
    }
    document.body.style.overflow = ''
  }
}
</script>