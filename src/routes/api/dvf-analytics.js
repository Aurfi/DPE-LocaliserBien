import express from 'express'
import DVFAnalyticsQuartierService from '../../services/dvf-analytics-quartier.service.js'

const router = express.Router()

// Instance du service analytics
const analyticsService = new DVFAnalyticsQuartierService()

// Middleware de validation des coordonnées
const validateCoordinates = (req, res, next) => {
  try {
    const { latitude, longitude } = req.query
    const lat = parseFloat(latitude)
    const lon = parseFloat(longitude)

    analyticsService.validateCoordinates(lat, lon)

    req.coordinates = { latitude: lat, longitude: lon }
    next()
  } catch (error) {
    res.status(400).json({
      error: 'Paramètres invalides',
      message: error.message
    })
  }
}

// Middleware de rate limiting simple
const rateLimitMap = new Map()
const rateLimit = (req, res, next) => {
  const ip = req.ip
  const now = Date.now()
  const minute = Math.floor(now / 60000)
  const key = `${ip}-${minute}`

  const current = rateLimitMap.get(key) || 0
  if (current >= analyticsService.apiConfig.rateLimitPerMinute) {
    return res.status(429).json({
      error: 'Trop de requêtes',
      message: 'Limite de 60 requêtes par minute dépassée'
    })
  }

  rateLimitMap.set(key, current + 1)

  // Nettoyer les anciennes entrées
  if (Math.random() < 0.1) {
    for (const [k] of rateLimitMap) {
      if (parseInt(k.split('-')[1], 10) < minute - 1) {
        rateLimitMap.delete(k)
      }
    }
  }

  next()
}

/**
 * GET /api/dvf-analytics/quartier
 * Analyse complète d'un quartier avec plusieurs rayons
 */
router.get('/quartier', rateLimit, validateCoordinates, async (req, res) => {
  try {
    const { latitude, longitude } = req.coordinates
    const { rayons, codeInsee, format = 'json' } = req.query

    // Parser les rayons personnalisés
    let parsedRayons = analyticsService.apiConfig.defaultRadius
    if (rayons) {
      parsedRayons = rayons
        .split(',')
        .map(r => parseFloat(r))
        .filter(r => r > 0 && r <= analyticsService.apiConfig.maxRadius)
    }

    const startTime = Date.now()
    const metriques = await analyticsService.getMetriquesQuartier(latitude, longitude, parsedRayons, codeInsee)

    const response = {
      success: true,
      data: metriques,
      meta: {
        coordinates: { latitude, longitude },
        rayons: parsedRayons,
        executionTime: Date.now() - startTime,
        cache: analyticsService.getCacheStats()
      }
    }

    // Format français pour l'affichage
    if (format === 'display') {
      formatForDisplay(response.data)
    }

    res.json(response)
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erreur interne',
      message: error.message
    })
  }
})

/**
 * GET /api/dvf-analytics/ventes-recentes
 * Liste des ventes récentes autour d'un point
 */
router.get('/ventes-recentes', rateLimit, validateCoordinates, async (req, res) => {
  try {
    const { latitude, longitude } = req.coordinates
    const { rayon = 2, limite = 10, codeInsee } = req.query

    const rayonNum = Math.min(parseFloat(rayon), analyticsService.apiConfig.maxRadius)
    const limiteNum = Math.min(parseInt(limite, 10), analyticsService.apiConfig.maxResults)

    const ventes = await analyticsService.getVentesRecentes(latitude, longitude, rayonNum, limiteNum, codeInsee)

    res.json({
      success: true,
      data: ventes,
      meta: {
        coordinates: { latitude, longitude },
        rayon: rayonNum,
        limite: limiteNum
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erreur interne',
      message: error.message
    })
  }
})

/**
 * GET /api/dvf-analytics/evolution-prix
 * Évolution des prix sur différentes périodes
 */
router.get('/evolution-prix', rateLimit, validateCoordinates, async (req, res) => {
  try {
    const { latitude, longitude } = req.coordinates
    const { rayon = 2, periodes, codeInsee } = req.query

    const rayonNum = Math.min(parseFloat(rayon), analyticsService.apiConfig.maxRadius)

    // Parser les périodes personnalisées
    let parsedPeriodes = analyticsService.config.periodesStandard
    if (periodes) {
      parsedPeriodes = periodes
        .split(',')
        .map(p => parseInt(p, 10))
        .filter(p => p > 0 && p <= 36) // Max 36 mois
    }

    const evolution = await analyticsService.getEvolutionPrix(latitude, longitude, rayonNum, parsedPeriodes, codeInsee)

    res.json({
      success: true,
      data: evolution,
      meta: {
        coordinates: { latitude, longitude },
        rayon: rayonNum,
        periodes: parsedPeriodes
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erreur interne',
      message: error.message
    })
  }
})

/**
 * GET /api/dvf-analytics/comparaison
 * Comparaison quartier vs ville
 */
router.get('/comparaison', rateLimit, validateCoordinates, async (req, res) => {
  try {
    const { latitude, longitude } = req.coordinates
    const { rayonLocal = 1, rayonVille = 10, codeInsee } = req.query

    const rayonLocalNum = Math.min(parseFloat(rayonLocal), 5)
    const rayonVilleNum = Math.min(parseFloat(rayonVille), analyticsService.apiConfig.maxRadius)

    const comparaison = await analyticsService.comparerQuartierVille(
      latitude,
      longitude,
      rayonLocalNum,
      rayonVilleNum,
      codeInsee
    )

    res.json({
      success: true,
      data: comparaison,
      meta: {
        coordinates: { latitude, longitude },
        rayonLocal: rayonLocalNum,
        rayonVille: rayonVilleNum
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erreur interne',
      message: error.message
    })
  }
})

/**
 * GET /api/dvf-analytics/activite
 * Niveau d'activité d'un quartier
 */
router.get('/activite', rateLimit, validateCoordinates, async (req, res) => {
  try {
    const { latitude, longitude } = req.coordinates
    const { rayon = 1, codeInsee } = req.query

    const rayonNum = Math.min(parseFloat(rayon), analyticsService.apiConfig.maxRadius)

    const activite = await analyticsService.isQuartierActif(latitude, longitude, rayonNum, codeInsee)

    res.json({
      success: true,
      data: activite,
      meta: {
        coordinates: { latitude, longitude },
        rayon: rayonNum
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erreur interne',
      message: error.message
    })
  }
})

/**
 * GET /api/dvf-analytics/zones-chaudes/:departement
 * Zones chaudes d'un département
 */
router.get('/zones-chaudes/:departement', rateLimit, async (req, res) => {
  try {
    const { departement } = req.params
    const { metrique = 'activite' } = req.query

    if (!['activite', 'evolution_prix'].includes(metrique)) {
      return res.status(400).json({
        success: false,
        error: 'Métrique invalide',
        message: 'Métriques disponibles: activite, evolution_prix'
      })
    }

    const zones = await analyticsService.getZonesChaudesDepartement(departement, metrique)

    res.json({
      success: true,
      data: zones,
      meta: {
        departement,
        metrique
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erreur interne',
      message: error.message
    })
  }
})

/**
 * GET /api/dvf-analytics/health
 * Status de l'API et statistiques de cache
 */
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    status: 'operational',
    cache: analyticsService.getCacheStats(),
    config: analyticsService.apiConfig,
    uptime: process.uptime()
  })
})

/**
 * Formate les données pour l'affichage français
 */
function formatForDisplay(data) {
  Object.keys(data).forEach(key => {
    const item = data[key]
    if (item?.statistiques?.prix) {
      const prix = item.statistiques.prix
      if (prix.median) prix.medianFormatted = analyticsService.formatPrice(prix.median)
      if (prix.moyenneRobuste) prix.moyenneRobusteFormatted = analyticsService.formatPrice(prix.moyenneRobuste)
    }
    if (item?.statistiques?.prixM2) {
      const prixM2 = item.statistiques.prixM2
      if (prixM2.median) prixM2.medianFormatted = `${analyticsService.formatNumber(prixM2.median)} €/m²`
      if (prixM2.moyenneRobuste)
        prixM2.moyenneRobusteFormatted = `${analyticsService.formatNumber(prixM2.moyenneRobuste)} €/m²`
    }
  })
}

// Nettoyer les connexions à la fermeture
process.on('SIGINT', async () => {
  await analyticsService.cleanup()
  process.exit(0)
})

export default router
