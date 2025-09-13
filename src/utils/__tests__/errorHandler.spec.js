import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorHandler, errorHandler } from '../errorHandler.js'

// Mock window and navigator
Object.defineProperty(window, 'addEventListener', {
  value: vi.fn()
})

Object.defineProperty(window, 'location', {
  value: { href: 'https://example.com/test' },
  writable: true
})

Object.defineProperty(navigator, 'userAgent', {
  value: 'Test Browser 1.0'
})

Object.defineProperty(navigator, 'onLine', {
  value: true,
  writable: true
})

// Mock import.meta.env
vi.stubGlobal('import.meta', {
  env: {
    DEV: true
  }
})

describe("Gestionnaire d'erreurs", () => {
  let errorHandlerInstance

  beforeEach(() => {
    vi.clearAllMocks()
    errorHandlerInstance = new ErrorHandler()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Constructeur et configuration', () => {
    it("doit initialiser avec un tableau d'erreurs vide", () => {
      expect(errorHandlerInstance.errors).toEqual([])
    })

    it("doit configurer les écouteurs d'événements globaux", () => {
      expect(window.addEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function))
      expect(window.addEventListener).toHaveBeenCalledWith('error', expect.any(Function))
    })
  })

  describe('logError - journalisation des erreurs', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2023-01-15T10:00:00Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("doit journaliser l'erreur avec toutes les informations", () => {
      const testError = {
        type: 'testError',
        message: 'Test error message',
        stack: 'Error stack trace'
      }

      errorHandlerInstance.logError(testError)

      expect(errorHandlerInstance.errors).toHaveLength(1)
      expect(errorHandlerInstance.errors[0]).toEqual({
        type: 'testError',
        message: 'Test error message',
        stack: 'Error stack trace',
        timestamp: '2023-01-15T10:00:00.000Z',
        userAgent: 'Test Browser 1.0',
        url: 'https://example.com/test'
      })
    })

    it('doit limiter les erreurs à un maximum de 50 entrées', () => {
      // Add 55 errors
      for (let i = 0; i < 55; i++) {
        errorHandlerInstance.logError({
          type: 'testError',
          message: `Error ${i}`
        })
      }

      expect(errorHandlerInstance.errors).toHaveLength(50)
      expect(errorHandlerInstance.errors[0].message).toBe('Error 5') // Les 5 premières doivent être supprimées
      expect(errorHandlerInstance.errors[49].message).toBe('Error 54')
    })

    it('doit gérer les erreurs sans trace de pile', () => {
      const testError = {
        type: 'testError',
        message: 'Test error without stack'
      }

      errorHandlerInstance.logError(testError)

      expect(errorHandlerInstance.errors[0]).not.toHaveProperty('stack')
      expect(errorHandlerInstance.errors[0].message).toBe('Test error without stack')
    })
  })

  describe('handleApiError - gestion des erreurs API', () => {
    it('doit gérer les erreurs réseau hors ligne', () => {
      Object.defineProperty(navigator, 'onLine', { value: false })

      const error = new Error('Failed to fetch')
      const userMessage = errorHandlerInstance.handleApiError(error, 'API call')

      expect(userMessage).toBe('Erreur de connexion. Vérifiez votre connexion internet.')
      expect(errorHandlerInstance.errors).toHaveLength(1)
      expect(errorHandlerInstance.errors[0]).toMatchObject({
        type: 'apiError',
        context: 'API call',
        message: 'Failed to fetch',
        userMessage: 'Erreur de connexion. Vérifiez votre connexion internet.'
      })
    })

    it('doit gérer les échecs de récupération en ligne', () => {
      Object.defineProperty(navigator, 'onLine', { value: true })

      const error = new Error('Failed to fetch')
      const userMessage = errorHandlerInstance.handleApiError(error)

      expect(userMessage).toBe('Erreur de connexion. Vérifiez votre connexion internet.')
    })

    it('doit gérer les erreurs 404', () => {
      const error = {
        message: 'Not Found',
        response: { status: 404 }
      }

      const userMessage = errorHandlerInstance.handleApiError(error, 'Get user data')

      expect(userMessage).toBe('Ressource non trouvée')
      expect(errorHandlerInstance.errors[0]).toMatchObject({
        type: 'apiError',
        context: 'Get user data',
        status: 404,
        userMessage: 'Ressource non trouvée'
      })
    })

    it('doit gérer les erreurs 429 de limite de taux', () => {
      const error = {
        message: 'Too Many Requests',
        status: 429
      }

      const userMessage = errorHandlerInstance.handleApiError(error)

      expect(userMessage).toBe('Trop de requêtes. Veuillez patienter quelques instants.')
      expect(errorHandlerInstance.errors[0].status).toBe(429)
    })

    it('doit gérer les erreurs serveur 500', () => {
      const error = {
        message: 'Internal Server Error',
        response: { status: 500 }
      }

      const userMessage = errorHandlerInstance.handleApiError(error)

      expect(userMessage).toBe('Erreur serveur. Veuillez réessayer plus tard.')
      expect(errorHandlerInstance.errors[0].status).toBe(500)
    })

    it('doit gérer les erreurs 502 bad gateway', () => {
      const error = {
        message: 'Bad Gateway',
        response: { status: 502 }
      }

      const userMessage = errorHandlerInstance.handleApiError(error)

      expect(userMessage).toBe('Erreur serveur. Veuillez réessayer plus tard.')
    })

    it('doit gérer les erreurs génériques sans statut', () => {
      const error = {
        message: 'Unknown error'
      }

      const userMessage = errorHandlerInstance.handleApiError(error)

      expect(userMessage).toBe('Une erreur est survenue')
      expect(errorHandlerInstance.errors[0].status).toBeUndefined()
    })

    it('doit gérer les erreurs avec statut mais sans objet réponse', () => {
      const error = {
        message: 'Direct status error',
        status: 404
      }

      const userMessage = errorHandlerInstance.handleApiError(error)

      expect(userMessage).toBe('Ressource non trouvée')
      expect(errorHandlerInstance.errors[0].status).toBe(404)
    })
  })

  describe('getErrors - récupération des erreurs', () => {
    it('doit retourner toutes les erreurs journalisées', () => {
      const error1 = { type: 'error1', message: 'First error' }
      const error2 = { type: 'error2', message: 'Second error' }

      errorHandlerInstance.logError(error1)
      errorHandlerInstance.logError(error2)

      const errors = errorHandlerInstance.getErrors()

      expect(errors).toHaveLength(2)
      expect(errors[0].message).toBe('First error')
      expect(errors[1].message).toBe('Second error')
    })

    it("doit retourner un tableau vide quand aucune erreur n'est journalisée", () => {
      const errors = errorHandlerInstance.getErrors()
      expect(errors).toEqual([])
    })
  })

  describe('clearErrors - effacement des erreurs', () => {
    it('doit effacer toutes les erreurs journalisées', () => {
      errorHandlerInstance.logError({ type: 'test', message: 'Test error' })
      expect(errorHandlerInstance.errors).toHaveLength(1)

      errorHandlerInstance.clearErrors()
      expect(errorHandlerInstance.errors).toEqual([])
    })
  })

  describe("Gestionnaires d'événements globaux", () => {
    let unhandledRejectionHandler
    let errorHandler

    beforeEach(() => {
      // Récupérer les gestionnaires qui ont été enregistrés
      const calls = window.addEventListener.mock.calls
      unhandledRejectionHandler = calls.find(call => call[0] === 'unhandledrejection')?.[1]
      errorHandler = calls.find(call => call[0] === 'error')?.[1]
    })

    it('doit gérer les rejets de promesses non traités', () => {
      const mockEvent = {
        reason: {
          message: 'Unhandled promise rejection',
          stack: 'Promise rejection stack'
        },
        preventDefault: vi.fn()
      }

      unhandledRejectionHandler(mockEvent)

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(errorHandlerInstance.errors).toHaveLength(1)
      expect(errorHandlerInstance.errors[0]).toMatchObject({
        type: 'unhandledRejection',
        message: 'Unhandled promise rejection',
        stack: 'Promise rejection stack'
      })
    })

    it('doit gérer les rejets de promesses sans raison', () => {
      const mockEvent = {
        reason: null,
        preventDefault: vi.fn()
      }

      unhandledRejectionHandler(mockEvent)

      expect(errorHandlerInstance.errors[0]).toMatchObject({
        type: 'unhandledRejection',
        message: 'Unknown error'
      })
    })

    it('doit gérer les erreurs globales avec objet erreur', () => {
      const mockEvent = {
        error: {
          message: 'Global error message',
          stack: 'Global error stack'
        },
        filename: 'test.js',
        lineno: 42,
        colno: 15
      }

      errorHandler(mockEvent)

      expect(errorHandlerInstance.errors).toHaveLength(1)
      expect(errorHandlerInstance.errors[0]).toMatchObject({
        type: 'globalError',
        message: 'Global error message',
        stack: 'Global error stack',
        filename: 'test.js',
        lineno: 42,
        colno: 15
      })
    })

    it('doit gérer les erreurs globales sans objet erreur', () => {
      const mockEvent = {
        error: null,
        message: 'Global error without error object',
        filename: 'test.js',
        lineno: 42,
        colno: 15
      }

      errorHandler(mockEvent)

      expect(errorHandlerInstance.errors[0]).toMatchObject({
        type: 'globalError',
        message: 'Global error without error object',
        filename: 'test.js',
        lineno: 42,
        colno: 15
      })
    })
  })

  describe('Export singleton', () => {
    it('doit exporter une instance singleton errorHandler', () => {
      expect(errorHandler).toBeInstanceOf(ErrorHandler)
      expect(errorHandler.errors).toEqual([])
    })

    it('doit utiliser la même instance à travers les imports', () => {
      errorHandler.logError({ type: 'test', message: 'Singleton test' })
      expect(errorHandler.errors).toHaveLength(1)

      // Le singleton doit maintenir son état
      expect(errorHandler.getErrors()).toHaveLength(1)
    })
  })

  describe('Cas limites', () => {
    it('doit gérer la journalisation en environnement de production', () => {
      vi.stubGlobal('import.meta', {
        env: { DEV: false }
      })

      const productionHandler = new ErrorHandler()
      productionHandler.logError({ type: 'prod', message: 'Production error' })

      expect(productionHandler.errors).toHaveLength(1)
    })

    it('doit gérer les objets erreur mal formés', () => {
      errorHandlerInstance.logError(null)
      errorHandlerInstance.logError(undefined)
      errorHandlerInstance.logError({})

      expect(errorHandlerInstance.errors).toHaveLength(3)
      expect(errorHandlerInstance.errors[0]).toHaveProperty('timestamp')
      expect(errorHandlerInstance.errors[1]).toHaveProperty('timestamp')
      expect(errorHandlerInstance.errors[2]).toHaveProperty('timestamp')
    })

    it("doit gérer les messages d'erreur très longs", () => {
      const longMessage = 'A'.repeat(10000)
      errorHandlerInstance.logError({ type: 'long', message: longMessage })

      expect(errorHandlerInstance.errors[0].message).toBe(longMessage)
      expect(errorHandlerInstance.errors).toHaveLength(1)
    })
  })
})
