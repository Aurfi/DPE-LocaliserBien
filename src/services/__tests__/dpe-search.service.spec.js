import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { calculateDistance } from '../../utils/geoUtils.js'
import DPESearchService from '../dpe-search.service.js'

// Mock fetch globally - but allow actual fetches for commune data
global.fetch = vi.fn().mockImplementation(url => {
  // Allow real fetches for commune data files
  if (url.includes('/data/communes-index.json') || url.includes('/data/departments/')) {
    return fetch(url)
  }
  // Mock other fetches
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ features: [], results: [] })
  })
})

// Mock data for tests
const mockCommunesIndex = {
  postalCodeToDepartment: {
    75001: '75',
    13001: '13'
  },
  departments: {
    75: { name: 'Paris' },
    13: { name: 'Bouches-du-Rhône' }
  }
}

const mockDepartmentData = {
  communes: [
    {
      nom: 'Paris',
      code: '75101',
      codesPostaux: ['75001', '75002'],
      centre: { coordinates: [2.3522, 48.8566] },
      mairie: { coordinates: [2.3522, 48.8566] },
      population: 2161000,
      radius: 5
    }
  ],
  postalCodes: {
    75001: {
      center: [2.3522, 48.8566],
      communeCount: 1,
      communes: ['Paris'],
      coverageRadius: 2
    }
  }
}

const mockAdemeResponse = {
  results: [
    {
      numero_dpe: 'DPE123456789',
      adresse_ban: '1 rue de la Paix',
      code_postal_ban: '75001',
      nom_commune_ban: 'Paris',
      _geopoint: '48.8566,2.3522',
      conso_5_usages_par_m2_ep: 150,
      etiquette_dpe: 'D',
      emission_ges_5_usages_par_m2: 25,
      etiquette_ges: 'D',
      type_batiment: 'appartement',
      surface_habitable_logement: 75,
      annee_construction: 1970,
      date_etablissement_dpe: '2023-01-15'
    }
  ]
}

const mockGeocodeResponse = {
  features: [
    {
      geometry: { coordinates: [2.3522, 48.8566] },
      properties: {
        label: '1 rue de la Paix, 75001 Paris',
        postcode: '75001',
        city: 'Paris',
        district: null
      }
    }
  ]
}

describe('Service de Recherche DPE', () => {
  let dpeSearchService

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock the loadIndex method to prevent automatic index loading
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockCommunesIndex)
    })
    dpeSearchService = new DPESearchService()
    // Clear the automatic fetch call from constructor
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Constructeur et Initialisation', () => {
    it("devrait s'initialiser avec un cache vide", () => {
      expect(dpeSearchService.departmentCache).toEqual({})
    })

    it('devrait avoir le service legacy initialisé', () => {
      expect(dpeSearchService.legacyService).toBeDefined()
    })
  })

  describe('chargement département', () => {
    it('devrait charger les données du département avec succès', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDepartmentData)
      })

      const result = await dpeSearchService.loadDepartment('75')
      expect(result).toEqual(mockDepartmentData)
      expect(dpeSearchService.departmentCache['75']).toEqual(mockDepartmentData)
    })

    it('devrait retourner les données en cache quand disponibles', async () => {
      dpeSearchService.departmentCache['75'] = mockDepartmentData

      const result = await dpeSearchService.loadDepartment('75')
      expect(result).toEqual(mockDepartmentData)
      expect(fetch).not.toHaveBeenCalled()
    })

    it('devrait gérer les erreurs de récupération et retourner null', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await dpeSearchService.loadDepartment('75')
      expect(result).toBeNull()
    })
  })

  describe('analyse valeur de comparaison', () => {
    it("devrait analyser l'opérateur inférieur à correctement", () => {
      const result = dpeSearchService.parseComparisonValue('<150')
      expect(result).toEqual({ operator: '<', value: 150 })
    })

    it("devrait analyser l'opérateur supérieur à correctement", () => {
      const result = dpeSearchService.parseComparisonValue('>150')
      expect(result).toEqual({ operator: '>', value: 150 })
    })

    it('devrait analyser la valeur exacte correctement', () => {
      const result = dpeSearchService.parseComparisonValue('150')
      expect(result).toEqual({ operator: '=', value: 150 })
    })

    it('devrait gérer les entrées numériques', () => {
      const result = dpeSearchService.parseComparisonValue(150)
      expect(result).toEqual({ operator: '=', value: 150 })
    })

    it('devrait retourner null pour une entrée vide', () => {
      const result = dpeSearchService.parseComparisonValue('')
      expect(result).toBeNull()
    })
  })

  describe('construction requête de plage', () => {
    it('devrait construire la requête inférieur à correctement', () => {
      const comparison = { operator: '<', value: 150 }
      const result = dpeSearchService.buildRangeQuery(comparison, 'test_field')
      expect(result).toBe('test_field:[0 TO 150]')
    })

    it('devrait construire la requête supérieur à correctement', () => {
      const comparison = { operator: '>', value: 150 }
      const result = dpeSearchService.buildRangeQuery(comparison, 'test_field')
      expect(result).toBe('test_field:[150 TO 9999]')
    })

    it('devrait construire la requête de correspondance exacte correctement', () => {
      const comparison = { operator: '=', value: 150 }
      const result = dpeSearchService.buildRangeQuery(comparison, 'test_field')
      expect(result).toBe('test_field:150')
    })

    it('devrait retourner null pour une comparaison nulle', () => {
      const result = dpeSearchService.buildRangeQuery(null, 'test_field')
      expect(result).toBeNull()
    })
  })

  describe('nettoyage pour requête', () => {
    it('devrait échapper les caractères spéciaux Lucene', () => {
      const input = 'test+string-with&special|characters!'
      const result = dpeSearchService.sanitizeForQuery(input)
      expect(result).toBe('test\\+string\\-with\\&special\\|characters\\!')
    })

    it('devrait gérer les chaînes vides', () => {
      const result = dpeSearchService.sanitizeForQuery('')
      expect(result).toBe('')
    })

    it('devrait gérer les entrées nulles', () => {
      const result = dpeSearchService.sanitizeForQuery(null)
      expect(result).toBe('')
    })
  })

  describe('géocodage adresse', () => {
    it("devrait géocoder l'adresse avec succès", async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGeocodeResponse)
      })

      const result = await dpeSearchService.geocodeAddress('1 rue de la Paix, Paris')
      expect(result).toEqual({
        lat: 48.8566,
        lon: 2.3522,
        formattedAddress: '1 rue de la Paix, 75001 Paris',
        postalCode: '75001',
        city: 'Paris',
        centre: { lat: 48.8566, lon: 2.3522 },
        mairie: { lat: 48.8566, lon: 2.3522 },
        radius: 0,
        coverageRadius: 0,
        isMultiCommune: false
      })
    })

    it('devrait retourner null quand aucun résultat trouvé', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ features: [] })
      })

      const result = await dpeSearchService.geocodeAddress('invalid address')
      expect(result).toBeNull()
    })

    it('devrait gérer les erreurs de récupération avec élégance', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await dpeSearchService.geocodeAddress('test address')
      expect(result).toBeNull()
    })
  })

  describe('calcul de distance', () => {
    it('devrait calculer la distance entre deux points correctement', () => {
      const distance = calculateDistance(48.8566, 2.3522, 48.8606, 2.3376)
      expect(distance).toBeCloseTo(1.18, 1) // Approximately 1.18 km
    })

    it('devrait retourner 0 pour des coordonnées invalides', () => {
      const distance = calculateDistance(NaN, 2.3522, 48.8606, 2.3376)
      expect(distance).toBe(0)
    })

    it('devrait calculer une distance de 0 pour les mêmes coordonnées', () => {
      const distance = calculateDistance(48.8566, 2.3522, 48.8566, 2.3522)
      expect(distance).toBe(0)
    })
  })

  describe('extraction code postal', () => {
    it("devrait retourner le code postal si l'entrée est déjà un code postal", async () => {
      const result = await dpeSearchService.extractPostalCode('75001')
      expect(result).toBe('75001')
    })

    it('devrait chercher et retourner le code postal pour Aix-en-Provence avec des vraies données', async () => {
      // Load real commune data for testing
      const communesIndexPath = path.join(process.cwd(), 'public/data/communes-index.json')
      const dept13Path = path.join(process.cwd(), 'public/data/departments/communes-dept-13.json')

      const communesIndex = JSON.parse(fs.readFileSync(communesIndexPath, 'utf8'))
      const dept13Data = JSON.parse(fs.readFileSync(dept13Path, 'utf8'))

      // Mock loadDepartment to return real data
      const mockLoadDepartment = vi.fn().mockImplementation(deptCode => {
        if (deptCode === '13') {
          return Promise.resolve(dept13Data)
        }
        return Promise.resolve(null)
      })

      // Test the shared function directly with real data
      const result = await getPostalCodeForCommune('Aix-en-Provence', communesIndex, mockLoadDepartment)

      expect(result).not.toBeNull()
      expect(result).toMatch(/^13/) // Should start with 13 (Bouches-du-Rhône)
      expect(result).toHaveLength(5) // Should be a valid postal code
    })

    it('devrait chercher et retourner le code postal pour Marseille avec des vraies données', async () => {
      // Load real commune data for testing
      const communesIndexPath = path.join(process.cwd(), 'public/data/communes-index.json')
      const dept13Path = path.join(process.cwd(), 'public/data/departments/communes-dept-13.json')

      const communesIndex = JSON.parse(fs.readFileSync(communesIndexPath, 'utf8'))
      const dept13Data = JSON.parse(fs.readFileSync(dept13Path, 'utf8'))

      // Mock loadDepartment to return real data
      const mockLoadDepartment = vi.fn().mockImplementation(deptCode => {
        if (deptCode === '13') {
          return Promise.resolve(dept13Data)
        }
        return Promise.resolve(null)
      })

      // Test the shared function directly with real data
      const result = await getPostalCodeForCommune('Marseille', communesIndex, mockLoadDepartment)

      expect(result).not.toBeNull()
      expect(result).toMatch(/^13/) // Should start with 13 (Bouches-du-Rhône)
      expect(result).toHaveLength(5) // Should be a valid postal code
    })

    it("devrait retourner l'entrée originale pour une ville non trouvée", async () => {
      const result = await dpeSearchService.extractPostalCode('Ville-Inexistante-Completement')
      expect(result).toBe('Ville-Inexistante-Completement')
    })
  })

  describe('obtention code postal pour commune', () => {
    it("devrait retourner le code postal si l'entrée est déjà un code postal", async () => {
      const result = await dpeSearchService.getPostalCodeForCommune('13100')
      expect(result).toBe('13100')
    })

    it("devrait retourner null quand communesIndex n'est pas chargé", async () => {
      const service = new DPESearchService()
      service.communesIndex = null
      const result = await service.getPostalCodeForCommune('Aix-en-Provence')
      expect(result).toBe(null)
    })

    it('devrait retourner null pour une entrée vide', async () => {
      const result = await dpeSearchService.getPostalCodeForCommune('')
      expect(result).toBe(null)
    })

    it('devrait retourner null pour une commune non trouvée', async () => {
      const result = await dpeSearchService.getPostalCodeForCommune('Ville-Inexistante')
      expect(result).toBe(null)
    })
  })

  describe('mappage résultat ADEME', () => {
    it('devrait mapper le résultat ADEME correctement', async () => {
      const ademeData = {
        numero_dpe: 'DPE123456789',
        adresse_ban: '1 rue de la Paix',
        code_postal_ban: '75001',
        nom_commune_ban: 'Paris',
        _geopoint: '48.8566,2.3522',
        conso_5_usages_par_m2_ep: 150,
        etiquette_dpe: 'D',
        emission_ges_5_usages_par_m2: 25,
        type_batiment: 'appartement',
        surface_habitable_logement: 75,
        date_etablissement_dpe: '2023-01-15'
      }

      const searchRequest = {
        commune: '75001',
        consommationEnergie: 150,
        surfaceHabitable: 75
      }

      const result = await dpeSearchService.mapAdemeResult(ademeData, searchRequest)

      expect(result.numeroDPE).toBe('DPE123456789')
      expect(result.adresseComplete).toBe('1 rue de la Paix')
      expect(result.codePostal).toBe('75001')
      expect(result.commune).toBe('Paris')
      expect(result.latitude).toBe(48.8566)
      expect(result.longitude).toBe(2.3522)
      expect(result.consommationEnergie).toBe(150)
      expect(result.classeDPE).toBe('D')
      expect(result.emissionGES).toBe(25)
      expect(result.typeBien).toBe('appartement')
      expect(result.surfaceHabitable).toBe(75)
      expect(result.matchScore).toBeGreaterThan(0)
    })

    it("devrait gérer l'adresse manquante et utiliser adresse_brut comme solution de repli", async () => {
      const ademeData = {
        numero_dpe: 'DPE123456789',
        adresse_brut: '1 bis rue de la Paix',
        code_postal_ban: '75001',
        nom_commune_ban: 'Paris'
      }

      const searchRequest = { commune: '75001' }
      const result = await dpeSearchService.mapAdemeResult(ademeData, searchRequest)

      expect(result.adresseComplete).toBe('1 bis rue de la Paix')
    })

    it('devrait combiner le numéro de rue depuis adresse_brut avec adresse_ban', async () => {
      const ademeData = {
        numero_dpe: 'DPE123456789',
        adresse_ban: 'rue de la Paix',
        adresse_brut: '1 bis avenue des Champs',
        code_postal_ban: '75001',
        nom_commune_ban: 'Paris'
      }

      const searchRequest = { commune: '75001' }
      const result = await dpeSearchService.mapAdemeResult(ademeData, searchRequest)

      expect(result.adresseComplete).toBe('1 bis rue de la Paix')
    })
  })

  describe('calcul score de correspondance', () => {
    it('devrait calculer un score élevé pour une correspondance de localisation parfaite', async () => {
      const ademeData = {
        code_postal_ban: '75001',
        nom_commune_ban: 'Paris',
        surface_habitable_logement: 75,
        conso_5_usages_par_m2_ep: 150
      }

      const searchRequest = {
        commune: '75001',
        surfaceHabitable: 75,
        consommationEnergie: 150
      }

      const score = await dpeSearchService.calculateMatchScore(ademeData, searchRequest)
      expect(score).toBeGreaterThan(90) // High score for perfect match
    })

    it('devrait calculer un score plus bas pour une surface non correspondante', async () => {
      const ademeData = {
        code_postal_ban: '75001',
        surface_habitable_logement: 100,
        conso_5_usages_par_m2_ep: 150
      }

      const searchRequest = {
        commune: '75001',
        surfaceHabitable: 75,
        consommationEnergie: 150
      }

      const score = await dpeSearchService.calculateMatchScore(ademeData, searchRequest)
      expect(score).toBeLessThan(90) // Lower score for surface mismatch
    })

    it('devrait gérer le calcul de score pour les recherches par classe', async () => {
      const ademeData = {
        code_postal_ban: '75001',
        etiquette_dpe: 'D',
        etiquette_ges: 'D',
        surface_habitable_logement: 75
      }

      const searchRequest = {
        commune: '75001',
        energyClass: 'D',
        gesClass: 'D',
        surfaceHabitable: 75
      }

      const score = await dpeSearchService.calculateMatchScore(ademeData, searchRequest)
      expect(score).toBeGreaterThan(50) // Decent score for class match
    })
  })

  describe('exécution recherche réelle', () => {
    beforeEach(() => {
      dpeSearchService.communesIndex = mockCommunesIndex
      dpeSearchService.departmentCache['75'] = mockDepartmentData
    })

    it('devrait effectuer une recherche avec code postal avec succès', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAdemeResponse)
      })

      const searchRequest = {
        commune: '75001',
        consommationEnergie: 150,
        surfaceHabitable: 75
      }

      const results = await dpeSearchService.performRealSearch(searchRequest)
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThan(0)
    })

    it('devrait gérer les résultats vides et essayer une recherche élargie', async () => {
      // First call returns empty results
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [] })
      })
      // Second call (expanded search) returns results
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAdemeResponse)
      })
      // Third call for enrichment (reverse geocoding)
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGeocodeResponse)
      })

      const searchRequest = {
        commune: '75001',
        consommationEnergie: 150,
        surfaceHabitable: 75
      }

      const _results = await dpeSearchService.performRealSearch(searchRequest)
      expect(fetch).toHaveBeenCalledTimes(3) // Three API calls: 2 for search, 1 for enrichment
    })

    it("devrait gérer les erreurs d'API avec élégance", async () => {
      fetch.mockRejectedValueOnce(new Error('API Error'))

      const searchRequest = {
        commune: '75001',
        consommationEnergie: 150
      }

      const results = await dpeSearchService.performRealSearch(searchRequest)
      expect(results).toEqual([])
    })
  })

  describe('déduplication résultats', () => {
    it('devrait supprimer les résultats dupliqués basés sur numeroDPE', () => {
      const results = [
        { numeroDPE: 'DPE1', id: '1' },
        { numeroDPE: 'DPE2', id: '2' },
        { numeroDPE: 'DPE1', id: '3' }, // Duplicate
        { numeroDPE: 'DPE3', id: '4' }
      ]

      const deduplicated = dpeSearchService.deduplicateResults(results)
      expect(deduplicated).toHaveLength(3)
      expect(deduplicated.map(r => r.numeroDPE)).toEqual(['DPE1', 'DPE2', 'DPE3'])
    })

    it('devrait gérer les résultats sans numeroDPE', () => {
      const results = [
        { id: '1' },
        { id: '2' },
        { id: '1' } // Duplicate by id
      ]

      const deduplicated = dpeSearchService.deduplicateResults(results)
      expect(deduplicated).toHaveLength(2)
    })
  })

  describe('intégration méthode de recherche', () => {
    beforeEach(() => {
      dpeSearchService.communesIndex = mockCommunesIndex
      dpeSearchService.departmentCache['75'] = mockDepartmentData

      // Mock performRealSearch method
      vi.spyOn(dpeSearchService, 'performRealSearch').mockResolvedValue([
        {
          numeroDPE: 'DPE123',
          matchScore: 95,
          commune: 'Paris',
          codePostal: '75001'
        }
      ])

      // Mock legacy service search
      vi.spyOn(dpeSearchService.legacyService, 'searchLegacy').mockResolvedValue({
        results: [],
        fromLegacy: true
      })
    })

    it('devrait exécuter le flux de travail de recherche complet', async () => {
      const searchRequest = {
        commune: '75001',
        consommationEnergie: 150,
        surfaceHabitable: 75,
        typeBien: 'appartement'
      }

      const result = await dpeSearchService.search(searchRequest)

      expect(result).toHaveProperty('results')
      expect(result).toHaveProperty('totalFound')
      expect(result).toHaveProperty('searchStrategy')
      expect(result).toHaveProperty('executionTime')
      expect(result.localAverages).toBeNull()
      expect(Array.isArray(result.results)).toBe(true)
    })

    it('devrait gérer les erreurs de recherche et lever une erreur appropriée', async () => {
      vi.spyOn(dpeSearchService, 'performSearch').mockRejectedValue(new Error('Search failed'))

      const searchRequest = { commune: '75001' }

      await expect(dpeSearchService.search(searchRequest)).rejects.toThrow(
        'Impossible de contacter le service de recherche DPE'
      )
    })
  })

  describe('obtention coordonnées commune', () => {
    beforeEach(() => {
      dpeSearchService.communesIndex = mockCommunesIndex
      dpeSearchService.departmentCache['75'] = mockDepartmentData
    })

    it('devrait obtenir les coordonnées pour un code postal', async () => {
      const coords = await dpeSearchService.getCommuneCoordinates('75001')

      expect(coords).toHaveProperty('lat')
      expect(coords).toHaveProperty('lon')
      expect(coords).toHaveProperty('centre')
      expect(coords).toHaveProperty('mairie')
    })

    it('devrait retourner null pour un code postal inconnu', async () => {
      const coords = await dpeSearchService.getCommuneCoordinates('99999')
      expect(coords).toBeNull()
    })
  })

  describe("Gestion d'erreurs et cas limites", () => {
    it('devrait gérer une requête de recherche nulle avec élégance', async () => {
      const result = await dpeSearchService.search(null)
      expect(result.results).toEqual([])
    })

    it('devrait gérer une requête de recherche vide', async () => {
      const result = await dpeSearchService.search({})
      expect(result).toHaveProperty('results')
      expect(Array.isArray(result.results)).toBe(true)
    })

    it('devrait gérer une réponse ADEME malformée', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(null)
      })

      const searchRequest = { commune: '75001' }
      const results = await dpeSearchService.performRealSearch(searchRequest)
      expect(results).toEqual([])
    })
  })
})
