/**
 * Service dedicated to DPE result scoring and matching logic
 * Extracted from dpe-search.service.js to improve code organization
 */

import { extractPostalCode } from '../utils/utilsGeo.js'

class DPEScoringService {
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
   * Calcul du score de matching
   * @param {Object} ademeData - Raw ADEME DPE data
   * @param {Object} searchRequest - Search criteria
   * @returns {Promise<number>} Match score (0-100)
   */
  async calculateMatchScore(ademeData, searchRequest) {
    let baseScore = 0
    let multiplier = 1.0

    // 1. EMPLACEMENT (10 points) - Vérifier à la fois le code postal ET le nom de la ville
    const codePostalRequest = extractPostalCode(searchRequest.commune)
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
      baseScore += this._calculateClassBasedScore(ademeData, searchRequest, parsedSurface)
    } else {
      // RECHERCHE PAR VALEUR EXACTE - Nouveau scoring adaptatif
      baseScore += this._calculateValueBasedScore(ademeData, searchRequest, parsedSurface, parsedConso, parsedGES)
      multiplier = this._calculateValueBasedMultiplier(ademeData, searchRequest, parsedConso, parsedGES)
    }

    const finalScore = Math.round(baseScore * multiplier)
    // S'assurer qu'on ne retourne jamais NaN, retourner 0 à la place
    return Number.isNaN(finalScore) ? 0 : finalScore
  }

  /**
   * Calculate score for class-based searches (energy/GES classes)
   * @private
   */
  _calculateClassBasedScore(ademeData, searchRequest, parsedSurface) {
    let score = 0

    // SURFACE (30 points)
    if (parsedSurface?.value && ademeData.surface_habitable_logement) {
      const surfaceDiff = Math.abs(ademeData.surface_habitable_logement - parsedSurface.value)
      const surfacePercent = (surfaceDiff / parsedSurface.value) * 100

      if (surfaceDiff <= 1) {
        score += 30
      } else if (surfacePercent <= 100) {
        score += 30 - 15 * (surfacePercent / 100)
      } else {
        score += 15
        // >100% de différence limite le score à 50%
      }
    }

    // CLASSE ÉNERGÉTIQUE (40 points)
    if (searchRequest.energyClass && ademeData.etiquette_dpe) {
      const requestClass = searchRequest.energyClass.toUpperCase()
      const dpeClass = ademeData.etiquette_dpe.toUpperCase()

      if (requestClass === dpeClass) {
        score += 40
      } else {
        const classes = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
        const classDiff = Math.abs(classes.indexOf(requestClass) - classes.indexOf(dpeClass))

        if (classDiff === 1) score += 25
        else if (classDiff === 2) score += 10
        else if (classDiff === 3) score += 5
      }
    }

    // CLASSE GES (20 points)
    if (searchRequest.gesClass && ademeData.etiquette_ges) {
      const requestGES = searchRequest.gesClass.toUpperCase()
      const dpeGES = ademeData.etiquette_ges.toUpperCase()

      if (requestGES === dpeGES) {
        score += 20
      } else {
        const classes = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
        const classDiff = Math.abs(classes.indexOf(requestGES) - classes.indexOf(dpeGES))

        if (classDiff === 1) score += 12
        else if (classDiff === 2) score += 6
        else if (classDiff === 3) score += 3
      }
    }

    return score
  }

  /**
   * Calculate score for value-based searches (exact kWh/GES values)
   * @private
   */
  _calculateValueBasedScore(ademeData, _searchRequest, parsedSurface, _parsedConso, _parsedGES) {
    let score = 0

    // SCORING SURFACE (jusqu'à 90 points quand kWh/GES sont parfaits)
    if (parsedSurface?.value && ademeData.surface_habitable_logement) {
      const surfaceDiff = Math.abs(ademeData.surface_habitable_logement - parsedSurface.value)
      const surfacePercent = (surfaceDiff / parsedSurface.value) * 100

      if (surfaceDiff <= 1) {
        score += 90 // Correspondance parfaite de surface
      } else if (surfacePercent <= 90) {
        // Proportionnel direct : 9% de différence = 9 points de baisse
        score += 90 - surfacePercent
      } else if (surfacePercent <= 100) {
        // Score très faible pour 90-100% de différence
        score += Math.max(0, 10 - (surfacePercent - 90))
      } else {
        // >100% de différence obtient 0 points
        score += 0
      }
    }

    return score
  }

  /**
   * Calculate multiplier penalties for value-based searches
   * @private
   */
  _calculateValueBasedMultiplier(ademeData, searchRequest, parsedConso, parsedGES) {
    let multiplier = 1.0

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

    // Check for surface penalty that limits total score
    const parsedSurface = searchRequest.surfaceHabitable
      ? this.parseComparisonValue(searchRequest.surfaceHabitable)
      : null

    if (parsedSurface?.value && ademeData.surface_habitable_logement) {
      const surfaceDiff = Math.abs(ademeData.surface_habitable_logement - parsedSurface.value)
      const surfacePercent = (surfaceDiff / parsedSurface.value) * 100

      if (surfacePercent > 100) {
        multiplier *= 0.5 // >100% de différence limite le score à 50%
      }
    }

    return multiplier
  }

  /**
   * Generate match reasons for display
   * @param {Object} ademeData - Raw ADEME DPE data
   * @param {Object} searchRequest - Search criteria
   * @returns {Promise<Array>} Array of match reason strings
   */
  async getMatchReasons(ademeData, searchRequest) {
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
      this._addClassBasedReasons(reasons, ademeData, searchRequest)
    } else {
      // Exact value matches
      this._addValueBasedReasons(reasons, ademeData, searchRequest, parsedConso, parsedGES)
    }

    // Surface matching
    if (parsedSurface?.value && ademeData.surface_habitable_logement) {
      const ecart = Math.abs(ademeData.surface_habitable_logement - parsedSurface.value)
      const pourcent = Math.round((ecart / parsedSurface.value) * 100)
      reasons.push(`Surface: ${ademeData.surface_habitable_logement}m² (écart: ${pourcent}%)`)
    }

    // Location matching
    const codePostalRequest = extractPostalCode(searchRequest.commune)
    const codePostalDPE = ademeData.code_postal_ban || ademeData.code_postal_brut?.toString()
    if (codePostalRequest === codePostalDPE) {
      reasons.push('Commune exacte')
    }

    return reasons
  }

  /**
   * Add class-based match reasons
   * @private
   */
  _addClassBasedReasons(reasons, ademeData, searchRequest) {
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
  }

  /**
   * Add value-based match reasons
   * @private
   */
  _addValueBasedReasons(reasons, ademeData, _searchRequest, parsedConso, parsedGES) {
    if (parsedConso && parsedConso.value === ademeData.conso_5_usages_par_m2_ep) {
      reasons.push(`Consommation exacte: ${parsedConso.value} kWh/m²/an`)
    }

    if (parsedGES && parsedGES.value === ademeData.emission_ges_5_usages_par_m2) {
      reasons.push(`GES exact: ${parsedGES.value} kgCO²/m²/an`)
    }
  }

  /**
   * Détermine la stratégie utilisée
   * @param {Array} results - Search results with match scores
   * @returns {string} Strategy identifier
   */
  determineStrategy(results) {
    if (!results || results.length === 0) return 'AUCUN'

    const hasExactMatch = results.some(r => r.matchScore >= 95)
    if (hasExactMatch) return 'ULTRA_PRECIS'

    const hasGoodMatch = results.some(r => r.matchScore >= 80)
    if (hasGoodMatch) return 'PRECIS'

    return 'ELARGI'
  }
}

export default DPEScoringService
