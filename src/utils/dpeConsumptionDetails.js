const USAGES = [
  { key: 'conso_chauffage_ep', label: 'Chauffage' },
  { key: 'conso_ecs_ep', label: 'Eau chaude' },
  { key: 'conso_refroidissement_ep', label: 'Climatisation' },
  { key: 'conso_eclairage_ep', label: 'Éclairage' },
  { key: 'conso_auxiliaires_ep', label: 'Auxiliaires (VMC, pompes)' }
]

export function finiteNonNegativeNumber(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !value.trim()) return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

// Use original fields, never consoDetails: service mapping replaces absent
// usages with zero, which cannot establish that all five usages were supplied.
export function getConsumptionBreakdown(property = {}) {
  const source = property?.rawData ?? property ?? {}
  const entries = USAGES.map(usage => ({ ...usage, value: source[usage.key] }))
  const hasUsageData = entries.some(entry => entry.value !== undefined && entry.value !== null && entry.value !== '')
  const values = entries.map(entry => finiteNonNegativeNumber(entry.value))
  const surface = finiteNonNegativeNumber(source.surface_habitable_logement)
  const totalPerM2 = finiteNonNegativeNumber(source.conso_5_usages_par_m2_ep)
  const annualTotal = finiteNonNegativeNumber(source.conso_5_usages_ep)
  const complete = values.every(value => value !== null) && surface > 0 && totalPerM2 !== null
  const sum = values.reduce((total, value) => total + (value ?? 0), 0)

  // A display guard, not a DPE recalculation or certification. Allow only small
  // reporting-rounding differences (0.5 kWh/m²/year and 1 kWh/year). Any larger
  // discrepancy, partial source, or invalid total hides the derived breakdown.
  const annualTotalPresent = source.conso_5_usages_ep != null && source.conso_5_usages_ep !== ''
  const comparable =
    complete &&
    Math.abs(sum / surface - totalPerM2) <= 0.5 &&
    (!annualTotalPresent || (annualTotal !== null && Math.abs(sum - annualTotal) <= 1))

  return { hasUsageData, comparable, entries }
}
