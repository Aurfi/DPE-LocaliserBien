/**
 * Utility functions for Google Maps integration
 */

/**
 * Generate Google Maps embed URL without API key
 * @param {number|string} lat - Latitude
 * @param {number|string} lon - Longitude
 * @param {string} address - Fallback address if coordinates not available
 * @param {number} zoom - Zoom level (default 18)
 * @returns {string} Google Maps embed URL
 */
export function getGoogleMapsEmbedUrl(lat, lon, address = null, zoom = 18) {
  const latNum = getCoordinate(lat, 90)
  const lonNum = getCoordinate(lon, 180)
  // Reject absent/out-of-range coordinates and the 0,0 sentinel, but preserve
  // real locations on the Greenwich meridian or the equator.
  const hasValidCoords = latNum !== null && lonNum !== null && (latNum !== 0 || lonNum !== 0)
  const hasAddress = typeof address === 'string' && address.trim()

  // If we have both coordinates and address, use both for best results
  if (hasValidCoords && hasAddress) {
    const encodedAddress = encodeURIComponent(address)
    // Pass both coordinates (for accurate pin) and address (for display)
    return `https://maps.google.com/maps?q=${encodedAddress}&ll=${latNum},${lonNum}&output=embed&z=${zoom}&t=k`
  }

  // If only address, use address alone
  if (hasAddress) {
    const encodedAddress = encodeURIComponent(address)
    return `https://maps.google.com/maps?q=${encodedAddress}&output=embed&z=${zoom}&t=k`
  }

  // If only coordinates, use coordinates alone
  if (hasValidCoords) {
    return `https://maps.google.com/maps?q=${latNum},${lonNum}&output=embed&z=${zoom}&t=k`
  }

  return ''
}

/**
 * Generate a Google Maps search URL for opening in a new tab
 * @param {number|string} lat - Latitude
 * @param {number|string} lon - Longitude
 * @param {string|null} address - Fallback address
 * @returns {string}
 */
export function getGoogleMapsSearchUrl(lat, lon, address = null) {
  // Préférer l'adresse pour lever l'ambiguïté sur les territoires d'outre-mer
  if (typeof address === 'string' && address.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
  }
  const latNum = getCoordinate(lat, 90)
  const lonNum = getCoordinate(lon, 180)
  if (latNum !== null && lonNum !== null && (latNum !== 0 || lonNum !== 0)) {
    return `https://www.google.com/maps/search/?api=1&query=${latNum},${lonNum}`
  }
  return 'https://www.google.com/maps'
}

/**
 * Extract latitude from geopoint string
 * @param {string} geopoint - Geopoint in format "lat,lon"
 * @returns {number|null} Latitude or null
 */
export function getLatitudeFromGeopoint(geopoint) {
  if (typeof geopoint !== 'string') return null
  const coords = geopoint.split(',')
  if (coords.length < 2) return null
  return getCoordinate(coords[0], 90)
}

/**
 * Extract longitude from geopoint string
 * @param {string} geopoint - Geopoint in format "lat,lon"
 * @returns {number|null} Longitude or null
 */
export function getLongitudeFromGeopoint(geopoint) {
  if (typeof geopoint !== 'string') return null
  const coords = geopoint.split(',')
  if (coords.length < 2) return null
  return getCoordinate(coords[1], 180)
}

function getCoordinate(value, limit) {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !value.trim()) return null
  const coordinate = Number(value)
  return Number.isFinite(coordinate) && Math.abs(coordinate) <= limit ? coordinate : null
}

/**
 * Generate Geoportail URL for property location
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} zoom - Zoom level (default 17)
 * @returns {string|null} Geoportail URL or null
 */
export function getGeoportailUrl(lat, lon, zoom = 17) {
  const latNum = getCoordinate(lat, 90)
  const lonNum = getCoordinate(lon, 180)
  if (latNum === null || lonNum === null) return null
  return `https://explore.data.gouv.fr/fr/immobilier?onglet=carte&filtre=tous&lat=${latNum}&lng=${lonNum}&zoom=${zoom}.00`
}

/**
 * Return the region/country label suitable for Google Maps based on postal code
 * Ensures overseas territories are correctly targeted when using address queries.
 */
export function getGoogleRegionLabel(postalCode) {
  if (!postalCode) return 'France'
  const code = String(postalCode)
  if (code.startsWith('971')) return 'Guadeloupe'
  if (code.startsWith('972')) return 'Martinique'
  if (code.startsWith('973')) return 'Guyane française'
  if (code.startsWith('974')) return 'La Réunion'
  if (code.startsWith('976')) return 'Mayotte'
  // La Corse utilise le FR normal
  return 'France'
}
