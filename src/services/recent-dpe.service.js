const ADEME_API_URL = 'https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/lines'

/**
 * Analyser une valeur qui peut contenir des opérateurs de comparaison
 * @param {string|number} value - Valeur qui peut avoir un opérateur < ou >
 * @returns {Object} - {operator: '<'|'>'|'=', value: number}
 */
function parseComparisonValue(value) {
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
 * Convertir une comparaison en requête de plage
 * @param {Object} comparison - {operator, value}
 * @param {string} fieldName - Nom du champ pour la requête
 * @returns {string} - Chaîne de requête de plage ou valeur exacte
 */
function buildRangeQuery(comparison, fieldName) {
  if (!comparison) return null

  switch (comparison.operator) {
    case '<':
      return `${fieldName}:[0 TO ${comparison.value}]`
    case '>':
      return `${fieldName}:[${comparison.value} TO 9999]`
    default: {
      // Pour une correspondance exacte dans la recherche récente, utiliser une tolérance
      const min = Math.round(comparison.value * 0.9)
      const max = Math.round(comparison.value * 1.1)
      return `${fieldName}:[${min} TO ${max}]`
    }
  }
}

/**
 * Convertit une adresse en coordonnées GPS via l'API gouv
 */
async function geocodeAddress(address) {
  const response = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(address)}&limit=1`)
  const data = await response.json()

  if (data.features && data.features.length > 0) {
    const feature = data.features[0]
    const [lon, lat] = feature.geometry.coordinates
    const postalCode = feature.properties.postcode
    const city = feature.properties.city
    return { lat, lon, formattedAddress: feature.properties.label, postalCode, city }
  }
  throw new Error('Adresse non trouvée')
}

/**
 * Calcule la distance entre deux points GPS (formule de Haversine)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
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
 * Calcule un score de correspondance pour les critères optionnels
 */
function calculateMatchScore(dpe, criteria) {
  let score = 100

  // Score pour la surface (tolérance 15%)
  if (criteria.surface && dpe.surface_habitable_logement) {
    const ecart = Math.abs(dpe.surface_habitable_logement - criteria.surface)
    const pourcentEcart = (ecart / criteria.surface) * 100

    if (pourcentEcart <= 5) score += 20
    else if (pourcentEcart <= 10) score += 10
    else if (pourcentEcart <= 15) score += 5
    else score -= 20
  }

  // Score pour la classe énergétique SEULEMENT si pas de consommation ou GES précis
  // Si l'utilisateur a fourni une consommation ou GES précis, on ne score pas sur la classe
  const hasPreciseValues =
    (criteria.consommation &&
      !criteria.consommation.toString().includes('<') &&
      !criteria.consommation.toString().includes('>')) ||
    (criteria.ges && !criteria.ges.toString().includes('<') && !criteria.ges.toString().includes('>'))

  if (!hasPreciseValues && criteria.energyClasses && criteria.energyClasses.length > 0 && dpe.etiquette_dpe) {
    const classesDPE = dpe.etiquette_dpe.toUpperCase()
    if (criteria.energyClasses.includes(classesDPE)) {
      score += 20
    } else {
      // Calcul de l'écart entre classes
      const classes = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
      const indexDPE = classes.indexOf(classesDPE)
      const minEcart = Math.min(...criteria.energyClasses.map(c => Math.abs(classes.indexOf(c) - indexDPE)))
      score -= minEcart * 10
    }
  }

  return Math.max(0, score)
}

/**
 * Mapper résultat ADEME vers notre format uniforme
 */
function mapAdemeResult(ademeData) {
  // Extraire les coordonnées GPS depuis _geopoint
  let latitude = null,
    longitude = null
  if (ademeData._geopoint) {
    ;[latitude, longitude] = ademeData._geopoint.split(',').map(parseFloat)
  }

  return {
    // Conserver les données brutes pour la compatibilité
    ...ademeData,

    // Ajouter les champs mappés pour la cohérence avec DPESearchService
    adresseComplete: (() => {
      // Si adresse_ban a déjà un numéro, l'utiliser tel quel
      if (ademeData.adresse_ban && /^\d/.test(ademeData.adresse_ban.trim())) {
        return ademeData.adresse_ban
      }

      // Si adresse_ban n'a pas de numéro mais adresse_brut en a un, les combiner
      if (ademeData.adresse_ban && ademeData.adresse_brut && /^\d+/.test(ademeData.adresse_brut.trim())) {
        const streetNumber = ademeData.adresse_brut.match(/^\d+[a-z]?\s*/i)[0].trim()
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

    // Insulation quality
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
    logementTraversant: ademeData.logement_traversant === 1 ? 'Oui' : ademeData.logement_traversant === 0 ? 'Non' : '',

    id: ademeData.numero_dpe || ademeData._id || '',
    numeroDPE: ademeData.numero_dpe || '',
    dateVisite: ademeData.date_etablissement_dpe
  }
}

/**
 * Exporter geocodeAddress pour usage externe
 */
export { geocodeAddress }

/**
 * Recherche les DPE récents autour d'une adresse
 */
export async function searchRecentDPE(criteria) {
  // 1. Géocoder l'adresse
  const { lat, lon, formattedAddress, postalCode, city } = await geocodeAddress(criteria.address)

  // 2. Calculer la date limite
  const dateLimit = new Date()
  dateLimit.setMonth(dateLimit.getMonth() - criteria.monthsBack)
  const dateLimitStr = dateLimit.toISOString().split('T')[0]

  // 3. Recherche avec geo_distance dans le rayon demandé
  const radius = criteria.radius
  let results = await searchInRadius(lat, lon, radius, dateLimitStr, criteria.monthsBack, criteria)

  // 5. Calculer les scores et distances ET mapper les résultats
  results = results
    .map(dpe => {
      // Extraire les coordonnées GPS depuis _geopoint pour la distance
      let dpeLat, dpeLon
      if (dpe._geopoint) {
        const coords = dpe._geopoint.split(',')
        dpeLat = parseFloat(coords[0])
        dpeLon = parseFloat(coords[1])
      } else {
        return null
      }

      const distance = calculateDistance(lat, lon, dpeLat, dpeLon)
      const matchScore = calculateMatchScore(dpe, criteria)

      // Mapper les champs ADEME vers notre format cohérent
      const mappedResult = mapAdemeResult(dpe)

      return {
        ...mappedResult,
        _distance: distance,
        _matchScore: matchScore,
        _searchRadius: radius
      }
    })
    .filter(r => r !== null)

  // 6. Trier par distance (plus proche en premier)
  results.sort((a, b) => {
    // Trier par distance croissante
    return (a._distance || 0) - (b._distance || 0)
  })

  return {
    results: results, // Retourner tous les résultats, sans limite
    searchAddress: formattedAddress,
    searchCoordinates: { lat, lon },
    totalFound: results.length,
    searchRadius: radius,
    postalCode: postalCode, // Inclure le code postal du géocodage
    searchMetadata: {
      postalCode: postalCode,
      city: city
    }
  }
}

/**
 * Effectue une recherche dans un rayon donné
 */
async function searchInRadius(lat, lon, radius, dateLimit, _monthsBack, criteria) {
  // Utiliser geo_distance pour filtrer par rayon
  const radiusMeters = radius * 1000 // Convertir km en mètres

  // Construire le filtre qs avec date et optionnellement surface et classe énergétique
  let qsFilter = `date_etablissement_dpe:>${dateLimit}`

  // Ajouter le filtre de surface si spécifié (avec support des opérateurs)
  if (criteria.surface) {
    const surfaceComparison = parseComparisonValue(criteria.surface)
    if (surfaceComparison && surfaceComparison.value > 0) {
      if (surfaceComparison.operator === '=') {
        // Pour une correspondance exacte, utiliser une tolérance de ±20%
        const minSurface = Math.round(surfaceComparison.value * 0.8)
        const maxSurface = Math.round(surfaceComparison.value * 1.2)
        qsFilter += ` AND surface_habitable_logement:[${minSurface} TO ${maxSurface}]`
      } else {
        // Pour les opérateurs < ou >, utiliser une requête de plage
        const query = buildRangeQuery(surfaceComparison, 'surface_habitable_logement')
        if (query) qsFilter += ` AND ${query}`
      }
    }
  }

  // Ajouter le filtre de consommation si spécifié (avec support des opérateurs)
  if (criteria.consommation) {
    const consoComparison = parseComparisonValue(criteria.consommation)
    if (consoComparison && consoComparison.value > 0) {
      const query = buildRangeQuery(consoComparison, 'conso_5_usages_par_m2_ep')
      if (query) qsFilter += ` AND ${query}`
    }
  }

  // Ajouter le filtre GES si spécifié (avec support des opérateurs)
  if (criteria.ges) {
    const gesComparison = parseComparisonValue(criteria.ges)
    if (gesComparison && gesComparison.value > 0) {
      const query = buildRangeQuery(gesComparison, 'emission_ges_5_usages_par_m2')
      if (query) qsFilter += ` AND ${query}`
    }
  }

  // Ajouter le filtre de type de bien si spécifié
  if (criteria.typeBien) {
    // Always include "immeuble" since it could be either type
    if (criteria.typeBien === 'maison') {
      qsFilter += ` AND (type_batiment:"maison" OR type_batiment:"immeuble")`
    } else if (criteria.typeBien === 'appartement') {
      qsFilter += ` AND (type_batiment:"appartement" OR type_batiment:"immeuble")`
    } else {
      qsFilter += ` AND type_batiment:"${criteria.typeBien}"`
    }
  }

  // Ajouter le filtre de classe énergétique si spécifié
  if (criteria.energyClasses && criteria.energyClasses.length > 0) {
    const classesFilter = criteria.energyClasses.map(c => c.toUpperCase()).join(' OR ')
    qsFilter += ` AND etiquette_dpe:(${classesFilter})`
  }

  // Ajouter le filtre de classe GES si spécifié
  if (criteria.gesClasses && criteria.gesClasses.length > 0) {
    const gesClassesFilter = criteria.gesClasses.map(c => c.toUpperCase()).join(' OR ')
    qsFilter += ` AND etiquette_ges:(${gesClassesFilter})`
  }

  const params = new URLSearchParams({
    size: 500, // Balanced limit for good coverage without overwhelming
    sort: '-date_etablissement_dpe', // Tri par date décroissante (plus récent en premier)
    geo_distance: `${lon}:${lat}:${radiusMeters}`, // Format lon:lat:distance_en_metres
    qs: qsFilter // Filtre combiné date + surface
  })

  const url = `${ADEME_API_URL}?${params}`

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Erreur API ADEME: ${response.status}`)
  }

  const data = await response.json()
  // geo_distance filtre déjà par distance, pas besoin de filtrer côté client
  return data.results || []
}
