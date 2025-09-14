/**
 * Store centralisé pour la gestion de l'état des recherches et de l'historique
 * Consolide les opérations localStorage dispersées dans les composants
 */

import { computed, reactive } from 'vue'

// État global réactif
const searchState = reactive({
  recentSearches: [],
  recentDPESearches: [],
  isLoading: false,
  lastError: null
})

/**
 * Composable pour la gestion centralisée des recherches
 * @returns {Object} API du store des recherches
 */
export function useRecherches() {
  /**
   * Charge les recherches récentes depuis localStorage
   */
  const loadRecentSearches = () => {
    try {
      const stored = localStorage.getItem('dpe_recent_searches')
      searchState.recentSearches = stored ? JSON.parse(stored) : []
      return searchState.recentSearches
    } catch (_error) {
      searchState.recentSearches = []
      return []
    }
  }

  /**
   * Sauvegarde une nouvelle recherche dans l'historique
   * @param {Object} searchData - Données de recherche
   * @param {number} resultCount - Nombre de résultats trouvés
   * @param {number} matchScore - Score de correspondance
   * @param {number} perfectMatchCount - Nombre de correspondances parfaites
   */
  const saveSearch = (searchData, resultCount = 0, matchScore = 0, perfectMatchCount = 0) => {
    try {
      // Charger les recherches existantes si pas déjà fait
      if (searchState.recentSearches.length === 0) {
        loadRecentSearches()
      }

      // Créer la nouvelle entrée
      const newSearch = {
        commune: searchData.commune,
        surface: searchData.surfaceHabitable,
        consommation: searchData.consommationEnergie,
        ges: searchData.emissionGES,
        energyClass: searchData.energyClass,
        gesClass: searchData.gesClass,
        typeBien: searchData.typeBien,
        resultCount,
        matchScore,
        perfectMatchCount,
        timestamp: Date.now()
      }

      // Vérifier si une recherche identique existe déjà
      const existingIndex = searchState.recentSearches.findIndex(
        s =>
          s.commune === newSearch.commune &&
          s.surface === newSearch.surface &&
          s.consommation === newSearch.consommation
      )

      if (existingIndex !== -1) {
        // Mettre à jour la recherche existante en préservant le displayName
        const existingDisplayName = searchState.recentSearches[existingIndex].displayName
        searchState.recentSearches[existingIndex] = newSearch
        if (existingDisplayName) {
          searchState.recentSearches[existingIndex].displayName = existingDisplayName
        }
      } else {
        // Ajouter en début de liste
        searchState.recentSearches.unshift(newSearch)
      }

      // Limiter à 10 recherches récentes
      searchState.recentSearches = searchState.recentSearches.slice(0, 10)

      // Sauvegarder dans localStorage
      localStorage.setItem('dpe_recent_searches', JSON.stringify(searchState.recentSearches))

      // Déclencher un événement pour mettre à jour les composants qui écoutent
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'dpe_recent_searches',
          newValue: JSON.stringify(searchState.recentSearches)
        })
      )

      return true
    } catch (error) {
      searchState.lastError = error.message
      return false
    }
  }

  /**
   * Charge les recherches DPE récentes depuis localStorage
   */
  const loadRecentDPESearches = () => {
    try {
      const stored = localStorage.getItem('recent_dpe_searches')
      searchState.recentDPESearches = stored ? JSON.parse(stored) : []
      return searchState.recentDPESearches
    } catch (_error) {
      searchState.recentDPESearches = []
      return []
    }
  }

  /**
   * Sauvegarde une recherche DPE récente
   * @param {Object} searchData - Critères de recherche
   * @param {Object} results - Résultats de la recherche
   */
  const saveRecentDPESearch = (searchData, results) => {
    try {
      // Charger les recherches existantes si pas déjà fait
      if (searchState.recentDPESearches.length === 0) {
        loadRecentDPESearches()
      }

      const newSearch = {
        address: searchData.address,
        coordinates: searchData.coordinates,
        monthsBack: searchData.monthsBack,
        radius: searchData.radius,
        surface: searchData.surface,
        typeBien: searchData.typeBien || null,
        energyClasses: searchData.energyClasses || [],
        gesClasses: searchData.gesClasses || [],
        resultCount: results?.results?.length || 0,
        timestamp: Date.now(),
        displayName: searchData.displayName || searchData.address
      }

      // Vérifier si une recherche identique existe déjà
      const existingIndex = searchState.recentDPESearches.findIndex(s => s.address === newSearch.address)

      if (existingIndex !== -1) {
        // Mettre à jour la recherche existante
        searchState.recentDPESearches[existingIndex] = newSearch
      } else {
        // Ajouter en début de liste
        searchState.recentDPESearches.unshift(newSearch)
      }

      // Limiter à 10 recherches récentes
      searchState.recentDPESearches = searchState.recentDPESearches.slice(0, 10)

      // Sauvegarder dans localStorage
      localStorage.setItem('recent_dpe_searches', JSON.stringify(searchState.recentDPESearches))

      return true
    } catch (error) {
      searchState.lastError = error.message
      return false
    }
  }

  /**
   * Supprime une recherche de l'historique
   * @param {number} index - Index de la recherche à supprimer
   * @param {string} type - Type de recherche ('recent' ou 'dpe')
   */
  const removeSearch = (index, type = 'recent') => {
    try {
      if (type === 'recent') {
        searchState.recentSearches.splice(index, 1)
        localStorage.setItem('dpe_recent_searches', JSON.stringify(searchState.recentSearches))
      } else if (type === 'dpe') {
        searchState.recentDPESearches.splice(index, 1)
        localStorage.setItem('recent_dpe_searches', JSON.stringify(searchState.recentDPESearches))
      }
      return true
    } catch (error) {
      searchState.lastError = error.message
      return false
    }
  }

  /**
   * Efface tout l'historique des recherches
   * @param {string} type - Type d'historique à effacer ('recent', 'dpe', ou 'all')
   */
  const clearSearchHistory = (type = 'all') => {
    try {
      if (type === 'recent' || type === 'all') {
        searchState.recentSearches = []
        localStorage.removeItem('dpe_recent_searches')
      }
      if (type === 'dpe' || type === 'all') {
        searchState.recentDPESearches = []
        localStorage.removeItem('recent_dpe_searches')
      }
      return true
    } catch (error) {
      searchState.lastError = error.message
      return false
    }
  }

  /**
   * Met à jour le nom d'affichage d'une recherche
   * @param {number} index - Index de la recherche
   * @param {string} displayName - Nouveau nom d'affichage
   * @param {string} type - Type de recherche ('recent' ou 'dpe')
   */
  const updateSearchDisplayName = (index, displayName, type = 'recent') => {
    try {
      if (type === 'recent' && searchState.recentSearches[index]) {
        searchState.recentSearches[index].displayName = displayName
        localStorage.setItem('dpe_recent_searches', JSON.stringify(searchState.recentSearches))
      } else if (type === 'dpe' && searchState.recentDPESearches[index]) {
        searchState.recentDPESearches[index].displayName = displayName
        localStorage.setItem('recent_dpe_searches', JSON.stringify(searchState.recentDPESearches))
      }
      return true
    } catch (error) {
      searchState.lastError = error.message
      return false
    }
  }

  // Propriétés calculées réactives
  const recentSearchCount = computed(() => searchState.recentSearches.length)
  const recentDPESearchCount = computed(() => searchState.recentDPESearches.length)
  const hasRecentSearches = computed(() => recentSearchCount.value > 0)
  const hasRecentDPESearches = computed(() => recentDPESearchCount.value > 0)

  // Initialisation au premier appel
  if (searchState.recentSearches.length === 0) {
    loadRecentSearches()
  }
  if (searchState.recentDPESearches.length === 0) {
    loadRecentDPESearches()
  }

  // API publique du store
  return {
    // État réactif
    recentSearches: computed(() => searchState.recentSearches),
    recentDPESearches: computed(() => searchState.recentDPESearches),
    isLoading: computed(() => searchState.isLoading),
    lastError: computed(() => searchState.lastError),

    // Propriétés calculées
    recentSearchCount,
    recentDPESearchCount,
    hasRecentSearches,
    hasRecentDPESearches,

    // Actions
    loadRecentSearches,
    loadRecentDPESearches,
    saveSearch,
    saveRecentDPESearch,
    removeSearch,
    clearSearchHistory,
    updateSearchDisplayName,

    // Utilitaires
    setLoading: loading => {
      searchState.isLoading = loading
    },
    clearError: () => {
      searchState.lastError = null
    }
  }
}
