import { describe, expect, it } from 'vitest'
import { calculateDistance, extractPostalCode } from '../utilsGeo.js'

describe('utilsGeo', () => {
  describe('calculateDistance', () => {
    it('should calculate correct distance between two points', () => {
      // Distance between Paris (48.8566, 2.3522) and Lyon (45.7640, 4.8357)
      // Expected distance: approximately 391.5 km
      const distance = calculateDistance(48.8566, 2.3522, 45.764, 4.8357)
      expect(distance).toBeCloseTo(391.5, 0) // Allow 1km tolerance
    })

    it('should calculate zero distance for same coordinates', () => {
      const distance = calculateDistance(48.8566, 2.3522, 48.8566, 2.3522)
      expect(distance).toBe(0)
    })

    it('should handle NaN coordinates by returning 0', () => {
      expect(calculateDistance(NaN, 2.3522, 45.764, 4.8357)).toBe(0)
      expect(calculateDistance(48.8566, NaN, 45.764, 4.8357)).toBe(0)
      expect(calculateDistance(48.8566, 2.3522, NaN, 4.8357)).toBe(0)
      expect(calculateDistance(48.8566, 2.3522, 45.764, NaN)).toBe(0)
    })

    it('should handle invalid coordinate ranges by returning 0', () => {
      // Invalid latitudes (outside -90 to 90)
      expect(calculateDistance(100, 2.3522, 45.764, 4.8357)).toBe(0)
      expect(calculateDistance(48.8566, 2.3522, -100, 4.8357)).toBe(0)

      // Invalid longitudes (outside -180 to 180)
      expect(calculateDistance(48.8566, 200, 45.764, 4.8357)).toBe(0)
      expect(calculateDistance(48.8566, 2.3522, 45.764, -200)).toBe(0)
    })

    it('should handle edge cases for valid coordinates', () => {
      // Test with maximum valid coordinates
      const distance1 = calculateDistance(90, 180, -90, -180)
      expect(distance1).toBeGreaterThan(0)

      // Test with coordinates at equator
      const distance2 = calculateDistance(0, 0, 0, 1)
      expect(distance2).toBeCloseTo(111.32, 0) // Approximately 111.32 km per degree at equator
    })

    it('should handle string numbers by converting them', () => {
      const distance = calculateDistance('48.8566', '2.3522', '45.7640', '4.8357')
      expect(distance).toBeCloseTo(391.5, 0)
    })

    it('should handle small distances accurately', () => {
      // Distance between two close points in Paris
      // Louvre (48.8606, 2.3376) and Notre Dame (48.8534, 2.3488)
      const distance = calculateDistance(48.8606, 2.3376, 48.8534, 2.3488)
      expect(distance).toBeCloseTo(1.15, 1) // Approximately 1.15km
    })
  })

  describe('extractPostalCode', () => {
    it('should return postal code if input is already a postal code', () => {
      expect(extractPostalCode('75001')).toBe('75001')
      expect(extractPostalCode('13100')).toBe('13100')
      expect(extractPostalCode('69000')).toBe('69000')
    })

    it('should return null for city names', () => {
      expect(extractPostalCode('Paris')).toBe(null)
      expect(extractPostalCode('Marseille')).toBe(null)
      expect(extractPostalCode('Lyon')).toBe(null)
    })

    it('should return null for invalid postal codes', () => {
      expect(extractPostalCode('1234')).toBe(null) // Too short
      expect(extractPostalCode('123456')).toBe(null) // Too long
      expect(extractPostalCode('abcde')).toBe(null) // Not numeric
    })

    it('should handle edge cases', () => {
      expect(extractPostalCode('')).toBe(null)
      expect(extractPostalCode('00000')).toBe('00000') // Valid format but unlikely postal code
    })
  })
})
