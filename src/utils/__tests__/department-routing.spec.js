import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import nameIndex from '../../data/geography/commune-name-departments.json'
import postcodeIndex from '../../data/geography/postcode-departments.json'
import manifest from '../../data/geography/source-manifest.json'
import DPELegacyService from '../../services/dpe-legacy.service.js'
import DPESearchService from '../../services/dpe-search.service.js'
import {
  getDepartmentsFromCommuneName,
  getDepartmentsFromPostalCode,
  normalizeCommuneName
} from '../communeDirectory.js'
import {
  getResultsDepartment,
  isValidDepartmentAverages,
  loadDepartmentAveragesForResults
} from '../departmentAverages.js'
import { getCommuneCoordinates, getCommuneCoordinatesFromDatabase, getDepartmentFromPostalCode } from '../utilsGeo.js'

const directory = pathToFileURL(`${resolve(process.cwd(), 'public/data/departments')}/`)
const loadData = department => JSON.parse(readFileSync(new URL(`communes-dept-${department}.json`, directory), 'utf8'))
const sourceFiles = readdirSync(directory).filter(file => file.startsWith('communes-dept-'))
const sourceData = sourceFiles.map(file => JSON.parse(readFileSync(new URL(file, directory), 'utf8')))

function createService() {
  const service = new DPELegacyService()
  vi.spyOn(service, 'loadDepartment').mockImplementation(async department => loadData(department))
  return service
}

describe('source-backed department indexes', () => {
  it('preserves all source bytes and dates, and covers every commune postcode/name', () => {
    for (const [file, expected] of Object.entries(manifest.sourceHashes)) {
      expect(
        createHash('sha256')
          .update(readFileSync(new URL(file, directory)))
          .digest('hex')
      ).toBe(expected)
    }
    const expectedPostcodes = {}
    const expectedNames = {}
    for (const data of sourceData) {
      for (const commune of data.communes) {
        const normalized = normalizeCommuneName(commune.nom)
        expectedNames[normalized] ||= new Set()
        expectedNames[normalized].add(data.departmentCode)
        for (const postcode of commune.codesPostaux) {
          expectedPostcodes[postcode] ||= new Set()
          expectedPostcodes[postcode].add(data.departmentCode)
        }
      }
    }
    const plain = index => Object.fromEntries(Object.entries(index).map(([key, values]) => [key, [...values].sort()]))
    expect(postcodeIndex).toEqual(plain(expectedPostcodes))
    expect(nameIndex).toEqual(plain(expectedNames))
    expect(Object.keys(postcodeIndex)).toHaveLength(6310)
    expect(Object.values(postcodeIndex).filter(departments => departments.length > 1)).toHaveLength(16)
    expect(Object.values(postcodeIndex).flat()).not.toContain('20')
  })

  it.each([
    ['13008', ['13']],
    ['01000', ['01']],
    ['20000', ['2A']],
    ['20200', ['2B']],
    ['97100', ['971']],
    ['97133', ['977']],
    ['97150', ['978']],
    ['98600', ['98']],
    ['98701', ['98']],
    ['98800', ['98']],
    ['01200', ['01', '74']],
    ['01410', ['01', '39']],
    ['13780', ['13', '83']]
  ])('routes %s only to its indexed department(s)', (postcode, departments) => {
    expect(getDepartmentsFromPostalCode(postcode)).toEqual(departments)
    expect(getDepartmentFromPostalCode(postcode)).toBe(departments.length === 1 ? departments[0] : null)
  })

  it.each(['99999', '20199', '20999', '98000', '1300', ' 13008', 13008, null, undefined])(
    'does not fabricate a route for %s',
    value => {
      expect(getDepartmentsFromPostalCode(value)).toEqual([])
      expect(getDepartmentFromPostalCode(value)).toBeNull()
    }
  )

  it('normalizes case, accents, spaces, apostrophes and hyphens without discarding homonyms', async () => {
    expect(await getDepartmentsFromCommuneName(' ÉVRY COURCOURONNES ')).toEqual(['91'])
    expect(await getDepartmentsFromCommuneName('saint denis')).toEqual(['11', '30', '93', '974'])
    expect(await getDepartmentsFromCommuneName('__proto__')).toEqual([])
    expect(await getDepartmentsFromCommuneName('VilleInexistante')).toEqual([])
  })
})

describe('coordinates and legacy queries', () => {
  it('loads every department of a cross-department postcode and retains the full area', async () => {
    const loader = vi.fn(async department => loadData(department))
    const result = await getCommuneCoordinatesFromDatabase('01200', loader)
    expect(loader.mock.calls.map(([department]) => department)).toEqual(['01', '74'])
    expect(result.departments).toEqual(['01', '74'])
    expect(result.isMultiCommune).toBe(true)
    expect(result.communeCount).toBe(
      sourceData.flatMap(data => data.communes).filter(commune => commune.codesPostaux.includes('01200')).length
    )
    expect(result.coverageRadius).toBeGreaterThan(0)
    const incomplete = await getCommuneCoordinatesFromDatabase('01200', async department =>
      department === '01' ? loadData('01') : null
    )
    expect(incomplete).toBeNull()
  })

  it.each(['13008', '20000', '20200', '97133', '97150', '98800'])('loads valid coordinates for %s', async postcode => {
    const loader = vi.fn(async department => loadData(department))
    const result = await getCommuneCoordinatesFromDatabase(postcode, loader)
    expect(result).not.toBeNull()
    expect(Number.isFinite(result.lat)).toBe(true)
    expect(loader).toHaveBeenCalledTimes(1)
    expect(loader).not.toHaveBeenCalledWith('20')
  })

  it('does not choose one location for a homonymous commune name', async () => {
    const loader = vi.fn(async department => loadData(department))
    await expect(getCommuneCoordinates('Saint-Denis', loader)).rejects.toMatchObject({
      code: 'AMBIGUOUS_COMMUNE',
      message: 'Plusieurs communes portent ce nom. Précisez le code postal.'
    })
    expect(loader).not.toHaveBeenCalled()
  })

  it('reports ambiguous names before any ADEME or legacy search rather than hiding modern coverage', async () => {
    const service = new DPESearchService()
    const legacy = vi.spyOn(service.legacyService, 'searchLegacy')
    const fetchFn = vi.fn()
    vi.stubGlobal('fetch', fetchFn)
    await expect(service.search({ commune: 'Saint-Denis' })).rejects.toMatchObject({
      code: 'AMBIGUOUS_COMMUNE',
      message: 'Plusieurs communes portent ce nom. Précisez le code postal.'
    })
    expect(fetchFn).not.toHaveBeenCalled()
    expect(legacy).not.toHaveBeenCalled()
  })

  it('does not treat the combined 98 storage file as an ADEME regional department', async () => {
    const service = createService()
    vi.spyOn(service, 'executeQuery').mockResolvedValue([])
    await service.searchLegacy({ commune: '98800' })
    expect(service.executeQuery).toHaveBeenCalledTimes(2)
    for (const [query] of service.executeQuery.mock.calls) {
      expect(query).not.toContain('tv016_departement_code')
    }
  })

  it('keeps every postcode of a uniquely named commune without geocoder selection', async () => {
    const loader = vi.fn(async department => loadData(department))
    const result = await getCommuneCoordinates('Ajaccio', loader)
    expect(result.allPostalCodes).toEqual(['20000', '20090', '20167'])
    expect(result.communeCode).toBe('2A004')
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('searches all INSEE matches of a shared postcode without a population guess or regional widening', async () => {
    const service = createService()
    const expected = sourceData
      .flatMap(data => data.communes)
      .filter(commune => commune.codesPostaux.includes('01200'))
      .map(commune => commune.code)
      .sort()
    expect((await service.getINSEECodes('01200')).sort()).toEqual(expected)
    vi.spyOn(service, 'executeQuery').mockResolvedValue([])
    await service.searchLegacy({ commune: '01200' })
    expect(service.executeQuery).toHaveBeenCalledTimes(2)
    for (const [query] of service.executeQuery.mock.calls) {
      for (const code of expected) expect(query).toContain(`code_insee_commune_actualise:"${code}"`)
      expect(query).toContain(' OR ')
      expect(query).not.toContain('tv016_departement_code')
    }
  })

  it('finds an accented name using exactly one file and makes no request for an unknown name', async () => {
    const service = createService()
    expect(await service.getINSEECodes('evry courcouronnes')).toEqual(['91228'])
    expect(service.loadDepartment).toHaveBeenCalledTimes(1)
    expect(service.loadDepartment).toHaveBeenCalledWith('91')
    service.loadDepartment.mockClear()
    expect(await service.getINSEECodes('VilleInexistante')).toEqual([])
    expect(service.loadDepartment).not.toHaveBeenCalled()
  })

  it('retains every same-name commune and skips regional expansion for ambiguous names', async () => {
    const service = createService()
    const expected = sourceData
      .flatMap(data => data.communes)
      .filter(commune => normalizeCommuneName(commune.nom) === 'saintdenis')
      .map(commune => commune.code)
      .sort()
    expect((await service.getINSEECodes('Saint-Denis')).sort()).toEqual(expected)
    expect(service.loadDepartment.mock.calls.map(([code]) => code)).toEqual(['11', '30', '93', '974'])
    vi.spyOn(service, 'executeQuery').mockResolvedValue([])
    await service.searchLegacy({ commune: 'Saint-Denis' })
    expect(service.executeQuery).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['97133', '977'],
    ['97150', '978'],
    ['20000', '2A']
  ])('preserves the actual %s department in a regional query', async (postcode, department) => {
    const service = createService()
    vi.spyOn(service, 'executeQuery').mockResolvedValue([])
    await service.searchLegacy({ commune: postcode })
    expect(service.executeQuery.mock.calls[2][0]).toContain(`tv016_departement_code:"${department}"`)
  })
})

describe('optional departmental comparisons', () => {
  const validNow = Date.parse('2025-09-12T00:00:00Z')
  const currentNow = Date.parse('2026-10-02T00:00:00Z')
  const averages = JSON.parse(readFileSync(new URL('dpe-averages-dept-13.json', directory), 'utf8'))

  it('requires all known result locations to agree and never selects the first result arbitrarily', () => {
    expect(getResultsDepartment({ postalCode: '13008', results: [{ codePostal: '13100' }] })).toBe('13')
    expect(getResultsDepartment({ postalCode: '01200' })).toBeNull()
    expect(getResultsDepartment({ results: [{ codePostal: '13008' }, { code_postal_ban: '75001' }] })).toBeNull()
    expect(getResultsDepartment({ results: [{ codePostal: 13008 }] })).toBeNull()
    expect(getResultsDepartment({})).toBeNull()
  })

  it.each(['01200', '20000', '97133', '97150', '99999', '98800'])(
    'does not request a missing, invalid or ambiguous averages file for %s',
    async postcode => {
      const fetchFn = vi.fn()
      expect(await loadDepartmentAveragesForResults({ postalCode: postcode }, fetchFn, validNow)).toBeNull()
      expect(fetchFn).not.toHaveBeenCalled()
    }
  )

  it('skips stale bundled snapshots before any network request', async () => {
    const fetchFn = vi.fn()
    expect(await loadDepartmentAveragesForResults({ postalCode: '13008' }, fetchFn, currentNow)).toBeNull()
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('accepts a dated, populated snapshot only during its supported freshness period', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => averages }))
    expect(await loadDepartmentAveragesForResults({ postalCode: '13008' }, fetchFn, validNow)).toEqual(averages)
    expect(fetchFn).toHaveBeenCalledWith('/data/departments/dpe-averages-dept-13.json')
    expect(isValidDepartmentAverages(averages, '13', currentNow)).toBe(false)
    const updated = Date.parse(averages.updateDate)
    expect(isValidDepartmentAverages(averages, '13', updated + 45 * 86400000)).toBe(true)
    expect(isValidDepartmentAverages(averages, '13', updated + 45 * 86400000 + 1)).toBe(false)
    expect(isValidDepartmentAverages(averages, '13', updated - 1)).toBe(false)
    expect(isValidDepartmentAverages(averages, '83', validNow)).toBe(false)
    expect(isValidDepartmentAverages({ ...averages, updateDate: 'bad-date' }, '13', validNow)).toBe(false)
    expect(isValidDepartmentAverages({ ...averages, overall: { ...averages.overall, count: 0 } }, '13', validNow)).toBe(
      false
    )
    expect(
      isValidDepartmentAverages(
        { ...averages, surfaceRanges: [{ ...averages.surfaceRanges[0], count: 0 }] },
        '13',
        validNow
      )
    ).toBe(false)
  })
})
