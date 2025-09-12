import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { open } from 'sqlite'
import sqlite3 from 'sqlite3'

/**
 * Service d'analyse DVF pour les quartiers et zones géographiques
 * Utilise des méthodes statistiques robustes pour gérer les valeurs extrêmes
 */
class DVFAnalyticsQuartierService {
  constructor() {
    this.dbCache = new Map()
    this.basePath = 'data/dvf-france/processed'

    // Configuration statistique
    this.config = {
      // Percentiles pour analyses robustes
      percentiles: {
        p05: 0.05, // 5e percentile
        p25: 0.25, // 1er quartile
        p50: 0.5, // Médiane
        p75: 0.75, // 3e quartile
        p95: 0.95, // 95e percentile
        p99: 0.99 // 99e percentile
      },

      // Rayons standards pour analyses (km)
      rayonsStandard: [0.5, 1, 2, 5, 10],

      // Périodes temporelles standards (mois)
      periodesStandard: [3, 6, 12, 24],

      // Seuils de confiance selon densité de données
      seuilsConfiance: {
        tresFaible: 3, // < 3 transactions
        faible: 10, // 3-10 transactions
        moyen: 30, // 10-30 transactions
        bon: 50, // 30-50 transactions
        excellent: 100 // > 100 transactions
      }
    }

    // Cache LRU des résultats (TTL 15 minutes, max 1000 entrées)
    this.cache = new Map()
    this.cacheTTL = 15 * 60 * 1000 // 15 minutes
    this.maxCacheSize = 1000
    this.cacheHits = 0
    this.cacheMisses = 0

    // Configuration pour l'API
    this.apiConfig = {
      defaultRadius: [1, 2, 5],
      maxRadius: 15,
      maxResults: 100,
      rateLimitPerMinute: 60
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
   * Calcule la distance entre deux points en kilomètres
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
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
   * Détermine le département à partir des coordonnées ou code INSEE
   */
  getDepartmentFromLocation(latitude, longitude, codeInsee = null) {
    if (codeInsee) {
      // Extraire département du code INSEE
      const dept = codeInsee.substring(0, 2)

      // Cas spéciaux
      if (dept === '97') return codeInsee.substring(0, 3) // DOM-TOM
      if (dept === '20') {
        // Corse: 2A ou 2B selon le code
        return parseInt(codeInsee.substring(2, 5), 10) < 200 ? '2A' : '2B'
      }

      return dept
    }

    // Estimation heuristique basée sur coordonnées si pas de code INSEE
    if (latitude > 50) return '59' // Nord probable
    if (latitude < 43 && longitude > 7) return '06' // Côte d'Azur probable
    if (latitude > 48.8 && latitude < 49 && longitude > 2.2 && longitude < 2.5) return '75' // Paris

    // Par défaut, essayer plusieurs départements
    return null
  }

  /**
   * Calcule tous les percentiles et statistiques d'un ensemble de valeurs en un seul passage
   * Plus efficace que des appels multiples
   */
  calculateCompleteStats(values, weights = null) {
    if (!values || values.length === 0) return null

    const sorted = [...values].sort((a, b) => a - b)
    const n = sorted.length

    // Percentiles standards
    const percentiles = {
      p05: sorted[Math.floor(n * 0.05)] || sorted[0],
      p25: sorted[Math.floor(n * 0.25)] || sorted[0],
      p50: sorted[Math.floor(n * 0.5)] || sorted[0], // médiane
      p75: sorted[Math.floor(n * 0.75)] || sorted[0],
      p95: sorted[Math.floor(n * 0.95)] || sorted[0]
    }

    // IQR et MAD
    const iqr = percentiles.p75 - percentiles.p25
    const median = percentiles.p50
    const deviations = values.map(v => Math.abs(v - median)).sort((a, b) => a - b)
    const mad = deviations[Math.floor(deviations.length / 2)] || 0

    // Moyenne robuste (winsorized avec P5/P95)
    const winsorizedValues = values.map(v => {
      if (v < percentiles.p05) return percentiles.p05
      if (v > percentiles.p95) return percentiles.p95
      return v
    })

    let moyenneRobuste
    if (weights && weights.length === values.length) {
      const totalWeight = weights.reduce((sum, w) => sum + w, 0)
      moyenneRobuste = winsorizedValues.reduce((sum, v, i) => sum + v * weights[i], 0) / totalWeight
    } else {
      moyenneRobuste = winsorizedValues.reduce((sum, v) => sum + v, 0) / winsorizedValues.length
    }

    return {
      median: percentiles.p50,
      moyenneRobuste: Math.round(moyenneRobuste),
      percentiles,
      iqr,
      mad,
      count: n,
      min: sorted[0],
      max: sorted[n - 1]
    }
  }

  /**
   * Version simple pour compatibilité
   */
  calculatePercentiles(values, percentiles = [0.25, 0.5, 0.75]) {
    const stats = this.calculateCompleteStats(values)
    if (!stats) return {}

    const result = {}
    percentiles.forEach(p => {
      const key = `p${Math.round(p * 100)}`
      result[key] = stats.percentiles[key] || stats.median
    })
    return result
  }

  /**
   * Version optimisée intégrée dans calculateCompleteStats
   */
  calculateRobustMean(values, weights = null) {
    const stats = this.calculateCompleteStats(values, weights)
    return stats ? stats.moyenneRobuste : null
  }

  /**
   * Analyse les métriques d'un quartier avec plusieurs rayons
   */
  async getMetriquesQuartier(latitude, longitude, rayons = null, codeInsee = null) {
    const cacheKey = `quartier_${latitude}_${longitude}_${rayons?.join('_')}`

    // Vérifier le cache
    const cached = this.getCachedResult(cacheKey)
    if (cached) return cached

    rayons = rayons || this.config.rayonsStandard
    const dept = this.getDepartmentFromLocation(latitude, longitude, codeInsee)

    if (!dept) {
      return { error: 'Impossible de déterminer le département' }
    }

    const db = await this.getDepartmentDb(dept)
    if (!db) {
      return { error: `Base de données non disponible pour le département ${dept}` }
    }

    const results = {}

    for (const rayon of rayons) {
      const metriques = await this.analyserZone(db, latitude, longitude, rayon)
      results[`${rayon}km`] = metriques
    }

    // Ajouter comparaisons
    results.comparaisons = this.calculerComparaisons(results)

    // Mettre en cache
    this.setCachedResult(cacheKey, results)

    return results
  }

  /**
   * Analyse une zone circulaire autour d'un point
   */
  async analyserZone(db, latitude, longitude, rayonKm) {
    const latDiff = rayonKm / 111.0
    const lonDiff = rayonKm / (111.0 * Math.cos((latitude * Math.PI) / 180))

    // Récupérer toutes les transactions dans le rayon
    const transactions = await db.all(
      `
      SELECT 
        idmutation,
        datemut,
        valeurfonc,
        sbati,
        libtypbien,
        centroid_x,
        centroid_y,
        julianday('now') - julianday(datemut) as age_jours
      FROM mutations
      WHERE valeurfonc > 0
        AND centroid_y BETWEEN ? AND ?
        AND centroid_x BETWEEN ? AND ?
        AND julianday('now') - julianday(datemut) <= 730 -- 2 ans max
      ORDER BY 
        ABS(centroid_y - ?) + ABS(centroid_x - ?) ASC,
        age_jours ASC
      LIMIT 200
    `,
      [latitude - latDiff, latitude + latDiff, longitude - lonDiff, longitude + lonDiff, latitude, longitude]
    )

    // Calculer la distance exacte et filtrer par rayon en JavaScript
    const transactionsInRadius = transactions
      .map(t => {
        const distance = this.calculateDistance(latitude, longitude, t.centroid_y, t.centroid_x)
        return { ...t, distance_km: distance }
      })
      .filter(t => t.distance_km <= rayonKm)
      .sort((a, b) => a.distance_km - b.distance_km || a.age_jours - b.age_jours)

    // Limiter le nombre de transactions pour optimiser les calculs
    const finalTransactions = transactionsInRadius.slice(0, 100)

    if (finalTransactions.length === 0) {
      return {
        nbTransactions: 0,
        confiance: 'aucune_donnee',
        message: 'Aucune transaction trouvée dans cette zone'
      }
    }

    // Extraire les valeurs pour analyse statistique
    const prix = finalTransactions.map(t => t.valeurfonc)
    const prixM2 = finalTransactions.filter(t => t.sbati > 0).map(t => t.valeurfonc / t.sbati)
    const surfaces = finalTransactions.filter(t => t.sbati > 0).map(t => t.sbati)

    // Pondérations temporelles (plus récent = plus de poids)
    const poids = finalTransactions.map(t => {
      const ageAnnees = t.age_jours / 365
      if (ageAnnees <= 0.5) return 3.0 // < 6 mois: poids triple
      if (ageAnnees <= 1.0) return 2.0 // 6-12 mois: poids double
      if (ageAnnees <= 1.5) return 1.5 // 12-18 mois: poids 1.5x
      return 1.0 // > 18 mois: poids normal
    })

    // Calculer les statistiques robustes en une seule passe
    const statsPrix = this.calculateCompleteStats(prix, poids)
    const statsPrixM2 = prixM2.length > 0 ? this.calculateCompleteStats(prixM2) : null

    // Analyser l'activité par période
    const activite = this.analyserActiviteTemporelle(finalTransactions)

    // Déterminer le niveau de confiance
    const confiance = this.determinerConfiance(finalTransactions.length, rayonKm)

    return {
      nbTransactions: finalTransactions.length,
      confiance,
      rayon: rayonKm,
      statistiques: {
        prix: statsPrix,
        prixM2: statsPrixM2,
        surfaces:
          surfaces.length > 0
            ? {
                median: this.calculatePercentiles(surfaces, [0.5]).p50,
                percentiles: this.calculatePercentiles(surfaces, [0.25, 0.5, 0.75])
              }
            : null
      },
      activite,
      typologie: this.analyserTypologie(finalTransactions),
      transactionsRecentes: finalTransactions.slice(0, 5).map(t => ({
        date: t.datemut,
        prix: t.valeurfonc,
        surface: t.sbati,
        prixM2: t.sbati > 0 ? Math.round(t.valeurfonc / t.sbati) : null,
        type: t.libtypbien,
        distance: t.distance_km
      }))
    }
  }

  /**
   * Analyse l'activité temporelle
   */
  analyserActiviteTemporelle(transactions) {
    const _maintenant = new Date()
    const periodes = {
      '3mois': 0,
      '6mois': 0,
      '12mois': 0,
      '24mois': 0
    }

    transactions.forEach(t => {
      const ageJours = t.age_jours
      if (ageJours <= 90) periodes['3mois']++
      if (ageJours <= 180) periodes['6mois']++
      if (ageJours <= 365) periodes['12mois']++
      if (ageJours <= 730) periodes['24mois']++
    })

    // Calculer la tendance (augmentation ou diminution de l'activité)
    const recentActivity = periodes['6mois']
    const olderActivity = periodes['12mois'] - periodes['6mois']

    let tendance = 'stable'
    if (recentActivity > olderActivity * 1.2) tendance = 'croissante'
    else if (recentActivity < olderActivity * 0.8) tendance = 'decroissante'

    return {
      periodes,
      tendance,
      transactionsParMois: Math.round((periodes['12mois'] / 12) * 10) / 10
    }
  }

  /**
   * Analyse la typologie des biens
   */
  analyserTypologie(transactions) {
    const types = {}

    transactions.forEach(t => {
      const type = t.libtypbien.includes('MAISON')
        ? 'maison'
        : t.libtypbien.includes('APPARTEMENT')
          ? 'appartement'
          : 'autre'
      types[type] = (types[type] || 0) + 1
    })

    return types
  }

  /**
   * Détermine le niveau de confiance
   */
  determinerConfiance(nbTransactions, rayon) {
    // Ajuster selon le rayon (plus de transactions attendues dans un grand rayon)
    const facteurRayon = Math.sqrt(rayon)
    const nbAjuste = nbTransactions / facteurRayon

    if (nbAjuste >= 50) return 'excellent'
    if (nbAjuste >= 30) return 'bon'
    if (nbAjuste >= 10) return 'moyen'
    if (nbAjuste >= 3) return 'faible'
    return 'tres_faible'
  }

  /**
   * Calcule les comparaisons entre différents rayons
   */
  calculerComparaisons(resultats) {
    const comparaisons = {}
    const rayons = Object.keys(resultats)
      .filter(k => k.includes('km'))
      .sort()

    if (rayons.length < 2) return comparaisons

    // Comparer le plus petit rayon avec les autres
    const baseRayon = rayons[0]
    const baseStats = resultats[baseRayon]

    if (baseStats.statistiques?.prix?.median) {
      rayons.slice(1).forEach(rayon => {
        const stats = resultats[rayon]
        if (stats.statistiques?.prix?.median) {
          const diff = stats.statistiques.prix.median - baseStats.statistiques.prix.median
          const pct = (diff / baseStats.statistiques.prix.median) * 100

          comparaisons[`${baseRayon}_vs_${rayon}`] = {
            difference: Math.round(diff),
            pourcentage: Math.round(pct * 10) / 10,
            interpretation: pct > 5 ? 'plus_cher' : pct < -5 ? 'moins_cher' : 'similaire'
          }
        }
      })
    }

    return comparaisons
  }

  /**
   * Récupère les ventes récentes autour d'un point
   */
  async getVentesRecentes(latitude, longitude, rayon = 2, limite = 10, codeInsee = null) {
    const dept = this.getDepartmentFromLocation(latitude, longitude, codeInsee)
    if (!dept) return { error: 'Impossible de déterminer le département' }

    const db = await this.getDepartmentDb(dept)
    if (!db) return { error: `Base non disponible pour département ${dept}` }

    const latDiff = rayon / 111.0
    const lonDiff = rayon / (111.0 * Math.cos((latitude * Math.PI) / 180))

    const ventes = await db.all(
      `
      SELECT 
        datemut,
        valeurfonc,
        sbati,
        libtypbien,
        l_codinsee,
        ROUND(valeurfonc / NULLIF(sbati, 0)) as prix_m2,
        centroid_x,
        centroid_y
      FROM mutations
      WHERE valeurfonc > 0
        AND centroid_y BETWEEN ? AND ?
        AND centroid_x BETWEEN ? AND ?
      ORDER BY datemut DESC
      LIMIT ?
    `,
      [latitude - latDiff, latitude + latDiff, longitude - lonDiff, longitude + lonDiff, limite]
    )

    // Calculer les distances en JavaScript
    const ventesAvecDistance = ventes
      .map(v => {
        const distance = this.calculerDistance(latitude, longitude, v.centroid_y, v.centroid_x)
        return { ...v, distance_km: distance }
      })
      .filter(v => v.distance_km <= rayon)
      .sort((a, b) => new Date(b.datemut) - new Date(a.datemut))

    return {
      nbVentes: ventesAvecDistance.length,
      rayon,
      ventes: ventesAvecDistance.map(v => ({
        date: v.datemut,
        prix: v.valeurfonc,
        surface: v.sbati,
        prixM2: v.prix_m2,
        type: this.simplifierTypeBien(v.libtypbien),
        commune: v.l_codinsee,
        distance: v.distance_km
      }))
    }
  }

  /**
   * Analyse l'évolution des prix sur différentes périodes
   */
  async getEvolutionPrix(latitude, longitude, rayon = 2, periodes = null, codeInsee = null) {
    periodes = periodes || this.config.periodesStandard

    const dept = this.getDepartmentFromLocation(latitude, longitude, codeInsee)
    if (!dept) return { error: 'Impossible de déterminer le département' }

    const db = await this.getDepartmentDb(dept)
    if (!db) return { error: `Base non disponible pour département ${dept}` }

    const evolution = {}

    for (const mois of periodes) {
      const stats = await this.getStatsPeriode(db, latitude, longitude, rayon, mois)
      evolution[`${mois}mois`] = stats
    }

    // Calculer les tendances
    evolution.tendances = this.calculerTendances(evolution)

    return evolution
  }

  /**
   * Récupère les statistiques pour une période donnée
   */
  async getStatsPeriode(db, latitude, longitude, rayon, moisRetour) {
    const latDiff = rayon / 111.0
    const lonDiff = rayon / (111.0 * Math.cos((latitude * Math.PI) / 180))

    const dateDebut = `date('now', '-${moisRetour + 3} months')` // +3 mois pour avoir une fenêtre
    const dateFin = `date('now', '-${moisRetour - 3} months')`

    const transactions = await db.all(
      `
      SELECT 
        valeurfonc,
        sbati,
        valeurfonc / NULLIF(sbati, 0) as prix_m2
      FROM mutations
      WHERE valeurfonc > 0
        AND sbati > 0
        AND centroid_y BETWEEN ? AND ?
        AND centroid_x BETWEEN ? AND ?
        AND datemut BETWEEN ${dateDebut} AND ${dateFin}
        AND 111.0 * SQRT(
          POWER(centroid_y - ?, 2) + 
          POWER((centroid_x - ?) * COS(? * 3.14159 / 180), 2)
        ) <= ?
    `,
      [
        latitude - latDiff,
        latitude + latDiff,
        longitude - lonDiff,
        longitude + lonDiff,
        latitude,
        longitude,
        latitude,
        rayon
      ]
    )

    if (transactions.length === 0) {
      return { nbTransactions: 0, donnees: 'insuffisantes' }
    }

    const prixM2 = transactions.map(t => t.prix_m2).filter(p => p > 0)

    return {
      nbTransactions: transactions.length,
      prixM2: {
        median: this.calculatePercentiles(prixM2, [0.5]).p50,
        moyenneRobuste: this.calculateRobustMean(prixM2),
        percentiles: this.calculatePercentiles(prixM2, [0.25, 0.5, 0.75])
      }
    }
  }

  /**
   * Calcule les tendances d'évolution
   */
  calculerTendances(evolution) {
    const tendances = {}

    // Comparer période actuelle vs 12 mois
    if (evolution['3mois']?.prixM2?.median && evolution['12mois']?.prixM2?.median) {
      const evolution12m =
        ((evolution['3mois'].prixM2.median - evolution['12mois'].prixM2.median) / evolution['12mois'].prixM2.median) *
        100
      tendances.evolution12mois = {
        pourcentage: Math.round(evolution12m * 10) / 10,
        interpretation: evolution12m > 2 ? 'hausse' : evolution12m < -2 ? 'baisse' : 'stable'
      }
    }

    // Comparer période actuelle vs 24 mois
    if (evolution['3mois']?.prixM2?.median && evolution['24mois']?.prixM2?.median) {
      const evolution24m =
        ((evolution['3mois'].prixM2.median - evolution['24mois'].prixM2.median) / evolution['24mois'].prixM2.median) *
        100
      tendances.evolution24mois = {
        pourcentage: Math.round(evolution24m * 10) / 10,
        interpretation:
          evolution24m > 5
            ? 'forte_hausse'
            : evolution24m > 2
              ? 'hausse'
              : evolution24m < -5
                ? 'forte_baisse'
                : evolution24m < -2
                  ? 'baisse'
                  : 'stable'
      }
    }

    return tendances
  }

  /**
   * Identifie les zones chaudes (forte activité ou évolution prix)
   */
  async getZonesChaudesDepartement(departement, metrique = 'activite') {
    const db = await this.getDepartmentDb(departement)
    if (!db) return { error: `Base non disponible pour département ${departement}` }

    let query
    if (metrique === 'activite') {
      // Zones avec le plus de transactions récentes
      query = `
        SELECT 
          SUBSTR(l_codinsee, 1, 5) as commune,
          COUNT(*) as nb_transactions,
          AVG(valeurfonc) as prix_moyen,
          AVG(valeurfonc/NULLIF(sbati, 0)) as prix_m2_moyen
        FROM mutations
        WHERE datemut >= date('now', '-6 months')
          AND valeurfonc > 0
        GROUP BY commune
        ORDER BY nb_transactions DESC
        LIMIT 20
      `
    } else if (metrique === 'evolution_prix') {
      // Zones avec la plus forte évolution de prix
      query = `
        WITH prix_recent AS (
          SELECT 
            SUBSTR(l_codinsee, 1, 5) as commune,
            AVG(valeurfonc/NULLIF(sbati, 0)) as prix_m2
          FROM mutations
          WHERE datemut >= date('now', '-6 months')
            AND valeurfonc > 0
            AND sbati > 0
          GROUP BY commune
        ),
        prix_ancien AS (
          SELECT 
            SUBSTR(l_codinsee, 1, 5) as commune,
            AVG(valeurfonc/NULLIF(sbati, 0)) as prix_m2
          FROM mutations
          WHERE datemut BETWEEN date('now', '-18 months') AND date('now', '-12 months')
            AND valeurfonc > 0
            AND sbati > 0
          GROUP BY commune
        )
        SELECT 
          pr.commune,
          pr.prix_m2 as prix_recent,
          pa.prix_m2 as prix_ancien,
          ROUND((pr.prix_m2 - pa.prix_m2) / pa.prix_m2 * 100, 1) as evolution_pct
        FROM prix_recent pr
        JOIN prix_ancien pa ON pr.commune = pa.commune
        WHERE pa.prix_m2 > 0
        ORDER BY evolution_pct DESC
        LIMIT 10
      `
    }

    const resultats = await db.all(query)

    return {
      departement,
      metrique,
      zones: resultats
    }
  }

  /**
   * Compare un quartier avec la ville/département
   */
  async comparerQuartierVille(latitude, longitude, rayonLocal = 1, rayonVille = 10, codeInsee = null) {
    const [statsLocal, statsVille] = await Promise.all([
      this.getMetriquesQuartier(latitude, longitude, [rayonLocal], codeInsee),
      this.getMetriquesQuartier(latitude, longitude, [rayonVille], codeInsee)
    ])

    const local = statsLocal[`${rayonLocal}km`]
    const ville = statsVille[`${rayonVille}km`]

    if (!local?.statistiques?.prix || !ville?.statistiques?.prix) {
      return { error: 'Données insuffisantes pour comparaison' }
    }

    const prixLocalMedian = local.statistiques.prix.median
    const prixVilleMedian = ville.statistiques.prix.median

    const difference = prixLocalMedian - prixVilleMedian
    const pourcentage = (difference / prixVilleMedian) * 100

    return {
      quartier: {
        rayon: rayonLocal,
        prixMedian: prixLocalMedian,
        nbTransactions: local.nbTransactions,
        confiance: local.confiance
      },
      ville: {
        rayon: rayonVille,
        prixMedian: prixVilleMedian,
        nbTransactions: ville.nbTransactions
      },
      comparaison: {
        difference: Math.round(difference),
        pourcentage: Math.round(pourcentage * 10) / 10,
        interpretation:
          pourcentage > 10
            ? 'quartier_premium'
            : pourcentage > 5
              ? 'quartier_cher'
              : pourcentage < -10
                ? 'quartier_abordable'
                : pourcentage < -5
                  ? 'quartier_economique'
                  : 'quartier_dans_moyenne',
        activiteRelative: local.nbTransactions > ville.nbTransactions * 0.1 ? 'actif' : 'peu_actif'
      }
    }
  }

  /**
   * Détermine si un quartier est actif
   */
  async isQuartierActif(latitude, longitude, rayon = 1, codeInsee = null) {
    const stats = await this.getMetriquesQuartier(latitude, longitude, [rayon, rayon * 5], codeInsee)

    const local = stats[`${rayon}km`]
    const ville = stats[`${rayon * 5}km`]

    if (!local || !ville) {
      return { error: 'Données insuffisantes' }
    }

    // Calculer la densité de transactions
    const densiteLocal = local.nbTransactions / (Math.PI * rayon * rayon)
    const densiteVille = ville.nbTransactions / (Math.PI * (rayon * 5) * (rayon * 5))

    const ratioActivite = densiteLocal / densiteVille

    return {
      actif: ratioActivite > 0.8,
      niveauActivite:
        ratioActivite > 1.5
          ? 'tres_actif'
          : ratioActivite > 1.0
            ? 'actif'
            : ratioActivite > 0.5
              ? 'moyennement_actif'
              : 'peu_actif',
      metriques: {
        transactionsLocales: local.nbTransactions,
        transactionsParKm2Local: Math.round(densiteLocal),
        transactionsParKm2Ville: Math.round(densiteVille),
        ratioActivite: Math.round(ratioActivite * 100) / 100
      },
      tendance: local.activite?.tendance
    }
  }

  /**
   * Simplifie le type de bien
   */
  simplifierTypeBien(libelle) {
    if (libelle.includes('MAISON')) return 'Maison'
    if (libelle.includes('APPARTEMENT')) return 'Appartement'
    if (libelle.includes('TERRAIN')) return 'Terrain'
    if (libelle.includes('LOCAL')) return 'Local commercial'
    return 'Autre'
  }

  /**
   * Gestion du cache LRU avec taille limitée
   */
  getCachedResult(key) {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      // Remettre en tête (LRU)
      this.cache.delete(key)
      this.cache.set(key, cached)
      this.cacheHits++
      return cached.data
    }
    this.cache.delete(key)
    this.cacheMisses++
    return null
  }

  setCachedResult(key, data) {
    // Si cache plein, supprimer le plus ancien
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  /**
   * Statistiques du cache pour monitoring
   */
  getCacheStats() {
    const total = this.cacheHits + this.cacheMisses
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: total > 0 ? `${((this.cacheHits / total) * 100).toFixed(1)}%` : '0%'
    }
  }

  /**
   * Formatage français des nombres
   */
  formatPrice(price) {
    if (!price) return null
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(price)
  }

  formatNumber(number) {
    if (!number) return null
    return new Intl.NumberFormat('fr-FR').format(Math.round(number))
  }

  calculerDistance(lat1, lon1, lat2, lon2) {
    const R = 6371 // Rayon de la Terre en km
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return Math.round(R * c * 100) / 100 // Arrondi à 2 décimales
  }

  /**
   * Validation des paramètres d'entrée
   */
  validateCoordinates(latitude, longitude) {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      throw new Error('Les coordonnées doivent être des nombres')
    }
    if (latitude < 41 || latitude > 51 || longitude < -5 || longitude > 10) {
      throw new Error('Coordonnées hors de France métropolitaine')
    }
  }

  /**
   * Nettoie les connexions
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
    this.cache.clear()
  }
}

export default DVFAnalyticsQuartierService
