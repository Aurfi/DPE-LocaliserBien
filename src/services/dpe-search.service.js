// Service pour intégrer avec notre API DPE backend
import DPELegacyService from './dpe-legacy.service'

class DPESearchService {
  constructor() {
    // Cache pour les départements chargés
    this.departmentCache = {}
    this.communesIndex = null
    this.loadIndex()

    // Initialiser le service legacy pour les données pré-2021
    this.legacyService = new DPELegacyService()
  }

  async loadIndex() {
    try {
      const response = await fetch('/data/communes-index.json')
      this.communesIndex = await response.json()
    } catch (_error) {
      this.communesIndex = null
    }
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
  async enrichResultsWithCorrectAddresses(results) {
    // Utiliser l'API gouvernementale - stable et fiable
    const enrichedResults = []

    // Enrichir seulement les 3 premiers résultats pour éviter la limitation de taux
    const resultsToEnrich = results.slice(0, 3)
    const remainingResults = results.slice(3)

    // Traiter seulement les 3 premiers résultats
    for (let i = 0; i < resultsToEnrich.length; i++) {
      const batch = [resultsToEnrich[i]]
      const promises = batch.map(async result => {
        if (result.latitude && result.longitude) {
          try {
            // Utiliser l'API gouvernementale
            const response = await fetch(
              `https://api-adresse.data.gouv.fr/reverse/?lon=${result.longitude}&lat=${result.latitude}`
            )

            // Vérifier la limitation de taux
            if (response.status === 429) {
              // Limitation de taux atteinte pour le géocodage inverse, utilisation de l'adresse originale
              return result
            }

            const data = await response.json()

            if (data?.features && data.features.length > 0) {
              const props = data.features[0].properties

              // Construire le format d'affichage : "District" s'il contient le nom de la ville, sinon "District, Ville"
              let displayCommune = props.city || result.commune
              if (props.district) {
                // Vérifier si le district contient déjà le nom de la ville
                if (props.district.includes(displayCommune)) {
                  displayCommune = props.district // Utiliser juste le district (ex. "Paris 4e Arrondissement")
                } else if (props.district !== displayCommune) {
                  displayCommune = `${props.district}, ${displayCommune}` // Les deux si différents
                }
              }

              return {
                ...result,
                // Garder les valeurs ADEME originales inchangées pour le scoring
                // Ajouter des champs d'affichage uniquement avec le suffixe 'Display'
                codePostalDisplay: props.postcode || result.codePostal,
                communeDisplay: displayCommune,
                suburb: props.district || '',
                // Garder les originaux pour référence
                codePostalADEME: result.codePostal,
                communeADEME: result.commune
              }
            }
          } catch (_error) {
            // Erreur lors de la récupération de l'adresse correcte - échouer silencieusement
          }
        }
        return result
      })

      const batchResults = await Promise.all(promises)
      enrichedResults.push(...batchResults)
    }

    // Ajouter les résultats restants sans enrichissement pour éviter la limitation de taux
    enrichedResults.push(...remainingResults)

    return enrichedResults
  }

  /**
   * Recherche DPE en appelant notre service backend
   * @param {Object} searchRequest - Critères de recherche
   * @returns {Promise<Object>} - Résultats de la recherche
   */
  async search(searchRequest) {
    try {
      // Pour l'instant, on simule un appel à notre service Node.js existant
      // En attendant la mise en place d'une véritable API REST

      // Simulation de la recherche avec nos données réelles
      const searchResults = await this.simulateSearch(searchRequest)

      // Les moyennes départementales sont chargées au niveau de la vue (Home.vue)
      // via les JSON statiques; on ne renseigne plus localAverages ici.
      searchResults.localAverages = null

      return searchResults
    } catch (_error) {
      throw new Error('Impossible de contacter le service de recherche DPE')
    }
  }

  /**
   * Simulation temporaire qui utilise notre logique existante
   * @param {Object} searchRequest
   * @returns {Promise<Object>}
   */
  async simulateSearch(searchRequest) {
    // Importer dynamiquement notre service existant
    // (en attendant une vraie API)

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
    } else if (communeCoords && searchRequest.commune) {
      // Essayer d'obtenir le code postal à partir des données de la commune
      postalCode = await this.getPostalCodeForCommune(searchRequest.commune)
    }

    // Simulation avec nos vraies stratégies de recherche
    let results = await this.performRealSearch(searchRequest)

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
      searchStrategy: this.determineStrategy(results),
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
   * @param {string|number} value - Value that may have < or > operator
   * @returns {Object} - {operator: '<'|'>'|'=', value: number}
   */
  parseComparisonValue(value) {
    if (!value) return null

    const strValue = value.toString().trim()

    // Vérifier l'opérateur <
    if (strValue.startsWith('<')) {
      const num = parseInt(strValue.substring(1), 10)
      return { operator: '<', value: num }
    }

    // Vérifier l'opérateur >
    if (strValue.startsWith('>')) {
      const num = parseInt(strValue.substring(1), 10)
      return { operator: '>', value: num }
    }

    // Aucun opérateur, correspondance exacte
    const num = parseInt(strValue, 10)
    return { operator: '=', value: num }
  }

  /**
   * Convert comparison to range query
   * @param {Object} comparison - {operator, value}
   * @param {string} fieldName - Field name for the query
   * @returns {string} - Range query string or exact value
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
   * Géocoder une adresse ou nom de commune via l'API gouvernementale
   * @param {string} address - Adresse ou nom de commune
   * @returns {Promise<Object>} Coordonnées et informations
   */
  async geocodeAddress(address) {
    try {
      const response = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(address)}&limit=1`)
      const data = await response.json()

      if (data.features && data.features.length > 0) {
        const feature = data.features[0]
        const [lon, lat] = feature.geometry.coordinates
        const postalCode = feature.properties.postcode
        const city = feature.properties.city
        return {
          lat,
          lon,
          formattedAddress: feature.properties.label,
          postalCode,
          city,
          centre: { lat, lon },
          mairie: { lat, lon },
          radius: 0,
          coverageRadius: 0,
          isMultiCommune: false
        }
      }
      return null
    } catch (_error) {
      return null
    }
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
  async performRealSearch(searchRequest) {
    const { consommationEnergie, energyClass, commune, emissionGES, gesClass, surfaceHabitable, typeBien } =
      searchRequest

    // Obtenir les coordonnées de la commune recherchée
    let communeCoords = await this.getCommuneCoordinates(commune)

    // Si pas de coordonnées trouvées localement et qu'on a un nom de commune, essayer avec l'API de géocodage
    if (!communeCoords && commune && !/^\d{5}$/.test(commune)) {
      communeCoords = await this.geocodeAddress(commune)
    }

    // Si on a toujours pas de coordonnées pour un nom de commune, on ne peut pas faire de recherche fiable
    if (commune && !/^\d{5}$/.test(commune) && !communeCoords) {
      // Retourner un résultat vide avec un message d'erreur approprié
      return []
    }

    // Construction de la requête vers l'API ADEME
    let codePostal = this.extractPostalCode(commune)

    // Si on a trouvé des coordonnées via géocodage, utiliser le code postal trouvé
    if (!codePostal && communeCoords && communeCoords.postalCode) {
      codePostal = communeCoords.postalCode
    }

    const _codeDepartement = codePostal ? codePostal.substring(0, 2) : null

    // ÉTAPE 1: Recherche STRICTE - critères exacts
    const conditions = []

    if (/^\d{5}$/.test(commune)) {
      // Si c'est un code postal - rechercher dans les deux champs
      const sanitizedPostal = this.sanitizeForQuery(commune)
      conditions.push(`(code_postal_ban:"${sanitizedPostal}" OR code_postal_brut:"${sanitizedPostal}")`)
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
              const distance = this.calculateDistance(
                communeCoords.mairie ? communeCoords.mairie.lat : communeCoords.lat,
                communeCoords.mairie ? communeCoords.mairie.lon : communeCoords.lon,
                lat,
                lon
              )
              dpe._tempDistance = Math.round(distance * 10) / 10
            }
          })
        }

        // Map results WITHOUT enrichment (will be done later for top 3 only)
        results = data.results.map(dpe => this.mapAdemeResult(dpe, searchRequest))

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
                  const distance = this.calculateDistance(
                    communeCoords.mairie ? communeCoords.mairie.lat : communeCoords.lat,
                    communeCoords.mairie ? communeCoords.mairie.lon : communeCoords.lon,
                    lat,
                    lon
                  )
                  dpe._tempDistance = Math.round(distance * 10) / 10
                }
              })
            }

            // Map results WITHOUT enrichment (will be done later for top 3 only)
            results = step2Data.results.map(dpe => this.mapAdemeResult(dpe, searchRequest))

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
                    const distance = this.calculateDistance(
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

              // Map results WITHOUT enrichment (will be done later for top 3 only)
              results = step3Data.results.map(dpe => this.mapAdemeResult(dpe, searchRequest))

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
          return await this.performFuzzySearch(searchRequest)
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

        // Return ALL results (enrichResultsWithCorrectAddresses already limits enrichment to top 3)
        return await this.enrichResultsWithCorrectAddresses(results)
      }
    } catch (_error) {
      return []
    }
  }

  /**
   * Recherche élargie si pas de résultats exacts
   */
  async performFuzzySearch(searchRequest) {
    const { consommationEnergie, emissionGES, commune, typeBien, surfaceHabitable } = searchRequest

    // Obtenir les coordonnées de la commune recherchée
    const communeCoords = await this.getCommuneCoordinates(commune)

    // Variations ±10% consommation, ±20% GES
    const consoVariations = consommationEnergie
      ? [Math.round(consommationEnergie * 0.9), consommationEnergie, Math.round(consommationEnergie * 1.1)]
      : [consommationEnergie]

    const gesVariations = emissionGES
      ? [Math.round(emissionGES * 0.8), emissionGES, Math.round(emissionGES * 1.2)].filter(v => v > 0)
      : [emissionGES]

    const codePostal = this.extractPostalCode(commune)
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
            data.results.forEach(dpe => {
              // Calculer la distance avant le mapping pour le score
              if (communeCoords && dpe._geopoint) {
                const [lat, lon] = dpe._geopoint.split(',').map(parseFloat)
                const distance = this.calculateDistance(
                  communeCoords.mairie ? communeCoords.mairie.lat : communeCoords.lat,
                  communeCoords.mairie ? communeCoords.mairie.lon : communeCoords.lon,
                  lat,
                  lon
                )
                dpe._tempDistance = Math.round(distance * 10) / 10

                // Ne garder que les résultats dans un rayon de 25km
                if (distance <= 25) {
                  const result = this.mapAdemeResult(dpe, searchRequest)
                  if (!results.find(r => r.numeroDPE === result.numeroDPE)) {
                    results.push(result)
                  }
                }
              } else if (!communeCoords) {
                // Si pas de coordonnées, garder tous les résultats
                const result = this.mapAdemeResult(dpe, searchRequest)
                if (!results.find(r => r.numeroDPE === result.numeroDPE)) {
                  results.push(result)
                }
              }
            })
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

    // Return ALL results sorted by score (enrichResultsWithCorrectAddresses already limits enrichment to top 3)
    return await this.enrichResultsWithCorrectAddresses(filteredResults)
  }

  /**
   * Mapper résultat ADEME avec enrichissement Photon
   */
  async mapAdemeResultWithEnrichment(ademeData, searchRequest) {
    const result = this.mapAdemeResult(ademeData, searchRequest)

    // Enrich with government API if we have coordinates
    if (result.latitude && result.longitude) {
      try {
        const response = await fetch(
          `https://api-adresse.data.gouv.fr/reverse/?lon=${result.longitude}&lat=${result.latitude}`
        )

        // Check for rate limiting
        if (response.status === 429) {
          // Rate limit hit for reverse geocoding, using original address
          return result
        }

        const data = await response.json()

        if (data?.features && data.features.length > 0) {
          const props = data.features[0].properties

          // Build display format: "District" if it contains city name, otherwise "District, City"
          let displayCommune = props.city || result.commune
          if (props.district) {
            // Check if district already contains the city name
            if (props.district.includes(displayCommune)) {
              displayCommune = props.district // Just use district (e.g. "Paris 4e Arrondissement")
            } else if (props.district !== displayCommune) {
              displayCommune = `${props.district}, ${displayCommune}` // Both if different
            }
          }

          return {
            ...result,
            codePostalDisplay: props.postcode || result.codePostal,
            communeDisplay: displayCommune,
            suburb: props.district || '',
            codePostalADEME: result.codePostal,
            communeADEME: result.commune
          }
        }
      } catch (_error) {
        // Silent fail, just return unenriched result
      }
    }

    return result
  }

  /**
   * Mapper résultat ADEME vers notre format
   */
  mapAdemeResult(ademeData, searchRequest) {
    // Passer la distance temporaire pour le calcul du score
    if (ademeData._tempDistance !== undefined) {
      ademeData._distance = ademeData._tempDistance
    }

    // Passer le scope de recherche pour le calcul du score
    if (ademeData._searchScope) {
      // Keep the search scope for score calculation
    }

    const matchScore = this.calculateMatchScore(ademeData, searchRequest)
    const matchReasons = this.getMatchReasons(ademeData, searchRequest)

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
   * Calcul du score de matching
   */
  calculateMatchScore(ademeData, searchRequest) {
    let baseScore = 0
    let multiplier = 1.0

    // 1. EMPLACEMENT (10 points) - Vérifier à la fois le code postal ET le nom de la ville
    const codePostalRequest = this.extractPostalCode(searchRequest.commune)
    const codePostalDPE = ademeData.code_postal_ban || ademeData.code_postal_brut?.toString()

    // Extraire le nom de commune de la demande de recherche (supprimer le code postal si présent)
    let communeRequest = searchRequest.commune?.toLowerCase().trim()
    if (codePostalRequest) {
      // Supprimer le code postal de la chaîne de commune
      communeRequest = communeRequest.replace(codePostalRequest, '').trim()
    }

    // Obtenir les noms de commune DPE
    const communeDPE = (ademeData.nom_commune_ban || ademeData.nom_commune_brut || '').toLowerCase().trim()
    const adresseCompleteDPE = (ademeData.adresse_ban || ademeData.adresse_brut || '').toLowerCase()

    // Vérifier la correspondance d'emplacement
    if (codePostalRequest && codePostalRequest === codePostalDPE) {
      baseScore += 10 // Correspondance du code postal
    } else if (
      communeRequest &&
      (communeDPE.includes(communeRequest) ||
        communeRequest.includes(communeDPE) ||
        adresseCompleteDPE.includes(communeRequest))
    ) {
      baseScore += 10 // Correspondance du nom de ville quand pas de code postal
    }

    // Analyser les valeurs de comparaison pour obtenir des valeurs numériques pour le scoring
    const parsedConso = searchRequest.consommationEnergie
      ? this.parseComparisonValue(searchRequest.consommationEnergie)
      : null
    const parsedGES = searchRequest.emissionGES ? this.parseComparisonValue(searchRequest.emissionGES) : null
    const parsedSurface = searchRequest.surfaceHabitable
      ? this.parseComparisonValue(searchRequest.surfaceHabitable)
      : null

    // Vérifier si la recherche se fait par classe ou par valeurs kWh exactes
    const isClassSearch = searchRequest.energyClass && !searchRequest.consommationEnergie

    if (isClassSearch) {
      // RECHERCHE PAR CLASSE - Conserver le scoring original pour les classes

      // SURFACE (30 points)
      if (parsedSurface?.value && ademeData.surface_habitable_logement) {
        const surfaceDiff = Math.abs(ademeData.surface_habitable_logement - parsedSurface.value)
        const surfacePercent = (surfaceDiff / parsedSurface.value) * 100

        if (surfaceDiff <= 1) {
          baseScore += 30
        } else if (surfacePercent <= 100) {
          baseScore += 30 - 15 * (surfacePercent / 100)
        } else {
          baseScore += 15
          multiplier *= 0.5 // >100% de différence limite le score à 50%
        }
      }

      // CLASSE ÉNERGÉTIQUE (40 points)
      if (searchRequest.energyClass && ademeData.etiquette_dpe) {
        const requestClass = searchRequest.energyClass.toUpperCase()
        const dpeClass = ademeData.etiquette_dpe.toUpperCase()

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

      // CLASSE GES (20 points)
      if (searchRequest.gesClass && ademeData.etiquette_ges) {
        const requestGES = searchRequest.gesClass.toUpperCase()
        const dpeGES = ademeData.etiquette_ges.toUpperCase()

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
      // RECHERCHE PAR VALEUR EXACTE - Nouveau scoring adaptatif

      // 2. SCORING SURFACE (jusqu'à 90 points quand kWh/GES sont parfaits)
      if (parsedSurface?.value && ademeData.surface_habitable_logement) {
        const surfaceDiff = Math.abs(ademeData.surface_habitable_logement - parsedSurface.value)
        const surfacePercent = (surfaceDiff / parsedSurface.value) * 100

        if (surfaceDiff <= 1) {
          baseScore += 90 // Correspondance parfaite de surface
        } else if (surfacePercent <= 90) {
          // Proportionnel direct : 9% de différence = 9 points de baisse
          baseScore += 90 - surfacePercent
        } else if (surfacePercent <= 100) {
          // Score très faible pour 90-100% de différence
          baseScore += Math.max(0, 10 - (surfacePercent - 90))
        } else {
          // >100% de différence obtient 0 points et limite le score total
          baseScore += 0
          multiplier *= 0.5 // Limiter le score total à 50%
        }
      }

      // 3. PÉNALITÉS ÉNERGIE/GES - Appliquées comme multiplicateurs

      // Pénalité KWH
      if (parsedConso?.value && ademeData.conso_5_usages_par_m2_ep) {
        const kwhDiff = Math.abs(ademeData.conso_5_usages_par_m2_ep - parsedConso.value)

        if (kwhDiff === 0) {
          // Correspondance parfaite - aucune pénalité
        } else if (kwhDiff === 1) {
          multiplier *= 0.75 // 1 kWh d'écart = max 75%
        } else if (kwhDiff <= 9) {
          // Diminution douce de 75% à 60% pour 2-9 kWh de différence
          const factor = 0.75 - (0.15 * (kwhDiff - 1)) / 8
          multiplier *= factor
        } else {
          // >9 kWh d'écart = pénalité sévère
          multiplier *= Math.max(0.3, 0.6 - (kwhDiff - 9) * 0.03)
        }
      }

      // Pénalité GES (même logique)
      if (parsedGES?.value && ademeData.emission_ges_5_usages_par_m2) {
        const gesDiff = Math.abs(ademeData.emission_ges_5_usages_par_m2 - parsedGES.value)

        if (gesDiff === 0) {
          // Correspondance parfaite - aucune pénalité
        } else if (gesDiff === 1) {
          multiplier *= 0.75 // 1 GES d'écart = max 75%
        } else if (gesDiff <= 9) {
          // Diminution douce de 75% à 60% pour 2-9 GES de différence
          const factor = 0.75 - (0.15 * (gesDiff - 1)) / 8
          multiplier *= factor
        } else {
          // >9 GES d'écart = pénalité sévère
          multiplier *= Math.max(0.3, 0.6 - (gesDiff - 9) * 0.03)
        }
      }
    }

    const finalScore = Math.round(baseScore * multiplier)
    // S'assurer qu'on ne retourne jamais NaN, retourner 0 à la place
    return Number.isNaN(finalScore) ? 0 : finalScore
  }

  /**
   * Raisons du matching pour affichage
   */
  getMatchReasons(ademeData, searchRequest) {
    const reasons = []

    // Parse comparison values to get numeric values
    const parsedConso = searchRequest.consommationEnergie
      ? this.parseComparisonValue(searchRequest.consommationEnergie)
      : null
    const parsedGES = searchRequest.emissionGES ? this.parseComparisonValue(searchRequest.emissionGES) : null
    const parsedSurface = searchRequest.surfaceHabitable
      ? this.parseComparisonValue(searchRequest.surfaceHabitable)
      : null

    // Check if this is a class-based search
    const isClassSearch = searchRequest.energyClass && !searchRequest.consommationEnergie

    if (isClassSearch) {
      // Class-based matches
      if (searchRequest.energyClass && ademeData.etiquette_dpe) {
        const requestClass = searchRequest.energyClass.toUpperCase()
        const dpeClass = ademeData.etiquette_dpe.toUpperCase()

        if (requestClass === dpeClass) {
          reasons.push(`Classe énergétique exacte: ${dpeClass}`)
        } else {
          const classes = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
          const requestIndex = classes.indexOf(requestClass)
          const dpeIndex = classes.indexOf(dpeClass)
          const classDiff = Math.abs(requestIndex - dpeIndex)

          if (classDiff <= 2) {
            reasons.push(`Classe énergétique: ${dpeClass} (recherche: ${requestClass})`)
          }
        }
      }

      if (searchRequest.gesClass && ademeData.etiquette_ges) {
        const requestGES = searchRequest.gesClass.toUpperCase()
        const dpeGES = ademeData.etiquette_ges.toUpperCase()

        if (requestGES === dpeGES) {
          reasons.push(`Classe GES exacte: ${dpeGES}`)
        } else {
          const classes = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
          const requestIndex = classes.indexOf(requestGES)
          const dpeIndex = classes.indexOf(dpeGES)
          const classDiff = Math.abs(requestIndex - dpeIndex)

          if (classDiff <= 2) {
            reasons.push(`Classe GES: ${dpeGES} (recherche: ${requestGES})`)
          }
        }
      }
    } else {
      // Exact value matches
      if (parsedConso && parsedConso.value === ademeData.conso_5_usages_par_m2_ep) {
        reasons.push(`Consommation exacte: ${parsedConso.value} kWh/m²/an`)
      }

      if (parsedGES && parsedGES.value === ademeData.emission_ges_5_usages_par_m2) {
        reasons.push(`GES exact: ${parsedGES.value} kgCO²/m²/an`)
      }
    }

    if (parsedSurface?.value && ademeData.surface_habitable_logement) {
      const ecart = Math.abs(ademeData.surface_habitable_logement - parsedSurface.value)
      const pourcent = Math.round((ecart / parsedSurface.value) * 100)
      reasons.push(`Surface: ${ademeData.surface_habitable_logement}m² (écart: ${pourcent}%)`)
    }

    const codePostalRequest = this.extractPostalCode(searchRequest.commune)
    const codePostalDPE = ademeData.code_postal_ban || ademeData.code_postal_brut?.toString()
    if (codePostalRequest === codePostalDPE) {
      reasons.push('Commune exacte')
    }

    return reasons
  }

  /**
   * Détermine la stratégie utilisée
   */
  determineStrategy(results) {
    if (!results || results.length === 0) return 'AUCUN'

    const hasExactMatch = results.some(r => r.matchScore >= 95)
    if (hasExactMatch) return 'ULTRA_PRECIS'

    const hasGoodMatch = results.some(r => r.matchScore >= 80)
    if (hasGoodMatch) return 'PRECIS'

    return 'ELARGI'
  }

  /**
   * Calcul de distance entre deux points GPS (formule de Haversine)
   * @param {number} lat1 - Latitude point 1
   * @param {number} lon1 - Longitude point 1
   * @param {number} lat2 - Latitude point 2
   * @param {number} lon2 - Longitude point 2
   * @returns {number} Distance en kilomètres
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    // Vérifier que toutes les coordonnées sont valides
    if (Number.isNaN(lat1) || Number.isNaN(lon1) || Number.isNaN(lat2) || Number.isNaN(lon2)) {
      return 0
    }

    const R = 6371 // Rayon de la Terre en km
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  /**
   * Obtenir les coordonnées GPS d'une commune en utilisant l'API Geo pour les coordonnées de la mairie
   * Gère les codes postaux multi-communes avec centre pondéré et rayon de couverture
   * @param {string} communeInput - Code postal ou nom de commune
   * @returns {Promise<Object|null>} Coordonnées {lat, lon, coverageRadius} ou null
   */
  async getCommuneCoordinatesFromAPI(communeInput) {
    if (!communeInput || !this.communesIndex) return null

    try {
      const isPostalCode = /^\d{5}$/.test(communeInput)
      let deptCode = null
      let deptData = null

      // Si c'est un code postal
      if (isPostalCode) {
        deptCode = this.communesIndex.postalCodeToDepartment[communeInput]
        if (!deptCode) {
          return null
        }

        // Charger le département
        deptData = await this.loadDepartment(deptCode)
        if (!deptData) return null

        const postalData = deptData.postalCodes[communeInput]
        if (!postalData) return null

        // Si plusieurs communes partagent ce code postal
        if (postalData.communeCount > 1) {
          return {
            // Pour les requêtes ADEME, utiliser le centre
            lat: postalData.center[1],
            lon: postalData.center[0],
            // Coordonnées pour l'affichage
            centre: { lat: postalData.center[1], lon: postalData.center[0] },
            mairie: { lat: postalData.center[1], lon: postalData.center[0] },
            radius: 0,
            coverageRadius: postalData.coverageRadius,
            isMultiCommune: true,
            communes: postalData.communes,
            communeCount: postalData.communeCount
          }
        }

        // Une seule commune pour ce code postal
        const communeName = postalData.communes[0]
        const commune = deptData.communes.find(c => c.nom === communeName)

        if (!commune) return null

        return {
          // Pour les requêtes ADEME, utiliser le centre géométrique
          lat: commune.centre.coordinates[1],
          lon: commune.centre.coordinates[0],
          // Coordonnées complètes
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
      } else {
        // Recherche par nom de commune
        // Mapper les grandes villes vers leurs départements
        const cityToDept = {
          paris: '75',
          marseille: '13',
          lyon: '69',
          toulouse: '31',
          nice: '06',
          'aix-en-provence': '13',
          'aix en provence': '13',
          montpellier: '34',
          strasbourg: '67',
          bordeaux: '33',
          lille: '59',
          nantes: '44',
          rennes: '35',
          reims: '51',
          toulon: '83',
          'saint-etienne': '42',
          'le havre': '76',
          grenoble: '38',
          dijon: '21',
          angers: '49',
          nimes: '30',
          'clermont-ferrand': '63',
          'le mans': '72',
          brest: '29',
          tours: '37',
          limoges: '87',
          amiens: '80',
          perpignan: '66',
          metz: '57',
          besancon: '25',
          orleans: '45',
          rouen: '76',
          mulhouse: '68',
          caen: '14',
          nancy: '54',
          avignon: '84',
          poitiers: '86',
          'fort-de-france': '972',
          cayenne: '973',
          'saint-denis': '974'
        }

        const normalizedName = communeInput.toLowerCase().trim()
        deptCode = cityToDept[normalizedName]

        if (deptCode) {
          deptData = await this.loadDepartment(deptCode)
          if (deptData) {
            const commune = deptData.communes.find(
              c => c.nom.toLowerCase() === normalizedName || c.nom.toLowerCase().includes(normalizedName)
            )

            if (commune) {
              return {
                // Pour les requêtes ADEME
                lat: commune.centre.coordinates[1],
                lon: commune.centre.coordinates[0],
                // Coordonnées complètes
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
        }

        // Si pas trouvé, chercher dans le cache
        for (const [_code, data] of Object.entries(this.departmentCache)) {
          const commune = data.communes.find(
            c => c.nom.toLowerCase() === normalizedName || c.nom.toLowerCase().includes(normalizedName)
          )

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

        return null
      }
    } catch (_error) {}

    return null
  }

  /**
   * Fallback: obtenir les coordonnées depuis la base locale
   * @param {string} communeInput - Code postal ou nom de commune
   * @returns {Object|null} Coordonnées {lat, lon} ou null
   */
  getCommuneCoordinatesFromLocal(communeInput) {
    if (!communeInput || !this.communes || this.communes.length === 0) return null

    // Si c'est un code postal (5 chiffres)
    if (/^\d{5}$/.test(communeInput)) {
      const commune = this.communes.find(c => c.codesPostaux?.includes(communeInput))
      if (commune?.centre) {
        return {
          lat: commune.centre.coordinates[1],
          lon: commune.centre.coordinates[0]
        }
      }
    }

    // Sinon chercher par nom de commune
    const normalized = communeInput.toLowerCase().trim()
    const commune = this.communes.find(c => c.nom && c.nom.toLowerCase() === normalized)
    if (commune?.centre) {
      return {
        lat: commune.centre.coordinates[1],
        lon: commune.centre.coordinates[0]
      }
    }

    return null
  }

  /**
   * Wrapper pour maintenir la compatibilité
   * @param {string} communeInput - Code postal ou nom de commune
   * @returns {Promise<Object|null>} Coordonnées {lat, lon} ou null
   */
  async getCommuneCoordinates(communeInput) {
    return await this.getCommuneCoordinatesFromAPI(communeInput)
  }

  /**
   * Extraction code postal
   */
  extractPostalCode(commune) {
    if (/^\d{5}$/.test(commune)) {
      return commune
    }

    // Dictionnaire des principales villes (simplifié)
    const mainCities = {
      paris: '75001',
      marseille: '13001',
      lyon: '69001',
      toulouse: '31000',
      nice: '06000',
      nantes: '44000',
      montpellier: '34000',
      strasbourg: '67000',
      bordeaux: '33000',
      lille: '59000',
      'aix-en-provence': '13100'
    }

    const normalized = commune.toLowerCase().replace(/[-\s]/g, '-')
    return mainCities[normalized] || commune
  }

  /**
   * Get postal code for a commune name
   * @param {string} communeName - Name of the commune
   * @returns {Promise<string|null>} Postal code or null
   */
  async getPostalCodeForCommune(communeName) {
    if (!communeName || !this.communesIndex) return null

    try {
      // If it's already a postal code
      if (/^\d{5}$/.test(communeName)) {
        return communeName
      }

      // Try to find in our index
      const normalizedName = communeName.toLowerCase().trim()

      // Search through all departments
      for (const [deptCode, _deptInfo] of Object.entries(this.communesIndex.departments)) {
        const deptData = await this.loadDepartment(deptCode)
        if (!deptData) continue

        // Search in communes
        for (const [_communeCode, commune] of Object.entries(deptData.communes)) {
          if (commune.nom.toLowerCase() === normalizedName) {
            // Return the first postal code for this commune
            if (commune.codesPostaux && commune.codesPostaux.length > 0) {
              return commune.codesPostaux[0]
            }
          }
        }
      }

      // Try main cities dictionary as fallback
      return this.extractPostalCode(communeName)
    } catch (_error) {
      return null
    }
  }
}

export default DPESearchService
