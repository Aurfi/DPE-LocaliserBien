/**
 * Service pour rechercher les données DPE pré-2021 (avant juillet 2021)
 * Utilise le jeu de données dpe-france avec des noms de champs différents
 */

import { getDepartmentFromPostalCode } from '../utils/geoUtils.js'

class DPELegacyService {
  constructor() {
    this.baseURL = 'https://data.ademe.fr/data-fair/api/v1/datasets/dpe-france/lines'
    this.departmentCache = {}
  }

  /**
   * Charger les données de département depuis un fichier JSON local
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
   * Obtenir les codes INSEE pour un code postal ou nom de commune donné
   * Pour les codes postaux multi-communes, retourne la plus grande commune par population
   * @param {string} commune - Code postal ou nom de commune
   * @returns {Promise<Array>} Tableau des codes INSEE
   */
  async getINSEECodes(commune) {
    if (!commune) return []

    try {
      const isPostalCode = /^\d{5}$/.test(commune)

      if (isPostalCode) {
        // Obtenir le département depuis le code postal
        const deptCode = getDepartmentFromPostalCode(commune)
        if (!deptCode) return []

        // Charger les données du département
        const deptData = await this.loadDepartment(deptCode)
        if (!deptData) return []

        // Trouver toutes les communes avec ce code postal
        const matchingCommunes = deptData.communes.filter(c => c.codesPostaux?.includes(commune))

        if (matchingCommunes.length === 0) return []

        // Pour plusieurs communes, prendre celle avec la plus haute population
        if (matchingCommunes.length > 1) {
          const biggest = matchingCommunes.reduce((prev, current) =>
            current.population > prev.population ? current : prev
          )
          return [biggest.code]
        }

        return [matchingCommunes[0].code]
      } else {
        // Rechercher par nom de commune dans TOUS les départements
        const normalizedSearch = commune.toLowerCase().trim()

        // Vérifier d'abord les départements en cache
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

        // Rechercher tous les départements (01 à 95 + 2A, 2B pour la Corse)
        const allDeptCodes = []
        for (let i = 1; i <= 95; i++) {
          const code = i.toString().padStart(2, '0')
          if (!this.departmentCache[code]) {
            allDeptCodes.push(code)
          }
        }
        // Ajouter la Corse si pas en cache
        if (!this.departmentCache['2A']) allDeptCodes.push('2A')
        if (!this.departmentCache['2B']) allDeptCodes.push('2B')

        // Rechercher dans chaque département non mis en cache
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
   * Analyser la valeur de comparaison (comme le service principal)
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
   * Construire la requête de plage (comme le service principal)
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
   * Rechercher dans la base de données DPE legacy avec plusieurs stratégies
   * @param {Object} searchRequest - Paramètres de recherche
   * @param {boolean} hasPostResults - Si la recherche post-2021 a trouvé des résultats
   * @returns {Promise<Object>} Résultats de recherche
   */
  async searchLegacy(searchRequest, hasPostResults = false) {
    try {
      // Ne pas rechercher si nous avons déjà des correspondances parfaites en post-2021
      if (hasPostResults) {
        return { results: [], fromLegacy: true, skipped: true }
      }

      const startTime = Date.now()

      // Obtenir les codes INSEE pour l'emplacement
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

      // Vérifier s'il s'agit d'une recherche par classe
      const isClassSearch = searchRequest.energyClass && !searchRequest.consommationEnergie

      // Suivre tous les numéros DPE pour éviter les doublons
      const seenDPEs = new Set()
      const allResults = []

      // Fonction d'aide pour ajouter des résultats uniques
      const addUniqueResults = (newResults, _strategy) => {
        let added = 0
        for (const result of newResults) {
          const dpeNum = result.numero_dpe
          if (dpeNum && !seenDPEs.has(dpeNum)) {
            seenDPEs.add(dpeNum)
            allResults.push(result)
            added++
          } else if (!dpeNum) {
            // Ajouter les résultats sans numéro DPE (impossible de dédupliquer)
            allResults.push(result)
            added++
          }
        }
        return added > 0
      }

      // ÉTAPE 1 : Recherche stricte (tolérance de surface ±1%)
      const strictConditions = []

      // Filtre code INSEE
      strictConditions.push(`code_insee_commune_actualise:"${inseeCodes[0]}"`)

      // Consommation d'énergie ou classe
      if (isClassSearch && searchRequest.energyClass) {
        strictConditions.push(`classe_consommation_energie:"${searchRequest.energyClass.toUpperCase()}"`)
      } else if (searchRequest.consommationEnergie) {
        const consoComparison = this.parseComparisonValue(searchRequest.consommationEnergie)
        if (consoComparison && consoComparison.value > 0) {
          const query = this.buildRangeQuery(consoComparison, 'consommation_energie')
          if (query) strictConditions.push(query)
        }
      }

      // Émissions GES ou classe
      if (searchRequest.gesClass) {
        strictConditions.push(`classe_estimation_ges:"${searchRequest.gesClass.toUpperCase()}"`)
      } else if (searchRequest.emissionGES) {
        const gesComparison = this.parseComparisonValue(searchRequest.emissionGES)
        if (gesComparison && gesComparison.value > 0) {
          const query = this.buildRangeQuery(gesComparison, 'estimation_ges')
          if (query) strictConditions.push(query)
        }
      }

      // Type de bâtiment
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

      // Surface avec tolérance ±1% pour la recherche stricte
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

      // ÉTAPE 2 : Recherche élargie si encore besoin de plus de résultats
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
          // Tolérance ±5% pour énergie/GES
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

        // Tolérance de surface ±15%
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

      // ÉTAPE 3 : Recherche régionale (à l'échelle du département) si encore besoin
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
          // Tolérance ±10%
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

        // Tolérance de surface ±35%
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

      // Mapper et noter tous les résultats uniques
      const mappedResults = allResults.map(r => this.mapLegacyResult(r, searchRequest))

      // Trier par score de correspondance
      mappedResults.sort((a, b) => b.matchScore - a.matchScore)

      return {
        results: mappedResults.slice(0, 20), // Limiter aux 20 premiers
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
   * Exécuter la requête contre l'API legacy
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
   * Mapper le résultat legacy vers le format actuel
   */
  mapLegacyResult(legacyData, searchRequest) {
    // Extraire les coordonnées
    let latitude = legacyData.latitude || null
    let longitude = legacyData.longitude || null

    if (!latitude && !longitude && legacyData._geopoint) {
      const coords = legacyData._geopoint.split(',')
      latitude = parseFloat(coords[0])
      longitude = parseFloat(coords[1])
    }

    // Déterminer si nous avons des données incomplètes
    const hasIncompleteData =
      !legacyData.geo_adresse || legacyData.geo_adresse === 'Adresse non disponible' || !latitude || !longitude

    // Calculer le score de correspondance (0 si données incomplètes)
    const matchScore = hasIncompleteData ? 0 : this.calculateMatchScore(legacyData, searchRequest)

    return {
      // Informations d'adresse
      adresseComplete: legacyData.geo_adresse || 'Adresse non disponible',
      codePostal: this.extractPostalCodeFromAddress(legacyData.geo_adresse) || '',
      commune: this.extractCommuneFromAddress(legacyData.geo_adresse) || '',
      latitude,
      longitude,

      // Données énergétiques - mapper vers les noms de champs post-2021
      consommationEnergie: legacyData.consommation_energie || 0,
      classeDPE: legacyData.classe_consommation_energie || '',
      emissionGES: legacyData.estimation_ges || 0,
      classeGES: legacyData.classe_estimation_ges || '',

      // Informations du bâtiment
      typeBien: this.mapBuildingType(legacyData.tr002_type_batiment_description),
      surfaceHabitable: legacyData.surface_thermique_lot || 0,
      anneeConstruction: legacyData.annee_construction || null,

      // Métadonnées
      id: legacyData.numero_dpe || legacyData._id || '',
      numeroDPE: legacyData.numero_dpe || '',
      dateVisite: legacyData.date_etablissement_dpe,

      // Notation
      matchScore,
      matchReasons: this.getMatchReasons(legacyData, searchRequest),

      // Marquer comme données legacy avec indicateur d'incomplétude
      isLegacyData: true,
      fromLegacy: true,
      hasIncompleteData,
      legacyNote: 'DPE avant juillet 2021',

      // Lien ADEME pour les données incomplètes
      ademeUrl: legacyData.numero_dpe
        ? `https://observatoire-dpe-audit.ademe.fr/afficher-dpe/${legacyData.numero_dpe}`
        : null,

      // Conserver toutes les données brutes pour le modal
      rawData: legacyData
    }
  }

  /**
   * Calculer le score de correspondance pour les résultats legacy (même logique que le service principal)
   */
  calculateMatchScore(legacyData, searchRequest) {
    let baseScore = 0
    let multiplier = 1.0

    // Correspondance d'emplacement (10 points)
    if (searchRequest.commune && legacyData.geo_adresse) {
      const addressLower = legacyData.geo_adresse.toLowerCase()
      const communeLower = searchRequest.commune.toLowerCase()

      if (addressLower.includes(communeLower)) {
        baseScore += 10
      }
    }

    // Vérifier si la recherche est par classe ou par valeur
    const isClassSearch = searchRequest.energyClass && !searchRequest.consommationEnergie

    if (isClassSearch) {
      // RECHERCHE PAR CLASSE

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

      // Classe énergétique (40 points)
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

      // Classe GES (20 points)
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
      // RECHERCHE PAR VALEUR EXACTE

      // Surface (jusqu'à 90 points)
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

      // Pénalité énergétique
      if (searchRequest.consommationEnergie && legacyData.consommation_energie) {
        const kwhDiff = Math.abs(legacyData.consommation_energie - searchRequest.consommationEnergie)

        if (kwhDiff === 0) {
          // Correspondance parfaite
        } else if (kwhDiff === 1) {
          multiplier *= 0.75
        } else if (kwhDiff <= 9) {
          const factor = 0.75 - (0.15 * (kwhDiff - 1)) / 8
          multiplier *= factor
        } else {
          multiplier *= Math.max(0.3, 0.6 - (kwhDiff - 9) * 0.03)
        }
      }

      // Pénalité GES
      if (searchRequest.emissionGES && legacyData.estimation_ges) {
        const gesDiff = Math.abs(legacyData.estimation_ges - searchRequest.emissionGES)

        if (gesDiff === 0) {
          // Correspondance parfaite
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
   * Obtenir les raisons de correspondance pour l'affichage
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
   * Extraire le code postal d'une chaîne d'adresse
   */
  extractPostalCodeFromAddress(address) {
    if (!address) return ''
    const match = address.match(/\b\d{5}\b/)
    return match ? match[0] : ''
  }

  /**
   * Extraire le nom de commune d'une chaîne d'adresse
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
   * Mapper le type de bâtiment vers le format actuel
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
