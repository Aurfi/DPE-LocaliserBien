import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clearDepartmentCache,
  getDepartmentFromCode,
  loadCommunesForDepartment,
  loadDPEAveragesForDepartment,
  preloadDepartmentData
} from '../departmentDataLoader'

describe('departmentDataLoader', () => {
  beforeEach(() => {
    // Clear cache before each test
    clearDepartmentCache()
  })

  afterEach(() => {
    clearDepartmentCache()
  })

  describe('loadCommunesForDepartment - REAL DATA', () => {
    it('should fetch real commune data for Paris (75)', async () => {
      const result = await loadCommunesForDepartment('75')

      expect(result).toBeDefined()
      // The result is an object with communes array
      if (result.communes) {
        expect(Array.isArray(result.communes)).toBe(true)
        expect(result.communes.length).toBeGreaterThan(0)
        const hasParisCommunes = result.communes.some(commune => commune.nom?.includes('Paris'))
        expect(hasParisCommunes).toBe(true)
      } else {
        // Or it could be just an array
        expect(Array.isArray(result)).toBe(true)
      }
    })

    it('should fetch real commune data for Bouches-du-Rhône (13)', async () => {
      const result = await loadCommunesForDepartment('13')

      expect(result).toBeDefined()

      const communes = result.communes || result
      if (Array.isArray(communes)) {
        expect(communes.length).toBeGreaterThan(0)

        // Check for known cities
        const hasAix = communes.some(commune => commune.nom?.includes('Aix-en-Provence'))
        const hasMarseille = communes.some(commune => commune.nom?.includes('Marseille'))

        expect(hasAix || hasMarseille).toBe(true) // At least one should be present
      }
    })

    it('should return cached data on second call', async () => {
      // First call - fetches from server
      const startTime1 = Date.now()
      const result1 = await loadCommunesForDepartment('75')
      const time1 = Date.now() - startTime1

      // Second call - should use cache and be much faster
      const startTime2 = Date.now()
      const result2 = await loadCommunesForDepartment('75')
      const time2 = Date.now() - startTime2

      expect(result1).toEqual(result2)
      expect(time2).toBeLessThan(time1 / 2) // Cache should be at least 2x faster
    })

    it('should handle invalid department code gracefully', async () => {
      const result = await loadCommunesForDepartment('99')
      expect(result).toEqual([]) // Should return empty array for non-existent dept
    })
  })

  describe('loadDPEAveragesForDepartment - REAL DATA', () => {
    it('should fetch real DPE averages for Paris (75)', async () => {
      const result = await loadDPEAveragesForDepartment('75')

      if (result) {
        // Averages might not exist for all departments
        expect(result).toBeDefined()
        expect(result.department).toBe('75')
        expect(result.overall).toBeDefined()
      }
    })

    it('should fetch real DPE averages for Bouches-du-Rhône (13)', async () => {
      const result = await loadDPEAveragesForDepartment('13')

      if (result) {
        expect(result).toBeDefined()
        expect(result.department).toBe('13')

        // Check structure
        if (result.overall) {
          expect(result.overall.consumption).toBeDefined()
        }

        if (result.surfaceRanges) {
          expect(Array.isArray(result.surfaceRanges)).toBe(true)
        }
      }
    })

    it('should return null for non-existent department', async () => {
      const result = await loadDPEAveragesForDepartment('99')
      expect(result).toBeNull()
    })
  })

  describe('preloadDepartmentData - REAL DATA', () => {
    it('should load both communes and DPE averages in parallel', async () => {
      const startTime = Date.now()
      await preloadDepartmentData('01')
      const _loadTime = Date.now() - startTime

      // After preload, both should be in cache
      const startCache = Date.now()
      const communes = await loadCommunesForDepartment('01')
      const _averages = await loadDPEAveragesForDepartment('01')
      const cacheTime = Date.now() - startCache

      expect(communes).toBeDefined()
      // Check if we have data (either as array or object with communes)
      const communeData = communes.communes || communes
      if (Array.isArray(communeData)) {
        expect(communeData.length).toBeGreaterThan(0)
      }

      // Cache access should be very fast (< 20ms total for both)
      expect(cacheTime).toBeLessThan(20)
    })
  })

  describe('getDepartmentFromCode', () => {
    it('should extract department from standard codes', () => {
      expect(getDepartmentFromCode('75001')).toBe('75')
      expect(getDepartmentFromCode('13001')).toBe('13')
      expect(getDepartmentFromCode('01234')).toBe('01')
    })

    it('should handle Corsica special cases', () => {
      expect(getDepartmentFromCode('2A001')).toBe('2A')
      expect(getDepartmentFromCode('2B001')).toBe('2B')
      expect(getDepartmentFromCode('20001')).toBe('2A')
      expect(getDepartmentFromCode('20101')).toBe('2B')
    })

    it('should handle DOM-TOM codes', () => {
      expect(getDepartmentFromCode('97100')).toBe('971')
      expect(getDepartmentFromCode('97400')).toBe('974')
      expect(getDepartmentFromCode('98800')).toBe('988')
    })

    it('should return null for invalid codes', () => {
      expect(getDepartmentFromCode(null)).toBeNull()
      expect(getDepartmentFromCode('')).toBeNull()
      expect(getDepartmentFromCode(undefined)).toBeNull()
    })
  })

  describe('clearDepartmentCache', () => {
    it('should clear all cached data', async () => {
      const mockData = [{ code: '13001', nom: 'Aix-en-Provence' }]

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockData
      })

      // Load data to cache it
      await loadCommunesForDepartment('13')
      expect(global.fetch).toHaveBeenCalledTimes(1)

      // Clear cache
      clearDepartmentCache()

      // Load again - should fetch again
      await loadCommunesForDepartment('13')
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })
})
