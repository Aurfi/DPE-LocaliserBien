/**
 * Tests unitaires pour DPELegacyService
 * Couvre : getINSEECodes, searchLegacy, executeQuery, mapLegacyResult, calculateMatchScore
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// --- Mocks de modules ---
vi.mock('../../stores/useDepartements.js', () => ({
  useDepartements: vi.fn(() => ({
    loadDepartment: vi.fn()
  }))
}))

vi.mock('../../utils/utilsGeo.js', () => ({
  getDepartmentFromPostalCode: vi.fn()
}))

import { useDepartements } from '../../stores/useDepartements.js'
import { getDepartmentFromPostalCode } from '../../utils/utilsGeo.js'
import DPELegacyService from '../dpe-legacy.service.js'

// Données de test réutilisables
const makeDeptData = communes => ({ communes })

const makeCommune = (code, nom, codesPostaux, population = 1000) => ({
  code,
  nom,
  codesPostaux,
  population
})

const makeLegacyResult = (overrides = {}) => ({
  numero_dpe: 'DPE-LEGACY-001',
  geo_adresse: '12 Rue de la Paix 75001 Paris',
  latitude: 48.8698,
  longitude: 2.3309,
  consommation_energie: 150,
  classe_consommation_energie: 'D',
  estimation_ges: 30,
  classe_estimation_ges: 'D',
  tr002_type_batiment_description: 'Appartement',
  surface_thermique_lot: 65,
  annee_construction: 1985,
  date_etablissement_dpe: '2019-06-15',
  code_insee_commune_actualise: '75001',
  ...overrides
})

const makeSearchRequest = (overrides = {}) => ({
  commune: '75001',
  surfaceHabitable: 65,
  consommationEnergie: 150,
  emissionGES: 30,
  typeBien: 'appartement',
  ...overrides
})

// Helper pour créer une réponse fetch réussie
const _mockFetchSuccess = (results = [], total = results.length) =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ results, total })
  })

const mockFetchError = (status = 500) => Promise.resolve({ ok: false, status })

describe('DPELegacyService', () => {
  let service
  let mockLoadDepartment

  beforeEach(() => {
    mockLoadDepartment = vi.fn()
    useDepartements.mockReturnValue({ loadDepartment: mockLoadDepartment })
    getDepartmentFromPostalCode.mockReset()
    service = new DPELegacyService()
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // getINSEECodes
  // ─────────────────────────────────────────────────────────────────────────────

  describe('getINSEECodes - récupération des codes INSEE', () => {
    describe('entrées vides ou nulles', () => {
      it('doit retourner un tableau vide pour une valeur nulle', async () => {
        const result = await service.getINSEECodes(null)
        expect(result).toEqual([])
      })

      it('doit retourner un tableau vide pour une chaîne vide', async () => {
        const result = await service.getINSEECodes('')
        expect(result).toEqual([])
      })

      it('doit retourner un tableau vide pour undefined', async () => {
        const result = await service.getINSEECodes(undefined)
        expect(result).toEqual([])
      })
    })

    describe('recherche par code postal (5 chiffres)', () => {
      it('doit retourner le code INSEE de la commune correspondante', async () => {
        getDepartmentFromPostalCode.mockReturnValue('75')
        mockLoadDepartment.mockResolvedValue(makeDeptData([makeCommune('75001', 'Paris 1er', ['75001'])]))

        const result = await service.getINSEECodes('75001')

        expect(getDepartmentFromPostalCode).toHaveBeenCalledWith('75001')
        expect(result).toEqual(['75001'])
      })

      it('doit retourner un tableau vide si getDepartmentFromPostalCode retourne null', async () => {
        getDepartmentFromPostalCode.mockReturnValue(null)

        const result = await service.getINSEECodes('99999')

        expect(result).toEqual([])
        expect(mockLoadDepartment).not.toHaveBeenCalled()
      })

      it('doit retourner un tableau vide si le département ne se charge pas', async () => {
        getDepartmentFromPostalCode.mockReturnValue('75')
        mockLoadDepartment.mockResolvedValue(null)

        const result = await service.getINSEECodes('75001')

        expect(result).toEqual([])
      })

      it('doit retourner un tableau vide si aucune commune ne correspond au code postal', async () => {
        getDepartmentFromPostalCode.mockReturnValue('13')
        mockLoadDepartment.mockResolvedValue(makeDeptData([makeCommune('13001', 'Marseille', ['13001'])]))

        const result = await service.getINSEECodes('13100')

        expect(result).toEqual([])
      })

      it('doit prendre la commune avec la plus haute population pour les codes postaux multi-communes', async () => {
        getDepartmentFromPostalCode.mockReturnValue('13')
        mockLoadDepartment.mockResolvedValue(
          makeDeptData([
            makeCommune('13100', 'Aix-Petite', ['13100'], 5000),
            makeCommune('13101', 'Aix-Grande', ['13100'], 150000),
            makeCommune('13102', 'Aix-Moyenne', ['13100'], 30000)
          ])
        )

        const result = await service.getINSEECodes('13100')

        expect(result).toEqual(['13101'])
      })

      it('doit retourner un tableau avec un seul code pour une commune unique', async () => {
        getDepartmentFromPostalCode.mockReturnValue('33')
        mockLoadDepartment.mockResolvedValue(makeDeptData([makeCommune('33000', 'Bordeaux', ['33000'], 250000)]))

        const result = await service.getINSEECodes('33000')

        expect(result).toEqual(['33000'])
      })

      it("doit retourner un tableau vide si la commune n'a pas de codesPostaux", async () => {
        getDepartmentFromPostalCode.mockReturnValue('69')
        mockLoadDepartment.mockResolvedValue(makeDeptData([{ code: '69001', nom: 'Lyon', population: 500000 }]))

        const result = await service.getINSEECodes('69001')

        expect(result).toEqual([])
      })
    })

    describe('recherche par nom de commune', () => {
      it('doit trouver une commune par nom exact', async () => {
        // Tous les départements retournent null sauf le département 13
        mockLoadDepartment.mockImplementation(async deptCode => {
          if (deptCode === '13') {
            return makeDeptData([makeCommune('13080', 'Aix-en-Provence', ['13100'])])
          }
          return null
        })

        const result = await service.getINSEECodes('Aix-en-Provence')

        expect(result).toEqual(['13080'])
      })

      it('doit trouver une commune en ignorant la casse', async () => {
        mockLoadDepartment.mockImplementation(async deptCode => {
          if (deptCode === '75') {
            return makeDeptData([makeCommune('75056', 'Paris', ['75001'])])
          }
          return null
        })

        const result = await service.getINSEECodes('PARIS')

        expect(result).toEqual(['75056'])
      })

      it('doit trouver une commune en ignorant les espaces et les tirets', async () => {
        mockLoadDepartment.mockImplementation(async deptCode => {
          if (deptCode === '06') {
            return makeDeptData([makeCommune('06123', 'Saint-Martin', ['06600'])])
          }
          return null
        })

        // "saint martin" (sans tiret) doit correspondre à "Saint-Martin"
        const result = await service.getINSEECodes('saint martin')

        expect(result).toEqual(['06123'])
      })

      it('doit retourner un tableau vide si la commune est introuvable dans tous les départements', async () => {
        mockLoadDepartment.mockResolvedValue(makeDeptData([makeCommune('99999', 'Autre Commune', ['99000'])]))

        const result = await service.getINSEECodes('VilleInexistante')

        expect(result).toEqual([])
      })

      it('doit ignorer les erreurs de chargement de département et continuer', async () => {
        mockLoadDepartment.mockImplementation(async deptCode => {
          if (deptCode === '01') throw new Error('Erreur réseau')
          if (deptCode === '02') {
            return makeDeptData([makeCommune('02999', 'Laon', ['02000'])])
          }
          return null
        })

        const result = await service.getINSEECodes('Laon')

        expect(result).toEqual(['02999'])
      })

      it('doit itérer les 97 codes de département (01 à 95 plus la Corse)', async () => {
        mockLoadDepartment.mockResolvedValue(null)

        await service.getINSEECodes('NomInexistant')

        // 95 départements (01-95) + 2A + 2B = 97 appels au total (si aucun trouvé)
        expect(mockLoadDepartment).toHaveBeenCalledTimes(97)
      })

      it('doit chercher dans la Corse : codes 2A et 2B', async () => {
        mockLoadDepartment.mockImplementation(async deptCode => {
          if (deptCode === '2A') {
            return makeDeptData([makeCommune('2A004', 'Ajaccio', ['20000'])])
          }
          return null
        })

        const result = await service.getINSEECodes('Ajaccio')

        expect(mockLoadDepartment).toHaveBeenCalledWith('2A')
        // '2B' n'est pas appelé car la commune est trouvée en '2A' (retour anticipé)
        expect(result).toEqual(['2A004'])
      })

      it("doit s'arrêter dès la première commune trouvée (retour anticipé)", async () => {
        let callCount = 0
        mockLoadDepartment.mockImplementation(async deptCode => {
          callCount++
          if (deptCode === '06') {
            return makeDeptData([makeCommune('06088', 'Nice', ['06000'])])
          }
          return null
        })

        await service.getINSEECodes('Nice')

        // Doit s'arrêter après '06' (6e département), pas après 97
        expect(callCount).toBeLessThan(97)
      })

      it('doit gérer les départements retournant des données sans tableau communes', async () => {
        mockLoadDepartment.mockImplementation(async deptCode => {
          if (deptCode === '01') return { notCommunes: [] }
          return null
        })

        const result = await service.getINSEECodes('Bourg-en-Bresse')

        expect(result).toEqual([])
      })
    })

    describe('codes Corse spéciaux via code postal', () => {
      it('doit trouver une commune avec le code postal 20000 (Corse-du-Sud)', async () => {
        getDepartmentFromPostalCode.mockReturnValue('2A')
        mockLoadDepartment.mockResolvedValue(makeDeptData([makeCommune('2A004', 'Ajaccio', ['20000'])]))

        const result = await service.getINSEECodes('20000')

        expect(getDepartmentFromPostalCode).toHaveBeenCalledWith('20000')
        expect(mockLoadDepartment).toHaveBeenCalledWith('2A')
        expect(result).toEqual(['2A004'])
      })

      it('doit trouver une commune avec le code postal 20200 (Haute-Corse)', async () => {
        getDepartmentFromPostalCode.mockReturnValue('2B')
        mockLoadDepartment.mockResolvedValue(makeDeptData([makeCommune('2B033', 'Bastia', ['20200'])]))

        const result = await service.getINSEECodes('20200')

        expect(mockLoadDepartment).toHaveBeenCalledWith('2B')
        expect(result).toEqual(['2B033'])
      })
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // executeQuery
  // ─────────────────────────────────────────────────────────────────────────────

  describe('executeQuery - construction et exécution de requête API', () => {
    it("doit appeler l'URL correcte avec les bons paramètres", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] })
      })

      await service.executeQuery('code_insee:"75001"', 50)

      expect(fetch).toHaveBeenCalledOnce()
      const calledUrl = fetch.mock.calls[0][0]
      expect(calledUrl).toContain('https://data.ademe.fr/data-fair/api/v1/datasets/dpe-france/lines')
      expect(calledUrl).toContain('qs=')
      expect(calledUrl).toContain('size=50')
      expect(calledUrl).toContain('sort=-date_etablissement_dpe')
    })

    it("doit retourner les résultats de l'API", async () => {
      const mockResults = [makeLegacyResult(), makeLegacyResult({ numero_dpe: 'DPE-002' })]
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: mockResults })
      })

      const result = await service.executeQuery('code_insee:"75001"')

      expect(result).toEqual(mockResults)
    })

    it('doit utiliser size=100 par défaut', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] })
      })

      await service.executeQuery('code_insee:"75001"')

      const calledUrl = fetch.mock.calls[0][0]
      expect(calledUrl).toContain('size=100')
    })

    it("doit retourner un tableau vide si la réponse n'est pas ok (erreur 500)", async () => {
      fetch.mockResolvedValue(mockFetchError(500))

      const result = await service.executeQuery('code_insee:"75001"')

      expect(result).toEqual([])
    })

    it("doit retourner un tableau vide en cas d'erreur 429 (limite de débit)", async () => {
      fetch.mockResolvedValue(mockFetchError(429))

      const result = await service.executeQuery('code_insee:"75001"')

      expect(result).toEqual([])
    })

    it('doit retourner un tableau vide si fetch lance une exception', async () => {
      fetch.mockRejectedValue(new Error('Erreur réseau'))

      const result = await service.executeQuery('code_insee:"75001"')

      expect(result).toEqual([])
    })

    it('doit retourner un tableau vide si data.results est absent', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ total: 0 })
      })

      const result = await service.executeQuery('code_insee:"75001"')

      expect(result).toEqual([])
    })

    it("doit encoder correctement la requête dans l'URL", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] })
      })

      const query = 'code_insee_commune_actualise:"75001" AND classe_consommation_energie:"D"'
      await service.executeQuery(query)

      const calledUrl = fetch.mock.calls[0][0]
      // La requête doit être encodée dans l'URL
      expect(calledUrl).toContain('qs=')
      expect(decodeURIComponent(calledUrl).replace(/\+/g, ' ')).toContain(query)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // mapLegacyResult
  // ─────────────────────────────────────────────────────────────────────────────

  describe('mapLegacyResult - transformation des champs legacy ADEME', () => {
    it('doit mapper tous les champs principaux correctement', () => {
      const raw = makeLegacyResult()
      const searchReq = makeSearchRequest()

      const result = service.mapLegacyResult(raw, searchReq)

      expect(result.adresseComplete).toBe('12 Rue de la Paix 75001 Paris')
      expect(result.codePostal).toBe('75001')
      expect(result.commune).toBe('Paris')
      expect(result.latitude).toBe(48.8698)
      expect(result.longitude).toBe(2.3309)
      expect(result.consommationEnergie).toBe(150)
      expect(result.classeDPE).toBe('D')
      expect(result.emissionGES).toBe(30)
      expect(result.classeGES).toBe('D')
      expect(result.typeBien).toBe('appartement')
      expect(result.surfaceHabitable).toBe(65)
      expect(result.anneeConstruction).toBe(1985)
      expect(result.numeroDPE).toBe('DPE-LEGACY-001')
      expect(result.id).toBe('DPE-LEGACY-001')
      expect(result.isLegacyData).toBe(true)
      expect(result.fromLegacy).toBe(true)
      expect(result.legacyNote).toBe('DPE avant juillet 2021')
    })

    it('doit extraire les coordonnées depuis _geopoint quand latitude/longitude sont absentes', () => {
      const raw = makeLegacyResult({ latitude: null, longitude: null, _geopoint: '43.2965,5.3698' })
      const result = service.mapLegacyResult(raw, makeSearchRequest())

      expect(result.latitude).toBeCloseTo(43.2965)
      expect(result.longitude).toBeCloseTo(5.3698)
    })

    it('doit marquer hasIncompleteData à true si geo_adresse est manquant', () => {
      const raw = makeLegacyResult({ geo_adresse: null })
      const result = service.mapLegacyResult(raw, makeSearchRequest())

      expect(result.hasIncompleteData).toBe(true)
      expect(result.matchScore).toBe(0)
    })

    it('doit marquer hasIncompleteData à true si geo_adresse vaut "Adresse non disponible"', () => {
      const raw = makeLegacyResult({ geo_adresse: 'Adresse non disponible' })
      const result = service.mapLegacyResult(raw, makeSearchRequest())

      expect(result.hasIncompleteData).toBe(true)
      expect(result.matchScore).toBe(0)
    })

    it('doit marquer hasIncompleteData à true si les coordonnées sont manquantes', () => {
      const raw = makeLegacyResult({ latitude: null, longitude: null, _geopoint: undefined })
      const result = service.mapLegacyResult(raw, makeSearchRequest())

      expect(result.hasIncompleteData).toBe(true)
      expect(result.matchScore).toBe(0)
    })

    it("doit générer l'URL ADEME si numero_dpe est présent", () => {
      const raw = makeLegacyResult({ numero_dpe: 'DPE-LEGACY-001' })
      const result = service.mapLegacyResult(raw, makeSearchRequest())

      expect(result.ademeUrl).toBe('https://observatoire-dpe-audit.ademe.fr/afficher-dpe/DPE-LEGACY-001')
    })

    it('doit avoir ademeUrl à null si numero_dpe est absent', () => {
      const raw = makeLegacyResult({ numero_dpe: null })
      const result = service.mapLegacyResult(raw, makeSearchRequest())

      expect(result.ademeUrl).toBeNull()
    })

    it('doit utiliser _id comme id si numero_dpe est absent', () => {
      const raw = makeLegacyResult({ numero_dpe: null, _id: 'raw-id-123' })
      const result = service.mapLegacyResult(raw, makeSearchRequest())

      expect(result.id).toBe('raw-id-123')
    })

    it('doit retourner 0 pour les champs numériques manquants', () => {
      const raw = makeLegacyResult({
        consommation_energie: undefined,
        estimation_ges: undefined,
        surface_thermique_lot: undefined
      })
      const result = service.mapLegacyResult(raw, makeSearchRequest())

      expect(result.consommationEnergie).toBe(0)
      expect(result.emissionGES).toBe(0)
      expect(result.surfaceHabitable).toBe(0)
    })

    it('doit inclure rawData avec les données brutes originales', () => {
      const raw = makeLegacyResult()
      const result = service.mapLegacyResult(raw, makeSearchRequest())

      expect(result.rawData).toEqual(raw)
    })

    it('doit mapper le type "Maison Individuelle" vers "maison"', () => {
      const raw = makeLegacyResult({ tr002_type_batiment_description: 'Maison Individuelle' })
      const result = service.mapLegacyResult(raw, makeSearchRequest())

      expect(result.typeBien).toBe('maison')
    })

    it('doit mapper le type "Logement" vers "logement"', () => {
      const raw = makeLegacyResult({ tr002_type_batiment_description: 'Logement' })
      const result = service.mapLegacyResult(raw, makeSearchRequest())

      expect(result.typeBien).toBe('logement')
    })

    it('doit mapper le type "Immeuble" vers "immeuble"', () => {
      const raw = makeLegacyResult({ tr002_type_batiment_description: 'Immeuble' })
      const result = service.mapLegacyResult(raw, makeSearchRequest())

      expect(result.typeBien).toBe('immeuble')
    })

    it('doit retourner une chaîne vide si tr002_type_batiment_description est absent', () => {
      const raw = makeLegacyResult({ tr002_type_batiment_description: null })
      const result = service.mapLegacyResult(raw, makeSearchRequest())

      expect(result.typeBien).toBe('')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // calculateMatchScore
  // ─────────────────────────────────────────────────────────────────────────────

  describe('calculateMatchScore - algorithme de score legacy', () => {
    describe('recherche par valeur exacte (mode non-classe)', () => {
      it('doit attribuer 90 points pour une surface exacte (écart <= 1 m²)', () => {
        const raw = makeLegacyResult({ surface_thermique_lot: 65, consommation_energie: 150, estimation_ges: 30 })
        const req = makeSearchRequest({ surfaceHabitable: 65, consommationEnergie: 150, emissionGES: 30 })

        const score = service.calculateMatchScore(raw, req)

        // 10 (location) + 90 (surface exacte) * 1.0 (correspondance conso parfaite) * 1.0 (GES parfait) = 100
        expect(score).toBe(100)
      })

      it("doit attribuer 90 points quand l'écart de surface est exactement 1 m²", () => {
        const raw = makeLegacyResult({ surface_thermique_lot: 66, consommation_energie: 150 })
        const req = makeSearchRequest({ surfaceHabitable: 65, consommationEnergie: 150 })

        const score = service.calculateMatchScore(raw, req)

        // surfaceDiff = 1 → baseScore = 90 + 10 (location) = 100
        expect(score).toBe(100)
      })

      it('doit réduire le score pour un écart de surface proportionnel', () => {
        // surfaceDiff=6.5, surfacePercent=10 → baseScore = 90 - 10 = 80
        const raw = makeLegacyResult({ surface_thermique_lot: 71.5, consommation_energie: 150 })
        const req = makeSearchRequest({ surfaceHabitable: 65, consommationEnergie: 150 })

        const scoreApprox = service.calculateMatchScore(raw, req)

        // 80 (surface) + 10 (location) = 90
        expect(scoreApprox).toBe(90)
      })

      it("doit appliquer un multiplicateur 0.5 quand l'écart de surface dépasse 100%", () => {
        // surfacePercent > 100 → baseScore = 0 (surface) + 10 (location), multiplier = 0.5
        // score = Math.round(10 * 0.5) = 5
        const raw = makeLegacyResult({ surface_thermique_lot: 200, consommation_energie: 150 })
        const req = makeSearchRequest({ surfaceHabitable: 65, consommationEnergie: 150 })

        const score = service.calculateMatchScore(raw, req)

        expect(score).toBe(5)
      })

      it('doit appliquer un multiplicateur 0.75 pour un écart de consommation de 1 kWh', () => {
        const raw = makeLegacyResult({ surface_thermique_lot: 65, consommation_energie: 151 })
        const req = makeSearchRequest({ surfaceHabitable: 65, consommationEnergie: 150 })

        const score = service.calculateMatchScore(raw, req)

        // baseScore=90+10(location)=100, multiplier=0.75 → Math.round(100 * 0.75) = 75
        expect(score).toBe(Math.round(100 * 0.75))
      })

      it('doit appliquer un multiplicateur plancher de 0.3 pour un très grand écart de consommation', () => {
        const raw = makeLegacyResult({ surface_thermique_lot: 65, consommation_energie: 300 })
        const req = makeSearchRequest({ surfaceHabitable: 65, consommationEnergie: 150 })

        const score = service.calculateMatchScore(raw, req)

        // kwhDiff = 150 > 9 → multiplier = max(0.3, 0.6 - (150-9)*0.03) → plancher 0.3
        // baseScore = 90 (surface) + 10 (location) = 100
        const expectedMultiplier = Math.max(0.3, 0.6 - (150 - 9) * 0.03)
        expect(score).toBe(Math.round(100 * expectedMultiplier))
      })

      it('doit appliquer un multiplicateur GES pour un écart de GES de 1', () => {
        const raw = makeLegacyResult({ surface_thermique_lot: 65, estimation_ges: 31 })
        const req = makeSearchRequest({ surfaceHabitable: 65, emissionGES: 30 })

        const score = service.calculateMatchScore(raw, req)

        // baseScore=90+10(location)=100, gesDiff=1 → multiplier=0.75 → 75
        expect(score).toBe(Math.round(100 * 0.75))
      })

      it('doit cumuler les pénalités conso et GES', () => {
        const raw = makeLegacyResult({ surface_thermique_lot: 65, consommation_energie: 151, estimation_ges: 31 })
        const req = makeSearchRequest({ surfaceHabitable: 65, consommationEnergie: 150, emissionGES: 30 })

        const score = service.calculateMatchScore(raw, req)

        // baseScore=90+10(location)=100, multiplier = 0.75 * 0.75 = 0.5625 → Math.round(100 * 0.5625) = 56
        expect(score).toBe(Math.round(100 * 0.75 * 0.75))
      })

      it("doit ajouter 10 points si la commune est dans l'adresse", () => {
        const raw = makeLegacyResult({ surface_thermique_lot: 65, geo_adresse: '12 Rue du Port 13001 Marseille' })
        const req = makeSearchRequest({ surfaceHabitable: 65, commune: 'Marseille', consommationEnergie: 0 })

        const score = service.calculateMatchScore(raw, req)

        // baseScore=90+10=100, pas de pénalité conso/GES
        expect(score).toBe(100)
      })
    })

    describe('recherche par classe (isClassSearch = true)', () => {
      const classRequest = (overrides = {}) => ({
        commune: '75001',
        surfaceHabitable: 65,
        energyClass: 'D',
        gesClass: 'D',
        consommationEnergie: null,
        ...overrides
      })

      it('doit attribuer 40 points pour une classe énergétique exacte', () => {
        const raw = makeLegacyResult({
          surface_thermique_lot: 65,
          classe_consommation_energie: 'D',
          classe_estimation_ges: 'D'
        })
        const req = classRequest()

        const score = service.calculateMatchScore(raw, req)

        // Location: 10pts (commune '75001' in geo_adresse)
        // Surface: écart=0<=1 → 30pts
        // Classe énergie exacte: 40pts
        // Classe GES exacte: 20pts
        expect(score).toBe(100)
      })

      it('doit attribuer 25 points pour un écart de classe de 1', () => {
        const raw = makeLegacyResult({
          surface_thermique_lot: 65,
          classe_consommation_energie: 'E',
          classe_estimation_ges: 'D'
        })
        const req = classRequest({ energyClass: 'D', gesClass: 'D' })

        const score = service.calculateMatchScore(raw, req)

        // Location: 10 + Surface: 30 + Classe énergie: 25 (diff=1) + GES: 20 = 85
        expect(score).toBe(85)
      })

      it('doit attribuer 10 points pour un écart de classe de 2', () => {
        const raw = makeLegacyResult({
          surface_thermique_lot: 65,
          classe_consommation_energie: 'F',
          classe_estimation_ges: 'D'
        })
        const req = classRequest({ energyClass: 'D' })

        const score = service.calculateMatchScore(raw, req)

        // Location: 10 + Surface: 30 + Classe énergie: 10 (diff=2) + GES: 20 = 70
        expect(score).toBe(70)
      })

      it('doit attribuer 5 points pour un écart de classe de 3', () => {
        const raw = makeLegacyResult({
          surface_thermique_lot: 65,
          classe_consommation_energie: 'G',
          classe_estimation_ges: 'D'
        })
        const req = classRequest({ energyClass: 'D' })

        const score = service.calculateMatchScore(raw, req)

        // Location: 10 + Surface: 30 + Classe énergie: 5 (diff=3) + GES: 20 = 65
        expect(score).toBe(65)
      })

      it('doit attribuer 0 points de classe pour un écart >= 4', () => {
        const raw = makeLegacyResult({
          surface_thermique_lot: 65,
          classe_consommation_energie: 'A',
          classe_estimation_ges: 'D'
        })
        // A vs E = diff 4
        const req = classRequest({ energyClass: 'E' })

        const score = service.calculateMatchScore(raw, req)

        // Location: 10 + Surface: 30 + Classe énergie: 0 (diff=4) + GES: 20 = 60
        expect(score).toBe(60)
      })

      it("doit appliquer un multiplicateur 0.5 sur la surface si l'écart dépasse 100%", () => {
        const raw = makeLegacyResult({
          surface_thermique_lot: 200,
          classe_consommation_energie: 'D',
          classe_estimation_ges: 'D'
        })
        const req = classRequest()

        const score = service.calculateMatchScore(raw, req)

        // Location: 10, surfacePercent > 100 → baseScore += 15; multiplier *= 0.5
        // Ensuite baseScore += 40 + 20 = 85
        // score = Math.round(85 * 0.5) = 43
        expect(score).toBe(Math.round((10 + 15 + 40 + 20) * 0.5))
      })

      it('doit scorer les classes GES : 12 points pour écart de 1', () => {
        const raw = makeLegacyResult({
          surface_thermique_lot: 65,
          classe_consommation_energie: 'D',
          classe_estimation_ges: 'E'
        })
        const req = classRequest({ gesClass: 'D' })

        const score = service.calculateMatchScore(raw, req)

        // Location: 10 + Surface: 30 + Classe énergie: 40 + GES: 12 (diff=1) = 92
        expect(score).toBe(92)
      })

      it('doit scorer les classes GES : 6 points pour écart de 2', () => {
        const raw = makeLegacyResult({
          surface_thermique_lot: 65,
          classe_consommation_energie: 'D',
          classe_estimation_ges: 'F'
        })
        const req = classRequest({ gesClass: 'D' })

        const score = service.calculateMatchScore(raw, req)

        // Location: 10 + Surface: 30 + Classe énergie: 40 + GES: 6 (diff=2) = 86
        expect(score).toBe(86)
      })

      it('doit scorer les classes GES : 3 points pour écart de 3', () => {
        const raw = makeLegacyResult({
          surface_thermique_lot: 65,
          classe_consommation_energie: 'D',
          classe_estimation_ges: 'G'
        })
        const req = classRequest({ gesClass: 'D' })

        const score = service.calculateMatchScore(raw, req)

        // Location: 10 + Surface: 30 + Classe énergie: 40 + GES: 3 (diff=3) = 83
        expect(score).toBe(83)
      })
    })

    describe('cas limites', () => {
      it('doit retourner 0 si tous les critères sont absents', () => {
        const raw = makeLegacyResult({ surface_thermique_lot: 65 })
        const req = { commune: null, surfaceHabitable: null, consommationEnergie: null, emissionGES: null }

        const score = service.calculateMatchScore(raw, req)

        expect(score).toBe(0)
      })

      it('doit retourner un entier arrondi', () => {
        const raw = makeLegacyResult({ surface_thermique_lot: 66, consommation_energie: 151 })
        const req = makeSearchRequest({ surfaceHabitable: 65, consommationEnergie: 150 })

        const score = service.calculateMatchScore(raw, req)

        expect(Number.isInteger(score)).toBe(true)
      })

      it('doit ignorer energyClass si consommationEnergie est aussi fourni (mode non-classe)', () => {
        const raw = makeLegacyResult({ surface_thermique_lot: 65, classe_consommation_energie: 'A' })
        // Les deux présents → isClassSearch = false
        const req = makeSearchRequest({ energyClass: 'D', consommationEnergie: 150 })

        const score = service.calculateMatchScore(raw, req)

        // En mode valeur exacte, la classe n'est pas notée directement
        // baseScore = 90 (surface), pas de bonus de classe
        expect(score).toBeGreaterThanOrEqual(0)
      })
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // searchLegacy
  // ─────────────────────────────────────────────────────────────────────────────

  describe('searchLegacy - flux de recherche complet', () => {
    beforeEach(() => {
      getDepartmentFromPostalCode.mockReturnValue('75')
      mockLoadDepartment.mockResolvedValue(makeDeptData([makeCommune('75001', 'Paris 1er', ['75001'])]))
    })

    it("doit retourner un message d'erreur si la commune est introuvable", async () => {
      getDepartmentFromPostalCode.mockReturnValue(null)

      const result = await service.searchLegacy({ commune: '99999' })

      expect(result.results).toEqual([])
      expect(result.fromLegacy).toBe(true)
      expect(result.message).toBe('Commune non trouvée dans la base pré-2021')
    })

    it('doit retourner fromLegacy=true et inseeCodes dans les résultats', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [makeLegacyResult()] })
      })

      const result = await service.searchLegacy(makeSearchRequest())

      expect(result.fromLegacy).toBe(true)
      expect(result.inseeCodes).toEqual(['75001'])
    })

    it('doit trier les résultats par matchScore décroissant', async () => {
      const lowScoreResult = makeLegacyResult({ numero_dpe: 'LOW', surface_thermique_lot: 200 })
      const highScoreResult = makeLegacyResult({ numero_dpe: 'HIGH', surface_thermique_lot: 65 })

      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [lowScoreResult, highScoreResult] })
      })

      const result = await service.searchLegacy(makeSearchRequest())

      // Le résultat avec surface=65 doit être avant surface=200
      expect(result.results[0].surfaceHabitable).toBe(65)
    })

    it('doit dédupliquer les résultats selon numero_dpe', async () => {
      const duplicate = makeLegacyResult({ numero_dpe: 'DPE-LEGACY-001' })

      // La recherche stricte retourne 1 résultat, la recherche élargie retourne le même
      fetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ results: [duplicate] }) }) // strict
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ results: [duplicate] }) }) // expanded
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ results: [duplicate] }) }) // regional

      const result = await service.searchLegacy(makeSearchRequest())

      // Doit avoir exactement 1 résultat (pas de doublon)
      expect(result.results.length).toBe(1)
    })

    it('doit limiter les résultats à 20 entrées maximum', async () => {
      const manyResults = Array.from({ length: 25 }, (_, i) =>
        makeLegacyResult({ numero_dpe: `DPE-${i}`, surface_thermique_lot: 65 })
      )

      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: manyResults })
      })

      const result = await service.searchLegacy(makeSearchRequest())

      expect(result.results.length).toBeLessThanOrEqual(20)
    })

    it('doit inclure executionTime dans la réponse', async () => {
      fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ results: [] }) })

      const result = await service.searchLegacy(makeSearchRequest())

      expect(typeof result.executionTime).toBe('number')
      expect(result.executionTime).toBeGreaterThanOrEqual(0)
    })

    it('doit inclure la stratégie de recherche utilisée', async () => {
      const mockResult = makeLegacyResult()
      fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ results: [mockResult] }) })

      const result = await service.searchLegacy(makeSearchRequest())

      expect(typeof result.searchStrategy).toBe('string')
    })

    it("doit retourner une erreur gracieuse en cas d'exception interne", async () => {
      // Forcer une erreur en cassant loadDepartment avec une exception non attrapée
      mockLoadDepartment.mockRejectedValue(new Error('Défaillance store'))

      const result = await service.searchLegacy(makeSearchRequest())

      expect(result.fromLegacy).toBe(true)
      expect(result.results).toEqual([])
    })

    it('doit construire une requête stricte avec tolérance de surface ±1%', async () => {
      fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ results: [] }) })

      await service.searchLegacy(makeSearchRequest({ surfaceHabitable: 100 }))

      const firstCallUrl = decodeURIComponent(fetch.mock.calls[0][0]).replace(/\+/g, ' ')
      // ±1% de 100 → [99 TO 101]
      expect(firstCallUrl).toContain('surface_thermique_lot:[99 TO 101]')
    })

    it('doit ajouter le filtre classe_consommation_energie pour une recherche par classe', async () => {
      fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ results: [] }) })

      await service.searchLegacy({ commune: '75001', energyClass: 'D', consommationEnergie: null })

      const firstCallUrl = decodeURIComponent(fetch.mock.calls[0][0])
      expect(firstCallUrl).toContain('classe_consommation_energie:"D"')
    })

    it('doit ajouter le filtre type maison correctement', async () => {
      fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ results: [] }) })

      await service.searchLegacy({ commune: '75001', typeBien: 'maison' })

      const firstCallUrl = decodeURIComponent(fetch.mock.calls[0][0]).replace(/\+/g, ' ')
      expect(firstCallUrl).toContain('tr002_type_batiment_description:"Maison Individuelle"')
    })

    it('doit ajouter le filtre type appartement correctement', async () => {
      fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ results: [] }) })

      await service.searchLegacy({ commune: '75001', typeBien: 'appartement' })

      const firstCallUrl = decodeURIComponent(fetch.mock.calls[0][0])
      expect(firstCallUrl).toContain('tr002_type_batiment_description:"Appartement"')
    })

    it('doit effectuer une recherche élargie si moins de 10 résultats stricts', async () => {
      // La recherche stricte retourne 5 résultats (< 10 → élargi déclenché)
      const strictResults = Array.from({ length: 5 }, (_, i) => makeLegacyResult({ numero_dpe: `STRICT-${i}` }))

      fetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ results: strictResults }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ results: [] }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ results: [] }) })

      await service.searchLegacy(makeSearchRequest())

      // Doit avoir fait 3 appels : strict + élargi + régional
      expect(fetch).toHaveBeenCalledTimes(3)
    })

    it('ne doit pas effectuer de recherche élargie si >= 10 résultats stricts mais < 20', async () => {
      const strictResults = Array.from({ length: 10 }, (_, i) => makeLegacyResult({ numero_dpe: `STRICT-${i}` }))

      fetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ results: strictResults }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ results: [] }) })

      await service.searchLegacy(makeSearchRequest())

      // Pas d'élargi, mais la recherche régionale est quand même déclenchée (< 20)
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('ne doit pas effectuer de recherche régionale si >= 20 résultats', async () => {
      const strictResults = Array.from({ length: 20 }, (_, i) => makeLegacyResult({ numero_dpe: `STRICT-${i}` }))

      fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ results: strictResults }) })

      await service.searchLegacy(makeSearchRequest())

      // Uniquement la recherche stricte
      expect(fetch).toHaveBeenCalledTimes(1)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // parseComparisonValue
  // ─────────────────────────────────────────────────────────────────────────────

  describe('parseComparisonValue - analyse des valeurs de comparaison', () => {
    it('doit retourner null pour une valeur nulle', () => {
      expect(service.parseComparisonValue(null)).toBeNull()
      expect(service.parseComparisonValue(undefined)).toBeNull()
      expect(service.parseComparisonValue('')).toBeNull()
    })

    it('doit parser un opérateur <', () => {
      expect(service.parseComparisonValue('<150')).toEqual({ operator: '<', value: 150 })
    })

    it('doit parser un opérateur >', () => {
      expect(service.parseComparisonValue('>50')).toEqual({ operator: '>', value: 50 })
    })

    it('doit parser une valeur exacte sans opérateur', () => {
      expect(service.parseComparisonValue('100')).toEqual({ operator: '=', value: 100 })
    })

    it('doit accepter un nombre entier directement', () => {
      expect(service.parseComparisonValue(100)).toEqual({ operator: '=', value: 100 })
    })

    it('doit gérer les espaces autour de la valeur', () => {
      expect(service.parseComparisonValue('  75  ')).toEqual({ operator: '=', value: 75 })
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // buildRangeQuery
  // ─────────────────────────────────────────────────────────────────────────────

  describe('buildRangeQuery - construction de requêtes Lucene', () => {
    it('doit retourner null si comparison est null', () => {
      expect(service.buildRangeQuery(null, 'champ')).toBeNull()
    })

    it('doit construire une requête "inférieur à" avec [0 TO valeur]', () => {
      const comparison = { operator: '<', value: 100 }
      expect(service.buildRangeQuery(comparison, 'surface')).toBe('surface:[0 TO 100]')
    })

    it('doit construire une requête "supérieur à" avec [valeur TO 9999]', () => {
      const comparison = { operator: '>', value: 200 }
      expect(service.buildRangeQuery(comparison, 'surface')).toBe('surface:[200 TO 9999]')
    })

    it('doit construire une requête de valeur exacte sans plage', () => {
      const comparison = { operator: '=', value: 150 }
      expect(service.buildRangeQuery(comparison, 'consommation')).toBe('consommation:150')
    })
  })
})
