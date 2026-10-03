import { describe, expect, it } from 'vitest'
import { navigationScroll } from '../navigationScroll.js'

describe('information-page scrolling', () => {
  it('preserves the browser back/forward position before any anchor', () => {
    const saved = { left: 0, top: 650 }
    expect(navigationScroll({ hash: '#resultats' }, {}, saved)).toBe(saved)
  })

  it.each(['#resultats', '#vie-privee'])('lands on the linked section %s', hash => {
    expect(navigationScroll({ hash }, {}, null)).toEqual({ el: hash })
  })

  it.each(['', '#', '#[invalid', '#two words'])('uses the top for a missing or invalid section %s', hash => {
    expect(navigationScroll({ hash }, {}, null)).toEqual({ top: 0 })
  })
})
