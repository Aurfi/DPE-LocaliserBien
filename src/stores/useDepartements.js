/**
 * Store centralisé pour la gestion et mise en cache des données départementales
 * Optimise les chargements répétés de données communales
 */

import { computed, reactive } from 'vue'

// État global réactif pour les données départementales
const departmentState = reactive({
  cache: new Map(),
  averagesCache: new Map(),
  loadingDepartments: new Set(),
  lastError: null,
  cacheStats: {
    hits: 0,
    misses: 0,
    totalRequests: 0
  }
})

/**
 * Composable pour la gestion centralisée des données départementales
 * @returns {Object} API du store des départements
 */
export function useDepartements() {
  /**
   * Charge les données d'un département avec mise en cache intelligente
   * @param {string} deptCode - Code du département (ex: '13', '2A')
   * @param {boolean} forceReload - Force le rechargement depuis le serveur
   * @returns {Promise<Object|null>} Données du département
   */
  const loadDepartment = async (deptCode, forceReload = false) => {
    if (!deptCode) {
      departmentState.lastError = 'Code département manquant'
      return null
    }

    departmentState.cacheStats.totalRequests++

    // Vérifier le cache sauf si rechargement forcé
    if (!forceReload && departmentState.cache.has(deptCode)) {
      departmentState.cacheStats.hits++
      return departmentState.cache.get(deptCode).data
    }

    // Éviter les requêtes multiples simultanées pour le même département
    if (departmentState.loadingDepartments.has(deptCode)) {
      // Attendre que le chargement en cours se termine
      return new Promise(resolve => {
        const checkLoaded = () => {
          if (!departmentState.loadingDepartments.has(deptCode)) {
            const cacheEntry = departmentState.cache.get(deptCode)
            resolve(cacheEntry ? cacheEntry.data : null)
          } else {
            setTimeout(checkLoaded, 50)
          }
        }
        checkLoaded()
      })
    }

    departmentState.cacheStats.misses++
    departmentState.loadingDepartments.add(deptCode)

    try {
      const response = await fetch(`/data/departments/communes-dept-${deptCode}.json`)

      if (!response.ok) {
        throw new Error(`Impossible de charger le département ${deptCode}: ${response.status}`)
      }

      const deptData = await response.json()

      // Validation basique des données
      if (!deptData || typeof deptData !== 'object') {
        throw new Error(`Données invalides pour le département ${deptCode}`)
      }

      // Mettre en cache avec métadonnées
      const cacheEntry = {
        data: deptData,
        loadedAt: Date.now(),
        deptCode,
        size: JSON.stringify(deptData).length // Approximation de la taille
      }

      departmentState.cache.set(deptCode, cacheEntry)
      departmentState.lastError = null

      return deptData
    } catch (error) {
      departmentState.lastError = error.message
      return null
    } finally {
      departmentState.loadingDepartments.delete(deptCode)
    }
  }

  /**
   * Charge les moyennes départementales avec mise en cache
   * @param {string} deptCode - Code du département
   * @param {boolean} forceReload - Force le rechargement
   * @returns {Promise<Object|null>} Moyennes départementales
   */
  const loadDepartmentAverages = async (deptCode, forceReload = false) => {
    if (!deptCode) return null

    const cacheKey = `averages-${deptCode}`

    // Vérifier le cache
    if (!forceReload && departmentState.averagesCache.has(cacheKey)) {
      return departmentState.averagesCache.get(cacheKey)
    }

    try {
      const response = await fetch(`/data/departments/dpe-averages-dept-${deptCode}.json`)

      if (!response.ok) {
        // Les moyennes sont optionnelles, ne pas traiter comme une erreur
        return null
      }

      const averages = await response.json()

      // Mettre en cache
      const cacheEntry = {
        data: averages,
        loadedAt: Date.now(),
        deptCode
      }

      departmentState.averagesCache.set(cacheKey, cacheEntry)
      return cacheEntry
    } catch (_error) {
      return null
    }
  }

  /**
   * Obtient les données départementales depuis le cache
   * @param {string} deptCode - Code du département
   * @returns {Object|null} Données en cache ou null
   */
  const getCachedDepartment = deptCode => {
    const cacheEntry = departmentState.cache.get(deptCode)
    return cacheEntry ? cacheEntry.data : null
  }

  /**
   * Obtient les moyennes départementales depuis le cache
   * @param {string} deptCode - Code du département
   * @returns {Object|null} Moyennes en cache ou null
   */
  const getCachedAverages = deptCode => {
    const cacheEntry = departmentState.averagesCache.get(`averages-${deptCode}`)
    return cacheEntry ? cacheEntry.data : null
  }

  /**
   * Vérifie si un département est en cours de chargement
   * @param {string} deptCode - Code du département
   * @returns {boolean} True si en cours de chargement
   */
  const isLoading = deptCode => {
    return departmentState.loadingDepartments.has(deptCode)
  }

  /**
   * Pré-charge plusieurs départements en arrière-plan
   * @param {string[]} deptCodes - Codes des départements à pré-charger
   */
  const preloadDepartments = async deptCodes => {
    const promises = deptCodes.filter(code => !departmentState.cache.has(code)).map(code => loadDepartment(code))

    try {
      await Promise.allSettled(promises)
    } catch (_error) {}
  }

  /**
   * Nettoie le cache des entrées anciennes
   * @param {number} maxAge - Âge maximum en millisecondes (défaut: 1 heure)
   */
  const cleanupCache = (maxAge = 60 * 60 * 1000) => {
    const now = Date.now()
    let cleanedCount = 0

    // Nettoyer le cache principal
    for (const [key, entry] of departmentState.cache) {
      if (now - entry.loadedAt > maxAge) {
        departmentState.cache.delete(key)
        cleanedCount++
      }
    }

    // Nettoyer le cache des moyennes
    for (const [key, entry] of departmentState.averagesCache) {
      if (now - entry.loadedAt > maxAge) {
        departmentState.averagesCache.delete(key)
        cleanedCount++
      }
    }
    return cleanedCount
  }

  /**
   * Vide complètement le cache
   */
  const clearCache = () => {
    const _totalEntries = departmentState.cache.size + departmentState.averagesCache.size
    departmentState.cache.clear()
    departmentState.averagesCache.clear()
    departmentState.cacheStats.hits = 0
    departmentState.cacheStats.misses = 0
    departmentState.cacheStats.totalRequests = 0
  }

  /**
   * Obtient les statistiques du cache
   * @returns {Object} Statistiques détaillées
   */
  const getCacheStats = () => {
    const totalSize = Array.from(departmentState.cache.values()).reduce((sum, entry) => sum + (entry.size || 0), 0)

    return {
      ...departmentState.cacheStats,
      cacheSize: departmentState.cache.size,
      averagesCacheSize: departmentState.averagesCache.size,
      totalCacheSize: totalSize,
      hitRate:
        departmentState.cacheStats.totalRequests > 0
          ? ((departmentState.cacheStats.hits / departmentState.cacheStats.totalRequests) * 100).toFixed(2)
          : 0,
      loadingCount: departmentState.loadingDepartments.size
    }
  }

  // Propriétés calculées réactives
  const cacheSize = computed(() => departmentState.cache.size)
  const isAnyLoading = computed(() => departmentState.loadingDepartments.size > 0)
  const hitRate = computed(() => {
    const { hits, totalRequests } = departmentState.cacheStats
    return totalRequests > 0 ? ((hits / totalRequests) * 100).toFixed(1) : 0
  })

  // Nettoyage automatique du cache toutes les heures
  if (typeof window !== 'undefined') {
    setInterval(() => cleanupCache(), 60 * 60 * 1000)
  }

  // API publique du store
  return {
    // État réactif
    cache: computed(() => departmentState.cache),
    lastError: computed(() => departmentState.lastError),
    cacheStats: computed(() => departmentState.cacheStats),

    // Propriétés calculées
    cacheSize,
    isAnyLoading,
    hitRate,

    // Actions principales
    loadDepartment,
    loadDepartmentAverages,

    // Accès au cache
    getCachedDepartment,
    getCachedAverages,
    isLoading,

    // Utilitaires de performance
    preloadDepartments,
    cleanupCache,
    clearCache,
    getCacheStats,

    // Gestion d'erreurs
    clearError: () => {
      departmentState.lastError = null
    }
  }
}
