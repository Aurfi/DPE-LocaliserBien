/**
 * Service for searching pre-2021 DPE data (before July 2021)
 * Uses the dpe-france dataset with different field names
 */

class DPELegacyService {
  constructor() {
    this.baseURL = 'https://data.ademe.fr/data-fair/api/v1/datasets/dpe-france/lines'
    this.communesIndex = null
    this.departmentCache = {}
    this.indexPromise = this.loadIndex()
  }

  async loadIndex() {
    try {
      const response = await fetch('/data/communes-index.json')
      this.communesIndex = await response.json()
    } catch (_error) {
      this.communesIndex = null
    }
  }

  async ensureIndexLoaded() {
    if (!this.communesIndex && this.indexPromise) {
      await this.indexPromise
    }
  }

  /**
   * Load department data from local JSON
   */
  async loadDepartment(deptCode) {
    if (this.departmentCache[deptCode]) {
      return this.departmentCache[deptCode]
    }

    try {
      const response = await fetch(`/data/departments/communes-dept-${deptCode}.json`)
      const deptData = await response.json()
      this.departmentCache[deptCode] = deptData
      return deptData
    } catch (_error) {
      return null
    }
  }

  /**
   * Get INSEE codes for a given postal code or commune name
   * For multi-commune postal codes, returns the biggest commune by population
   * @param {string} commune - Postal code or commune name
   * @returns {Promise<Array>} Array of INSEE codes
   */
  async getINSEECodes(commune) {
    await this.ensureIndexLoaded()
    if (!commune || !this.communesIndex) return []

    try {
      const isPostalCode = /^\d{5}$/.test(commune)

      if (isPostalCode) {
        // Get department from postal code
        const deptCode = this.communesIndex.postalCodeToDepartment[commune]
        if (!deptCode) return []

        // Load department data
        const deptData = await this.loadDepartment(deptCode)
        if (!deptData) return []

        // Find all communes with this postal code
        const matchingCommunes = deptData.communes.filter(c => c.codesPostaux?.includes(commune))

        if (matchingCommunes.length === 0) return []

        // For multiple communes, take the one with highest population
        if (matchingCommunes.length > 1) {
          const biggest = matchingCommunes.reduce((prev, current) =>
            current.population > prev.population ? current : prev
          )
          return [biggest.code]
        }

        return [matchingCommunes[0].code]
      } else {
        // Search by commune name across ALL departments
        const normalizedSearch = commune.toLowerCase().trim()

        // First check cached departments
        for (const [_code, deptData] of Object.entries(this.departmentCache)) {
          const foundCommune = deptData.communes.find(
            c =>
              c.nom &&
              (c.nom.toLowerCase() === normalizedSearch ||
                c.nom.toLowerCase().replace(/[-\s]/g, '') === normalizedSearch.replace(/[-\s]/g, ''))
          )
          if (foundCommune) {
            return [foundCommune.code]
          }
        }

        // Search all departments (01 to 95 + 2A, 2B for Corsica)
        const allDeptCodes = []
        for (let i = 1; i <= 95; i++) {
          const code = i.toString().padStart(2, '0')
          if (!this.departmentCache[code]) {
            allDeptCodes.push(code)
          }
        }
        // Add Corsica if not cached
        if (!this.departmentCache['2A']) allDeptCodes.push('2A')
        if (!this.departmentCache['2B']) allDeptCodes.push('2B')

        // Search each uncached department
        for (const deptCode of allDeptCodes) {
          try {
            const deptData = await this.loadDepartment(deptCode)
            if (deptData?.communes) {
              const foundCommune = deptData.communes.find(
                c =>
                  c.nom &&
                  (c.nom.toLowerCase() === normalizedSearch ||
                    c.nom.toLowerCase().replace(/[-\s]/g, '') === normalizedSearch.replace(/[-\s]/g, ''))
              )
              if (foundCommune) {
                return [foundCommune.code]
              }
            }
          } catch (_error) {}
        }
      }

      return []
    } catch (_error) {
      return []
    }
  }

  /**
   * Parse comparison value (same as main service)
   */
  parseComparisonValue(value) {
    if (!value) return null

    const strValue = value.toString().trim()

    if (strValue.startsWith('<')) {
      const num = parseInt(strValue.substring(1), 10)
      return { operator: '<', value: num }
    }

    if (strValue.startsWith('>')) {
      const num = parseInt(strValue.substring(1), 10)
      return { operator: '>', value: num }
    }

    const num = parseInt(strValue, 10)
    return { operator: '=', value: num }
  }

  /**
   * Build range query (same as main service)
   */
  buildRangeQuery(comparison, fieldName) {
    if (!comparison) return null

    switch (comparison.operator) {
      case '<':
        return `${fieldName}:[0 TO ${comparison.value}]`
      case '>':
        return `${fieldName}:[${comparison.value} TO 9999]`
      default:
        return `${fieldName}:${comparison.value}`
    }
  }

  /**
   * Search legacy DPE database with multiple strategies
   * @param {Object} searchRequest - Search parameters
   * @param {boolean} hasPostResults - Whether post-2021 search found results
   * @returns {Promise<Object>} Search results
   */
  async searchLegacy(searchRequest, hasPostResults = false) {
    try {
      // Don't search if we already have perfect matches in post-2021
      if (hasPostResults) {
        return { results: [], fromLegacy: true, skipped: true }
      }

      const startTime = Date.now()

      // Get INSEE codes for the location
      const inseeCodes = await this.getINSEECodes(searchRequest.commune)

      if (!inseeCodes || inseeCodes.length === 0) {
        return {
          results: [],
          fromLegacy: true,
          message: 'Commune non trouvée dans la base pré-2021'
        }
      }

      const _results = []
      let searchStrategy = 'NONE'

      // Check if this is a class-based search
      const isClassSearch = searchRequest.energyClass && !searchRequest.consommationEnergie

      // Track all DPE numbers to avoid duplicates
      const seenDPEs = new Set()
      const allResults = []

      // Helper to add unique results
      const addUniqueResults = (newResults, _strategy) => {
        let added = 0
        for (const result of newResults) {
          const dpeNum = result.numero_dpe
          if (dpeNum && !seenDPEs.has(dpeNum)) {
            seenDPEs.add(dpeNum)
            allResults.push(result)
            added++
          } else if (!dpeNum) {
            // Add results without DPE number (can't dedupe)
            allResults.push(result)
            added++
          }
        }
        return added > 0
      }

      // STEP 1: Strict search (±1% surface tolerance)
      const strictConditions = []

      // INSEE code filter
      strictConditions.push(`code_insee_commune_actualise:"${inseeCodes[0]}"`)

      // Energy consumption or class
      if (isClassSearch && searchRequest.energyClass) {
        strictConditions.push(`classe_consommation_energie:"${searchRequest.energyClass.toUpperCase()}"`)
      } else if (searchRequest.consommationEnergie) {
        const consoComparison = this.parseComparisonValue(searchRequest.consommationEnergie)
        if (consoComparison && consoComparison.value > 0) {
          const query = this.buildRangeQuery(consoComparison, 'consommation_energie')
          if (query) strictConditions.push(query)
        }
      }

      // GES emissions or class
      if (searchRequest.gesClass) {
        strictConditions.push(`classe_estimation_ges:"${searchRequest.gesClass.toUpperCase()}"`)
      } else if (searchRequest.emissionGES) {
        const gesComparison = this.parseComparisonValue(searchRequest.emissionGES)
        if (gesComparison && gesComparison.value > 0) {
          const query = this.buildRangeQuery(gesComparison, 'estimation_ges')
          if (query) strictConditions.push(query)
        }
      }

      // Building type
      if (searchRequest.typeBien) {
        if (searchRequest.typeBien === 'maison') {
          strictConditions.push(
            `(tr002_type_batiment_description:"Maison Individuelle" OR tr002_type_batiment_description:"Logement")`
          )
        } else if (searchRequest.typeBien === 'appartement') {
          strictConditions.push(
            `(tr002_type_batiment_description:"Appartement" OR tr002_type_batiment_description:"Logement")`
          )
        }
      }

      // Surface with ±1% tolerance for strict search
      if (searchRequest.surfaceHabitable) {
        const surfaceComparison = this.parseComparisonValue(searchRequest.surfaceHabitable)
        if (surfaceComparison && surfaceComparison.value > 0) {
          if (surfaceComparison.operator === '=') {
            const minSurface = Math.round(surfaceComparison.value * 0.99)
            const maxSurface = Math.round(surfaceComparison.value * 1.01)
            strictConditions.push(`surface_thermique_lot:[${minSurface} TO ${maxSurface}]`)
          } else {
            const query = this.buildRangeQuery(surfaceComparison, 'surface_thermique_lot')
            if (query) strictConditions.push(query)
          }
        }
      }

      const strictQuery = strictConditions.join(' AND ')
      const strictResults = await this.executeQuery(strictQuery, 100)

      if (addUniqueResults(strictResults, 'STRICT')) {
        searchStrategy = 'STRICT'
      }

      // STEP 2: Expanded search if still need more results
      if (allResults.length < 10) {
        const expandedConditions = []

        expandedConditions.push(`code_insee_commune_actualise:"${inseeCodes[0]}"`)

        if (isClassSearch) {
          if (searchRequest.energyClass) {
            expandedConditions.push(`classe_consommation_energie:"${searchRequest.energyClass.toUpperCase()}"`)
          }
          if (searchRequest.gesClass) {
            expandedConditions.push(`classe_estimation_ges:"${searchRequest.gesClass.toUpperCase()}"`)
          }
        } else {
          // ±5% tolerance for energy/GES
          if (searchRequest.consommationEnergie) {
            const min = Math.round(searchRequest.consommationEnergie * 0.95)
            const max = Math.round(searchRequest.consommationEnergie * 1.05)
            expandedConditions.push(`consommation_energie:[${min} TO ${max}]`)
          }
          if (searchRequest.emissionGES) {
            const min = Math.round(searchRequest.emissionGES * 0.95)
            const max = Math.round(searchRequest.emissionGES * 1.05)
            expandedConditions.push(`estimation_ges:[${min} TO ${max}]`)
          }
        }

        if (searchRequest.typeBien) {
          if (searchRequest.typeBien === 'maison') {
            expandedConditions.push(
              `(tr002_type_batiment_description:"Maison Individuelle" OR tr002_type_batiment_description:"Logement")`
            )
          } else if (searchRequest.typeBien === 'appartement') {
            expandedConditions.push(
              `(tr002_type_batiment_description:"Appartement" OR tr002_type_batiment_description:"Logement")`
            )
          }
        }

        // ±15% surface tolerance
        if (searchRequest.surfaceHabitable) {
          const min = Math.round(searchRequest.surfaceHabitable * 0.85)
          const max = Math.round(searchRequest.surfaceHabitable * 1.15)
          expandedConditions.push(`surface_thermique_lot:[${min} TO ${max}]`)
        }

        const expandedQuery = expandedConditions.join(' AND ')
        const expandedResults = await this.executeQuery(expandedQuery, 100)

        if (addUniqueResults(expandedResults, 'EXPANDED')) {
          searchStrategy = searchStrategy === 'STRICT' ? 'STRICT+EXPANDED' : 'EXPANDED'
        }
      }

      // STEP 3: Regional search (department-wide) if still need more
      if (allResults.length < 20) {
        const deptCode = inseeCodes[0].substring(0, 2)
        const regionalConditions = []

        regionalConditions.push(`tv016_departement_code:"${deptCode}"`)

        if (isClassSearch) {
          if (searchRequest.energyClass) {
            regionalConditions.push(`classe_consommation_energie:"${searchRequest.energyClass.toUpperCase()}"`)
          }
          if (searchRequest.gesClass) {
            regionalConditions.push(`classe_estimation_ges:"${searchRequest.gesClass.toUpperCase()}"`)
          }
        } else {
          // ±10% tolerance
          if (searchRequest.consommationEnergie) {
            const min = Math.round(searchRequest.consommationEnergie * 0.9)
            const max = Math.round(searchRequest.consommationEnergie * 1.1)
            regionalConditions.push(`consommation_energie:[${min} TO ${max}]`)
          }
          if (searchRequest.emissionGES) {
            const min = Math.round(searchRequest.emissionGES * 0.9)
            const max = Math.round(searchRequest.emissionGES * 1.1)
            regionalConditions.push(`estimation_ges:[${min} TO ${max}]`)
          }
        }

        if (searchRequest.typeBien) {
          if (searchRequest.typeBien === 'maison') {
            regionalConditions.push(
              `(tr002_type_batiment_description:"Maison Individuelle" OR tr002_type_batiment_description:"Logement")`
            )
          } else if (searchRequest.typeBien === 'appartement') {
            regionalConditions.push(
              `(tr002_type_batiment_description:"Appartement" OR tr002_type_batiment_description:"Logement")`
            )
          }
        }

        // ±35% surface tolerance
        if (searchRequest.surfaceHabitable) {
          const min = Math.round(searchRequest.surfaceHabitable * 0.65)
          const max = Math.round(searchRequest.surfaceHabitable * 1.35)
          regionalConditions.push(`surface_thermique_lot:[${min} TO ${max}]`)
        }

        const regionalQuery = regionalConditions.join(' AND ')
        const regionalResults = await this.executeQuery(regionalQuery, 200)

        if (addUniqueResults(regionalResults, 'REGIONAL')) {
          searchStrategy = searchStrategy ? `${searchStrategy}+REGIONAL` : 'REGIONAL'
        }
      }

      // Map and score all unique results
      const mappedResults = allResults.map(r => this.mapLegacyResult(r, searchRequest))

      // Sort by match score
      mappedResults.sort((a, b) => b.matchScore - a.matchScore)

      return {
        results: mappedResults.slice(0, 20), // Limit to top 20
        totalFound: mappedResults.length,
        searchStrategy,
        executionTime: Date.now() - startTime,
        fromLegacy: true,
        inseeCodes
      }
    } catch (error) {
      return {
        results: [],
        fromLegacy: true,
        error: error.message
      }
    }
  }

  /**
   * Execute query against the legacy API
   */
  async executeQuery(query, size = 100) {
    try {
      const params = new URLSearchParams({
        qs: query,
        size: size.toString(),
        sort: '-date_etablissement_dpe'
      })

      const response = await fetch(`${this.baseURL}?${params}`)

      if (!response.ok) {
        return []
      }

      const data = await response.json()
      return data.results || []
    } catch (_error) {
      return []
    }
  }

  /**
   * Map legacy result to current format
   */
  mapLegacyResult(legacyData, searchRequest) {
    // Extract coordinates
    let latitude = legacyData.latitude || null
    let longitude = legacyData.longitude || null

    if (!latitude && !longitude && legacyData._geopoint) {
      const coords = legacyData._geopoint.split(',')
      latitude = parseFloat(coords[0])
      longitude = parseFloat(coords[1])
    }

    // Calculate match score
    const matchScore = this.calculateMatchScore(legacyData, searchRequest)

    // Determine if we have incomplete data
    const hasIncompleteData =
      !legacyData.geo_adresse || legacyData.geo_adresse === 'Adresse non disponible' || !latitude || !longitude

    return {
      // Address information
      adresseComplete: legacyData.geo_adresse || 'Adresse non disponible',
      codePostal: this.extractPostalCodeFromAddress(legacyData.geo_adresse) || '',
      commune: this.extractCommuneFromAddress(legacyData.geo_adresse) || '',
      latitude,
      longitude,

      // Energy data - map to post-2021 field names
      consommationEnergie: legacyData.consommation_energie || 0,
      classeDPE: legacyData.classe_consommation_energie || '',
      emissionGES: legacyData.estimation_ges || 0,
      classeGES: legacyData.classe_estimation_ges || '',

      // Building information
      typeBien: this.mapBuildingType(legacyData.tr002_type_batiment_description),
      surfaceHabitable: legacyData.surface_thermique_lot || 0,
      anneeConstruction: legacyData.annee_construction || null,

      // Metadata
      id: legacyData.numero_dpe || legacyData._id || '',
      numeroDPE: legacyData.numero_dpe || '',
      dateVisite: legacyData.date_etablissement_dpe,

      // Scoring
      matchScore,
      matchReasons: this.getMatchReasons(legacyData, searchRequest),

      // Mark as legacy data with incomplete flag
      isLegacyData: true,
      fromLegacy: true,
      hasIncompleteData,
      legacyNote: 'DPE avant juillet 2021',

      // ADEME link for incomplete data
      ademeUrl: legacyData.numero_dpe
        ? `https://www.observatoire-dpe.fr/index.php/recherche-dpe?numero=${legacyData.numero_dpe}`
        : null
    }
  }

  /**
   * Calculate match score for legacy results (same logic as main service)
   */
  calculateMatchScore(legacyData, searchRequest) {
    let baseScore = 0
    let multiplier = 1.0

    // Location match (10 points)
    if (searchRequest.commune && legacyData.geo_adresse) {
      const addressLower = legacyData.geo_adresse.toLowerCase()
      const communeLower = searchRequest.commune.toLowerCase()

      if (addressLower.includes(communeLower)) {
        baseScore += 10
      }
    }

    // Check if class-based or value-based search
    const isClassSearch = searchRequest.energyClass && !searchRequest.consommationEnergie

    if (isClassSearch) {
      // CLASS-BASED SEARCH

      // Surface (30 points)
      if (searchRequest.surfaceHabitable && legacyData.surface_thermique_lot) {
        const surfaceDiff = Math.abs(legacyData.surface_thermique_lot - searchRequest.surfaceHabitable)
        const surfacePercent = (surfaceDiff / searchRequest.surfaceHabitable) * 100

        if (surfaceDiff <= 1) {
          baseScore += 30
        } else if (surfacePercent <= 100) {
          baseScore += 30 - 15 * (surfacePercent / 100)
        } else {
          baseScore += 15
          multiplier *= 0.5
        }
      }

      // Energy class (40 points)
      if (searchRequest.energyClass && legacyData.classe_consommation_energie) {
        const requestClass = searchRequest.energyClass.toUpperCase()
        const dpeClass = legacyData.classe_consommation_energie.toUpperCase()

        if (requestClass === dpeClass) {
          baseScore += 40
        } else {
          const classes = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
          const classDiff = Math.abs(classes.indexOf(requestClass) - classes.indexOf(dpeClass))

          if (classDiff === 1) baseScore += 25
          else if (classDiff === 2) baseScore += 10
          else if (classDiff === 3) baseScore += 5
        }
      }

      // GES class (20 points)
      if (searchRequest.gesClass && legacyData.classe_estimation_ges) {
        const requestGES = searchRequest.gesClass.toUpperCase()
        const dpeGES = legacyData.classe_estimation_ges.toUpperCase()

        if (requestGES === dpeGES) {
          baseScore += 20
        } else {
          const classes = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
          const classDiff = Math.abs(classes.indexOf(requestGES) - classes.indexOf(dpeGES))

          if (classDiff === 1) baseScore += 12
          else if (classDiff === 2) baseScore += 6
          else if (classDiff === 3) baseScore += 3
        }
      }
    } else {
      // EXACT VALUE SEARCH

      // Surface (up to 90 points)
      if (searchRequest.surfaceHabitable && legacyData.surface_thermique_lot) {
        const surfaceDiff = Math.abs(legacyData.surface_thermique_lot - searchRequest.surfaceHabitable)
        const surfacePercent = (surfaceDiff / searchRequest.surfaceHabitable) * 100

        if (surfaceDiff <= 1) {
          baseScore += 90
        } else if (surfacePercent <= 90) {
          baseScore += 90 - surfacePercent
        } else if (surfacePercent <= 100) {
          baseScore += Math.max(0, 10 - (surfacePercent - 90))
        } else {
          baseScore += 0
          multiplier *= 0.5
        }
      }

      // Energy penalty
      if (searchRequest.consommationEnergie && legacyData.consommation_energie) {
        const kwhDiff = Math.abs(legacyData.consommation_energie - searchRequest.consommationEnergie)

        if (kwhDiff === 0) {
          // Perfect match
        } else if (kwhDiff === 1) {
          multiplier *= 0.75
        } else if (kwhDiff <= 9) {
          const factor = 0.75 - (0.15 * (kwhDiff - 1)) / 8
          multiplier *= factor
        } else {
          multiplier *= Math.max(0.3, 0.6 - (kwhDiff - 9) * 0.03)
        }
      }

      // GES penalty
      if (searchRequest.emissionGES && legacyData.estimation_ges) {
        const gesDiff = Math.abs(legacyData.estimation_ges - searchRequest.emissionGES)

        if (gesDiff === 0) {
          // Perfect match
        } else if (gesDiff === 1) {
          multiplier *= 0.75
        } else if (gesDiff <= 9) {
          const factor = 0.75 - (0.15 * (gesDiff - 1)) / 8
          multiplier *= factor
        } else {
          multiplier *= Math.max(0.3, 0.6 - (gesDiff - 9) * 0.03)
        }
      }
    }

    return Math.round(baseScore * multiplier)
  }

  /**
   * Get match reasons for display
   */
  getMatchReasons(legacyData, searchRequest) {
    const reasons = []

    const isClassSearch = searchRequest.energyClass && !searchRequest.consommationEnergie

    if (isClassSearch) {
      if (searchRequest.energyClass && legacyData.classe_consommation_energie) {
        const requestClass = searchRequest.energyClass.toUpperCase()
        const dpeClass = legacyData.classe_consommation_energie.toUpperCase()

        if (requestClass === dpeClass) {
          reasons.push(`Classe énergétique exacte: ${dpeClass}`)
        } else {
          reasons.push(`Classe énergétique: ${dpeClass} (recherche: ${requestClass})`)
        }
      }

      if (searchRequest.gesClass && legacyData.classe_estimation_ges) {
        const requestGES = searchRequest.gesClass.toUpperCase()
        const dpeGES = legacyData.classe_estimation_ges.toUpperCase()

        if (requestGES === dpeGES) {
          reasons.push(`Classe GES exacte: ${dpeGES}`)
        } else {
          reasons.push(`Classe GES: ${dpeGES} (recherche: ${requestGES})`)
        }
      }
    } else {
      if (searchRequest.consommationEnergie === legacyData.consommation_energie) {
        reasons.push(`Consommation exacte: ${searchRequest.consommationEnergie} kWh/m²/an`)
      }

      if (searchRequest.emissionGES === legacyData.estimation_ges) {
        reasons.push(`GES exact: ${searchRequest.emissionGES} kgCO²/m²/an`)
      }
    }

    if (searchRequest.surfaceHabitable && legacyData.surface_thermique_lot) {
      const ecart = Math.abs(legacyData.surface_thermique_lot - searchRequest.surfaceHabitable)
      const pourcent = Math.round((ecart / searchRequest.surfaceHabitable) * 100)
      reasons.push(`Surface: ${legacyData.surface_thermique_lot}m² (écart: ${pourcent}%)`)
    }

    reasons.push('Base de données pré-2021')

    return reasons
  }

  /**
   * Extract postal code from address string
   */
  extractPostalCodeFromAddress(address) {
    if (!address) return ''
    const match = address.match(/\b\d{5}\b/)
    return match ? match[0] : ''
  }

  /**
   * Extract commune name from address string
   */
  extractCommuneFromAddress(address) {
    if (!address) return ''
    const parts = address.split(' ')
    const postalIndex = parts.findIndex(p => /^\d{5}$/.test(p))
    if (postalIndex >= 0 && postalIndex < parts.length - 1) {
      return parts.slice(postalIndex + 1).join(' ')
    }
    return ''
  }

  /**
   * Map building type to current format
   */
  mapBuildingType(legacyType) {
    if (!legacyType) return ''

    const mapping = {
      'Maison Individuelle': 'maison',
      Appartement: 'appartement',
      Logement: 'logement',
      Immeuble: 'immeuble'
    }

    return mapping[legacyType] || legacyType.toLowerCase()
  }
}

export default DPELegacyService
