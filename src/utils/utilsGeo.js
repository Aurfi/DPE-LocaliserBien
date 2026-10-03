/**
 * Geographic utilities for handling coordinates, distances, and location data
 * Shared utilities to avoid duplication across services
 */

import {
  AmbiguousCommuneError,
  getDepartmentsFromCommuneName,
  getDepartmentsFromPostalCode,
  normalizeCommuneName
} from './communeDirectory.js'

/** Return a department only when the source snapshot identifies exactly one. */
export function getDepartmentFromPostalCode(postalCode) {
  const departments = getDepartmentsFromPostalCode(postalCode)
  return departments.length === 1 ? departments[0] : null
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

  // Retry logic for timeout errors
  let retries = 2
  let lastError = null

  while (retries > 0) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000) // 8 second timeout

      const response = await fetch(`https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(address)}&limit=1`, {
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        if (response.status === 504 || response.status === 503) {
          lastError = new Error(
            'Le service de géolocalisation est temporairement indisponible. Veuillez réessayer dans quelques instants.'
          )
          retries--
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second before retry
            continue
          }
        } else {
          const errorMessage = 'Impossible de localiser cette adresse. Veuillez vérifier et réessayer.'
          if (throwOnError) throw new Error(errorMessage)
          return null
        }
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
          city,
          communeCode: feature.properties.citycode
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
      const errorMessage = 'Aucune adresse trouvée. Veuillez vérifier votre saisie.'
      if (throwOnError) throw new Error(errorMessage)
      return null
    } catch (error) {
      // Handle abort/timeout errors
      if (error.name === 'AbortError') {
        lastError = new Error('La recherche prend trop de temps. Veuillez réessayer.')
        retries--
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000))
          continue
        }
      }
      lastError = error
      retries--
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }

  // If we get here, all retries failed
  if (throwOnError && lastError) {
    throw lastError
  }
  return null
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
      const departments = getDepartmentsFromPostalCode(communeInput)
      if (departments.length === 0) return null
      const loaded = await Promise.all(departments.map(code => loadDepartmentFn(code)))
      // An incomplete cross-department match must not silently narrow the search area.
      if (loaded.some(data => !data?.postalCodes?.[communeInput])) return null
      if (loaded.length > 1) {
        const areas = loaded.map(data => {
          const area = data.postalCodes[communeInput]
          const commune =
            area.communeCount === 1
              ? data.communes.find(candidate => candidate.codesPostaux?.includes(communeInput))
              : null
          return { ...area, coverageRadius: area.coverageRadius || commune?.radius || 0 }
        })
        const lon = areas.reduce((sum, area) => sum + area.center[0], 0) / areas.length
        const lat = areas.reduce((sum, area) => sum + area.center[1], 0) / areas.length
        return {
          lat,
          lon,
          centre: { lat, lon },
          mairie: { lat, lon },
          radius: 0,
          coverageRadius: Math.max(
            ...areas.map(
              area => calculateDistance(lat, lon, area.center[1], area.center[0]) + (area.coverageRadius || 0)
            )
          ),
          isMultiCommune: true,
          communes: areas.flatMap(area => area.communes),
          communeCount: areas.reduce((sum, area) => sum + area.communeCount, 0),
          departments
        }
      }
      const deptData = loaded[0]

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
 * For known city names: indexed unique commune; geocoder fallback for other addresses.
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

  // Known commune names use the source directory. A geocoder's first hit cannot resolve homonyms.
  try {
    const departments = await getDepartmentsFromCommuneName(communeInput)
    if (departments.length > 1) throw new AmbiguousCommuneError()
    if (departments.length === 1) {
      const data = await loadDepartmentFn(departments[0])
      const matches =
        data?.communes?.filter(
          candidate => normalizeCommuneName(candidate.nom) === normalizeCommuneName(communeInput)
        ) || []
      if (matches.length > 1) throw new AmbiguousCommuneError()
      if (matches.length === 0) return null
      const commune = matches[0]
      if (!commune.centre?.coordinates || !commune.codesPostaux?.length) return null
      const [lon, lat] = commune.centre.coordinates
      const [mairieLon, mairieLat] = commune.mairie?.coordinates || [lon, lat]
      return {
        lat,
        lon,
        centre: { lat, lon },
        mairie: { lat: mairieLat, lon: mairieLon },
        radius: commune.radius || 0,
        coverageRadius: 0,
        isMultiCommune: commune.codesPostaux.length > 1,
        postalCode: commune.codesPostaux[0],
        allPostalCodes: [...commune.codesPostaux],
        communeName: commune.nom,
        communeCode: commune.code
      }
    }

    // Addresses or names absent from the snapshot may still be resolved by the geocoder.
    const geoResult = await geocodeAddress(communeInput)
    if (geoResult?.city) {
      const qualifiedPostcodes = [...new Set(communeInput.match(/\b\d{5}\b/g) || [])]
      const explicitlyQualified = qualifiedPostcodes.length === 1 && qualifiedPostcodes[0] === geoResult.postalCode
      if (!explicitlyQualified) {
        const candidateDepartments = await getDepartmentsFromCommuneName(geoResult.city)
        if (candidateDepartments.length > 1) throw new AmbiguousCommuneError()
        if (candidateDepartments.length === 1) {
          const candidateData = await loadDepartmentFn(candidateDepartments[0])
          const homonyms = candidateData?.communes?.filter(
            candidate => normalizeCommuneName(candidate.nom) === normalizeCommuneName(geoResult.city)
          )
          if (!homonyms) return null
          if (homonyms.length > 1) throw new AmbiguousCommuneError()
        }
      }
    }
    if (geoResult?.postalCode) {
      // Get department using postal code from geo API
      const deptCode = getDepartmentFromPostalCode(geoResult.postalCode)
      if (deptCode) {
        const deptData = await loadDepartmentFn(deptCode)
        if (deptData?.communes) {
          // Find the commune that contains this postal code
          const matches = deptData.communes.filter(c =>
            geoResult.communeCode
              ? c.code === geoResult.communeCode
              : normalizeCommuneName(c.nom) === normalizeCommuneName(geoResult.city || communeInput)
          )
          const commune = matches.length === 1 ? matches[0] : null

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

    // Reuse the result that passed the ambiguity checks; never issue a second unchecked lookup.
    return geoResult
      ? {
          ...geoResult,
          centre: { lat: geoResult.lat, lon: geoResult.lon },
          mairie: { lat: geoResult.lat, lon: geoResult.lon },
          radius: 0,
          coverageRadius: 0,
          isMultiCommune: false
        }
      : null
  } catch (error) {
    if (error.code === 'AMBIGUOUS_COMMUNE') throw error
    return null
  }
}
