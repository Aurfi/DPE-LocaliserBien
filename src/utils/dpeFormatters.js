/**
 * Utility functions for formatting DPE data
 */

/**
 * Extract year from a value that can be a simple year or a range (e.g., "1948-1974")
 */
export function extractYearFromValue(value) {
  if (!value) return null
  const strValue = String(value)
  const match = strValue.match(/(\d{4})/)
  return match ? parseInt(match[1], 10) : null
}

/**
 * Format year display (keep ranges like "1948-1974")
 */
export function formatYearDisplay(value) {
  return value || 'N/A'
}

/**
 * Format date to French locale
 */
export function formatDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

/**
 * Get relative time from date
 */
export function getDaysAgo(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diffTime = Math.abs(now - date)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "aujourd'hui"
  if (diffDays === 1) return 'hier'
  if (diffDays < 7) return `${diffDays} jours`
  if (diffDays < 14) return '1 semaine'
  if (diffDays < 21) return '2 semaines'
  if (diffDays < 30) return '3 semaines'
  if (diffDays < 60) return '1 mois'
  if (diffDays < 90) return '2 mois'

  const totalMonths = Math.floor(diffDays / 30)
  if (totalMonths >= 24) {
    const years = Math.floor(totalMonths / 12)
    const months = totalMonths % 12
    if (months === 0) {
      return `${years} an${years > 1 ? 's' : ''}`
    }
    return `${years} an${years > 1 ? 's' : ''} et ${months} mois`
  }

  return `${totalMonths} mois`
}

/**
 * Detect property type from typeBien field
 */
export function getPropertyType(result) {
  if (result.typeBien) {
    if (result.typeBien.toLowerCase().includes('appartement')) {
      return 'appartement'
    }
    if (result.typeBien.toLowerCase().includes('maison')) {
      return 'maison'
    }
  }
  return null
}

/**
 * Parse floor information from complementRefLogement text
 */
export function parseLocalisation(text) {
  if (!text) return ''
  const str = String(text).trim()
  if (!str) return ''

  // Priority 1: Look for explicit "étage" with a number
  const etageMatch = str.match(/[ÉEé]tage\s*[:;#n°]?\s*°?\s*(\d+)/i)
  if (etageMatch) {
    const floorNum = etageMatch[1]
    return floorNum === '0' ? 'RDC' : `Étage: ${floorNum}`
  }

  // Priority 2: Look for ordinal patterns WITH the word "étage"
  if (str.toLowerCase().includes('étage') || str.toLowerCase().includes('etage')) {
    const ordinalWithEtage = str.match(/(\d+)\s*(?:er|ère|eme|ème|e|è)\s*[éÉ]tage/i)
    if (ordinalWithEtage) {
      return `Étage: ${ordinalWithEtage[1]}`
    }
  }

  // Priority 3: Check for RDC (ground floor) - various spellings
  if (str.match(/\b(RDC|rez[\s-]?de[\s-]?chauss[ée]e?|res[\s-]?de[\s-]?chauss[ée]e?|rez|RC)\b/i)) {
    return 'RDC'
  }

  // Priority 4: Look for standalone ordinals ONLY at the beginning
  const standaloneOrdinal = str.match(/^(\d+)\s*(?:er|ère|eme|ème|è|e)\s*(?:gauche|droite|fond|face)?$/i)
  if (standaloneOrdinal) {
    return `Étage: ${standaloneOrdinal[1]}`
  }

  // Priority 5: Look for abbreviations like "Et. 3" or "Etg 2" but be strict
  const abbreviationMatch = str.match(/\b[EÉé]t[g]?\.?\s+(\d+)\b/i)
  if (abbreviationMatch && !str.match(/\b(bat|esc|appt|stage|etagere)\b/i)) {
    return `Étage: ${abbreviationMatch[1]}`
  }

  return ''
}

/**
 * Get floor display for a result
 */
export function getFloorDisplay(result) {
  // First check if we have a direct etage field
  if (
    result.etage !== null &&
    result.etage !== undefined &&
    result.etage !== '' &&
    result.etage !== 0 &&
    result.etage !== '0'
  ) {
    return result.etage.toString().includes('Étage') ? result.etage : `Étage: ${result.etage}`
  }

  // Then try to parse from complementRefLogement (most reliable)
  const parsed = parseLocalisation(result.complementRefLogement)
  if (parsed) {
    return parsed
  }

  // For apartments only: use nombreNiveaux as fallback if > 1
  if (result.typeBien?.toLowerCase().includes('appartement')) {
    if (result.nombreNiveaux && result.nombreNiveaux > 1) {
      return result.nombreNiveaux.toString()
    }
  }

  return null
}

/**
 * Format floor for display in the grid (remove "Étage:" prefix)
 */
export function formatFloorForDisplay(floor) {
  if (!floor) return '-'

  // If it already has "Étage:" prefix, just show the number part
  if (typeof floor === 'string' && floor.includes('Étage:')) {
    return floor.replace('Étage:', '').trim()
  }

  // If it's RDC, show as is
  if (floor === 'RDC') return 'RDC'

  // If it's a number, just return it
  if (typeof floor === 'number' || !Number.isNaN(floor)) {
    return floor.toString()
  }

  // Otherwise return the floor value
  return floor
}

/**
 * Clean ADEME address by removing postal codes and city names
 */
export function cleanAddress(adresseComplete, communeADEME) {
  if (!adresseComplete) return 'Bien localisé'

  let address = adresseComplete

  // Fix encoding issues
  address = address.replace(/â€™/g, "'").replace(/â€/g, "'")

  // Remove all postal codes (5 digits)
  address = address.replace(/\s+\d{5}\s*/g, ' ')

  // Remove ADEME city name if present
  if (communeADEME) {
    const ademeRegex = new RegExp(`\\s*${communeADEME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'gi')
    address = address.replace(ademeRegex, ' ')
  }

  // Try to remove "Aix-en-Provence" if it's in the enriched commune
  address = address.replace(/\s*Aix-en-Provence\s*/gi, ' ')

  // Remove any remaining city-like patterns at the end
  address = address.replace(/\s+[A-Za-zÀ-ÿ-]+$/g, '')

  // Clean multiple spaces and trim
  address = address.trim().replace(/\s+/g, ' ')

  return address || 'Bien localisé'
}
