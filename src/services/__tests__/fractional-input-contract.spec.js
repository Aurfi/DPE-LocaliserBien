import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildNumericQuery,
  matchesNumericBoundary,
  normalizeNumericCriteria,
  parseSearchComparison,
  percentageBound
} from '../../utils/numericSearchInput.js'
import ConstructeurRechercheAdeme from '../constructeur-recherche-ademe.service.js'
import DPELegacyService from '../dpe-legacy.service.js'
import DPEScoringService from '../dpe-scoring.service.js'
import DPESearchService from '../dpe-search.service.js'
import { searchRecentDPE } from '../recent-dpe.service.js'

vi.mock('../../utils/utilsGeo.js', () => ({
  calculateDistance: vi.fn(() => 1),
  extractPostalCode: vi.fn(value => (/^\d{5}$/.test(value) ? value : null)),
  getCommuneCoordinates: vi.fn(async () => ({ lat: 48.85, lon: 2.35, postalCode: '75001' })),
  geocodeAddress: vi.fn(async () => ({
    lat: 48.85,
    lon: 2.35,
    postalCode: '75001',
    city: 'Paris',
    formattedAddress: '1 rue Test 75001 Paris'
  }))
}))
vi.mock('../../stores/useDepartements.js', () => ({
  useDepartements: () => ({ loadDepartment: vi.fn(), getCachedDepartment: () => null })
}))
vi.mock('../../utils/communeDirectory.js', () => ({
  getDepartmentsFromPostalCode: () => ['75'],
  getDepartmentsFromCommuneName: async () => ['75'],
  normalizeCommuneName: value => value
}))

const coords = { lat: 48.85, lon: 2.35, postalCode: '75001' }
const request = { commune: '75001', surfaceHabitable: 65.5, consommationEnergie: 173.5, emissionGES: 6.5 }
const modernRow = (overrides = {}) => ({
  numero_dpe: 'fraction',
  code_postal_ban: '75001',
  nom_commune_ban: 'Paris',
  adresse_ban: '1 rue Test',
  surface_habitable_logement: 65.5,
  conso_5_usages_par_m2_ep: 173.5,
  emission_ges_5_usages_par_m2: 6.5,
  _geopoint: '48.85,2.35',
  ...overrides
})
const legacyRow = (overrides = {}) => ({
  numero_dpe: 'fraction-old',
  geo_adresse: '1 rue Test 75001 Paris',
  surface_thermique_lot: 65.5,
  consommation_energie: 173.5,
  estimation_ges: 6.5,
  ...overrides
})
const response = results => ({ ok: true, json: async () => ({ results }) })
const queries = () => fetch.mock.calls.map(([url]) => new URL(url).searchParams.get('qs'))
let scoring
let builder
let legacy
beforeEach(() => {
  scoring = new DPEScoringService()
  builder = new ConstructeurRechercheAdeme(scoring)
  legacy = new DPELegacyService()
  vi.spyOn(legacy, 'getINSEECodes').mockResolvedValue(['75101'])
  global.fetch = vi.fn().mockResolvedValue(response([]))
})

describe('fractional parsing, range semantics and exact decimal bounds', () => {
  it.each(['65,5', '65.5', 65.5])('preserves %s in both current and legacy parsers', value => {
    for (const service of [scoring, legacy])
      expect(service.parseComparisonValue(value)).toEqual({ operator: '=', value: 65.5 })
  })
  it.each([
    ['<65.5', '<'],
    ['>65,5', '>']
  ])('preserves the inclusive boundary of %s', (raw, operator) => {
    for (const service of [scoring, legacy]) {
      const comparison = service.parseComparisonValue(raw)
      expect(comparison).toEqual({ operator, value: 65.5 })
      expect(service.buildRangeQuery(comparison, 'surface')).toBe(
        operator === '<' ? 'surface:[0 TO 65.5]' : 'surface:[65.5 TO 9999]'
      )
      expect(matchesNumericBoundary(65.5, comparison)).toBe(true)
      expect(matchesNumericBoundary(operator === '<' ? 65.49 : 65.51, comparison)).toBe(true)
      expect(matchesNumericBoundary(operator === '<' ? 65.51 : 65.49, comparison)).toBe(false)
    }
  })
  it('retains documented tolerances around the fractional value, without binary tails', () => {
    const comparison = { operator: '=', value: 65.5 }
    expect(buildNumericQuery(comparison, 'surface', { absolute: 1 })).toBe('surface:[64.5 TO 66.5]')
    expect(buildNumericQuery(comparison, 'surface', { percent: 1 })).toBe('surface:[64.845 TO 66.155]')
    expect(buildNumericQuery(comparison, 'surface', { percent: 15 })).toBe('surface:[55.675 TO 75.325]')
    expect(buildNumericQuery(comparison, 'surface', { percent: 35 })).toBe('surface:[42.575 TO 88.425]')
    expect(percentageBound(0.0000001, 95)).toBe('0.000000095')
  })
  it('keeps existing rounded percentage bounds for plain integers', () => {
    expect(buildNumericQuery({ operator: '=', value: 65 }, 'surface', { percent: 1 })).toBe('surface:[64 TO 66]')
    expect(buildNumericQuery({ operator: '=', value: 65 }, 'surface', { percent: 15 })).toBe('surface:[55 TO 75]')
    expect(buildNumericQuery({ operator: '=', value: 65 }, 'surface', { percent: 35 })).toBe('surface:[42 TO 88]')
  })
  it.each(['65,5 m²', '65.5.5', '65,5.5', '<65,', '1e3', Infinity, Number('1e309')])(
    'rejects %s before any query is made',
    async raw => {
      expect(scoring.parseComparisonValue(raw)).toBe(null)
      await expect(builder.executerRecherche({ ...request, surfaceHabitable: raw }, coords)).rejects.toMatchObject({
        code: 'INVALID_NUMERIC_INPUT'
      })
      await expect(new DPESearchService().performSearch({ ...request, surfaceHabitable: raw })).rejects.toMatchObject({
        code: 'INVALID_NUMERIC_INPUT'
      })
      await expect(searchRecentDPE({ address: 'Paris', monthsBack: 1, radius: 1, surface: raw })).rejects.toMatchObject(
        { code: 'INVALID_NUMERIC_INPUT' }
      )
      const result = await legacy.searchLegacy({ ...request, surfaceHabitable: raw })
      expect(result.error).toBeTruthy()
      expect(fetch).not.toHaveBeenCalled()
    }
  )
  it('normalizes a copy of raw criteria without mutating the input object', () => {
    const raw = { surface: '65,5', ges: '>0,0000001' }
    expect(normalizeNumericCriteria(raw, ['surface', 'ges'])).toEqual({ surface: 65.5, ges: '>0.0000001' })
    expect(raw).toEqual({ surface: '65,5', ges: '>0,0000001' })
  })
})

describe('modern query and scoring contract', () => {
  it('sends exact decimal energy/GES and a centred ±1 m² surface window', async () => {
    vi.spyOn(builder, 'executerRechercheFuzzy').mockResolvedValue([])
    await builder.executerRecherche(request, coords)
    expect(queries()[0]).toContain('surface_habitable_logement:[64.5 TO 66.5]')
    expect(queries()[0]).toContain('conso_5_usages_par_m2_ep:173.5')
    expect(queries()[0]).toContain('emission_ges_5_usages_par_m2:6.5')
    expect(queries()[1]).toContain('surface_habitable_logement:[55.675 TO 75.325]')
    expect(queries()[1]).toContain('conso_5_usages_par_m2_ep:[164.825 TO 182.175]')
    expect(queries()[2]).toContain('surface_habitable_logement:[42.575 TO 88.425]')
  })
  it('keeps the plain integer strict query unchanged', async () => {
    vi.spyOn(builder, 'executerRechercheFuzzy').mockResolvedValue([])
    await builder.executerRecherche(
      { ...request, surfaceHabitable: 65, consommationEnergie: 173, emissionGES: 6 },
      coords
    )
    expect(queries()[0]).toBe(
      '(code_postal_ban:"75001" OR code_postal_brut:"75001") AND conso_5_usages_par_m2_ep:173 AND emission_ges_5_usages_par_m2:6 AND surface_habitable_logement:[64 TO 66]'
    )
    expect(queries()[1]).toContain('conso_5_usages_par_m2_ep:[164 TO 182]')
    expect(queries()[1]).toContain('surface_habitable_logement:[55 TO 75]')
  })
  it.each(['<', '>'])(
    'keeps %s fractional boundaries at strict, expanded, regional and fuzzy stages',
    async operator => {
      await builder.executerRecherche(
        {
          ...request,
          surfaceHabitable: `${operator}65,5`,
          consommationEnergie: `${operator}173.5`,
          emissionGES: `${operator}6,5`
        },
        coords
      )
      expect(queries()).toHaveLength(4)
      for (const query of queries()) {
        for (const [field, value] of [
          ['surface_habitable_logement', 65.5],
          ['conso_5_usages_par_m2_ep', 173.5],
          ['emission_ges_5_usages_par_m2', 6.5]
        ]) {
          expect(query).toContain(buildNumericQuery({ operator, value }, field))
        }
        expect(query).not.toContain('NaN')
      }
    }
  )
  it('retains fuzzy percentage variations without rounding fractions into integers', async () => {
    await builder.executerRechercheFuzzy(request, coords)
    expect(queries()[0]).toContain('conso_5_usages_par_m2_ep:156.15')
    expect(queries()[0]).toContain('emission_ges_5_usages_par_m2:5.2')
    expect(queries().some(query => query.includes('conso_5_usages_par_m2_ep:173.5'))).toBe(true)
  })
  it('scores the actual 65.5 / 173.5 / 6.5 criteria, never 65 or 655', async () => {
    const scoreSpy = vi.spyOn(scoring, '_calculateValueBasedScore')
    expect(await scoring.calculateMatchScore(modernRow(), request)).toBe(100)
    expect(scoreSpy.mock.calls[0][2]).toEqual({ operator: '=', value: 65.5 })
    expect(await scoring.calculateMatchScore(modernRow(), { ...request, consommationEnergie: 173 })).toBeLessThan(100)
    expect(await scoring.calculateMatchScore(modernRow(), { ...request, surfaceHabitable: 655 })).toBeLessThan(100)
  })
})

describe('legacy query and scoring contract', () => {
  it('uses exact fractional filters and keeps the legacy ±1% / 15% / 35% tolerances', async () => {
    const execute = vi.spyOn(legacy, 'executeQuery').mockResolvedValue([])
    await legacy.searchLegacy({ ...request, surfaceHabitable: '65,5' })
    const qs = execute.mock.calls.map(([query]) => query)
    expect(qs[0]).toContain('surface_thermique_lot:[64.845 TO 66.155]')
    expect(qs[0]).toContain('consommation_energie:173.5')
    expect(qs[0]).toContain('estimation_ges:6.5')
    expect(qs[1]).toContain('surface_thermique_lot:[55.675 TO 75.325]')
    expect(qs[2]).toContain('surface_thermique_lot:[42.575 TO 88.425]')
  })
  it.each(['<', '>'])('preserves %s fractional boundaries through all legacy fallback queries', async operator => {
    const execute = vi.spyOn(legacy, 'executeQuery').mockResolvedValue([])
    await legacy.searchLegacy({
      ...request,
      surfaceHabitable: `${operator}65,5`,
      consommationEnergie: `${operator}173.5`,
      emissionGES: `${operator}6.5`
    })
    expect(execute).toHaveBeenCalledTimes(3)
    for (const [query] of execute.mock.calls) {
      for (const [field, value] of [
        ['surface_thermique_lot', 65.5],
        ['consommation_energie', 173.5],
        ['estimation_ges', 6.5]
      ]) {
        expect(query).toContain(buildNumericQuery({ operator, value }, field))
      }
      expect(query).not.toContain('NaN')
    }
  })
  it('scores decimal text and number requests consistently', () => {
    expect(legacy.calculateMatchScore(legacyRow(), request)).toBe(100)
    expect(
      legacy.calculateMatchScore(legacyRow(), {
        ...request,
        surfaceHabitable: '65,5',
        consommationEnergie: '173,5',
        emissionGES: '6.5'
      })
    ).toBe(100)
    expect(legacy.calculateMatchScore(legacyRow(), { ...request, consommationEnergie: 173 })).toBeLessThan(100)
    expect(legacy.getMatchReasons(legacyRow(), request)).toContain('Surface: 65.5m² (écart: 0%)')
  })
})

describe('nearby exact-address and radius fractional contract', () => {
  it('retains fractions in both queries and computes the surface score from 65.5', async () => {
    fetch.mockResolvedValue(response([modernRow({ surface_habitable_logement: 68.76 })]))
    const result = await searchRecentDPE({
      address: 'Paris',
      monthsBack: 1,
      radius: 1,
      surface: '65,5',
      consommation: '173,5',
      ges: '6.5'
    })
    expect(queries()).toHaveLength(2)
    for (const query of queries()) {
      expect(query).toContain('surface_habitable_logement:[64.5 TO 66.5]')
      expect(query).toContain('conso_5_usages_par_m2_ep:173.5')
      expect(query).toContain('emission_ges_5_usages_par_m2:6.5')
    }
    // 68.76 is <5% from 65.5, but >5% from truncated 65: score verifies the reference.
    expect(result.results[0]._matchScore).toBe(120)
  })
  it.each(['<', '>'])('uses the same inclusive %s boundary for address and radius', async operator => {
    await searchRecentDPE({
      address: 'Paris',
      monthsBack: 1,
      radius: 1,
      surface: `${operator}65,5`,
      consommation: `${operator}173.5`,
      ges: `${operator}6.5`
    })
    for (const query of queries())
      expect(query).toContain(buildNumericQuery({ operator, value: 65.5 }, 'surface_habitable_logement'))
  })
  it('sends a very small decimal without exponent truncation or unit coercion', async () => {
    await searchRecentDPE({ address: 'Paris', monthsBack: 1, radius: 1, ges: '0,0000001' })
    for (const query of queries()) expect(query).toContain('emission_ges_5_usages_par_m2:0.0000001')
  })
})

describe('explicit zero GES is distinct from absent GES', () => {
  it.each([0, '0', '0.0', '0,0'])(
    'preserves %s as an exact zero filter in modern, legacy and nearby queries',
    async raw => {
      expect(parseSearchComparison(raw)).toEqual({ operator: '=', value: 0 })
      vi.spyOn(builder, 'executerRechercheFuzzy').mockResolvedValue([])
      await builder.executerRecherche({ ...request, emissionGES: raw }, coords)
      expect(queries()[0]).toContain('emission_ges_5_usages_par_m2:0')
      expect(queries()[1]).toContain('emission_ges_5_usages_par_m2:[0 TO 0]')
      const execute = vi.spyOn(legacy, 'executeQuery').mockResolvedValue([])
      await legacy.searchLegacy({ ...request, emissionGES: raw })
      expect(execute.mock.calls[0][0]).toContain('estimation_ges:0')
      expect(execute.mock.calls[1][0]).toContain('estimation_ges:[0 TO 0]')
      fetch.mockClear()
      await searchRecentDPE({ address: 'Paris', monthsBack: 1, radius: 1, ges: raw })
      for (const query of queries()) expect(query).toContain('emission_ges_5_usages_par_m2:0')
    }
  )
  it.each([null, '', undefined])('leaves absent GES %s unfiltered', async raw => {
    vi.spyOn(builder, 'executerRechercheFuzzy').mockResolvedValue([])
    await builder.executerRecherche({ ...request, emissionGES: raw }, coords)
    for (const query of queries()) expect(query).not.toContain('emission_ges_5_usages_par_m2')
    const execute = vi.spyOn(legacy, 'executeQuery').mockResolvedValue([])
    await legacy.searchLegacy({ ...request, emissionGES: raw })
    for (const [query] of execute.mock.calls) expect(query).not.toContain('estimation_ges:')
    fetch.mockClear()
    await searchRecentDPE({ address: 'Paris', monthsBack: 1, radius: 1, ges: raw })
    for (const query of queries()) expect(query).not.toContain('emission_ges_5_usages_par_m2')
  })
  it('uses zero in scoring rather than treating it as a missing criterion', async () => {
    const req = { ...request, emissionGES: 0 }
    expect(await scoring.calculateMatchScore(modernRow({ emission_ges_5_usages_par_m2: 0 }), req)).toBe(100)
    expect(await scoring.calculateMatchScore(modernRow({ emission_ges_5_usages_par_m2: 1 }), req)).toBe(75)
    expect(legacy.calculateMatchScore(legacyRow({ estimation_ges: 0 }), req)).toBe(100)
    expect(legacy.calculateMatchScore(legacyRow({ estimation_ges: 1 }), req)).toBe(75)
    expect(await scoring.getMatchReasons(modernRow({ emission_ges_5_usages_par_m2: 0 }), req)).toContain(
      'GES exact: 0 kgCO²/m²/an'
    )
  })
  it('retains an explicit GES comparison when energy class is selected', async () => {
    vi.spyOn(builder, 'executerRechercheFuzzy').mockResolvedValue([])
    const req = { ...request, consommationEnergie: null, energyClass: 'C', emissionGES: '<0.5' }
    await builder.executerRecherche(req, coords)
    for (const query of queries()) expect(query).toContain('emission_ges_5_usages_par_m2:[0 TO 0.5]')
    const execute = vi.spyOn(legacy, 'executeQuery').mockResolvedValue([])
    await legacy.searchLegacy(req)
    for (const [query] of execute.mock.calls) expect(query).toContain('estimation_ges:[0 TO 0.5]')
  })
})

describe('numeric boundary compatibility and zero comparisons', () => {
  it('normalizes and builds fractional bounds without newer own-property or large-integer APIs', () => {
    const previousOwn = Object.hasOwn
    const previousLargeInteger = globalThis.BigInt
    let normalized
    let percentQuery
    let zeroQuery
    let smallQuery
    try {
      Object.hasOwn = undefined
      globalThis.BigInt = undefined
      // Exercise application code without these browser APIs. Vitest 4's own
      // assertion implementation needs Object.hasOwn, so assert after restoring.
      normalized = normalizeNumericCriteria({ surface: '65,5' }, ['surface'])
      percentQuery = buildNumericQuery({ operator: '=', value: 65.5 }, 'surface', { percent: 15 })
      zeroQuery = buildNumericQuery({ operator: '=', value: 0.5 }, 'surface', { absolute: 1 })
      smallQuery = buildNumericQuery({ operator: '=', value: 0.0000001 }, 'surface', { absolute: 1 })
    } finally {
      Object.hasOwn = previousOwn
      globalThis.BigInt = previousLargeInteger
    }
    expect(normalized).toEqual({ surface: 65.5 })
    expect(percentQuery).toBe('surface:[55.675 TO 75.325]')
    expect(zeroQuery).toBe('surface:[-0.5 TO 1.5]')
    expect(smallQuery).toBe('surface:[-0.9999999 TO 1.0000001]')
  })
  it.each(['<', '>'])('retains explicit %s0 boundaries rather than omitting numeric filters', async operator => {
    await builder.executerRecherche(
      {
        commune: '75001',
        surfaceHabitable: `${operator}0`,
        consommationEnergie: `${operator}0`,
        emissionGES: `${operator}0`
      },
      coords
    )
    for (const query of queries()) {
      expect(query).toContain(buildNumericQuery({ operator, value: 0 }, 'surface_habitable_logement'))
      expect(query).toContain(buildNumericQuery({ operator, value: 0 }, 'conso_5_usages_par_m2_ep'))
    }
    const execute = vi.spyOn(legacy, 'executeQuery').mockResolvedValue([])
    await legacy.searchLegacy({
      commune: '75001',
      surfaceHabitable: `${operator}0`,
      consommationEnergie: `${operator}0`
    })
    for (const [query] of execute.mock.calls)
      expect(query).toContain(buildNumericQuery({ operator, value: 0 }, 'surface_thermique_lot'))
    fetch.mockClear()
    await searchRecentDPE({
      address: 'Paris',
      monthsBack: 1,
      radius: 1,
      surface: `${operator}0`,
      consommation: `${operator}0`
    })
    for (const query of queries())
      expect(query).toContain(buildNumericQuery({ operator, value: 0 }, 'surface_habitable_logement'))
  })
})
