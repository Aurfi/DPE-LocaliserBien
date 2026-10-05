import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { capabilityPath, publicPages } from './generate.mjs'

export function verifyGuideBuild(directory) {
  const sitemap = fs.readFileSync(path.join(directory, 'sitemap.xml'), 'utf8')
  const robots = fs.readFileSync(path.join(directory, 'robots.txt'), 'utf8')
  const sw = fs.readFileSync(path.join(directory, 'sw.js'), 'utf8')
  const homepage = fs.readFileSync(path.join(directory, 'index.html'), 'utf8')
  assert(!/guides\/|documentation\/|assets\/guides-/.test(sw), 'guide resources must not enter the PWA precache')
  assert(!homepage.includes('/assets/guides-'), 'guide CSS must not load on the homepage')
  assert(!sitemap.includes('{{') && !robots.includes('{{'), 'generated templates must have no placeholders')
  for (const page of publicPages) {
    const html = fs.readFileSync(path.join(directory, page.path.slice(1), 'index.html'), 'utf8')
    const canonical = html.match(/rel="canonical" href="([^"]+)"/)[1]
    assert(sitemap.includes(`<loc>${canonical}</loc>`), page.path)
    assert(html.includes('<h1>'), `missing readable article: ${page.path}`)
    assert(!/<script(?! type="application\/ld\+json")/i.test(html), 'no runtime JS in guide documents')
    assert(!/gratuit(?:ement)?|sans\s+compte/i.test(html), 'no removed marketing claims in new guides')
    const css = html.match(/rel="stylesheet" href="([^"]+)"/)[1]
    assert(fs.existsSync(path.join(directory, css.slice(1))))
  }
  const json = JSON.parse(fs.readFileSync(path.join(directory, capabilityPath.slice(1)), 'utf8'))
  assert.equal(json.interface.type, 'browser')
  assert.equal(json.interface.search_api, null)
  assert.equal(json.interface.mcp_server, null)
}
