import { createServer } from 'node:http'
import path from 'node:path'
import { readRelease } from './artifacts.mjs'

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
}

// A pure handler enables unit validation without binding a socket or launching a browser.
export function createReleaseHandler({ baseline, candidate }) {
  let release = baseline
  let phase = 'baseline'
  let offline = false
  let sequence = 0
  const requests = []
  function handle(req, res) {
    if (offline) return req.socket.destroy()
    const url = new URL(req.url, 'http://127.0.0.1')
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405).end()
      return
    }
    const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
    const send = (status, body, type = 'text/plain; charset=utf-8') => {
      res.writeHead(status, { ...headers, 'content-type': type })
      res.end(req.method === 'HEAD' ? undefined : body)
    }
    if (url.pathname === '/__pwa_probe__.html') {
      send(200, '<!doctype html><title>PWA lifecycle observer</title><p>Test observer</p>', types['.html'])
      return
    }
    if (url.pathname === '/api/dpe-results') {
      sequence += 1
      send(
        200,
        JSON.stringify({ marker: 'SYNTHETIC-PWA-RESULT', sequence, results: [{ numero_dpe: 'PWA-ONLY' }] }),
        types['.json']
      )
      return
    }
    const filename = url.pathname === '/' ? 'index.html' : url.pathname.slice(1)
    // Serve exact built files only. No SPA fallback here: fallback assertions must
    // be satisfied by the real worker, never by the fixture server.
    const file = release.files.get(filename)
    requests.push({ phase, pathname: url.pathname, sha256: file?.sha256 ?? null })
    if (!file || filename.split('/').some(part => part.startsWith('.'))) {
      send(404, 'fixture: file not found')
      return
    }
    send(200, file.bytes, types[path.extname(filename)] || 'application/octet-stream')
  }
  return {
    handle,
    requests,
    promote() {
      release = candidate
      phase = 'candidate'
    },
    setOffline(value) {
      offline = value
    }
  }
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  return `http://127.0.0.1:${server.address().port}`
}

async function close(server) {
  server.closeAllConnections()
  await new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve())))
}

export async function startReleaseFixture(baselineDir, candidateDir) {
  const [baseline, candidate] = await Promise.all([readRelease(baselineDir), readRelease(candidateDir)])
  if (baseline.descriptor.swSha256 === candidate.descriptor.swSha256)
    throw new Error('Identical workers cannot test upgrade')
  if (baseline.descriptor.moduleUrl === candidate.descriptor.moduleUrl)
    throw new Error('Distinct app entry assets required')
  const state = createReleaseHandler({ baseline, candidate })
  const server = createServer(state.handle)
  // Defense in depth: even a worker-owned request that Playwright cannot route
  // cannot contact ADEME, a production host, or any other external destination.
  const denied = []
  const denyProxy = createServer((req, res) => {
    denied.push(req.url)
    res.writeHead(502).end('External network disabled in PWA fixture')
  })
  denyProxy.on('connect', (req, socket) => {
    denied.push(req.url)
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
  })
  const origin = await listen(server)
  try {
    const proxy = await listen(denyProxy)
    return {
      ...state,
      origin,
      proxy,
      denied,
      baseline: baseline.descriptor,
      candidate: candidate.descriptor,
      async close() {
        await Promise.all([close(server), close(denyProxy)])
      }
    }
  } catch (error) {
    await close(server)
    throw error
  }
}
