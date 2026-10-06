/**
 * Store centralisé pour la gestion de l'état des recherches et de l'historique
 * Consolide les opérations localStorage dispersées dans les composants
 */

import { computed, reactive } from 'vue'

// Only this explicit preference enables displaying or saving search history.
// Presence alone is checked while off so retained entries can still be erased.
const HISTORY_PREFERENCE_KEY = 'dpe_history_preference'
let initialized = false

// État global réactif
const searchState = reactive({
  historyEnabled: false,
  storedHistory: { recent: false, dpe: false },
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
  const readStoredHistory = (key, type) => {
    let stored
    try {
      stored = localStorage.getItem(key)
    } catch (_error) {
      // An inaccessible key is not evidence that previously saved entries vanished.
      return []
    }
    try {
      const parsed = stored ? JSON.parse(stored) : []
      const entries = Array.isArray(parsed) ? parsed : []
      searchState.storedHistory[type] = entries.length > 0
      return entries
    } catch (_error) {
      searchState.storedHistory[type] = false
      return []
    }
  }

  /**
   * Charge les recherches récentes depuis localStorage
   */
  const loadRecentSearches = () => {
    if (!searchState.historyEnabled) return []
    searchState.recentSearches = readStoredHistory('dpe_recent_searches', 'recent')
    return searchState.recentSearches
  }

  /**
   * Sauvegarde une nouvelle recherche dans l'historique
   * @param {Object} searchData - Données de recherche
   * @param {number} resultCount - Nombre de résultats trouvés
   * @param {number} matchScore - Score de correspondance
   * @param {number} perfectMatchCount - Nombre de correspondances parfaites
   */
  const saveSearch = (searchData, resultCount = 0, matchScore = 0, perfectMatchCount = 0) => {
    if (!searchState.historyEnabled) return false
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
      searchState.storedHistory.recent = searchState.recentSearches.length > 0

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
    if (!searchState.historyEnabled) return []
    searchState.recentDPESearches = readStoredHistory('recent_dpe_searches', 'dpe')
    return searchState.recentDPESearches
  }

  /**
   * Sauvegarde une recherche DPE récente
   * @param {Object} searchData - Critères de recherche
   * @param {Object} results - Résultats de la recherche
   */
  const saveRecentDPESearch = (searchData, results) => {
    if (!searchState.historyEnabled) return false
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
        consommation: searchData.consommation ?? null,
        ges: searchData.ges ?? null,
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
      searchState.storedHistory.dpe = searchState.recentDPESearches.length > 0

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
    if (!searchState.historyEnabled) return false
    try {
      if (type === 'recent') {
        searchState.recentSearches.splice(index, 1)
        localStorage.setItem('dpe_recent_searches', JSON.stringify(searchState.recentSearches))
        searchState.storedHistory.recent = searchState.recentSearches.length > 0
      } else if (type === 'dpe') {
        searchState.recentDPESearches.splice(index, 1)
        localStorage.setItem('recent_dpe_searches', JSON.stringify(searchState.recentDPESearches))
        searchState.storedHistory.dpe = searchState.recentDPESearches.length > 0
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
        searchState.storedHistory.recent = false
      }
      if (type === 'dpe' || type === 'all') {
        searchState.recentDPESearches = []
        localStorage.removeItem('recent_dpe_searches')
        searchState.storedHistory.dpe = false
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
    if (!searchState.historyEnabled) return false
    try {
      if (type === 'recent' && searchState.recentSearches[index]) {
        searchState.recentSearches[index].displayName = displayName
        localStorage.setItem('dpe_recent_searches', JSON.stringify(searchState.recentSearches))
        searchState.storedHistory.recent = searchState.recentSearches.length > 0
      } else if (type === 'dpe' && searchState.recentDPESearches[index]) {
        searchState.recentDPESearches[index].displayName = displayName
        localStorage.setItem('recent_dpe_searches', JSON.stringify(searchState.recentDPESearches))
        searchState.storedHistory.dpe = searchState.recentDPESearches.length > 0
      }
      return true
    } catch (error) {
      searchState.lastError = error.message
      return false
    }
  }

  const applyHistoryPreference = enabled => {
    searchState.historyEnabled = enabled
    if (enabled) {
      loadRecentSearches()
      loadRecentDPESearches()
    } else {
      // Old entries stay on disk and out of the displayed collections until enabled.
      searchState.recentSearches = []
      searchState.recentDPESearches = []
    }
  }

  const loadHistoryPreference = () => {
    try {
      applyHistoryPreference(localStorage.getItem(HISTORY_PREFERENCE_KEY) === 'enabled')
    } catch (_error) {
      applyHistoryPreference(false)
    }
    if (!searchState.historyEnabled) {
      // Inspect presence without retaining or displaying the stored entries.
      readStoredHistory('dpe_recent_searches', 'recent')
      readStoredHistory('recent_dpe_searches', 'dpe')
    }
  }

  const setHistoryEnabled = enabled => {
    // Stop immediately even if the browser cannot persist the disabled choice.
    if (!enabled) applyHistoryPreference(false)
    try {
      localStorage.setItem(HISTORY_PREFERENCE_KEY, enabled ? 'enabled' : 'disabled')
      applyHistoryPreference(enabled === true)
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

  const hasSavedSearches = computed(() => searchState.storedHistory.recent || searchState.storedHistory.dpe)

  // Hydrate collections only after explicit opt-in; otherwise keep presence alone.
  if (!initialized) {
    loadHistoryPreference()
    window.addEventListener('storage', event => {
      if (event.key === HISTORY_PREFERENCE_KEY || event.key === null) loadHistoryPreference()
      // Read current storage: a queued event can predate a deletion.
      else if (event.key === 'dpe_recent_searches') {
        if (searchState.historyEnabled) loadRecentSearches()
        else readStoredHistory(event.key, 'recent')
      } else if (event.key === 'recent_dpe_searches') {
        if (searchState.historyEnabled) loadRecentDPESearches()
        else readStoredHistory(event.key, 'dpe')
      }
    })
    initialized = true
  }

  // API publique du store
  return {
    // État réactif
    historyEnabled: computed(() => searchState.historyEnabled),
    recentSearches: computed(() => searchState.recentSearches),
    recentDPESearches: computed(() => searchState.recentDPESearches),
    isLoading: computed(() => searchState.isLoading),
    lastError: computed(() => searchState.lastError),

    // Propriétés calculées
    recentSearchCount,
    recentDPESearchCount,
    hasRecentSearches,
    hasRecentDPESearches,
    hasSavedSearches,

    // Actions
    setHistoryEnabled,
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
