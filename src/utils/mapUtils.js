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
  // Use coordinates if available for more accurate location
  if (lat && lon) {
    return `https://maps.google.com/maps?q=${lat},${lon}&output=embed&z=${zoom}&t=k`
  }

  // Fallback to address if provided
  if (address) {
    const encodedAddress = encodeURIComponent(address)
    return `https://maps.google.com/maps?q=${encodedAddress}&output=embed&z=${zoom}&t=k`
  }

  return ''
}

/**
 * Extract latitude from geopoint string
 * @param {string} geopoint - Geopoint in format "lat,lon"
 * @returns {number|null} Latitude or null
 */
export function getLatitudeFromGeopoint(geopoint) {
  if (!geopoint) return null
  const coords = geopoint.split(',')
  return coords[0] ? parseFloat(coords[0]) : null
}

/**
 * Extract longitude from geopoint string
 * @param {string} geopoint - Geopoint in format "lat,lon"
 * @returns {number|null} Longitude or null
 */
export function getLongitudeFromGeopoint(geopoint) {
  if (!geopoint) return null
  const coords = geopoint.split(',')
  return coords[1] ? parseFloat(coords[1]) : null
}

/**
 * Generate Geoportail URL for property location
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} zoom - Zoom level (default 17)
 * @returns {string|null} Geoportail URL or null
 */
export function getGeoportailUrl(lat, lon, zoom = 17) {
  if (!lat || !lon) return null
  return `https://explore.data.gouv.fr/fr/immobilier?onglet=carte&filtre=tous&lat=${lat}&lng=${lon}&zoom=${zoom}.00`
}
