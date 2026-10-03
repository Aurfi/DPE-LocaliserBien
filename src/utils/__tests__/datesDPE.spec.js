import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { formatDpeDate, getDpeAgeDays, getDpeDateCutoff, getDpeDateSortValue, parseDpeDate } from '../datesDPE.js'

const invalidDates = [
  null,
  undefined,
  '',
  ' ',
  0,
  NaN,
  false,
  {},
  [],
  '0',
  '2026',
  '2026-09',
  '2026-2-28',
  'not-a-date',
  '2026-00-01',
  '2026-13-01',
  '2026-01-00',
  '2026-04-31',
  '2026-02-29',
  '1900-02-29',
  '2026-02-30T12:00:00Z',
  '2026-09-28T99:00:00Z'
]

describe('ADEME calendar dates', () => {
  it.each(invalidDates)('keeps an absent, partial or impossible date unknown: %j', value => {
    expect(parseDpeDate(value)).toBeNull()
    expect(formatDpeDate(value)).toBe('')
    expect(getDpeAgeDays(value)).toBeNull()
    expect(getDpeDateSortValue(value)).toBe(0)
  })

  it.each([
    ['2026-09-28', '28 septembre 2026'],
    ['2026-06-04', '4 juin 2026'],
    [' 2024-02-29 ', '29 février 2024'],
    ['2000-02-29', '29 février 2000']
  ])('formats %s as a calendar label', (value, expected) => {
    expect(formatDpeDate(value)).toBe(expected)
    expect(parseDpeDate(value).calendarOnly).toBe(true)
  })

  it('uses calendar days for date-only labels, including DST changes', () => {
    expect(getDpeAgeDays('2026-10-03', new Date(2026, 9, 3, 23, 59))).toBe(0)
    expect(getDpeAgeDays('2026-10-02', new Date(2026, 9, 3, 0, 1))).toBe(1)
    expect(getDpeAgeDays('2026-03-28', new Date(2026, 2, 29, 23, 59))).toBe(1)
    expect(getDpeAgeDays('2026-10-31', new Date(2026, 10, 1, 23, 59))).toBe(1)
    expect(getDpeAgeDays('2026-10-03', new Date(NaN))).toBeNull()
  })

  it('retains real timestamps and their elapsed-time age', () => {
    expect(parseDpeDate('2026-09-28T00:30:00Z').calendarOnly).toBe(false)
    expect(getDpeAgeDays('2026-09-28T00:30:00Z', new Date('2026-09-28T00:31:00Z'))).toBe(1)
    expect(getDpeDateSortValue('2026-09-28T00:30:00+02:00')).toBe(1790548200000)
  })

  it('subtracts calendar months with month-end clamping', () => {
    expect(getDpeDateCutoff(1, new Date(2026, 2, 31, 0, 30))).toBe('2026-02-28')
    expect(getDpeDateCutoff(1, new Date(2024, 2, 31, 23, 30))).toBe('2024-02-29')
    expect(getDpeDateCutoff(3, new Date(2026, 0, 31))).toBe('2025-10-31')
    expect(getDpeDateCutoff(0, new Date(2026, 9, 3))).toBe('2026-10-03')
  })
})

// Isolated Node processes ensure TZ really changes. Literal expected dates below
// must never be derived using the same Date/locale conversion as the application.
describe.each([
  ['UTC', 0, '28 septembre 2026', '28 septembre 2026'],
  ['Europe/Paris', -60, '28 septembre 2026', '29 septembre 2026'],
  ['America/Los_Angeles', 480, '27 septembre 2026', '28 septembre 2026'],
  ['Pacific/Kiritimati', -840, '28 septembre 2026', '29 septembre 2026']
])('date contract in %s', (timezone, winterOffset, earlyTimestamp, lateTimestamp) => {
  it('preserves calendar dates without forcing real timestamps to UTC', () => {
    const source = `
      import { formatDpeDate, getDpeAgeDays, getDpeDateCutoff, getDpeDateSortValue } from './src/utils/datesDPE.js'
      import { formatDate, getDaysAgo } from './src/utils/formateursDPE.js'
      process.stdout.write(JSON.stringify({
        offset: new Date(2026, 0, 1).getTimezoneOffset(),
        full: ['2026-09-28', '2026-06-04', '2024-02-29', '2000-02-29'].map(formatDpeDate),
        shared: formatDate('2026-09-28'),
        timestamps: ['2026-09-28T00:30:00Z', '2026-09-28T23:30:00Z', '2026-09-28T00:30:00'].map(formatDpeDate),
        invalid: ['2026-02-29', '1900-02-29', '2026-04-31', '2026-02-30T12:00:00Z', '0'].map(formatDate),
        invalidAges: ['2026-02-29', '1900-02-29', '2026-04-31', '2026-02-30T12:00:00Z', '0'].map(getDaysAgo),
        ages: [
          getDpeAgeDays('2026-10-03', new Date(2026, 9, 3, 0, 30)),
          getDpeAgeDays('2026-10-03', new Date(2026, 9, 3, 23, 30)),
          getDpeAgeDays('2026-10-02', new Date(2026, 9, 3, 0, 30)),
          getDpeAgeDays('2026-03-28', new Date(2026, 2, 29, 23, 30)),
          getDpeAgeDays('2026-10-31', new Date(2026, 10, 1, 23, 30))
        ],
        cutoffs: [
          getDpeDateCutoff(3, new Date(2026, 9, 3, 0, 30)),
          getDpeDateCutoff(3, new Date(2026, 9, 3, 23, 30)),
          getDpeDateCutoff(1, new Date(2026, 2, 31, 0, 30)),
          getDpeDateCutoff(1, new Date(2024, 2, 31, 23, 30))
        ],
        sorted: ['2026-09-28', '2026-02-30', '2024-02-29', null, '2026-06-04']
          .sort((a, b) => getDpeDateSortValue(b) - getDpeDateSortValue(a))
      }))
    `
    const result = JSON.parse(
      execFileSync(process.execPath, ['--input-type=module', '-e', source], {
        cwd: process.cwd(),
        env: { ...process.env, TZ: timezone },
        encoding: 'utf8'
      })
    )
    expect(result).toEqual({
      offset: winterOffset,
      full: ['28 septembre 2026', '4 juin 2026', '29 février 2024', '29 février 2000'],
      shared: '28 septembre 2026',
      timestamps: [earlyTimestamp, lateTimestamp, '28 septembre 2026'],
      invalid: ['', '', '', '', ''],
      invalidAges: ['', '', '', '', ''],
      ages: [0, 0, 1, 1, 1],
      cutoffs: ['2026-07-03', '2026-07-03', '2026-02-28', '2024-02-29'],
      sorted: ['2026-09-28', '2026-06-04', '2024-02-29', '2026-02-30', null]
    })
  })
})
