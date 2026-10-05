import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { Window } from 'happy-dom'
import { createServer } from 'vite'
import { escapeHtml, htmlEnvironmentDefines, requiredHtmlEnvironment, serializeJsonLd } from './environment.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const template = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
const baseline = JSON.parse(readFileSync(new URL('./fixtures/baseline-seo.json', import.meta.url), 'utf8'))
// Keep the historical production capture immutable. Current descriptions remove
// only the separately reviewed service-marketing claim.
const currentEnvironment = { ...baseline.environment }
for (const key of ['VITE_APP_DESCRIPTION', 'VITE_OG_DESCRIPTION', 'VITE_TWITTER_DESCRIPTION']) {
  currentEnvironment[key] = currentEnvironment[key].replace('gratuitement ', '')
}

function parseHtml(html) {
  const window = new Window({
    settings: {
      enableJavaScriptEvaluation: false,
      disableCSSFileLoading: true,
      disableJavaScriptFileLoading: true
    }
  })
  return { window, document: new window.DOMParser().parseFromString(html, 'text/html') }
}

async function nativeHtml(env) {
  // Exercise Vite's real native HTML substitution without a build, browser,
  // listening HTTP server, application plugins or dependency optimization.
  const server = await createServer({
    root,
    configFile: false,
    envFile: false,
    publicDir: false,
    logLevel: 'silent',
    define: htmlEnvironmentDefines(env),
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] }
  })
  try {
    return await server.transformIndexHtml('/index.html', template)
  } finally {
    await server.close()
  }
}

function structuredData(document) {
  return [...document.querySelectorAll('script[type="application/ld+json"]')].map(script =>
    JSON.parse(script.textContent)
  )
}

const special = 'L\'été "a & b" <ici> > là \\ une ligne\nsuivante\u2028suite\u2029fin'

test('HTML text and both attribute quote styles round-trip special characters', async () => {
  const escaped = escapeHtml(special)
  assert.equal(escapeHtml('&<>"\''), '&amp;&lt;&gt;&quot;&#39;')
  const { window, document } = parseHtml(`<p title="${escaped}" data-value='${escaped}'>${escaped}</p>`)
  try {
    const paragraph = document.querySelector('p')
    assert.equal(paragraph.textContent, special)
    assert.equal(paragraph.getAttribute('title'), special)
    assert.equal(paragraph.getAttribute('data-value'), special)
    assert.equal(paragraph.children.length, 0)
  } finally {
    await window.happyDOM.close()
  }
})

test('JSON-LD serialization preserves raw values and uses script-safe JSON escapes', () => {
  const serialized = serializeJsonLd(special)
  assert.equal(JSON.parse(serialized), special)
  assert.doesNotMatch(serialized, /[<>&\u2028\u2029]/)
  assert.match(serialized, /\\u003c/)
  assert.match(serialized, /\\u0026/)
  assert.doesNotMatch(serialized, /&#39;|&quot;/)
})

for (const key of requiredHtmlEnvironment) {
  test(`rejects missing, blank and non-string ${key} with a clear variable-only error`, () => {
    for (const value of [undefined, null, '', ' \t\n', 42]) {
      assert.throws(
        () => htmlEnvironmentDefines({ ...baseline.environment, [key]: value }),
        error => error.message === `HTML environment requires non-empty values for: ${key}`
      )
    }
  })
}

test('reports all missing HTML environment values together', () => {
  assert.throws(
    () => htmlEnvironmentDefines({}),
    error => error.message === `HTML environment requires non-empty values for: ${requiredHtmlEnvironment.join(', ')}`
  )
})

test('HTML aliases never replace or mutate the original application/PWA environment', () => {
  const env = Object.freeze({ ...baseline.environment, VITE_SITE_NAME: special, VITE_UNRELATED: 'unchanged' })
  const original = { ...env }
  const originalProcessEnv = { ...process.env }
  const defines = htmlEnvironmentDefines(env)
  assert.deepEqual(env, original)
  assert.deepEqual({ ...process.env }, originalProcessEnv)
  assert(Object.keys(defines).every(key => key.startsWith('import.meta.env.VITE_HTML_')))
  for (const key of Object.keys(env)) assert.equal(defines[`import.meta.env.${key}`], undefined)
  assert.equal(env.VITE_SITE_NAME, special)
})

test('every native HTML placeholder has a context-specific alias and no EJS remains', () => {
  const defines = htmlEnvironmentDefines(baseline.environment)
  const placeholders = [...template.matchAll(/%(VITE_[A-Z_]+)%/g)]
  assert(placeholders.length > 0)
  for (const [, key] of placeholders) assert(Object.hasOwn(defines, `import.meta.env.${key}`), key)
  assert.doesNotMatch(template, /<%/)
  assert.equal((template.match(/type="application\/ld\+json"/g) || []).length, 6)
})

test('native Vite output preserves unrelated SEO fields while removing reviewed marketing claims', async () => {
  const html = await nativeHtml(currentEnvironment)
  assert.doesNotMatch(html, /%VITE_[A-Z_]+%|<%/)
  const { window, document } = parseHtml(html)
  try {
    assert.equal(document.title, baseline.title)
    assert.equal(document.querySelector('link[rel="canonical"]').getAttribute('href'), baseline.canonical)
    for (const { attribute, key, content } of baseline.metadata) {
      const expectedContent = ['description', 'og:description', 'twitter:description'].includes(key)
        ? content.replace('gratuitement ', '')
        : content
      assert.equal(document.querySelector(`meta[${attribute}="${key}"]`)?.getAttribute('content'), expectedContent, key)
    }
    const expected = structuredClone(baseline.structuredData)
    assert.equal(expected.length, 6)
    // The old HTML-escaped EJS values were not decoded inside script raw text.
    // Correct serialization plus the explicitly reviewed copy-only differences.
    // Every unrelated field stays identical to the frozen production output.
    for (const schema of expected.slice(0, 2)) {
      assert.match(schema.description, /l&#39;identification/)
      schema.description = currentEnvironment.VITE_APP_DESCRIPTION
    }
    const faq = expected.find(schema => schema['@type'] === 'FAQPage')
    assert.match(faq.mainEntity[0].acceptedAnswer.text, /localiser précisément/)
    faq.mainEntity[0].acceptedAnswer.text =
      'LocaliserBien compare les critères d’une annonce aux données DPE publiques de l’ADEME. Saisissez la commune, la surface et la consommation ou une classe DPE, puis consultez les correspondances proposées.'
    const organization = expected.find(schema => schema['@type'] === 'Organization')
    organization.description = organization.description.replace('gratuit ', '')
    const previousQuestions = faq.mainEntity.length
    faq.mainEntity = faq.mainEntity.filter(question => question.name !== 'Le service est-il gratuit ?')
    assert.equal(faq.mainEntity.length, previousQuestions - 1)
    for (const type of ['WebApplication', 'Service']) {
      const schema = expected.find(item => item['@type'] === type)
      assert.equal(schema.offers.price, '0')
      delete schema.offers
    }
    assert.deepEqual(structuredData(document), expected)
    assert.doesNotMatch(html, /\bgratuit\w*|\bsans[\s,;:-]+(?:compte|inscription|abonnement)\b|\bfree\b/i)
  } finally {
    await window.happyDOM.close()
  }
})

test('native Vite output preserves special characters in metadata and JSON-LD', async () => {
  const env = Object.fromEntries(requiredHtmlEnvironment.map(key => [key, special]))
  const html = await nativeHtml(env)
  const { window, document } = parseHtml(html)
  try {
    assert.equal(document.querySelector('title').textContent, special)
    for (const { attribute, key } of baseline.metadata.filter(meta =>
      [
        'title',
        'description',
        'keywords',
        'author',
        'og:site_name',
        'og:title',
        'og:description',
        'twitter:title',
        'twitter:description',
        'apple-mobile-web-app-title',
        'application-name'
      ].includes(meta.key)
    )) {
      assert.equal(document.querySelector(`meta[${attribute}="${key}"]`).getAttribute('content'), special, key)
    }
    assert.equal(document.querySelector('link[rel="canonical"]').getAttribute('href'), `${special}/`)
    assert.equal(document.querySelector('meta[property="og:image"]').getAttribute('content'), `${special}/og-image.png`)
    const schemas = structuredData(document)
    assert.equal(schemas.length, 6)
    assert.equal(schemas[0].name, special)
    assert.equal(schemas[0].description, special)
    assert.equal(schemas[0].author.name, special)
    assert.equal(schemas[1].name, special)
    assert.equal(schemas[1].description, special)
    assert.equal(schemas[1].potentialAction.target.urlTemplate, `${special}/?search={search_term_string}`)
    assert.equal(schemas[2]['@id'], `${special}/#organization`)
    assert.equal(schemas[2].logo.url, `${special}/android-chrome-512x512.png`)
    assert.equal(schemas[3].itemListElement[0].item, special)
    assert.equal(schemas[5].provider.name, special)
    assert.equal(schemas[5].provider.url, special)
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      assert.doesNotMatch(script.textContent, /[<>]/)
    }
  } finally {
    await window.happyDOM.close()
  }
})

test('native substitution does not recursively interpret percent placeholders inside values', async () => {
  const value = 'Literal %VITE_HTML_SITE_NAME% and 100% original'
  const html = await nativeHtml({ ...baseline.environment, VITE_APP_TITLE: value })
  const { window, document } = parseHtml(html)
  try {
    assert.equal(document.title, value)
    assert.equal(document.querySelector('meta[name="title"]').getAttribute('content'), value)
  } finally {
    await window.happyDOM.close()
  }
})
