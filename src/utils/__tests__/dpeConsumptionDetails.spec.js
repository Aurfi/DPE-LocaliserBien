import { describe, expect, it } from 'vitest'
import { finiteNonNegativeNumber, getConsumptionBreakdown } from '../dpeConsumptionDetails.js'

// Synthetic source values only; no real property or personal address.
const source = (overrides = {}) => ({
  surface_habitable_logement: 50,
  conso_5_usages_par_m2_ep: 100,
  conso_5_usages_ep: 5000,
  conso_chauffage_ep: 3000,
  conso_ecs_ep: 1500,
  conso_refroidissement_ep: 0,
  conso_eclairage_ep: 200,
  conso_auxiliaires_ep: 300,
  ...overrides
})

describe('DPE source usage display guard', () => {
  it('accepts five compatible explicit usages, including an actual zero', () => {
    const raw = source()
    expect(getConsumptionBreakdown(raw)).toMatchObject({ hasUsageData: true, comparable: true })
    expect(getConsumptionBreakdown({ rawData: raw }).entries.map(entry => entry.value)).toEqual([
      3000, 1500, 0, 200, 300
    ])
  })

  it('preserves fractional source values without adjusting the total or components', () => {
    const raw = source({
      conso_chauffage_ep: 3000.125,
      conso_5_usages_ep: 5000.125,
      conso_5_usages_par_m2_ep: 100.0025
    })
    const before = JSON.stringify(raw)
    expect(getConsumptionBreakdown(raw).entries[0].value).toBe(3000.125)
    expect(getConsumptionBreakdown(raw).comparable).toBe(true)
    expect(JSON.stringify(raw)).toBe(before)
  })

  it.each([
    { conso_5_usages_par_m2_ep: 82.6, conso_5_usages_ep: 4130 },
    { conso_5_usages_ep: 4500 },
    { conso_5_usages_ep: 'invalid' },
    { conso_5_usages_par_m2_ep: null },
    { conso_ecs_ep: undefined },
    { conso_refroidissement_ep: null },
    { conso_auxiliaires_ep: -10 },
    { conso_eclairage_ep: Infinity },
    { conso_chauffage_ep: false },
    { surface_habitable_logement: 0 },
    { surface_habitable_logement: null }
  ])('hides an incompatible or incomplete source: %j', overrides => {
    expect(getConsumptionBreakdown(source(overrides))).toMatchObject({ hasUsageData: true, comparable: false })
  })

  it('allows only small source-reporting rounding differences', () => {
    expect(
      getConsumptionBreakdown(source({ conso_5_usages_ep: 5000.8, conso_5_usages_par_m2_ep: 100.4 })).comparable
    ).toBe(true)
    expect(getConsumptionBreakdown(source({ conso_5_usages_ep: 5001.1 })).comparable).toBe(false)
    expect(getConsumptionBreakdown(source({ conso_5_usages_par_m2_ep: 100.6 })).comparable).toBe(false)
  })

  it('can compare with a reported intensity when no annual total is supplied', () => {
    expect(getConsumptionBreakdown(source({ conso_5_usages_ep: undefined })).comparable).toBe(true)
  })

  it('does not mistake service-generated zero defaults for explicit source usages', () => {
    const property = {
      rawData: source({ conso_refroidissement_ep: undefined }),
      consoDetails: { chauffage: 3000, eauChaude: 1500, refroidissement: 0, eclairage: 200, auxiliaires: 300 }
    }
    expect(getConsumptionBreakdown(property).comparable).toBe(false)
    expect(getConsumptionBreakdown({ consoDetails: property.consoDetails }).hasUsageData).toBe(false)
  })

  it.each([{}, null, undefined])('handles missing source data: %j', property => {
    expect(getConsumptionBreakdown(property)).toMatchObject({ hasUsageData: false, comparable: false })
  })
})

describe('finite source energy numbers', () => {
  it.each([null, undefined, '', ' ', false, {}, [], 'bad', NaN, Infinity, -1])(
    'rejects absent or invalid values: %j',
    value => {
      expect(finiteNonNegativeNumber(value)).toBeNull()
    }
  )
  it.each([
    [0, 0],
    ['0', 0],
    ['173.5', 173.5],
    [0.025, 0.025]
  ])('preserves %s', (value, expected) => {
    expect(finiteNonNegativeNumber(value)).toBe(expected)
  })
})
