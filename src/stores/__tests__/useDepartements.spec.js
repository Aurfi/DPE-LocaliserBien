/**
 * Tests unitaires pour useDepartements
 * Store centralisé de gestion et mise en cache des données départementales
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Helper — crée une réponse fetch réussie
const mockOkResponse = data =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data)
  })

// Helper — crée une réponse fetch en erreur
const mockErrorResponse = (status = 404) =>
  Promise.resolve({
    ok: false,
    status,
    json: () => Promise.reject(new Error('No JSON on error response'))
  })

// Exemple de données de département
const sampleDeptData = {
  communes: [
    { nom: 'Paris 1er', codePostal: '75001', lat: 48.8602, lon: 2.347 },
    { nom: 'Paris 2ème', codePostal: '75002', lat: 48.8666, lon: 2.3491 },
    { nom: 'Marseille', codePostal: '13001', lat: 43.2965, lon: 5.3698 }
  ]
}

const sampleAveragesData = {
  department: '75',
  overall: { consumption: { total: 200 } },
  surfaceRanges: [{ range: '0-50m²', consumption: { total: 180 } }]
}

describe('useDepartements', () => {
  let store

  beforeEach(async () => {
    // Réinitialiser fetch mock
    vi.resetAllMocks()
    localStorage.getItem.mockReturnValue(null)

    // Importer et créer une instance fraîche du store, puis vider le cache
    const mod = await import('../useDepartements.js')
    store = mod.useDepartements()
    store.clearCache()
  })

  afterEach(() => {
    store.clearCache()
    store.clearError()
    vi.clearAllMocks()
  })

  // ---------------------------------------------------------------------------
  // loadDepartment — chargement réussi
  // ---------------------------------------------------------------------------
  describe('loadDepartment - chargement réussi', () => {
    it("charge les données d'un département et les retourne", async () => {
      fetch.mockReturnValueOnce(mockOkResponse(sampleDeptData))

      const result = await store.loadDepartment('75')

      expect(result).toEqual(sampleDeptData)
    })

    it("appelle fetch avec l'URL correcte", async () => {
      fetch.mockReturnValueOnce(mockOkResponse(sampleDeptData))

      await store.loadDepartment('13')

      expect(fetch).toHaveBeenCalledWith('/data/departments/communes-dept-13.json')
    })

    it("utilise l'URL correcte pour les départements Corse (2A)", async () => {
      fetch.mockReturnValueOnce(mockOkResponse(sampleDeptData))

      await store.loadDepartment('2A')

      expect(fetch).toHaveBeenCalledWith('/data/departments/communes-dept-2A.json')
    })

    it("utilise l'URL correcte pour les départements DOM-TOM (971)", async () => {
      fetch.mockReturnValueOnce(mockOkResponse(sampleDeptData))

      await store.loadDepartment('971')

      expect(fetch).toHaveBeenCalledWith('/data/departments/communes-dept-971.json')
    })

    it('met les données en cache après le premier chargement', async () => {
      fetch.mockReturnValueOnce(mockOkResponse(sampleDeptData))

      await store.loadDepartment('75')

      expect(store.getCachedDepartment('75')).toEqual(sampleDeptData)
    })

    it('incrémente cacheStats.totalRequests à chaque appel', async () => {
      fetch.mockReturnValue(mockOkResponse(sampleDeptData))
      store.clearCache()

      await store.loadDepartment('75')
      await store.loadDepartment('75')

      expect(store.cacheStats.value.totalRequests).toBe(2)
    })
  })

  // ---------------------------------------------------------------------------
  // loadDepartment — mise en cache (cache hits)
  // ---------------------------------------------------------------------------
  describe('loadDepartment - mise en cache intelligente', () => {
    it('retourne les données du cache sans rappeler fetch', async () => {
      fetch.mockReturnValueOnce(mockOkResponse(sampleDeptData))

      // Premier appel: miss
      await store.loadDepartment('75')
      fetch.mockClear()

      // Deuxième appel: doit utiliser le cache
      const cached = await store.loadDepartment('75')

      expect(fetch).not.toHaveBeenCalled()
      expect(cached).toEqual(sampleDeptData)
    })

    it("incrémente cacheStats.hits lors d'un hit de cache", async () => {
      fetch.mockReturnValueOnce(mockOkResponse(sampleDeptData))
      store.clearCache()

      await store.loadDepartment('75') // miss
      await store.loadDepartment('75') // hit

      expect(store.cacheStats.value.hits).toBe(1)
    })

    it("incrémente cacheStats.misses lors d'un premier chargement", async () => {
      fetch.mockReturnValueOnce(mockOkResponse(sampleDeptData))
      store.clearCache()

      await store.loadDepartment('75')

      expect(store.cacheStats.value.misses).toBe(1)
    })

    it('force le rechargement depuis le serveur quand forceReload est true', async () => {
      fetch
        .mockReturnValueOnce(mockOkResponse(sampleDeptData))
        .mockReturnValueOnce(mockOkResponse({ ...sampleDeptData, updated: true }))

      await store.loadDepartment('75')
      const reloaded = await store.loadDepartment('75', true)

      expect(fetch).toHaveBeenCalledTimes(2)
      expect(reloaded.updated).toBe(true)
    })

    it('getCachedDepartment retourne null pour un département non chargé', () => {
      expect(store.getCachedDepartment('99')).toBeNull()
    })

    it('getCachedDepartment retourne les données après chargement', async () => {
      fetch.mockReturnValueOnce(mockOkResponse(sampleDeptData))

      await store.loadDepartment('75')

      expect(store.getCachedDepartment('75')).toEqual(sampleDeptData)
    })
  })

  // ---------------------------------------------------------------------------
  // loadDepartment — déduplication des requêtes simultanées
  // ---------------------------------------------------------------------------
  describe('loadDepartment - déduplication des requêtes simultanées', () => {
    it("ne lance qu'une seule requête fetch pour des appels simultanés sur le même département", async () => {
      let resolveResponse
      const pendingFetch = new Promise(resolve => {
        resolveResponse = resolve
      })
      fetch.mockReturnValue(
        pendingFetch.then(() => ({ ok: true, status: 200, json: () => Promise.resolve(sampleDeptData) }))
      )

      // Lancer deux requêtes simultanées
      const p1 = store.loadDepartment('75')
      const p2 = store.loadDepartment('75')

      // Résoudre la requête en attente
      resolveResponse()
      const [r1, r2] = await Promise.all([p1, p2])

      // fetch ne doit avoir été appelé qu'une fois
      expect(fetch).toHaveBeenCalledOnce()
      expect(r1).toEqual(sampleDeptData)
      expect(r2).toEqual(sampleDeptData)
    })
  })

  // ---------------------------------------------------------------------------
  // loadDepartment — gestion des erreurs réseau
  // ---------------------------------------------------------------------------
  describe('loadDepartment - gestion des erreurs', () => {
    it('retourne null en cas de réponse 404', async () => {
      fetch.mockReturnValueOnce(mockErrorResponse(404))

      const result = await store.loadDepartment('99')

      expect(result).toBeNull()
    })

    it('retourne null en cas de réponse 500', async () => {
      fetch.mockReturnValueOnce(mockErrorResponse(500))

      const result = await store.loadDepartment('75')

      expect(result).toBeNull()
    })

    it("définit lastError en cas d'erreur réseau", async () => {
      fetch.mockReturnValueOnce(mockErrorResponse(404))

      await store.loadDepartment('99')

      expect(store.lastError.value).toBeTruthy()
      expect(typeof store.lastError.value).toBe('string')
    })

    it("le message d'erreur contient le code département", async () => {
      fetch.mockReturnValueOnce(mockErrorResponse(404))

      await store.loadDepartment('99')

      expect(store.lastError.value).toContain('99')
    })

    it('retourne null quand fetch rejette la promesse (erreur réseau)', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await store.loadDepartment('75')

      expect(result).toBeNull()
    })

    it('retourne null pour un code département null ou undefined', async () => {
      const resultNull = await store.loadDepartment(null)
      const resultUndef = await store.loadDepartment(undefined)

      expect(resultNull).toBeNull()
      expect(resultUndef).toBeNull()
      expect(fetch).not.toHaveBeenCalled()
    })

    it('définit lastError "Code département manquant" quand deptCode est falsy', async () => {
      await store.loadDepartment(null)

      expect(store.lastError.value).toBe('Code département manquant')
    })

    it('retourne null et définit lastError pour des données JSON invalides (non-objet)', async () => {
      fetch.mockReturnValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(null)
      })

      const result = await store.loadDepartment('75')

      expect(result).toBeNull()
    })

    it("ne met pas en cache les données d'un département en erreur", async () => {
      fetch.mockReturnValueOnce(mockErrorResponse(404))

      await store.loadDepartment('99')

      expect(store.getCachedDepartment('99')).toBeNull()
    })

    it('réinitialise loadingDepartments après une erreur', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'))

      await store.loadDepartment('75')

      expect(store.isLoading('75')).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // loadDepartmentAverages
  // ---------------------------------------------------------------------------
  describe('loadDepartmentAverages - chargement des moyennes départementales', () => {
    it('charge et retourne les moyennes pour un département', async () => {
      fetch.mockReturnValueOnce(mockOkResponse(sampleAveragesData))

      const result = await store.loadDepartmentAverages('75')

      expect(result).toBeDefined()
      expect(result.data).toEqual(sampleAveragesData)
    })

    it('retourne null pour une réponse 404 (moyennes optionnelles)', async () => {
      fetch.mockReturnValueOnce(mockErrorResponse(404))

      const result = await store.loadDepartmentAverages('75')

      expect(result).toBeNull()
    })

    it('retourne null quand deptCode est null ou undefined', async () => {
      expect(await store.loadDepartmentAverages(null)).toBeNull()
      expect(await store.loadDepartmentAverages(undefined)).toBeNull()
      expect(fetch).not.toHaveBeenCalled()
    })

    it("appelle fetch avec l'URL correcte pour les moyennes", async () => {
      fetch.mockReturnValueOnce(mockOkResponse(sampleAveragesData))

      await store.loadDepartmentAverages('13')

      expect(fetch).toHaveBeenCalledWith('/data/departments/dpe-averages-dept-13.json')
    })

    it('met les moyennes en cache et ne rappelle pas fetch', async () => {
      fetch.mockReturnValueOnce(mockOkResponse(sampleAveragesData))

      await store.loadDepartmentAverages('75')
      fetch.mockClear()
      await store.loadDepartmentAverages('75')

      expect(fetch).not.toHaveBeenCalled()
    })

    it('getCachedAverages retourne null avant chargement', () => {
      expect(store.getCachedAverages('75')).toBeNull()
    })

    it('getCachedAverages retourne les données après chargement', async () => {
      fetch.mockReturnValueOnce(mockOkResponse(sampleAveragesData))

      await store.loadDepartmentAverages('75')

      expect(store.getCachedAverages('75')).toEqual(sampleAveragesData)
    })

    it('force le rechargement avec forceReload = true', async () => {
      fetch
        .mockReturnValueOnce(mockOkResponse(sampleAveragesData))
        .mockReturnValueOnce(mockOkResponse({ ...sampleAveragesData, updated: true }))

      await store.loadDepartmentAverages('75')
      await store.loadDepartmentAverages('75', true)

      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it("retourne null en cas d'erreur réseau", async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await store.loadDepartmentAverages('75')

      expect(result).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // preloadDepartments — pré-chargement de plusieurs départements
  // ---------------------------------------------------------------------------
  describe('preloadDepartments - pré-chargement parallèle', () => {
    it('charge plusieurs départements en parallèle', async () => {
      fetch
        .mockReturnValueOnce(mockOkResponse(sampleDeptData))
        .mockReturnValueOnce(mockOkResponse(sampleDeptData))
        .mockReturnValueOnce(mockOkResponse(sampleDeptData))

      await store.preloadDepartments(['13', '69', '33'])

      expect(fetch).toHaveBeenCalledTimes(3)
    })

    it('ne recharge pas les départements déjà en cache', async () => {
      fetch.mockReturnValueOnce(mockOkResponse(sampleDeptData))
      await store.loadDepartment('75')
      fetch.mockClear()
      fetch.mockReturnValueOnce(mockOkResponse(sampleDeptData))

      await store.preloadDepartments(['75', '13'])

      // Seulement '13' doit être chargé
      expect(fetch).toHaveBeenCalledOnce()
      expect(fetch).toHaveBeenCalledWith('/data/departments/communes-dept-13.json')
    })

    it("ne lève pas d'erreur quand certains chargements échouent", async () => {
      fetch.mockReturnValueOnce(mockOkResponse(sampleDeptData)).mockReturnValueOnce(mockErrorResponse(404))

      await expect(store.preloadDepartments(['75', '99'])).resolves.not.toThrow()
    })

    it('ne lance aucune requête pour un tableau vide', async () => {
      await store.preloadDepartments([])

      expect(fetch).not.toHaveBeenCalled()
    })

    it('met les données en cache après pré-chargement', async () => {
      fetch.mockReturnValueOnce(mockOkResponse(sampleDeptData))

      await store.preloadDepartments(['44'])

      expect(store.getCachedDepartment('44')).toEqual(sampleDeptData)
    })
  })

  // ---------------------------------------------------------------------------
  // cleanupCache — nettoyage du cache par âge
  // ---------------------------------------------------------------------------
  describe('cleanupCache - nettoyage du cache', () => {
    it('supprime les entrées plus anciennes que maxAge', async () => {
      fetch.mockReturnValueOnce(mockOkResponse(sampleDeptData))
      await store.loadDepartment('75')

      // Forcer l'entrée à sembler ancienne en modifiant loadedAt
      const cacheMap = store.cache.value
      const entry = cacheMap.get('75')
      entry.loadedAt = Date.now() - 2 * 60 * 60 * 1000 // 2 heures dans le passé

      const cleaned = store.cleanupCache(60 * 60 * 1000) // maxAge 1h

      expect(cleaned).toBeGreaterThanOrEqual(1)
      expect(store.getCachedDepartment('75')).toBeNull()
    })

    it('conserve les entrées plus récentes que maxAge', async () => {
      fetch.mockReturnValueOnce(mockOkResponse(sampleDeptData))
      await store.loadDepartment('75')

      const cleaned = store.cleanupCache(60 * 60 * 1000) // maxAge 1h, entrée récente

      expect(cleaned).toBe(0)
      expect(store.getCachedDepartment('75')).toEqual(sampleDeptData)
    })

    it('utilise 1 heure comme âge maximum par défaut', async () => {
      fetch.mockReturnValueOnce(mockOkResponse(sampleDeptData))
      await store.loadDepartment('75')

      // Entrée récente : ne doit pas être nettoyée
      const cleaned = store.cleanupCache()

      expect(cleaned).toBe(0)
    })

    it("retourne le nombre total d'entrées nettoyées (cache + moyennes)", async () => {
      fetch.mockReturnValueOnce(mockOkResponse(sampleDeptData)).mockReturnValueOnce(mockOkResponse(sampleAveragesData))

      await store.loadDepartment('75')
      await store.loadDepartmentAverages('75')

      // Forcer les deux entrées à être anciennes
      const cacheMap = store.cache.value
      cacheMap.get('75').loadedAt = Date.now() - 2 * 60 * 60 * 1000

      const _avgKey = 'averages-75'
      const _avgMap = store.cache.value // averagesCache n'est pas exposé directement
      // On ne peut tester que via le compte retourné ≥ 1 (seulement le cache principal exposé)
      const cleaned = store.cleanupCache(60 * 60 * 1000)

      expect(cleaned).toBeGreaterThanOrEqual(1)
    })

    it('retourne 0 quand le cache est vide', () => {
      store.clearCache()
      const cleaned = store.cleanupCache()
      expect(cleaned).toBe(0)
    })
  })

  // ---------------------------------------------------------------------------
  // clearCache — vidage complet du cache
  // ---------------------------------------------------------------------------
  describe('clearCache - vidage complet', () => {
    it('supprime toutes les entrées du cache principal', async () => {
      fetch.mockReturnValueOnce(mockOkResponse(sampleDeptData)).mockReturnValueOnce(mockOkResponse(sampleDeptData))

      await store.loadDepartment('75')
      await store.loadDepartment('13')

      store.clearCache()

      expect(store.getCachedDepartment('75')).toBeNull()
      expect(store.getCachedDepartment('13')).toBeNull()
    })

    it('remet les statistiques du cache à zéro', async () => {
      fetch.mockReturnValueOnce(mockOkResponse(sampleDeptData))
      await store.loadDepartment('75')
      await store.loadDepartment('75') // hit

      store.clearCache()

      expect(store.cacheStats.value.hits).toBe(0)
      expect(store.cacheStats.value.misses).toBe(0)
      expect(store.cacheStats.value.totalRequests).toBe(0)
    })

    it('cacheSize est 0 après clearCache', async () => {
      fetch.mockReturnValueOnce(mockOkResponse(sampleDeptData))
      await store.loadDepartment('75')

      store.clearCache()

      expect(store.cacheSize.value).toBe(0)
    })
  })

  // ---------------------------------------------------------------------------
  // getCacheStats — statistiques du cache
  // ---------------------------------------------------------------------------
  describe('getCacheStats - statistiques', () => {
    it('retourne un objet de statistiques avec les champs attendus', () => {
      const stats = store.getCacheStats()

      expect(stats).toHaveProperty('hits')
      expect(stats).toHaveProperty('misses')
      expect(stats).toHaveProperty('totalRequests')
      expect(stats).toHaveProperty('cacheSize')
      expect(stats).toHaveProperty('averagesCacheSize')
      expect(stats).toHaveProperty('totalCacheSize')
      expect(stats).toHaveProperty('hitRate')
      expect(stats).toHaveProperty('loadingCount')
    })

    it("hitRate est 0 quand aucune requête n'a été faite", () => {
      store.clearCache()
      const stats = store.getCacheStats()
      expect(stats.hitRate).toBe(0)
    })

    it('hitRate est calculé correctement après des hits et des misses', async () => {
      fetch.mockReturnValue(mockOkResponse(sampleDeptData))
      store.clearCache()

      await store.loadDepartment('75') // miss
      await store.loadDepartment('75') // hit
      await store.loadDepartment('75') // hit

      const stats = store.getCacheStats()
      // 2 hits sur 3 requêtes = 66.67%
      expect(parseFloat(stats.hitRate)).toBeCloseTo(66.67, 1)
    })

    it('cacheSize reflète le nombre de départements en cache', async () => {
      fetch.mockReturnValueOnce(mockOkResponse(sampleDeptData)).mockReturnValueOnce(mockOkResponse(sampleDeptData))

      await store.loadDepartment('75')
      await store.loadDepartment('13')

      const stats = store.getCacheStats()
      expect(stats.cacheSize).toBe(2)
    })
  })

  // ---------------------------------------------------------------------------
  // isLoading — état de chargement
  // ---------------------------------------------------------------------------
  describe('isLoading - état de chargement', () => {
    it('retourne false pour un département non en cours de chargement', () => {
      expect(store.isLoading('75')).toBe(false)
    })

    it('retourne false après un chargement terminé', async () => {
      fetch.mockReturnValueOnce(mockOkResponse(sampleDeptData))

      await store.loadDepartment('75')

      expect(store.isLoading('75')).toBe(false)
    })

    it('retourne false après une erreur de chargement', async () => {
      fetch.mockReturnValueOnce(mockErrorResponse(404))

      await store.loadDepartment('75')

      expect(store.isLoading('75')).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Propriétés calculées réactives
  // ---------------------------------------------------------------------------
  describe('Propriétés calculées réactives', () => {
    it('cacheSize reflète le nombre de départements en cache', async () => {
      expect(store.cacheSize.value).toBe(0)

      fetch.mockReturnValueOnce(mockOkResponse(sampleDeptData))
      await store.loadDepartment('75')

      expect(store.cacheSize.value).toBe(1)
    })

    it('hitRate calculé retourne 0 quand totalRequests est 0', () => {
      store.clearCache()
      expect(store.hitRate.value).toBe(0)
    })

    it('isAnyLoading est false quand aucun département est en chargement', () => {
      expect(store.isAnyLoading.value).toBe(false)
    })

    it('clearError remet lastError à null', async () => {
      fetch.mockReturnValueOnce(mockErrorResponse(404))
      await store.loadDepartment(null)

      expect(store.lastError.value).toBeTruthy()
      store.clearError()
      expect(store.lastError.value).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // Cas limites
  // ---------------------------------------------------------------------------
  describe('Cas limites', () => {
    it('gère correctement un département avec un objet de données vide {}', async () => {
      fetch.mockReturnValueOnce(mockOkResponse({}))

      const result = await store.loadDepartment('75')

      // {} est un objet valide, doit être stocké
      expect(result).toEqual({})
      expect(store.getCachedDepartment('75')).toEqual({})
    })

    it("appels successifs à loadDepartment avec des codes différents n'interfèrent pas", async () => {
      const data13 = { communes: [{ nom: 'Marseille' }] }
      const data69 = { communes: [{ nom: 'Lyon' }] }

      fetch.mockReturnValueOnce(mockOkResponse(data13)).mockReturnValueOnce(mockOkResponse(data69))

      const [r13, r69] = await Promise.all([store.loadDepartment('13'), store.loadDepartment('69')])

      expect(r13).toEqual(data13)
      expect(r69).toEqual(data69)
    })

    it('code département chaîne vide traité comme deptCode manquant', async () => {
      const result = await store.loadDepartment('')

      expect(result).toBeNull()
      expect(fetch).not.toHaveBeenCalled()
    })
  })
})
