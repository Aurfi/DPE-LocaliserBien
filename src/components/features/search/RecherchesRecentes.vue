<template>
  <div v-if="recentSearches.length > 0" class="max-w-4xl mx-auto mb-8">
    <div class="text-center mb-6">
      <h2 class="text-2xl font-semibold text-gray-800 dark:text-gray-200">
        Recherches récentes
      </h2>
      <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
        Cliquez pour relancer une recherche
      </p>
    </div>
    
    <!-- Modal de confirmation -->
    <ModaleConfirmation
      :show="showConfirmModal"
      title="Effacer l'historique"
      message="Cette action est irréversible. Toutes vos recherches récentes seront supprimées."
      confirm-text="Effacer"
      cancel-text="Annuler"
      @confirm="confirmClearHistory"
      @cancel="showConfirmModal = false"
    />
    
    <!-- Modal de renommage -->
    <ModaleEntree
      :show="showRenameModal"
      title="Renommer la recherche"
      message="Entrez un nom personnalisé pour cette recherche"
      :initial-value="renameInitialValue"
      placeholder="Ex: Maison de vacances"
      confirm-text="Renommer"
      cancel-text="Annuler"
      @confirm="confirmRename"
      @cancel="showRenameModal = false"
    />
    
    <!-- Context Menu -->
    <div 
      v-if="contextMenu.show"
      class="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[140px]"
      :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
    >
      <button
        @click="renameSearchItem(contextMenu.index)"
        class="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center gap-2"
      >
        <Edit2 class="w-4 h-4" />
        Renommer
      </button>
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
        <!-- Badge nombre de résultats avec couleur selon les correspondances parfaites -->
        <div 
          class="absolute -top-2 right-2 text-white font-medium px-2 py-1 rounded-full shadow-md flex items-center"
          :class="getResultBubbleColor(search)"
        >
          <span class="text-sm">{{ search.resultCount }}</span> <span class="text-sm ml-1">résultat{{ search.resultCount > 1 ? 's' : '' }}</span>
        </div>
        
        
        <!-- Contenu de la carte -->
        <div class="space-y-3">
          <!-- Commune -->
          <div class="flex items-center gap-2">
            <MapPin class="w-4 h-4 text-gray-400" />
            <span class="font-medium text-gray-900 dark:text-gray-100 text-lg">
              {{ search.displayName || formatCommune(search.commune) }}
            </span>
          </div>
          
          <!-- Infos DPE - Surface sur sa ligne -->
          <div class="flex items-center gap-1.5 text-sm">
            <!-- Icône selon le type de bien -->
            <Home v-if="search.typeBien === 'maison'" class="w-3.5 h-3.5 text-gray-400" />
            <Building2 v-else-if="search.typeBien === 'appartement'" class="w-3.5 h-3.5 text-gray-400" />
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400">
              <path d="M12 3v17a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1H3"/>
              <path d="m16 19 2 2 4-4"/>
            </svg>
            <span class="text-gray-600 dark:text-gray-300">
              {{ search.surface }} m²
            </span>
          </div>
          
          <!-- Consommation et GES sur la même ligne -->
          <div class="flex items-center gap-4 text-sm">
            <!-- Consommation -->
            <div v-if="search.consommation" class="flex items-center gap-1.5">
              <Zap class="w-3.5 h-3.5 text-gray-400" />
              <span class="text-gray-600 dark:text-gray-300">
                {{ search.consommation }} kWh
              </span>
            </div>
            
            <!-- GES -->
            <div v-if="search.ges" class="flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
              </svg>
              <span class="text-gray-600 dark:text-gray-300">
                {{ search.ges }} kg CO₂
              </span>
            </div>
          </div>
          
          <!-- Classes sélectionnées ou calculées -->
          <div class="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <div class="flex items-center gap-2">
              <!-- Classe énergétique -->
              <span v-if="search.energyClass" class="px-2 py-0.5 text-xs font-bold rounded" :class="getEnergyClassColor(search.energyClass)">
                {{ search.energyClass }}
              </span>
              <span v-else-if="search.consommation" class="px-2 py-0.5 text-xs font-bold rounded" :class="getEnergyClassColor(getEnergyClass(search.consommation))">
                {{ getEnergyClass(search.consommation) }}
              </span>
              
              <!-- Classe GES -->
              <span v-if="search.gesClass" class="px-2 py-0.5 text-xs font-bold rounded" :class="getGESClassColor(search.gesClass)">
                {{ search.gesClass }}
              </span>
              <span v-else-if="search.ges" class="px-2 py-0.5 text-xs font-bold rounded" :class="getGESClassColor(getGESClass(search.ges))">
                {{ getGESClass(search.ges) }}
              </span>
            </div>
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
import { Building2, Clock, Edit2, Home, MapPin, Trash2, Zap } from 'lucide-vue-next'
import ModaleConfirmation from '../../base/ModaleConfirmation.vue'
import ModaleEntree from '../../base/ModaleEntree.vue'

export default {
  name: 'RecherchesRecentes',
  components: {
    MapPin,
    Home,
    Building2,
    Zap,
    Clock,
    Trash2,
    Edit2,
    ModaleConfirmation,
    ModaleEntree
  },
  emits: ['relaunch-search'],
  data() {
    return {
      recentSearches: [],
      showConfirmModal: false,
      showRenameModal: false,
      renameIndex: null,
      renameInitialValue: '',
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
    window.addEventListener('storage', this.handleStorageChange)
    window.addEventListener('click', this.hideContextMenu)
  },
  beforeUnmount() {
    window.removeEventListener('storage', this.handleStorageChange)
    window.removeEventListener('click', this.hideContextMenu)
  },
  methods: {
    loadRecentSearches() {
      const stored = localStorage.getItem('dpe_recent_searches')
      if (stored) {
        try {
          const searches = JSON.parse(stored)
          this.recentSearches = searches.slice(0, 6)
        } catch (_e) {
          // Erreur lors du chargement des recherches récentes - gérée silencieusement
          this.recentSearches = []
        }
      }
    },

    handleStorageChange(e) {
      if (e.key === 'dpe_recent_searches') {
        this.loadRecentSearches()
      }
    },

    formatCommune(commune) {
      if (!commune) return 'N/A'

      // Si c'est juste un code postal
      if (/^\d{5}$/.test(commune)) {
        return commune
      }

      // Si c'est "nom de commune (code postal)"
      const match = commune.match(/^(.+?)\s*\((\d{5})\)$/)
      if (match) {
        let communeName = match[1].trim()
        const postalCode = match[2]

        // Tronquer le nom de la commune si trop long
        if (communeName.length > 15) {
          communeName = `${communeName.substring(0, 14)}...`
        }

        return `${communeName} (${postalCode})`
      }

      // Si c'est juste un nom de commune
      let formattedName = commune.charAt(0).toUpperCase() + commune.slice(1).toLowerCase()
      if (formattedName.length > 18) {
        formattedName = `${formattedName.substring(0, 17)}...`
      }
      return formattedName
    },

    getEnergyClass(consommation) {
      if (consommation <= 50) return 'A'
      if (consommation <= 90) return 'B'
      if (consommation <= 150) return 'C'
      if (consommation <= 230) return 'D'
      if (consommation <= 330) return 'E'
      if (consommation <= 450) return 'F'
      return 'G'
    },

    getEnergyClassColor(classe) {
      const colors = {
        A: 'bg-green-500 text-white',
        B: 'bg-green-400 text-white',
        C: 'bg-yellow-400 text-gray-800',
        D: 'bg-orange-400 text-white',
        E: 'bg-orange-500 text-white',
        F: 'bg-red-500 text-white',
        G: 'bg-purple-600 text-white'
      }
      return colors[classe?.toUpperCase()] || 'bg-gray-400 text-white'
    },

    getGESClass(emission) {
      if (emission <= 5) return 'A'
      if (emission <= 10) return 'B'
      if (emission <= 25) return 'C'
      if (emission <= 35) return 'D'
      if (emission <= 55) return 'E'
      if (emission <= 80) return 'F'
      return 'G'
    },

    getGESClassColor(classe) {
      // Utiliser les mêmes couleurs que les classes énergétiques pour la cohérence
      return this.getEnergyClassColor(classe)
    },

    getResultBubbleColor(search) {
      // Vert si une correspondance parfaite
      if (search.perfectMatchCount === 1 || (search.matchScore >= 99 && !search.perfectMatchCount)) {
        return 'bg-green-500'
      }
      // Teal si plusieurs correspondances parfaites (bon mais pas unique)
      if (search.perfectMatchCount > 1) {
        return 'bg-teal-500'
      }
      // Bleu par défaut (pas de correspondance parfaite)
      return 'bg-blue-500'
    },

    formatTimeAgo(timestamp) {
      if (!timestamp) return ''

      const now = Date.now()
      const diff = now - timestamp
      const minutes = Math.floor(diff / 60000)
      const hours = Math.floor(diff / 3600000)
      const days = Math.floor(diff / 86400000)

      if (minutes < 1) return "À l'instant"
      if (minutes < 60) return `Il y a ${minutes} min`
      if (hours < 24) return `Il y a ${hours}h`
      if (days < 7) return `Il y a ${days}j`
      return new Date(timestamp).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short'
      })
    },

    relaunchSearch(search) {
      this.$emit('relaunch-search', {
        consommationEnergie: search.consommation,
        commune: search.commune,
        emissionGES: search.ges,
        surfaceHabitable: search.surface,
        energyClass: search.energyClass,
        gesClass: search.gesClass,
        maxResults: 5
      })
    },

    clearHistory() {
      this.showConfirmModal = true
    },

    confirmClearHistory() {
      localStorage.removeItem('dpe_recent_searches')
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
        localStorage.setItem('dpe_recent_searches', JSON.stringify(this.recentSearches))
        this.hideContextMenu()
      }
    },

    renameSearchItem(index) {
      if (index !== null && index >= 0 && index < this.recentSearches.length) {
        const search = this.recentSearches[index]
        this.renameIndex = index
        this.renameInitialValue = search.displayName || this.formatCommune(search.commune)
        this.showRenameModal = true
      }
      this.hideContextMenu()
    },

    confirmRename(newName) {
      if (this.renameIndex !== null && this.renameIndex >= 0 && this.renameIndex < this.recentSearches.length) {
        if (newName?.trim()) {
          this.recentSearches[this.renameIndex].displayName = newName.trim()
        } else {
          delete this.recentSearches[this.renameIndex].displayName
        }
        localStorage.setItem('dpe_recent_searches', JSON.stringify(this.recentSearches))
      }
      this.showRenameModal = false
      this.renameIndex = null
    }
  }
}
</script>

<style scoped>
@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.grid > div {
  animation: slide-up 0.4s ease-out;
  animation-fill-mode: backwards;
}

.grid > div:nth-child(1) { animation-delay: 0.05s; }
.grid > div:nth-child(2) { animation-delay: 0.1s; }
.grid > div:nth-child(3) { animation-delay: 0.15s; }
.grid > div:nth-child(4) { animation-delay: 0.2s; }
.grid > div:nth-child(5) { animation-delay: 0.25s; }
.grid > div:nth-child(6) { animation-delay: 0.3s; }
</style>