import { open } from 'sqlite'
import sqlite3 from 'sqlite3'

/**
 * Service DVF simple qui fonctionne avec notre base Lozère
 */
class DVFService {
  constructor() {
    this.db = null
    this.dbPath = 'data/dvf-france/processed/mutations_lozere.db'
  }

  /**
   * Initialise la connexion à la base DVF
   */
  async initialize() {
    if (this.db) return this.db
    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database
    })
    return this.db
  }

  /**
   * Recherche DVF par parcelle (pour corrélation avec DPE)
   * @param {string} parcelId - ID de parcelle (peut être partiel)
   */
  async searchByParcel(parcelId) {
    await this.initialize()

    try {
      const results = await this.db.all(
        `
        SELECT 
          idmutation,
          datemut,
          valeurfonc,
          libtypbien,
          sbati,
          l_idpar,
          anneemut
        FROM mutations 
        WHERE l_idpar LIKE ? 
        AND valeurfonc > 0
        ORDER BY datemut DESC
        LIMIT 20
      `,
        [`%${parcelId}%`]
      )

      return {
        results,
        total: results.length,
        searchType: 'parcel',
        parcelId
      }
    } catch (error) {
      return { results: [], total: 0, error: error.message }
    }
  }

  /**
   * Recherche DVF par critères (surface, type, prix)
   * @param {Object} criteria - Critères de recherche
   */
  async searchByCriteria(criteria = {}) {
    await this.initialize()

    const {
      typeBien = null,
      surfaceMin = null,
      surfaceMax = null,
      prixMin = null,
      prixMax = null,
      anneeMin = 2020,
      limit = 50
    } = criteria

    try {
      let query = `
        SELECT 
          idmutation,
          datemut,
          valeurfonc,
          libtypbien,
          sbati,
          l_idpar,
          anneemut
        FROM mutations 
        WHERE valeurfonc > 0
      `

      const params = []

      if (typeBien) {
        query += ' AND libtypbien = ?'
        params.push(typeBien)
      }

      if (surfaceMin && surfaceMin > 0) {
        query += ' AND sbati >= ?'
        params.push(surfaceMin)
      }

      if (surfaceMax && surfaceMax > 0) {
        query += ' AND sbati <= ?'
        params.push(surfaceMax)
      }

      if (prixMin && prixMin > 0) {
        query += ' AND valeurfonc >= ?'
        params.push(prixMin)
      }

      if (prixMax && prixMax > 0) {
        query += ' AND valeurfonc <= ?'
        params.push(prixMax)
      }

      if (anneeMin) {
        query += ' AND anneemut >= ?'
        params.push(anneeMin)
      }

      query += ' ORDER BY datemut DESC LIMIT ?'
      params.push(limit)

      const results = await this.db.all(query, params)

      // Calculer des statistiques
      const stats = await this.calculateStats(results)

      return {
        results,
        total: results.length,
        searchType: 'criteria',
        criteria,
        statistics: stats
      }
    } catch (error) {
      return { results: [], total: 0, error: error.message }
    }
  }

  /**
   * Analyse de marché pour un bien DPE
   * @param {Object} dpeData - Données du bien DPE
   */
  async analyzeMarketForDPE(dpeData) {
    try {
      // Étape 1: Recherche par parcelle si on a l'info
      let parcelResults = { results: [] }
      if (dpeData.idParcelle) {
        parcelResults = await this.searchByParcel(dpeData.idParcelle)
      }

      // Étape 2: Recherche par critères similaires
      const typeBien = this.mapDPETypeToDVF(dpeData.type_batiment)
      const surface = dpeData.surface_habitable_logement

      const criteriaResults = await this.searchByCriteria({
        typeBien,
        surfaceMin: surface ? surface * 0.8 : null,
        surfaceMax: surface ? surface * 1.2 : null,
        anneeMin: 2020,
        limit: 20
      })

      // Étape 3: Analyse et insights
      const analysis = {
        dpe: dpeData,
        parcelTransactions: parcelResults.results || [],
        similarTransactions: criteriaResults.results || [],
        marketInsights: this.generateMarketInsights(parcelResults.results || [], criteriaResults.results || [], dpeData)
      }

      return analysis
    } catch (error) {
      return {
        dpe: dpeData,
        parcelTransactions: [],
        similarTransactions: [],
        marketInsights: null,
        error: error.message
      }
    }
  }

  /**
   * Mappe un type DPE vers un type DVF
   */
  mapDPETypeToDVF(typeDPE) {
    if (!typeDPE) return null

    const type = typeDPE.toLowerCase()

    if (type.includes('appartement')) return 'UN APPARTEMENT'
    if (type.includes('maison')) return 'UNE MAISON'
    if (type.includes('immeuble')) return 'UN APPARTEMENT'

    return null
  }

  /**
   * Génère des insights de marché
   */
  generateMarketInsights(parcelTransactions, similarTransactions, dpeData) {
    const allTransactions = [...parcelTransactions, ...similarTransactions]

    if (allTransactions.length === 0) {
      return {
        status: 'no_data',
        message: 'Pas de données DVF trouvées pour ce bien'
      }
    }

    // Prix moyen
    const validPrices = allTransactions.filter(t => t.valeurfonc > 0).map(t => t.valeurfonc)

    const avgPrice = validPrices.length > 0 ? validPrices.reduce((a, b) => a + b, 0) / validPrices.length : 0

    // Prix au m² si on a la surface
    let avgPricePerSqm = null
    const validPricesPerSqm = allTransactions
      .filter(t => t.valeurfonc > 0 && t.sbati > 0)
      .map(t => t.valeurfonc / t.sbati)

    if (validPricesPerSqm.length > 0) {
      avgPricePerSqm = validPricesPerSqm.reduce((a, b) => a + b, 0) / validPricesPerSqm.length
    }

    // Estimation de la valeur du bien DPE
    let estimatedValue = null
    if (avgPricePerSqm && dpeData.surface_habitable_logement) {
      estimatedValue = avgPricePerSqm * dpeData.surface_habitable_logement
    } else if (avgPrice > 0) {
      estimatedValue = avgPrice
    }

    return {
      status: 'success',
      totalComparables: allTransactions.length,
      exactParcelMatches: parcelTransactions.length,
      averagePrice: Math.round(avgPrice),
      averagePricePerSqm: avgPricePerSqm ? Math.round(avgPricePerSqm) : null,
      estimatedValue: estimatedValue ? Math.round(estimatedValue) : null,
      confidence: this.calculateConfidence(parcelTransactions.length, allTransactions.length),
      recentTransactions: allTransactions.filter(t => t.anneemut >= 2022).length
    }
  }

  /**
   * Calcule la confiance de l'estimation
   */
  calculateConfidence(exactMatches, totalMatches) {
    if (exactMatches > 0) return 'haute'
    if (totalMatches >= 10) return 'moyenne'
    if (totalMatches >= 5) return 'faible'
    return 'très_faible'
  }

  /**
   * Calcule des statistiques sur un jeu de résultats
   */
  async calculateStats(results) {
    if (results.length === 0) return null

    const prices = results.filter(r => r.valeurfonc > 0).map(r => r.valeurfonc)
    const surfaces = results.filter(r => r.sbati > 0).map(r => r.sbati)

    return {
      count: results.length,
      avgPrice: prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null,
      minPrice: prices.length > 0 ? Math.min(...prices) : null,
      maxPrice: prices.length > 0 ? Math.max(...prices) : null,
      avgSurface: surfaces.length > 0 ? Math.round(surfaces.reduce((a, b) => a + b, 0) / surfaces.length) : null
    }
  }

  /**
   * Obtient des statistiques globales de la base DVF
   */
  async getGlobalStats() {
    await this.initialize()

    try {
      const totalCount = await this.db.get('SELECT COUNT(*) as count FROM mutations WHERE valeurfonc > 0')

      const typeStats = await this.db.all(`
        SELECT libtypbien, COUNT(*) as count, AVG(valeurfonc) as avg_price
        FROM mutations 
        WHERE valeurfonc > 0
        GROUP BY libtypbien 
        ORDER BY count DESC 
        LIMIT 5
      `)

      const yearStats = await this.db.all(`
        SELECT anneemut, COUNT(*) as count
        FROM mutations
        WHERE valeurfonc > 0
        GROUP BY anneemut
        ORDER BY anneemut DESC
      `)

      return {
        totalTransactions: totalCount.count,
        typeDistribution: typeStats,
        yearDistribution: yearStats,
        coverage: 'Lozère (48)',
        lastUpdate: new Date().toISOString()
      }
    } catch (error) {
      return { error: error.message }
    }
  }

  /**
   * Ferme la connexion à la base
   */
  async close() {
    if (this.db) {
      await this.db.close()
      this.db = null
    }
  }
}

export default DVFService
