// Vite substitutes HTML env placeholders verbatim. Keep separate, context-safe
// aliases so the original application/PWA environment retains its raw values.
export const requiredHtmlEnvironment = Object.freeze([
  'VITE_APP_TITLE',
  'VITE_APP_DESCRIPTION',
  'VITE_APP_KEYWORDS',
  'VITE_SITE_NAME',
  'VITE_SITE_URL',
  'VITE_OG_TITLE',
  'VITE_OG_DESCRIPTION',
  'VITE_TWITTER_TITLE',
  'VITE_TWITTER_DESCRIPTION'
])

export function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => {
    const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
    return entities[character]
  })
}

export function serializeJsonLd(value) {
  // Script contents are raw text, not HTML entity-decoded. JSON serialization
  // handles quotes/backslashes; Unicode escapes preserve values without allowing
  // a literal closing script tag or HTML parser state changes in the document.
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, character => {
    return `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
  })
}

export function htmlEnvironmentDefines(env) {
  const missing = requiredHtmlEnvironment.filter(key => typeof env[key] !== 'string' || env[key].trim() === '')
  if (missing.length > 0) {
    throw new Error(`HTML environment requires non-empty values for: ${missing.join(', ')}`)
  }

  const values = Object.fromEntries(
    requiredHtmlEnvironment.map(key => [`VITE_HTML_${key.slice(5)}`, escapeHtml(env[key])])
  )
  const jsonLd = {
    SITE_NAME: env.VITE_SITE_NAME,
    SITE_URL: env.VITE_SITE_URL,
    APP_DESCRIPTION: env.VITE_APP_DESCRIPTION,
    SEARCH_URL: `${env.VITE_SITE_URL}/?search={search_term_string}`,
    ORGANIZATION_ID: `${env.VITE_SITE_URL}/#organization`,
    LOGO_URL: `${env.VITE_SITE_URL}/android-chrome-512x512.png`
  }
  for (const [key, value] of Object.entries(jsonLd)) {
    values[`VITE_HTML_JSONLD_${key}`] = serializeJsonLd(value)
  }

  // Vite's native HTML env hook reads define values too. Only our aliases are
  // defined: do not overwrite import.meta.env.VITE_SITE_NAME, process.env, etc.
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)])
  )
}
