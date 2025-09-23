// Service pour intégrer avec notre API DPE backend

import { useDepartements } from '../stores/useDepartements.js'
import { extractPostalCode, geocodeAddress, getCommuneCoordinates } from '../utils/utilsGeo.js'
import DPELegacyService from './dpe-legacy.service'
import DPEScoringService from './dpe-scoring.service'

class DPESearchService {
  constructor() {
    // Utiliser le store centralisé pour les départements
    this.departmentStore = useDepartements()

    // Initialiser le service legacy pour les données pré-2021
    this.legacyService = new DPELegacyService()

    // Initialiser le service de scoring
    this.scoringService = new DPEScoringService()
  }

  /**
   * Charge un département spécifique via le store centralisé
   * @param {string} deptCode - Code du département (ex: '13', '2A')
   * @returns {Promise<Object>} Données du département
   */
  async loadDepartment(deptCode) {
    return await this.departmentStore.loadDepartment(deptCode)
  }

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
   * Recherche DPE dans les données ADEME
   * @param {Object} searchRequest - Critères de recherche
   * @returns {Promise<Object>} - Résultats de la recherche
   */
  async search(searchRequest) {
    try {
      // Recherche directe dans les données ADEME
      const searchResults = await this.performSearch(searchRequest)

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

    // Recherche avec nos stratégies de recherche - lazy load constructor
    const { default: ConstructeurRechercheAdeme } = await import('./constructeur-recherche-ademe.service.js')
    const constructeur = new ConstructeurRechercheAdeme(this.scoringService)
    let results = await constructeur.executerRecherche(searchRequest, communeCoords)

    // Toujours rechercher dans la base de données pré-2021 pour une recherche plus complète
    let legacyResults = []
    if (this.legacyService) {
      const legacySearch = await this.legacyService.searchLegacy(searchRequest, false)
      if (legacySearch.results && legacySearch.results.length > 0) {
        // Appliquer une pénalité de 15% aux scores des résultats legacy
        legacyResults = legacySearch.results.map(result => ({
          ...result,
          matchScore: Math.round(result.matchScore * 0.85),
          matchReasons: [...(result.matchReasons || []), 'Score réduit de 15% (données pré-2021)']
        }))

        // Combiner et dédupliquer les résultats si nous en avons des deux sources
        if (results && results.length > 0) {
          // Vérifier si nous avons des correspondances parfaites (score >= 90) dans les résultats modernes
          const hasPerfectMatch = results.some(r => r.matchScore >= 90)

          // Si des correspondances parfaites existent, filtrer les résultats legacy avec score < 50
          if (hasPerfectMatch) {
            legacyResults = legacyResults.filter(lr => lr.matchScore >= 50)
          }

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
   * Wrapper pour maintenir la compatibilité
   * @param {string} communeInput - Code postal ou nom de commune
   * @returns {Promise<Object|null>} Coordonnées {lat, lon} ou null
   */
  async getCommuneCoordinates(communeInput) {
    // Utiliser le store pour accéder au cache des départements
    const cacheAccess = {
      has: key => this.departmentStore.getCachedDepartment(key) !== null,
      get: key => this.departmentStore.getCachedDepartment(key)
    }
    return await getCommuneCoordinates(communeInput, this.loadDepartment.bind(this), cacheAccess)
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
