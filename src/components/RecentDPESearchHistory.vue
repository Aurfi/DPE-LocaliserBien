<template>
  <div v-if="recentSearches.length > 0" class="max-w-4xl mx-auto mt-8 mb-8">
    <div class="text-center mb-6">
      <h2 class="text-2xl font-semibold text-gray-800 dark:text-gray-200">
        Recherches récentes
      </h2>
      <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
        Cliquez pour relancer une recherche
      </p>
    </div>
    
    <!-- Modal de confirmation -->
    <ConfirmationModal
      :show="showConfirmModal"
      title="Effacer l'historique"
      message="Cette action est irréversible. Toutes vos recherches récentes de DPE seront supprimées."
      confirm-text="Effacer"
      cancel-text="Annuler"
      @confirm="confirmClearHistory"
      @cancel="showConfirmModal = false"
    />
    
    <!-- Context Menu -->
    <div 
      v-if="contextMenu.show"
      class="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[120px]"
      :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
    >
      <button
        @click="deleteSearchItem(contextMenu.index)"
        class="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center gap-2"
      >
        <Trash2 class="w-4 h-4" />
        Supprimer
      </button>
    </div>
    
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="(search, index) in recentSearches"
        :key="index"
        @click="relaunchSearch(search)"
        @contextmenu.prevent="showContextMenu($event, index)"
        class="group relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer hover:scale-[1.02] border border-gray-100 dark:border-gray-700"
      >
        <!-- Badge nombre de résultats -->
        <div class="absolute -top-2 -right-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-md">
          {{ search.resultCount }} résultat{{ search.resultCount > 1 ? 's' : '' }}
        </div>
        
        <!-- Contenu de la carte -->
        <div class="space-y-3">
          <!-- Adresse -->
          <div class="flex items-start gap-2">
            <MapPin class="w-4 h-4 text-gray-400 mt-0.5" />
            <span class="font-medium text-gray-900 dark:text-gray-100 text-sm leading-tight">
              {{ formatAddress(search.address) }}
            </span>
          </div>
          
          <!-- Critères de recherche -->
          <div class="grid grid-cols-2 gap-3 text-sm">
            <!-- Période -->
            <div class="flex items-center gap-1.5">
              <Calendar class="w-3.5 h-3.5 text-gray-400" />
              <span class="text-gray-600 dark:text-gray-300">
                {{ formatPeriod(search.monthsBack) }}
              </span>
            </div>
            
            <!-- Rayon -->
            <div class="flex items-center gap-1.5">
              <Circle class="w-3.5 h-3.5 text-gray-400" />
              <span class="text-gray-600 dark:text-gray-300">
                {{ search.radius < 1 ? (search.radius * 1000) + ' m' : search.radius + ' km' }}
              </span>
            </div>
          </div>
          
          <!-- Surface et classes énergétiques -->
          <div class="flex items-center justify-between">
            <!-- Surface si spécifiée -->
            <div v-if="search.surface" class="flex items-center gap-1.5">
              <Home class="w-3.5 h-3.5 text-gray-400" />
              <span class="text-sm text-gray-600 dark:text-gray-300">
                {{ search.surface }} m²
              </span>
            </div>
            
            <!-- Classes énergétiques et GES si spécifiées -->
            <div class="flex gap-2">
              <!-- Energy classes -->
              <div v-if="search.energyClasses && search.energyClasses.length > 0" class="flex gap-1">
                <span
                  v-for="classe in search.energyClasses"
                  :key="'energy-' + classe"
                  :class="getClasseColor(classe)"
                  class="w-6 h-6 flex items-center justify-center text-xs font-bold rounded"
                  title="Classe énergétique"
                >
                  {{ classe }}
                </span>
              </div>
              <!-- GES classes -->
              <div v-if="search.gesClasses && search.gesClasses.length > 0" class="flex gap-1">
                <span
                  v-for="classe in search.gesClasses"
                  :key="'ges-' + classe"
                  :class="getClasseColor(classe)"
                  class="w-6 h-6 flex items-center justify-center text-xs font-bold rounded ring-1 ring-gray-300 dark:ring-gray-600"
                  title="Classe GES"
                >
                  {{ classe }}
                </span>
              </div>
            </div>
          </div>
          
          <!-- Timestamp -->
          <div class="flex items-center justify-end pt-3 border-t border-gray-100 dark:border-gray-700">
            <div class="flex items-center gap-1 text-xs text-gray-400">
              <Clock class="w-3 h-3" />
              {{ formatTimeAgo(search.timestamp) }}
            </div>
          </div>
        </div>
        
        <!-- Effet hover -->
        <div class="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      </div>
    </div>
    
    <!-- Bouton effacer l'historique -->
    <div class="text-center mt-6">
      <button
        @click="clearHistory"
        class="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors duration-200"
      >
        Effacer l'historique
      </button>
    </div>
  </div>
</template>

<script>
import { Calendar, Circle, Clock, Home, MapPin, Trash2 } from 'lucide-vue-next'
import ConfirmationModal from './ConfirmationModal.vue'

export default {
  name: 'RecentDPESearchHistory',
  components: {
    MapPin,
    Calendar,
    Circle,
    Home,
    Clock,
    Trash2,
    ConfirmationModal
  },
  emits: ['relaunch-search'],
  data() {
    return {
      recentSearches: [],
      showConfirmModal: false,
      contextMenu: {
        show: false,
        x: 0,
        y: 0,
        index: null
      }
    }
  },
  mounted() {
    this.loadRecentSearches()

    // Écouter les changements du localStorage
    window.addEventListener('storage', this.handleStorageChange)
    window.addEventListener('click', this.hideContextMenu)
  },
  beforeUnmount() {
    window.removeEventListener('storage', this.handleStorageChange)
    window.removeEventListener('click', this.hideContextMenu)
  },
  methods: {
    loadRecentSearches() {
      try {
        const stored = localStorage.getItem('recent_dpe_searches')
        this.recentSearches = stored ? JSON.parse(stored) : []
      } catch (_error) {
        // Erreur chargement historique - gérée silencieusement
        this.recentSearches = []
      }
    },

    handleStorageChange(e) {
      if (e.key === 'recent_dpe_searches') {
        this.loadRecentSearches()
      }
    },

    relaunchSearch(search) {
      this.$emit('relaunch-search', {
        address: search.address,
        monthsBack: search.monthsBack,
        radius: search.radius,
        surface: search.surface,
        energyClasses: search.energyClasses || [],
        gesClasses: search.gesClasses || []
      })
    },

    clearHistory() {
      this.showConfirmModal = true
    },

    confirmClearHistory() {
      localStorage.removeItem('recent_dpe_searches')
      this.recentSearches = []
      this.showConfirmModal = false
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

    deleteSearchItem(index) {
      if (index !== null && index >= 0 && index < this.recentSearches.length) {
        this.recentSearches.splice(index, 1)
        localStorage.setItem('recent_dpe_searches', JSON.stringify(this.recentSearches))
        this.hideContextMenu()
      }
    },

    formatAddress(address) {
      // Tronquer si trop long
      if (address.length > 60) {
        return `${address.substring(0, 57)}...`
      }
      return address
    },

    formatPeriod(months) {
      if (months === 1) return '1 mois'
      if (months < 12) return `${months} mois`
      if (months === 12) return '1 an'
      if (months === 24) return '2 ans'
      if (months === 48) return '4 ans'
      return `${Math.floor(months / 12)} ans`
    },

    formatTimeAgo(timestamp) {
      const now = Date.now()
      const diff = now - timestamp
      const minutes = Math.floor(diff / 60000)
      const hours = Math.floor(diff / 3600000)
      const days = Math.floor(diff / 86400000)

      if (minutes < 1) return "À l'instant"
      if (minutes < 60) return `Il y a ${minutes} min`
      if (hours < 24) return `Il y a ${hours}h`
      if (days < 7) return `Il y a ${days}j`
      return new Date(timestamp).toLocaleDateString('fr-FR')
    },

    getClasseColor(classe) {
      const colors = {
        A: 'bg-green-500 text-white',
        B: 'bg-green-400 text-white',
        C: 'bg-yellow-400 text-gray-800',
        D: 'bg-orange-400 text-white',
        E: 'bg-orange-500 text-white',
        F: 'bg-red-500 text-white',
        G: 'bg-purple-600 text-white'
      }
      return colors[classe] || 'bg-gray-400 text-white'
    }
  }
}
</script>