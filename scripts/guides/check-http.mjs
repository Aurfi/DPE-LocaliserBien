import assert from 'node:assert/strict'
import { preview } from 'vite'
import { capabilityPath, publicPages } from './generate.mjs'

// Real HTTP against the built candidate, without a browser or service worker.
const server = await preview({ preview: { host: '127.0.0.1', port: 4187, strictPort: true } })
try {
  for (const page of publicPages) {
    const response = await fetch(`http://127.0.0.1:4187${page.path}`)
    assert.equal(response.status, 200, page.path)
    assert(response.headers.get('content-type').includes('text/html'))
    const html = await response.text()
    assert(html.includes(`<h1>${page.title}</h1>`), page.path)
    assert(html.includes(`rel="canonical" href="https://localiserbien.fr${page.path}"`))
    assert(!/<script(?! type="application\/ld\+json")/i.test(html))
  }
  const response = await fetch(`http://127.0.0.1:4187${capabilityPath}`)
  assert.equal(response.status, 200)
  assert(response.headers.get('content-type').includes('application/json'))
  const json = await response.json()
  assert.deepEqual(json.interface, {
    type: 'browser',
    javascript_required_for_search: true,
    search_api: null,
    mcp_server: null
  })
  process.stdout.write('Six built endpoints passed real HTTP checks. No browser rendering was exercised.\n')
} finally {
  server.httpServer.closeAllConnections()
  await new Promise(resolve => server.httpServer.close(resolve))
}
