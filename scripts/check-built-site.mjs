import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { collectRuntimeData, verifyRuntimeDirectory } from './geography/runtime-data.mjs'

const dist = path.resolve('dist')
function checkHiddenFiles(directory, prefix = '') {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name
    assert(!entry.name.startsWith('.') || relative === '.htaccess', `unexpected hidden build entry: ${relative}`)
    if (entry.isDirectory()) checkHiddenFiles(path.join(directory, entry.name), `${relative}/`)
  }
}
checkHiddenFiles(dist)
const runtime = collectRuntimeData()
verifyRuntimeDirectory(dist, runtime)
assert(!existsSync(path.join(dist, 'data/departments')), 'raw geography and expired averages must not ship')
const html = readFileSync(path.join(dist, 'index.html'), 'utf8')
const manifestLinks = [...html.matchAll(/<link\b[^>]*\brel=["']manifest["'][^>]*>/g)]
assert.equal(manifestLinks.length, 1, 'exactly one web manifest link')
const href = manifestLinks[0][0].match(/href=["']([^"']+)["']/)?.[1]
assert.equal(href, '/manifest.webmanifest', 'use the plugin-generated manifest')
const manifest = JSON.parse(readFileSync(path.join(dist, 'manifest.webmanifest'), 'utf8'))
assert.equal(manifest.lang, 'fr-FR', 'installable app uses the site language')
assert.equal(manifest.start_url, '/')
assert.equal(manifest.scope, '/')
assert(!/n'importe quel|adresse exacte/i.test(manifest.description), 'manifest must not promise certain identification')
for (const size of [192, 512]) {
  const icon = manifest.icons?.find(icon => icon.sizes === `${size}x${size}` && icon.type === 'image/png')
  assert(icon, `installable app needs a ${size}px PNG icon`)
  assert(icon.src.startsWith('/') && !icon.src.includes('..'), 'icon must be a local public asset')
  assert(existsSync(path.join(dist, icon.src.slice(1))), `missing manifest icon: ${icon.src}`)
}
assert(!existsSync(path.join(dist, 'stats.html')), 'bundle report must not ship')
const sw = readFileSync(path.join(dist, 'sw.js'), 'utf8')
assert(!sw.includes('stats.html'), 'bundle report must not be precached')
assert(!sw.includes('commune-name-departments.json-'), 'name directory must load on demand, not via precache')
assert(!sw.includes('communes-dept-'), 'geography shards must load on demand, not via precache')
assert(!html.includes('commune-name-departments.json-'), 'name directory must not be preloaded by the homepage')
assert(!html.includes('href="/manifest.json"'), 'no missing manifest reference')
assert.equal(readFileSync(path.join(dist, '.htaccess'), 'utf8'), readFileSync('public/.htaccess', 'utf8'))
assert(!readFileSync('public/.htaccess', 'utf8').includes('^.*$'), 'no catch-all HTML fallback')
process.stdout.write(
  'Built-site checks passed: manifest, report exclusion, service-worker exclusion and routing-file inclusion.\n'
)
process.stdout.write('These are static artifact checks, not Apache/OVH behavior or browser QA.\n')
