import { describe, expect, it } from 'vitest'
import {
  cleanAddress,
  extractYearFromValue,
  formatDate,
  formatFloorForDisplay,
  formatYearDisplay,
  getDaysAgo,
  getFloorDisplay,
  getPropertyType,
  parseLocalisation
} from '../../utils/formateursDPE.js'

describe('Formatteurs de données DPE', () => {
  describe("extractYearFromValue - extraction d'année", () => {
    it("doit extraire l'année d'une chaîne d'année simple", () => {
      expect(extractYearFromValue('1970')).toBe(1970)
      expect(extractYearFromValue('2023')).toBe(2023)
    })

    it("doit extraire la première année d'une plage", () => {
      expect(extractYearFromValue('1948-1974')).toBe(1948)
      expect(extractYearFromValue('2000-2010')).toBe(2000)
    })

    it('doit gérer les valeurs null/undefined', () => {
      expect(extractYearFromValue(null)).toBe(null)
      expect(extractYearFromValue(undefined)).toBe(null)
      expect(extractYearFromValue('')).toBe(null)
    })
  })

  describe("formatYearDisplay - affichage d'année", () => {
    it('doit retourner la valeur telle quelle', () => {
      expect(formatYearDisplay('1970')).toBe('1970')
      expect(formatYearDisplay('1948-1974')).toBe('1948-1974')
    })

    it('doit gérer les valeurs null/undefined', () => {
      expect(formatYearDisplay(null)).toBe('N/A')
      expect(formatYearDisplay(undefined)).toBe('N/A')
    })
  })

  describe('formatDate - formatage de date', () => {
    it('doit formater les dates en locale française', () => {
      expect(formatDate('2023-01-15')).toBe('15 janvier 2023')
      expect(formatDate('2020-12-25')).toBe('25 décembre 2020')
    })

    it('doit gérer les dates vides/null', () => {
      expect(formatDate(null)).toBe('')
      expect(formatDate('')).toBe('')
      expect(formatDate(undefined)).toBe('')
    })
  })

  describe('getDaysAgo - temps relatif', () => {
    it('doit retourner le temps relatif pour les dates récentes', () => {
      // Use fixed dates to avoid timing issues
      const fixedDate = '2023-01-15T10:00:00.000Z'
      const fixedYesterday = '2023-01-14T10:00:00.000Z'

      // Mock the current date
      const originalDate = Date
      global.Date = class extends Date {
        constructor(...args) {
          super(...args)
          if (args.length === 0) {
            this.setTime(new originalDate('2023-01-15T10:00:00.000Z').getTime())
          }
        }
        static now() {
          return new originalDate('2023-01-15T10:00:00.000Z').getTime()
        }
      }

      expect(getDaysAgo(fixedDate)).toBe("aujourd'hui")
      expect(getDaysAgo(fixedYesterday)).toBe('hier')

      // Restore original Date
      global.Date = originalDate
    })

    it('doit formater les jours correctement', () => {
      // Mock current date for consistent testing
      const originalDate = global.Date
      const mockNow = new Date('2023-01-15T10:00:00.000Z')

      global.Date = class extends originalDate {
        constructor(...args) {
          super(...args)
          if (args.length === 0) {
            this.setTime(mockNow.getTime())
          }
        }
        static now() {
          return mockNow.getTime()
        }
      }

      const threeDaysAgo = new Date('2023-01-12T10:00:00.000Z')
      expect(getDaysAgo(threeDaysAgo.toISOString())).toBe('3 jours')

      // Restore original Date
      global.Date = originalDate
    })

    it('doit gérer les dates vides', () => {
      expect(getDaysAgo('')).toBe('')
      expect(getDaysAgo(null)).toBe('')
    })
  })

  describe('getPropertyType - type de propriété', () => {
    it('doit détecter le type appartement', () => {
      const result = { typeBien: 'appartement' }
      expect(getPropertyType(result)).toBe('appartement')

      const result2 = { typeBien: 'APPARTEMENT T3' }
      expect(getPropertyType(result2)).toBe('appartement')
    })

    it('doit détecter le type maison', () => {
      const result = { typeBien: 'maison' }
      expect(getPropertyType(result)).toBe('maison')

      const result2 = { typeBien: 'Maison individuelle' }
      expect(getPropertyType(result2)).toBe('maison')
    })

    it('doit retourner null pour les types inconnus', () => {
      const result = { typeBien: 'bureau' }
      expect(getPropertyType(result)).toBe(null)

      const result2 = {}
      expect(getPropertyType(result2)).toBe(null)
    })
  })

  describe('parseLocalisation - analyse de localisation', () => {
    it("doit analyser les numéros d'étage explicites", () => {
      expect(parseLocalisation('Étage: 3')).toBe('Étage: 3')
      expect(parseLocalisation('etage n° 2')).toBe('Étage: 2')
      expect(parseLocalisation('Étage #5')).toBe('Étage: 5')
    })

    it('doit gérer les variantes de rez-de-chaussée', () => {
      expect(parseLocalisation('RDC')).toBe('RDC')
      expect(parseLocalisation('rez de chaussée')).toBe('RDC')
      expect(parseLocalisation('res de chaussee')).toBe('RDC')
    })

    it('doit gérer les motifs ordinaux', () => {
      expect(parseLocalisation('2ème étage')).toBe('Étage: 2')
      expect(parseLocalisation('1er gauche')).toBe('Étage: 1')
    })

    it('doit retourner une chaîne vide pour les motifs non reconnus', () => {
      expect(parseLocalisation('some random text')).toBe('')
      expect(parseLocalisation('')).toBe('')
      expect(parseLocalisation(null)).toBe('')
    })
  })

  describe("getFloorDisplay - affichage d'étage", () => {
    it('doit utiliser le champ etage direct quand disponible', () => {
      const result = { etage: '3' }
      expect(getFloorDisplay(result)).toBe('Étage: 3')

      const result2 = { etage: 'Étage: 5' }
      expect(getFloorDisplay(result2)).toBe('Étage: 5')
    })

    it('doit analyser depuis complementRefLogement', () => {
      const result = { complementRefLogement: 'Étage: 2' }
      expect(getFloorDisplay(result)).toBe('Étage: 2')
    })

    it("doit retourner null quand aucune info d'étage disponible", () => {
      const result = {}
      expect(getFloorDisplay(result)).toBe(null)
    })

    it('doit gérer etage zéro', () => {
      const result = { etage: 0 }
      expect(getFloorDisplay(result)).toBe(null)
    })
  })

  describe('formatFloorForDisplay - formatage étage pour affichage', () => {
    it('doit supprimer le préfixe Etage', () => {
      expect(formatFloorForDisplay('Étage: 3')).toBe('3')
      expect(formatFloorForDisplay('Étage: 1')).toBe('1')
    })

    it('doit gérer RDC', () => {
      expect(formatFloorForDisplay('RDC')).toBe('RDC')
    })

    it('doit gérer les nombres', () => {
      expect(formatFloorForDisplay(5)).toBe('5')
      expect(formatFloorForDisplay('7')).toBe('7')
    })

    it('doit gérer les valeurs vides', () => {
      expect(formatFloorForDisplay(null)).toBe('-')
      expect(formatFloorForDisplay('')).toBe('-')
      expect(formatFloorForDisplay(undefined)).toBe('-')
    })
  })

  describe("cleanAddress - nettoyage d'adresse", () => {
    it("doit nettoyer les codes postaux de l'adresse", () => {
      const result = cleanAddress('1 rue de la Paix 75001 Paris', 'PARIS')
      expect(result).toBe('1 rue de la Paix')
    })

    it('doit supprimer le nom de ville ADEME', () => {
      const result = cleanAddress('1 rue de la Paix Marseille', 'MARSEILLE')
      expect(result).toBe('1 rue de la Paix')
    })

    it('doit gérer les adresses vides', () => {
      expect(cleanAddress('', 'PARIS')).toBe('Bien localisé')
      expect(cleanAddress(null, 'PARIS')).toBe('Bien localisé')
    })

    it("doit corriger les problèmes d'encodage", () => {
      const result = cleanAddress("1 rue de l'â€™exemple", 'PARIS')
      expect(result).toBe("1 rue de l''exemple")
    })

    it('doit gérer les adresses sans modifications nécessaires', () => {
      const result = cleanAddress('1 rue du Commerce 13001', 'MARSEILLE')
      expect(result).toBe('1 rue du Commerce')
    })
  })
})
