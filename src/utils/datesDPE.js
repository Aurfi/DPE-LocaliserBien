const DAY_MS = 24 * 60 * 60 * 1000
const FULL_DATE_OPTIONS = { day: 'numeric', month: 'long', year: 'numeric' }

// ADEME dates without a time are calendar labels, not UTC instants. Keep a UTC
// representation for validation/arithmetic, and only format these labels in UTC.
function calendarDate(year, month, day) {
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  date.setUTCHours(0, 0, 0, 0)
  return date
}

export function parseDpeDate(value) {
  if (typeof value !== 'string') return null
  const text = value.trim()
  const match = /^(\d{4})-(\d{2})-(\d{2})(T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(text)
  if (!match) return null
  const [, year, month, day, time] = match
  const calendar = calendarDate(Number(year), Number(month), Number(day))
  // Date normally rolls impossible days (e.g. February 30) into the next month.
  if (
    calendar.getUTCFullYear() !== Number(year) ||
    calendar.getUTCMonth() + 1 !== Number(month) ||
    calendar.getUTCDate() !== Number(day)
  ) {
    return null
  }
  const date = time ? new Date(text) : calendar
  return Number.isFinite(date.getTime()) ? { date, calendarOnly: !time } : null
}

export function formatDpeDate(value) {
  const parsed = parseDpeDate(value)
  if (!parsed) return ''
  return parsed.date.toLocaleDateString('fr-FR', {
    ...FULL_DATE_OPTIONS,
    ...(parsed.calendarOnly ? { timeZone: 'UTC' } : {})
  })
}

export function getDpeAgeDays(value, now = new Date()) {
  const parsed = parseDpeDate(value)
  if (!parsed || !Number.isFinite(now.getTime())) return null
  const today = parsed.calendarOnly ? calendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate()) : now
  // Date-only labels use calendar days, avoiding time-of-day and DST off-by-one.
  // Real timestamps retain the existing elapsed-time rounding behavior.
  return Math.ceil(Math.abs(today.getTime() - parsed.date.getTime()) / DAY_MS)
}

export function getDpeDateSortValue(value) {
  // Keep the existing placement of missing dates; invalid dates use the same key.
  return parseDpeDate(value)?.date.getTime() ?? 0
}

export function getDpeDateCutoff(monthsBack, now = new Date()) {
  // The recent-search window is based on the user's local calendar day. Never
  // serialize local midnight as UTC, which can move the cutoff to another day.
  const date = calendarDate(now.getFullYear(), now.getMonth() + 1, 1)
  date.setUTCMonth(date.getUTCMonth() - monthsBack)
  const lastDay = calendarDate(date.getUTCFullYear(), date.getUTCMonth() + 2, 0).getUTCDate()
  date.setUTCDate(Math.min(now.getDate(), lastDay))
  return date.toISOString().slice(0, 10)
}
