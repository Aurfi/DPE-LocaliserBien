import { describe, expect, it } from 'vitest'

describe('DPE Locator Application', () => {
  it('should pass basic smoke test', () => {
    expect(true).toBe(true)
  })

  it('should have correct environment setup', () => {
    expect(import.meta.env.MODE).toBeDefined()
  })

  it('should calculate energy class correctly', () => {
    const getEnergyClass = consumption => {
      if (consumption <= 50) return 'A'
      if (consumption <= 90) return 'B'
      if (consumption <= 150) return 'C'
      if (consumption <= 230) return 'D'
      if (consumption <= 330) return 'E'
      if (consumption <= 450) return 'F'
      return 'G'
    }

    expect(getEnergyClass(45)).toBe('A')
    expect(getEnergyClass(85)).toBe('B')
    expect(getEnergyClass(140)).toBe('C')
    expect(getEnergyClass(220)).toBe('D')
    expect(getEnergyClass(320)).toBe('E')
    expect(getEnergyClass(440)).toBe('F')
    expect(getEnergyClass(500)).toBe('G')
  })

  it('should calculate GES class correctly', () => {
    const getGESClass = emission => {
      if (emission <= 5) return 'A'
      if (emission <= 10) return 'B'
      if (emission <= 25) return 'C'
      if (emission <= 35) return 'D'
      if (emission <= 55) return 'E'
      if (emission <= 80) return 'F'
      return 'G'
    }

    expect(getGESClass(4)).toBe('A')
    expect(getGESClass(8)).toBe('B')
    expect(getGESClass(20)).toBe('C')
    expect(getGESClass(30)).toBe('D')
    expect(getGESClass(50)).toBe('E')
    expect(getGESClass(75)).toBe('F')
    expect(getGESClass(100)).toBe('G')
  })
})
