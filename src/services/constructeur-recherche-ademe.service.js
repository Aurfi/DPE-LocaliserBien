/**
 * Service dédié à la construction et exécution des recherches ADEME
 * Extrait de dpe-search.service.js pour améliorer les performances par chargement paresseux
 */

import { calculateDistance, extractPostalCode } from '../utils/utilsGeo.js'

class ConstructeurRechercheAdeme {
  constructor(scoringService) {
    this.scoringService = scoringService
  }

  /**
   * Nettoie une chaîne pour utilisation dans une requête Lucene
   * Échappe les caractères spéciaux qui pourraient casser la requête
   * @param {string} str - Chaîne à nettoyer
   * @returns {string} Chaîne nettoyée
   */
  nettoyerPourRequete(str) {
    if (!str) return ''
    // Échapper les caractères spéciaux Lucene: + - && || ! ( ) { } [ ] ^ " ~ * ? : \ /
    return str.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, '\\$&').trim()
  }

  /**
   * Vraie recherche utilisant l'API ADEME avec stratégie multi-étapes
   * @param {Object} searchRequest
   * @param {Object} communeCoords
   * @returns {Promise<Array>}
   */
  async executerRecherche(searchRequest, communeCoords = null) {
    const { consommationEnergie, energyClass, commune, emissionGES, gesClass, surfaceHabitable, typeBien } =
      searchRequest

    // Si on a toujours pas de coordonnées pour un nom de commune, on ne peut pas faire de recherche fiable
    if (commune && !/^\d{5}$/.test(commune) && !communeCoords) {
      // Retourner un résultat vide avec un message d'erreur approprié
      return []
    }

    // Construction de la requête vers l'API ADEME
    let codePostal = null

    // If we already have coordinates, use the postal code from there
    if (communeCoords?.postalCode) {
      codePostal = communeCoords.postalCode
    } else {
      codePostal = extractPostalCode(commune)
    }

    // ÉTAPE 1: Recherche STRICTE - critères exacts
    const conditions = []

    if (/^\d{5}$/.test(commune)) {
      // Si c'est un code postal - rechercher dans les deux champs
      const sanitizedPostal = this.nettoyerPourRequete(commune)
      conditions.push(`(code_postal_ban:"${sanitizedPostal}" OR code_postal_brut:"${sanitizedPostal}")`)
    } else if (commune && communeCoords && communeCoords.isMultiCommune && communeCoords.allPostalCodes) {
      // Multi-postal commune: search in ALL postal codes
      const allPostalTerms = []
      communeCoords.allPostalCodes.forEach(postal => {
        allPostalTerms.push(`code_postal_ban:"${postal}"`)
        allPostalTerms.push(`code_postal_brut:"${postal}"`)
      })
      conditions.push(`(${allPostalTerms.join(' OR ')})`)
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
      const consoComparison = this.scoringService.parseComparisonValue(consommationEnergie)
      if (consoComparison && consoComparison.value > 0) {
        const query = this.scoringService.buildRangeQuery(consoComparison, 'conso_5_usages_par_m2_ep')
        if (query) conditions.push(query)
      }
    }

    // Handle GES emissions or class
    if (gesClass) {
      // Use native etiquette_ges field for class search
      conditions.push(`etiquette_ges:"${gesClass}"`)
    } else if (emissionGES) {
      // Parse for comparison operators
      const gesComparison = this.scoringService.parseComparisonValue(emissionGES)
      if (gesComparison && gesComparison.value > 0) {
        const query = this.scoringService.buildRangeQuery(gesComparison, 'emission_ges_5_usages_par_m2')
        if (query) conditions.push(query)
      }
    }

    // Add property type if specified
    if (typeBien) {
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
      const surfaceComparison = this.scoringService.parseComparisonValue(surfaceHabitable)
      if (surfaceComparison && surfaceComparison.value > 0) {
        if (surfaceComparison.operator === '=') {
          // For exact match, use ±1m² tolerance
          const roundedSurface = Math.round(surfaceComparison.value)
          const minSurface = roundedSurface - 1
          const maxSurface = roundedSurface + 1
          conditions.push(`surface_habitable_logement:[${minSurface} TO ${maxSurface}]`)
        } else {
          // For < or > operators, use range query
          const query = this.scoringService.buildRangeQuery(surfaceComparison, 'surface_habitable_logement')
          if (query) conditions.push(query)
        }
      }
    }

    const qsQuery = conditions.join(' AND ')

    try {
      const url = 'https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/lines'
      const params = new URLSearchParams({
        qs: qsQuery,
        size: '100',
        sort: '-date_etablissement_dpe'
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
      let processeur = null // Réutiliser l'instance du processeur

      if (data.results && data.results.length > 0) {
        // Calculer les distances d'abord si on a les coordonnées
        if (communeCoords) {
          data.results.forEach(dpe => {
            // Utiliser _geopoint qui contient les vraies coordonnées GPS
            if (dpe._geopoint) {
              const [lat, lon] = dpe._geopoint.split(',').map(parseFloat)
              const distance = calculateDistance(
                communeCoords.mairie ? communeCoords.mairie.lat : communeCoords.lat,
                communeCoords.mairie ? communeCoords.mairie.lon : communeCoords.lon,
                lat,
                lon
              )
              dpe._tempDistance = Math.round(distance * 10) / 10
            }
          })
        }

        // Map results to our format - lazy load processor une seule fois
        const { default: ProcesseurResultatsDPE } = await import('./processeur-resultats-dpe.service.js')
        processeur = new ProcesseurResultatsDPE(this.scoringService)
        results = await Promise.all(data.results.map(dpe => processeur.mapAdemeResult(dpe, searchRequest)))

        // Trier par score d'abord, puis par distance si égalité
        if (results.length > 0) {
          results.sort((a, b) => {
            const scoreDiff = b.matchScore - a.matchScore
            if (Math.abs(scoreDiff) > 5) {
              return scoreDiff
            }
            return (a.distance || 0) - (b.distance || 0)
          })
        }
      }

      if (results.length === 0) {
        // ÉTAPE 2: Recherche élargie avec geo_distance 15km et tolérance ±5%

        const isClassSearch = energyClass && !consommationEnergie

        const step2Conditions = []

        if (isClassSearch) {
          step2Conditions.push(`etiquette_dpe:"${energyClass}"`)
          if (gesClass) {
            step2Conditions.push(`etiquette_ges:"${gesClass}"`)
          }
        } else {
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
                  const distance = calculateDistance(
                    communeCoords.mairie ? communeCoords.mairie.lat : communeCoords.lat,
                    communeCoords.mairie ? communeCoords.mairie.lon : communeCoords.lon,
                    lat,
                    lon
                  )
                  dpe._tempDistance = Math.round(distance * 10) / 10
                }
              })
            }

            // Map results to our format - réutiliser ou créer le processeur
            if (!processeur) {
              const { default: ProcesseurResultatsDPE } = await import('./processeur-resultats-dpe.service.js')
              processeur = new ProcesseurResultatsDPE(this.scoringService)
            }
            results = await Promise.all(step2Data.results.map(dpe => processeur.mapAdemeResult(dpe, searchRequest)))

            if (results.length > 0) {
              // Trier par score d'abord, puis par distance si égalité
              results.sort((a, b) => {
                const scoreDiff = b.matchScore - a.matchScore
                if (Math.abs(scoreDiff) > 5) {
                  return scoreDiff
                }
                return (a.distance || 0) - (b.distance || 0)
              })
            }
          }
        }
      }

      if (results.length === 0) {
        // ÉTAPE 3: Recherche élargie avec geo_distance 30km et tolérance ±10%

        if (communeCoords) {
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
          const adjustedRadius = 30000 + (communeCoords.radius || communeCoords.coverageRadius || 0) * 1000
          const step3Params = new URLSearchParams({
            qs: step3Query,
            size: '200',
            sort: '-date_etablissement_dpe',
            geo_distance: `${communeCoords.lon}:${communeCoords.lat}:${adjustedRadius}`
          })

          const step3Response = await fetch(`${url}?${step3Params}`)
          if (step3Response.ok) {
            const step3Data = await step3Response.json()

            if (step3Data.results && step3Data.results.length > 0) {
              if (communeCoords) {
                step3Data.results.forEach(dpe => {
                  if (dpe._geopoint) {
                    const [lat, lon] = dpe._geopoint.split(',').map(parseFloat)
                    const distance = calculateDistance(
                      communeCoords.mairie ? communeCoords.mairie.lat : communeCoords.lat,
                      communeCoords.mairie ? communeCoords.mairie.lon : communeCoords.lon,
                      lat,
                      lon
                    )
                    dpe._tempDistance = Math.round(distance * 10) / 10
                    dpe._searchScope = 'regional'
                  }
                })
              }

              // Map results to our format - réutiliser ou créer le processeur
              if (!processeur) {
                const { default: ProcesseurResultatsDPE } = await import('./processeur-resultats-dpe.service.js')
                processeur = new ProcesseurResultatsDPE(this.scoringService)
              }
              results = await Promise.all(step3Data.results.map(dpe => processeur.mapAdemeResult(dpe, searchRequest)))
              if (results.length > 0) {
                results.sort((a, b) => {
                  const scoreDiff = b.matchScore - a.matchScore
                  if (Math.abs(scoreDiff) > 5) {
                    return scoreDiff
                  }
                  return (a.distance || 0) - (b.distance || 0)
                })
              }
            }
          }
        }

        // Si toujours rien, recherche fuzzy
        if (results.length === 0) {
          return await this.executerRechercheFuzzy(searchRequest, communeCoords)
        }
      }

      // Filtrer par surface - mais être moins strict si peu de résultats
      if (surfaceHabitable && results.length > 5) {
        const tolerance = surfaceHabitable * 0.25
        const filtered = results.filter(r => Math.abs(r.surfaceHabitable - surfaceHabitable) <= tolerance)

        if (filtered.length >= 3) {
          results = filtered
        }
      }

      // Pour une recherche exacte avec des résultats, ne pas trop filtrer par score
      if (results.length > 0) {
        // Deduplicate results first - réutiliser ou créer le processeur
        if (!processeur) {
          const { default: ProcesseurResultatsDPE } = await import('./processeur-resultats-dpe.service.js')
          processeur = new ProcesseurResultatsDPE(this.scoringService)
        }
        results = processeur.deduplicateResults(results)

        // S'assurer que les résultats sont triés par score décroissant
        results.sort((a, b) => b.matchScore - a.matchScore)

        // Return ALL results
        return results
      }
    } catch (_error) {
      return []
    }
  }

  /**
   * Recherche élargie si pas de résultats exacts
   */
  async executerRechercheFuzzy(searchRequest, communeCoords = null) {
    const { consommationEnergie, emissionGES, commune, typeBien, surfaceHabitable } = searchRequest

    const consoVariations = consommationEnergie
      ? [Math.round(consommationEnergie * 0.9), consommationEnergie, Math.round(consommationEnergie * 1.1)]
      : [consommationEnergie]

    const gesVariations = emissionGES
      ? [Math.round(emissionGES * 0.8), emissionGES, Math.round(emissionGES * 1.2)].filter(v => v > 0)
      : [emissionGES]

    const codePostal = communeCoords?.postalCode || extractPostalCode(commune)
    const codeDepartement = codePostal ? codePostal.substring(0, 2) : null
    const results = []

    // Lazy load processor une seule fois pour la recherche fuzzy
    const { default: ProcesseurResultatsDPE } = await import('./processeur-resultats-dpe.service.js')
    const processeur = new ProcesseurResultatsDPE(this.scoringService)

    for (const conso of consoVariations) {
      for (const ges of gesVariations) {
        const conditions = []
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
            size: '50'
          })

          const response = await fetch(`${url}?${params}`)
          const data = await response.json()

          if (data.results) {
            for (const dpe of data.results) {
              if (communeCoords && dpe._geopoint) {
                const [lat, lon] = dpe._geopoint.split(',').map(parseFloat)
                const distance = calculateDistance(
                  communeCoords.mairie ? communeCoords.mairie.lat : communeCoords.lat,
                  communeCoords.mairie ? communeCoords.mairie.lon : communeCoords.lon,
                  lat,
                  lon
                )
                dpe._tempDistance = Math.round(distance * 10) / 10
                if (distance <= 25) {
                  const result = await processeur.mapAdemeResult(dpe, searchRequest)
                  if (!results.find(r => r.numeroDPE === result.numeroDPE)) {
                    results.push(result)
                  }
                }
              } else if (!communeCoords) {
                const result = await processeur.mapAdemeResult(dpe, searchRequest)
                if (!results.find(r => r.numeroDPE === result.numeroDPE)) {
                  results.push(result)
                }
              }
            }
          }

          if (results.length >= 20) break
        } catch (_error) {}
      }
      if (results.length >= 10) break
    }

    // Filtrer par surface si spécifiée
    let filteredResults = results
    if (surfaceHabitable) {
      const tolerance = surfaceHabitable * 0.3
      filteredResults = results.filter(r => Math.abs(r.surfaceHabitable - surfaceHabitable) <= tolerance)
    }

    // Trier par distance si disponible, sinon par score
    // Deduplicate results before sorting - réutiliser le processeur
    filteredResults = processeur.deduplicateResults(filteredResults)

    filteredResults.sort((a, b) => {
      if (a.distance !== undefined && b.distance !== undefined) {
        const distDiff = a.distance - b.distance
        if (Math.abs(distDiff) > 1) {
          return distDiff
        }
      }
      return b.matchScore - a.matchScore
    })

    return filteredResults
  }

  /**
   * Extraction code postal
   */
  async extraireCodePostal(commune, communeCoords = null) {
    const postalCode = extractPostalCode(commune)
    if (postalCode) {
      return postalCode
    }
    // If coordinates already available, use them
    if (communeCoords?.postalCode) {
      return communeCoords.postalCode
    }
    // For this extracted service, we don't have access to getCommuneCoordinates
    // So we return the original commune if no postal code found
    return commune
  }
}

export default ConstructeurRechercheAdeme
