import { describe, expect, it } from 'vitest'
import {
  getGeoportailUrl,
  getGoogleMapsEmbedUrl,
  getGoogleMapsSearchUrl,
  getGoogleRegionLabel,
  getLatitudeFromGeopoint,
  getLongitudeFromGeopoint
} from '../utilsCartes.js'

describe('utilsCartes', () => {
  describe('getGoogleMapsEmbedUrl', () => {
    it('devrait générer une URL embed avec adresse quand fournie', () => {
      const result = getGoogleMapsEmbedUrl(48.8566, 2.3522, '1 rue de la Paix, Paris')
      // Quand adresse et coordonnées sont fournies, les deux sont incluses
      const expected =
        'https://maps.google.com/maps?q=1%20rue%20de%20la%20Paix%2C%20Paris&ll=48.8566,2.3522&output=embed&z=18&t=k'
      expect(result).toBe(expected)
    })

    it('devrait générer une URL embed avec coordonnées sans adresse', () => {
      const result = getGoogleMapsEmbedUrl(48.8566, 2.3522)
      const expected = 'https://maps.google.com/maps?q=48.8566,2.3522&output=embed&z=18&t=k'
      expect(result).toBe(expected)
    })

    it('devrait utiliser un niveau de zoom personnalisé', () => {
      const result = getGoogleMapsEmbedUrl(48.8566, 2.3522, null, 15)
      const expected = 'https://maps.google.com/maps?q=48.8566,2.3522&output=embed&z=15&t=k'
      expect(result).toBe(expected)
    })

    it('devrait gérer les coordonnées en chaîne de caractères', () => {
      const result = getGoogleMapsEmbedUrl('48.8566', '2.3522')
      const expected = 'https://maps.google.com/maps?q=48.8566,2.3522&output=embed&z=18&t=k'
      expect(result).toBe(expected)
    })

    it('devrait retourner une chaîne vide pour des coordonnées invalides', () => {
      expect(getGoogleMapsEmbedUrl(NaN, 2.3522)).toBe('')
      expect(getGoogleMapsEmbedUrl(48.8566, 'invalid')).toBe('')
      expect(getGoogleMapsEmbedUrl(undefined, undefined)).toBe('')
      // Note: null est converti en 0 par Number()
    })

    it('devrait inclure adresse et coordonnées quand les deux sont fournies', () => {
      const result = getGoogleMapsEmbedUrl(48.8566, 2.3522, 'Paris France', 12)
      // Quand les deux sont fournis, les deux sont inclus pour la précision
      const expected = 'https://maps.google.com/maps?q=Paris%20France&ll=48.8566,2.3522&output=embed&z=12&t=k'
      expect(result).toBe(expected)
    })

    it("devrait gérer les caractères spéciaux dans l'adresse", () => {
      const result = getGoogleMapsEmbedUrl(48.8566, 2.3522, 'Café & Restaurant, Paris')
      // Quand les deux sont fournis, les deux sont inclus
      const expected =
        'https://maps.google.com/maps?q=Caf%C3%A9%20%26%20Restaurant%2C%20Paris&ll=48.8566,2.3522&output=embed&z=18&t=k'
      expect(result).toBe(expected)
    })

    it("devrait gérer une chaîne d'adresse vide", () => {
      const result = getGoogleMapsEmbedUrl(48.8566, 2.3522, '')
      const expected = 'https://maps.google.com/maps?q=48.8566,2.3522&output=embed&z=18&t=k'
      expect(result).toBe(expected)
    })

    it('devrait gérer les coordonnées zéro', () => {
      const result = getGoogleMapsEmbedUrl(0, 0)
      // Les coordonnées zéro sont traitées comme invalides
      expect(result).toBe('')
    })
  })

  describe('getGoogleMapsSearchUrl', () => {
    it('devrait générer une URL de recherche avec adresse quand fournie', () => {
      const result = getGoogleMapsSearchUrl(48.8566, 2.3522, '1 rue de la Paix, Paris')
      const expected = 'https://www.google.com/maps/recherche/?api=1&query=1%20rue%20de%20la%20Paix%2C%20Paris'
      expect(result).toBe(expected)
    })

    it('devrait générer une URL de recherche avec coordonnées sans adresse', () => {
      const result = getGoogleMapsSearchUrl(48.8566, 2.3522)
      const expected = 'https://www.google.com/maps/recherche/?api=1&query=48.8566,2.3522'
      expect(result).toBe(expected)
    })

    it('devrait gérer les coordonnées en chaîne de caractères', () => {
      const result = getGoogleMapsSearchUrl('48.8566', '2.3522')
      const expected = 'https://www.google.com/maps/recherche/?api=1&query=48.8566,2.3522'
      expect(result).toBe(expected)
    })

    it('devrait retourner une URL de secours pour des coordonnées invalides', () => {
      expect(getGoogleMapsSearchUrl(NaN, 2.3522)).toBe('https://www.google.com/maps')
      expect(getGoogleMapsSearchUrl(48.8566, 'invalid')).toBe('https://www.google.com/maps')
    })

    it("devrait préférer l'adresse aux coordonnées", () => {
      const result = getGoogleMapsSearchUrl(48.8566, 2.3522, 'Paris France')
      const expected = 'https://www.google.com/maps/recherche/?api=1&query=Paris%20France'
      expect(result).toBe(expected)
    })

    it("devrait gérer les caractères spéciaux dans l'adresse", () => {
      const result = getGoogleMapsSearchUrl(48.8566, 2.3522, 'Café & Restaurant, Paris')
      const expected = 'https://www.google.com/maps/recherche/?api=1&query=Caf%C3%A9%20%26%20Restaurant%2C%20Paris'
      expect(result).toBe(expected)
    })

    it("devrait gérer une chaîne d'adresse vide et utiliser les coordonnées", () => {
      const result = getGoogleMapsSearchUrl(48.8566, 2.3522, '')
      const expected = 'https://www.google.com/maps/recherche/?api=1&query=48.8566,2.3522'
      expect(result).toBe(expected)
    })
  })

  describe('getLatitudeFromGeopoint', () => {
    it("devrait extraire la latitude d'une chaîne geopoint", () => {
      const result = getLatitudeFromGeopoint('48.8566, 2.3522')
      expect(result).toBe(48.8566)
    })

    it('devrait gérer un geopoint avec espaces supplémentaires', () => {
      const result = getLatitudeFromGeopoint('  48.8566  ,  2.3522  ')
      expect(result).toBe(48.8566)
    })

    it('devrait gérer une latitude négative', () => {
      const result = getLatitudeFromGeopoint('-48.8566, 2.3522')
      expect(result).toBe(-48.8566)
    })

    it('devrait retourner null pour un geopoint vide', () => {
      expect(getLatitudeFromGeopoint('')).toBe(null)
      expect(getLatitudeFromGeopoint(null)).toBe(null)
      expect(getLatitudeFromGeopoint(undefined)).toBe(null)
    })

    it('devrait retourner null pour un geopoint mal formé', () => {
      expect(getLatitudeFromGeopoint('invalid')).toBe(null)
      expect(getLatitudeFromGeopoint('48.8566')).toBe(null)
      expect(getLatitudeFromGeopoint('single')).toBe(null)
    })

    it('devrait gérer une latitude zéro', () => {
      const result = getLatitudeFromGeopoint('0, 2.3522')
      expect(result).toBe(0)
    })

    it('devrait gérer un geopoint avec plus de deux parties', () => {
      const result = getLatitudeFromGeopoint('48.8566, 2.3522, extra')
      expect(result).toBe(48.8566)
    })
  })

  describe('getLongitudeFromGeopoint', () => {
    it("devrait extraire la longitude d'une chaîne geopoint", () => {
      const result = getLongitudeFromGeopoint('48.8566, 2.3522')
      expect(result).toBe(2.3522)
    })

    it('devrait gérer un geopoint avec espaces supplémentaires', () => {
      const result = getLongitudeFromGeopoint('  48.8566  ,  2.3522  ')
      expect(result).toBe(2.3522)
    })

    it('devrait gérer une longitude négative', () => {
      const result = getLongitudeFromGeopoint('48.8566, -2.3522')
      expect(result).toBe(-2.3522)
    })

    it('devrait retourner null pour un geopoint vide', () => {
      expect(getLongitudeFromGeopoint('')).toBe(null)
      expect(getLongitudeFromGeopoint(null)).toBe(null)
      expect(getLongitudeFromGeopoint(undefined)).toBe(null)
    })

    it('devrait retourner null pour un geopoint mal formé', () => {
      expect(getLongitudeFromGeopoint('invalid')).toBe(null)
      expect(getLongitudeFromGeopoint('48.8566')).toBe(null)
      expect(getLongitudeFromGeopoint('single')).toBe(null)
    })

    it('devrait gérer une longitude zéro', () => {
      const result = getLongitudeFromGeopoint('48.8566, 0')
      expect(result).toBe(0)
    })

    it('devrait gérer un geopoint avec plus de deux parties', () => {
      const result = getLongitudeFromGeopoint('48.8566, 2.3522, extra')
      expect(result).toBe(2.3522)
    })
  })

  describe('getGeoportailUrl', () => {
    it('devrait générer une URL Geoportail valide avec zoom par défaut', () => {
      const result = getGeoportailUrl(48.8566, 2.3522)
      const expected =
        'https://explore.data.gouv.fr/fr/immobilier?onglet=carte&filtre=tous&lat=48.8566&lng=2.3522&zoom=17.00'
      expect(result).toBe(expected)
    })

    it('devrait générer une URL Geoportail avec zoom personnalisé', () => {
      const result = getGeoportailUrl(48.8566, 2.3522, 15)
      const expected =
        'https://explore.data.gouv.fr/fr/immobilier?onglet=carte&filtre=tous&lat=48.8566&lng=2.3522&zoom=15.00'
      expect(result).toBe(expected)
    })

    it('devrait gérer les coordonnées en chaîne de caractères', () => {
      const result = getGeoportailUrl('48.8566', '2.3522')
      const expected =
        'https://explore.data.gouv.fr/fr/immobilier?onglet=carte&filtre=tous&lat=48.8566&lng=2.3522&zoom=17.00'
      expect(result).toBe(expected)
    })

    it('devrait gérer les coordonnées négatives', () => {
      const result = getGeoportailUrl(-48.8566, -2.3522)
      const expected =
        'https://explore.data.gouv.fr/fr/immobilier?onglet=carte&filtre=tous&lat=-48.8566&lng=-2.3522&zoom=17.00'
      expect(result).toBe(expected)
    })

    it('devrait retourner null pour des coordonnées invalides', () => {
      expect(getGeoportailUrl(NaN, 2.3522)).toBe(null)
      expect(getGeoportailUrl(48.8566, 'invalid')).toBe(null)
      expect(getGeoportailUrl(undefined, undefined)).toBe(null)
    })

    it('devrait gérer les coordonnées zéro', () => {
      const result = getGeoportailUrl(0, 0)
      const expected = 'https://explore.data.gouv.fr/fr/immobilier?onglet=carte&filtre=tous&lat=0&lng=0&zoom=17.00'
      expect(result).toBe(expected)
    })

    it('devrait gérer les coordonnées extrêmes', () => {
      const result = getGeoportailUrl(90, 180)
      const expected = 'https://explore.data.gouv.fr/fr/immobilier?onglet=carte&filtre=tous&lat=90&lng=180&zoom=17.00'
      expect(result).toBe(expected)
    })
  })

  describe('getGoogleRegionLabel', () => {
    it('devrait retourner France pour les codes postaux métropolitains', () => {
      expect(getGoogleRegionLabel('75001')).toBe('France')
      expect(getGoogleRegionLabel('13001')).toBe('France')
      expect(getGoogleRegionLabel('69001')).toBe('France')
    })

    it('devrait retourner Guadeloupe pour les codes postaux 971', () => {
      expect(getGoogleRegionLabel('97100')).toBe('Guadeloupe')
      expect(getGoogleRegionLabel('97150')).toBe('Guadeloupe')
    })

    it('devrait retourner Martinique pour les codes postaux 972', () => {
      expect(getGoogleRegionLabel('97200')).toBe('Martinique')
      expect(getGoogleRegionLabel('97250')).toBe('Martinique')
    })

    it('devrait retourner Guyane française pour les codes postaux 973', () => {
      expect(getGoogleRegionLabel('97300')).toBe('Guyane française')
      expect(getGoogleRegionLabel('97350')).toBe('Guyane française')
    })

    it('devrait retourner La Réunion pour les codes postaux 974', () => {
      expect(getGoogleRegionLabel('97400')).toBe('La Réunion')
      expect(getGoogleRegionLabel('97450')).toBe('La Réunion')
    })

    it('devrait retourner Mayotte pour les codes postaux 976', () => {
      expect(getGoogleRegionLabel('97600')).toBe('Mayotte')
      expect(getGoogleRegionLabel('97650')).toBe('Mayotte')
    })

    it('devrait retourner France pour les codes postaux corses', () => {
      expect(getGoogleRegionLabel('20000')).toBe('France')
      expect(getGoogleRegionLabel('20200')).toBe('France')
    })

    it('devrait gérer les entrées numériques', () => {
      expect(getGoogleRegionLabel(75001)).toBe('France')
      expect(getGoogleRegionLabel(97100)).toBe('Guadeloupe')
    })

    it('devrait retourner France pour une entrée vide ou null', () => {
      expect(getGoogleRegionLabel('')).toBe('France')
      expect(getGoogleRegionLabel(null)).toBe('France')
      expect(getGoogleRegionLabel(undefined)).toBe('France')
    })

    it('devrait gérer les codes postaux courts', () => {
      expect(getGoogleRegionLabel('971')).toBe('Guadeloupe')
      expect(getGoogleRegionLabel('972')).toBe('Martinique')
    })

    it('devrait gérer les codes postaux invalides', () => {
      expect(getGoogleRegionLabel('invalid')).toBe('France')
      expect(getGoogleRegionLabel('00000')).toBe('France')
    })

    it('devrait gérer les codes postaux commençant par les codes territoriaux mais pas exactement correspondants', () => {
      expect(getGoogleRegionLabel('97199')).toBe('Guadeloupe')
      expect(getGoogleRegionLabel('97299')).toBe('Martinique')
      expect(getGoogleRegionLabel('97500')).toBe('France')
    })
  })

  describe('Cas limites et intégration', () => {
    it('devrait gérer des chaînes de coordonnées très longues', () => {
      const result = getGoogleMapsEmbedUrl('48.856614325678901234567890', '2.352217654321098765432109')
      // JavaScript limite la précision à environ 15-16 chiffres significatifs
      expect(result).toContain('48.856614325678905')
      expect(result).toContain('2.3522176543210986')
    })

    it('devrait gérer les chaînes de coordonnées avec notation scientifique', () => {
      const result = getLatitudeFromGeopoint('4.88566e1, 2.3522')
      expect(result).toBeCloseTo(48.8566, 4)
    })

    it('devrait gérer les URL avec territoires spéciaux correctement', () => {
      const result = getGoogleRegionLabel('97700')
      expect(['France', 'Saint-Barthélemy', 'Saint-Martin']).toContain(result)
    })

    it('devrait générer des URL cohérentes entre différentes fonctions', () => {
      const lat = 48.8566
      const lon = 2.3522
      const embedUrl = getGoogleMapsEmbedUrl(lat, lon)
      const searchUrl = getGoogleMapsSearchUrl(lat, lon)
      const geoportailUrl = getGeoportailUrl(lat, lon)

      expect(embedUrl).toContain('48.8566')
      expect(embedUrl).toContain('2.3522')
      expect(searchUrl).toContain('48.8566')
      expect(searchUrl).toContain('2.3522')
      expect(geoportailUrl).toContain('48.8566')
      expect(geoportailUrl).toContain('2.3522')
    })

    it('devrait gérer les coordonnées aux limites', () => {
      expect(getGeoportailUrl(90, 180)).toBeTruthy()
      expect(getGeoportailUrl(-90, -180)).toBeTruthy()
    })

    it('devrait gérer la précision en virgule flottante', () => {
      const result = getGoogleMapsEmbedUrl(48.8566123456789, 2.3522123456789)
      expect(result).toContain('48.8566123456789')
      expect(result).toContain('2.3522123456789')
    })
  })
})
