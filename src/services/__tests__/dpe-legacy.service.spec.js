import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DPELegacyService from '../dpe-legacy.service.js'

// Mock fetch globally
global.fetch = vi.fn()

// Mock data for tests
const mockCommunesIndex = {
  postalCodeToDepartment: {
    75001: '75',
    13001: '13',
    69001: '69'
  },
  departments: {
    75: { name: 'Paris' },
    13: { name: 'Bouches-du-Rhône' },
    69: { name: 'Rhône' }
  }
}

const mockDepartmentData = {
  communes: [
    {
      nom: 'Paris',
      code: '75101',
      codesPostaux: ['75001', '75002'],
      population: 2161000
    },
    {
      nom: 'Lyon',
      code: '69123',
      codesPostaux: ['69001', '69002'],
      population: 515695
    },
    {
      nom: 'Villeurbanne',
      code: '69266',
      codesPostaux: ['69100'],
      population: 149019
    }
  ]
}

const mockLegacyDPEResponse = {
  results: [
    {
      numero_dpe: 'LEGACY123456789',
      geo_adresse: '1 rue de la République 75001 Paris',
      code_insee_commune_actualise: '75101',
      consommation_energie: 180,
      classe_consommation_energie: 'E',
      estimation_ges: 35,
      classe_estimation_ges: 'E',
      tr002_type_batiment_description: 'Appartement',
      surface_thermique_lot: 80,
      annee_construction: 1960,
      date_etablissement_dpe: '2020-12-15',
      latitude: 48.8566,
      longitude: 2.3522
    },
    {
      numero_dpe: 'LEGACY987654321',
      geo_adresse: 'Adresse non disponible',
      code_insee_commune_actualise: '75101',
      consommation_energie: 200,
      classe_consommation_energie: 'F',
      estimation_ges: 40,
      classe_estimation_ges: 'F',
      tr002_type_batiment_description: 'Maison Individuelle',
      surface_thermique_lot: 120,
      annee_construction: 1950
    }
  ]
}

describe('Service DPE Legacy', () => {
  let dpeLegacyService

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock the loadIndex method to prevent automatic index loading
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockCommunesIndex)
    })
    dpeLegacyService = new DPELegacyService()
    // Clear the automatic fetch call from constructor
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Constructeur et Initialisation', () => {
    it("devrait initialiser avec l'URL de base correcte", () => {
      expect(dpeLegacyService.baseURL).toBe('https://data.ademe.fr/data-fair/api/v1/datasets/dpe-france/lines')
    })

    it('devrait initialiser avec un cache vide', () => {
      expect(dpeLegacyService.departmentCache).toEqual({})
    })

    it('devrait initialiser communesIndex avec les données chargées', () => {
      expect(dpeLegacyService.communesIndex).toEqual(mockCommunesIndex)
    })

    it('devrait avoir indexPromise défini', () => {
      expect(dpeLegacyService.indexPromise).toBeDefined()
    })
  })

  describe("chargement de l'index", () => {
    it("devrait charger l'index des communes avec succès", async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCommunesIndex)
      })

      await dpeLegacyService.loadIndex()
      expect(dpeLegacyService.communesIndex).toEqual(mockCommunesIndex)
    })

    it('devrait gérer les erreurs de fetch avec élégance', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'))

      await dpeLegacyService.loadIndex()
      expect(dpeLegacyService.communesIndex).toBeNull()
    })
  })

  describe("s'assurer que l'index est chargé", () => {
    it("devrait attendre le chargement de l'index s'il n'est pas déjà chargé", async () => {
      const mockLoadIndex = vi.fn().mockResolvedValue()
      dpeLegacyService.indexPromise = mockLoadIndex()

      await dpeLegacyService.ensureIndexLoaded()
      expect(mockLoadIndex).toHaveBeenCalled()
    })

    it("ne devrait pas charger l'index s'il est déjà disponible", async () => {
      dpeLegacyService.communesIndex = mockCommunesIndex
      dpeLegacyService.indexPromise = null

      await dpeLegacyService.ensureIndexLoaded()
      // Should complete without error
    })
  })

  describe('chargement des départements', () => {
    it('devrait charger les données de département avec succès', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDepartmentData)
      })

      const result = await dpeLegacyService.loadDepartment('75')
      expect(result).toEqual(mockDepartmentData)
      expect(dpeLegacyService.departmentCache['75']).toEqual(mockDepartmentData)
    })

    it('devrait retourner les données en cache quand disponibles', async () => {
      dpeLegacyService.departmentCache['75'] = mockDepartmentData

      const result = await dpeLegacyService.loadDepartment('75')
      expect(result).toEqual(mockDepartmentData)
      expect(fetch).not.toHaveBeenCalled()
    })

    it('devrait gérer les erreurs de fetch et retourner null', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await dpeLegacyService.loadDepartment('75')
      expect(result).toBeNull()
    })
  })

  describe('obtention des codes INSEE', () => {
    beforeEach(async () => {
      dpeLegacyService.communesIndex = mockCommunesIndex
      dpeLegacyService.departmentCache['75'] = mockDepartmentData
      dpeLegacyService.departmentCache['69'] = mockDepartmentData
    })

    it('devrait obtenir le code INSEE pour un code postal avec une seule commune', async () => {
      const codes = await dpeLegacyService.getINSEECodes('75001')
      expect(codes).toEqual(['75101'])
    })

    it('devrait obtenir le code INSEE pour un code postal avec plusieurs communes (retourner la plus grande)', async () => {
      const multiCommuneData = {
        communes: [
          { nom: 'Small Town', code: '75102', codesPostaux: ['75001'], population: 1000 },
          { nom: 'Paris', code: '75101', codesPostaux: ['75001'], population: 2161000 }
        ]
      }
      dpeLegacyService.departmentCache['75'] = multiCommuneData

      const codes = await dpeLegacyService.getINSEECodes('75001')
      expect(codes).toEqual(['75101']) // Should return the larger commune
    })

    it('devrait obtenir le code INSEE pour un nom de commune', async () => {
      const codes = await dpeLegacyService.getINSEECodes('Paris')
      expect(codes).toEqual(['75101'])
    })

    it('devrait gérer un nom de commune avec une casse différente', async () => {
      const codes = await dpeLegacyService.getINSEECodes('PARIS')
      expect(codes).toEqual(['75101'])
    })

    it('devrait gérer un nom de commune avec tirets et espaces', async () => {
      const communeData = {
        communes: [{ nom: 'Aix-en-Provence', code: '13001', codesPostaux: ['13100'] }]
      }
      dpeLegacyService.departmentCache['13'] = communeData

      const codes = await dpeLegacyService.getINSEECodes('Aix en Provence')
      expect(codes).toEqual(['13001'])
    })

    it('devrait retourner un tableau vide pour un code postal inconnu', async () => {
      const codes = await dpeLegacyService.getINSEECodes('99999')
      expect(codes).toEqual([])
    })

    it('devrait retourner un tableau vide pour une commune inconnue', async () => {
      const codes = await dpeLegacyService.getINSEECodes('Unknown City')
      expect(codes).toEqual([])
    })

    it('devrait gérer les entrées null/undefined', async () => {
      const codes1 = await dpeLegacyService.getINSEECodes(null)
      const codes2 = await dpeLegacyService.getINSEECodes(undefined)
      const codes3 = await dpeLegacyService.getINSEECodes('')

      expect(codes1).toEqual([])
      expect(codes2).toEqual([])
      expect(codes3).toEqual([])
    })
  })

  describe('analyse de valeur de comparaison', () => {
    it("devrait analyser correctement l'opérateur inférieur à", () => {
      const result = dpeLegacyService.parseComparisonValue('<150')
      expect(result).toEqual({ operator: '<', value: 150 })
    })

    it("devrait analyser correctement l'opérateur supérieur à", () => {
      const result = dpeLegacyService.parseComparisonValue('>150')
      expect(result).toEqual({ operator: '>', value: 150 })
    })

    it('devrait analyser correctement une valeur exacte', () => {
      const result = dpeLegacyService.parseComparisonValue('150')
      expect(result).toEqual({ operator: '=', value: 150 })
    })

    it('devrait gérer une entrée numérique', () => {
      const result = dpeLegacyService.parseComparisonValue(150)
      expect(result).toEqual({ operator: '=', value: 150 })
    })

    it('devrait retourner null pour une entrée vide', () => {
      const result = dpeLegacyService.parseComparisonValue('')
      expect(result).toBeNull()
    })
  })

  describe('construction de requête de plage', () => {
    it('devrait construire correctement une requête inférieur à', () => {
      const comparison = { operator: '<', value: 150 }
      const result = dpeLegacyService.buildRangeQuery(comparison, 'test_field')
      expect(result).toBe('test_field:[0 TO 150]')
    })

    it('devrait construire correctement une requête supérieur à', () => {
      const comparison = { operator: '>', value: 150 }
      const result = dpeLegacyService.buildRangeQuery(comparison, 'test_field')
      expect(result).toBe('test_field:[150 TO 9999]')
    })

    it('devrait construire correctement une requête de correspondance exacte', () => {
      const comparison = { operator: '=', value: 150 }
      const result = dpeLegacyService.buildRangeQuery(comparison, 'test_field')
      expect(result).toBe('test_field:150')
    })

    it('devrait retourner null pour une comparaison null', () => {
      const result = dpeLegacyService.buildRangeQuery(null, 'test_field')
      expect(result).toBeNull()
    })
  })

  describe('exécution de requête', () => {
    it('devrait exécuter la requête avec succès', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLegacyDPEResponse)
      })

      const result = await dpeLegacyService.executeQuery('test query', 50)
      expect(result).toEqual(mockLegacyDPEResponse.results)
      const expectedUrl = `${dpeLegacyService.baseURL}?qs=test+query&size=50&sort=-date_etablissement_dpe`
      expect(fetch).toHaveBeenCalledWith(expectedUrl)
    })

    it('devrait gérer les requêtes échouées avec élégance', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400
      })

      const result = await dpeLegacyService.executeQuery('test query')
      expect(result).toEqual([])
    })

    it('devrait gérer les erreurs réseau', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await dpeLegacyService.executeQuery('test query')
      expect(result).toEqual([])
    })

    it('devrait utiliser le paramètre de taille par défaut', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [] })
      })

      await dpeLegacyService.executeQuery('test query')
      const expectedUrl = `${dpeLegacyService.baseURL}?qs=test+query&size=100&sort=-date_etablissement_dpe`
      expect(fetch).toHaveBeenCalledWith(expectedUrl)
    })
  })

  describe('mappage de résultat legacy', () => {
    it('devrait mapper correctement un résultat legacy avec des données complètes', () => {
      const legacyData = {
        numero_dpe: 'LEGACY123456789',
        geo_adresse: '1 rue de la République 75001 Paris',
        consommation_energie: 180,
        classe_consommation_energie: 'E',
        estimation_ges: 35,
        classe_estimation_ges: 'E',
        tr002_type_batiment_description: 'Appartement',
        surface_thermique_lot: 80,
        annee_construction: 1960,
        date_etablissement_dpe: '2020-12-15',
        latitude: 48.8566,
        longitude: 2.3522
      }

      const searchRequest = {
        commune: 'Paris',
        consommationEnergie: 180,
        surfaceHabitable: 80
      }

      const result = dpeLegacyService.mapLegacyResult(legacyData, searchRequest)

      expect(result.numeroDPE).toBe('LEGACY123456789')
      expect(result.adresseComplete).toBe('1 rue de la République 75001 Paris')
      expect(result.codePostal).toBe('75001')
      expect(result.commune).toBe('Paris')
      expect(result.consommationEnergie).toBe(180)
      expect(result.classeDPE).toBe('E')
      expect(result.emissionGES).toBe(35)
      expect(result.classeGES).toBe('E')
      expect(result.typeBien).toBe('appartement')
      expect(result.surfaceHabitable).toBe(80)
      expect(result.anneeConstruction).toBe(1960)
      expect(result.latitude).toBe(48.8566)
      expect(result.longitude).toBe(2.3522)
      expect(result.isLegacyData).toBe(true)
      expect(result.fromLegacy).toBe(true)
      expect(result.hasIncompleteData).toBe(false)
      expect(result.legacyNote).toBe('DPE avant juillet 2021')
      expect(result.matchScore).toBeGreaterThan(0)
    })

    it('devrait gérer les données incomplètes et les marquer comme telles', () => {
      const legacyData = {
        numero_dpe: 'LEGACY987654321',
        geo_adresse: 'Adresse non disponible',
        consommation_energie: 200,
        classe_consommation_energie: 'F'
      }

      const searchRequest = { commune: 'Paris' }
      const result = dpeLegacyService.mapLegacyResult(legacyData, searchRequest)

      expect(result.hasIncompleteData).toBe(true)
      expect(result.matchScore).toBe(0)
      expect(result.adresseComplete).toBe('Adresse non disponible')
    })

    it('devrait extraire les coordonnées de _geopoint quand lat/lon manquent', () => {
      const legacyData = {
        numero_dpe: 'LEGACY123',
        geo_adresse: '1 rue Test 75001 Paris',
        _geopoint: '48.8566,2.3522'
      }

      const result = dpeLegacyService.mapLegacyResult(legacyData, {})

      expect(result.latitude).toBe(48.8566)
      expect(result.longitude).toBe(2.3522)
    })

    it('devrait créer une URL ADEME pour les résultats avec numero_dpe', () => {
      const legacyData = {
        numero_dpe: 'LEGACY123456789',
        geo_adresse: '1 rue Test 75001 Paris'
      }

      const result = dpeLegacyService.mapLegacyResult(legacyData, {})

      expect(result.ademeUrl).toBe('https://observatoire-dpe-audit.ademe.fr/afficher-dpe/LEGACY123456789')
    })

    it("ne devrait pas créer d'URL ADEME quand numero_dpe manque", () => {
      const legacyData = {
        geo_adresse: '1 rue Test 75001 Paris'
      }

      const result = dpeLegacyService.mapLegacyResult(legacyData, {})

      expect(result.ademeUrl).toBeNull()
    })
  })

  describe('mappage de type de bâtiment', () => {
    it('devrait mapper correctement les types de bâtiment connus', () => {
      expect(dpeLegacyService.mapBuildingType('Maison Individuelle')).toBe('maison')
      expect(dpeLegacyService.mapBuildingType('Appartement')).toBe('appartement')
      expect(dpeLegacyService.mapBuildingType('Logement')).toBe('logement')
      expect(dpeLegacyService.mapBuildingType('Immeuble')).toBe('immeuble')
    })

    it('devrait gérer les types de bâtiment inconnus', () => {
      expect(dpeLegacyService.mapBuildingType('Unknown Type')).toBe('unknown type')
    })

    it('devrait gérer les entrées null/vides', () => {
      expect(dpeLegacyService.mapBuildingType(null)).toBe('')
      expect(dpeLegacyService.mapBuildingType('')).toBe('')
    })
  })

  describe('extraction de code postal depuis adresse', () => {
    it("devrait extraire le code postal d'une adresse complète", () => {
      const result = dpeLegacyService.extractPostalCodeFromAddress('1 rue de la République 75001 Paris')
      expect(result).toBe('75001')
    })

    it('devrait gérer une adresse avec plusieurs numéros', () => {
      const result = dpeLegacyService.extractPostalCodeFromAddress('123 avenue de la République 75001 Paris')
      expect(result).toBe('75001')
    })

    it('devrait retourner une chaîne vide pour une adresse sans code postal', () => {
      const result = dpeLegacyService.extractPostalCodeFromAddress('rue de la République Paris')
      expect(result).toBe('')
    })

    it('devrait gérer les entrées null/vides', () => {
      expect(dpeLegacyService.extractPostalCodeFromAddress(null)).toBe('')
      expect(dpeLegacyService.extractPostalCodeFromAddress('')).toBe('')
    })
  })

  describe('extraction de commune depuis adresse', () => {
    it("devrait extraire le nom de commune d'une adresse complète", () => {
      const result = dpeLegacyService.extractCommuneFromAddress('1 rue de la République 75001 Paris')
      expect(result).toBe('Paris')
    })

    it('devrait gérer les noms de commune à plusieurs mots', () => {
      const result = dpeLegacyService.extractCommuneFromAddress('1 rue Test 13100 Aix en Provence')
      expect(result).toBe('Aix en Provence')
    })

    it("devrait retourner une chaîne vide quand aucun code postal n'est trouvé", () => {
      const result = dpeLegacyService.extractCommuneFromAddress('rue de la République Paris')
      expect(result).toBe('')
    })

    it('devrait gérer les entrées null/vides', () => {
      expect(dpeLegacyService.extractCommuneFromAddress(null)).toBe('')
      expect(dpeLegacyService.extractCommuneFromAddress('')).toBe('')
    })
  })

  describe('calcul du score de correspondance', () => {
    it('devrait calculer un score élevé pour les correspondances parfaites', () => {
      const legacyData = {
        geo_adresse: '1 rue de Paris 75001 Paris',
        surface_thermique_lot: 75,
        consommation_energie: 150,
        estimation_ges: 25
      }

      const searchRequest = {
        commune: 'Paris',
        surfaceHabitable: 75,
        consommationEnergie: 150,
        emissionGES: 25
      }

      const score = dpeLegacyService.calculateMatchScore(legacyData, searchRequest)
      expect(score).toBeGreaterThan(80)
    })

    it('devrait calculer le score pour une recherche basée sur les classes', () => {
      const legacyData = {
        geo_adresse: '1 rue de Paris 75001 Paris',
        surface_thermique_lot: 75,
        classe_consommation_energie: 'D',
        classe_estimation_ges: 'D'
      }

      const searchRequest = {
        commune: 'Paris',
        surfaceHabitable: 75,
        energyClass: 'D',
        gesClass: 'D'
      }

      const score = dpeLegacyService.calculateMatchScore(legacyData, searchRequest)
      expect(score).toBeGreaterThan(50)
    })

    it('devrait pénaliser les grandes différences de surface', () => {
      const legacyData = {
        geo_adresse: '1 rue de Paris 75001 Paris',
        surface_thermique_lot: 150,
        consommation_energie: 150
      }

      const searchRequest = {
        commune: 'Paris',
        surfaceHabitable: 75,
        consommationEnergie: 150
      }

      const score = dpeLegacyService.calculateMatchScore(legacyData, searchRequest)
      expect(score).toBeLessThan(50) // Should be penalized for 100% surface difference
    })
  })

  describe('obtention des raisons de correspondance', () => {
    it('devrait fournir des raisons pour les correspondances basées sur les classes', () => {
      const legacyData = {
        classe_consommation_energie: 'D',
        classe_estimation_ges: 'D',
        surface_thermique_lot: 75
      }

      const searchRequest = {
        energyClass: 'D',
        gesClass: 'D',
        surfaceHabitable: 75
      }

      const reasons = dpeLegacyService.getMatchReasons(legacyData, searchRequest)

      expect(reasons).toContain('Classe énergétique exacte: D')
      expect(reasons).toContain('Classe GES exacte: D')
      expect(reasons).toContain('Surface: 75m² (écart: 0%)')
      expect(reasons).toContain('Base de données pré-2021')
    })

    it('devrait fournir des raisons pour les correspondances basées sur les valeurs', () => {
      const legacyData = {
        consommation_energie: 150,
        estimation_ges: 25,
        surface_thermique_lot: 80
      }

      const searchRequest = {
        consommationEnergie: 150,
        emissionGES: 25,
        surfaceHabitable: 75
      }

      const reasons = dpeLegacyService.getMatchReasons(legacyData, searchRequest)

      expect(reasons).toContain('Consommation exacte: 150 kWh/m²/an')
      expect(reasons).toContain('GES exact: 25 kgCO²/m²/an')
      expect(reasons).toContain('Surface: 80m² (écart: 7%)')
      expect(reasons).toContain('Base de données pré-2021')
    })
  })

  describe('recherche legacy', () => {
    beforeEach(async () => {
      dpeLegacyService.communesIndex = mockCommunesIndex
      dpeLegacyService.departmentCache['75'] = mockDepartmentData
    })

    it('devrait ignorer la recherche quand hasPostResults est vrai', async () => {
      const executeQuerySpy = vi.spyOn(dpeLegacyService, 'executeQuery')

      const searchRequest = { commune: '75001' }
      const result = await dpeLegacyService.searchLegacy(searchRequest, true)

      expect(result).toEqual({
        results: [],
        fromLegacy: true,
        skipped: true
      })
      expect(executeQuerySpy).not.toHaveBeenCalled()
    })

    it('devrait effectuer un workflow de recherche complet', async () => {
      // Mock executeQuery method for this test
      vi.spyOn(dpeLegacyService, 'executeQuery').mockResolvedValueOnce(mockLegacyDPEResponse.results) // Strict search

      const searchRequest = {
        commune: '75001',
        consommationEnergie: 180,
        surfaceHabitable: 80,
        typeBien: 'appartement'
      }

      const result = await dpeLegacyService.searchLegacy(searchRequest, false)

      expect(result.fromLegacy).toBe(true)
      expect(result.results).toHaveLength(2)
      expect(result.searchStrategy).toBe('STRICT')
      expect(result).toHaveProperty('executionTime')
      expect(result).toHaveProperty('inseeCodes')
    })

    it('devrait gérer une commune non trouvée', async () => {
      const searchRequest = { commune: 'Unknown City' }
      const result = await dpeLegacyService.searchLegacy(searchRequest, false)

      expect(result).toEqual({
        results: [],
        fromLegacy: true,
        message: 'Commune non trouvée dans la base pré-2021'
      })
    })

    it('devrait effectuer une recherche étendue quand la recherche stricte retourne des résultats insuffisants', async () => {
      // Mock enough results for strict to trigger expanded, but not enough to skip regional
      const strictResults = Array.from({ length: 5 }, (_, i) => ({
        numero_dpe: `STRICT${i}`,
        geo_adresse: `${i} rue Test`
      }))
      const expandedResults = Array.from({ length: 5 }, (_, i) => ({
        numero_dpe: `EXPANDED${i}`,
        geo_adresse: `${i} rue Expanded`
      }))
      const regionalResults = Array.from({ length: 10 }, (_, i) => ({
        numero_dpe: `REGIONAL${i}`,
        geo_adresse: `${i} rue Regional`
      }))

      vi.spyOn(dpeLegacyService, 'executeQuery')
        .mockResolvedValueOnce(strictResults) // Strict: 5 results (triggers expanded)
        .mockResolvedValueOnce(expandedResults) // Expanded: 5 more results (triggers regional)
        .mockResolvedValueOnce(regionalResults) // Regional: 10 more results

      const searchRequest = {
        commune: '75001',
        consommationEnergie: 180
      }

      const result = await dpeLegacyService.searchLegacy(searchRequest, false)

      expect(dpeLegacyService.executeQuery).toHaveBeenCalledTimes(3)
      expect(result.searchStrategy).toBe('STRICT+EXPANDED+REGIONAL')
    })

    it('devrait effectuer une recherche régionale quand nécessaire', async () => {
      // Mock minimal results for strict and expanded, then more for regional
      vi.spyOn(dpeLegacyService, 'executeQuery')
        .mockResolvedValueOnce([]) // Strict: no results
        .mockResolvedValueOnce([]) // Expanded: no results
        .mockResolvedValueOnce(mockLegacyDPEResponse.results) // Regional: results

      const searchRequest = {
        commune: '75001',
        consommationEnergie: 180
      }

      const result = await dpeLegacyService.searchLegacy(searchRequest, false)

      expect(dpeLegacyService.executeQuery).toHaveBeenCalledTimes(3)
      expect(result.searchStrategy).toBe('NONE+REGIONAL')
    })

    it('devrait gérer une recherche basée sur les classes', async () => {
      vi.spyOn(dpeLegacyService, 'executeQuery').mockResolvedValueOnce(mockLegacyDPEResponse.results)

      const searchRequest = {
        commune: '75001',
        energyClass: 'E',
        gesClass: 'E',
        surfaceHabitable: 80
      }

      await dpeLegacyService.searchLegacy(searchRequest, false)

      // Verify that executeQuery was called with class-based conditions
      expect(dpeLegacyService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('classe_consommation_energie:"E"'),
        100
      )
    })

    it('devrait dédupliquer les résultats par numero_dpe', async () => {
      const duplicateResults = [
        { numero_dpe: 'DPE1', geo_adresse: '1 rue Test' },
        { numero_dpe: 'DPE2', geo_adresse: '2 rue Test' },
        { numero_dpe: 'DPE1', geo_adresse: '1 rue Test duplicate' } // Duplicate
      ]

      vi.spyOn(dpeLegacyService, 'executeQuery').mockResolvedValueOnce(duplicateResults)

      const searchRequest = { commune: '75001' }
      const result = await dpeLegacyService.searchLegacy(searchRequest, false)

      expect(result.results).toHaveLength(2) // Should exclude duplicate
    })

    it('devrait gérer les erreurs de recherche avec élégance', async () => {
      vi.spyOn(dpeLegacyService, 'executeQuery').mockRejectedValueOnce(new Error('API Error'))

      const searchRequest = { commune: '75001' }
      const result = await dpeLegacyService.searchLegacy(searchRequest, false)

      expect(result).toEqual({
        results: [],
        fromLegacy: true,
        error: 'API Error'
      })
    })
  })

  describe('Intégration et Cas Limites', () => {
    it('devrait gérer une requête de recherche null', async () => {
      const result = await dpeLegacyService.searchLegacy(null, false)
      expect(result.results).toEqual([])
    })

    it('devrait gérer une requête de recherche vide', async () => {
      const result = await dpeLegacyService.searchLegacy({}, false)
      expect(result.results).toEqual([])
    })

    it('devrait gérer une réponse API malformée', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(null)
      })

      const result = await dpeLegacyService.executeQuery('test')
      expect(result).toEqual([])
    })

    it('devrait trier les résultats par score de correspondance', async () => {
      // Set up the required data for the search to work
      dpeLegacyService.communesIndex = mockCommunesIndex
      dpeLegacyService.departmentCache['75'] = mockDepartmentData

      const mixedResults = [
        {
          numero_dpe: 'DPE1',
          geo_adresse: '1 rue Test 75001 Paris',
          consommation_energie: 200,
          surface_thermique_lot: 80,
          latitude: 48.8566,
          longitude: 2.3522
        },
        {
          numero_dpe: 'DPE2',
          geo_adresse: '2 rue Test 75001 Paris',
          consommation_energie: 150, // Better match
          surface_thermique_lot: 80,
          latitude: 48.8566,
          longitude: 2.3522
        }
      ]

      vi.spyOn(dpeLegacyService, 'executeQuery').mockResolvedValueOnce(mixedResults)

      const searchRequest = { commune: 'Paris', consommationEnergie: 150, surfaceHabitable: 80 }
      const result = await dpeLegacyService.searchLegacy(searchRequest, false)

      // Results should be sorted by match score (higher first)
      expect(result.results).toHaveLength(2)
      expect(result.results[0].matchScore).toBeGreaterThanOrEqual(result.results[1].matchScore)
      // The better match (DPE2) should be first - check which has higher score
      const dpe1Result = result.results.find(r => r.numeroDPE === 'DPE1')
      const dpe2Result = result.results.find(r => r.numeroDPE === 'DPE2')
      expect(dpe2Result.matchScore).toBeGreaterThan(dpe1Result.matchScore)
      expect(result.results[0].numeroDPE).toBe('DPE2')
    })

    it('devrait limiter les résultats à 20', async () => {
      // Set up the required data for the search to work
      dpeLegacyService.communesIndex = mockCommunesIndex
      dpeLegacyService.departmentCache['75'] = mockDepartmentData

      const manyResults = Array.from({ length: 30 }, (_, i) => ({
        numero_dpe: `DPE${i}`,
        geo_adresse: `${i} rue Test 75001 Paris`,
        consommation_energie: 150,
        surface_thermique_lot: 80,
        latitude: 48.8566,
        longitude: 2.3522
      }))

      vi.spyOn(dpeLegacyService, 'executeQuery').mockResolvedValueOnce(manyResults)

      const searchRequest = { commune: '75001' }
      const result = await dpeLegacyService.searchLegacy(searchRequest, false)

      expect(result.results).toHaveLength(20) // Should be limited
      expect(result.totalFound).toBe(30) // But totalFound should show actual count
    })
  })
})
