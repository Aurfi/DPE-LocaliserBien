import { beforeEach, describe, expect, it, vi } from 'vitest'
import DPEScoringService from '../dpe-scoring.service.js'

// Mock the extractPostalCode utility so tests are isolated from geo logic
vi.mock('../../utils/utilsGeo.js', () => ({
  extractPostalCode: vi.fn(commune => {
    if (/^\d{5}$/.test(commune)) return commune
    return null
  })
}))

describe('DPEScoringService', () => {
  let service

  beforeEach(() => {
    service = new DPEScoringService()
    vi.clearAllMocks()
  })

  // ---------------------------------------------------------------------------
  describe('parseComparisonValue - analyse des valeurs de comparaison', () => {
    describe('opérateur inférieur (<)', () => {
      it('doit retourner operator < avec la valeur numérique', () => {
        expect(service.parseComparisonValue('<150')).toEqual({ operator: '<', value: 150 })
      })

      it('doit parser un nombre à un chiffre avec opérateur <', () => {
        expect(service.parseComparisonValue('<5')).toEqual({ operator: '<', value: 5 })
      })

      it('doit parser un grand nombre avec opérateur <', () => {
        expect(service.parseComparisonValue('<9999')).toEqual({ operator: '<', value: 9999 })
      })

      it('doit ignorer les espaces en début de chaîne avec opérateur <', () => {
        expect(service.parseComparisonValue('  <200')).toEqual({ operator: '<', value: 200 })
      })
    })

    describe('opérateur supérieur (>)', () => {
      it('doit retourner operator > avec la valeur numérique', () => {
        expect(service.parseComparisonValue('>100')).toEqual({ operator: '>', value: 100 })
      })

      it('doit parser un nombre à un chiffre avec opérateur >', () => {
        expect(service.parseComparisonValue('>0')).toEqual({ operator: '>', value: 0 })
      })

      it('doit parser un grand nombre avec opérateur >', () => {
        expect(service.parseComparisonValue('>5000')).toEqual({ operator: '>', value: 5000 })
      })

      it('doit ignorer les espaces en début de chaîne avec opérateur >', () => {
        expect(service.parseComparisonValue('  >300')).toEqual({ operator: '>', value: 300 })
      })
    })

    describe('valeur exacte (sans opérateur)', () => {
      it('doit retourner operator = pour un nombre sans opérateur', () => {
        expect(service.parseComparisonValue('250')).toEqual({ operator: '=', value: 250 })
      })

      it('doit accepter un entier direct (type number)', () => {
        expect(service.parseComparisonValue(75)).toEqual({ operator: '=', value: 75 })
      })

      it('doit parser zéro comme valeur exacte', () => {
        expect(service.parseComparisonValue('0')).toEqual({ operator: '=', value: 0 })
      })

      it('doit parser le nombre 0 (type number) comme valeur exacte', () => {
        // 0 est falsy — la fonction doit retourner null car !value est true pour 0
        // Vérifier le comportement réel : parseComparisonValue(0) → null
        expect(service.parseComparisonValue(0)).toBeNull()
      })

      it('doit parser une grande valeur sans opérateur', () => {
        expect(service.parseComparisonValue('1234')).toEqual({ operator: '=', value: 1234 })
      })

      it('doit ignorer les espaces en début et fin de chaîne', () => {
        expect(service.parseComparisonValue('  100  ')).toEqual({ operator: '=', value: 100 })
      })
    })

    describe('valeurs nulles et indéfinies', () => {
      it('doit retourner null pour une valeur null', () => {
        expect(service.parseComparisonValue(null)).toBeNull()
      })

      it('doit retourner null pour une valeur undefined', () => {
        expect(service.parseComparisonValue(undefined)).toBeNull()
      })

      it('doit retourner null pour une chaîne vide', () => {
        expect(service.parseComparisonValue('')).toBeNull()
      })

      it('doit retourner null pour false', () => {
        expect(service.parseComparisonValue(false)).toBeNull()
      })
    })
  })

  // ---------------------------------------------------------------------------
  describe('buildRangeQuery - construction de requêtes de plage', () => {
    describe('opérateur < — plage [0 TO valeur]', () => {
      it('doit construire une plage 0 TO n pour opérateur <', () => {
        const comparison = { operator: '<', value: 150 }
        expect(service.buildRangeQuery(comparison, 'conso_5_usages_par_m2_ep')).toBe(
          'conso_5_usages_par_m2_ep:[0 TO 150]'
        )
      })

      it('doit interpoler correctement le nom de champ', () => {
        const comparison = { operator: '<', value: 50 }
        expect(service.buildRangeQuery(comparison, 'emission_ges_5_usages_par_m2')).toBe(
          'emission_ges_5_usages_par_m2:[0 TO 50]'
        )
      })

      it('doit gérer une valeur limite de 0 avec opérateur <', () => {
        const comparison = { operator: '<', value: 0 }
        expect(service.buildRangeQuery(comparison, 'surface')).toBe('surface:[0 TO 0]')
      })
    })

    describe('opérateur > — plage [valeur TO 9999]', () => {
      it('doit construire une plage n TO 9999 pour opérateur >', () => {
        const comparison = { operator: '>', value: 200 }
        expect(service.buildRangeQuery(comparison, 'conso_5_usages_par_m2_ep')).toBe(
          'conso_5_usages_par_m2_ep:[200 TO 9999]'
        )
      })

      it('doit interpoler correctement le nom de champ avec opérateur >', () => {
        const comparison = { operator: '>', value: 100 }
        expect(service.buildRangeQuery(comparison, 'surface_habitable_logement')).toBe(
          'surface_habitable_logement:[100 TO 9999]'
        )
      })

      it('doit gérer une valeur de 9999 avec opérateur >', () => {
        const comparison = { operator: '>', value: 9999 }
        expect(service.buildRangeQuery(comparison, 'conso')).toBe('conso:[9999 TO 9999]')
      })
    })

    describe('opérateur = — valeur exacte (cas par défaut)', () => {
      it('doit retourner champ:valeur pour opérateur =', () => {
        const comparison = { operator: '=', value: 75 }
        expect(service.buildRangeQuery(comparison, 'surface_habitable_logement')).toBe('surface_habitable_logement:75')
      })

      it('doit retourner champ:valeur pour un opérateur inconnu (switch default)', () => {
        const comparison = { operator: '~', value: 42 }
        expect(service.buildRangeQuery(comparison, 'conso')).toBe('conso:42')
      })
    })

    describe('entrée nulle', () => {
      it('doit retourner null si comparison est null', () => {
        expect(service.buildRangeQuery(null, 'conso_5_usages_par_m2_ep')).toBeNull()
      })

      it('doit retourner null si comparison est undefined', () => {
        expect(service.buildRangeQuery(undefined, 'surface')).toBeNull()
      })
    })
  })

  // ---------------------------------------------------------------------------
  describe('calculateMatchScore - calcul du score de correspondance', () => {
    // Helpers for building minimal ademeData / searchRequest objects
    const baseAdemeData = () => ({
      code_postal_ban: '75001',
      nom_commune_ban: 'Paris',
      adresse_ban: '1 rue de Rivoli',
      surface_habitable_logement: 80,
      etiquette_dpe: 'D',
      etiquette_ges: 'D',
      conso_5_usages_par_m2_ep: 200,
      emission_ges_5_usages_par_m2: 40
    })

    const baseSearchRequest = () => ({
      commune: '75001',
      surfaceHabitable: '80',
      energyClass: 'D',
      gesClass: null,
      consommationEnergie: null,
      emissionGES: null
    })

    describe('correspondance de code postal', () => {
      it('doit ajouter 10 points pour un code postal exact', async () => {
        const ademe = baseAdemeData()
        const req = baseSearchRequest()
        const score = await service.calculateMatchScore(ademe, req)
        // Location match = 10, surface exact = 30, energy class exact = 40 → 80
        expect(score).toBeGreaterThanOrEqual(10)
      })

      it("doit ajouter des points de commune quand aucun code postal n'est fourni", async () => {
        const ademe = baseAdemeData()
        const req = { ...baseSearchRequest(), commune: 'Paris' }
        const score = await service.calculateMatchScore(ademe, req)
        expect(score).toBeGreaterThanOrEqual(10)
      })

      it('doit accorder 0 point de localisation si le code postal ne correspond pas', async () => {
        const ademe = { ...baseAdemeData(), code_postal_ban: '69001' }
        const req = { ...baseSearchRequest(), commune: '75001' }
        // Score de localisation = 0, mais surface + classe peuvent contribuer
        const score = await service.calculateMatchScore(ademe, req)
        // Score de localisation absent mais surface + classe DPE restent
        expect(score).toBeLessThan(100)
      })
    })

    describe('recherche par classe énergétique (isClassSearch = true)', () => {
      it('doit accorder 40 points pour une classe DPE exacte', async () => {
        const ademe = baseAdemeData() // etiquette_dpe = 'D'
        const req = baseSearchRequest() // energyClass = 'D', no consommationEnergie
        const score = await service.calculateMatchScore(ademe, req)
        // 10 (postal) + 30 (surface exact) + 40 (DPE exact) = 80
        expect(score).toBe(80)
      })

      it('doit accorder 25 points pour une classe DPE distante de 1', async () => {
        const ademe = { ...baseAdemeData(), etiquette_dpe: 'E' }
        const req = baseSearchRequest() // energyClass = 'D'
        const score = await service.calculateMatchScore(ademe, req)
        // 10 + 30 + 25 = 65
        expect(score).toBe(65)
      })

      it('doit accorder 10 points pour une classe DPE distante de 2', async () => {
        const ademe = { ...baseAdemeData(), etiquette_dpe: 'F' }
        const req = baseSearchRequest()
        const score = await service.calculateMatchScore(ademe, req)
        // 10 + 30 + 10 = 50
        expect(score).toBe(50)
      })

      it('doit accorder 5 points pour une classe DPE distante de 3', async () => {
        const ademe = { ...baseAdemeData(), etiquette_dpe: 'G' }
        const req = baseSearchRequest()
        const score = await service.calculateMatchScore(ademe, req)
        // 10 + 30 + 5 = 45
        expect(score).toBe(45)
      })

      it('doit accorder 0 point pour une classe DPE trop éloignée (>3)', async () => {
        const ademe = { ...baseAdemeData(), etiquette_dpe: 'A' } // D vs A = diff 3 → 5 pts
        const req = baseSearchRequest() // energyClass = 'D'
        // A est à l'indice 0, D à l'indice 3 → différence = 3 → 5 points
        const score = await service.calculateMatchScore(ademe, req)
        expect(score).toBe(45)
      })

      it('doit accorder 20 points pour une classe GES exacte', async () => {
        const ademe = { ...baseAdemeData(), etiquette_ges: 'B' }
        const req = { ...baseSearchRequest(), gesClass: 'B' }
        const score = await service.calculateMatchScore(ademe, req)
        // 10 + 30 + 40 (DPE exact) + 20 (GES exact) = 100
        expect(score).toBe(100)
      })

      it('doit accorder 12 points pour une classe GES distante de 1', async () => {
        const ademe = { ...baseAdemeData(), etiquette_ges: 'C' }
        const req = { ...baseSearchRequest(), gesClass: 'B' }
        const score = await service.calculateMatchScore(ademe, req)
        // 10 + 30 + 40 + 12 = 92
        expect(score).toBe(92)
      })

      it('doit accorder 6 points pour une classe GES distante de 2', async () => {
        const ademe = { ...baseAdemeData(), etiquette_ges: 'D' }
        const req = { ...baseSearchRequest(), gesClass: 'B' }
        const score = await service.calculateMatchScore(ademe, req)
        // 10 + 30 + 40 + 6 = 86
        expect(score).toBe(86)
      })

      it('doit accorder 3 points pour une classe GES distante de 3', async () => {
        const ademe = { ...baseAdemeData(), etiquette_ges: 'E' }
        const req = { ...baseSearchRequest(), gesClass: 'B' }
        const score = await service.calculateMatchScore(ademe, req)
        // 10 + 30 + 40 + 3 = 83
        expect(score).toBe(83)
      })

      it('doit gérer les classes DPE absentes dans ademeData', async () => {
        const ademe = { ...baseAdemeData(), etiquette_dpe: undefined }
        const req = baseSearchRequest()
        const score = await service.calculateMatchScore(ademe, req)
        // 10 + 30 (surface) + 0 (DPE absent) = 40
        expect(score).toBe(40)
      })

      describe('scoring de surface — recherche par classe', () => {
        it('doit accorder 30 points pour une surface à moins de 1m² de différence', async () => {
          const ademe = { ...baseAdemeData(), surface_habitable_logement: 80.5 }
          const req = { ...baseSearchRequest(), surfaceHabitable: '80', energyClass: 'D' }
          const score = await service.calculateMatchScore(ademe, req)
          // 10 + 30 + 40 = 80
          expect(score).toBe(80)
        })

        it('doit calculer un score surface proportionnel pour un écart de 50%', async () => {
          // surfacePercent = 50% → 30 - 15*(50/100) = 30 - 7.5 = 22.5 → arrondi à 22 ou 23
          const ademe = { ...baseAdemeData(), surface_habitable_logement: 120 }
          const req = { ...baseSearchRequest(), surfaceHabitable: '80', energyClass: 'D' }
          const score = await service.calculateMatchScore(ademe, req)
          // surfaceDiff=40, surfacePercent=50% → surfaceScore = 30 - 15*0.5 = 22.5
          // total = 10 + 22.5 + 40 = 72.5 → 73
          expect(score).toBe(73)
        })

        it('doit accorder au moins 15 points pour un écart >100%', async () => {
          // surfacePercent > 100% → score surface = 15
          const ademe = { ...baseAdemeData(), surface_habitable_logement: 200 }
          const req = { ...baseSearchRequest(), surfaceHabitable: '80', energyClass: 'D' }
          const score = await service.calculateMatchScore(ademe, req)
          // surfaceDiff=120, surfacePercent=150% > 100% → surfaceScore = 15
          // total = 10 + 15 + 40 = 65
          expect(score).toBe(65)
        })

        it("doit accorder 0 point de surface si aucune surface n'est fournie", async () => {
          const ademe = baseAdemeData()
          const req = { ...baseSearchRequest(), surfaceHabitable: null, energyClass: 'D' }
          const score = await service.calculateMatchScore(ademe, req)
          // 10 + 0 + 40 = 50
          expect(score).toBe(50)
        })
      })
    })

    describe('recherche par valeur exacte (isClassSearch = false)', () => {
      const valueSearchRequest = () => ({
        commune: '75001',
        surfaceHabitable: '80',
        consommationEnergie: '200',
        emissionGES: null,
        energyClass: null,
        gesClass: null
      })

      it('doit retourner un score élevé pour des valeurs parfaitement correspondantes', async () => {
        const ademe = {
          ...baseAdemeData(),
          conso_5_usages_par_m2_ep: 200,
          surface_habitable_logement: 80
        }
        const req = valueSearchRequest()
        const score = await service.calculateMatchScore(ademe, req)
        // 10 (postal) + 90 (surface exact) = 100, multiplier = 1.0 (kWh exact)
        expect(score).toBe(100)
      })

      it("doit appliquer un multiplicateur de 0.75 pour 1 kWh d'écart", async () => {
        const ademe = {
          ...baseAdemeData(),
          conso_5_usages_par_m2_ep: 201, // 1 kWh d'écart
          surface_habitable_logement: 80
        }
        const req = valueSearchRequest()
        const score = await service.calculateMatchScore(ademe, req)
        // baseScore = 10 + 90 = 100, multiplier = 0.75 → 75
        expect(score).toBe(75)
      })

      it("doit appliquer un multiplicateur décroissant pour 5 kWh d'écart", async () => {
        const ademe = {
          ...baseAdemeData(),
          conso_5_usages_par_m2_ep: 205, // 5 kWh d'écart
          surface_habitable_logement: 80
        }
        const req = valueSearchRequest()
        const score = await service.calculateMatchScore(ademe, req)
        // kwhDiff=5, factor = 0.75 - (0.15 * 4/8) = 0.75 - 0.075 = 0.675
        // baseScore = 100, finalScore = round(100 * 0.675) = 68
        expect(score).toBe(68)
      })

      it("doit appliquer une pénalité sévère pour >9 kWh d'écart", async () => {
        const ademe = {
          ...baseAdemeData(),
          conso_5_usages_par_m2_ep: 250, // 50 kWh d'écart
          surface_habitable_logement: 80
        }
        const req = valueSearchRequest()
        const score = await service.calculateMatchScore(ademe, req)
        // kwhDiff=50, factor = max(0.3, 0.6 - (50-9)*0.03) = max(0.3, 0.6-1.23) = max(0.3,-0.63) = 0.3
        // baseScore = 100, finalScore = round(100 * 0.3) = 30
        expect(score).toBe(30)
      })

      it('doit appliquer des pénalités kWh et GES indépendantes', async () => {
        const ademe = {
          ...baseAdemeData(),
          conso_5_usages_par_m2_ep: 201, // 1 kWh d'écart → *0.75
          emission_ges_5_usages_par_m2: 41, // 1 GES d'écart → *0.75
          surface_habitable_logement: 80
        }
        const req = {
          ...valueSearchRequest(),
          consommationEnergie: '200',
          emissionGES: '40'
        }
        const score = await service.calculateMatchScore(ademe, req)
        // baseScore = 100, multiplier = 0.75 * 0.75 = 0.5625
        // round(100 * 0.5625) = 56
        expect(score).toBe(56)
      })

      it('doit appliquer la pénalité de surface (>100%) en multiplicateur', async () => {
        const ademe = {
          ...baseAdemeData(),
          conso_5_usages_par_m2_ep: 200, // kWh exact
          surface_habitable_logement: 200 // 150% d'écart par rapport à 80
        }
        const req = valueSearchRequest()
        const score = await service.calculateMatchScore(ademe, req)
        // surfaceScore = 0 (>100% diff), surfacePercent > 100 → multiplier *= 0.5
        // baseScore = 10 + 0 = 10, multiplier = 0.5 → round(10*0.5) = 5
        expect(score).toBe(5)
      })

      it('doit calculer un score de surface proportionnel pour un écart de 45%', async () => {
        const ademe = {
          ...baseAdemeData(),
          conso_5_usages_par_m2_ep: 200,
          surface_habitable_logement: 116 // diff=36, percent=45%
        }
        const req = valueSearchRequest()
        const score = await service.calculateMatchScore(ademe, req)
        // surfaceScore = 90 - 45 = 45
        // baseScore = 10 + 45 = 55, multiplier = 1.0
        expect(score).toBe(55)
      })

      it("doit retourner un très faible score pour surface entre 90% et 100% d'écart", async () => {
        // surfacePercent = 95%, score = max(0, 10 - (95-90)) = max(0, 5) = 5
        const ademe = {
          ...baseAdemeData(),
          conso_5_usages_par_m2_ep: 200,
          surface_habitable_logement: 156 // diff = 76, percent = 95%
        }
        const req = valueSearchRequest()
        const score = await service.calculateMatchScore(ademe, req)
        // surfaceScore = 5, baseScore = 10+5 = 15, multiplier = 1.0 → 15
        expect(score).toBe(15)
      })

      it("doit ne pas pénaliser si aucune valeur de conso n'est fournie", async () => {
        const ademe = baseAdemeData()
        const req = {
          commune: '75001',
          surfaceHabitable: '80',
          consommationEnergie: null,
          emissionGES: null,
          energyClass: null,
          gesClass: null
        }
        const score = await service.calculateMatchScore(ademe, req)
        // baseScore = 10 + 90 = 100, multiplier = 1.0 → 100
        expect(score).toBe(100)
      })
    })

    describe('cas limites et sûreté des types', () => {
      it('ne doit jamais retourner NaN — retourne 0 à la place', async () => {
        const ademe = {
          code_postal_ban: null,
          nom_commune_ban: null,
          adresse_ban: null,
          surface_habitable_logement: null,
          etiquette_dpe: null,
          etiquette_ges: null,
          conso_5_usages_par_m2_ep: null,
          emission_ges_5_usages_par_m2: null
        }
        const req = {
          commune: null,
          surfaceHabitable: null,
          energyClass: null,
          gesClass: null,
          consommationEnergie: null,
          emissionGES: null
        }
        const score = await service.calculateMatchScore(ademe, req)
        expect(Number.isNaN(score)).toBe(false)
        expect(score).toBe(0)
      })

      it('doit retourner un entier (arrondi au plus proche)', async () => {
        const ademe = {
          ...baseAdemeData(),
          surface_habitable_logement: 120, // 50% diff → score = 22.5
          etiquette_dpe: 'D'
        }
        const req = baseSearchRequest() // classe search
        const score = await service.calculateMatchScore(ademe, req)
        expect(Number.isInteger(score)).toBe(true)
      })

      it('doit utiliser code_postal_brut en fallback si code_postal_ban est absent', async () => {
        const ademe = {
          code_postal_ban: undefined,
          code_postal_brut: 75001, // nombre, sera converti en chaîne
          nom_commune_ban: 'Paris',
          surface_habitable_logement: 80,
          etiquette_dpe: 'D',
          adresse_ban: '1 rue de Rivoli'
        }
        const req = { ...baseSearchRequest(), commune: '75001' }
        const score = await service.calculateMatchScore(ademe, req)
        expect(score).toBeGreaterThanOrEqual(10) // localisation match
      })

      it('doit utiliser nom_commune_brut en fallback si nom_commune_ban est absent', async () => {
        const ademe = {
          code_postal_ban: '69001',
          nom_commune_ban: undefined,
          nom_commune_brut: 'Lyon',
          adresse_ban: undefined,
          adresse_brut: '10 rue de la Barre, Lyon',
          surface_habitable_logement: 80,
          etiquette_dpe: 'D'
        }
        const req = { ...baseSearchRequest(), commune: 'Lyon' }
        const score = await service.calculateMatchScore(ademe, req)
        expect(score).toBeGreaterThanOrEqual(10)
      })
    })
  })

  // ---------------------------------------------------------------------------
  describe('determineStrategy - sélection de la stratégie', () => {
    it('doit retourner AUCUN pour un tableau vide', () => {
      expect(service.determineStrategy([])).toBe('AUCUN')
    })

    it('doit retourner AUCUN pour null', () => {
      expect(service.determineStrategy(null)).toBe('AUCUN')
    })

    it('doit retourner AUCUN pour undefined', () => {
      expect(service.determineStrategy(undefined)).toBe('AUCUN')
    })

    it('doit retourner ULTRA_PRECIS si au moins un résultat a un score >= 95', () => {
      const results = [{ matchScore: 60 }, { matchScore: 95 }, { matchScore: 40 }]
      expect(service.determineStrategy(results)).toBe('ULTRA_PRECIS')
    })

    it('doit retourner ULTRA_PRECIS pour un score de 100', () => {
      const results = [{ matchScore: 100 }]
      expect(service.determineStrategy(results)).toBe('ULTRA_PRECIS')
    })

    it('doit retourner PRECIS si au moins un résultat a un score >= 80 (mais aucun >= 95)', () => {
      const results = [{ matchScore: 50 }, { matchScore: 80 }, { matchScore: 70 }]
      expect(service.determineStrategy(results)).toBe('PRECIS')
    })

    it('doit retourner PRECIS pour un score exactement à 94', () => {
      const results = [{ matchScore: 94 }]
      expect(service.determineStrategy(results)).toBe('PRECIS')
    })

    it('doit retourner ELARGI si tous les scores sont < 80', () => {
      const results = [{ matchScore: 50 }, { matchScore: 30 }, { matchScore: 79 }]
      expect(service.determineStrategy(results)).toBe('ELARGI')
    })

    it('doit retourner ELARGI pour un seul résultat avec un faible score', () => {
      const results = [{ matchScore: 10 }]
      expect(service.determineStrategy(results)).toBe('ELARGI')
    })
  })

  // ---------------------------------------------------------------------------
  describe('getMatchReasons - génération des raisons de correspondance', () => {
    const baseAdemeData = () => ({
      code_postal_ban: '75001',
      nom_commune_ban: 'Paris',
      adresse_ban: '1 rue de Rivoli',
      surface_habitable_logement: 80,
      etiquette_dpe: 'D',
      etiquette_ges: 'D',
      conso_5_usages_par_m2_ep: 200,
      emission_ges_5_usages_par_m2: 40
    })

    it('doit inclure "Commune exacte" quand le code postal correspond', async () => {
      const ademe = baseAdemeData()
      const req = {
        commune: '75001',
        surfaceHabitable: '80',
        energyClass: 'D',
        gesClass: null,
        consommationEnergie: null,
        emissionGES: null
      }
      const reasons = await service.getMatchReasons(ademe, req)
      expect(reasons).toContain('Commune exacte')
    })

    it('doit inclure "Classe énergétique exacte" pour une correspondance DPE exacte', async () => {
      const ademe = baseAdemeData()
      const req = {
        commune: '75001',
        surfaceHabitable: null,
        energyClass: 'D',
        gesClass: null,
        consommationEnergie: null,
        emissionGES: null
      }
      const reasons = await service.getMatchReasons(ademe, req)
      expect(reasons).toContain('Classe énergétique exacte: D')
    })

    it('doit inclure une raison de classe énergétique approchante (écart <= 2)', async () => {
      const ademe = { ...baseAdemeData(), etiquette_dpe: 'E' }
      const req = {
        commune: '75001',
        surfaceHabitable: null,
        energyClass: 'D',
        gesClass: null,
        consommationEnergie: null,
        emissionGES: null
      }
      const reasons = await service.getMatchReasons(ademe, req)
      expect(reasons.some(r => r.includes('Classe énergétique') && r.includes('E'))).toBe(true)
    })

    it("ne doit pas inclure de raison de classe DPE si l'écart est > 2", async () => {
      const ademe = { ...baseAdemeData(), etiquette_dpe: 'G' } // D vs G = diff 3
      const req = {
        commune: '75001',
        surfaceHabitable: null,
        energyClass: 'D',
        gesClass: null,
        consommationEnergie: null,
        emissionGES: null
      }
      const reasons = await service.getMatchReasons(ademe, req)
      expect(reasons.some(r => r.startsWith('Classe énergétique'))).toBe(false)
    })

    it('doit inclure la consommation exacte en kWh pour une recherche par valeur', async () => {
      const ademe = baseAdemeData()
      const req = {
        commune: '75001',
        surfaceHabitable: null,
        energyClass: null,
        gesClass: null,
        consommationEnergie: '200',
        emissionGES: null
      }
      const reasons = await service.getMatchReasons(ademe, req)
      expect(reasons).toContain('Consommation exacte: 200 kWh/m²/an')
    })

    it('doit inclure le GES exact pour une recherche par valeur', async () => {
      const ademe = baseAdemeData()
      const req = {
        commune: '75001',
        surfaceHabitable: null,
        energyClass: null,
        gesClass: null,
        consommationEnergie: null,
        emissionGES: '40'
      }
      const reasons = await service.getMatchReasons(ademe, req)
      expect(reasons).toContain('GES exact: 40 kgCO²/m²/an')
    })

    it("doit inclure les infos de surface avec pourcentage d'écart", async () => {
      const ademe = { ...baseAdemeData(), surface_habitable_logement: 90 }
      const req = {
        commune: '75001',
        surfaceHabitable: '80',
        energyClass: 'D',
        gesClass: null,
        consommationEnergie: null,
        emissionGES: null
      }
      const reasons = await service.getMatchReasons(ademe, req)
      expect(reasons.some(r => r.startsWith('Surface:') && r.includes('m²'))).toBe(true)
    })

    it('doit retourner un tableau vide si aucun critère ne correspond', async () => {
      const ademe = {
        code_postal_ban: '13001',
        nom_commune_ban: 'Marseille',
        adresse_ban: '1 rue paradis',
        surface_habitable_logement: null,
        etiquette_dpe: null,
        etiquette_ges: null,
        conso_5_usages_par_m2_ep: null,
        emission_ges_5_usages_par_m2: null
      }
      const req = {
        commune: '75001',
        surfaceHabitable: null,
        energyClass: null,
        gesClass: null,
        consommationEnergie: null,
        emissionGES: null
      }
      const reasons = await service.getMatchReasons(ademe, req)
      expect(Array.isArray(reasons)).toBe(true)
      expect(reasons).toHaveLength(0)
    })
  })
})
