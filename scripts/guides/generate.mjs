import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { escapeHtml, serializeJsonLd } from '../html/environment.mjs'

const contentRoot = new URL('../../content/guides/', import.meta.url)
export const guides = JSON.parse(fs.readFileSync(new URL('pages.json', contentRoot), 'utf8'))
export const indexPage = {
  path: '/guides/',
  title: 'Guides pour rechercher un bien avec le DPE',
  description:
    'Trois guides pratiques pour chercher une adresse à partir d’une annonce, lire les chiffres du DPE et comprendre les diagnostics récents.',
  updated: '2026-10-05'
}
export const agentPage = {
  path: '/documentation/agents/',
  title: 'Documentation pour les assistants et agents',
  description:
    'Fonctionnement réel de LocaliserBien : champs de recherche, résultats, sources publiques, limites et échanges de données.',
  updated: '2026-10-05'
}
export const publicPages = [indexPage, ...guides, agentPage]
export const capabilityPath = '/documentation/agents/capabilities.json'

function originFor(value) {
  const url = new URL(value)
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  ) {
    throw new Error('Guide SITE_URL must be an HTTP(S) origin without credentials, path or query')
  }
  return url.origin
}

export function guideSitemapEntries(siteUrl) {
  const origin = originFor(siteUrl)
  return publicPages
    .map(page => `  <url><loc>${escapeHtml(origin + page.path)}</loc><lastmod>${page.updated}</lastmod></url>`)
    .join('\n')
}

export function guideCapabilities(origin) {
  return {
    schema_version: '1.0',
    name: 'LocaliserBien',
    language: 'fr',
    documentation_url: origin + agentPage.path,
    website_url: `${origin}/`,
    updated: agentPage.updated,
    interface: { type: 'browser', javascript_required_for_search: true, search_api: null, mcp_server: null },
    workflows: [
      {
        name: 'Trouver un bien',
        required_inputs: [
          { label: 'Commune', type: 'commune_name_or_postcode' },
          { label: 'Surface', unit: 'm²' },
          { label: 'Consommation énergétique ou classe DPE', alternatives: ['kWh/m²/an (énergie primaire)', 'A–G'] }
        ],
        optional_inputs: ['Maison ou appartement', 'GES en kgCO₂/m²/an ou classe A–G'],
        submit_label: 'Localiser',
        guide_url: origin + guides[0].path
      },
      {
        name: 'Biens à proximité',
        required_inputs: ['Adresse', 'Rayon proposé dans le formulaire', 'Période proposée dans le formulaire'],
        optional_inputs: ['Surface', 'Maison ou appartement', 'Consommation ou classe DPE', 'GES ou classe GES'],
        guide_url: origin + guides[2].path
      }
    ],
    outputs: [
      'Correspondances possibles',
      'Adresse et caractéristiques disponibles',
      'Numéro et date du DPE',
      'Valeurs et classes DPE/GES',
      'Score de correspondance ou distance selon le mode'
    ],
    numeric_input_rules: [
      'Nombres sans unité, avec une virgule ou un point décimal.',
      '< et > incluent la valeur limite dans cette interface.',
      'Trouver un bien : surface exacte minimale de 10 m², consommation exacte minimale de 10 kWh/m²/an.'
    ],
    unsupported_inputs: ['URL d’annonce', 'Image ou document à importer', 'Numéro de DPE comme critère de recherche'],
    limitations: [
      'Le score n’est pas une probabilité d’identification.',
      'Un DPE récent ne prouve pas une vente ou une location.',
      'Aucune identité de propriétaire n’est fournie.',
      'Adresses, coordonnées et caractéristiques peuvent être absentes ou erronées.',
      'Les recherches peuvent élargir les tolérances, le secteur ou les classes DPE/GES ; elles sont limitées en volume.',
      'La liste ne constitue pas un recensement exhaustif.',
      'Les diagnostics anciens ou les étiquettes actualisées demandent une vérification.'
    ],
    data_sources: [
      { name: 'ADEME, DPE depuis juillet 2021', url: 'https://data.ademe.fr/datasets/dpe03existant' },
      { name: 'ADEME, anciens DPE', url: 'https://data.ademe.fr/datasets/dpe-france' },
      { name: 'IGN, géocodage', url: 'https://geoservices.ign.fr/' }
    ],
    data_flows: [
      'Le navigateur transmet les critères nécessaires aux services ADEME et IGN.',
      'Ouvrir une fiche charge un aperçu Google Maps avec la localisation du résultat.',
      'L’historique local est désactivé par défaut.'
    ],
    privacy_url: `${origin}/mentions-legales#vie-privee`,
    guides: guides.map(page => ({ title: page.title, url: origin + page.path })),
    note: 'Descriptif propre au site, sans protocole d’exécution ni garantie d’indexation. Respecter les choix de l’utilisateur et les conditions des sources.'
  }
}

function render(page, body, origin, cssPath, siteName) {
  const canonical = origin + page.path
  const displayDate = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(`${page.updated}T00:00:00Z`))
  const breadcrumb =
    page.path === indexPage.path
      ? 'Guides'
      : `<a href="/guides/">Guides</a> / ${page.path === agentPage.path ? 'Documentation' : 'Article'}`
  const structured = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': canonical,
    url: canonical,
    name: page.title,
    description: page.description,
    inLanguage: 'fr',
    dateModified: page.updated,
    isPartOf: { '@type': 'WebSite', name: siteName, url: `${origin}/` }
  }
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(page.title)} | ${escapeHtml(siteName)}</title>
  <meta name="description" content="${escapeHtml(page.description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="${cssPath}">
  <link rel="alternate" type="application/json" href="${capabilityPath}" title="Capacités de LocaliserBien">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="fr_FR">
  <meta property="og:title" content="${escapeHtml(page.title)}">
  <meta property="og:description" content="${escapeHtml(page.description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <script type="application/ld+json">${serializeJsonLd(structured)}</script>
</head>
<body>
  <a class="skip-link" href="#contenu-principal">Aller au contenu</a>
  <header class="site-header"><nav aria-label="Navigation principale"><a class="wordmark" href="/">${escapeHtml(siteName)}</a><a href="/">Revenir à la recherche</a></nav></header>
  <main id="contenu-principal" class="guide" tabindex="-1">
    <nav class="breadcrumb" aria-label="Fil d’Ariane">${breadcrumb}</nav>
    <article><h1>${escapeHtml(page.title)}</h1>
    <p class="review-date">Mis à jour le <time datetime="${page.updated}">${displayDate}</time></p>
${body}
    </article>
  </main>
  <footer class="site-footer" aria-label="Informations du site"><a href="/guides/">Guides</a><a href="/informations">Informations</a><a href="/documentation/agents/">Documentation pour les agents</a><a href="/mentions-legales">Mentions légales</a></footer>
</body>
</html>\n`
}

export function buildGuideAssets(env) {
  const origin = originFor(env.VITE_SITE_URL)
  const siteName = env.VITE_SITE_NAME || 'LocaliserBien'
  const css = fs.readFileSync(new URL('guides.css', contentRoot), 'utf8')
  const cssPath = `/assets/guides-${createHash('sha256').update(css).digest('hex').slice(0, 12)}.css`
  const assets = new Map([[cssPath.slice(1), css]])
  const indexBody = `<p class="lead">Une annonce sans adresse, une étiquette difficile à lire, un diagnostic qui vient d’apparaître : choisissez le guide qui correspond à votre recherche.</p>
<ul class="guide-list">${guides.map(page => `<li><h2><a href="${page.path}">${escapeHtml(page.title)}</a></h2><p>${escapeHtml(page.description)}</p></li>`).join('\n')}</ul>`
  assets.set('guides/index.html', render(indexPage, indexBody, origin, cssPath, siteName))
  for (const page of guides) {
    const body = fs.readFileSync(new URL(page.file, contentRoot), 'utf8')
    assets.set(`${page.path.slice(1)}index.html`, render(page, body, origin, cssPath, siteName))
  }
  assets.set(
    'documentation/agents/index.html',
    render(agentPage, fs.readFileSync(new URL('agents.html', contentRoot), 'utf8'), origin, cssPath, siteName)
  )
  assets.set(capabilityPath.slice(1), `${JSON.stringify(guideCapabilities(origin), null, 2)}\n`)
  return assets
}

export function staticGuides(env) {
  return {
    name: 'static-guides',
    generateBundle() {
      for (const [fileName, source] of buildGuideAssets(env)) this.emitFile({ type: 'asset', fileName, source })
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url, 'http://localhost').pathname
        if (
          !pathname.startsWith('/guides') &&
          !pathname.startsWith('/documentation/agents') &&
          !pathname.startsWith('/assets/guides-')
        )
          return next()
        const page = publicPages.find(entry => entry.path.slice(0, -1) === pathname)
        if (page) {
          res.writeHead(301, { Location: page.path })
          res.end()
          return
        }
        const fileName = pathname.endsWith('/') ? `${pathname.slice(1)}index.html` : pathname.slice(1)
        const asset = buildGuideAssets(env).get(fileName)
        if (asset === undefined) return next()
        const type = { '.html': 'text/html', '.json': 'application/json', '.css': 'text/css' }[path.extname(fileName)]
        res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` })
        res.end(asset)
      })
    }
  }
}
