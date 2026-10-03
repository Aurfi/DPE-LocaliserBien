import { afterEach, describe, expect, it, vi } from 'vitest'
import ConstructeurRechercheAdeme from '../constructeur-recherche-ademe.service.js'
import DPEScoringService from '../dpe-scoring.service.js'

afterEach(() => vi.unstubAllGlobals())

describe('location boundaries during fallback search', () => {
  it.each(['97133', '97150', '20100', '99999'])(
    'never drops exact postcode %s when geography is unavailable',
    async commune => {
      const request = vi.fn(async () => ({ ok: true, json: async () => ({ results: [] }) }))
      vi.stubGlobal('fetch', request)
      const service = new ConstructeurRechercheAdeme(new DPEScoringService())
      await service.executerRecherche(
        { commune, consommationEnergie: '173', emissionGES: '6', surfaceHabitable: '65' },
        null
      )
      expect(request.mock.calls.length).toBeGreaterThan(1)
      for (const [url] of request.mock.calls) {
        const query = new URL(url).searchParams.get('qs')
        expect(query).toContain(`code_postal_ban:"${commune}"`)
        expect(query).toContain(`code_postal_brut:"${commune}"`)
        expect(query).not.toContain(`code_postal_ban:${commune.slice(0, 2)}*`)
      }
    }
  )

  it('bounds fuzzy searches geographically when a verified centre exists', async () => {
    const request = vi.fn(async () => ({ ok: true, json: async () => ({ results: [] }) }))
    vi.stubGlobal('fetch', request)
    const service = new ConstructeurRechercheAdeme(new DPEScoringService())
    await service.executerRechercheFuzzy(
      { commune: 'Saint-Denis 93200', consommationEnergie: 173 },
      { lat: 48.93, lon: 2.35, postalCode: '93200' }
    )
    expect(request).toHaveBeenCalled()
    for (const [url] of request.mock.calls) {
      const parameters = new URL(url).searchParams
      expect(parameters.get('geo_distance')).toBe('2.35:48.93:25000')
      expect(parameters.get('qs')).not.toContain('code_postal_ban:93*')
    }
  })

  it('does not send a fuzzy search without any location constraint', async () => {
    const request = vi.fn()
    vi.stubGlobal('fetch', request)
    const service = new ConstructeurRechercheAdeme(new DPEScoringService())
    expect(await service.executerRechercheFuzzy({ commune: 'Unknown', consommationEnergie: 173 }, null)).toEqual([])
    expect(request).not.toHaveBeenCalled()
  })
})
