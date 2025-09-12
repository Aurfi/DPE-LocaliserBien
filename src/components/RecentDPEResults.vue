<template>
  <div v-if="results" class="mt-8 max-w-6xl mx-auto">
    <!-- En-tête des résultats -->
    <div class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-3xl shadow-xl p-6 mb-6 border border-white/50 dark:border-gray-700/50">
      <div class="flex items-center justify-between">
        <div class="flex-1">
          <h3 class="text-xl font-bold text-gray-800 dark:text-gray-200">
            {{ filteredResults.length }} résultat{{ filteredResults.length > 1 ? 's' : '' }} affiché{{ filteredResults.length > 1 ? 's' : '' }}
            <span v-if="hiddenResults.size > 0" class="text-sm text-gray-500 dark:text-gray-400">({{ hiddenResults.size }} masqué{{ hiddenResults.size > 1 ? 's' : '' }})</span>
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Autour de {{ results.searchAddress }}
            <span class="text-xs text-gray-500 dark:text-gray-500">(rayon: {{ results.searchRadius }} km)</span>
          </p>
        </div>
        <div class="flex items-center gap-3">
          <!-- Menu déroulant de tri - afficher seulement s'il y a plus de 3 résultats -->
          <div v-if="filteredResults.length > 3" class="flex items-center gap-2">
            <span class="text-sm text-gray-600 dark:text-gray-400">Trier :</span>
            <div class="relative">
              <select 
                v-model="sortBy"
                @change="sortResults"
                class="appearance-none bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm rounded-lg px-3 py-2 pr-8 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors cursor-pointer"
              >
                <option value="distance">Par distance</option>
                <option value="surface">Par surface</option>
                <option value="date-desc">Par DPE (récent)</option>
                <option value="date-asc">Par DPE (ancien)</option>
                <option value="construction-desc">Par année de construction (récent)</option>
                <option value="construction-asc">Par année de construction (ancien)</option>
              </select>
              <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500 dark:text-gray-400">
                <ChevronDown class="w-4 h-4" />
              </div>
            </div>
          </div>
          <button
            @click="$emit('clear-results')"
            class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <X class="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>

    <!-- Menu contextuel -->
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
            <div class="font-bold text-gray-800 dark:text-gray-200">{{ Math.round(dpe.surfaceHabitable) }} m²</div>
          </div>

          <!-- Année de construction -->
          <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
            <div class="text-xs text-gray-500 dark:text-gray-400">Année</div>
            <div class="font-bold text-gray-800 dark:text-gray-200">
              {{ formatYearDisplay(dpe.anneeConstruction) }}
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
            :href="(() => {
              // Force address-first; include region label for DOM-TOM
              const region = getGoogleRegionLabel(dpe.code_postal_ban || dpe.code_postal_brut)
              const text = `${getFormattedAddress(dpe)} ${dpe.code_postal_ban || ''} ${dpe.nom_commune_ban || ''}, ${region}`
              return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text.trim())}`
            })()"
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
    
    <!-- Bouton flottant pour remonter en haut -->
    <ScrollToTop />
  </div>
</template>

<script>
import { Building2, Calendar, ChevronDown, ExternalLink, Home, Trash2, X } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import {
  getGeoportailUrl,
  getGoogleMapsEmbedUrl,
  getGoogleRegionLabel,
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
    ChevronDown,
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
    const sortBy = ref('distance') // Tri par défaut par distance pour les recherches récentes

    // Propriété calculée pour les résultats filtrés avec tri
    const filteredResults = computed(() => {
      if (!props.results?.results) return []

      // D'abord filtrer les résultats masqués
      let results = props.results.results.filter((_, index) => !hiddenResults.value.has(index))

      // Puis appliquer le tri
      if (sortBy.value === 'surface') {
        // Trier par surface (décroissant - plus grand en premier)
        results = [...results].sort((a, b) => {
          const surfA = a.surfaceHabitable || 0
          const surfB = b.surfaceHabitable || 0
          return surfB - surfA
        })
      } else if (sortBy.value === 'construction-asc') {
        // Trier par année de construction (croissant - ancien en premier)
        results = [...results].sort((a, b) => {
          const yearA = extractYearFromValue(a.anneeConstruction) || 9999
          const yearB = extractYearFromValue(b.anneeConstruction) || 9999
          return yearA - yearB
        })
      } else if (sortBy.value === 'construction-desc') {
        // Trier par année de construction (décroissant - récent en premier)
        results = [...results].sort((a, b) => {
          const yearA = extractYearFromValue(a.anneeConstruction) || 0
          const yearB = extractYearFromValue(b.anneeConstruction) || 0
          return yearB - yearA
        })
      } else if (sortBy.value === 'date-desc') {
        // Trier par date (décroissant - plus récent en premier)
        results = [...results].sort((a, b) => {
          const dateA = a.date_etablissement_dpe ? new Date(a.date_etablissement_dpe).getTime() : 0
          const dateB = b.date_etablissement_dpe ? new Date(b.date_etablissement_dpe).getTime() : 0
          return dateB - dateA
        })
      } else if (sortBy.value === 'date-asc') {
        // Trier par date (croissant - plus ancien en premier)
        results = [...results].sort((a, b) => {
          const dateA = a.date_etablissement_dpe ? new Date(a.date_etablissement_dpe).getTime() : 0
          const dateB = b.date_etablissement_dpe ? new Date(b.date_etablissement_dpe).getTime() : 0
          return dateA - dateB
        })
      } else {
        // Par défaut : trier par distance (croissant - plus proche en premier)
        results = [...results].sort((a, b) => {
          const distA = a.distance !== undefined ? a.distance : Infinity
          const distB = b.distance !== undefined ? b.distance : Infinity
          return distA - distB
        })
      }

      return results
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

      // Si adresse_ban a déjà un numéro, l'utiliser tel quel
      if (dpe.adresse_ban && /^\d/.test(dpe.adresse_ban.trim())) {
        address = dpe.adresse_ban
      }
      // Si adresse_ban n'a pas de numéro mais adresse_brut en a, les combiner
      else if (dpe.adresse_ban && dpe.adresse_brut && /^\d+/.test(dpe.adresse_brut.trim())) {
        const streetNumber = dpe.adresse_brut.match(/^\d+[a-z]?\s*/i)[0].trim()
        address = `${streetNumber} ${dpe.adresse_ban}`
      }
      // Sinon utiliser adresse_ban ou adresse_brut comme solution de repli
      else {
        address = dpe.adresse_ban || dpe.adresse_brut || 'Adresse non disponible'
      }

      // Corriger les problèmes d'encodage
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
      if (!dpe) return ''
      const lat = getLatitudeFromGeopoint(dpe._geopoint)
      const lon = getLongitudeFromGeopoint(dpe._geopoint)
      // Construire une adresse adaptée à la région ; préférer l'adresse pour Google
      const region = getGoogleRegionLabel(dpe.code_postal_ban || dpe.code_postal_brut)
      const baseAddress = dpe.nom_rue_ban || dpe.adresse_ban || dpe.adresse_brut || ''
      const cityPart = `${dpe.code_postal_ban || dpe.code_postal_brut || ''} ${dpe.nom_commune_ban || ''}`.trim()
      const address = `${baseAddress ? `${baseAddress}, ` : ''}${cityPart}${cityPart ? ', ' : ''}${region}`
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

    const sortResults = () => {
      // Le tri est géré de manière réactive dans la propriété calculée
      // Cette méthode sert juste à déclencher le recalcul quand le menu déroulant change
    }

    const hideResult = index => {
      if (index !== null && index >= 0) {
        // Trouver l'index original dans les résultats non filtrés
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

    // Extraire l'année d'une valeur qui peut être une année simple ou une plage (ex: "1948-1974")
    const extractYearFromValue = value => {
      if (!value) return null
      const strValue = String(value)
      // Chercher le premier nombre à 4 chiffres
      const match = strValue.match(/(\d{4})/)
      return match ? parseInt(match[1], 10) : null
    }

    // Formater l'affichage de l'année (garder la plage complète pour l'affichage)
    const formatYearDisplay = value => {
      return value || 'N/A'
    }

    // Ajouter un écouteur d'événements pour la touche échap quand le composant est monté
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
      sortBy,
      sortResults,
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
      getGoogleRegionLabel,
      showDetails,
      closeModal,
      handleShowDetails,
      showContextMenu,
      hideContextMenu,
      hideResult,
      extractYearFromValue,
      formatYearDisplay
    }
  },
  unmounted() {
    // Nettoyer l'écouteur d'événements et le débordement du body
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleEscapeKey)
      window.removeEventListener('click', this.hideContextMenu)
    }
    document.body.style.overflow = ''
  }
}
</script>

