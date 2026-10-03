const FORMAT_ERROR = 'Saisissez un nombre (ex. 65,5 ou 65.5), éventuellement précédé de < ou >, sans unité.'

// Plain decimal text for API queries; scientific notation is not accepted in user text.
export function decimalText(value) {
  const [mantissa, exponentText] = String(value).split(/[eE]/)
  if (!exponentText) return mantissa
  const negative = mantissa.startsWith('-')
  const unsigned = negative ? mantissa.slice(1) : mantissa
  const [whole, fraction = ''] = unsigned.split('.')
  const digits = whole + fraction
  const point = whole.length + Number(exponentText)
  const expanded =
    point <= 0
      ? `0.${'0'.repeat(-point)}${digits}`
      : point >= digits.length
        ? digits + '0'.repeat(point - digits.length)
        : `${digits.slice(0, point)}.${digits.slice(point)}`
  return negative ? `-${expanded}` : expanded
}

function canonicalDecimal(text) {
  const [whole, fraction = ''] = text.replace(',', '.').split('.')
  const cleanWhole = whole.replace(/^0+(?=\d)/, '')
  const cleanFraction = fraction.replace(/0+$/, '')
  return cleanFraction ? `${cleanWhole}.${cleanFraction}` : cleanWhole
}

export function parseNumericSearchInput(rawValue) {
  const text = rawValue == null ? '' : typeof rawValue === 'number' ? decimalText(rawValue) : String(rawValue).trim()
  if (!text) return { empty: true, error: null, value: null, number: null, operator: null }
  const invalid = error => ({ empty: false, error, value: null, number: null, operator: null })
  const match = /^([<>]?)\s*(\d+(?:[.,]\d+)?)$/.exec(text)
  if (!match) return invalid(FORMAT_ERROR)
  const canonical = canonicalDecimal(match[2])
  const number = Number(canonical)
  if (!Number.isFinite(number) || number > Number.MAX_SAFE_INTEGER) {
    return invalid('Ce nombre est trop grand. Vérifiez la valeur saisie.')
  }
  // Reject precision loss instead of silently rounding/truncating pasted digits.
  if (canonicalDecimal(decimalText(number)) !== canonical) {
    return invalid('Cette valeur est trop précise pour être utilisée sans arrondi. Vérifiez les chiffres saisis.')
  }
  return {
    empty: false,
    error: null,
    value: match[1] ? `${match[1]}${canonical}` : number,
    number,
    operator: match[1] || '='
  }
}

export function numericSearchInputError(rawValue, { requiredMessage = null, minimum = 0, minimumMessage = null } = {}) {
  const parsed = parseNumericSearchInput(rawValue)
  if (parsed.error) return parsed.error
  if (parsed.empty) return requiredMessage
  if (parsed.operator === '=' && parsed.number < minimum) return minimumMessage
  return null
}

export function parseSearchComparison(value) {
  if (value === null || value === undefined || value === '' || value === false) return null
  const parsed = parseNumericSearchInput(value)
  return parsed.empty || parsed.error ? null : { operator: parsed.operator, value: parsed.number }
}

export function normalizeNumericCriteria(criteria, fields) {
  const normalized = { ...criteria }
  for (const field of fields) {
    // biome-ignore lint/suspicious/noPrototypeBuiltins: Preserve the candidate's existing browser support without Object.hasOwn.
    if (!Object.prototype.hasOwnProperty.call(normalized, field)) continue
    const parsed = parseNumericSearchInput(normalized[field])
    if (parsed.error) {
      const error = new Error(parsed.error)
      error.code = 'INVALID_NUMERIC_INPUT'
      throw error
    }
    normalized[field] = parsed.value
  }
  return normalized
}

function decimalParts(value) {
  const [whole, fraction = ''] = decimalText(value).split('.')
  return { digits: whole + fraction, places: fraction.length }
}

function formatDigits(digits, places, negative = false) {
  const padded = '0'.repeat(Math.max(0, places + 1 - digits.length)) + digits
  const text = places ? `${padded.slice(0, -places)}.${padded.slice(-places)}` : padded
  return `${negative ? '-' : ''}${canonicalDecimal(text)}`
}

// Small-integer decimal arithmetic avoids both binary rounding tails and newer
// runtime APIs. Each operation works on individual digits, not a large integer.
function multiplyDigits(digits, multiplier) {
  let carry = 0
  let result = ''
  for (let index = digits.length - 1; index >= 0; index--) {
    const product = Number(digits[index]) * multiplier + carry
    result = String(product % 10) + result
    carry = Math.floor(product / 10)
  }
  return (carry ? String(carry) : '') + result
}

function combineDigits(left, right, subtract = false) {
  const size = Math.max(left.length, right.length)
  left = '0'.repeat(size - left.length) + left
  right = '0'.repeat(size - right.length) + right
  let carry = 0
  let result = ''
  for (let index = size - 1; index >= 0; index--) {
    const value = Number(left[index]) + (subtract ? -Number(right[index]) : Number(right[index])) + carry
    result = String((value + 10) % 10) + result
    carry = subtract ? (value < 0 ? -1 : 0) : Math.floor(value / 10)
  }
  return (carry > 0 ? String(carry) : '') + result
}

// Keep existing rounded bounds for integer requests. Fractional requests retain
// the same percentage tolerance around the actual value, with exact decimal math.
export function percentageBound(value, percent) {
  if (Number.isInteger(value)) return Math.round(value * (percent / 100))
  const { digits, places } = decimalParts(value)
  return formatDigits(multiplyDigits(digits, percent), places + 2)
}

function offsetBound(value, offset) {
  const { digits, places } = decimalParts(value)
  const offsetDigits = String(Math.abs(offset)) + '0'.repeat(places)
  if (offset >= 0) return formatDigits(combineDigits(digits, offsetDigits), places)
  const left = digits.replace(/^0+(?=\d)/, '')
  const right = offsetDigits.replace(/^0+(?=\d)/, '')
  const negative = left.length < right.length || (left.length === right.length && left < right)
  return formatDigits(negative ? combineDigits(right, left, true) : combineDigits(left, right, true), places, negative)
}

export function buildNumericQuery(comparison, field, { percent = null, absolute = null } = {}) {
  if (!comparison) return null
  const { operator, value } = comparison
  // Existing < / > syntax is inclusive: preserve the exact boundary at every stage.
  if (operator === '<') return `${field}:[0 TO ${decimalText(value)}]`
  if (operator === '>') return `${field}:[${decimalText(value)} TO 9999]`
  if (absolute !== null) return `${field}:[${offsetBound(value, -absolute)} TO ${offsetBound(value, absolute)}]`
  if (percent !== null)
    return `${field}:[${percentageBound(value, 100 - percent)} TO ${percentageBound(value, 100 + percent)}]`
  return `${field}:${decimalText(value)}`
}

export function matchesNumericBoundary(actual, comparison) {
  if (!comparison || comparison.operator === '=') return true
  if (actual == null || !Number.isFinite(Number(actual))) return false
  return comparison.operator === '<' ? Number(actual) <= comparison.value : Number(actual) >= comparison.value
}
