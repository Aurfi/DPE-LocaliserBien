import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { buildGuideAssets, capabilityPath, guideSitemapEntries, publicPages } from '../guides/generate.mjs'

const env = { VITE_SITE_URL: 'https://localiserbien.fr', VITE_SITE_NAME: 'LocaliserBien' }
const assets = buildGuideAssets(env)
const robots = fs.readFileSync(new URL('../../public/robots.txt.template', import.meta.url), 'utf8')

// RFC-style longest matching rule, including query strings. A first-match
// parser cannot verify the exact public-path exceptions in this policy.
function allowed(agent, url) {
  const groups = []
  let group = null
  for (const raw of robots.split('\n')) {
    const line = raw.split('#')[0].trim()
    if (!line) continue
    const colon = line.indexOf(':')
    const field = line.slice(0, colon).toLowerCase()
    const value = line.slice(colon + 1).trim()
    if (field === 'user-agent') {
      if (!group || group.rules.length) {
        group = { agents: [], rules: [] }
        groups.push(group)
      }
      group.agents.push(value.toLowerCase())
    } else if (group && ['allow', 'disallow'].includes(field)) group.rules.push({ field, value })
  }
  const specific = groups.filter(group => group.agents.includes(agent.toLowerCase()))
  const selected = specific.length ? specific : groups.filter(group => group.agents.includes('*'))
  const matches = selected
    .flatMap(group => group.rules)
    .filter(rule => {
      const pattern = rule.value.replace(/[.+?^{}()|[\]\\]/g, '\\$&').replaceAll('*', '.*')
      return new RegExp(`^${pattern}`).test(url)
    })
    .sort((a, b) => b.value.length - a.value.length || (a.field === 'allow' ? -1 : 1))
  return !matches.length || matches[0].field === 'allow'
}

test('guides have unique metadata, truthful structured data and readable static bodies', () => {
  const titles = new Set()
  const descriptions = new Set()
  for (const page of publicPages) {
    const html = assets.get(`${page.path.slice(1)}index.html`)
    assert(html?.startsWith('<!doctype html>'))
    assert.equal((html.match(/<h1>/g) || []).length, 1)
    const title = html.match(/<title>(.*?)<\/title>/s)[1]
    const description = html.match(/name="description" content="([^"]+)"/)[1]
    assert(!titles.has(title))
    titles.add(title)
    assert(!descriptions.has(description))
    descriptions.add(description)
    assert(html.includes(`rel="canonical" href="${env.VITE_SITE_URL + page.path}"`))
    assert(html.includes('name="robots" content="index, follow"'))
    assert(!/<script(?! type="application\/ld\+json")/i.test(html))
    assert(!/modulepreload|iframe|<form\b/.test(html))
    const structured = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])
    assert.equal(structured.name, page.title)
    assert.equal(structured.url, env.VITE_SITE_URL + page.path)
    assert.equal(structured.dateModified, page.updated)
    assert(html.includes('<a href="/">Revenir à la recherche</a>'))
    assert(!/gratuit(?:ement)?|sans\s+compte|100\s*%/i.test(html))
  }
})

test('all local document links resolve to known application routes or real assets', () => {
  const appPaths = new Set(['/', '/informations', '/mentions-legales'])
  for (const [name, html] of assets) {
    if (!name.endsWith('.html')) continue
    for (const [, href] of html.matchAll(/href="(\/[^"#]*)(?:#[^"]*)?"/g)) {
      const file = href.endsWith('/') ? `${href.slice(1)}index.html` : href.slice(1)
      assert(
        appPaths.has(href) || assets.has(file) || fs.existsSync(new URL(`../../public/${file}`, import.meta.url)),
        `${name}: ${href}`
      )
    }
  }
})

test('capability JSON documents the browser rather than inventing an API', () => {
  const json = JSON.parse(assets.get(capabilityPath.slice(1)))
  assert.deepEqual(json.interface, {
    type: 'browser',
    javascript_required_for_search: true,
    search_api: null,
    mcp_server: null
  })
  assert.equal(json.workflows.length, 2)
  assert.equal(json.guides.length, 3)
  assert(!assets.has('openapi.json'))
  assert(!assets.has('llms.txt'))
})

test('environment metadata is context-escaped and invalid origins are rejected', () => {
  const name = '</script><script>alert(1)</script>"&'
  for (const [file, html] of buildGuideAssets({ ...env, VITE_SITE_NAME: name })) {
    if (!file.endsWith('.html')) continue
    assert(!html.includes('<script>alert(1)</script>'))
    const json = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])
    assert.equal(json.isPartOf.name, name)
  }
  for (const origin of [
    'javascript:alert(1)',
    'https://user:password@example.com/',
    'https://example.com/private',
    'https://example.com/?x=1'
  ]) {
    assert.throws(() => buildGuideAssets({ ...env, VITE_SITE_URL: origin }))
  }
})

test('sitemap contains canonical documents and editorial dates, not a fake search URL', () => {
  const sitemap = guideSitemapEntries(env.VITE_SITE_URL)
  for (const page of publicPages)
    assert(sitemap.includes(`<loc>${env.VITE_SITE_URL + page.path}</loc><lastmod>${page.updated}</lastmod>`))
  assert(!sitemap.includes(capabilityPath))
  assert(
    fs.readFileSync(new URL('../../public/sitemap.xml.template', import.meta.url), 'utf8').includes('{{GUIDE_URLS}}')
  )
})

test('retrieval bots are limited to exact public documents and guide CSS', () => {
  for (const agent of [
    'OAI-SearchBot',
    'ChatGPT-User',
    'Claude-SearchBot',
    'Claude-User',
    'PerplexityBot',
    'Perplexity-User'
  ]) {
    for (const page of publicPages) assert(allowed(agent, page.path), `${agent}: ${page.path}`)
    assert(allowed(agent, capabilityPath))
    assert(allowed(agent, '/assets/guides-012345abcdef.css'))
    for (const url of [
      '/',
      '/?commune=Paris',
      '/guides/?surface=50',
      '/guides/rechercher-avec-dpe/?commune=Paris',
      `${capabilityPath}?x=1`,
      '/guides/private.json',
      '/documentation/agents/private.json',
      '/api/search',
      '/data/geography.json',
      '/assets/index.js',
      '/assets/guides-abc.css?surface=65.css',
      '/assets/guides-abc.css?x=1',
      '/search/',
      '/results/'
    ]) {
      assert(!allowed(agent, url), `${agent} must not allow ${url}`)
    }
  }
})

test('training exclusions and ordinary search privacy exclusions are preserved', () => {
  for (const agent of ['GPTBot', 'ClaudeBot', 'CCBot', 'anthropic-ai', 'Claude-Web', 'FacebookBot', 'Bytespider']) {
    for (const url of ['/', publicPages[1].path, capabilityPath, '/data/test.json'])
      assert(!allowed(agent, url), `${agent}: ${url}`)
  }
  for (const agent of ['UnspecifiedBot', 'Googlebot', 'Bingbot']) {
    for (const page of publicPages) assert(allowed(agent, page.path))
    assert(allowed(agent, capabilityPath))
    for (const url of ['/?commune=Paris', '/data/test.json', '/api/search']) assert(!allowed(agent, url))
  }
  assert(!allowed('UnspecifiedBot', '/private.json'))
})

test('documented form controls, labels and class choices exist in source', () => {
  const form = fs.readFileSync(
    new URL('../../src/components/fonctionnalites/dpe/FormulaireRechercheDPE.vue', import.meta.url),
    'utf8'
  )
  const nearby = fs.readFileSync(
    new URL('../../src/components/fonctionnalites/dpe/RechercheDPERecente.vue', import.meta.url),
    'utf8'
  )
  const tabs = fs.readFileSync(new URL('../../src/components/base/NavigationOnglets.vue', import.meta.url), 'utf8')
  for (const label of ['Commune', 'Surface', 'Consommation énergétique']) assert(form.includes(label), label)
  for (const id of ['search-commune', 'search-surface', 'search-consommation', 'search-ges'])
    assert(form.includes(`id="${id}"`), id)
  for (const id of ['nearby-address', 'nearby-monthsBack', 'nearby-radius']) assert(nearby.includes(`id="${id}"`), id)
  for (const flow of JSON.parse(assets.get(capabilityPath.slice(1))).workflows)
    assert(tabs.includes(`label: '${flow.name}'`), flow.name)
  assert(/Classe énergétique \$\{classe\}/.test(form))
  assert(/Classe GES \$\{classe\}/.test(form))
  assert(form.includes("['A', 'B', 'C', 'D', 'E', 'F', 'G']"))
  assert(form.includes('Rechercher un appartement'))
})
