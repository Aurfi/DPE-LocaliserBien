// Gestionnaire d'erreurs global
export class ErrorHandler {
  constructor() {
    this.errors = []
    this.setupGlobalHandlers()
  }

  setupGlobalHandlers() {
    // Gérer les rejets de promesse non traités
    window.addEventListener('unhandledrejection', event => {
      this.logError({
        type: 'unhandledRejection',
        message: event.reason?.message || 'Unknown error',
        stack: event.reason?.stack
      })
      event.preventDefault()
    })

    // Gérer les erreurs globales
    window.addEventListener('error', event => {
      this.logError({
        type: 'globalError',
        message: event.error?.message || event.message,
        stack: event.error?.stack,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      })
    })
  }

  logError(error) {
    // En production, vous pourriez vouloir envoyer ceci à un service de journalisation
    const errorInfo = {
      ...error,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    }

    this.errors.push(errorInfo)

    // Conserver seulement les 50 dernières erreurs en mémoire
    if (this.errors.length > 50) {
      this.errors.shift()
    }

    // En développement, logger dans la console
    if (import.meta.env.DEV) {
      // Erreur loggée
    }
  }

  handleApiError(error, context = '') {
    const isNetworkError = !navigator.onLine || error.message === 'Failed to fetch'
    const status = error.response?.status || error.status

    let userMessage = 'Une erreur est survenue'

    if (isNetworkError) {
      userMessage = 'Erreur de connexion. Vérifiez votre connexion internet.'
    } else if (status === 404) {
      userMessage = 'Ressource non trouvée'
    } else if (status === 429) {
      userMessage = 'Trop de requêtes. Veuillez patienter quelques instants.'
    } else if (status >= 500) {
      userMessage = 'Erreur serveur. Veuillez réessayer plus tard.'
    }

    this.logError({
      type: 'apiError',
      context,
      message: error.message,
      status,
      userMessage
    })

    return userMessage
  }

  getErrors() {
    return this.errors
  }

  clearErrors() {
    this.errors = []
  }
}

// Créer l'instance singleton
export const errorHandler = new ErrorHandler()
export const gestionnaireErreurs = errorHandler

export default errorHandler
