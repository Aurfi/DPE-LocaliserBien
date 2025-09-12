import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { open } from 'sqlite'
import sqlite3 from 'sqlite3'

/**
 * Service DVF avancé avec géolocalisation, pondération temporelle et recherche multi-départements
 */
class DVFAdvancedService {
  constructor() {
    this.dbCache = new Map() // Cache des connexions par département
    this.basePath = 'data/dvf-france/processed'
    this.apiRestBaseUrl = 'https://app.dvf.etalab.gouv.fr/api/ventes'

    // Configuration des seuils
    this.confidenceThresholds = {
      radiusSteps: [0.5, 1, 2, 5, 10, 15], // km - rayons étendus pour zones peu denses
      minTransactions: 7, // Au moins 7 transactions proches
      fallbackMinTransactions: 5, // Au moins 5 transactions moyennes
      lastResortMinTransactions: 3, // Au moins 3 transactions lointaines
      recentYears: 2, // Transactions < 2 ans = haute pondération
      oldYears: 5 // Transactions > 5 ans = faible pondération
    }
  }

  /**
   * Obtient la connexion à la base d'un département
   */
  async getDepartmentDb(deptCode) {
    if (this.dbCache.has(deptCode)) {
      return this.dbCache.get(deptCode)
    }

    const dbPath = join(this.basePath, `mutations_d${deptCode}_geo.db`)

    if (!existsSync(dbPath)) {
      return null
    }

    try {
      const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
      })

      this.dbCache.set(deptCode, db)
      return db
    } catch (_error) {
      return null
    }
  }

  /**
   * Détermine le département à partir du code INSEE
   */
  getDepartmentFromInsee(codeInsee) {
    if (!codeInsee) return null

    // Extraire les premiers chiffres du code INSEE
    const dept = codeInsee.substring(0, 2)

    // Cas spéciaux
    if (dept === '97') {
      return codeInsee.substring(0, 3) // DOM-TOM: 971, 972, etc.
    }
    if (dept === '20') {
      // Corse: différencier 2A et 2B selon le code INSEE
      return parseInt(codeInsee.substring(2, 5), 10) < 200 ? '2A' : '2B'
    }

    return dept
  }

  /**
   * Recherche DVF avec rayon adaptatif dans le département principal et limitrophes si nécessaire
   */
  async searchWithAdaptiveRadius(latitude, longitude, criteria = {}, codeInsee = null) {
    // Déterminer le département principal
    const mainDept = codeInsee ? this.getDepartmentFromInsee(codeInsee) : null

    // Si on a le département, commencer par là
    let results = null
    if (mainDept) {
      results = await this.searchInDepartment(mainDept, latitude, longitude, criteria)

      // Si on a assez de résultats, retourner
      if (results && results.transactions.length >= this.confidenceThresholds.minTransactions) {
        return results
      }
    }

    // Si pas assez de résultats ou pas de département déterminé,
    // essayer les départements voisins possibles (approche heuristique)
    const nearbyDepts = await this.findNearbyDepartments(latitude, longitude, mainDept)

    for (const dept of nearbyDepts) {
      if (dept === mainDept) continue // Déjà testé

      const deptResults = await this.searchInDepartment(dept, latitude, longitude, criteria)

      if (deptResults && deptResults.transactions.length > 0) {
        // Combiner les résultats
        if (results) {
          results.transactions.push(...deptResults.transactions)
          results.sourceInfo.departments.add(dept)
        } else {
          results = deptResults
        }

        // Si on a assez de résultats combinés, arrêter
        if (results.transactions.length >= this.confidenceThresholds.minTransactions) {
          break
        }
      }
    }

    return results || this.createEmptyResult(latitude, longitude)
  }

  /**
   * Recherche dans un département spécifique
   */
  async searchInDepartment(deptCode, latitude, longitude, criteria) {
    const db = await this.getDepartmentDb(deptCode)
    if (!db) return null

    // Recherche par rayons croissants
    for (const radius of this.confidenceThresholds.radiusSteps) {
      const transactions = await this.queryTransactionsInRadius(db, latitude, longitude, radius, criteria)

      if (transactions.length > 0) {
        // Seuils adaptatifs selon la distance
        let minThreshold
        if (radius <= 1)
          minThreshold = 7 // Proche: au moins 7 transactions
        else if (radius <= 2)
          minThreshold = 5 // Moyen: au moins 5 transactions
        else minThreshold = 3 // Lointain: au moins 3 transactions

        if (transactions.length >= minThreshold) {
          const analysis = await this.analyzeTransactions(transactions, radius)

          return {
            ...analysis,
            sourceInfo: {
              departments: new Set([deptCode]),
              radius: radius,
              totalTransactions: transactions.length,
              searchMethod: 'geographic_radius'
            }
          }
        }
      }
    }

    return null
  }

  /**
   * Trouve les départements potentiellement proches géographiquement
   */
  async findNearbyDepartments(latitude, _longitude, excludeDept = null) {
    // Approche simple: tester quelques départements selon la zone géographique
    const depts = []

    // Logique heuristique basée sur les coordonnées
    if (latitude > 49)
      depts.push('59', '62', '80', '02', '08') // Nord
    else if (latitude > 47)
      depts.push('75', '77', '78', '91', '92', '93', '94', '95') // IDF
    else if (latitude < 44)
      depts.push('13', '83', '06', '04', '05') // Sud
    else depts.push('69', '42', '43', '63') // Centre

    // Filtrer les départements disponibles et exclure le département principal
    const availableDepts = []
    for (const dept of depts) {
      if (dept !== excludeDept && existsSync(join(this.basePath, `mutations_d${dept}_geo.db`))) {
        availableDepts.push(dept)
      }
    }

    return availableDepts.slice(0, 3) // Limiter à 3 départements voisins max
  }

  /**
   * Requête des transactions dans un rayon donné
   */
  async queryTransactionsInRadius(db, latitude, longitude, radiusKm, criteria = {}) {
    const latDiff = radiusKm / 111.0 // Approximation: 1° ≈ 111km
    const lonDiff = radiusKm / (111.0 * Math.cos((latitude * Math.PI) / 180))

    let query = `
      SELECT 
        idmutation, datemut, anneemut, valeurfonc, sbati, 
        libtypbien, centroid_x, centroid_y,
        ROUND(
          111.0 * SQRT(
            POWER(centroid_y - ?, 2) + 
            POWER((centroid_x - ?) * COS(? * 3.14159 / 180), 2)
          ), 2
        ) as distance_km,
        (julianday('now') - julianday(datemut)) as age_days
      FROM mutations 
      WHERE valeurfonc > 0
        AND centroid_y BETWEEN ? AND ?
        AND centroid_x BETWEEN ? AND ?
        AND julianday('now') - julianday(datemut) <= ?
    `

    const params = [
      latitude,
      longitude,
      latitude,
      latitude - latDiff,
      latitude + latDiff,
      longitude - lonDiff,
      longitude + lonDiff,
      this.confidenceThresholds.oldYears * 365
    ]

    // Filtres supplémentaires
    if (criteria.typeBien) {
      query += ` AND libtypbien LIKE ?`
      params.push(`%${criteria.typeBien}%`)
    }

    if (criteria.surfaceMin) {
      query += ` AND sbati >= ?`
      params.push(criteria.surfaceMin)
    }

    if (criteria.surfaceMax) {
      query += ` AND sbati <= ?`
      params.push(criteria.surfaceMax)
    }

    query += ` 
      ORDER BY distance_km ASC, age_days ASC
      LIMIT 50
    `

    try {
      const results = await db.all(query, params)
      return results.filter(r => r.distance_km <= radiusKm)
    } catch (_error) {
      return []
    }
  }

  /**
   * Analyse les transactions avec pondération temporelle
   */
  async analyzeTransactions(transactions, radius) {
    if (transactions.length === 0) {
      return this.createEmptyResult()
    }

    // Pondération temporelle
    const weightedTransactions = transactions.map(t => {
      const ageYears = t.age_days / 365
      let weight = 1

      if (ageYears <= this.confidenceThresholds.recentYears) {
        weight = 2.0 // Transactions récentes = double poids
      } else if (ageYears <= 4) {
        weight = 1.5 // Transactions moyennes = 50% de plus
      }
      // Transactions anciennes gardent weight = 1

      return { ...t, weight }
    })

    // Calculs pondérés
    const totalWeight = weightedTransactions.reduce((sum, t) => sum + t.weight, 0)
    const avgPrice = weightedTransactions.reduce((sum, t) => sum + t.valeurfonc * t.weight, 0) / totalWeight
    const avgPriceM2 =
      weightedTransactions.filter(t => t.sbati > 0).reduce((sum, t) => sum + (t.valeurfonc / t.sbati) * t.weight, 0) /
      weightedTransactions.filter(t => t.sbati > 0).reduce((sum, t) => sum + t.weight, 0)

    // Statistiques
    const prices = transactions.map(t => t.valeurfonc).sort((a, b) => a - b)
    const pricesM2 = transactions
      .filter(t => t.sbati > 0)
      .map(t => t.valeurfonc / t.sbati)
      .sort((a, b) => a - b)

    return {
      estimatedPrice: Math.round(avgPrice),
      estimatedPriceM2: avgPriceM2 ? Math.round(avgPriceM2) : null,
      confidence: this.calculateConfidence(transactions, radius),
      transactions: transactions.slice(0, 10), // Limiter pour l'affichage
      stats: {
        count: transactions.length,
        medianPrice: prices[Math.floor(prices.length / 2)],
        medianPriceM2: pricesM2.length > 0 ? pricesM2[Math.floor(pricesM2.length / 2)] : null,
        avgSurface:
          transactions.filter(t => t.sbati > 0).reduce((sum, t) => sum + t.sbati, 0) /
          transactions.filter(t => t.sbati > 0).length,
        recentCount: transactions.filter(t => t.age_days <= 730).length
      }
    }
  }

  /**
   * Calcule le niveau de confiance
   */
  calculateConfidence(transactions, radius) {
    let confidence = 0.5 // Base

    // Bonus selon le nombre de transactions
    if (transactions.length >= 10) confidence += 0.3
    else if (transactions.length >= 7) confidence += 0.2
    else if (transactions.length >= 5) confidence += 0.1

    // Bonus selon la proximité
    if (radius <= 1) confidence += 0.2
    else if (radius <= 2) confidence += 0.1

    // Bonus selon la récence
    const recentCount = transactions.filter(t => t.age_days <= 730).length
    confidence += (recentCount / transactions.length) * 0.2

    return Math.min(confidence, 1.0)
  }

  /**
   * Crée un résultat vide
   */
  createEmptyResult(latitude = null, longitude = null) {
    return {
      estimatedPrice: null,
      estimatedPriceM2: null,
      confidence: 0,
      transactions: [],
      stats: null,
      sourceInfo: {
        departments: new Set(),
        radius: null,
        totalTransactions: 0,
        searchMethod: 'no_data',
        coordinates: latitude && longitude ? { latitude, longitude } : null
      }
    }
  }

  /**
   * Nettoie les connexions (à appeler en fin de session)
   */
  async cleanup() {
    for (const [_dept, db] of this.dbCache) {
      try {
        await db.close()
      } catch (_error) {
        // Ignore cleanup errors
      }
    }
    this.dbCache.clear()
  }
}

export default DVFAdvancedService
