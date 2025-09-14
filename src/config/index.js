// Configuration de l'application
export const config = {
  api: {
    ademe:
      import.meta.env.VITE_ADEME_API_URL ||
      'https://data.ademe.fr/data-fair/api/v1/datasets/dpe-v2-logements-existants/lines',
    geo: import.meta.env.VITE_GEO_API_URL || 'https://data.geopf.fr/geocodage'
  },
  app: {
    title: import.meta.env.VITE_APP_TITLE || 'DPE Property Locator',
    description: import.meta.env.VITE_APP_DESCRIPTION || 'Free real estate location service'
  },
  features: {
    analytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true'
  }
}

export default config
