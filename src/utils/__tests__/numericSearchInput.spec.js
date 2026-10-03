import { describe, expect, it } from 'vitest'
import { numericSearchInputError, parseNumericSearchInput } from '../numericSearchInput.js'

describe('validated decimal search input contract', () => {
  it.each([null, undefined, '', '   '])('recognizes optional empty input %s', value => {
    expect(parseNumericSearchInput(value)).toMatchObject({ empty: true, error: null, value: null })
    expect(numericSearchInputError(value)).toBe(null)
    expect(numericSearchInputError(value, { requiredMessage: 'Requis' })).toBe('Requis')
  })

  it.each([
    ['65', 65],
    [65, 65],
    ['00065', 65],
    [' 65 ', 65],
    ['<65', '<65'],
    ['>65', '>65'],
    [' < 65 ', '<65'],
    ['> 65', '>65'],
    ['0', 0],
    ['<0', '<0'],
    ['<65,5', '<65.5'],
    ['> 65.5', '>65.5'],
    ['00065,500', 65.5],
    ['0.0000001', 0.0000001]
  ])('accepts %s without changing its numeric meaning', (raw, expected) => {
    expect(parseNumericSearchInput(raw)).toMatchObject({ empty: false, error: null, value: expected })
  })

  it.each(['65,5', '65.5', 65.5])('preserves decimals %s without truncation', raw => {
    expect(parseNumericSearchInput(raw)).toMatchObject({ empty: false, error: null, value: 65.5, number: 65.5 })
  })

  it.each(['65,', '65.', '<65,', '>65.', '65.5.5', '65,5,5', '65,5.5'])(
    'rejects incomplete or mixed decimal syntax %s',
    raw => {
      expect(parseNumericSearchInput(raw).value).toBe(null)
      expect(numericSearchInputError(raw)).toBeTruthy()
    }
  )

  it.each(['65.50000000000000001', '0.10000000000000001'])('rejects %s rather than losing user digits', raw => {
    expect(parseNumericSearchInput(raw).value).toBe(null)
    expect(numericSearchInputError(raw)).toContain('trop précise')
  })

  it.each([
    'abc',
    '65 m²',
    '1e3',
    '-65',
    '+65',
    '1 000',
    '<',
    '>',
    '<<65',
    '>65<',
    '6<5',
    '<>65',
    '<=65',
    '65/5',
    'NaN',
    Infinity,
    '9007199254740992'
  ])('rejects malformed or unsafe input %s', raw => {
    expect(parseNumericSearchInput(raw).value).toBe(null)
    expect(numericSearchInputError(raw)).toBeTruthy()
  })

  it('preserves existing minimum rules without disabling valid comparisons', () => {
    const options = { minimum: 10, minimumMessage: 'Minimum 10' }
    expect(numericSearchInputError('5', options)).toBe('Minimum 10')
    expect(numericSearchInputError('10', options)).toBe(null)
    expect(numericSearchInputError('<5', options)).toBe(null)
    expect(numericSearchInputError('>5', options)).toBe(null)
  })
})
