<template>
  <div>
    <!-- Animation de triangulation -->
    <AnimationTriangulation
      v-if="showAnimation"
      :commune="searchCriteria?.commune || recentDPESearchCriteria?.address || ''"
      :coordinates="recentDPESearchCoordinates || recentDPEResults?.searchCoordinates || null"
      :onComplete="handleAnimationComplete"
      :isDataReady="searchResults !== null || recentDPEResults !== null"
      :waitingForResults="true"
      :resultsCount="(searchResults?.results?.length ?? 0) + (recentDPEResults?.results?.length ?? 0)"
      class="relative z-10"
    />
    
    <!-- Interface principale -->
    <div v-show="!showAnimation" class="container mx-auto px-4 py-4 min-h-screen">
      
      <!-- Navigation par onglets -->
      <NavigationOnglets 
        v-if="!searchResults && !recentDPEResults && !showAnimation"
        :activeTab="activeTab"
        @tab-change="handleTabChange"
      />
      
      <!-- Tab: Localiser un bien -->
      <div v-if="activeTab === 'locate' && !searchResults">
        <!-- Formulaire de recherche -->
        <FormulaireRechercheDPE 
          ref="searchForm"
          @search="handleSearch"
        />
        
        <!-- Recherches récentes -->
        <RecherchesRecentes
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
        :departmentAverages="searchResults.departmentAverages"
        @newSearch="handleNewSearch"
      />
      
      <!-- Résultats DPE récents -->
      <RecentDPEResults
        v-if="recentDPEResults"
        :results="recentDPEResults"
        :searchCriteria="recentDPESearchCriteria"
        :departmentAverages="recentDPEResults.departmentAverages"
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
      searchCriteria: null,
      searchResults: null,
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
    // Nettoyer l'écouteur d'événement
    window.removeEventListener('reset-search', this.handleNewSearch)
  },

  methods: {
    async handleSearch(searchData) {
      // Stocker les critères pour l'animation
      this.searchCriteria = searchData

      // Effacer les résultats DPE récents pour éviter la confusion
      this.recentDPEResults = null

      // Faire défiler vers le haut pour s'assurer que l'animation soit visible sur les petits écrans
      window.scrollTo({ top: 0, behavior: 'smooth' })

      // Démarrer l'animation de triangulation
      this.showAnimation = true

      // Lancer la vraie recherche en arrière-plan
      try {
        this.searchResults = await this.dpeService.search(searchData)

        // Charger les moyennes départementales si nous avons des résultats
        if (this.searchResults) {
          let postalCode = null

          // Essayer d'obtenir le code postal des résultats de recherche
          if (this.searchResults.postalCode) {
            postalCode = this.searchResults.postalCode
          } else if (this.searchResults.results?.length > 0) {
            const firstResult = this.searchResults.results[0]
            if (firstResult.codePostal) {
              postalCode = firstResult.codePostal
            }
          }

          // Charger les moyennes départementales si nous avons un code postal
          if (postalCode) {
            const dept = postalCode.substring(0, 2)
            try {
              const response = await fetch(`/data/departments/dpe-averages-dept-${dept}.json`)
              if (response.ok) {
                this.searchResults.departmentAverages = await response.json()
              }
            } catch (_error) {
              // Échec silencieux - les moyennes départementales sont optionnelles
            }
          }
        }

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
      // Ajouter un petit délai pour éviter le flash de la page d'accueil
      setTimeout(() => {
        this.showAnimation = false
      }, 100)

      // Reset du formulaire
      if (this.searchResults && this.$refs.searchForm) {
        this.$refs.searchForm.resetLoading()
      }
      if (this.recentDPEResults && this.$refs.recentFormulaireRechercheDPE) {
        this.$refs.recentFormulaireRechercheDPE.resetLoading()
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

    handleRechercheDPERecenteStarted(searchCriteria) {
      // Stocker les critères de recherche et les coordonnées pour l'animation
      this.recentDPESearchCriteria = searchCriteria
      this.recentDPESearchCoordinates = searchCriteria.coordinates

      // Effacer les résultats de recherche principaux pour éviter la confusion
      this.searchResults = null

      // Faire défiler vers le haut pour s'assurer que l'animation soit visible
      window.scrollTo({ top: 0, behavior: 'smooth' })

      // Démarrer immédiatement l'animation de triangulation avec les coordonnées
      this.showAnimation = true
    },

    async handleRecentDPEResults(searchCriteria, results) {
      // Stocker les résultats et les critères de recherche quand ils arrivent
      this.recentDPEResults = results
      this.recentDPESearchCriteria = searchCriteria

      // Charger les moyennes départementales si nous avons des résultats
      if (results?.results && results.results.length > 0) {
        // Obtenir le code postal du résultat de géocodage (toujours disponible)
        let postalCode = results.postalCode

        // Utiliser le code postal du premier résultat si nécessaire (essayer plusieurs champs)
        if (!postalCode && results.results[0]) {
          const firstResult = results.results[0]
          postalCode =
            firstResult.codePostal ||
            firstResult.code_postal_ban ||
            firstResult.code_postal_brut ||
            firstResult.code_postal
        }

        if (postalCode) {
          const dept = postalCode.substring(0, 2)
          try {
            const response = await fetch(`/data/departments/dpe-averages-dept-${dept}.json`)
            if (response.ok) {
              this.recentDPEResults.departmentAverages = await response.json()
            }
          } catch (_error) {
            // Échec silencieux - les moyennes départementales sont optionnelles
          }
        }
      }
    },

    handleRechercheDPERecenteError(_error) {
      // Gérer l'erreur de recherche - arrêter l'animation
      this.showAnimation = false
      // Pourrait afficher un message d'erreur ici si nécessaire
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