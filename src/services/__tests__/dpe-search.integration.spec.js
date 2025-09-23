import { describe, expect, it } from 'vitest'

describe('DPE Search Integration Tests - REAL API', () => {
  describe('Complete Search Flow with REAL ADEME API', () => {
    it('should successfully search for properties in Paris using real API', async () => {
      // Import the actual service
      const { searchDPE } = await import('../dpe-search.service.js')

      const searchParams = {
        postalCode: '75001',
        commune: 'Paris',
        surface: 50,
        surfaceRange: 20, // Search for 30-70m²
        yearBuilt: null,
        energyClass: null
      }

      // Make real API call
      const results = await searchDPE(searchParams)

      // Validate response structure
      expect(results).toBeDefined()
      expect(results.results).toBeDefined()
      expect(Array.isArray(results.results)).toBe(true)
      expect(results.total).toBeDefined()
      expect(typeof results.total).toBe('number')

      // If we have results, validate their structure
      if (results.results.length > 0) {
        const firstResult = results.results[0]

        // Check required fields exist
        expect(firstResult).toHaveProperty('identifiant__dpe')
        expect(firstResult).toHaveProperty('code_postal__ban')
        expect(firstResult).toHaveProperty('surface_habitable')
        expect(firstResult).toHaveProperty('consommation_energie')
        expect(firstResult).toHaveProperty('classe_energie')

        // Validate data types
        expect(typeof firstResult.surface_habitable).toBe('number')
        expect(typeof firstResult.consommation_energie).toBe('number')

        // Check that results match our search criteria
        expect(firstResult.code_postal__ban).toBe('75001')

        // Surface should be within our range (30-70m²)
        expect(firstResult.surface_habitable).toBeGreaterThanOrEqual(30)
        expect(firstResult.surface_habitable).toBeLessThanOrEqual(70)
      }
    }, 15000) // Increase timeout for real API call

    it('should search for properties in Aix-en-Provence with specific criteria', async () => {
      const { searchDPE } = await import('../dpe-search.service.js')

      const searchParams = {
        postalCode: '13100',
        commune: 'Aix-en-Provence',
        surface: 100,
        surfaceRange: 15, // 85-115m²
        yearBuilt: null,
        energyClass: 'D' // Only class D
      }

      const results = await searchDPE(searchParams)

      expect(results).toBeDefined()
      expect(results.results).toBeDefined()

      // If we have results, they should all be class D and in the right surface range
      if (results.results.length > 0) {
        results.results.forEach(result => {
          expect(result.classe_energie).toBe('D')
          expect(result.surface_habitable).toBeGreaterThanOrEqual(85)
          expect(result.surface_habitable).toBeLessThanOrEqual(115)
          expect(result.code_postal__ban).toBe('13100')
        })
      }
    }, 15000)

    it('should handle search with unlikely criteria (no results expected)', async () => {
      const { searchDPE } = await import('../dpe-search.service.js')

      const searchParams = {
        postalCode: '75001',
        commune: 'Paris',
        surface: 9999, // Extremely large surface
        surfaceRange: 1,
        yearBuilt: null,
        energyClass: null
      }

      const results = await searchDPE(searchParams)

      expect(results).toBeDefined()
      expect(results.results).toBeDefined()
      expect(results.results.length).toBe(0)
      expect(results.total).toBe(0)
    }, 15000)

    it('should search recent DPEs using real API', async () => {
      const { searchRecentDPE } = await import('../recent-dpe.service.js')

      const searchParams = {
        departement: '75',
        limit: 10
      }

      const results = await searchRecentDPE(searchParams)

      expect(results).toBeDefined()
      expect(results.results).toBeDefined()
      expect(Array.isArray(results.results)).toBe(true)

      // Should get up to 10 recent DPEs
      expect(results.results.length).toBeLessThanOrEqual(10)

      if (results.results.length > 0) {
        // Check that results are from department 75
        results.results.forEach(result => {
          expect(result.code_postal__ban).toMatch(/^75/)
        })

        // Check that results have dates
        results.results.forEach(result => {
          expect(result).toHaveProperty('date_etablissement_dpe')
        })
      }
    }, 15000)
  })

  describe('Search Parameter Validation', () => {
    it('should validate required parameters', async () => {
      const { validateSearchParams } = await import('../dpe-search.service.js')

      // Missing postal code
      expect(() =>
        validateSearchParams({
          commune: 'Paris',
          surface: 100
        })
      ).toThrow()

      // Invalid surface
      expect(() =>
        validateSearchParams({
          postalCode: '75001',
          commune: 'Paris',
          surface: -10
        })
      ).toThrow()

      // Valid params
      expect(() =>
        validateSearchParams({
          postalCode: '75001',
          commune: 'Paris',
          surface: 100
        })
      ).not.toThrow()
    })
  })

  describe('Result Scoring and Filtering', () => {
    it('should score results based on matching criteria', async () => {
      const { scoreResults } = await import('../processeur-resultats-dpe.service.js')

      const results = [
        {
          surface_habitable: 100,
          consommation_energie: 150,
          classe_energie: 'C'
        },
        {
          surface_habitable: 95,
          consommation_energie: 200,
          classe_energie: 'D'
        },
        {
          surface_habitable: 105,
          consommation_energie: 120,
          classe_energie: 'B'
        }
      ]

      const searchParams = {
        surface: 100,
        energyClass: 'C'
      }

      const scored = scoreResults(results, searchParams)

      expect(scored[0].matchScore).toBeGreaterThan(scored[1].matchScore)
      expect(scored).toHaveLength(3)
    })
  })

  describe('URL Generation', () => {
    it('should generate correct Google Maps URLs', () => {
      const testCases = [
        {
          input: { address: '760 Chemin de Malouesse, Aix-en-Provence' },
          expected: 'https://www.google.com/maps/search/?api=1&query=760%20Chemin%20de%20Malouesse%2C%20Aix-en-Provence'
        },
        {
          input: { lat: 43.5297, lon: 5.4474 },
          expected: 'https://www.google.com/maps/search/?api=1&query=43.5297,5.4474'
        }
      ]

      testCases.forEach(({ input, expected }) => {
        const url = generateGoogleMapsUrl(input)
        expect(url).toBe(expected)
      })
    })

    it('should generate correct Geoportail URLs', () => {
      const url = generateGeoportailUrl({
        lat: 43.5297,
        lon: 5.4474,
        address: '760 Chemin de Malouesse'
      })

      expect(url).toContain('geoportail.gouv.fr')
      expect(url).toContain('43.5297')
      expect(url).toContain('5.4474')
    })
  })
})

// Helper functions (normally imported from utils)
function generateGoogleMapsUrl({ address, lat, lon }) {
  if (address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
  }
  if (lat && lon) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
  }
  return '#'
}

function generateGeoportailUrl({ lat, lon }) {
  return `https://www.geoportail.gouv.fr/carte?c=${lon},${lat}&z=18&l0=ORTHOIMAGERY.ORTHOPHOTOS::GEOPORTAIL:OGC:WMTS(1)&permalink=yes`
}
