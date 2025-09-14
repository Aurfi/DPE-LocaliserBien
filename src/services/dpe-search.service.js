// Service pour intégrer avec notre API DPE backend

import { calculateDistance, extractPostalCode, geocodeAddress, getCommuneCoordinates } from '../utils/utilsGeo.js'
import DPELegacyService from './dpe-legacy.service'
import DPEScoringService from './dpe-scoring.service'

class DPESearchService {
  constructor() {
    // Cache pour les départements chargés
    this.departmentCache = {}

    // Initialiser le service legacy pour les données pré-2021
    this.legacyService = new DPELegacyService()

    // Initialiser le service de scoring
    this.scoringService = new DPEScoringService()
  }

  /**
   * Charge un département spécifique
   * @param {string} deptCode - Code du département (ex: '13', '2A')
   * @returns {Promise<Object>} Données du département
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

  // Méthode fetchLocalAverages supprimée: les moyennes affichées sont chargées
  // depuis des JSON statiques (voir Home.vue) et non plus calculées dynamiquement.

  /**
   * Enrichit les résultats avec les adresses correctes via reverse geocoding
   * @param {Array} results - Liste des résultats DPE
   * @returns {Promise<Array>} - Résultats enrichis
   */
  // Removed enrichResultsWithCorrectAddresses method - ADEME data already contains all necessary address information

  /**
   * Délégation vers le service de scoring
   */
  calculateMatchScore(result, searchRequest) {
    return this.scoringService.calculateMatchScore(result, searchRequest)
  }

  getMatchReasons(result, searchRequest) {
    return this.scoringService.getMatchReasons(result, searchRequest)
  }

  /**
   * Récupère le code postal pour une commune donnée
   */
  async getPostalCodeForCommune(communeInput) {
    return extractPostalCode(communeInput, await this.ensureIndexLoaded())
  }

  /**
   * S'assure que l'index des communes est chargé
   */
  async ensureIndexLoaded() {
    // For compatibility with tests - delegate to getCommuneCoordinates logic
    return null
  }

  /**
   * Recherche DPE dans les données ADEME
   * @param {Object} searchRequest - Critères de recherche
   * @returns {Promise<Object>} - Résultats de la recherche
   */
  async search(searchRequest) {
    try {
      // Recherche directe dans les données ADEME
      const searchResults = await this.performSearch(searchRequest)

      // Les moyennes départementales sont chargées au niveau de la vue (Home.vue)
      // via les JSON statiques; on ne renseigne plus localAverages ici.
      searchResults.localAverages = null

      return searchResults
    } catch (_error) {
      throw new Error('Impossible de contacter le service de recherche DPE')
    }
  }

  /**
   * Effectue la recherche DPE avec les critères fournis
   * @param {Object} searchRequest
   * @returns {Promise<Object>}
   */
  async performSearch(searchRequest) {
    const startTime = Date.now()

    // Handle null or empty search requests
    if (!searchRequest || Object.keys(searchRequest).length === 0) {
      return {
        results: [],
        totalFound: 0,
        searchStrategy: 'AUCUN',
        executionTime: Date.now() - startTime,
        diagnostics: ['Requête de recherche vide'],
        isMultiCommune: false,
        postalCode: null,
        hasLegacyData: false
      }
    }

    // Obtenir les coordonnées de la commune pour vérifier si multi-commune
    const communeCoords = await this.getCommuneCoordinates(searchRequest.commune)

    // Extraire ou déterminer le code postal
    let postalCode = null
    if (searchRequest.commune && /^\d{5}$/.test(searchRequest.commune)) {
      // Si c'est déjà un code postal
      postalCode = searchRequest.commune
    } else if (communeCoords?.postalCode) {
      // Utiliser le code postal obtenu depuis getCommuneCoordinates
      postalCode = communeCoords.postalCode
    }

    // Recherche avec nos stratégies de recherche
    let results = await this.performRealSearch(searchRequest, communeCoords)

    // Vérifier si nous avons des correspondances parfaites (score >= 90)
    const hasPerfectMatch = results?.some(r => r.matchScore >= 90)

    // Si aucune correspondance parfaite en post-2021, essayer la base de données pré-2021
    let legacyResults = []
    if (!hasPerfectMatch && this.legacyService) {
      const legacySearch = await this.legacyService.searchLegacy(searchRequest, false)
      if (legacySearch.results && legacySearch.results.length > 0) {
        legacyResults = legacySearch.results

        // Combiner et dédupliquer les résultats si nous en avons des deux sources
        if (results && results.length > 0) {
          // Créer un Set des numéros DPE existants des résultats post-2021
          const existingDPEs = new Set(results.map(r => r.numeroDPE).filter(Boolean))

          // Ajouter uniquement les résultats legacy qui n'ont pas de numéros DPE correspondants
          const uniqueLegacyResults = legacyResults.filter(lr => !lr.numeroDPE || !existingDPEs.has(lr.numeroDPE))
          results = [...results, ...uniqueLegacyResults]
        } else {
          results = legacyResults
        }
      }
    }

    return {
      results: results || [],
      totalFound: results?.length || 0,
      searchStrategy: this.scoringService.determineStrategy(results),
      executionTime: Date.now() - startTime,
      diagnostics: [`Recherche effectuée avec ${results?.length || 0} résultats`],
      isMultiCommune: communeCoords?.isMultiCommune || false,
      postalCode: postalCode,
      hasLegacyData: legacyResults.length > 0
    }
  }

  /**
   * Deduplicate results based on numero_dpe
   * @param {Array} results
   * @returns {Array} Deduplicated results
   */
  deduplicateResults(results) {
    const seen = new Set()
    return results.filter(result => {
      const id = result.numeroDPE || result.id
      if (!id || seen.has(id)) {
        return false
      }
      seen.add(id)
      return true
    })
  }

  /**
   * Parse a value that may contain comparison operators
   * Delegates to scoring service
   */
  parseComparisonValue(value) {
    return this.scoringService.parseComparisonValue(value)
  }

  /**
   * Convert comparison to range query
   * Delegates to scoring service
   */
  buildRangeQuery(comparison, fieldName) {
    return this.scoringService.buildRangeQuery(comparison, fieldName)
  }

  /**
   * Géocoder une adresse ou nom de commune via l'API gouvernementale
   * @param {string} address - Adresse ou nom de commune
   * @returns {Promise<Object>} Coordonnées et informations
   */
  async geocodeAddress(address) {
    return await geocodeAddress(address, { extendedFormat: true })
  }

  /**
   * Sanitize string for use in Lucene query
   * Escapes special characters that could break the query
   * @param {string} str - String to sanitize
   * @returns {string} Sanitized string
   */
  sanitizeForQuery(str) {
    if (!str) return ''
    // Escape Lucene special characters: + - && || ! ( ) { } [ ] ^ " ~ * ? : \ /
    return str.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, '\\$&').trim()
  }

  /**
   * Vraie recherche utilisant l'API ADEME
   * @param {Object} searchRequest
   * @returns {Promise<Array>}
   */
  async performRealSearch(searchRequest, communeCoords = null) {
    const { consommationEnergie, energyClass, commune, emissionGES, gesClass, surfaceHabitable, typeBien } =
      searchRequest

    // Si on a toujours pas de coordonnées pour un nom de commune, on ne peut pas faire de recherche fiable
    if (commune && !/^\d{5}$/.test(commune) && !communeCoords) {
      // Retourner un résultat vide avec un message d'erreur approprié
      return []
    }

    // Construction de la requête vers l'API ADEME
    let codePostal = null

    // If we already have coordinates, use the postal code from there
    if (communeCoords?.postalCode) {
      codePostal = communeCoords.postalCode
    } else {
      // Only extract postal code if we don't have coordinates
      codePostal = extractPostalCode(commune) // Use direct extraction, not async method
    }

    const _codeDepartement = codePostal ? codePostal.substring(0, 2) : null

    // ÉTAPE 1: Recherche STRICTE - critères exacts
    const conditions = []

    if (/^\d{5}$/.test(commune)) {
      // Si c'est un code postal - rechercher dans les deux champs
      const sanitizedPostal = this.sanitizeForQuery(commune)
      conditions.push(`(code_postal_ban:"${sanitizedPostal}" OR code_postal_brut:"${sanitizedPostal}")`)
    } else if (commune && communeCoords && communeCoords.isMultiCommune && communeCoords.allPostalCodes) {
      // Multi-postal commune: search in ALL postal codes
      const allPostalTerms = []
      communeCoords.allPostalCodes.forEach(postal => {
        allPostalTerms.push(`code_postal_ban:"${postal}"`)
        allPostalTerms.push(`code_postal_brut:"${postal}"`)
      })
      conditions.push(`(${allPostalTerms.join(' OR ')})`)
    } else if (commune && communeCoords && codePostal) {
      // Si on a trouvé un code postal via géocodage, rechercher dans les deux champs
      conditions.push(`(code_postal_ban:"${codePostal}" OR code_postal_brut:"${codePostal}")`)
    } else if (commune && communeCoords) {
      // Si c'est un nom de commune ET qu'on a trouvé ses coordonnées mais pas de code postal
      // On va utiliser geo_distance dès le début plutôt que de chercher par nom
      // car les noms de communes peuvent varier (Aix en Provence vs Aix-en-Provence)
      // On utilisera geo_distance dans les params plus bas
    } else if (commune) {
      // Fallback: essayer quand même avec le nom tel quel
      conditions.push(`nom_commune_ban:"${commune}"`)
    }

    // Handle energy consumption or class
    if (energyClass) {
      // Use native etiquette_dpe field for class search
      conditions.push(`etiquette_dpe:"${energyClass}"`)
    } else if (consommationEnergie) {
      // Parse for comparison operators
      const consoComparison = this.parseComparisonValue(consommationEnergie)
      if (consoComparison && consoComparison.value > 0) {
        const query = this.buildRangeQuery(consoComparison, 'conso_5_usages_par_m2_ep')
        if (query) conditions.push(query)
      }
    }

    // Handle GES emissions or class
    if (gesClass) {
      // Use native etiquette_ges field for class search
      conditions.push(`etiquette_ges:"${gesClass}"`)
    } else if (emissionGES) {
      // Parse for comparison operators
      const gesComparison = this.parseComparisonValue(emissionGES)
      if (gesComparison && gesComparison.value > 0) {
        const query = this.buildRangeQuery(gesComparison, 'emission_ges_5_usages_par_m2')
        if (query) conditions.push(query)
      }
    }

    // Add property type if specified
    if (typeBien) {
      // Always include "immeuble" since it could be either type
      if (typeBien === 'maison') {
        conditions.push(`(type_batiment:"maison" OR type_batiment:"immeuble")`)
      } else if (typeBien === 'appartement') {
        conditions.push(`(type_batiment:"appartement" OR type_batiment:"immeuble")`)
      } else {
        // For any other value, use it directly
        conditions.push(`type_batiment:"${typeBien}"`)
      }
    }

    // Add surface filter with operator support
    if (surfaceHabitable) {
      const surfaceComparison = this.parseComparisonValue(surfaceHabitable)
      if (surfaceComparison && surfaceComparison.value > 0) {
        if (surfaceComparison.operator === '=') {
          // For exact match, use ±1m² tolerance (same as recent DPE search)
          const roundedSurface = Math.round(surfaceComparison.value)
          const minSurface = roundedSurface - 1
          const maxSurface = roundedSurface + 1
          conditions.push(`surface_habitable_logement:[${minSurface} TO ${maxSurface}]`)
        } else {
          // For < or > operators, use range query
          const query = this.buildRangeQuery(surfaceComparison, 'surface_habitable_logement')
          if (query) conditions.push(query)
        }
      }
    }

    const qsQuery = conditions.join(' AND ')

    try {
      const url = 'https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/lines'
      const params = new URLSearchParams({
        qs: qsQuery,
        size: '100', // Augmenter pour ne pas manquer de résultats
        sort: '-date_etablissement_dpe' // Tri par date décroissante (plus récent en premier)
      })

      // Si on a des coordonnées mais pas de code postal (nom de commune), utiliser geo_distance
      if (communeCoords && !/^\d{5}$/.test(commune)) {
        // Rayon de 5km pour la recherche stricte avec nom de commune
        const radius = 5000 + (communeCoords.radius || communeCoords.coverageRadius || 0) * 1000
        params.append('geo_distance', `${communeCoords.lon}:${communeCoords.lat}:${radius}`)
      }

      const response = await fetch(`${url}?${params}`)
      if (!response.ok) {
        throw new Error(`Erreur API ADEME: ${response.status}`)
      }

      const data = await response.json()

      // Mapper les résultats ADEME post-2021 vers notre format
      let results = []
      if (data.results && data.results.length > 0) {
        // Calculer les distances d'abord si on a les coordonnées
        if (communeCoords) {
          data.results.forEach(dpe => {
            // Utiliser _geopoint qui contient les vraies coordonnées GPS
            if (dpe._geopoint) {
              const [lat, lon] = dpe._geopoint.split(',').map(parseFloat)
              const distance = calculateDistance(
                communeCoords.mairie ? communeCoords.mairie.lat : communeCoords.lat,
                communeCoords.mairie ? communeCoords.mairie.lon : communeCoords.lon,
                lat,
                lon
              )
              dpe._tempDistance = Math.round(distance * 10) / 10
            }
          })
        }

        // Map results to our format
        results = await Promise.all(data.results.map(dpe => this.mapAdemeResult(dpe, searchRequest)))

        // Pas besoin de refiltrer, déjà strict dans la requête (±1%)
        // Les résultats sont déjà filtrés par l'API

        // Trier par score d'abord, puis par distance si égalité
        if (results.length > 0) {
          results.sort((a, b) => {
            const scoreDiff = b.matchScore - a.matchScore
            if (Math.abs(scoreDiff) > 5) {
              return scoreDiff // Trier par score si différence significative
            }
            // Si scores proches, trier par distance
            return (a.distance || 0) - (b.distance || 0)
          })
        }
      }

      if (results.length === 0) {
        // ÉTAPE 2: Recherche élargie avec geo_distance 15km et tolérance ±5%

        // Check if this is a class-based search
        const isClassSearch = energyClass && !consommationEnergie

        const step2Conditions = []

        if (isClassSearch) {
          // For class search, keep exact class filter
          step2Conditions.push(`etiquette_dpe:"${energyClass}"`)
          if (gesClass) {
            step2Conditions.push(`etiquette_ges:"${gesClass}"`)
          }
        } else {
          // For kWh search, use ranges
          const consoMin = consommationEnergie > 0 ? Math.round(consommationEnergie * 0.95) : null
          const consoMax = consommationEnergie > 0 ? Math.round(consommationEnergie * 1.05) : null
          const gesMin = emissionGES > 0 ? Math.round(emissionGES * 0.95) : null
          const gesMax = emissionGES > 0 ? Math.round(emissionGES * 1.05) : null

          if (consoMin && consoMax) {
            step2Conditions.push(`conso_5_usages_par_m2_ep:[${consoMin} TO ${consoMax}]`)
          }
          if (gesMin && gesMax) {
            step2Conditions.push(`emission_ges_5_usages_par_m2:[${gesMin} TO ${gesMax}]`)
          }
        }
        if (typeBien) {
          // Always include "immeuble" since it could be either type
          if (typeBien === 'maison') {
            step2Conditions.push(`(type_batiment:"maison" OR type_batiment:"immeuble")`)
          } else if (typeBien === 'appartement') {
            step2Conditions.push(`(type_batiment:"appartement" OR type_batiment:"immeuble")`)
          } else {
            step2Conditions.push(`type_batiment:"${typeBien}"`)
          }
        }

        // Ajouter le filtre de surface avec tolérance ±15% pour step 2
        if (surfaceHabitable && surfaceHabitable > 0) {
          const minSurface = Math.round(surfaceHabitable * 0.85)
          const maxSurface = Math.round(surfaceHabitable * 1.15)
          step2Conditions.push(`surface_habitable_logement:[${minSurface} TO ${maxSurface}]`)
        }

        const step2Query = step2Conditions.join(' AND ')
        const step2Params = new URLSearchParams({
          qs: step2Query,
          size: '100',
          sort: '-date_etablissement_dpe'
        })

        // Ajouter geo_distance si on a les coordonnées
        if (communeCoords) {
          // Ajuster le rayon en fonction de la couverture de la zone
          const adjustedRadius = 15000 + (communeCoords.radius || communeCoords.coverageRadius || 0) * 1000
          step2Params.append('geo_distance', `${communeCoords.lon}:${communeCoords.lat}:${adjustedRadius}`)
        }

        const step2Response = await fetch(`${url}?${step2Params}`)
        if (step2Response.ok) {
          const step2Data = await step2Response.json()

          if (step2Data.results && step2Data.results.length > 0) {
            // Calculer les distances si coordonnées disponibles
            if (communeCoords) {
              step2Data.results.forEach(dpe => {
                if (dpe._geopoint) {
                  const [lat, lon] = dpe._geopoint.split(',').map(parseFloat)
                  const distance = calculateDistance(
                    communeCoords.mairie ? communeCoords.mairie.lat : communeCoords.lat,
                    communeCoords.mairie ? communeCoords.mairie.lon : communeCoords.lon,
                    lat,
                    lon
                  )
                  dpe._tempDistance = Math.round(distance * 10) / 10
                }
              })
            }

            // Map results to our format
            results = await Promise.all(step2Data.results.map(dpe => this.mapAdemeResult(dpe, searchRequest)))

            // Pas besoin de refiltrer, déjà filtré à ±15% dans la requête

            if (results.length > 0) {
              // Trier par score d'abord, puis par distance si égalité
              results.sort((a, b) => {
                const scoreDiff = b.matchScore - a.matchScore
                if (Math.abs(scoreDiff) > 5) {
                  return scoreDiff // Trier par score si différence significative
                }
                // Si scores proches, trier par distance
                return (a.distance || 0) - (b.distance || 0)
              })
            }
          }
        }
      }

      if (results.length === 0) {
        // ÉTAPE 3: Recherche élargie avec geo_distance 30km et tolérance ±10%

        if (communeCoords) {
          // Variations plus larges: ±10% sur conso et GES
          const consoMin = consommationEnergie > 0 ? Math.round(consommationEnergie * 0.9) : null
          const consoMax = consommationEnergie > 0 ? Math.round(consommationEnergie * 1.1) : null
          const gesMin = emissionGES > 0 ? Math.round(emissionGES * 0.9) : null
          const gesMax = emissionGES > 0 ? Math.round(emissionGES * 1.1) : null

          const step3Conditions = []

          if (consoMin && consoMax) {
            step3Conditions.push(`conso_5_usages_par_m2_ep:[${consoMin} TO ${consoMax}]`)
          }
          if (gesMin && gesMax) {
            step3Conditions.push(`emission_ges_5_usages_par_m2:[${gesMin} TO ${gesMax}]`)
          }
          if (typeBien) {
            // Always include "immeuble" since it could be either type
            if (typeBien === 'maison') {
              step3Conditions.push(`(type_batiment:"maison" OR type_batiment:"immeuble")`)
            } else if (typeBien === 'appartement') {
              step3Conditions.push(`(type_batiment:"appartement" OR type_batiment:"immeuble")`)
            } else {
              step3Conditions.push(`type_batiment:"${typeBien}"`)
            }
          }

          // Ajouter le filtre de surface avec tolérance ±35% pour step 3
          if (surfaceHabitable && surfaceHabitable > 0) {
            const minSurface = Math.round(surfaceHabitable * 0.65)
            const maxSurface = Math.round(surfaceHabitable * 1.35)
            step3Conditions.push(`surface_habitable_logement:[${minSurface} TO ${maxSurface}]`)
          }

          const step3Query = step3Conditions.join(' AND ')
          // Ajuster le rayon en fonction de la couverture de la zone
          const adjustedRadius = 30000 + (communeCoords.radius || communeCoords.coverageRadius || 0) * 1000
          const step3Params = new URLSearchParams({
            qs: step3Query,
            size: '200', // Plus de résultats pour la recherche élargie
            sort: '-date_etablissement_dpe',
            geo_distance: `${communeCoords.lon}:${communeCoords.lat}:${adjustedRadius}`
          })

          const step3Response = await fetch(`${url}?${step3Params}`)
          if (step3Response.ok) {
            const step3Data = await step3Response.json()

            if (step3Data.results && step3Data.results.length > 0) {
              // Calculer les distances (déjà filtrées par geo_distance)
              if (communeCoords) {
                step3Data.results.forEach(dpe => {
                  if (dpe._geopoint) {
                    const [lat, lon] = dpe._geopoint.split(',').map(parseFloat)
                    const distance = calculateDistance(
                      communeCoords.mairie ? communeCoords.mairie.lat : communeCoords.lat,
                      communeCoords.mairie ? communeCoords.mairie.lon : communeCoords.lon,
                      lat,
                      lon
                    )
                    dpe._tempDistance = Math.round(distance * 10) / 10
                    dpe._searchScope = 'regional' // Marquer comme recherche régionale
                  }
                })
              }

              // Map results to our format
              results = await Promise.all(step3Data.results.map(dpe => this.mapAdemeResult(dpe, searchRequest)))

              // Les résultats sont déjà filtrés par geo_distance (30km) et surface (±35%)
              // Trier par score d'abord, puis par distance si égalité
              if (results.length > 0) {
                results.sort((a, b) => {
                  const scoreDiff = b.matchScore - a.matchScore
                  if (Math.abs(scoreDiff) > 5) {
                    return scoreDiff // Trier par score si différence significative
                  }
                  // Si scores proches, trier par distance
                  return (a.distance || 0) - (b.distance || 0)
                })
              }

              // Results processed successfully
            }
          }
        }

        // Si toujours rien, recherche fuzzy
        if (results.length === 0) {
          return await this.performFuzzySearch(searchRequest, communeCoords)
        }
      }

      // Filtrer par surface - mais être moins strict si peu de résultats
      if (surfaceHabitable && results.length > 5) {
        const tolerance = surfaceHabitable * 0.25 // 25% de tolérance si beaucoup de résultats
        const filtered = results.filter(r => Math.abs(r.surfaceHabitable - surfaceHabitable) <= tolerance)

        // Ne garder le filtre que s'il reste au moins 3 résultats
        if (filtered.length >= 3) {
          results = filtered
        } else {
          // Garder le tri par score, pas par surface
        }
      } else if (surfaceHabitable) {
        // Garder le tri par score existant
      }

      // Pour une recherche exacte avec des résultats, ne pas trop filtrer par score
      if (results.length > 0) {
        // Deduplicate results first
        results = this.deduplicateResults(results)

        // S'assurer que les résultats sont triés par score décroissant
        results.sort((a, b) => b.matchScore - a.matchScore)

        // Return ALL results
        return results
      }
    } catch (_error) {
      return []
    }
  }

  /**
   * Recherche élargie si pas de résultats exacts
   */
  async performFuzzySearch(searchRequest, communeCoords = null) {
    const { consommationEnergie, emissionGES, commune, typeBien, surfaceHabitable } = searchRequest

    // Use coordinates passed from main search function (no need to re-fetch)

    // Variations ±10% consommation, ±20% GES
    const consoVariations = consommationEnergie
      ? [Math.round(consommationEnergie * 0.9), consommationEnergie, Math.round(consommationEnergie * 1.1)]
      : [consommationEnergie]

    const gesVariations = emissionGES
      ? [Math.round(emissionGES * 0.8), emissionGES, Math.round(emissionGES * 1.2)].filter(v => v > 0)
      : [emissionGES]

    // Use postal code from coordinates if available, otherwise extract directly
    const codePostal = communeCoords?.postalCode || extractPostalCode(commune)
    const codeDepartement = codePostal ? codePostal.substring(0, 2) : null
    const results = []

    for (const conso of consoVariations) {
      for (const ges of gesVariations) {
        const conditions = []
        // Rechercher dans tout le département
        if (codeDepartement) {
          conditions.push(`code_postal_ban:${codeDepartement}*`)
        }
        if (conso) conditions.push(`conso_5_usages_par_m2_ep:${conso}`)
        if (ges) conditions.push(`emission_ges_5_usages_par_m2:${ges}`)
        if (typeBien) conditions.push(`type_batiment:"${typeBien}"`)

        const qsQuery = conditions.join(' AND ')

        try {
          const url = 'https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/lines'
          const params = new URLSearchParams({
            qs: qsQuery,
            size: '50' // Plus de résultats pour filtrer par distance
          })

          const response = await fetch(`${url}?${params}`)
          const data = await response.json()

          if (data.results) {
            for (const dpe of data.results) {
              // Calculer la distance avant le mapping pour le score
              if (communeCoords && dpe._geopoint) {
                const [lat, lon] = dpe._geopoint.split(',').map(parseFloat)
                const distance = calculateDistance(
                  communeCoords.mairie ? communeCoords.mairie.lat : communeCoords.lat,
                  communeCoords.mairie ? communeCoords.mairie.lon : communeCoords.lon,
                  lat,
                  lon
                )
                dpe._tempDistance = Math.round(distance * 10) / 10

                // Ne garder que les résultats dans un rayon de 25km
                if (distance <= 25) {
                  const result = await this.mapAdemeResult(dpe, searchRequest)
                  if (!results.find(r => r.numeroDPE === result.numeroDPE)) {
                    results.push(result)
                  }
                }
              } else if (!communeCoords) {
                // Si pas de coordonnées, garder tous les résultats
                const result = await this.mapAdemeResult(dpe, searchRequest)
                if (!results.find(r => r.numeroDPE === result.numeroDPE)) {
                  results.push(result)
                }
              }
            }
          }

          if (results.length >= 20) break
        } catch (_error) {}
      }
      if (results.length >= 10) break
    }

    // Filtrer par surface si spécifiée
    let filteredResults = results
    if (surfaceHabitable) {
      const tolerance = surfaceHabitable * 0.3 // 30% de tolérance pour fuzzy
      filteredResults = results.filter(r => Math.abs(r.surfaceHabitable - surfaceHabitable) <= tolerance)
    }

    // Trier par distance si disponible, sinon par score
    // Deduplicate results before sorting
    filteredResults = this.deduplicateResults(filteredResults)

    filteredResults.sort((a, b) => {
      if (a.distance !== undefined && b.distance !== undefined) {
        const distDiff = a.distance - b.distance
        if (Math.abs(distDiff) > 1) {
          return distDiff
        }
      }
      return b.matchScore - a.matchScore
    })

    // Return ALL results sorted by score
    return filteredResults
  }

  /**
   * Mapper résultat ADEME vers notre format
   */
  async mapAdemeResult(ademeData, searchRequest) {
    // Passer la distance temporaire pour le calcul du score
    if (ademeData._tempDistance !== undefined) {
      ademeData._distance = ademeData._tempDistance
    }

    // Passer le scope de recherche pour le calcul du score
    if (ademeData._searchScope) {
      // Keep the search scope for score calculation
    }

    const matchScore = await this.scoringService.calculateMatchScore(ademeData, searchRequest)
    const matchReasons = await this.scoringService.getMatchReasons(ademeData, searchRequest)

    // Extraire les vraies coordonnées GPS depuis _geopoint
    let latitude = null,
      longitude = null
    if (ademeData._geopoint) {
      ;[latitude, longitude] = ademeData._geopoint.split(',').map(parseFloat)
    }

    const result = {
      // Utiliser adresse_ban d'abord, mais ajouter le numéro de rue depuis adresse_brut si manquant
      adresseComplete: (() => {
        // Si adresse_ban a déjà un numéro, l'utiliser tel quel
        if (ademeData.adresse_ban && /^\d/.test(ademeData.adresse_ban.trim())) {
          return ademeData.adresse_ban
        }

        // Si adresse_ban n'a pas de numéro mais adresse_brut en a un, les combiner
        if (ademeData.adresse_ban && ademeData.adresse_brut && /^\d+/.test(ademeData.adresse_brut.trim())) {
          const streetNumber = ademeData.adresse_brut.match(/^\d+(?:\s*(?:bis|ter|quater|[a-z])?)?/i)[0].trim()
          return `${streetNumber} ${ademeData.adresse_ban}`
        }

        // Sinon utiliser adresse_ban ou adresse_brut comme solution de repli
        return ademeData.adresse_ban || ademeData.adresse_brut || 'Adresse non disponible'
      })(),
      codePostal: ademeData.code_postal_ban || ademeData.code_postal_brut?.toString() || '',
      commune: ademeData.nom_commune_ban || ademeData.nom_commune_brut || '',
      latitude,
      longitude,

      consommationEnergie: ademeData.conso_5_usages_par_m2_ep || 0,
      classeDPE: ademeData.etiquette_dpe || '',
      emissionGES: ademeData.emission_ges_5_usages_par_m2 || 0,

      typeBien: ademeData.type_batiment || ademeData.tr002_type_batiment_description || '',
      etage:
        ademeData.numero_etage_appartement !== undefined && ademeData.numero_etage_appartement !== null
          ? ademeData.numero_etage_appartement
          : null,
      nombreNiveaux: ademeData.nombre_niveau_logement || null,
      surfaceHabitable: ademeData.surface_habitable_logement || 0,
      anneeConstruction: ademeData.annee_construction || ademeData.periode_construction || null,
      complementRefLogement: ademeData.compl_ref_logement || ademeData.complement_adresse_logement || '',

      // Thermal characteristics
      ubat: ademeData.ubat_w_par_m2_k || null,
      classeInertie: ademeData.classe_inertie_batiment || '',

      // Detailed energy data
      consoDetails: {
        chauffage: ademeData.conso_chauffage_ep || 0,
        eauChaude: ademeData.conso_ecs_ep || 0,
        refroidissement: ademeData.conso_refroidissement_ep || 0,
        eclairage: ademeData.conso_eclairage_ep || 0,
        auxiliaires: ademeData.conso_auxiliaires_ep || 0
      },

      // System details
      systemeChauffage: ademeData.description_installation_chauffage_n1 || '',
      systemeECS: ademeData.description_installation_ecs_n1 || '',
      typeVentilation:
        ademeData.description_systeme_ventilation ||
        ademeData.type_ventilation ||
        (ademeData.ventilation_posterieure_2012 === 1
          ? 'Après 2012'
          : ademeData.ventilation_posterieure_2012 === 0
            ? 'Avant 2012'
            : ''),
      installationSolaire: ademeData.type_installation_solaire_n1 || '',

      // Insulation quality - keep raw values from ADEME
      isolationEnveloppe: ademeData.qualite_isolation_enveloppe || '',
      isolationMurs: ademeData.qualite_isolation_murs || '',
      isolationMenuiseries: ademeData.qualite_isolation_menuiseries || '',
      isolationPlancherBas: ademeData.qualite_isolation_plancher_bas || '',
      isolationToiture:
        ademeData.qualite_isolation_toiture ||
        ademeData.qualite_isolation_plancher_haut_comble_perdu ||
        (ademeData.isolation_toiture === 1 ? 'Oui' : ademeData.isolation_toiture === 0 ? 'Non' : ''),

      // Additional useful data
      hauteurSousPlafond: ademeData.hauteur_sous_plafond || null,
      logementTraversant:
        ademeData.logement_traversant === 1 ? 'Oui' : ademeData.logement_traversant === 0 ? 'Non' : '',

      matchScore,
      matchReasons,

      id: ademeData.numero_dpe || ademeData._id || '',
      numeroDPE: ademeData.numero_dpe || '',
      dateVisite: ademeData.date_etablissement_dpe,

      // Conserver toutes les données brutes pour le modal
      rawData: ademeData
    }

    // Ajouter la distance si elle existe
    if (ademeData._distance !== undefined) {
      result.distance = ademeData._distance
    }

    return result
  }

  /**
   * Wrapper pour maintenir la compatibilité
   * @param {string} communeInput - Code postal ou nom de commune
   * @returns {Promise<Object|null>} Coordonnées {lat, lon} ou null
   */
  async getCommuneCoordinates(communeInput) {
    return await getCommuneCoordinates(communeInput, this.loadDepartment.bind(this), this.departmentCache)
  }

  /**
   * Extraction code postal
   */
  async extractPostalCode(commune, communeCoords = null) {
    const postalCode = extractPostalCode(commune)
    if (postalCode) {
      return postalCode
    }
    // If coordinates already available, use them
    if (communeCoords?.postalCode) {
      return communeCoords.postalCode
    }
    // Fallback: get coordinates if not provided
    const coords = await this.getCommuneCoordinates(commune)
    return coords?.postalCode || commune
  }
}

export default DPESearchService
