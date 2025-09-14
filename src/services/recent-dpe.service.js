import { calculateDistance, geocodeAddress } from '../utils/utilsGeo.js'

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
 * Recherche les DPE récents autour d'une adresse
 */
export async function searchRecentDPE(criteria) {
  // 1. Calculer la date limite
  const dateLimit = new Date()
  dateLimit.setMonth(dateLimit.getMonth() - criteria.monthsBack)
  const dateLimitStr = dateLimit.toISOString().split('T')[0]

  // 2. Géocoder l'adresse pour obtenir les coordonnées (nécessaire pour la recherche par rayon)
  const { lat, lon, formattedAddress, postalCode, city } = await geocodeAddress(criteria.address, {
    throwOnError: true
  })

  // 2b. Créer l'adresse combinée pour l'affichage et la recherche
  let fullCombinedAddress = formattedAddress

  // Vérifier si l'adresse géocodée contient déjà un numéro
  const geocodedHasNumber = /^\d/.test(formattedAddress)

  if (!geocodedHasNumber) {
    // Si pas de numéro dans l'adresse géocodée, essayer d'en extraire un de l'input utilisateur
    const numberMatch = criteria.address.match(/^(\d{1,4})\s+/)
    if (numberMatch) {
      fullCombinedAddress = `${numberMatch[1]} ${formattedAddress}`
    }
  }

  // Créer une version simplifiée pour l'affichage
  const displayAddress = fullCombinedAddress
    .replace(/\s+\d{5}\s+/, ' ') // Enlever le code postal
    .replace(/(\s+)([A-Z][a-zÀ-ÿ\-']{9,})/, (_match, space, city) => {
      // Tronquer les noms de ville après 9 caractères
      return `${space}${city.substring(0, 9)}...`
    })

  // 3. Faire les deux recherches en parallèle
  const [exactAddressResults, radiusResults] = await Promise.all([
    // Recherche par adresse exacte - passer l'adresse originale ET l'adresse géocodée
    searchByAddress(criteria.address, formattedAddress, dateLimitStr, criteria),
    // Recherche par rayon géographique
    searchInRadius(lat, lon, criteria.radius, dateLimitStr, criteria.monthsBack, criteria)
  ])

  // 4. Combiner et dédupliquer les résultats
  const resultsMap = new Map()

  // D'abord ajouter les résultats de recherche exacte (avec distance 0)
  if (exactAddressResults && exactAddressResults.length > 0) {
    exactAddressResults.forEach(dpe => {
      if (dpe.numero_dpe) {
        resultsMap.set(dpe.numero_dpe, {
          ...dpe,
          _isExactMatch: true,
          _distance: 0 // Les correspondances exactes ont toujours une distance de 0
        })
      }
    })
  }

  // Ensuite ajouter les résultats du rayon (sans écraser les correspondances exactes)
  if (radiusResults && radiusResults.length > 0) {
    radiusResults.forEach(dpe => {
      if (dpe.numero_dpe && !resultsMap.has(dpe.numero_dpe)) {
        resultsMap.set(dpe.numero_dpe, {
          ...dpe,
          _isExactMatch: false
        })
      }
    })
  }

  // Convertir la Map en array
  let results = Array.from(resultsMap.values())

  // 5. Calculer les scores et distances ET mapper les résultats
  results = results
    .map(dpe => {
      // Pour les correspondances exactes, garder la distance à 0
      if (dpe._isExactMatch) {
        const matchScore = calculateMatchScore(dpe, criteria)
        const mappedResult = mapAdemeResult(dpe)
        return {
          ...mappedResult,
          _distance: 0, // Distance 0 pour les correspondances exactes
          _matchScore: matchScore,
          _searchRadius: criteria.radius,
          _isExactMatch: true
        }
      }

      // Pour les autres, calculer la distance normale
      let dpeLat, dpeLon
      if (dpe._geopoint) {
        const coords = dpe._geopoint.split(',')
        dpeLat = parseFloat(coords[0])
        dpeLon = parseFloat(coords[1])
      } else {
        return null
      }

      const distance = dpe._distance !== undefined ? dpe._distance : calculateDistance(lat, lon, dpeLat, dpeLon)
      const matchScore = calculateMatchScore(dpe, criteria)

      // Mapper les champs ADEME vers notre format cohérent
      const mappedResult = mapAdemeResult(dpe)

      return {
        ...mappedResult,
        _distance: distance,
        _matchScore: matchScore,
        _searchRadius: criteria.radius,
        _isExactMatch: false
      }
    })
    .filter(r => r !== null)

  // 6. Trier par distance (plus proche en premier, correspondances exactes d'abord)
  results.sort((a, b) => {
    // Les correspondances exactes viennent toujours en premier
    if (a._isExactMatch && !b._isExactMatch) return -1
    if (!a._isExactMatch && b._isExactMatch) return 1

    // Sinon, trier par distance croissante
    return (a._distance || 0) - (b._distance || 0)
  })

  return {
    results: results, // Retourner tous les résultats, sans limite
    searchAddress: displayAddress, // Version tronquée pour l'affichage
    fullSearchAddress: fullCombinedAddress, // Version complète pour la comparaison
    searchCoordinates: { lat, lon },
    totalFound: results.length,
    searchRadius: criteria.radius,
    postalCode: postalCode, // Inclure le code postal du géocodage
    searchMetadata: {
      postalCode: postalCode,
      city: city
    }
  }
}

/**
 * Effectue une recherche par adresse exacte
 */
async function searchByAddress(userInput, geocodedAddress, dateLimit, criteria) {
  // Extraire le numéro de rue du début de l'input utilisateur (s'il existe)
  let streetNumber = ''
  const numberMatch = userInput.match(/^(\d{1,4})\s+/)
  if (numberMatch) {
    streetNumber = numberMatch[1]
  }

  // Construire l'adresse finale pour la recherche
  let finalAddress
  if (streetNumber && geocodedAddress) {
    // Si on a un numéro et une adresse géocodée, combiner les deux
    finalAddress = `${streetNumber} ${geocodedAddress}`
  } else {
    // Sinon utiliser l'input utilisateur tel quel
    finalAddress = userInput
  }

  // Nettoyer légèrement l'adresse - garder les lettres, chiffres, espaces, tirets et apostrophes
  // Normaliser les espaces multiples en un seul espace
  const cleanedAddress = finalAddress
    .replace(/[^\w\s\-']/g, ' ')
    .replace(/\s+/g, ' ') // Remplacer les espaces multiples par un seul
    .trim()

  // Construire le filtre qs avec l'adresse et la date
  // Utiliser une recherche plus stricte pour éviter trop de faux positifs
  let qsFilter = `adresse_ban:"${cleanedAddress}" AND date_etablissement_dpe:>${dateLimit}`

  // Ajouter les mêmes filtres que pour searchInRadius
  // Ajouter le filtre de surface si spécifié (avec support des opérateurs)
  if (criteria.surface) {
    const surfaceComparison = parseComparisonValue(criteria.surface)
    if (surfaceComparison && surfaceComparison.value > 0) {
      if (surfaceComparison.operator === '=') {
        // Pour une correspondance exacte, arrondir et utiliser ±1 m²
        const roundedSurface = Math.round(surfaceComparison.value)
        const minSurface = roundedSurface - 1
        const maxSurface = roundedSurface + 1
        qsFilter += ` AND surface_habitable_logement:[${minSurface} TO ${maxSurface}]`
      } else {
        // Pour les opérateurs < ou >, utiliser une requête de plage
        const query = buildRangeQuery(surfaceComparison, 'surface_habitable_logement')
        if (query) qsFilter += ` AND ${query}`
      }
    }
  }

  // Ajouter le filtre de consommation si spécifié
  if (criteria.consommation) {
    const consoComparison = parseComparisonValue(criteria.consommation)
    if (consoComparison && consoComparison.value > 0) {
      if (consoComparison.operator === '=') {
        const exactValue = Math.round(consoComparison.value)
        qsFilter += ` AND conso_5_usages_par_m2_ep:${exactValue}`
      } else {
        const query = buildRangeQuery(consoComparison, 'conso_5_usages_par_m2_ep')
        if (query) qsFilter += ` AND ${query}`
      }
    }
  }

  // Ajouter le filtre GES si spécifié
  if (criteria.ges) {
    const gesComparison = parseComparisonValue(criteria.ges)
    if (gesComparison && gesComparison.value > 0) {
      if (gesComparison.operator === '=') {
        const exactValue = Math.round(gesComparison.value)
        qsFilter += ` AND emission_ges_5_usages_par_m2:${exactValue}`
      } else {
        const query = buildRangeQuery(gesComparison, 'emission_ges_5_usages_par_m2')
        if (query) qsFilter += ` AND ${query}`
      }
    }
  }

  // Ajouter le filtre de type de bien si spécifié
  if (criteria.typeBien) {
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
    size: 100, // Limiter à 100 pour les correspondances exactes
    sort: '-date_etablissement_dpe',
    qs: qsFilter
  })

  const url = `${ADEME_API_URL}?${params}`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      return [] // Retourner un tableau vide en cas d'erreur
    }
    const data = await response.json()
    return data.results || []
  } catch (_error) {
    return [] // Retourner un tableau vide en cas d'erreur
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
        // Pour une correspondance exacte, arrondir et utiliser ±1 m²
        const roundedSurface = Math.round(surfaceComparison.value)
        const minSurface = roundedSurface - 1
        const maxSurface = roundedSurface + 1
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
      if (consoComparison.operator === '=') {
        // Pour une correspondance exacte de consommation, utiliser la valeur exacte
        const exactValue = Math.round(consoComparison.value)
        qsFilter += ` AND conso_5_usages_par_m2_ep:${exactValue}`
      } else {
        const query = buildRangeQuery(consoComparison, 'conso_5_usages_par_m2_ep')
        if (query) qsFilter += ` AND ${query}`
      }
    }
  }

  // Ajouter le filtre GES si spécifié (avec support des opérateurs)
  if (criteria.ges) {
    const gesComparison = parseComparisonValue(criteria.ges)
    if (gesComparison && gesComparison.value > 0) {
      if (gesComparison.operator === '=') {
        // Pour une correspondance exacte de GES, utiliser la valeur exacte
        const exactValue = Math.round(gesComparison.value)
        qsFilter += ` AND emission_ges_5_usages_par_m2:${exactValue}`
      } else {
        const query = buildRangeQuery(gesComparison, 'emission_ges_5_usages_par_m2')
        if (query) qsFilter += ` AND ${query}`
      }
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
