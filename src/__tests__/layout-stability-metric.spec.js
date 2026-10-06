import { describe, expect, it } from 'vitest'
import { largestLayoutShiftSession } from '../../e2e/layout-stability.js'

const shift = (startTime, value, hadRecentInput = false) => ({ startTime, value, hadRecentInput })

describe('load CLS evidence calculation', () => {
  it('returns zero when there are no shifts', () => {
    expect(largestLayoutShiftSession([])).toBe(0)
  })
  it('keeps the largest window instead of summing the lifetime', () => {
    expect(largestLayoutShiftSession([shift(0, 0.2), shift(100, 0.3), shift(2000, 0.4)])).toBe(0.5)
  })
  it('starts a new window at a one-second gap', () => {
    expect(largestLayoutShiftSession([shift(10, 0.3), shift(1010, 0.4)])).toBe(0.4)
  })
  it('starts a new window at five seconds even when adjacent shifts are close', () => {
    const shifts = Array.from({ length: 10 }, (_, index) => shift(index * 500, 0.1))
    expect(largestLayoutShiftSession([...shifts, shift(5000, 0.9)])).toBeCloseTo(1)
  })
  it('excludes recent input without letting it join two otherwise separate windows', () => {
    expect(largestLayoutShiftSession([shift(0, 0.2), shift(800, 9, true), shift(1100, 0.3)])).toBe(0.3)
  })
})
