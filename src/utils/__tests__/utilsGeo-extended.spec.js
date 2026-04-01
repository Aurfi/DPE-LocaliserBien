/**
 * Tests étendus pour utilsGeo.js
 * Couvre les fonctions non testées dans geoUtils.spec.js :
 *   - getDepartmentFromPostalCode
 *   - geocodeAddress
 *   - getCommuneCoordinatesFromDatabase
 *   - getCommuneCoordinatesFromLocal
 *   - getCommuneCoordinates
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  geocodeAddress,
  getCommuneCoordinates,
  getCommuneCoordinatesFromDatabase,
  getCommuneCoordinatesFromLocal,
  getDepartmentFromPostalCode
} from '../utilsGeo.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal GeoJSON feature response as returned by data.geopf.fr
 */
function makeGeoApiResponse({ label, postcode, city, lat, lon }) {
  return {
    features: [
      {
        geometry: { coordinates: [lon, lat] },
        properties: { label, postcode, city }
      }
    ]
  }
}

/**
 * Build a mock `loadDepartmentFn` that resolves with the provided department
 * data object, or null when `deptData` is null / undefined.
 */
function makeLoadDeptFn(deptData) {
  return vi.fn().mockResolvedValue(deptData ?? null)
}

// ---------------------------------------------------------------------------
// Shared department data fixtures
// ---------------------------------------------------------------------------

const SINGLE_COMMUNE_DEPT = {
  postalCodes: {
    13100: {
      communeCount: 1,
      communes: ['Aix-en-Provence'],
      center: [5.4474, 43.5297],
      coverageRadius: 0
    }
  },
  communes: [
    {
      nom: 'Aix-en-Provence',
      centre: { coordinates: [5.4474, 43.5297] },
      mairie: { coordinates: [5.4441, 43.5267] },
      radius: 12000,
      codesPostaux: ['13100']
    }
  ]
}

const MULTI_COMMUNE_DEPT = {
  postalCodes: {
    75001: {
      communeCount: 3,
      communes: ['Paris 1er', 'Paris 2e', 'Paris 3e'],
      center: [2.3522, 48.8566],
      coverageRadius: 5000
    }
  },
  communes: [
    {
      nom: 'Paris 1er',
      centre: { coordinates: [2.3522, 48.8566] },
      mairie: { coordinates: [2.3471, 48.8601] },
      radius: 2000,
      codesPostaux: ['75001']
    }
  ]
}

const MULTI_POSTAL_COMMUNE_DEPT = {
  postalCodes: {
    13100: {
      communeCount: 1,
      communes: ['Aix-en-Provence'],
      center: [5.4474, 43.5297],
      coverageRadius: 0
    }
  },
  communes: [
    {
      nom: 'Aix-en-Provence',
      centre: { coordinates: [5.4474, 43.5297] },
      mairie: { coordinates: [5.4441, 43.5267] },
      radius: 12000,
      // Commune with multiple postal codes
      codesPostaux: ['13100', '13540', '13590']
    }
  ]
}

// ---------------------------------------------------------------------------
// getDepartmentFromPostalCode
// ---------------------------------------------------------------------------

describe('getDepartmentFromPostalCode', () => {
  describe('départements métropolitains standards (01–19, 21–95)', () => {
    it('devrait retourner "01" pour le code postal 01000', () => {
      expect(getDepartmentFromPostalCode('01000')).toBe('01')
    })

    it('devrait retourner "13" pour le code postal 13100 (Aix-en-Provence)', () => {
      expect(getDepartmentFromPostalCode('13100')).toBe('13')
    })

    it('devrait retourner "75" pour le code postal 75001 (Paris)', () => {
      expect(getDepartmentFromPostalCode('75001')).toBe('75')
    })

    it('devrait retourner "95" pour le code postal 95000 (Cergy)', () => {
      expect(getDepartmentFromPostalCode('95000')).toBe('95')
    })

    it('devrait retourner "33" pour le code postal 33000 (Bordeaux)', () => {
      expect(getDepartmentFromPostalCode('33000')).toBe('33')
    })

    it('devrait retourner "69" pour le code postal 69001 (Lyon)', () => {
      expect(getDepartmentFromPostalCode('69001')).toBe('69')
    })
  })

  describe('Corse (codes postaux commençant par 20)', () => {
    it('devrait retourner "2A" pour 20000 (limite inférieure Corse-du-Sud)', () => {
      expect(getDepartmentFromPostalCode('20000')).toBe('2A')
    })

    it('devrait retourner "2A" pour 20199 (limite supérieure Corse-du-Sud)', () => {
      expect(getDepartmentFromPostalCode('20199')).toBe('2A')
    })

    it('devrait retourner "2B" pour 20200 (limite inférieure Haute-Corse)', () => {
      expect(getDepartmentFromPostalCode('20200')).toBe('2B')
    })

    it('devrait retourner "2B" pour 20600 (Bastia, Haute-Corse)', () => {
      expect(getDepartmentFromPostalCode('20600')).toBe('2B')
    })

    it('devrait retourner "2B" pour 20999 (limite supérieure Haute-Corse)', () => {
      expect(getDepartmentFromPostalCode('20999')).toBe('2B')
    })

    it('devrait retourner "2A" pour 20100 (Sartène, milieu de Corse-du-Sud)', () => {
      expect(getDepartmentFromPostalCode('20100')).toBe('2A')
    })
  })

  describe('DOM-TOM — codes département à 3 chiffres', () => {
    it('retourne "971" pour 97100 (Guadeloupe)', () => {
      expect(getDepartmentFromPostalCode('97100')).toBe('971')
    })

    it('retourne "972" pour 97200 (Martinique)', () => {
      expect(getDepartmentFromPostalCode('97200')).toBe('972')
    })

    it('retourne "973" pour 97300 (Guyane)', () => {
      expect(getDepartmentFromPostalCode('97300')).toBe('973')
    })

    it('retourne "974" pour 97400 (La Réunion)', () => {
      expect(getDepartmentFromPostalCode('97400')).toBe('974')
    })

    it('retourne "976" pour 97600 (Mayotte)', () => {
      expect(getDepartmentFromPostalCode('97600')).toBe('976')
    })
  })

  describe('entrées invalides', () => {
    it('devrait retourner null pour une chaîne vide', () => {
      expect(getDepartmentFromPostalCode('')).toBeNull()
    })

    it('devrait retourner null pour null', () => {
      expect(getDepartmentFromPostalCode(null)).toBeNull()
    })

    it('devrait retourner null pour undefined', () => {
      expect(getDepartmentFromPostalCode(undefined)).toBeNull()
    })

    it('devrait retourner null pour un code à 4 chiffres (trop court)', () => {
      expect(getDepartmentFromPostalCode('1234')).toBeNull()
    })

    it('devrait retourner null pour un code à 6 chiffres (trop long)', () => {
      expect(getDepartmentFromPostalCode('123456')).toBeNull()
    })

    it('devrait retourner null pour un code alphanumérique non-postal', () => {
      expect(getDepartmentFromPostalCode('abcde')).toBeNull()
    })

    it('devrait retourner null pour une chaîne avec espaces', () => {
      expect(getDepartmentFromPostalCode('750 01')).toBeNull()
    })

    it("devrait throw pour un nombre entier (pas une chaîne) car .startsWith() n'existe pas sur Number", () => {
      expect(() => getDepartmentFromPostalCode(75001)).toThrow()
    })
  })
})

// ---------------------------------------------------------------------------
// geocodeAddress
// ---------------------------------------------------------------------------

describe('geocodeAddress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('géocodage réussi — format de base', () => {
    it('devrait retourner les coordonnées et les métadonnées pour une adresse valide', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve(
            makeGeoApiResponse({
              label: '1 Place de la Concorde, 75008 Paris',
              postcode: '75008',
              city: 'Paris',
              lat: 48.8656,
              lon: 2.3212
            })
          )
      })

      const result = await geocodeAddress('1 Place de la Concorde, Paris')

      expect(result).not.toBeNull()
      expect(result.lat).toBeCloseTo(48.8656, 4)
      expect(result.lon).toBeCloseTo(2.3212, 4)
      expect(result.postalCode).toBe('75008')
      expect(result.city).toBe('Paris')
      expect(result.formattedAddress).toBe('1 Place de la Concorde, 75008 Paris')
    })

    it('devrait construire la bonne URL avec encodeURIComponent', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve(
            makeGeoApiResponse({
              label: 'Aix-en-Provence',
              postcode: '13100',
              city: 'Aix-en-Provence',
              lat: 43.5297,
              lon: 5.4474
            })
          )
      })

      await geocodeAddress('Aix-en-Provence')

      const calledUrl = global.fetch.mock.calls[0][0]
      expect(calledUrl).toContain('data.geopf.fr/geocodage/search')
      expect(calledUrl).toContain(encodeURIComponent('Aix-en-Provence'))
      expect(calledUrl).toContain('limit=1')
    })

    it('devrait utiliser city comme repli quand la propriété city est absente', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            features: [
              {
                geometry: { coordinates: [2.3522, 48.8566] },
                properties: {
                  label: 'Paris',
                  postcode: '75000',
                  city: undefined,
                  name: 'Paris'
                }
              }
            ]
          })
      })

      const result = await geocodeAddress('Paris')

      expect(result).not.toBeNull()
      expect(result.city).toBe('Paris') // doit utiliser properties.name comme repli
    })
  })

  describe('géocodage réussi — format étendu (extendedFormat: true)', () => {
    it('devrait inclure les champs centre, mairie, radius, coverageRadius, isMultiCommune', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve(
            makeGeoApiResponse({
              label: 'Marseille',
              postcode: '13001',
              city: 'Marseille',
              lat: 43.2965,
              lon: 5.3698
            })
          )
      })

      const result = await geocodeAddress('Marseille', { extendedFormat: true })

      expect(result).not.toBeNull()
      expect(result.centre).toEqual({ lat: 43.2965, lon: 5.3698 })
      expect(result.mairie).toEqual({ lat: 43.2965, lon: 5.3698 })
      expect(result.radius).toBe(0)
      expect(result.coverageRadius).toBe(0)
      expect(result.isMultiCommune).toBe(false)
      // Champs de base toujours présents
      expect(result.lat).toBe(43.2965)
      expect(result.lon).toBe(5.3698)
    })
  })

  describe('aucun résultat trouvé', () => {
    it('devrait retourner null quand le tableau features est vide (throwOnError: false)', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ features: [] })
      })

      const result = await geocodeAddress('AdresseInexistante12345')

      expect(result).toBeNull()
    })

    it('devrait retourner null quand features est absent de la réponse', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      })

      const result = await geocodeAddress('AdresseInexistante12345')

      expect(result).toBeNull()
    })

    it('devrait lever une erreur sur aucun résultat quand throwOnError est true', async () => {
      const emptyResponse = { ok: true, json: () => Promise.resolve({ features: [] }) }
      global.fetch = vi.fn().mockResolvedValue(emptyResponse)

      await expect(geocodeAddress('AdresseInexistante12345', { throwOnError: true })).rejects.toThrow(
        'Aucune adresse trouvée'
      )
    })
  })

  describe('erreurs HTTP', () => {
    it('devrait retourner null pour une réponse 400 (throwOnError: false)', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400
      })

      const result = await geocodeAddress('adresse invalide')

      expect(result).toBeNull()
    })

    it('devrait lever une erreur pour une réponse 400 quand throwOnError est true', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400 })

      await expect(geocodeAddress('adresse invalide', { throwOnError: true })).rejects.toThrow(
        'Impossible de localiser'
      )
    })

    it('devrait réessayer puis retourner null pour une réponse 503 (service indisponible)', async () => {
      // Deux tentatives → deux réponses 503
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce({ ok: false, status: 503 })

      // Remplacer setTimeout pour éviter les délais réels en test
      vi.useFakeTimers()

      const promise = geocodeAddress('adresse test')
      // Avancer tous les timers pour passer les délais de retry
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result).toBeNull()
      vi.useRealTimers()
    })

    it('devrait réessayer puis retourner null pour une réponse 504 (timeout gateway)', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 504 })
        .mockResolvedValueOnce({ ok: false, status: 504 })

      vi.useFakeTimers()

      const promise = geocodeAddress('adresse test')
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result).toBeNull()
      vi.useRealTimers()
    })
  })

  describe('gestion des erreurs réseau et timeout', () => {
    it('devrait retourner null quand fetch lève une exception réseau', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      vi.useFakeTimers()
      const promise = geocodeAddress('adresse test')
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result).toBeNull()
      vi.useRealTimers()
    })

    it('devrait retourner null lors dun AbortError (timeout 8s)', async () => {
      const abortError = new DOMException('The operation was aborted.', 'AbortError')
      global.fetch = vi.fn().mockRejectedValue(abortError)

      vi.useFakeTimers()
      const promise = geocodeAddress('adresse test')
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result).toBeNull()
      vi.useRealTimers()
    })

    it("devrait lever l'erreur AbortError quand throwOnError est true et toutes les tentatives échouent", async () => {
      const abortError = new DOMException('The operation was aborted.', 'AbortError')
      global.fetch = vi.fn().mockRejectedValue(abortError)

      vi.useFakeTimers()
      const promise = geocodeAddress('adresse test', { throwOnError: true })
      await vi.runAllTimersAsync()

      await expect(promise).rejects.toThrow()
      vi.useRealTimers()
    })
  })
})

// ---------------------------------------------------------------------------
// getCommuneCoordinatesFromDatabase
// ---------------------------------------------------------------------------

describe('getCommuneCoordinatesFromDatabase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('code postal valide — commune unique', () => {
    it('devrait retourner les coordonnées précises pour une commune unique', async () => {
      const loadDept = makeLoadDeptFn(SINGLE_COMMUNE_DEPT)

      const result = await getCommuneCoordinatesFromDatabase('13100', loadDept)

      expect(result).not.toBeNull()
      expect(result.lat).toBeCloseTo(43.5297, 4)
      expect(result.lon).toBeCloseTo(5.4474, 4)
      expect(result.centre).toEqual({ lat: 43.5297, lon: 5.4474 })
      expect(result.mairie).toEqual({ lat: 43.5267, lon: 5.4441 })
      expect(result.radius).toBe(12000)
      expect(result.isMultiCommune).toBe(false)
      // Doit charger le département 13
      expect(loadDept).toHaveBeenCalledWith('13')
    })
  })

  describe('code postal valide — communes multiples partagent le même code postal', () => {
    it('devrait retourner isMultiCommune: true avec le centre agrégé', async () => {
      const loadDept = makeLoadDeptFn(MULTI_COMMUNE_DEPT)

      const result = await getCommuneCoordinatesFromDatabase('75001', loadDept)

      expect(result).not.toBeNull()
      expect(result.isMultiCommune).toBe(true)
      expect(result.communeCount).toBe(3)
      expect(result.communes).toEqual(['Paris 1er', 'Paris 2e', 'Paris 3e'])
      expect(result.coverageRadius).toBe(5000)
      expect(result.lat).toBeCloseTo(48.8566, 4)
      expect(result.lon).toBeCloseTo(2.3522, 4)
    })
  })

  describe('données de département absentes ou incomplètes', () => {
    it('devrait retourner null quand loadDepartmentFn retourne null', async () => {
      const loadDept = makeLoadDeptFn(null)

      const result = await getCommuneCoordinatesFromDatabase('13100', loadDept)

      expect(result).toBeNull()
    })

    it('devrait retourner null quand le code postal est absent dans les données du département', async () => {
      const loadDept = makeLoadDeptFn({
        postalCodes: {},
        communes: []
      })

      const result = await getCommuneCoordinatesFromDatabase('13100', loadDept)

      expect(result).toBeNull()
    })

    it('devrait retourner null quand la commune unique nest pas trouvée dans le tableau communes', async () => {
      const loadDept = makeLoadDeptFn({
        postalCodes: {
          13100: {
            communeCount: 1,
            communes: ['Commune Inconnue'],
            center: [5.4474, 43.5297],
            coverageRadius: 0
          }
        },
        communes: [] // tableau communes vide : la commune ne sera pas trouvée
      })

      const result = await getCommuneCoordinatesFromDatabase('13100', loadDept)

      expect(result).toBeNull()
    })
  })

  describe('entrées invalides et cas limites', () => {
    it('devrait retourner null pour une entrée null', async () => {
      const loadDept = makeLoadDeptFn(SINGLE_COMMUNE_DEPT)

      const result = await getCommuneCoordinatesFromDatabase(null, loadDept)

      expect(result).toBeNull()
      expect(loadDept).not.toHaveBeenCalled()
    })

    it('devrait retourner null pour une chaîne vide', async () => {
      const loadDept = makeLoadDeptFn(SINGLE_COMMUNE_DEPT)

      const result = await getCommuneCoordinatesFromDatabase('', loadDept)

      expect(result).toBeNull()
    })

    it('devrait retourner null pour un nom de commune (pas un code postal à 5 chiffres)', async () => {
      const loadDept = makeLoadDeptFn(SINGLE_COMMUNE_DEPT)

      const result = await getCommuneCoordinatesFromDatabase('Paris', loadDept)

      // Les noms de communes sont gérés dans le wrapper getCommuneCoordinates
      expect(result).toBeNull()
    })

    it('devrait retourner null quand loadDepartmentFn lève une exception', async () => {
      const loadDept = vi.fn().mockRejectedValue(new Error('Erreur de chargement du fichier'))

      const result = await getCommuneCoordinatesFromDatabase('13100', loadDept)

      expect(result).toBeNull()
    })

    it('devrait retourner null pour un code postal malformé (4 chiffres)', async () => {
      const loadDept = makeLoadDeptFn(SINGLE_COMMUNE_DEPT)

      const result = await getCommuneCoordinatesFromDatabase('1310', loadDept)

      expect(result).toBeNull()
    })
  })
})

// ---------------------------------------------------------------------------
// getCommuneCoordinatesFromLocal
// ---------------------------------------------------------------------------

describe('getCommuneCoordinatesFromLocal', () => {
  const communes = [
    {
      nom: 'Aix-en-Provence',
      codesPostaux: ['13100', '13290'],
      centre: { coordinates: [5.4474, 43.5297] }
    },
    {
      nom: 'Marseille',
      codesPostaux: ['13001', '13002', '13003'],
      centre: { coordinates: [5.3698, 43.2965] }
    },
    {
      nom: 'Lyon',
      codesPostaux: ['69001'],
      centre: { coordinates: [4.8357, 45.764] }
    }
  ]

  describe('recherche par code postal', () => {
    it('devrait trouver une commune par son code postal principal', () => {
      const result = getCommuneCoordinatesFromLocal('13100', communes)

      expect(result).not.toBeNull()
      expect(result.lat).toBeCloseTo(43.5297, 4)
      expect(result.lon).toBeCloseTo(5.4474, 4)
    })

    it('devrait trouver une commune par un code postal secondaire', () => {
      const result = getCommuneCoordinatesFromLocal('13290', communes)

      expect(result).not.toBeNull()
      expect(result.lat).toBeCloseTo(43.5297, 4)
    })

    it('devrait retourner null pour un code postal inexistant', () => {
      const result = getCommuneCoordinatesFromLocal('99999', communes)

      expect(result).toBeNull()
    })
  })

  describe('recherche par nom de commune', () => {
    it('devrait trouver une commune par son nom exact (insensible à la casse)', () => {
      const result = getCommuneCoordinatesFromLocal('marseille', communes)

      expect(result).not.toBeNull()
      expect(result.lat).toBeCloseTo(43.2965, 4)
      expect(result.lon).toBeCloseTo(5.3698, 4)
    })

    it('devrait trouver une commune avec nom en majuscules', () => {
      const result = getCommuneCoordinatesFromLocal('LYON', communes)

      expect(result).not.toBeNull()
      expect(result.lat).toBeCloseTo(45.764, 4)
    })

    it('devrait ignorer les espaces en début et fin de chaîne', () => {
      const result = getCommuneCoordinatesFromLocal('  Lyon  ', communes)

      expect(result).not.toBeNull()
      expect(result.lat).toBeCloseTo(45.764, 4)
    })

    it('devrait retourner null pour un nom de commune inexistant', () => {
      const result = getCommuneCoordinatesFromLocal('VilleInexistante', communes)

      expect(result).toBeNull()
    })
  })

  describe('entrées invalides', () => {
    it('devrait retourner null pour une entrée null', () => {
      expect(getCommuneCoordinatesFromLocal(null, communes)).toBeNull()
    })

    it('devrait retourner null pour une entrée undefined', () => {
      expect(getCommuneCoordinatesFromLocal(undefined, communes)).toBeNull()
    })

    it('devrait retourner null quand le tableau de communes est null', () => {
      expect(getCommuneCoordinatesFromLocal('13100', null)).toBeNull()
    })

    it('devrait retourner null quand le tableau de communes est vide', () => {
      expect(getCommuneCoordinatesFromLocal('13100', [])).toBeNull()
    })

    it('devrait retourner null quand le tableau de communes est undefined', () => {
      expect(getCommuneCoordinatesFromLocal('13100', undefined)).toBeNull()
    })

    it('devrait retourner null pour une commune sans propriété centre', () => {
      const communesSansCentre = [
        {
          nom: 'Commune Sans Centre',
          codesPostaux: ['12345']
          // centre absent volontairement
        }
      ]

      expect(getCommuneCoordinatesFromLocal('12345', communesSansCentre)).toBeNull()
    })
  })
})

// ---------------------------------------------------------------------------
// getCommuneCoordinates (wrapper principal)
// ---------------------------------------------------------------------------

describe('getCommuneCoordinates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('code postal — recherche directe en base', () => {
    it('devrait retourner les coordonnées directement depuis la base pour un code postal valide', async () => {
      const loadDept = makeLoadDeptFn(SINGLE_COMMUNE_DEPT)

      const result = await getCommuneCoordinates('13100', loadDept)

      expect(result).not.toBeNull()
      expect(result.lat).toBeCloseTo(43.5297, 4)
      expect(result.lon).toBeCloseTo(5.4474, 4)
      // Ne doit PAS appeler l'API de géocodage
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('devrait retourner null quand les données de département sont absentes', async () => {
      const loadDept = makeLoadDeptFn(null)

      const result = await getCommuneCoordinates('13100', loadDept)

      expect(result).toBeNull()
    })
  })

  describe("nom de commune — appel à l'API de géocodage puis lookup en base", () => {
    it('devrait géocoder puis récupérer les données depuis la base pour une commune à code postal unique', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve(
            makeGeoApiResponse({
              label: 'Aix-en-Provence',
              postcode: '13100',
              city: 'Aix-en-Provence',
              lat: 43.5297,
              lon: 5.4474
            })
          )
      })

      const loadDept = makeLoadDeptFn(SINGLE_COMMUNE_DEPT)

      const result = await getCommuneCoordinates('Aix-en-Provence', loadDept)

      expect(result).not.toBeNull()
      expect(result.postalCode).toBe('13100')
      expect(global.fetch).toHaveBeenCalledTimes(1)
      const calledUrl = global.fetch.mock.calls[0][0]
      expect(calledUrl).toContain('Aix-en-Provence')
    })

    it('devrait retourner isMultiCommune: true pour une commune avec plusieurs codes postaux', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve(
            makeGeoApiResponse({
              label: 'Aix-en-Provence',
              postcode: '13100',
              city: 'Aix-en-Provence',
              lat: 43.5297,
              lon: 5.4474
            })
          )
      })

      const loadDept = makeLoadDeptFn(MULTI_POSTAL_COMMUNE_DEPT)

      const result = await getCommuneCoordinates('Aix-en-Provence', loadDept)

      expect(result).not.toBeNull()
      expect(result.isMultiCommune).toBe(true)
      expect(result.allPostalCodes).toEqual(['13100', '13540', '13590'])
      expect(result.communeName).toBe('Aix-en-Provence')
      expect(result.postalCode).toBe('13100')
    })

    it("devrait utiliser le résultat de l'API comme repli quand la base de données ne trouve pas la commune", async () => {
      // Premier appel : géocodage de "Commune Inconnue"
      // Deuxième appel : repli extendedFormat si la base renvoie null
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve(
              makeGeoApiResponse({
                label: 'Commune Inconnue',
                postcode: '99001',
                city: 'Commune Inconnue',
                lat: 45.0,
                lon: 3.0
              })
            )
        })
        // Deuxième appel pour le repli extendedFormat
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve(
              makeGeoApiResponse({
                label: 'Commune Inconnue',
                postcode: '99001',
                city: 'Commune Inconnue',
                lat: 45.0,
                lon: 3.0
              })
            )
        })

      // Retourner un département sans le code postal recherché
      const loadDept = makeLoadDeptFn({
        postalCodes: {},
        communes: []
      })

      const result = await getCommuneCoordinates('Commune Inconnue', loadDept)

      // Doit retourner le résultat de l'API (format étendu)
      expect(result).not.toBeNull()
      expect(result.lat).toBe(45.0)
      expect(result.lon).toBe(3.0)
    })

    it("devrait retourner null quand l'API de géocodage ne trouve aucun résultat", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ features: [] })
      })
      // Second appel pour le repli extendedFormat — également vide
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ features: [] })
      })

      const loadDept = makeLoadDeptFn(SINGLE_COMMUNE_DEPT)

      const result = await getCommuneCoordinates('VilleInexistante', loadDept)

      expect(result).toBeNull()
    })
  })

  describe('entrées invalides', () => {
    it('devrait retourner null pour une entrée null', async () => {
      const loadDept = makeLoadDeptFn(SINGLE_COMMUNE_DEPT)

      const result = await getCommuneCoordinates(null, loadDept)

      expect(result).toBeNull()
      expect(loadDept).not.toHaveBeenCalled()
    })

    it('devrait retourner null pour une chaîne vide', async () => {
      const loadDept = makeLoadDeptFn(SINGLE_COMMUNE_DEPT)

      const result = await getCommuneCoordinates('', loadDept)

      expect(result).toBeNull()
    })

    it('devrait retourner null pour undefined', async () => {
      const loadDept = makeLoadDeptFn(SINGLE_COMMUNE_DEPT)

      const result = await getCommuneCoordinates(undefined, loadDept)

      expect(result).toBeNull()
    })

    it('devrait retourner null quand loadDepartmentFn lève une exception sur recherche par code postal', async () => {
      const loadDept = vi.fn().mockRejectedValue(new Error('Échec du chargement'))

      const result = await getCommuneCoordinates('13100', loadDept)

      expect(result).toBeNull()
    })
  })

  describe('intégration : séquence complète code postal Corse', () => {
    it('devrait charger le département 2A pour le code postal 20100', async () => {
      const corseDeptData = {
        postalCodes: {
          20100: {
            communeCount: 1,
            communes: ['Sartène'],
            center: [8.9757, 41.6241],
            coverageRadius: 0
          }
        },
        communes: [
          {
            nom: 'Sartène',
            centre: { coordinates: [8.9757, 41.6241] },
            mairie: { coordinates: [8.9744, 41.6236] },
            radius: 8000,
            codesPostaux: ['20100']
          }
        ]
      }

      const loadDept = makeLoadDeptFn(corseDeptData)

      const result = await getCommuneCoordinates('20100', loadDept)

      expect(result).not.toBeNull()
      expect(loadDept).toHaveBeenCalledWith('2A')
      expect(result.lat).toBeCloseTo(41.6241, 4)
      expect(result.isMultiCommune).toBe(false)
    })

    it('devrait charger le département 2B pour le code postal 20200', async () => {
      const corseDeptData = {
        postalCodes: {
          20200: {
            communeCount: 1,
            communes: ['Bastia'],
            center: [9.4497, 42.7033],
            coverageRadius: 0
          }
        },
        communes: [
          {
            nom: 'Bastia',
            centre: { coordinates: [9.4497, 42.7033] },
            mairie: { coordinates: [9.4459, 42.7028] },
            radius: 10000,
            codesPostaux: ['20200']
          }
        ]
      }

      const loadDept = makeLoadDeptFn(corseDeptData)

      const result = await getCommuneCoordinates('20200', loadDept)

      expect(result).not.toBeNull()
      expect(loadDept).toHaveBeenCalledWith('2B')
    })
  })
})
