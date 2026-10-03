import snapshots from '../data/geography/averages-snapshots.json'
import { getDepartmentsFromPostalCode, hasOwnKey } from './communeDirectory.js'

// Temporary conservative policy: target a monthly validated refresh, expire comparisons after 45 days.
// Index regeneration never changes source dates. Historical snapshots remain unmodified.
export const MAX_AVERAGES_AGE_MS = 45 * 24 * 60 * 60 * 1000

function isCurrentSnapshot(snapshot, now) {
  const updated = Date.parse(snapshot?.updateDate)
  return Number.isFinite(updated) && updated <= now && now - updated <= MAX_AVERAGES_AGE_MS && snapshot.count > 0
}

/** Every available result postcode must point to the same actual department. */
export function getResultsDepartment(results) {
  const postcodes = [
    results?.postalCode,
    ...(results?.results || []).map(
      result => result.codePostal || result.code_postal_ban || result.code_postal_brut || result.code_postal
    )
  ].filter(value => value !== undefined && value !== null && value !== '')
  if (postcodes.length === 0) return null
  const departments = postcodes.map(postcode => getDepartmentsFromPostalCode(postcode))
  if (departments.some(matches => matches.length !== 1)) return null
  const unique = new Set(departments.flat())
  return unique.size === 1 ? [...unique][0] : null
}

export function isValidDepartmentAverages(data, department, now = Date.now()) {
  const validRange = range =>
    Number.isFinite(range?.count) &&
    range.count > 0 &&
    Number.isFinite(range.avgSurface) &&
    range.avgSurface > 0 &&
    Number.isFinite(range.consumption?.total) &&
    range.consumption.total > 0 &&
    Number.isFinite(range.ges) &&
    range.ges >= 0
  return (
    data?.department === department &&
    isCurrentSnapshot({ updateDate: data.updateDate, count: data.overall?.count }, now) &&
    validRange(data.overall) &&
    Array.isArray(data.surfaceRanges) &&
    data.surfaceRanges.length > 0 &&
    data.surfaceRanges.every(validRange)
  )
}

/** Optional data must never guess a route or display empty/outdated comparisons. */
export async function loadDepartmentAveragesForResults(results, fetchFn = fetch, now = Date.now()) {
  const department = getResultsDepartment(results)
  if (!department || !hasOwnKey(snapshots, department) || !isCurrentSnapshot(snapshots[department], now)) return null
  try {
    const response = await fetchFn(`/data/departments/dpe-averages-dept-${department}.json`)
    if (!response.ok) return null
    const data = await response.json()
    return isValidDepartmentAverages(data, department, now) ? data : null
  } catch (_error) {
    return null
  }
}
