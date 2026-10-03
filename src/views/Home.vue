<template>
  <div>
    <!-- Animation de triangulation -->
    <AnimationTriangulation
      v-if="showAnimation"
      :commune="searchCriteria?.commune || recentDPESearchCriteria?.address || ''"
      :coordinates="recentDPESearchCoordinates || recentDPEResults?.searchCoordinates || null"
      :onComplete="handleAnimationComplete"
      @cancel="handleNewSearch"
      :isDataReady="searchResults !== null || recentDPEResults !== null"
      :waitingForResults="true"
      :resultsCount="(searchResults?.results?.length ?? 0) + (recentDPEResults?.results?.length ?? 0)"
      class="relative"
    />
    
    <!-- Interface principale -->
    <div v-show="!showAnimation" class="container mx-auto px-4 py-6 sm:py-10">

      <!-- Navigation par onglets avec padding adaptatif -->
      <div>
        <NavigationOnglets
          v-if="!searchResults && !recentDPEResults && !showAnimation"
          :activeTab="activeTab"
          @tab-change="handleTabChange"
        />
      </div>

      <!-- Tab: Localiser un bien -->
      <div v-if="activeTab === 'locate' && !searchResults">
        <p v-if="searchError" role="alert" class="max-w-4xl mx-auto mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {{ searchError }}
        </p>
        <!-- Formulaire de recherche -->
        <FormulaireRechercheDPE
          ref="searchForm"
          @search="handleSearch"
        />

        <!-- Recherches récentes -->
        <RecherchesRecentes
          class="mt-8"
          @relaunch-search="handleSearch"
        />
      </div>
      
      <!-- Tab: DPE récents -->
      <div v-show="activeTab === 'recent' && !recentDPEResults">
        <RechercheDPERecente
          ref="recentFormulaireRechercheDPE"
          @search-started="handleRechercheDPERecenteStarted"
          @search-results="handleRecentDPEResults"
          @search-error="handleRechercheDPERecenteError"
        />
        
        <!-- Historique des recherches DPE récents -->
        <HistoriqueRechercheDPE
          @relaunch-search="handleRelaunchRecentSearch"
        />
      </div>
      
      <!-- Résultats de localisation -->
      <DPEResults 
        v-if="searchResults"
        :searchResult="searchResults"
        :searchCriteria="searchCriteria"
        @newSearch="handleNewSearch"
      />
      
      <!-- Résultats DPE récents -->
      <RecentDPEResults
        v-if="recentDPEResults"
        :results="recentDPEResults"
        :searchCriteria="recentDPESearchCriteria"
        @clear-results="handleClearRecentResults"
      />
    </div>
  </div>
</template>

<script>
// Composants critiques chargés immédiatement

import { defineAsyncComponent } from 'vue'
import FormulaireRechercheDPE from '../components/fonctionnalites/dpe/FormulaireRechercheDPE.vue'
import { useRecherches } from '../stores/useRecherches.js'

// Lazy loading des composants non-critiques pour améliorer le FCP
const DPEResults = defineAsyncComponent(
  () => import('../components/fonctionnalites/localisation/ResultatsLocaliserDpe.vue')
)
const RecentDPEResults = defineAsyncComponent(() => import('../components/fonctionnalites/dpe/ResultatsDpeRecents.vue'))
const RechercheDPERecente = defineAsyncComponent(
  () => import('../components/fonctionnalites/dpe/RechercheDPERecente.vue')
)
const HistoriqueRechercheDPE = defineAsyncComponent(
  () => import('../components/fonctionnalites/dpe/HistoriqueRechercheDPE.vue')
)
const RecherchesRecentes = defineAsyncComponent(
  () => import('../components/fonctionnalites/recherche/RecherchesRecentes.vue')
)
const NavigationOnglets = defineAsyncComponent(() => import('../components/base/NavigationOnglets.vue'))
const AnimationTriangulation = defineAsyncComponent(() => import('../components/animations/AnimationTriangulation.vue'))

import DPESearchService from '../services/dpe-search.service.js' // Système de scoring clair

export default {
  name: 'Home',
  components: {
    FormulaireRechercheDPE,
    DPEResults,
    AnimationTriangulation,
    RecherchesRecentes,
    NavigationOnglets,
    RechercheDPERecente,
    RecentDPEResults,
    HistoriqueRechercheDPE
  },
  data() {
    return {
      showAnimation: false,
      animationTimeout: null,
      searchRequestId: 0,
      recentSearchPending: false,
      searchCriteria: null,
      searchResults: null,
      searchError: null,
      recentDPEResults: null,
      recentDPESearchCriteria: null,
      recentDPESearchCoordinates: null,
      activeTab: 'locate',
      dpeService: new DPESearchService()
    }
  },

  setup() {
    // Utiliser le store centralisé pour les recherches
    const recherchesStore = useRecherches()

    return {
      recherchesStore
    }
  },
  mounted() {
    // Écouter l'événement de réinitialisation de recherche depuis le clic sur le logo
    window.addEventListener('reset-search', this.handleNewSearch)
  },

  beforeUnmount() {
    this.searchRequestId++
    this.recentSearchPending = false
    // Nettoyer l'écouteur d'événement
    window.removeEventListener('reset-search', this.handleNewSearch)
  },

  methods: {
    async handleSearch(searchData) {
      // A nearby geocode can still be pending while the search tabs are visible.
      this.$refs.recentFormulaireRechercheDPE?.cancelSearch?.()
      const requestId = ++this.searchRequestId
      this.searchResults = null
      this.recentSearchPending = false
      this.recentDPESearchCriteria = null
      this.searchError = null
      // Stocker les critères pour l'animation
      this.searchCriteria = searchData

      // Effacer les résultats DPE récents pour éviter la confusion
      this.recentDPEResults = null

      // Faire défiler vers le haut pour s'assurer que l'animation soit visible sur les petits écrans
      window.scrollTo({ top: 0, behavior: 'instant' })

      // Démarrer l'animation de triangulation
      this.showAnimation = true
      window.dispatchEvent(new CustomEvent('animation-start'))

      // Lancer la vraie recherche en arrière-plan
      try {
        const results = await this.dpeService.search(searchData)
        if (requestId !== this.searchRequestId) return
        this.searchResults = results

        if (requestId !== this.searchRequestId) return

        // Sauvegarder dans le cache si des résultats ont été trouvés
        if (this.searchResults && this.searchResults.totalFound > 0) {
          // Trouver le meilleur matchScore et compter les correspondances parfaites
          let bestMatchScore = 0
          let perfectMatchCount = 0

          this.searchResults.results?.forEach(result => {
            const score = result.matchScore || 0
            bestMatchScore = Math.max(bestMatchScore, score)
            if (score >= 99) {
              perfectMatchCount++
            }
          })

          this.recherchesStore.saveSearch(searchData, this.searchResults.totalFound, bestMatchScore, perfectMatchCount)
        }
      } catch (error) {
        if (requestId !== this.searchRequestId) return
        if (error.code === 'AMBIGUOUS_COMMUNE') {
          this.searchResults = null
          this.searchError = error.message
          this.showAnimation = false
          clearTimeout(this.animationTimeout)
          this.animationTimeout = null
          window.dispatchEvent(new CustomEvent('animation-end'))
          this.$refs.searchForm?.resetLoading?.()
          return
        }
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
      // Nettoyer le timeout si l'animation se termine normalement
      if (this.animationTimeout) {
        clearTimeout(this.animationTimeout)
        this.animationTimeout = null
      }

      this.showAnimation = false
      window.dispatchEvent(new CustomEvent('animation-end'))

      // Reset du formulaire
      if (this.searchResults && this.$refs.searchForm) {
        this.$refs.searchForm.resetLoading()
      }
      if (this.recentDPEResults && this.$refs.recentFormulaireRechercheDPE) {
        this.$refs.recentFormulaireRechercheDPE.resetLoading()
      }
    },

    handleNewSearch() {
      this.searchRequestId++
      this.recentSearchPending = false
      this.recentDPEResults = null
      this.recentDPESearchCriteria = null
      this.recentDPESearchCoordinates = null
      this.$refs.searchForm?.resetLoading?.()
      this.$refs.recentFormulaireRechercheDPE?.cancelSearch?.()
      this.searchError = null
      this.searchResults = null
      this.searchCriteria = null
      this.showAnimation = false
      window.dispatchEvent(new CustomEvent('animation-end'))

      // Nettoyer le timeout si actif
      if (this.animationTimeout) {
        clearTimeout(this.animationTimeout)
        this.animationTimeout = null
      }
    },

    handleTabChange(tab) {
      if (tab === this.activeTab) return
      this.$refs.recentFormulaireRechercheDPE?.cancelSearch?.()
      this.recentSearchPending = false
      this.activeTab = tab
    },

    handleRechercheDPERecenteStarted(searchCriteria) {
      this.searchRequestId++
      this.recentSearchPending = true
      this.recentDPEResults = null
      this.searchCriteria = null
      // Stocker les critères de recherche et les coordonnées pour l'animation
      this.recentDPESearchCriteria = searchCriteria
      this.recentDPESearchCoordinates = searchCriteria.coordinates

      // Effacer les résultats de recherche principaux pour éviter la confusion
      this.searchResults = null

      // Faire défiler vers le haut pour s'assurer que l'animation soit visible
      window.scrollTo({ top: 0, behavior: 'instant' })

      // Démarrer immédiatement l'animation de triangulation avec les coordonnées
      this.showAnimation = true
      window.dispatchEvent(new CustomEvent('animation-start'))
    },

    async handleRecentDPEResults(searchCriteria, results) {
      if (!this.recentSearchPending) return
      this.recentSearchPending = false
      // Stocker les résultats et les critères de recherche quand ils arrivent
      this.recentDPEResults = results
      this.recentDPESearchCriteria = searchCriteria
    },

    handleRechercheDPERecenteError(_error) {
      if (!this.recentSearchPending) return
      this.recentSearchPending = false
      // Gérer l'erreur de recherche - arrêter l'animation
      this.showAnimation = false
      window.dispatchEvent(new CustomEvent('animation-end'))

      // Nettoyer le timeout si l'animation se termine par erreur
      if (this.animationTimeout) {
        clearTimeout(this.animationTimeout)
        this.animationTimeout = null
      }
      // Pourrait afficher un message d'erreur ici si nécessaire
    },

    handleAnimationTimeout() {
      if (this.searchResults !== null || this.recentDPEResults !== null) {
        // Results already arrived — just end the animation, don't clear results
        this.showAnimation = false
        return
      }

      // Arrêter l'animation après le timeout
      this.showAnimation = false
      window.dispatchEvent(new CustomEvent('animation-end'))

      // Réinitialiser les états de recherche
      this.searchResults = null
      this.searchCriteria = null
      this.recentDPEResults = null
      this.recentDPESearchCriteria = null

      // Nettoyer le timeout
      if (this.animationTimeout) {
        clearTimeout(this.animationTimeout)
        this.animationTimeout = null
      }
    },

    handleClearRecentResults() {
      this.recentDPEResults = null
    },

    handleRelaunchRecentSearch(savedSearch) {
      // Passer la recherche sauvegardée au formulaire
      if (this.$refs.recentFormulaireRechercheDPE) {
        this.$refs.recentFormulaireRechercheDPE.relaunchSearch(savedSearch)
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
