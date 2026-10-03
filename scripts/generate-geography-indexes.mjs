/**
 * Rebuild routing indexes from the checked-in snapshot, without changing source data/dates.
 * Run: node scripts/generate-geography-indexes.mjs (or --check for a read-only drift check).
 */
import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { normalizeCommuneName } from '../src/utils/normalizeCommuneName.js'

const source = new URL('../public/data/departments/', import.meta.url)
const destination = new URL('../src/data/geography/', import.meta.url)
const files = (await readdir(source)).sort()
const postcodes = {}
const names = {}
const averages = {}
const sourceHashes = {}
const departments = new Set()

const add = (index, key, department) => {
  if (!Object.hasOwn(index, key)) index[key] = []
  if (!index[key].includes(department)) index[key].push(department)
}
for (const file of files.filter(file => /^communes-dept-.+\.json$/.test(file))) {
  const bytes = await readFile(new URL(file, source))
  const data = JSON.parse(bytes)
  const department = data.departmentCode
  if (typeof department !== 'string' || file !== `communes-dept-${department}.json`) {
    throw new Error(`Invalid department: ${file}`)
  }
  departments.add(department)
  sourceHashes[file] = createHash('sha256').update(bytes).digest('hex')
  for (const commune of data.communes) {
    add(names, normalizeCommuneName(commune.nom), department)
    for (const postcode of commune.codesPostaux || []) {
      if (typeof postcode !== 'string' || !/^\d{5}$/.test(postcode)) throw new Error(`Invalid postcode: ${file}`)
      add(postcodes, postcode, department)
    }
  }
  // Aggregates must agree with the commune-level directory, not invent a route.
  for (const postcode of Object.keys(data.postalCodes)) {
    if (!postcodes[postcode]?.includes(department)) throw new Error(`Missing commune route: ${file}/${postcode}`)
  }
}
for (const file of files.filter(file => /^dpe-averages-dept-.+\.json$/.test(file))) {
  const bytes = await readFile(new URL(file, source))
  const data = JSON.parse(bytes)
  sourceHashes[file] = createHash('sha256').update(bytes).digest('hex')
  if (departments.has(data.department) && file === `dpe-averages-dept-${data.department}.json`) {
    averages[data.department] = { updateDate: data.updateDate, count: data.overall?.count ?? 0 }
  }
}
const sorted = object =>
  Object.fromEntries(
    Object.keys(object)
      .sort()
      .map(key => [key, object[key]])
  )
const outputs = {
  'postcode-departments.json': sorted(postcodes),
  'commune-name-departments.json': sorted(names),
  'averages-snapshots.json': sorted(averages),
  'source-manifest.json': { source: 'public/data/departments', sourceHashes: sorted(sourceHashes) }
}
for (const [file, value] of Object.entries(outputs)) {
  const text = `${JSON.stringify(value)}\n`
  const url = new URL(file, destination)
  if (process.argv.includes('--check')) {
    if ((await readFile(url, 'utf8')) !== text) throw new Error(`Index needs regeneration: ${fileURLToPath(url)}`)
  } else {
    await writeFile(url, text)
  }
}
