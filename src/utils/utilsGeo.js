/**
 * Geographic utilities for handling coordinates, distances, and location data
 * Shared utilities to avoid duplication across services
 */

// API base URL from environment variables (new Géoplateforme endpoint)
const _GEO_API_URL = import.meta.env.VITE_GEO_API_URL || 'https://data.geopf.fr/geocodage'

/**
 * Get department code from postal code using simple rule (much faster than dictionary lookup)
 * @param {string} postalCode - 5-digit postal code
 * @returns {string} Department code (e.g., '13', '2A', '2B')
 */
export function getDepartmentFromPostalCode(postalCode) {
  if (!/^\d{5}$/.test(postalCode)) return null

  // Special case: Corsica
  if (postalCode.startsWith('20')) {
    // 20000-20199 → 2A (Corse-du-Sud)
    // 20200-20999 → 2B (Haute-Corse)
    return parseInt(postalCode, 10) < 20200 ? '2A' : '2B'
  }

  // All other departments: first 2 digits = department code
  return postalCode.substring(0, 2)
}

/**
 * Calculate distance between two GPS points using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  // Verify that all coordinates are valid numbers
  if (Number.isNaN(lat1) || Number.isNaN(lon1) || Number.isNaN(lat2) || Number.isNaN(lon2)) {
    return 0
  }

  // Verify coordinates are within valid ranges
  if (Math.abs(lat1) > 90 || Math.abs(lat2) > 90 || Math.abs(lon1) > 180 || Math.abs(lon2) > 180) {
    return 0
  }

  const R = 6371 // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Geocode an address or commune name using the French government API
 * @param {string} address - Address or commune name to geocode
 * @param {Object} options - Geocoding options
 * @param {boolean} options.throwOnError - Whether to throw error or return null on failure (default: false)
 * @param {boolean} options.extendedFormat - Whether to return extended format with centre/mairie coordinates (default: false)
 * @returns {Promise<Object|null>} Geocoding result or null if not found
 */
export async function geocodeAddress(address, options = {}) {
  const { throwOnError = false, extendedFormat = false } = options

  try {
    const response = await fetch(`https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(address)}&limit=1`)

    if (!response.ok) {
      const errorMessage = `Geocoding API error: ${response.status}`
      if (throwOnError) throw new Error(errorMessage)
      return null
    }

    const data = await response.json()

    if (data.features && data.features.length > 0) {
      const feature = data.features[0]
      const [lon, lat] = feature.geometry.coordinates
      const postalCode = feature.properties.postcode
      const city = feature.properties.city || feature.properties.name

      const baseResult = {
        lat,
        lon,
        formattedAddress: feature.properties.label,
        postalCode,
        city
      }

      // Extended format for compatibility with DPE search service
      if (extendedFormat) {
        return {
          ...baseResult,
          centre: { lat, lon },
          mairie: { lat, lon },
          radius: 0,
          coverageRadius: 0,
          isMultiCommune: false
        }
      }

      return baseResult
    }

    // No results found
    const errorMessage = 'Address not found'
    if (throwOnError) throw new Error(errorMessage)
    return null
  } catch (error) {
    if (throwOnError) throw error
    return null
  }
}

/**
 * Extract postal code from commune input if it's already a postal code
 * @param {string} commune - Commune name or postal code
 * @returns {string|null} Postal code if input is valid postal code, null otherwise
 */
export function extractPostalCode(commune) {
  if (/^\d{5}$/.test(commune)) {
    return commune
  }
  return null
}

/**
 * Get commune coordinates using efficient approach: simple postal lookup + targeted department file
 * @param {string} communeInput - Postal code or commune name
 * @param {Function} loadDepartmentFn - Function to load department data
 * @param {Object} departmentCache - Cache of loaded departments
 * @returns {Promise<Object|null>} Coordinate data with lat, lon, centre, mairie, radius, etc.
 */
export async function getCommuneCoordinatesFromDatabase(communeInput, loadDepartmentFn, _departmentCache = {}) {
  if (!communeInput) return null

  try {
    const isPostalCode = /^\d{5}$/.test(communeInput)

    if (isPostalCode) {
      // STEP 1: Use simple rule to get department (no dictionary lookup needed!)
      const deptCode = getDepartmentFromPostalCode(communeInput)
      if (!deptCode) return null

      // STEP 2: Load only the relevant department file
      const deptData = await loadDepartmentFn(deptCode)
      if (!deptData?.postalCodes?.[communeInput]) return null

      const postalData = deptData.postalCodes[communeInput]

      // STEP 3: Get precise data from department file (radius, mairie, etc.)
      if (postalData.communeCount > 1) {
        // Multiple communes share this postal code
        return {
          lat: postalData.center[1],
          lon: postalData.center[0],
          centre: { lat: postalData.center[1], lon: postalData.center[0] },
          mairie: { lat: postalData.center[1], lon: postalData.center[0] },
          radius: 0,
          coverageRadius: postalData.coverageRadius,
          isMultiCommune: true,
          communes: postalData.communes,
          communeCount: postalData.communeCount
        }
      }

      // Single commune for this postal code
      const communeName = postalData.communes[0]
      const commune = deptData.communes.find(c => c.nom === communeName)

      if (commune) {
        return {
          lat: commune.centre.coordinates[1],
          lon: commune.centre.coordinates[0],
          centre: {
            lat: commune.centre.coordinates[1],
            lon: commune.centre.coordinates[0]
          },
          mairie: {
            lat: commune.mairie.coordinates[1],
            lon: commune.mairie.coordinates[0]
          },
          radius: commune.radius,
          coverageRadius: 0,
          isMultiCommune: false
        }
      }
    }

    // For city names: we'll handle this in the main wrapper function
    return null
  } catch (_error) {
    return null
  }
}

/**
 * Get commune coordinates from local commune data (fallback method)
 * @param {string} communeInput - Postal code or commune name
 * @param {Array} communes - Array of commune objects
 * @returns {Object|null} Basic coordinate data with lat, lon
 */
export function getCommuneCoordinatesFromLocal(communeInput, communes) {
  if (!communeInput || !communes || communes.length === 0) return null

  // If it's a postal code (5 digits)
  if (/^\d{5}$/.test(communeInput)) {
    const commune = communes.find(c => c.codesPostaux?.includes(communeInput))
    if (commune?.centre) {
      return {
        lat: commune.centre.coordinates[1],
        lon: commune.centre.coordinates[0]
      }
    }
  }

  // Otherwise search by commune name
  const normalized = communeInput.toLowerCase().trim()
  const commune = communes.find(c => c.nom && c.nom.toLowerCase() === normalized)
  if (commune?.centre) {
    return {
      lat: commune.centre.coordinates[1],
      lon: commune.centre.coordinates[0]
    }
  }

  return null
}

/**
 * Main wrapper function to get commune coordinates with smart fallback
 * For postal codes: direct database lookup
 * For city names: geo API first to get postal code, then targeted database lookup
 * @param {string} communeInput - Postal code or commune name
 * @param {Function} loadDepartmentFn - Function to load department data
 * @param {Object} departmentCache - Cache of loaded departments
 * @returns {Promise<Object|null>} Coordinate data
 */
export async function getCommuneCoordinates(communeInput, loadDepartmentFn, departmentCache = {}) {
  if (!communeInput) return null

  const isPostalCode = /^\d{5}$/.test(communeInput)

  if (isPostalCode) {
    // STEP 1: For postal codes, direct database lookup (fast)
    return await getCommuneCoordinatesFromDatabase(communeInput, loadDepartmentFn, departmentCache)
  }

  // STEP 2: For city names, get postal code from geo API first, then check if multi-postal commune
  try {
    const geoResult = await geocodeAddress(communeInput)
    if (geoResult?.postalCode) {
      // Get department using postal code from geo API
      const deptCode = getDepartmentFromPostalCode(geoResult.postalCode)
      if (deptCode) {
        const deptData = await loadDepartmentFn(deptCode)
        if (deptData?.communes) {
          // Find the commune that contains this postal code
          const commune = deptData.communes.find(c => c.codesPostaux?.includes(geoResult.postalCode))

          if (commune) {
            if (commune.codesPostaux.length > 1) {
              // Multi-postal commune: use commune center/mairie and radius
              return {
                lat: commune.centre.coordinates[1],
                lon: commune.centre.coordinates[0],
                centre: {
                  lat: commune.centre.coordinates[1],
                  lon: commune.centre.coordinates[0]
                },
                mairie: {
                  lat: commune.mairie.coordinates[1],
                  lon: commune.mairie.coordinates[0]
                },
                radius: commune.radius,
                coverageRadius: 0,
                isMultiCommune: true,
                postalCode: geoResult.postalCode, // Keep for compatibility
                allPostalCodes: commune.codesPostaux, // All postal codes for this commune
                communeName: commune.nom
              }
            } else {
              // Single postal code commune: use targeted database lookup
              const dbResult = await getCommuneCoordinatesFromDatabase(
                geoResult.postalCode,
                loadDepartmentFn,
                departmentCache
              )
              if (dbResult) {
                return { ...dbResult, postalCode: geoResult.postalCode }
              }
            }
          }
        }
      }
    }

    // Fallback: return the geo API result in extended format
    return await geocodeAddress(communeInput, { extendedFormat: true })
  } catch (_error) {
    return null
  }
}
