import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCommuneCoordinates } from '../utilsGeo.js'

const loadDepartment = async code =>
  JSON.parse(readFileSync(`public/data/departments/communes-dept-${code}.json`, 'utf8'))
const response = features => ({ ok: true, json: async () => ({ features }) })
const saintDenis = {
  geometry: { coordinates: [2.35, 48.93] },
  properties: { postcode: '93200', city: 'Saint-Denis', citycode: '93066', label: 'Saint-Denis' }
}

afterEach(() => vi.unstubAllGlobals())

describe('geocoder fallback does not bypass ambiguity checks', () => {
  it.each(['St Denis', 'Saint-Denis.'])('asks for a postcode for %s', async input => {
    const request = vi.fn(async () => response([saintDenis]))
    vi.stubGlobal('fetch', request)
    await expect(getCommuneCoordinates(input, loadDepartment)).rejects.toMatchObject({ code: 'AMBIGUOUS_COMMUNE' })
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('allows a clearly qualified matching postcode', async () => {
    const request = vi.fn(async () => response([saintDenis]))
    vi.stubGlobal('fetch', request)
    const result = await getCommuneCoordinates('St Denis 93200', loadDepartment)
    expect(result.postalCode).toBe('93200')
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('does not resolve again after an empty first response', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(response([]))
      .mockResolvedValue(response([saintDenis]))
    vi.stubGlobal('fetch', request)
    expect(await getCommuneCoordinates('Unlisted place', loadDepartment)).toBeNull()
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('works when Object.hasOwn is absent', async () => {
    const department = await loadDepartment('13')
    const previous = Object.hasOwn
    try {
      Object.hasOwn = undefined
      const result = await getCommuneCoordinates('13008', async () => department)
      expect(result).not.toBeNull()
    } finally {
      Object.hasOwn = previous
    }
  })
})
