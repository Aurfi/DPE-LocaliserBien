import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProcesseurResultatsDPE from '../processeur-resultats-dpe.service.js'

// ---------------------------------------------------------------------------
// Mock du service de scoring injecté dans le constructeur
// ---------------------------------------------------------------------------
const mockScoringService = {
  calculateMatchScore: vi.fn(),
  getMatchReasons: vi.fn()
}

describe('ProcesseurResultatsDPE', () => {
  let processeur

  beforeEach(() => {
    vi.clearAllMocks()
    mockScoringService.calculateMatchScore.mockResolvedValue(75)
    mockScoringService.getMatchReasons.mockResolvedValue(['Commune exacte'])
    processeur = new ProcesseurResultatsDPE(mockScoringService)
  })

  // ---------------------------------------------------------------------------
  describe('deduplicateResults - déduplication des résultats', () => {
    it('doit retourner un tableau vide pour une entrée vide', () => {
      expect(processeur.deduplicateResults([])).toEqual([])
    })

    it('doit retourner un résultat unique inchangé', () => {
      const results = [{ numeroDPE: 'DPE001', adresseComplete: '1 rue de la Paix' }]
      expect(processeur.deduplicateResults(results)).toHaveLength(1)
    })

    it('doit supprimer les doublons ayant le même numeroDPE', () => {
      const results = [
        { numeroDPE: 'DPE001', matchScore: 80 },
        { numeroDPE: 'DPE001', matchScore: 60 },
        { numeroDPE: 'DPE002', matchScore: 50 }
      ]
      const deduped = processeur.deduplicateResults(results)
      expect(deduped).toHaveLength(2)
      // Le premier occurrent est conservé
      expect(deduped[0].numeroDPE).toBe('DPE001')
      expect(deduped[0].matchScore).toBe(80)
    })

    it('doit conserver le premier exemplaire et rejeter les suivants', () => {
      const results = [
        { numeroDPE: 'DPE-X', matchScore: 90 },
        { numeroDPE: 'DPE-X', matchScore: 10 },
        { numeroDPE: 'DPE-X', matchScore: 50 }
      ]
      const deduped = processeur.deduplicateResults(results)
      expect(deduped).toHaveLength(1)
      expect(deduped[0].matchScore).toBe(90)
    })

    it('doit utiliser le champ id en fallback si numeroDPE est absent', () => {
      const results = [
        { id: 'ID-001', adresseComplete: 'Adresse A' },
        { id: 'ID-001', adresseComplete: 'Adresse B' },
        { id: 'ID-002', adresseComplete: 'Adresse C' }
      ]
      const deduped = processeur.deduplicateResults(results)
      expect(deduped).toHaveLength(2)
      expect(deduped[0].id).toBe('ID-001')
      expect(deduped[1].id).toBe('ID-002')
    })

    it('doit exclure les résultats sans numeroDPE ni id', () => {
      const results = [{ adresseComplete: 'Sans ID' }, { numeroDPE: 'DPE-1', adresseComplete: 'Avec ID' }]
      const deduped = processeur.deduplicateResults(results)
      expect(deduped).toHaveLength(1)
      expect(deduped[0].numeroDPE).toBe('DPE-1')
    })

    it('doit exclure un résultat si numeroDPE est une chaîne vide (falsy)', () => {
      const results = [
        { numeroDPE: '', id: '', adresseComplete: 'Vide' },
        { numeroDPE: 'DPE-1', adresseComplete: 'Valide' }
      ]
      const deduped = processeur.deduplicateResults(results)
      // numeroDPE = '' est falsy → exclu ; id = '' est aussi falsy → exclu
      expect(deduped).toHaveLength(1)
      expect(deduped[0].numeroDPE).toBe('DPE-1')
    })

    it('doit gérer de nombreux doublons efficacement', () => {
      const results = Array.from({ length: 100 }, (_, i) => ({
        numeroDPE: `DPE-${i % 10}`,
        matchScore: i
      }))
      const deduped = processeur.deduplicateResults(results)
      expect(deduped).toHaveLength(10)
    })

    it('doit préserver tous les champs du premier exemplaire', () => {
      const original = {
        numeroDPE: 'DPE-FULL',
        adresseComplete: '5 avenue des Tests',
        matchScore: 88,
        classeDPE: 'C',
        surfaceHabitable: 65
      }
      const results = [original, { numeroDPE: 'DPE-FULL', matchScore: 10 }]
      const deduped = processeur.deduplicateResults(results)
      expect(deduped[0]).toEqual(original)
    })
  })

  // ---------------------------------------------------------------------------
  describe('mapAdemeResult - mapping des données ADEME', () => {
    // Objet de données ADEME minimaliste complet
    const buildAdemeData = (overrides = {}) => ({
      numero_dpe: 'DPE-2024-00001',
      adresse_ban: '12 rue de la République',
      adresse_brut: '12 rue de la République',
      code_postal_ban: '13001',
      nom_commune_ban: 'Marseille',
      _geopoint: '43.2965,5.3698',
      conso_5_usages_par_m2_ep: 180,
      etiquette_dpe: 'D',
      emission_ges_5_usages_par_m2: 35,
      type_batiment: 'appartement',
      numero_etage_appartement: 2,
      nombre_niveau_logement: 1,
      surface_habitable_logement: 75,
      annee_construction: 1972,
      compl_ref_logement: 'Lot 12',
      ubat_w_par_m2_k: 0.42,
      classe_inertie_batiment: 'moyenne',
      conso_chauffage_ep: 120,
      conso_ecs_ep: 30,
      conso_refroidissement_ep: 5,
      conso_eclairage_ep: 10,
      conso_auxiliaires_ep: 15,
      description_installation_chauffage_n1: 'Chaudière gaz',
      description_installation_ecs_n1: 'Ballon électrique',
      description_systeme_ventilation: 'VMC simple flux',
      type_installation_solaire_n1: null,
      qualite_isolation_enveloppe: 'insuffisante',
      qualite_isolation_murs: 'insuffisante',
      qualite_isolation_menuiseries: 'moyenne',
      qualite_isolation_plancher_bas: 'insuffisante',
      qualite_isolation_toiture: 'bonne',
      hauteur_sous_plafond: 2.5,
      logement_traversant: 1,
      date_etablissement_dpe: '2024-03-15',
      ...overrides
    })

    const searchRequest = {
      commune: '13001',
      surfaceHabitable: '75',
      energyClass: 'D'
    }

    describe("champs d'identification et de localisation", () => {
      it('doit mapper le numero_dpe vers id et numeroDPE', async () => {
        const result = await processeur.mapAdemeResult(buildAdemeData(), searchRequest)
        expect(result.id).toBe('DPE-2024-00001')
        expect(result.numeroDPE).toBe('DPE-2024-00001')
      })

      it('doit utiliser _id en fallback si numero_dpe est absent', async () => {
        const ademe = buildAdemeData({ numero_dpe: undefined, _id: 'fallback-id' })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.id).toBe('fallback-id')
      })

      it('doit extraire le code postal de code_postal_ban', async () => {
        const result = await processeur.mapAdemeResult(buildAdemeData(), searchRequest)
        expect(result.codePostal).toBe('13001')
      })

      it('doit utiliser code_postal_brut converti en chaîne si code_postal_ban est absent', async () => {
        const ademe = buildAdemeData({ code_postal_ban: undefined, code_postal_brut: 69001 })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.codePostal).toBe('69001')
      })

      it('doit retourner une chaîne vide pour codePostal si les deux sources sont absentes', async () => {
        const ademe = buildAdemeData({ code_postal_ban: undefined, code_postal_brut: undefined })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.codePostal).toBe('')
      })

      it('doit mapper nom_commune_ban vers commune', async () => {
        const result = await processeur.mapAdemeResult(buildAdemeData(), searchRequest)
        expect(result.commune).toBe('Marseille')
      })

      it('doit utiliser nom_commune_brut en fallback pour commune', async () => {
        const ademe = buildAdemeData({ nom_commune_ban: undefined, nom_commune_brut: 'Lyon' })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.commune).toBe('Lyon')
      })

      it('doit extraire latitude et longitude depuis _geopoint', async () => {
        const result = await processeur.mapAdemeResult(buildAdemeData(), searchRequest)
        expect(result.latitude).toBeCloseTo(43.2965)
        expect(result.longitude).toBeCloseTo(5.3698)
      })

      it('doit retourner latitude et longitude null si _geopoint est absent', async () => {
        const ademe = buildAdemeData({ _geopoint: undefined })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.latitude).toBeNull()
        expect(result.longitude).toBeNull()
      })
    })

    describe("extraction de l'adresse complète", () => {
      it('doit utiliser adresse_ban directement si elle commence par un numéro', async () => {
        const ademe = buildAdemeData({ adresse_ban: '12 rue de la République' })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.adresseComplete).toBe('12 rue de la République')
      })

      it("doit combiner le numéro de adresse_brut avec adresse_ban si adresse_ban n'a pas de numéro", async () => {
        const ademe = buildAdemeData({
          adresse_ban: 'rue Victor Hugo',
          adresse_brut: '5 rue Victor Hugo'
        })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        // The address extraction combines the number from adresse_brut with adresse_ban
        expect(result.adresseComplete).toContain('5')
        expect(result.adresseComplete).toContain('rue Victor Hugo')
      })

      it('doit extraire un numéro avec suffixe bis depuis adresse_brut', async () => {
        const ademe = buildAdemeData({
          adresse_ban: 'rue du Port',
          adresse_brut: '3 bis rue du Port'
        })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.adresseComplete).toMatch(/^3\s*bis/)
      })

      it("doit utiliser adresse_ban seule si adresse_brut n'a pas de numéro", async () => {
        const ademe = buildAdemeData({
          adresse_ban: 'rue de la Liberté',
          adresse_brut: 'rue de la Liberté'
        })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.adresseComplete).toBe('rue de la Liberté')
      })

      it('doit utiliser adresse_brut si adresse_ban est absent', async () => {
        const ademe = buildAdemeData({ adresse_ban: undefined, adresse_brut: '7 allée des Pins' })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.adresseComplete).toBe('7 allée des Pins')
      })

      it('doit retourner "Adresse non disponible" si les deux adresses sont absentes', async () => {
        const ademe = buildAdemeData({ adresse_ban: undefined, adresse_brut: undefined })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.adresseComplete).toBe('Adresse non disponible')
      })
    })

    describe('champs énergétiques', () => {
      it('doit mapper conso_5_usages_par_m2_ep vers consommationEnergie', async () => {
        const result = await processeur.mapAdemeResult(buildAdemeData(), searchRequest)
        expect(result.consommationEnergie).toBe(180)
      })

      it('doit retourner 0 pour consommationEnergie si absent', async () => {
        const ademe = buildAdemeData({ conso_5_usages_par_m2_ep: undefined })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.consommationEnergie).toBe(0)
      })

      it('doit mapper etiquette_dpe vers classeDPE', async () => {
        const result = await processeur.mapAdemeResult(buildAdemeData(), searchRequest)
        expect(result.classeDPE).toBe('D')
      })

      it('doit retourner une chaîne vide pour classeDPE si absent', async () => {
        const ademe = buildAdemeData({ etiquette_dpe: undefined })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.classeDPE).toBe('')
      })

      it('doit mapper emission_ges_5_usages_par_m2 vers emissionGES', async () => {
        const result = await processeur.mapAdemeResult(buildAdemeData(), searchRequest)
        expect(result.emissionGES).toBe(35)
      })

      it('doit retourner 0 pour emissionGES si absent', async () => {
        const ademe = buildAdemeData({ emission_ges_5_usages_par_m2: undefined })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.emissionGES).toBe(0)
      })
    })

    describe('champs du bien immobilier', () => {
      it('doit mapper type_batiment vers typeBien', async () => {
        const result = await processeur.mapAdemeResult(buildAdemeData(), searchRequest)
        expect(result.typeBien).toBe('appartement')
      })

      it('doit utiliser tr002_type_batiment_description en fallback pour typeBien', async () => {
        const ademe = buildAdemeData({
          type_batiment: undefined,
          tr002_type_batiment_description: 'Maison individuelle'
        })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.typeBien).toBe('Maison individuelle')
      })

      it('doit mapper numero_etage_appartement vers etage', async () => {
        const result = await processeur.mapAdemeResult(buildAdemeData(), searchRequest)
        expect(result.etage).toBe(2)
      })

      it('doit retourner null pour etage si numero_etage_appartement est null', async () => {
        const ademe = buildAdemeData({ numero_etage_appartement: null })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.etage).toBeNull()
      })

      it('doit retourner null pour etage si numero_etage_appartement est undefined', async () => {
        const ademe = buildAdemeData({ numero_etage_appartement: undefined })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.etage).toBeNull()
      })

      it('doit conserver etage = 0 (rez-de-chaussée)', async () => {
        const ademe = buildAdemeData({ numero_etage_appartement: 0 })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        // 0 est !== undefined et !== null → étage = 0
        expect(result.etage).toBe(0)
      })

      it('doit mapper surface_habitable_logement vers surfaceHabitable', async () => {
        const result = await processeur.mapAdemeResult(buildAdemeData(), searchRequest)
        expect(result.surfaceHabitable).toBe(75)
      })

      it('doit retourner 0 pour surfaceHabitable si absent', async () => {
        const ademe = buildAdemeData({ surface_habitable_logement: undefined })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.surfaceHabitable).toBe(0)
      })

      it('doit mapper annee_construction vers anneeConstruction', async () => {
        const result = await processeur.mapAdemeResult(buildAdemeData(), searchRequest)
        expect(result.anneeConstruction).toBe(1972)
      })

      it('doit utiliser periode_construction en fallback pour anneeConstruction', async () => {
        const ademe = buildAdemeData({ annee_construction: undefined, periode_construction: '1948-1974' })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.anneeConstruction).toBe('1948-1974')
      })

      it('doit retourner null pour anneeConstruction si les deux sources sont absentes', async () => {
        const ademe = buildAdemeData({ annee_construction: undefined, periode_construction: undefined })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.anneeConstruction).toBeNull()
      })
    })

    describe('caractéristiques thermiques et isolation', () => {
      it('doit mapper ubat_w_par_m2_k vers ubat', async () => {
        const result = await processeur.mapAdemeResult(buildAdemeData(), searchRequest)
        expect(result.ubat).toBe(0.42)
      })

      it('doit retourner null pour ubat si absent', async () => {
        const ademe = buildAdemeData({ ubat_w_par_m2_k: undefined })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.ubat).toBeNull()
      })

      it('doit mapper qualite_isolation_toiture vers isolationToiture', async () => {
        const result = await processeur.mapAdemeResult(buildAdemeData(), searchRequest)
        expect(result.isolationToiture).toBe('bonne')
      })

      it('doit utiliser qualite_isolation_plancher_haut_comble_perdu en fallback pour isolationToiture', async () => {
        const ademe = buildAdemeData({
          qualite_isolation_toiture: undefined,
          qualite_isolation_plancher_haut_comble_perdu: 'insuffisante'
        })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.isolationToiture).toBe('insuffisante')
      })

      it('doit retourner "Oui" si isolation_toiture = 1 (fallback numérique)', async () => {
        const ademe = buildAdemeData({
          qualite_isolation_toiture: undefined,
          qualite_isolation_plancher_haut_comble_perdu: undefined,
          isolation_toiture: 1
        })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.isolationToiture).toBe('Oui')
      })

      it('doit retourner "Non" si isolation_toiture = 0', async () => {
        const ademe = buildAdemeData({
          qualite_isolation_toiture: undefined,
          qualite_isolation_plancher_haut_comble_perdu: undefined,
          isolation_toiture: 0
        })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.isolationToiture).toBe('Non')
      })

      it('doit retourner une chaîne vide pour isolationToiture si toutes les sources sont absentes', async () => {
        const ademe = buildAdemeData({
          qualite_isolation_toiture: undefined,
          qualite_isolation_plancher_haut_comble_perdu: undefined,
          isolation_toiture: undefined
        })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.isolationToiture).toBe('')
      })
    })

    describe('détails de consommation énergétique', () => {
      it('doit mapper tous les sous-champs de consoDetails', async () => {
        const result = await processeur.mapAdemeResult(buildAdemeData(), searchRequest)
        expect(result.consoDetails).toEqual({
          chauffage: 120,
          eauChaude: 30,
          refroidissement: 5,
          eclairage: 10,
          auxiliaires: 15
        })
      })

      it('doit retourner 0 pour les champs de consoDetails absents', async () => {
        const ademe = buildAdemeData({
          conso_chauffage_ep: undefined,
          conso_ecs_ep: undefined,
          conso_refroidissement_ep: undefined,
          conso_eclairage_ep: undefined,
          conso_auxiliaires_ep: undefined
        })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.consoDetails).toEqual({
          chauffage: 0,
          eauChaude: 0,
          refroidissement: 0,
          eclairage: 0,
          auxiliaires: 0
        })
      })
    })

    describe('systèmes et ventilation', () => {
      it('doit mapper description_installation_chauffage_n1 vers systemeChauffage', async () => {
        const result = await processeur.mapAdemeResult(buildAdemeData(), searchRequest)
        expect(result.systemeChauffage).toBe('Chaudière gaz')
      })

      it('doit mapper description_systeme_ventilation vers typeVentilation', async () => {
        const result = await processeur.mapAdemeResult(buildAdemeData(), searchRequest)
        expect(result.typeVentilation).toBe('VMC simple flux')
      })

      it('doit retourner "Après 2012" si ventilation_posterieure_2012 = 1', async () => {
        const ademe = buildAdemeData({
          description_systeme_ventilation: undefined,
          type_ventilation: undefined,
          ventilation_posterieure_2012: 1
        })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.typeVentilation).toBe('Après 2012')
      })

      it('doit retourner "Avant 2012" si ventilation_posterieure_2012 = 0', async () => {
        const ademe = buildAdemeData({
          description_systeme_ventilation: undefined,
          type_ventilation: undefined,
          ventilation_posterieure_2012: 0
        })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.typeVentilation).toBe('Avant 2012')
      })

      it('doit retourner une chaîne vide pour typeVentilation si toutes les sources sont absentes', async () => {
        const ademe = buildAdemeData({
          description_systeme_ventilation: undefined,
          type_ventilation: undefined,
          ventilation_posterieure_2012: undefined
        })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.typeVentilation).toBe('')
      })
    })

    describe('champs logement traversant', () => {
      it('doit retourner "Oui" si logement_traversant = 1', async () => {
        const result = await processeur.mapAdemeResult(buildAdemeData({ logement_traversant: 1 }), searchRequest)
        expect(result.logementTraversant).toBe('Oui')
      })

      it('doit retourner "Non" si logement_traversant = 0', async () => {
        const result = await processeur.mapAdemeResult(buildAdemeData({ logement_traversant: 0 }), searchRequest)
        expect(result.logementTraversant).toBe('Non')
      })

      it('doit retourner une chaîne vide si logement_traversant est undefined', async () => {
        const ademe = buildAdemeData({ logement_traversant: undefined })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.logementTraversant).toBe('')
      })

      it('doit retourner une chaîne vide si logement_traversant est null', async () => {
        const ademe = buildAdemeData({ logement_traversant: null })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.logementTraversant).toBe('')
      })
    })

    describe('score et raisons de correspondance', () => {
      it('doit inclure matchScore provenant du service de scoring', async () => {
        mockScoringService.calculateMatchScore.mockResolvedValue(88)
        const result = await processeur.mapAdemeResult(buildAdemeData(), searchRequest)
        expect(result.matchScore).toBe(88)
      })

      it('doit inclure matchReasons provenant du service de scoring', async () => {
        mockScoringService.getMatchReasons.mockResolvedValue(['Commune exacte', 'Classe DPE exacte: D'])
        const result = await processeur.mapAdemeResult(buildAdemeData(), searchRequest)
        expect(result.matchReasons).toEqual(['Commune exacte', 'Classe DPE exacte: D'])
      })

      it('doit appeler calculateMatchScore avec les données ADEME et la requête', async () => {
        const ademe = buildAdemeData()
        await processeur.mapAdemeResult(ademe, searchRequest)
        expect(mockScoringService.calculateMatchScore).toHaveBeenCalledOnce()
        expect(mockScoringService.calculateMatchScore).toHaveBeenCalledWith(ademe, searchRequest)
      })

      it('doit appeler getMatchReasons avec les données ADEME et la requête', async () => {
        const ademe = buildAdemeData()
        await processeur.mapAdemeResult(ademe, searchRequest)
        expect(mockScoringService.getMatchReasons).toHaveBeenCalledOnce()
        expect(mockScoringService.getMatchReasons).toHaveBeenCalledWith(ademe, searchRequest)
      })
    })

    describe('gestion de la distance et données brutes', () => {
      it('doit propager _tempDistance vers distance dans le résultat', async () => {
        const ademe = buildAdemeData({ _tempDistance: 1.5 })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.distance).toBe(1.5)
      })

      it('doit inclure distance = 0 si _tempDistance est 0', async () => {
        const ademe = buildAdemeData({ _tempDistance: 0 })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.distance).toBe(0)
      })

      it('ne doit pas inclure la propriété distance si _tempDistance est absent', async () => {
        const ademe = buildAdemeData()
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect('distance' in result).toBe(false)
      })

      it('doit conserver les données brutes dans rawData', async () => {
        const ademe = buildAdemeData()
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.rawData).toBe(ademe)
      })

      it('doit mapper dateVisite depuis date_etablissement_dpe', async () => {
        const result = await processeur.mapAdemeResult(buildAdemeData(), searchRequest)
        expect(result.dateVisite).toBe('2024-03-15')
      })
    })

    describe('champs manquants et valeurs nulles', () => {
      it('doit retourner null pour hauteurSousPlafond si absent', async () => {
        const ademe = buildAdemeData({ hauteur_sous_plafond: undefined })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.hauteurSousPlafond).toBeNull()
      })

      it('doit retourner null pour nombreNiveaux si absent', async () => {
        const ademe = buildAdemeData({ nombre_niveau_logement: undefined })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.nombreNiveaux).toBeNull()
      })

      it('doit retourner une chaîne vide pour classeInertie si absent', async () => {
        const ademe = buildAdemeData({ classe_inertie_batiment: undefined })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.classeInertie).toBe('')
      })

      it('doit retourner une chaîne vide pour complementRefLogement si absent', async () => {
        const ademe = buildAdemeData({ compl_ref_logement: undefined, complement_adresse_logement: undefined })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.complementRefLogement).toBe('')
      })

      it('doit retourner une chaîne vide pour installationSolaire si absent', async () => {
        const ademe = buildAdemeData({ type_installation_solaire_n1: undefined })
        const result = await processeur.mapAdemeResult(ademe, searchRequest)
        expect(result.installationSolaire).toBe('')
      })

      it('doit produire un objet résultat avec toutes les clés attendues', async () => {
        const result = await processeur.mapAdemeResult(buildAdemeData(), searchRequest)
        const expectedKeys = [
          'adresseComplete',
          'codePostal',
          'commune',
          'latitude',
          'longitude',
          'consommationEnergie',
          'classeDPE',
          'emissionGES',
          'typeBien',
          'etage',
          'nombreNiveaux',
          'surfaceHabitable',
          'anneeConstruction',
          'complementRefLogement',
          'ubat',
          'classeInertie',
          'consoDetails',
          'systemeChauffage',
          'systemeECS',
          'typeVentilation',
          'installationSolaire',
          'isolationEnveloppe',
          'isolationMurs',
          'isolationMenuiseries',
          'isolationPlancherBas',
          'isolationToiture',
          'hauteurSousPlafond',
          'logementTraversant',
          'matchScore',
          'matchReasons',
          'id',
          'numeroDPE',
          'dateVisite',
          'rawData'
        ]
        for (const key of expectedKeys) {
          expect(result, `La clé "${key}" devrait être présente`).toHaveProperty(key)
        }
      })
    })
  })
})
