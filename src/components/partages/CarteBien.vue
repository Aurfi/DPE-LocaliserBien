<template>
  <div
    class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all duration-200 flex flex-col h-full"
    :class="{ 'cursor-pointer': !hasIncompleteData, 'cursor-not-allowed opacity-90': hasIncompleteData }"
    @click="!hasIncompleteData && $emit('click', result)"
    @contextmenu.prevent="showMenuContextuel($event)"
  >
    <div class="px-5 pt-4 pb-5 flex flex-col h-full">
      <!-- Date, distance et score -->
      <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-3">
        <div class="flex items-center gap-1 relative inline-block group">
          <Calendar class="w-3.5 h-3.5" />
          <span v-if="dateDisplay">{{ dateDisplay }}</span>
          <!-- Date tooltip -->
          <div v-if="dateTooltip" class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-10 backdrop-blur-md shadow-lg bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30">
            {{ dateTooltip }}
          </div>
        </div>
        <div class="flex items-center gap-3">
          <div v-if="distance !== undefined" class="relative inline-block group">
            <span class="text-gray-600 dark:text-gray-400 text-sm">{{ distance.toFixed(1) }} km</span>
            <!-- Distance tooltip -->
            <div v-if="distanceTooltip" class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-10 backdrop-blur-md shadow-lg bg-gray-500/20 text-gray-700 dark:text-gray-300 border border-gray-500/30">
              {{ distanceTooltip }}
            </div>
          </div>
          <!-- Icône du type de bien -->
          <Home v-if="propertyType === 'maison'" class="w-4 h-4 text-blue-500 dark:text-blue-400" />
          <Building2 v-else-if="propertyType === 'appartement'" class="w-4 h-4 text-purple-500 dark:text-purple-400" />
          <Home v-else class="w-4 h-4 text-gray-300 dark:text-gray-600" />
          <!-- Score de correspondance -->
          <div v-if="score !== undefined" class="relative inline-block group">
            <span
              :class="getScoreBadgeClass(score)"
              class="inline-block px-2 py-0.5 rounded text-xs font-bold"
            >
              {{ isNaN(score) ? 0 : Math.round(score) }}%
            </span>
            <!-- Score tooltip -->
            <div
              v-if="scoreTooltip"
              :class="getTooltipClass(score)"
              class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-10 backdrop-blur-md shadow-lg"
            >
              {{ scoreTooltip }}
            </div>
          </div>
        </div>
      </div>

      <!-- Adresse -->
      <div class="min-h-[4rem] mb-4">
        <h3 v-if="!hasIncompleteData" class="font-semibold text-gray-900 dark:text-gray-100 text-base mb-1 line-clamp-2">
          {{ address }}
        </h3>
        <h3 v-else class="font-semibold text-amber-700 dark:text-amber-400 text-base mb-1">
          Adresse non disponible
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ location }}
        </p>
      </div>

      <!-- Legacy DPE Warning -->
      <div v-if="isLegacy" class="mb-3">
        <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg px-3 py-2">
          <div class="flex items-center gap-2">
            <AlertTriangle class="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span class="text-xs font-medium text-amber-700 dark:text-amber-300">DPE Ancien (avant 07/2021)</span>
          </div>
        </div>
      </div>

      <!-- Informations clés -->
      <div class="grid gap-2 mb-3" :class="shouldShowFloor ? 'grid-cols-3' : 'grid-cols-2'">
        <!-- Surface -->
        <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
          <div class="text-xs text-gray-500 dark:text-gray-400">Surface</div>
          <div class="font-bold text-gray-800 dark:text-gray-200">{{ surface }} m²</div>
        </div>

        <!-- Année de construction -->
        <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
          <div class="text-xs text-gray-500 dark:text-gray-400">Construction</div>
          <div class="font-bold text-gray-800 dark:text-gray-200">{{ yearBuilt || 'N/A' }}</div>
        </div>

        <!-- Étage (seulement pour appartements avec une valeur) -->
        <div v-if="shouldShowFloor" class="bg-gray-50 dark:bg-gray-700/50 rounded-md p-1.5">
          <div class="text-xs text-gray-500 dark:text-gray-400">Étage</div>
          <div class="font-bold text-gray-800 dark:text-gray-200">
            {{ formatFloor(floor) }}
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex justify-center mt-auto pt-3 border-t border-gray-100 dark:border-gray-700">
        <button
          v-if="!hasIncompleteData"
          @click.stop="$emit('click', result)"
          class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 font-medium text-sm py-2 px-4 transition-colors flex items-center justify-center gap-1"
        >
          <ExternalLink class="w-3.5 h-3.5" />
          Voir détails
        </button>
        <button
          v-if="hasIncompleteData"
          @click.stop="$emit('show-raw-data', result)"
          class="text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-medium text-sm py-2 px-4 transition-colors flex items-center justify-center gap-1"
        >
          <Database class="w-3.5 h-3.5" />
          Voir données brutes
        </button>
      </div>
    </div>

    <!-- Context menu -->
    <div
      v-if="contextMenuShow"
      class="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[120px]"
      :style="{ top: contextMenuY + 'px', left: contextMenuX + 'px' }"
    >
      <button
        @click.stop="hideResult"
        class="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center gap-2"
      >
        <Trash2 class="w-4 h-4" />
        Masquer
      </button>
    </div>
  </div>
</template>

<script>
import { AlertTriangle, Building2, Calendar, Database, ExternalLink, Home, Trash2 } from 'lucide-vue-next'

export default {
  name: 'CarteBien',
  components: {
    Calendar,
    Home,
    Building2,
    ExternalLink,
    Database,
    Trash2,
    AlertTriangle
  },
  props: {
    result: {
      type: Object,
      required: true
    },
    index: {
      type: Number,
      required: true
    },
    // Display props
    dateDisplay: String,
    dateTooltip: String,
    distance: Number,
    distanceTooltip: String,
    propertyType: String,
    score: Number,
    scoreTooltip: String,
    address: String,
    location: String,
    surface: [String, Number],
    floor: String,
    yearBuilt: [String, Number],
    hasIncompleteData: Boolean,
    isLegacy: Boolean
  },
  data() {
    return {
      contextMenuShow: false,
      contextMenuX: 0,
      contextMenuY: 0
    }
  },
  computed: {
    shouldShowFloor() {
      // Only show floor for apartments with a valid floor value (not null, not '-', not empty)
      return this.propertyType === 'appartement' && this.floor && this.floor !== '-'
    }
  },
  mounted() {
    window.addEventListener('click', this.hideMenuContextuel)
  },
  unmounted() {
    window.removeEventListener('click', this.hideMenuContextuel)
  },
  methods: {
    showMenuContextuel(event) {
      event.stopPropagation()
      this.contextMenuShow = true
      this.contextMenuX = event.clientX
      this.contextMenuY = event.clientY
    },

    hideMenuContextuel() {
      this.contextMenuShow = false
    },

    hideResult() {
      this.$emit('hide', this.index)
      this.hideMenuContextuel()
    },

    formatFloor(floor) {
      if (!floor) return '-'

      const floorStr = String(floor).trim()

      // If it already has "Étage:" prefix, just show the number part
      if (floorStr.includes('Étage:')) {
        return floorStr.replace('Étage:', '').trim()
      }

      // If it's RDC, show as is
      if (floorStr === 'RDC' || floorStr.toLowerCase() === 'rdc') {
        return 'RDC'
      }

      // If it's just a number, return it
      if (!Number.isNaN(floorStr) && floorStr !== '') {
        return floorStr
      }

      // Otherwise return the floor value as is
      return floorStr || '-'
    },

    getScoreBadgeClass(score) {
      if (Number.isNaN(score) || score === null || score === undefined) {
        return 'bg-gray-400 text-white'
      }
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
      if (Number.isNaN(score) || score === null || score === undefined) {
        return 'bg-gray-500/40 text-gray-700 dark:text-gray-300 border border-gray-500/50'
      }
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
    }
  },
  emits: ['click', 'hide', 'show-raw-data']
}
</script>