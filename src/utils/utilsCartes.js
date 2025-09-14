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
  const latNum = Number(lat)
  const lonNum = Number(lon)
  const hasValidCoords = Number.isFinite(latNum) && Number.isFinite(lonNum) && latNum !== 0 && lonNum !== 0

  // If we have both coordinates and address, use both for best results
  if (hasValidCoords && address && address.trim()) {
    const encodedAddress = encodeURIComponent(address)
    // Pass both coordinates (for accurate pin) and address (for display)
    return `https://maps.google.com/maps?q=${encodedAddress}&ll=${latNum},${lonNum}&output=embed&z=${zoom}&t=k`
  }

  // If only address, use address alone
  if (address?.trim()) {
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
  if (address) return `https://www.google.com/maps/recherche/?api=1&query=${encodeURIComponent(address)}`
  const latNum = Number(lat)
  const lonNum = Number(lon)
  if (Number.isFinite(latNum) && Number.isFinite(lonNum)) {
    return `https://www.google.com/maps/recherche/?api=1&query=${latNum},${lonNum}`
  }
  return 'https://www.google.com/maps'
}

/**
 * Extract latitude from geopoint string
 * @param {string} geopoint - Geopoint in format "lat,lon"
 * @returns {number|null} Latitude or null
 */
export function getLatitudeFromGeopoint(geopoint) {
  if (!geopoint) return null
  const coords = geopoint.split(',')
  if (coords.length < 2 || !coords[0]) return null
  const lat = parseFloat(coords[0].trim())
  return Number.isFinite(lat) ? lat : null
}

/**
 * Extract longitude from geopoint string
 * @param {string} geopoint - Geopoint in format "lat,lon"
 * @returns {number|null} Longitude or null
 */
export function getLongitudeFromGeopoint(geopoint) {
  if (!geopoint) return null
  const coords = geopoint.split(',')
  if (coords.length < 2 || !coords[1]) return null
  const lon = parseFloat(coords[1].trim())
  return Number.isFinite(lon) ? lon : null
}

/**
 * Generate Geoportail URL for property location
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} zoom - Zoom level (default 17)
 * @returns {string|null} Geoportail URL or null
 */
export function getGeoportailUrl(lat, lon, zoom = 17) {
  const latNum = Number(lat)
  const lonNum = Number(lon)
  if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) return null
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
