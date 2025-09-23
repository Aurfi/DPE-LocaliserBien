// Service for dynamically loading department data
// This replaces static imports to reduce bundle size

const cache = new Map()

/**
 * Load communes data for a specific department
 * @param {string} deptCode - Department code (e.g., '01', '2A', '75')
 * @returns {Promise<Array>} Array of commune data
 */
export async function loadCommunesForDepartment(deptCode) {
  const cacheKey = `communes-${deptCode}`

  // Return from cache if available
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)
  }

  try {
    // Dynamically fetch the JSON file
    const response = await fetch(`/data/departments/communes-dept-${deptCode}.json`)
    if (!response.ok) {
      throw new Error(`Failed to load communes for department ${deptCode}`)
    }

    const data = await response.json()

    // Cache the result
    cache.set(cacheKey, data)

    return data
  } catch (_error) {
    return []
  }
}

/**
 * Load DPE averages data for a specific department
 * @param {string} deptCode - Department code (e.g., '01', '2A', '75')
 * @returns {Promise<Object>} DPE averages data
 */
export async function loadDPEAveragesForDepartment(deptCode) {
  const cacheKey = `dpe-averages-${deptCode}`

  // Return from cache if available
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)
  }

  try {
    // Dynamically fetch the JSON file
    const response = await fetch(`/data/departments/dpe-averages-dept-${deptCode}.json`)
    if (!response.ok) {
      throw new Error(`Failed to load DPE averages for department ${deptCode}`)
    }

    const data = await response.json()

    // Cache the result
    cache.set(cacheKey, data)

    return data
  } catch (_error) {
    return null
  }
}

/**
 * Preload data for a department (useful for prefetching)
 * @param {string} deptCode - Department code
 */
export async function preloadDepartmentData(deptCode) {
  // Load both in parallel
  await Promise.all([loadCommunesForDepartment(deptCode), loadDPEAveragesForDepartment(deptCode)])
}

/**
 * Clear the cache (useful for memory management)
 */
export function clearDepartmentCache() {
  cache.clear()
}

/**
 * Get department code from INSEE code or postal code
 * @param {string} code - INSEE code or postal code
 * @returns {string} Department code
 */
export function getDepartmentFromCode(code) {
  if (!code) return null

  // Handle Corsica special cases
  if (code.startsWith('2A') || code.startsWith('200')) return '2A'
  if (code.startsWith('2B') || code.startsWith('201') || code.startsWith('202')) return '2B'

  // Handle DOM-TOM
  if (code.startsWith('97') || code.startsWith('98')) {
    return code.substring(0, 3)
  }

  // Standard departments
  return code.substring(0, 2)
}
