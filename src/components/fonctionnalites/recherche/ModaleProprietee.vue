<template>
  <div>
    <!-- Modal principale -->
    <div v-if="property" ref="modalLayer" data-modal-layer="property" :style="{ zIndex: 10000 + modalDepth }" class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-4 " @click.self="$emit('close')">
      <div ref="modalDialog" role="dialog" tabindex="-1" :aria-modal="modalIsTop ? 'true' : undefined" :aria-labelledby="modalTitleId" class="bg-white dark:bg-gray-800 rounded-xl  max-w-4xl w-full max-h-[85vh] overflow-hidden border border-gray-100 dark:border-gray-700">
      <!-- En-tête de la modal -->
      <div class="p-3 sm:p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 flex items-start justify-between gap-2">
        <div class="flex-1 min-w-0">
          <h3 :id="modalTitleId" tabindex="-1" data-modal-initial-focus class="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1 sm:mb-2 pr-2 line-clamp-2">
            {{ formattedAddress }}
          </h3>
          <div class="flex flex-wrap items-center gap-2 sm:gap-4 text-sm sm:text-base text-gray-600 dark:text-gray-300">
            <div class="flex items-center gap-1">
              <svg class="w-4 h-4 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
              <span class="font-medium">{{ commune }}</span>
            </div>
            <span class="text-gray-400 dark:text-gray-500">•</span>
            <span class="font-medium">{{ surface }}m²</span>
            <span class="inline text-gray-400 dark:text-gray-500">•</span>
            <a
              :href="getGoogleMapsUrl()"
              title="Ouvrir Google Maps dans un nouvel onglet"
              target="_blank"
              rel="noopener noreferrer"
              class="inline text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
              @click.stop
            >
              Voir sur Maps
            </a>
            <!-- Score - masqué sur mobile -->
            <span v-if="matchScore" class="hidden sm:inline text-gray-400 dark:text-gray-500">•</span>
            <span v-if="matchScore" :class="getScoreBadgeClass(matchScore)" :aria-label="`Score de similarité : ${Math.round(matchScore)} sur 100`" class="score-badge hidden sm:inline-block whitespace-nowrap px-2 py-0.5 rounded text-xs font-bold">
              Score {{ Math.round(matchScore) }}/100
            </span>
            <span v-else-if="energyClass" class="hidden sm:inline text-gray-400 dark:text-gray-500">•</span>
            <span v-else-if="energyClass" :class="getClasseColor(energyClass)" class="hidden sm:inline-block px-2 py-0.5 rounded text-xs font-bold">
              Classe {{ energyClass }}
            </span>
          </div>
        </div>
        <!-- Bouton fermer - toujours visible et avec une taille minimum garantie -->
        <button
          @click="$emit('close')"
          aria-label="Fermer"
          class="flex-shrink-0 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors bg-white dark:bg-gray-700 rounded-full p-2 hover:bg-gray-50 dark:hover:bg-gray-600 min-w-[40px] min-h-[40px] flex items-center justify-center"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      
      <!-- Contenu de la modal -->
      <div class="p-4 space-y-4 bg-gray-50 dark:bg-gray-900 overflow-y-auto" style="max-height: calc(85vh - 100px);">
        <p v-if="matchScore" data-score-explanation class="text-sm text-gray-600 dark:text-gray-400">
          Le score de similarité compare les critères saisis. Même à 100/100, il ne confirme pas l’identité du bien.
        </p>
        <!-- Informations sur le bien -->
        <div class="grid md:grid-cols-2 gap-4">
          <!-- Informations principales -->
          <div class="bg-white dark:bg-gray-800 rounded-xl p-3  border border-gray-200 dark:border-gray-700">
            <h4 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <span class="flex items-center">
                <svg class="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h-2M9 7h6m-6 4h6m-6 4h6"></path>
                </svg>
                Caractéristiques
              </span>
              <a 
                v-if="geoportailUrl"
                :href="geoportailUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-normal flex items-center gap-1 transition-colors"
                @click.stop
              >
                <ExternalLink class="w-4 h-4" />
                DVF Data.Gouv
              </a>
            </h4>
            <div class="space-y-1.5">
              <div class="flex flex-wrap justify-between items-center gap-x-3 gap-y-1 px-2 py-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span class="text-gray-600 dark:text-gray-300 text-sm">Surface habitable:</span>
                <span class="font-semibold text-gray-900 dark:text-gray-100 text-sm">{{ surface }}m²</span>
              </div>
              <div v-if="propertyType" class="flex flex-wrap justify-between items-center gap-x-3 gap-y-1 px-2 py-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span class="text-gray-600 dark:text-gray-300 text-sm">Type de bien:</span>
                <span class="font-semibold text-gray-900 dark:text-gray-100 text-sm">{{ propertyType }}</span>
              </div>
              <div v-if="floor" class="flex flex-wrap justify-between items-center gap-x-3 gap-y-1 px-2 py-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span class="text-gray-600 dark:text-gray-300 text-sm">Étage:</span>
                <span class="font-semibold text-gray-900 dark:text-gray-100 text-sm">{{ floor }}</span>
              </div>
              <div v-if="yearBuilt" class="flex flex-wrap justify-between items-center gap-x-3 gap-y-1 px-2 py-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span class="text-gray-600 dark:text-gray-300 text-sm">Année de construction:</span>
                <span data-construction-year class="font-semibold text-gray-900 dark:text-gray-100 text-sm">{{ formatYearDisplay(yearBuilt) }}</span>
              </div>
              <div v-if="location" class="flex flex-wrap justify-between items-center gap-x-3 gap-y-1 px-2 py-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span class="text-gray-600 dark:text-gray-300 text-sm">Localisation:</span>
                <span class="font-semibold text-gray-900 dark:text-gray-100 text-sm">{{ location }}</span>
              </div>
              <div v-if="numberOfLevels" class="flex flex-wrap justify-between items-center gap-x-3 gap-y-1 px-2 py-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span class="text-gray-600 dark:text-gray-300 text-sm">Nombre de niveaux:</span>
                <span class="font-semibold text-gray-900 dark:text-gray-100 text-sm">{{ numberOfLevels }}</span>
              </div>
              <div v-if="ceilingHeight" class="flex flex-wrap justify-between items-center gap-x-3 gap-y-1 px-2 py-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span class="text-gray-600 dark:text-gray-300 text-sm">Hauteur sous plafond:</span>
                <span class="font-semibold text-gray-900 dark:text-gray-100 text-sm">{{ ceilingHeight }} m</span>
              </div>
            </div>
          </div>
          
          <!-- Performance énergétique -->
          <div class="bg-white dark:bg-gray-800 rounded-xl p-3  border border-gray-200 dark:border-gray-700">
            <h4 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <span class="flex items-center">
                <svg class="w-4 h-4 mr-2 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
                Performance énergétique
              </span>
              <button
                @click="$emit('show-details')"
                class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-normal flex items-center gap-1 transition-colors"
              >
                <ExternalLink class="w-4 h-4" />
                Détails complets
              </button>
            </h4>
            <div class="space-y-1.5">
              <div v-if="diagnosisDate" class="flex flex-wrap justify-between items-center gap-x-3 gap-y-1 px-2 py-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span class="text-gray-600 dark:text-gray-300 text-sm">Date du diagnostic:</span>
                <span class="font-semibold text-gray-900 dark:text-gray-100 text-sm">{{ diagnosisDate }}</span>
              </div>
              <div v-if="energyConsumption" class="flex flex-wrap justify-between items-center gap-x-3 gap-y-1 px-2 py-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span class="text-gray-600 dark:text-gray-300 text-sm">Consommation:</span>
                <span class="font-semibold text-gray-900 dark:text-gray-100 text-sm">{{ energyConsumption }} kWh/m²/an</span>
              </div>
              <div v-if="gesEmissions" class="flex flex-wrap justify-between items-center gap-x-3 gap-y-1 px-2 py-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span class="text-gray-600 dark:text-gray-300 text-sm">Émissions CO₂:</span>
                <span class="font-semibold text-gray-900 dark:text-gray-100 text-sm">{{ gesEmissions }} kg/m²/an</span>
              </div>
              <div v-if="getDeptAverage()" class="flex flex-wrap justify-between items-center gap-x-3 gap-y-1 px-2 py-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                <span class="text-gray-600 dark:text-gray-300 text-sm">Moyenne dépt. {{ departmentAverages.department }}:</span>
                <span class="font-semibold text-sm" :class="energyConsumption < getDeptAverage() ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'">
                  {{ Math.round(getDeptAverage()) }} kWh/m²/an
                </span>
              </div>
              <div v-if="energyClass" class="flex flex-wrap justify-between items-center gap-x-3 gap-y-1 px-2 py-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span class="text-gray-600 dark:text-gray-300 text-sm">Note DPE:</span>
                <span :class="getClasseColor(energyClass)" class="px-2 py-0.5 rounded text-xs font-bold">
                  {{ energyClass }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  </div>
</template>

<script>
import { ExternalLink } from 'lucide-vue-next'
import { useModalLayer } from '../../../composables/useModalLayer.js'
import { formatYearDisplay } from '../../../utils/formateursDPE.js'

export default {
  name: 'ModaleProprietee',
  components: {
    ExternalLink
  },
  setup(_props, { emit }) {
    return useModalLayer(() => emit('close'))
  },
  props: {
    property: {
      type: Object,
      required: true
    },
    // Address & location
    formattedAddress: String,
    commune: String,
    surface: Number,
    matchScore: Number,
    energyClass: String,

    // Map & links
    mapUrl: String,
    geoportailUrl: String,

    // Characteristics
    propertyType: String,
    floor: String,
    yearBuilt: String,
    location: String,
    numberOfLevels: Number,
    ceilingHeight: Number,

    // Performance
    diagnosisDate: String,
    energyConsumption: Number,
    gesEmissions: Number,

    // Department averages
    departmentAverages: {
      type: Object,
      default: null
    }
  },
  emits: ['close', 'show-details'],
  methods: {
    formatYearDisplay,
    getScoreBadgeClass(score) {
      if (score === 100) return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
      if (score >= 90) return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
      if (score >= 70) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
    },

    getClasseColor(classe) {
      const colors = {
        A: 'bg-green-500 text-white',
        B: 'bg-green-600 text-white',
        C: 'bg-yellow-400 text-gray-800',
        D: 'bg-orange-400 text-white',
        E: 'bg-orange-500 text-white',
        F: 'bg-red-500 text-white',
        G: 'bg-red-600 text-white'
      }
      return colors[classe?.toUpperCase()] || 'bg-gray-400 text-white'
    },

    getDeptAverage() {
      if (!this.departmentAverages || !this.surface) return null

      // Find the appropriate surface range
      let range = null

      for (const surfaceRange of this.departmentAverages.surfaceRanges) {
        const [min, max] = surfaceRange.range
          .replace('m²', '')
          .replace('+', '-999')
          .split('-')
          .map(n => parseInt(n, 10))
        if (this.surface >= min && (max === 999 || this.surface <= max)) {
          range = surfaceRange
          break
        }
      }

      // Use overall average if no matching range found
      if (!range) {
        range = this.departmentAverages.overall
      }

      return range ? range.consumption.total : null
    },

    getGoogleMapsUrl() {
      if (!this.property) return '#'

      // Construire l'URL Google Maps avec l'adresse
      const address = `${this.formattedAddress}, ${this.commune}`
      const query = encodeURIComponent(address)
      return `https://www.google.com/maps/search/?api=1&query=${query}`
    }
  }
}
</script>
