/**
 * Service dédié au traitement et formatage des résultats DPE
 * Extrait de dpe-search.service.js pour améliorer les performances par chargement paresseux
 */

class ProcesseurResultatsDPE {
  constructor(scoringService) {
    this.scoringService = scoringService
  }

  /**
   * Supprime les doublons basés sur numero_dpe
   * @param {Array} results - Tableau des résultats
   * @returns {Array} Tableau des résultats uniques
   */
  deduplicateResults(results) {
    const seen = new Set()
    return results.filter(result => {
      const id = result.numeroDPE || result.id
      if (!id || seen.has(id)) {
        return false
      }
      seen.add(id)
      return true
    })
  }

  /**
   * Mapper résultat ADEME vers notre format
   * @param {Object} ademeData - Données brutes de l'API ADEME
   * @param {Object} searchRequest - Critères de recherche de l'utilisateur
   * @returns {Promise<Object>} Objet résultat standardisé
   */
  async mapAdemeResult(ademeData, searchRequest) {
    // Passer la distance temporaire pour le calcul du score
    if (ademeData._tempDistance !== undefined) {
      ademeData._distance = ademeData._tempDistance
    }

    // Passer le scope de recherche pour le calcul du score
    if (ademeData._searchScope) {
      // Keep the search scope for score calculation
    }

    const matchScore = await this.scoringService.calculateMatchScore(ademeData, searchRequest)
    const matchReasons = await this.scoringService.getMatchReasons(ademeData, searchRequest)

    // Extraire les vraies coordonnées GPS depuis _geopoint
    let latitude = null,
      longitude = null
    if (ademeData._geopoint) {
      ;[latitude, longitude] = ademeData._geopoint.split(',').map(parseFloat)
    }

    const result = {
      // Utiliser adresse_ban d'abord, mais ajouter le numéro de rue depuis adresse_brut si manquant
      adresseComplete: (() => {
        // Si adresse_ban a déjà un numéro, l'utiliser tel quel
        if (ademeData.adresse_ban && /^\d/.test(ademeData.adresse_ban.trim())) {
          return ademeData.adresse_ban
        }

        // Si adresse_ban n'a pas de numéro mais adresse_brut en a un, les combiner
        if (ademeData.adresse_ban && ademeData.adresse_brut && /^\d+/.test(ademeData.adresse_brut.trim())) {
          const streetNumber = ademeData.adresse_brut.match(/^\d+(?:\s*(?:bis|ter|quater|[a-z])?)?/i)[0].trim()
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

      // Caractéristiques thermiques
      ubat: ademeData.ubat_w_par_m2_k || null,
      classeInertie: ademeData.classe_inertie_batiment || '',

      // Données énergétiques détaillées
      consoDetails: {
        chauffage: ademeData.conso_chauffage_ep || 0,
        eauChaude: ademeData.conso_ecs_ep || 0,
        refroidissement: ademeData.conso_refroidissement_ep || 0,
        eclairage: ademeData.conso_eclairage_ep || 0,
        auxiliaires: ademeData.conso_auxiliaires_ep || 0
      },

      // Détails des systèmes
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

      // Qualité de l'isolation - conserver les valeurs brutes d'ADEME
      isolationEnveloppe: ademeData.qualite_isolation_enveloppe || '',
      isolationMurs: ademeData.qualite_isolation_murs || '',
      isolationMenuiseries: ademeData.qualite_isolation_menuiseries || '',
      isolationPlancherBas: ademeData.qualite_isolation_plancher_bas || '',
      isolationToiture:
        ademeData.qualite_isolation_toiture ||
        ademeData.qualite_isolation_plancher_haut_comble_perdu ||
        (ademeData.isolation_toiture === 1 ? 'Oui' : ademeData.isolation_toiture === 0 ? 'Non' : ''),

      // Données utiles supplémentaires
      hauteurSousPlafond: ademeData.hauteur_sous_plafond || null,
      logementTraversant:
        ademeData.logement_traversant === 1 ? 'Oui' : ademeData.logement_traversant === 0 ? 'Non' : '',

      matchScore,
      matchReasons,

      id: ademeData.numero_dpe || ademeData._id || '',
      numeroDPE: ademeData.numero_dpe || '',
      dateVisite: ademeData.date_etablissement_dpe,

      // Conserver toutes les données brutes pour le modal
      rawData: ademeData
    }

    // Ajouter la distance si elle existe
    if (ademeData._distance !== undefined) {
      result.distance = ademeData._distance
    }

    return result
  }
}

export default ProcesseurResultatsDPE