import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { projectDepartment } from '../../../scripts/geography/runtime-data.mjs'
import postcodeIndex from '../../data/geography/postcode-departments.json'
import DPELegacyService from '../../services/dpe-legacy.service.js'
import { getCommuneCoordinates } from '../utilsGeo.js'

const source = new Map()
const loadSource = async department => {
  if (!source.has(department)) {
    source.set(department, JSON.parse(readFileSync(`public/data/departments/communes-dept-${department}.json`)))
  }
  return source.get(department)
}
const loadProjected = async department => projectDepartment(await loadSource(department))

afterEach(() => vi.unstubAllGlobals())

describe('projected geography consumer parity', () => {
  it('returns exactly the same area for all 6,310 indexed postcodes without an external request', async () => {
    const request = vi.fn(() => {
      throw new Error('Unexpected network request')
    })
    vi.stubGlobal('fetch', request)
    for (const postcode of Object.keys(postcodeIndex)) {
      expect(await getCommuneCoordinates(postcode, loadProjected), postcode).toEqual(
        await getCommuneCoordinates(postcode, loadSource)
      )
    }
    expect(request).not.toHaveBeenCalled()
  }, 30000)

  it.each(['01200', '01410', '13780', '20000', '20200', '97133', '97150', '98800', 'Évry-Courcouronnes'])(
    'preserves coordinate and legacy INSEE results for %s',
    async input => {
      expect(await getCommuneCoordinates(input, loadProjected)).toEqual(await getCommuneCoordinates(input, loadSource))
      const raw = new DPELegacyService()
      const projected = new DPELegacyService()
      raw.loadDepartment = loadSource
      projected.loadDepartment = loadProjected
      expect(await projected.getINSEECodes(input)).toEqual(await raw.getINSEECodes(input))
    }
  )

  it('preserves homonym rejection and refuses an incomplete cross-department area', async () => {
    await expect(getCommuneCoordinates('saint denis', loadProjected)).rejects.toMatchObject({
      code: 'AMBIGUOUS_COMMUNE'
    })
    expect(
      await getCommuneCoordinates('01200', department => (department === '74' ? null : loadProjected(department)))
    ).toBeNull()
  })
})
