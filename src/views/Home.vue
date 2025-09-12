<template>
  <div>
    <!-- Animation de triangulation -->
    <TriangulationAnimation 
      v-if="showAnimation"
      :commune="searchCriteria?.commune || recentDPESearchCriteria?.address || ''"
      :coordinates="recentDPESearchCoordinates || recentDPEResults?.searchCoordinates || null"
      :onComplete="handleAnimationComplete"
      :isDataReady="searchResults !== null || recentDPEResults !== null"
      :waitingForResults="true"
      class="relative z-10"
    />
    
    <!-- Interface principale -->
    <div v-show="!showAnimation" class="container mx-auto px-4 py-4 min-h-screen">
      
      <!-- Navigation par onglets -->
      <TabNavigation 
        v-if="!searchResults && !recentDPEResults && !showAnimation"
        :activeTab="activeTab"
        @tab-change="handleTabChange"
      />
      
      <!-- Tab: Localiser un bien -->
      <div v-if="activeTab === 'locate' && !searchResults">
        <!-- Formulaire de recherche -->
        <DPESearchForm 
          ref="searchForm"
          @search="handleSearch"
        />
        
        <!-- Recherches récentes -->
        <RecentSearches
          @relaunch-search="handleSearch"
        />
      </div>
      
      <!-- Tab: DPE récents -->
      <div v-show="activeTab === 'recent' && !recentDPEResults">
        <RecentDPESearch
          ref="recentDPESearchForm"
          @search-started="handleRecentDPESearchStarted"
          @search-results="handleRecentDPEResults"
          @search-error="handleRecentDPESearchError"
        />
        
        <!-- Historique des recherches DPE récents -->
        <RecentDPESearchHistory
          @relaunch-search="handleRelaunchRecentSearch"
        />
      </div>
      
      <!-- Résultats de localisation -->
      <DPEResults 
        v-if="searchResults"
        :searchResult="searchResults"
        :searchCriteria="searchCriteria"
        :departmentAverages="searchResults.departmentAverages"
        @newSearch="handleNewSearch"
      />
      
      <!-- Résultats DPE récents -->
      <RecentDPEResults
        v-if="recentDPEResults"
        :results="recentDPEResults"
        :departmentAverages="recentDPEResults.departmentAverages"
        @clear-results="handleClearRecentResults"
      />
    </div>
  </div>
</template>

<script>
import DPEResults from '../components/DPEResults.vue'
import DPESearchForm from '../components/DPESearchForm.vue'
import RecentDPEResults from '../components/RecentDPEResults.vue'
import RecentDPESearch from '../components/RecentDPESearch.vue'
import RecentDPESearchHistory from '../components/RecentDPESearchHistory.vue'
import RecentSearches from '../components/RecentSearches.vue'
import TabNavigation from '../components/TabNavigation.vue'
import TriangulationAnimation from '../components/TriangulationAnimation.vue'
import DPESearchService from '../services/dpe-search.service.js' // Clear scoring system

export default {
  name: 'Home',
  components: {
    DPESearchForm,
    DPEResults,
    TriangulationAnimation,
    RecentSearches,
    TabNavigation,
    RecentDPESearch,
    RecentDPEResults,
    RecentDPESearchHistory
  },
  data() {
    return {
      showAnimation: false,
      searchCriteria: null,
      searchResults: null,
      recentDPEResults: null,
      recentDPESearchCriteria: null,
      recentDPESearchCoordinates: null,
      activeTab: 'locate',
      dpeService: new DPESearchService()
    }
  },
  mounted() {
    // Listen for reset search event from logo click
    window.addEventListener('reset-search', this.handleNewSearch)
  },

  beforeUnmount() {
    // Clean up event listener
    window.removeEventListener('reset-search', this.handleNewSearch)
  },

  methods: {
    async handleSearch(searchData) {
      // Stocker les critères pour l'animation
      this.searchCriteria = searchData

      // Clear Recent DPE results to avoid confusion
      this.recentDPEResults = null

      // Scroll to top to ensure animation is visible on small screens
      window.scrollTo({ top: 0, behavior: 'smooth' })

      // Démarrer l'animation de triangulation
      this.showAnimation = true

      // Lancer la vraie recherche en arrière-plan
      try {
        this.searchResults = await this.dpeService.search(searchData)

        // Load department averages if we have results
        if (this.searchResults) {
          let postalCode = null

          // Try to get postal code from search results
          if (this.searchResults.postalCode) {
            postalCode = this.searchResults.postalCode
          } else if (this.searchResults.results?.length > 0) {
            const firstResult = this.searchResults.results[0]
            if (firstResult.codePostal) {
              postalCode = firstResult.codePostal
            }
          }

          // Load department averages if we have a postal code
          if (postalCode) {
            const dept = postalCode.substring(0, 2)
            try {
              const response = await fetch(`/data/departments/dpe-averages-dept-${dept}.json`)
              if (response.ok) {
                this.searchResults.departmentAverages = await response.json()
              }
            } catch (_error) {
              // Silent fail - department averages are optional
            }
          }
        }

        // Sauvegarder dans le cache si des résultats ont été trouvés
        if (this.searchResults && this.searchResults.totalFound > 0) {
          this.saveToRecentSearches(searchData, this.searchResults.totalFound)
        }
      } catch (error) {
        // En cas d'erreur, on peut afficher un message d'erreur
        this.searchResults = {
          results: [],
          totalFound: 0,
          searchStrategy: 'ERROR',
          executionTime: 0,
          diagnostics: [error.message]
        }
      }
    },

    handleAnimationComplete() {
      // Add a small delay to prevent the flash of home page
      setTimeout(() => {
        this.showAnimation = false
      }, 100)

      // Reset du formulaire
      if (this.searchResults && this.$refs.searchForm) {
        this.$refs.searchForm.resetLoading()
      }
      if (this.recentDPEResults && this.$refs.recentDPESearchForm) {
        this.$refs.recentDPESearchForm.resetLoading()
      }
    },

    handleNewSearch() {
      this.searchResults = null
      this.searchCriteria = null
      this.showAnimation = false
    },

    handleTabChange(tab) {
      this.activeTab = tab
    },

    handleRecentDPESearchStarted(searchCriteria) {
      // Store search criteria and coordinates for animation
      this.recentDPESearchCriteria = searchCriteria
      this.recentDPESearchCoordinates = searchCriteria.coordinates

      // Clear main search results to avoid confusion
      this.searchResults = null

      // Scroll to top to ensure animation is visible
      window.scrollTo({ top: 0, behavior: 'smooth' })

      // Start triangulation animation immediately with coordinates
      this.showAnimation = true
    },

    async handleRecentDPEResults(_searchCriteria, results) {
      // Store results when they arrive
      this.recentDPEResults = results

      // Load department averages if we have results
      if (results?.results && results.results.length > 0) {
        // Get postal code from geocoding result (always available)
        let postalCode = results.postalCode

        // Fallback to first result's postal code if needed
        if (!postalCode && results.results[0].codePostal) {
          postalCode = results.results[0].codePostal
        }

        if (postalCode) {
          const dept = postalCode.substring(0, 2)
          try {
            const response = await fetch(`/data/departments/dpe-averages-dept-${dept}.json`)
            if (response.ok) {
              this.recentDPEResults.departmentAverages = await response.json()
            }
          } catch (_error) {
            // Silent fail - department averages are optional
          }
        }
      }
    },

    handleRecentDPESearchError(_error) {
      // Handle search error - stop animation
      this.showAnimation = false
      // Could show an error message here if needed
    },

    handleClearRecentResults() {
      this.recentDPEResults = null
    },

    handleRelaunchRecentSearch(savedSearch) {
      // Passer la recherche sauvegardée au formulaire
      if (this.$refs.recentDPESearchForm) {
        this.$refs.recentDPESearchForm.relaunchSearch(savedSearch)
      }
    },

    saveToRecentSearches(searchData, resultCount) {
      try {
        // Récupérer les recherches existantes
        const stored = localStorage.getItem('dpe_recent_searches')
        let searches = stored ? JSON.parse(stored) : []

        // Créer la nouvelle entrée
        const newSearch = {
          commune: searchData.commune,
          surface: searchData.surfaceHabitable,
          consommation: searchData.consommationEnergie,
          ges: searchData.emissionGES,
          energyClass: searchData.energyClass,
          gesClass: searchData.gesClass,
          resultCount: resultCount,
          timestamp: Date.now()
        }

        // Vérifier si une recherche identique existe déjà
        const existingIndex = searches.findIndex(
          s =>
            s.commune === newSearch.commune &&
            s.surface === newSearch.surface &&
            s.consommation === newSearch.consommation
        )

        if (existingIndex !== -1) {
          // Mettre à jour la recherche existante
          searches[existingIndex] = newSearch
        } else {
          // Ajouter en début de liste
          searches.unshift(newSearch)
        }

        // Limiter à 10 recherches récentes
        searches = searches.slice(0, 10)

        // Sauvegarder
        localStorage.setItem('dpe_recent_searches', JSON.stringify(searches))

        // Déclencher un événement pour mettre à jour le composant RecentSearches
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'dpe_recent_searches',
            newValue: JSON.stringify(searches)
          })
        )
      } catch (_error) {
        // Error saving search to localStorage - silently continue
      }
    }
  }
}
</script>

<style scoped>
.container {
  max-width: 1200px;
}

/* Animation de fade pour les transitions */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

</style>