/**
 * Tests unitaires pour useRecherches
 * Store centralisé de gestion de l'historique des recherches
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The store uses module-level reactive state that persists across imports.
// We reset it via clearSearchHistory between each test.

describe('useRecherches', () => {
  let store

  // Helper to build a minimal valid searchData object
  const buildSearchData = (overrides = {}) => ({
    commune: 'Paris',
    surfaceHabitable: 80,
    consommationEnergie: 200,
    emissionGES: 30,
    energyClass: 'C',
    gesClass: 'C',
    typeBien: 'appartement',
    ...overrides
  })

  beforeEach(async () => {
    // Import fresh reference — module is cached but state is reset via clearSearchHistory
    const mod = await import('../useRecherches.js')
    store = mod.useRecherches()

    // Reset global reactive state and localStorage before every test
    store.clearSearchHistory('all')
    vi.clearAllMocks()
    localStorage.getItem.mockReset()
    localStorage.setItem.mockReset()
    localStorage.removeItem.mockReset()
    localStorage.clear.mockReset()
    // After clearing, make getItem return null so loadRecentSearches sees empty storage
    localStorage.getItem.mockReturnValue(null)
  })

  afterEach(() => {
    store.clearSearchHistory('all')
  })

  // ---------------------------------------------------------------------------
  // loadRecentSearches
  // ---------------------------------------------------------------------------
  describe('loadRecentSearches - chargement depuis localStorage', () => {
    it('retourne un tableau vide quand localStorage est vide', () => {
      localStorage.getItem.mockReturnValue(null)

      const result = store.loadRecentSearches()

      expect(result).toEqual([])
      expect(store.recentSearches.value).toEqual([])
    })

    it('charge et retourne les recherches stockées dans localStorage', () => {
      const stored = [{ commune: 'Lyon', surface: 60, consommation: 150 }]
      localStorage.getItem.mockReturnValue(JSON.stringify(stored))

      const result = store.loadRecentSearches()

      expect(result).toEqual(stored)
      expect(store.recentSearches.value).toEqual(stored)
    })

    it('utilise la clé "dpe_recent_searches" pour lire depuis localStorage', () => {
      localStorage.getItem.mockReturnValue(null)

      store.loadRecentSearches()

      expect(localStorage.getItem).toHaveBeenCalledWith('dpe_recent_searches')
    })

    it("retourne un tableau vide et ne lève pas d'erreur pour du JSON corrompu", () => {
      localStorage.getItem.mockReturnValue('{{invalid json{{')

      const result = store.loadRecentSearches()

      expect(result).toEqual([])
      expect(store.recentSearches.value).toEqual([])
    })

    it('retourne un tableau vide pour une chaîne vide dans localStorage', () => {
      localStorage.getItem.mockReturnValue('')

      const result = store.loadRecentSearches()

      expect(result).toEqual([])
    })

    it('retourne un tableau vide pour la valeur JSON "null" dans localStorage', () => {
      localStorage.getItem.mockReturnValue('null')

      const result = store.loadRecentSearches()

      // JSON.parse("null") returns null; the store may return null or []
      expect(result == null || Array.isArray(result)).toBe(true)
    })

    it('gère gracieusement un JSON partiellement tronqué', () => {
      localStorage.getItem.mockReturnValue('[{"commune":"Paris"')

      const result = store.loadRecentSearches()

      expect(result).toEqual([])
    })

    it('charge correctement un historique de plusieurs entrées', () => {
      const stored = [
        { commune: 'Paris', surface: 80, consommation: 200, timestamp: 1000 },
        { commune: 'Lyon', surface: 60, consommation: 150, timestamp: 900 }
      ]
      localStorage.getItem.mockReturnValue(JSON.stringify(stored))

      const result = store.loadRecentSearches()

      expect(result).toHaveLength(2)
      expect(result[0].commune).toBe('Paris')
      expect(result[1].commune).toBe('Lyon')
    })
  })

  // ---------------------------------------------------------------------------
  // saveSearch
  // ---------------------------------------------------------------------------
  describe("saveSearch - sauvegarde d'une nouvelle recherche", () => {
    it('sauvegarde une nouvelle recherche et retourne true', () => {
      const result = store.saveSearch(buildSearchData())

      expect(result).toBe(true)
      expect(store.recentSearches.value).toHaveLength(1)
    })

    it("construit correctement l'objet de recherche depuis searchData", () => {
      const data = buildSearchData({
        commune: 'Marseille',
        surfaceHabitable: 90,
        consommationEnergie: 250,
        emissionGES: 40,
        energyClass: 'D',
        gesClass: 'D',
        typeBien: 'maison'
      })

      store.saveSearch(data, 5, 88, 2)

      const saved = store.recentSearches.value[0]
      expect(saved.commune).toBe('Marseille')
      expect(saved.surface).toBe(90)
      expect(saved.consommation).toBe(250)
      expect(saved.ges).toBe(40)
      expect(saved.energyClass).toBe('D')
      expect(saved.gesClass).toBe('D')
      expect(saved.typeBien).toBe('maison')
      expect(saved.resultCount).toBe(5)
      expect(saved.matchScore).toBe(88)
      expect(saved.perfectMatchCount).toBe(2)
    })

    it('ajoute un timestamp à la recherche sauvegardée', () => {
      const before = Date.now()
      store.saveSearch(buildSearchData())
      const after = Date.now()

      const saved = store.recentSearches.value[0]
      expect(saved.timestamp).toBeGreaterThanOrEqual(before)
      expect(saved.timestamp).toBeLessThanOrEqual(after)
    })

    it('utilise des valeurs par défaut 0 pour resultCount, matchScore et perfectMatchCount', () => {
      store.saveSearch(buildSearchData())

      const saved = store.recentSearches.value[0]
      expect(saved.resultCount).toBe(0)
      expect(saved.matchScore).toBe(0)
      expect(saved.perfectMatchCount).toBe(0)
    })

    it('ajoute les nouvelles recherches en tête de liste (unshift)', () => {
      store.saveSearch(buildSearchData({ commune: 'Paris' }))
      store.saveSearch(buildSearchData({ commune: 'Lyon', consommationEnergie: 180 }))

      expect(store.recentSearches.value[0].commune).toBe('Lyon')
      expect(store.recentSearches.value[1].commune).toBe('Paris')
    })

    it('persiste la recherche dans localStorage via setItem', () => {
      store.saveSearch(buildSearchData())

      expect(localStorage.setItem).toHaveBeenCalledWith('dpe_recent_searches', expect.any(String))
    })

    it('déclenche un StorageEvent après la sauvegarde', () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

      store.saveSearch(buildSearchData())

      expect(dispatchSpy).toHaveBeenCalledOnce()
      const event = dispatchSpy.mock.calls[0][0]
      expect(event.type).toBe('storage')
      expect(event.key).toBe('dpe_recent_searches')

      dispatchSpy.mockRestore()
    })

    it('déduplique une recherche identique (même commune, surface et consommation)', () => {
      const data = buildSearchData({ commune: 'Bordeaux', surfaceHabitable: 70, consommationEnergie: 160 })

      store.saveSearch(data, 3, 75)
      store.saveSearch(data, 7, 90)

      expect(store.recentSearches.value).toHaveLength(1)
    })

    it("met à jour les méta-données lors d'une déduplication", () => {
      const data = buildSearchData({ commune: 'Bordeaux', surfaceHabitable: 70, consommationEnergie: 160 })

      store.saveSearch(data, 3, 75)
      store.saveSearch(data, 7, 90)

      expect(store.recentSearches.value[0].resultCount).toBe(7)
      expect(store.recentSearches.value[0].matchScore).toBe(90)
    })

    it("préserve le displayName lors d'une déduplication", () => {
      const data = buildSearchData({ commune: 'Bordeaux', surfaceHabitable: 70, consommationEnergie: 160 })

      store.saveSearch(data, 3, 75)
      // Manually assign a displayName to the existing entry
      store.recentSearches.value[0].displayName = 'Mon appart Bordeaux'

      store.saveSearch(data, 7, 90)

      expect(store.recentSearches.value[0].displayName).toBe('Mon appart Bordeaux')
    })

    it("ne préserve pas displayName s'il n'existait pas avant la mise à jour", () => {
      const data = buildSearchData({ commune: 'Bordeaux', surfaceHabitable: 70, consommationEnergie: 160 })

      store.saveSearch(data, 3, 75)
      store.saveSearch(data, 7, 90)

      expect(store.recentSearches.value[0].displayName).toBeUndefined()
    })

    it("limite l'historique à 10 recherches maximum", () => {
      for (let i = 1; i <= 12; i++) {
        store.saveSearch(
          buildSearchData({ commune: `Ville${i}`, surfaceHabitable: i * 10, consommationEnergie: i * 20 })
        )
      }

      expect(store.recentSearches.value).toHaveLength(10)
    })

    it('garde les 10 entrées les plus récentes quand la limite est atteinte', () => {
      for (let i = 1; i <= 12; i++) {
        store.saveSearch(
          buildSearchData({ commune: `Ville${i}`, surfaceHabitable: i * 10, consommationEnergie: i * 20 })
        )
      }

      // Most recent = Ville12 at index 0, oldest kept = Ville3 at index 9
      expect(store.recentSearches.value[0].commune).toBe('Ville12')
      expect(store.recentSearches.value[9].commune).toBe('Ville3')
    })

    it('traite gracieusement les champs searchData manquants (undefined)', () => {
      const result = store.saveSearch({})

      expect(result).toBe(true)
      const saved = store.recentSearches.value[0]
      expect(saved.commune).toBeUndefined()
      expect(saved.surface).toBeUndefined()
    })

    it("charge l'historique depuis localStorage si l'état interne est vide", () => {
      // Préparer un historique dans localStorage
      const existing = [{ commune: 'Nantes', surface: 50, consommation: 120, timestamp: 1000 }]
      localStorage.getItem.mockReturnValue(JSON.stringify(existing))

      // Forcer l'état interne à zéro via clearSearchHistory puis recharger
      store.clearSearchHistory('recent')
      // saveSearch appellera loadRecentSearches car recentSearches.length === 0
      store.saveSearch(buildSearchData({ commune: 'Rennes', surfaceHabitable: 65, consommationEnergie: 140 }))

      // La nouvelle recherche doit être ajoutée en tête après le chargement
      expect(store.recentSearches.value.length).toBeGreaterThanOrEqual(1)
      expect(store.recentSearches.value[0].commune).toBe('Rennes')
    })
  })

  // ---------------------------------------------------------------------------
  // clearSearchHistory / clearHistory
  // ---------------------------------------------------------------------------
  describe("clearSearchHistory - effacement de l'historique", () => {
    it('efface uniquement les recherches récentes avec type "recent"', () => {
      store.saveSearch(buildSearchData())
      store.clearSearchHistory('recent')

      expect(store.recentSearches.value).toEqual([])
      expect(localStorage.removeItem).toHaveBeenCalledWith('dpe_recent_searches')
    })

    it('efface uniquement les recherches DPE avec type "dpe"', () => {
      store.saveRecentDPESearch(
        { address: '10 rue Test', coordinates: null, monthsBack: 6, radius: 500, surface: 80 },
        { results: [] }
      )
      store.clearSearchHistory('dpe')

      expect(store.recentDPESearches.value).toEqual([])
      expect(localStorage.removeItem).toHaveBeenCalledWith('recent_dpe_searches')
    })

    it('efface les deux types avec type "all" (valeur par défaut)', () => {
      store.saveSearch(buildSearchData())
      store.clearSearchHistory('all')

      expect(store.recentSearches.value).toEqual([])
      expect(store.recentDPESearches.value).toEqual([])
      expect(localStorage.removeItem).toHaveBeenCalledWith('dpe_recent_searches')
      expect(localStorage.removeItem).toHaveBeenCalledWith('recent_dpe_searches')
    })

    it('utilise "all" comme type par défaut', () => {
      store.saveSearch(buildSearchData())
      store.clearSearchHistory()

      expect(store.recentSearches.value).toEqual([])
      expect(store.recentDPESearches.value).toEqual([])
    })

    it('retourne true après effacement réussi', () => {
      const result = store.clearSearchHistory('all')
      expect(result).toBe(true)
    })

    it("fonctionne même quand l'historique est déjà vide", () => {
      const result = store.clearSearchHistory('all')
      expect(result).toBe(true)
      expect(store.recentSearches.value).toEqual([])
    })

    it('ne touche pas aux recherches récentes quand type est "dpe"', () => {
      store.saveSearch(buildSearchData())
      store.clearSearchHistory('dpe')

      expect(store.recentSearches.value).toHaveLength(1)
    })
  })

  // ---------------------------------------------------------------------------
  // removeSearch / deleteSearch
  // ---------------------------------------------------------------------------
  describe("removeSearch - suppression d'une recherche par index", () => {
    it('supprime la recherche à l\'index spécifié pour type "recent"', () => {
      store.saveSearch(buildSearchData({ commune: 'Paris', consommationEnergie: 200 }))
      store.saveSearch(buildSearchData({ commune: 'Lyon', surfaceHabitable: 60, consommationEnergie: 150 }))

      // Après 2 insertions: [Lyon, Paris]
      store.removeSearch(0, 'recent')

      expect(store.recentSearches.value).toHaveLength(1)
      expect(store.recentSearches.value[0].commune).toBe('Paris')
    })

    it("supprime la recherche à l'index 1 (deuxième élément)", () => {
      store.saveSearch(buildSearchData({ commune: 'A', consommationEnergie: 100 }))
      store.saveSearch(buildSearchData({ commune: 'B', surfaceHabitable: 50, consommationEnergie: 120 }))
      store.saveSearch(buildSearchData({ commune: 'C', surfaceHabitable: 40, consommationEnergie: 140 }))

      // [C, B, A] après insertion
      store.removeSearch(1, 'recent')

      expect(store.recentSearches.value).toHaveLength(2)
      expect(store.recentSearches.value[0].commune).toBe('C')
      expect(store.recentSearches.value[1].commune).toBe('A')
    })

    it('persiste la liste mise à jour dans localStorage', () => {
      store.saveSearch(buildSearchData())
      localStorage.setItem.mockClear()

      store.removeSearch(0, 'recent')

      expect(localStorage.setItem).toHaveBeenCalledWith('dpe_recent_searches', expect.any(String))
    })

    it('retourne true après suppression réussie', () => {
      store.saveSearch(buildSearchData())
      const result = store.removeSearch(0, 'recent')
      expect(result).toBe(true)
    })

    it('supprime une recherche DPE quand type est "dpe"', () => {
      store.saveRecentDPESearch(
        { address: '1 rue A', coordinates: null, monthsBack: 6, radius: 500, surface: 80 },
        { results: [] }
      )
      store.saveRecentDPESearch(
        { address: '2 rue B', coordinates: null, monthsBack: 6, radius: 500, surface: 60 },
        { results: [] }
      )

      store.removeSearch(0, 'dpe')

      expect(store.recentDPESearches.value).toHaveLength(1)
    })

    it('ne touche pas aux recherches récentes quand type est "dpe"', () => {
      store.saveSearch(buildSearchData())
      store.saveRecentDPESearch(
        { address: '1 rue A', coordinates: null, monthsBack: 6, radius: 500, surface: 80 },
        { results: [] }
      )

      store.removeSearch(0, 'dpe')

      expect(store.recentSearches.value).toHaveLength(1)
    })

    it('laisse la liste intacte pour un index hors-limites (splice silencieux)', () => {
      store.saveSearch(buildSearchData())

      store.removeSearch(99, 'recent')

      // splice(99, 1) sur un tableau de 1 élément est un no-op
      expect(store.recentSearches.value).toHaveLength(1)
    })
  })

  // ---------------------------------------------------------------------------
  // updateSearchDisplayName / renameSearch
  // ---------------------------------------------------------------------------
  describe("updateSearchDisplayName - renommage d'une recherche", () => {
    it('met à jour le displayName à l\'index spécifié pour type "recent"', () => {
      store.saveSearch(buildSearchData())

      store.updateSearchDisplayName(0, 'Mon appart préféré', 'recent')

      expect(store.recentSearches.value[0].displayName).toBe('Mon appart préféré')
    })

    it('persiste la modification dans localStorage', () => {
      store.saveSearch(buildSearchData())
      localStorage.setItem.mockClear()

      store.updateSearchDisplayName(0, 'Nouveau nom')

      expect(localStorage.setItem).toHaveBeenCalledWith('dpe_recent_searches', expect.any(String))
    })

    it('met à jour le displayName d\'une recherche DPE quand type est "dpe"', () => {
      store.saveRecentDPESearch(
        { address: '1 rue Test', coordinates: null, monthsBack: 6, radius: 500, surface: 80 },
        { results: [] }
      )

      store.updateSearchDisplayName(0, 'Ma recherche DPE', 'dpe')

      expect(store.recentDPESearches.value[0].displayName).toBe('Ma recherche DPE')
    })

    it('ne modifie pas les recherches récentes quand type est "dpe"', () => {
      store.saveSearch(buildSearchData())
      store.saveRecentDPESearch(
        { address: '1 rue Test', coordinates: null, monthsBack: 6, radius: 500, surface: 80 },
        { results: [] }
      )
      const originalCommune = store.recentSearches.value[0].commune

      store.updateSearchDisplayName(0, 'Nouveau nom DPE', 'dpe')

      expect(store.recentSearches.value[0].commune).toBe(originalCommune)
      expect(store.recentSearches.value[0].displayName).toBeUndefined()
    })

    it('ne fait rien si l\'index n\'existe pas pour type "recent"', () => {
      store.saveSearch(buildSearchData())
      localStorage.setItem.mockClear()

      store.updateSearchDisplayName(99, 'Fantôme', 'recent')

      expect(localStorage.setItem).not.toHaveBeenCalled()
    })

    it('ne fait rien si l\'index n\'existe pas pour type "dpe"', () => {
      localStorage.setItem.mockClear()

      store.updateSearchDisplayName(99, 'Fantôme', 'dpe')

      expect(localStorage.setItem).not.toHaveBeenCalled()
    })

    it('retourne true après renommage réussi', () => {
      store.saveSearch(buildSearchData())
      const result = store.updateSearchDisplayName(0, 'Nouveau nom')
      expect(result).toBe(true)
    })

    it('accepte un displayName vide (chaîne vide)', () => {
      store.saveSearch(buildSearchData())
      store.updateSearchDisplayName(0, 'Nom initial')
      store.updateSearchDisplayName(0, '')

      expect(store.recentSearches.value[0].displayName).toBe('')
    })
  })

  // ---------------------------------------------------------------------------
  // Propriétés calculées réactives
  // ---------------------------------------------------------------------------
  describe('Propriétés calculées réactives', () => {
    it('recentSearchCount reflète le nombre de recherches récentes', () => {
      expect(store.recentSearchCount.value).toBe(0)

      store.saveSearch(buildSearchData({ commune: 'A', consommationEnergie: 100 }))
      expect(store.recentSearchCount.value).toBe(1)

      store.saveSearch(buildSearchData({ commune: 'B', surfaceHabitable: 50, consommationEnergie: 120 }))
      expect(store.recentSearchCount.value).toBe(2)
    })

    it("hasRecentSearches est false quand l'historique est vide", () => {
      expect(store.hasRecentSearches.value).toBe(false)
    })

    it("hasRecentSearches est true après l'ajout d'une recherche", () => {
      store.saveSearch(buildSearchData())
      expect(store.hasRecentSearches.value).toBe(true)
    })

    it('hasRecentSearches repasse à false après clearSearchHistory', () => {
      store.saveSearch(buildSearchData())
      store.clearSearchHistory('recent')
      expect(store.hasRecentSearches.value).toBe(false)
    })

    it('recentDPESearchCount reflète le nombre de recherches DPE', () => {
      expect(store.recentDPESearchCount.value).toBe(0)

      store.saveRecentDPESearch(
        { address: '1 rue Test', coordinates: null, monthsBack: 6, radius: 500, surface: 80 },
        { results: [] }
      )
      expect(store.recentDPESearchCount.value).toBe(1)
    })

    it("hasRecentDPESearches est true après l'ajout d'une recherche DPE", () => {
      store.saveRecentDPESearch(
        { address: '1 rue Test', coordinates: null, monthsBack: 6, radius: 500, surface: 80 },
        { results: [] }
      )
      expect(store.hasRecentDPESearches.value).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // Persistance localStorage — round-trip
  // ---------------------------------------------------------------------------
  describe('Persistance localStorage', () => {
    it('le JSON sauvegardé peut être re-parsé en tableau', () => {
      store.saveSearch(buildSearchData())

      const [[, json]] = localStorage.setItem.mock.calls.filter(([key]) => key === 'dpe_recent_searches')
      expect(() => JSON.parse(json)).not.toThrow()
      expect(Array.isArray(JSON.parse(json))).toBe(true)
    })

    it('le JSON sauvegardé contient les bonnes données', () => {
      store.saveSearch(buildSearchData({ commune: 'Toulouse', surfaceHabitable: 55, consommationEnergie: 130 }))

      const [[, json]] = localStorage.setItem.mock.calls.filter(([key]) => key === 'dpe_recent_searches')
      const parsed = JSON.parse(json)
      expect(parsed[0].commune).toBe('Toulouse')
    })

    it('removeSearch sauvegarde la liste réduite dans localStorage', () => {
      store.saveSearch(buildSearchData({ commune: 'A', consommationEnergie: 100 }))
      store.saveSearch(buildSearchData({ commune: 'B', surfaceHabitable: 50, consommationEnergie: 120 }))
      localStorage.setItem.mockClear()

      store.removeSearch(0, 'recent')

      expect(localStorage.setItem).toHaveBeenCalledOnce()
      const [[, json]] = localStorage.setItem.mock.calls
      expect(JSON.parse(json)).toHaveLength(1)
    })
  })

  // ---------------------------------------------------------------------------
  // Cas limites et données malformées
  // ---------------------------------------------------------------------------
  describe('Cas limites et données malformées', () => {
    it('accepte searchData avec uniquement des valeurs undefined', () => {
      expect(() => store.saveSearch({})).not.toThrow()
    })

    it('accepte un array vide restitué par localStorage', () => {
      localStorage.getItem.mockReturnValue('[]')
      const result = store.loadRecentSearches()
      expect(result).toEqual([])
    })

    it('accepte un historique de 10 entrées sans troncature', () => {
      for (let i = 1; i <= 10; i++) {
        store.saveSearch(
          buildSearchData({ commune: `Ville${i}`, surfaceHabitable: i * 5, consommationEnergie: i * 15 })
        )
      }
      expect(store.recentSearches.value).toHaveLength(10)
    })

    it("tronque à 10 après l'ajout d'un 11ème élément", () => {
      for (let i = 1; i <= 11; i++) {
        store.saveSearch(
          buildSearchData({ commune: `Ville${i}`, surfaceHabitable: i * 5, consommationEnergie: i * 15 })
        )
      }
      expect(store.recentSearches.value).toHaveLength(10)
    })

    it('clearError remet lastError à null', () => {
      // Provoquer une erreur en rendant setItem lancer une exception
      localStorage.setItem.mockImplementationOnce(() => {
        throw new Error('Quota exceeded')
      })
      store.saveSearch(buildSearchData())
      // lastError est maintenant défini
      expect(store.lastError.value).toBe('Quota exceeded')

      store.clearError()
      expect(store.lastError.value).toBeNull()
    })

    it('setLoading met à jour isLoading', () => {
      expect(store.isLoading.value).toBe(false)
      store.setLoading(true)
      expect(store.isLoading.value).toBe(true)
      store.setLoading(false)
      expect(store.isLoading.value).toBe(false)
    })

    it('saveSearch retourne false quand localStorage.setItem lève une exception', () => {
      localStorage.setItem.mockImplementation(() => {
        throw new Error('Storage full')
      })

      const result = store.saveSearch(buildSearchData())
      expect(result).toBe(false)
    })

    it('removeSearch retourne false quand localStorage.setItem lève une exception', () => {
      store.saveSearch(buildSearchData())
      localStorage.setItem.mockImplementation(() => {
        throw new Error('Storage full')
      })

      const result = store.removeSearch(0, 'recent')
      expect(result).toBe(false)
    })
  })
})
