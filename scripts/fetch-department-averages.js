#!/usr/bin/env node

/**
 * Script to fetch and store departmental DPE averages
 * Usage: node fetch-department-averages.js [--test] [--dept=XX]
 * --test: Only fetch for one department (75 by default)
 * --dept=XX: Specify which department to fetch (with --test)
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuration
const SURFACE_RANGES = [
  { label: '15-35m²', min: 15, max: 35 },
  { label: '36-60m²', min: 36, max: 60 },
  { label: '61-90m²', min: 61, max: 90 },
  { label: '91-150m²', min: 91, max: 150 },
  { label: '151-250m²', min: 151, max: 250 },
  { label: '250m²+', min: 251, max: 500 }
]

// Consumption fields to fetch (totals, not per m²)
const CONSUMPTION_FIELDS = [
  { field: 'conso_5_usages_ep', name: 'total' },
  { field: 'conso_chauffage_ep', name: 'chauffage' },
  { field: 'conso_ecs_ep', name: 'eau_chaude' }
]

// GES emissions field
const GES_FIELD = 'emission_ges_5_usages'

// All French departments
const ALL_DEPARTMENTS = [
  '01',
  '02',
  '03',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
  '19',
  '20',
  '21',
  '22',
  '23',
  '24',
  '25',
  '26',
  '27',
  '28',
  '29',
  '30',
  '31',
  '32',
  '33',
  '34',
  '35',
  '36',
  '37',
  '38',
  '39',
  '40',
  '41',
  '42',
  '43',
  '44',
  '45',
  '46',
  '47',
  '48',
  '49',
  '50',
  '51',
  '52',
  '53',
  '54',
  '55',
  '56',
  '57',
  '58',
  '59',
  '60',
  '61',
  '62',
  '63',
  '64',
  '65',
  '66',
  '67',
  '68',
  '69',
  '70',
  '71',
  '72',
  '73',
  '74',
  '75',
  '76',
  '77',
  '78',
  '79',
  '80',
  '81',
  '82',
  '83',
  '84',
  '85',
  '86',
  '87',
  '88',
  '89',
  '90',
  '91',
  '92',
  '93',
  '94',
  '95',
  '971',
  '972',
  '973',
  '974',
  '976' // DOM-TOM
]

// Parse command line arguments
const args = process.argv.slice(2)
const isTest = args.includes('--test')
const deptArg = args.find(arg => arg.startsWith('--dept='))
const testDept = deptArg ? deptArg.split('=')[1] : '75'

// Departments to process
const DEPARTMENTS = isTest ? [testDept] : ALL_DEPARTMENTS

// Output directory
const OUTPUT_DIR = path.join(__dirname, '..', 'dist', 'data', 'departments')

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

// Calculate date 3 years ago
const threeYearsAgo = new Date()
threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3)
const dateFilter = threeYearsAgo.toISOString().split('T')[0]

// Base URL for ADEME API
const BASE_URL = 'https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/metric_agg'

/**
 * Fetch a single metric from the API
 */
async function fetchMetric(dept, surfaceMin, surfaceMax, field, metric = 'sum', withACFilter = false) {
  let queryString = `code_departement_ban:${dept} AND surface_habitable_logement:[${surfaceMin} TO ${surfaceMax}] AND date_etablissement_dpe:[${dateFilter} TO *]`

  // Add AC filter if requested
  if (withACFilter) {
    queryString += ' AND conso_refroidissement_ep:>0'
  }

  const params = new URLSearchParams({
    metric: metric,
    field: field,
    qs: queryString
  })

  const url = `${BASE_URL}?${params}`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }
    const data = await response.json()
    return {
      value: data.metric || data.total || 0,
      count: data.total || 0
    }
  } catch (_error) {
    return null
  }
}

/**
 * Fetch all metrics for a surface range
 */
async function fetchSurfaceRangeData(dept, range) {
  // Fetch metrics sequentially with delays to respect rate limit
  const results = []

  // Fetch total surface (this will also give us the count)
  results.push(await fetchMetric(dept, range.min, range.max, 'surface_habitable_logement', 'sum'))
  await new Promise(resolve => setTimeout(resolve, 25))

  // Fetch consumption fields
  for (const field of CONSUMPTION_FIELDS) {
    results.push(await fetchMetric(dept, range.min, range.max, field.field, 'sum'))
    await new Promise(resolve => setTimeout(resolve, 25))
  }

  // Fetch GES emissions
  results.push(await fetchMetric(dept, range.min, range.max, GES_FIELD, 'sum'))
  await new Promise(resolve => setTimeout(resolve, 25))

  // Fetch surface of properties WITH AC (to get count from total field)
  results.push(await fetchMetric(dept, range.min, range.max, 'surface_habitable_logement', 'sum', true)) // With AC filter
  await new Promise(resolve => setTimeout(resolve, 25))

  // Parse results - count comes from the first request's total field
  const count = results[0]?.count || 0
  const totalSurface = results[0]?.value || 0

  if (count === 0 || totalSurface === 0) {
    return {
      range: range.label,
      count: 0,
      avgSurface: 0,
      consumption: {},
      ges: 0
    }
  }

  // Calculate per m² values
  const consumption = {}
  let index = 1 // Start at 1 since 0 is surface
  for (const field of CONSUMPTION_FIELDS) {
    const totalValue = results[index]?.value || 0
    consumption[field.name] = totalValue > 0 ? Math.round(totalValue / totalSurface) : 0
    index++
  }

  const totalGES = results[index]?.value || 0
  const gesPerM2 = totalGES > 0 ? Math.round(totalGES / totalSurface) : 0

  // Calculate AC percentage (count comes from total field when using sum)
  const acCount = results[index + 1]?.count || 0
  const acPercentage = count > 0 ? Math.round((acCount / count) * 100) : 0

  return {
    range: range.label,
    count: count,
    avgSurface: Math.round(totalSurface / count),
    consumption: consumption,
    ges: gesPerM2,
    acPercentage: acPercentage
  }
}

/**
 * Fetch all data for a department
 */
async function fetchDepartmentData(dept) {
  const departmentData = {
    department: dept,
    updateDate: new Date().toISOString(),
    dateRange: `${dateFilter} to present`,
    surfaceRanges: []
  }

  // Fetch data for each surface range
  for (const range of SURFACE_RANGES) {
    const rangeData = await fetchSurfaceRangeData(dept, range)
    departmentData.surfaceRanges.push(rangeData)

    // Longer delay to avoid rate limiting (200ms between ranges)
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  const allSurfacesData = await fetchSurfaceRangeData(dept, { label: 'all', min: 1, max: 1000 })
  departmentData.overall = allSurfacesData

  return departmentData
}

/**
 * Save department data to file
 */
function saveDepartmentData(dept, data) {
  const filename = path.join(OUTPUT_DIR, `dpe-averages-dept-${dept}.json`)
  fs.writeFileSync(filename, JSON.stringify(data, null, 2))
}

/**
 * Main execution
 */
async function main() {
  if (isTest) {
  } else {
  }

  const startTime = Date.now()

  for (const dept of DEPARTMENTS) {
    try {
      const data = await fetchDepartmentData(dept)
      saveDepartmentData(dept, data)
    } catch (_error) {}

    // Longer delay between departments to avoid rate limiting
    if (!isTest && DEPARTMENTS.indexOf(dept) < DEPARTMENTS.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000)) // 1 second between departments
    }
  }

  const _elapsed = Math.round((Date.now() - startTime) / 1000)

  if (isTest) {
  }
}

// Run the script
main().catch(_error => {
  process.exit(1)
})
