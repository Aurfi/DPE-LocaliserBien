import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDepartements } from '../../stores/useDepartements.js'
import { extractPostalCode, geocodeAddress, getCommuneCoordinates } from '../../utils/utilsGeo.js'
import ConstructeurRechercheAdeme from '../constructeur-recherche-ademe.service.js'
import DPELegacyService from '../dpe-legacy.service.js'
import DPEScoringService from '../dpe-scoring.service.js'
import DPESearchService from '../dpe-search.service.js'

const upstream = vi.hoisted(() => ({
  departmentStore: { loadDepartment: vi.fn(), getCachedDepartment: vi.fn() },
  searchLegacy: vi.fn(),
  executerRecherche: vi.fn(),
  calculateMatchScore: vi.fn(),
  getMatchReasons: vi.fn(),
  determineStrategy: vi.fn(),
  parseComparisonValue: vi.fn(),
  buildRangeQuery: vi.fn()
}))

vi.mock('../../stores/useDepartements.js', () => ({
  useDepartements: vi.fn(() => upstream.departmentStore)
}))
vi.mock('../../utils/utilsGeo.js', () => ({
  extractPostalCode: vi.fn(),
  geocodeAddress: vi.fn(),
  getCommuneCoordinates: vi.fn()
}))
vi.mock('../dpe-legacy.service.js', () => ({
  default: vi.fn(
    class {
      searchLegacy = upstream.searchLegacy
    }
  )
}))
vi.mock('../dpe-scoring.service.js', () => ({
  default: vi.fn(
    class {
      calculateMatchScore = upstream.calculateMatchScore
      getMatchReasons = upstream.getMatchReasons
      determineStrategy = upstream.determineStrategy
      parseComparisonValue = upstream.parseComparisonValue
      buildRangeQuery = upstream.buildRangeQuery
    }
  )
}))
vi.mock('../constructeur-recherche-ademe.service.js', () => ({
  default: vi.fn(
    class {
      executerRecherche = upstream.executerRecherche
    }
  )
}))

const coords = { lat: 43.5297, lon: 5.4474, postalCode: '13100' }
const request = { commune: 'Aix-en-Provence', surfaceHabitable: 65.5 }
const penaltyReason = 'Score réduit de 15% (données pré-2021)'
let service

beforeEach(() => {
  vi.resetAllMocks()
  useDepartements.mockReturnValue(upstream.departmentStore)
  upstream.departmentStore.getCachedDepartment.mockReturnValue(null)
  getCommuneCoordinates.mockResolvedValue(coords)
  extractPostalCode.mockReturnValue(null)
  upstream.executerRecherche.mockResolvedValue([])
  upstream.searchLegacy.mockResolvedValue({ results: [] })
  upstream.determineStrategy.mockReturnValue('PRECIS')
  vi.spyOn(Date, 'now').mockReturnValue(1000)
  service = new DPESearchService()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('DPE search orchestration', () => {
  it('constructs its store and services, and passes the shared scorer to the lazy search builder', async () => {
    expect(useDepartements).toHaveBeenCalledTimes(1)
    expect(service.departmentStore).toBe(upstream.departmentStore)
    expect(DPELegacyService).toHaveBeenCalledTimes(1)
    expect(DPEScoringService).toHaveBeenCalledTimes(1)
    expect(ConstructeurRechercheAdeme).not.toHaveBeenCalled()

    await service.performSearch(request)

    expect(ConstructeurRechercheAdeme).toHaveBeenCalledTimes(1)
    expect(ConstructeurRechercheAdeme).toHaveBeenCalledWith(service.scoringService)
    expect(upstream.executerRecherche).toHaveBeenCalledWith(request, coords)
    expect(upstream.searchLegacy).toHaveBeenCalledWith(request, false)
  })

  it.each([null, undefined, {}])('returns a complete empty response without upstream work for %j', async input => {
    expect(await service.performSearch(input)).toEqual({
      results: [],
      totalFound: 0,
      searchStrategy: 'AUCUN',
      executionTime: 0,
      diagnostics: ['Requête de recherche vide'],
      isMultiCommune: false,
      postalCode: null,
      hasLegacyData: false
    })
    expect(getCommuneCoordinates).not.toHaveBeenCalled()
    expect(ConstructeurRechercheAdeme).not.toHaveBeenCalled()
    expect(upstream.executerRecherche).not.toHaveBeenCalled()
    expect(upstream.searchLegacy).not.toHaveBeenCalled()
    expect(upstream.determineStrategy).not.toHaveBeenCalled()
  })

  it('normalizes decimal, comparison and zero criteria once for both sources without mutating the request', async () => {
    const original = Object.freeze({
      commune: '13100',
      surfaceHabitable: ' 065,50 ',
      consommationEnergie: ' > 0173,50 ',
      emissionGES: '0,00',
      energyClass: 'D'
    })
    const normalized = {
      commune: '13100',
      surfaceHabitable: 65.5,
      consommationEnergie: '>173.5',
      emissionGES: 0,
      energyClass: 'D'
    }

    await service.performSearch(original)

    expect(upstream.executerRecherche).toHaveBeenCalledWith(normalized, coords)
    expect(upstream.searchLegacy).toHaveBeenCalledWith(normalized, false)
    const modernRequest = upstream.executerRecherche.mock.calls[0][0]
    expect(modernRequest).not.toBe(original)
    expect(upstream.searchLegacy.mock.calls[0][0]).toBe(modernRequest)
    expect(original.surfaceHabitable).toBe(' 065,50 ')
    expect(original.consommationEnergie).toBe(' > 0173,50 ')
    expect(original.emissionGES).toBe('0,00')
  })

  it('normalizes blank numeric fields to null and leaves absent criteria absent', async () => {
    await service.performSearch({ commune: '13100', surfaceHabitable: ' ', emissionGES: null })

    expect(upstream.executerRecherche).toHaveBeenCalledWith(
      { commune: '13100', surfaceHabitable: null, emissionGES: null },
      coords
    )
    expect(upstream.searchLegacy.mock.calls[0][0]).not.toHaveProperty('consommationEnergie')
  })

  it.each(['surfaceHabitable', 'consommationEnergie', 'emissionGES'])(
    'rejects invalid %s before any location or search request',
    async field => {
      await expect(service.performSearch({ commune: '13100', [field]: '65 m²' })).rejects.toMatchObject({
        code: 'INVALID_NUMERIC_INPUT'
      })
      expect(getCommuneCoordinates).not.toHaveBeenCalled()
      expect(ConstructeurRechercheAdeme).not.toHaveBeenCalled()
      expect(upstream.searchLegacy).not.toHaveBeenCalled()
    }
  )

  it('merges sources, keeps modern DPE duplicates and penalties only cloned legacy rows', async () => {
    const modern = Object.freeze([
      Object.freeze({ numeroDPE: 'shared', matchScore: 95, matchReasons: ['Adresse exacte'] })
    ])
    const legacy = Object.freeze([
      Object.freeze({ numeroDPE: 'shared', matchScore: 100, matchReasons: ['Doublon historique'] }),
      Object.freeze({ numeroDPE: 'legacy', matchScore: 83, matchReasons: Object.freeze(['Surface proche']) }),
      Object.freeze({ numeroDPE: '', matchScore: 80 }),
      Object.freeze({ matchScore: 74, matchReasons: null })
    ])
    upstream.executerRecherche.mockResolvedValue(modern)
    upstream.searchLegacy.mockResolvedValue({ results: legacy })

    const response = await service.performSearch(request)

    expect(response.results).toEqual([
      modern[0],
      { numeroDPE: 'legacy', matchScore: 71, matchReasons: ['Surface proche', penaltyReason] },
      { numeroDPE: '', matchScore: 68, matchReasons: [penaltyReason] },
      { matchScore: 63, matchReasons: [penaltyReason] }
    ])
    expect(response.results[0]).toBe(modern[0])
    expect(response.results[1]).not.toBe(legacy[1])
    expect(legacy[1]).toEqual({ numeroDPE: 'legacy', matchScore: 83, matchReasons: ['Surface proche'] })
    expect(response.totalFound).toBe(4)
    expect(response.hasLegacyData).toBe(true)
    expect(upstream.determineStrategy).toHaveBeenCalledWith(response.results)
  })

  it('retains id-less legacy rows even when a modern row also lacks a DPE identifier', async () => {
    const modern = { matchScore: 85 }
    upstream.executerRecherche.mockResolvedValue([modern])
    upstream.searchLegacy.mockResolvedValue({ results: [{ matchScore: 80 }] })

    const response = await service.performSearch(request)

    expect(response.results).toEqual([modern, { matchScore: 68, matchReasons: [penaltyReason] }])
    expect(response.totalFound).toBe(2)
  })

  it.each([
    [89, [49, 50]],
    [90, [50]]
  ])('filters penalized scores below 50 only when a modern score reaches %i', async (modernScore, legacyScores) => {
    upstream.executerRecherche.mockResolvedValue([{ numeroDPE: 'modern', matchScore: modernScore }])
    upstream.searchLegacy.mockResolvedValue({
      results: [
        { numeroDPE: 'below-boundary', matchScore: 58 },
        { numeroDPE: 'at-boundary', matchScore: 59 }
      ]
    })

    const response = await service.performSearch(request)

    expect(response.results.map(result => result.matchScore)).toEqual([modernScore, ...legacyScores])
    expect(response.totalFound).toBe(legacyScores.length + 1)
    expect(response.hasLegacyData).toBe(true)
  })

  it('reports no legacy data when perfect modern matches filter out every legacy result', async () => {
    const modern = [{ numeroDPE: 'modern', matchScore: 90 }]
    upstream.executerRecherche.mockResolvedValue(modern)
    upstream.searchLegacy.mockResolvedValue({ results: [{ numeroDPE: 'legacy', matchScore: 58 }] })

    const response = await service.performSearch(request)

    expect(response.results).toEqual(modern)
    expect(response.totalFound).toBe(1)
    expect(response.hasLegacyData).toBe(false)
  })

  it.each([[], null, undefined])('uses penalized legacy results when modern results are %j', async modern => {
    upstream.executerRecherche.mockResolvedValue(modern)
    upstream.searchLegacy.mockResolvedValue({ results: [{ numeroDPE: 'legacy', matchScore: 40 }] })

    const response = await service.performSearch(request)

    expect(response.results).toEqual([{ numeroDPE: 'legacy', matchScore: 34, matchReasons: [penaltyReason] }])
    expect(response.totalFound).toBe(1)
    expect(response.hasLegacyData).toBe(true)
    expect(upstream.determineStrategy).toHaveBeenCalledWith(response.results)
  })

  it.each([{ results: [] }, { results: null }, {}])('keeps modern results when legacy returns %j', async legacy => {
    const modern = [{ numeroDPE: 'modern', matchScore: 84 }]
    upstream.executerRecherche.mockResolvedValue(modern)
    upstream.searchLegacy.mockResolvedValue(legacy)

    const response = await service.performSearch(request)

    expect(response.results).toBe(modern)
    expect(response.totalFound).toBe(1)
    expect(response.hasLegacyData).toBe(false)
  })

  it.each([null, undefined])('normalizes %j modern results to an empty result list', async modern => {
    upstream.executerRecherche.mockResolvedValue(modern)
    upstream.determineStrategy.mockReturnValue('AUCUN')

    const response = await service.performSearch(request)

    expect(response.results).toEqual([])
    expect(response.totalFound).toBe(0)
    expect(response.searchStrategy).toBe('AUCUN')
    expect(response.diagnostics).toEqual(['Recherche effectuée avec 0 résultats'])
    expect(response.hasLegacyData).toBe(false)
    expect(upstream.determineStrategy).toHaveBeenCalledWith(modern)
  })

  it('supports a missing optional legacy service', async () => {
    service.legacyService = null
    const modern = [{ numeroDPE: 'modern', matchScore: 84 }]
    upstream.executerRecherche.mockResolvedValue(modern)

    const response = await service.performSearch(request)

    expect(response.results).toBe(modern)
    expect(response.hasLegacyData).toBe(false)
    expect(upstream.searchLegacy).not.toHaveBeenCalled()
  })

  it('returns scoring strategy, duration, diagnostics and multi-commune metadata', async () => {
    Date.now.mockReturnValueOnce(1000).mockReturnValueOnce(1125)
    getCommuneCoordinates.mockResolvedValue({ ...coords, isMultiCommune: true })
    upstream.executerRecherche.mockResolvedValue([{ numeroDPE: 'modern', matchScore: 95 }])
    upstream.determineStrategy.mockReturnValue('ULTRA_PRECIS')

    expect(await service.performSearch(request)).toEqual({
      results: [{ numeroDPE: 'modern', matchScore: 95 }],
      totalFound: 1,
      searchStrategy: 'ULTRA_PRECIS',
      executionTime: 125,
      diagnostics: ['Recherche effectuée avec 1 résultats'],
      isMultiCommune: true,
      postalCode: '13100',
      hasLegacyData: false
    })
  })

  it.each([
    ['75001', { ...coords, postalCode: '75002' }, '75001'],
    ['Aix-en-Provence', coords, '13100'],
    ['Unknown commune', null, null],
    ['Unknown commune', { lat: 1, lon: 2 }, null]
  ])('resolves the response postcode for %s with coordinates %j', async (commune, coordinates, postalCode) => {
    getCommuneCoordinates.mockResolvedValue(coordinates)

    const response = await service.performSearch({ commune })

    expect(response.postalCode).toBe(postalCode)
    expect(response.isMultiCommune).toBe(false)
    expect(getCommuneCoordinates).toHaveBeenCalledWith(commune, expect.any(Function), expect.any(Object))
    expect(upstream.executerRecherche).toHaveBeenCalledWith({ commune }, coordinates)
  })
})

describe('public search error and response contract', () => {
  it('returns real orchestration results with local averages explicitly disabled', async () => {
    upstream.executerRecherche.mockResolvedValue([{ numeroDPE: 'modern', matchScore: 84 }])

    const response = await service.search(request)

    expect(response.results).toEqual([{ numeroDPE: 'modern', matchScore: 84 }])
    expect(response.totalFound).toBe(1)
    expect(response.localAverages).toBe(null)
    expect(upstream.searchLegacy).toHaveBeenCalledWith(request, false)
  })

  it('also includes local averages on an empty public search', async () => {
    expect(await service.search(null)).toMatchObject({ results: [], totalFound: 0, localAverages: null })
    expect(upstream.executerRecherche).not.toHaveBeenCalled()
  })

  it('preserves an ambiguous-commune error and its candidates for disambiguation', async () => {
    const error = Object.assign(new Error('Plusieurs communes trouvées'), {
      code: 'AMBIGUOUS_COMMUNE',
      candidates: [{ name: 'Saint-Pierre', postalCode: '97410' }]
    })
    getCommuneCoordinates.mockRejectedValue(error)

    await expect(service.search({ commune: 'Saint-Pierre' })).rejects.toBe(error)
    expect(upstream.executerRecherche).not.toHaveBeenCalled()
    expect(upstream.searchLegacy).not.toHaveBeenCalled()
  })

  it.each(['coordinates', 'modern', 'legacy'])('replaces a %s failure with the stable public error', async source => {
    const failure = new Error('Upstream request details')
    const operation = {
      coordinates: getCommuneCoordinates,
      modern: upstream.executerRecherche,
      legacy: upstream.searchLegacy
    }[source]
    operation.mockRejectedValue(failure)

    await expect(service.search(request)).rejects.toThrow('Impossible de contacter le service de recherche DPE')
    if (source !== 'legacy') expect(upstream.searchLegacy).not.toHaveBeenCalled()
  })
})

describe('geographic and scoring compatibility delegates', () => {
  it('loads a department through the store and returns its original data', async () => {
    const department = { communes: [{ nom: 'Ajaccio' }] }
    upstream.departmentStore.loadDepartment.mockResolvedValue(department)

    expect(await service.loadDepartment('2A')).toBe(department)
    expect(upstream.departmentStore.loadDepartment).toHaveBeenCalledWith('2A')
  })

  it('passes a bound department loader and live cache access to the coordinate utility', async () => {
    const cached = { communes: [{ nom: 'Paris' }] }
    const loaded = { communes: [{ nom: 'Aix-en-Provence' }] }
    upstream.departmentStore.getCachedDepartment.mockImplementation(code => (code === '75' ? cached : null))
    upstream.departmentStore.loadDepartment.mockResolvedValue(loaded)
    getCommuneCoordinates.mockImplementation(async (commune, loadDepartment, cache) => {
      expect(commune).toBe('Aix-en-Provence')
      expect(cache.has('75')).toBe(true)
      expect(cache.has('13')).toBe(false)
      expect(cache.get('75')).toBe(cached)
      expect(cache.get('13')).toBe(null)
      expect(await loadDepartment('13')).toBe(loaded)
      return coords
    })

    expect(await service.getCommuneCoordinates('Aix-en-Provence')).toBe(coords)
    expect(upstream.departmentStore.loadDepartment).toHaveBeenCalledWith('13')
    expect(upstream.departmentStore.getCachedDepartment.mock.calls).toEqual([['75'], ['13'], ['75'], ['13']])
  })

  it('requests the extended geocoding format and returns the untouched response', async () => {
    const geocoded = { ...coords, city: 'Aix-en-Provence', formattedAddress: '1 rue Test 13100 Aix-en-Provence' }
    geocodeAddress.mockResolvedValue(geocoded)

    expect(await service.geocodeAddress('1 rue Test')).toBe(geocoded)
    expect(geocodeAddress).toHaveBeenCalledWith('1 rue Test', { extendedFormat: true })
  })

  it('propagates geocoding failures from the compatibility wrapper', async () => {
    const failure = new Error('Geocoding unavailable')
    geocodeAddress.mockRejectedValue(failure)

    await expect(service.geocodeAddress('1 rue Test')).rejects.toBe(failure)
  })

  it('prefers an extracted postcode without looking up coordinates', async () => {
    extractPostalCode.mockReturnValue('75001')

    expect(await service.extractPostalCode('Paris 75001', coords)).toBe('75001')
    expect(extractPostalCode).toHaveBeenCalledWith('Paris 75001')
    expect(getCommuneCoordinates).not.toHaveBeenCalled()
  })

  it('uses supplied coordinates before attempting a redundant lookup', async () => {
    expect(await service.extractPostalCode('Aix-en-Provence', coords)).toBe('13100')
    expect(getCommuneCoordinates).not.toHaveBeenCalled()
  })

  it.each([undefined, {}])('looks up a postcode when supplied coordinates are %j', async supplied => {
    expect(await service.extractPostalCode('Aix-en-Provence', supplied)).toBe('13100')
    expect(getCommuneCoordinates).toHaveBeenCalledWith('Aix-en-Provence', expect.any(Function), expect.any(Object))
  })

  it.each([null, {}])('falls back to the original commune when lookup returns %j', async coordinates => {
    getCommuneCoordinates.mockResolvedValue(coordinates)

    expect(await service.extractPostalCode('Unknown commune')).toBe('Unknown commune')
  })

  it('delegates match scores and reasons with the original result and request', async () => {
    const result = { numeroDPE: 'modern' }
    const reasons = ['Surface exacte']
    upstream.calculateMatchScore.mockResolvedValue(95)
    upstream.getMatchReasons.mockReturnValue(reasons)

    expect(await service.calculateMatchScore(result, request)).toBe(95)
    expect(service.getMatchReasons(result, request)).toBe(reasons)
    expect(upstream.calculateMatchScore).toHaveBeenCalledWith(result, request)
    expect(upstream.getMatchReasons).toHaveBeenCalledWith(result, request)
  })

  it('delegates comparison parsing and range generation without changing their values', () => {
    const comparison = { operator: '<', value: 65.5 }
    upstream.parseComparisonValue.mockReturnValue(comparison)
    upstream.buildRangeQuery.mockReturnValue('surface:[0 TO 65.5]')

    expect(service.parseComparisonValue('<65,5')).toBe(comparison)
    expect(service.buildRangeQuery(comparison, 'surface')).toBe('surface:[0 TO 65.5]')
    expect(upstream.parseComparisonValue).toHaveBeenCalledWith('<65,5')
    expect(upstream.buildRangeQuery).toHaveBeenCalledWith(comparison, 'surface')
  })
})
