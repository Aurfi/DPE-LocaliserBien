import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { expectedCacheEntries, parsePrecache, readRelease, sha256 } from './artifacts.mjs'
import { createReleaseHandler } from './fixture.mjs'
import { assertFixtureIdentity, parseFileManifest, verifyBaseline } from './provenance.mjs'

const worker = entries => `define([],function(e){e.precacheAndRoute(${JSON.stringify(entries)},{})})`
const index = revision => `<script type="module" crossorigin src="/assets/index-${revision}.js"></script>`
function release(version) {
  return {
    files: new Map([
      ['index.html', { bytes: index(version), sha256: sha256(index(version)) }],
      ['sw.js', { bytes: `worker-${version}`, sha256: sha256(`worker-${version}`) }],
      [`.secret`, { bytes: 'must not serve', sha256: 'secret' }]
    ])
  }
}
function request(handle, url, method = 'GET') {
  const observed = {}
  handle(
    {
      url,
      method,
      socket: {
        destroy() {
          observed.offline = true
        }
      }
    },
    {
      writeHead(status, headers) {
        Object.assign(observed, { status, headers })
        return this
      },
      end(body) {
        observed.body = body
      }
    }
  )
  return observed
}

test('precache parser accepts generated data without executing JavaScript', () => {
  assert.deepEqual(
    parsePrecache('e.precacheAndRoute([{url:"index.html",revision:"abc"},{url:"assets/a.js",revision:null}],{})'),
    [
      { url: 'index.html', revision: 'abc' },
      { url: 'assets/a.js', revision: null }
    ]
  )
  for (const url of ['../private', '/api/results', 'https://example.test/a', 'a?query=results', 'a//b']) {
    assert.throws(() =>
      parsePrecache(
        worker([
          { url: 'index.html', revision: 'a' },
          { url, revision: null }
        ])
      )
    )
  }
  assert.throws(() =>
    parsePrecache(
      worker([
        { url: 'index.html', revision: 'a' },
        { url: 'index.html', revision: 'b' }
      ])
    )
  )
  assert.throws(() => parsePrecache('e.precacheAndRoute([process.exit()],{})'))
  assert.throws(() => parsePrecache(worker([{ url: 'assets/a.js', revision: null }])))
})

test('cache keys preserve revision semantics and content digests', () => {
  assert.deepEqual(
    expectedCacheEntries(
      {
        precache: [
          { url: 'index.html', revision: 'abc', sha256: 'one' },
          { url: 'assets/a.js', revision: null, sha256: 'two' }
        ]
      },
      'http://127.0.0.1:1234'
    ),
    [
      { url: 'http://127.0.0.1:1234/assets/a.js', sha256: 'two' },
      { url: 'http://127.0.0.1:1234/index.html?__WB_REVISION__=abc', sha256: 'one' }
    ]
  )
})

test('server promotes actual worker bytes and index together, with no HTTP cache', () => {
  const fixture = createReleaseHandler({ baseline: release('old'), candidate: release('new') })
  assert.equal(request(fixture.handle, '/sw.js').body, 'worker-old')
  assert.equal(request(fixture.handle, '/').body, index('old'))
  fixture.promote()
  assert.equal(request(fixture.handle, '/sw.js?cache-bust=1').body, 'worker-new')
  const result = request(fixture.handle, '/')
  assert.equal(result.body, index('new'))
  assert.equal(result.headers['cache-control'], 'no-store')
  assert.equal(fixture.requests.at(-1).phase, 'candidate')
  assert.equal(fixture.requests.at(-1).sha256, sha256(index('new')))
})

test('server cannot impersonate worker navigation fallback or expose source/control endpoints', () => {
  const fixture = createReleaseHandler({ baseline: release('old'), candidate: release('new') })
  for (const url of ['/informations', '/private/results', '/assets/missing.js', '/.secret', '/../.env', '/__promote']) {
    assert.equal(request(fixture.handle, url).status, 404)
  }
  assert.equal(request(fixture.handle, '/sw.js', 'POST').status, 405)
  assert.equal(request(fixture.handle, '/sw.js', 'HEAD').body, undefined)
  assert.equal(request(fixture.handle, '/__pwa_probe__.html').headers['content-type'], 'text/html; charset=utf-8')
})

test('API fixtures are fresh, synthetic, and transport fails when offline', () => {
  const fixture = createReleaseHandler({ baseline: release('old'), candidate: release('new') })
  for (const sequence of [1, 2]) {
    const result = request(fixture.handle, '/api/dpe-results?criteria=pwa-only')
    assert.equal(JSON.parse(result.body).sequence, sequence)
    assert.equal(JSON.parse(result.body).marker, 'SYNTHETIC-PWA-RESULT')
  }
  fixture.setOffline(true)
  assert.deepEqual(request(fixture.handle, '/api/dpe-results'), { offline: true })
  assert.deepEqual(request(fixture.handle, '/index.html'), { offline: true })
})

test('real build descriptor verifies files and rejects missing assets and symlinks', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'pwa-unit-'))
  try {
    await mkdir(path.join(directory, 'assets'))
    await writeFile(path.join(directory, 'index.html'), index('new'))
    await writeFile(path.join(directory, 'assets/index-new.js'), 'app')
    await writeFile(
      path.join(directory, 'sw.js'),
      worker([
        { url: 'index.html', revision: 'ab' },
        { url: 'assets/index-new.js', revision: null }
      ])
    )
    const result = await readRelease(directory)
    assert.equal(result.descriptor.moduleUrl, '/assets/index-new.js')
    assert.equal(result.descriptor.precache[1].sha256, sha256('app'))
    await writeFile(path.join(directory, 'sw.js'), worker([{ url: 'index.html', revision: 'ab' }]))
    await assert.rejects(readRelease(directory), /entry module is not precached/)
    await writeFile(
      path.join(directory, 'sw.js'),
      worker([
        { url: 'index.html', revision: 'ab' },
        { url: 'assets/index-new.js', revision: null }
      ])
    )
    await symlink('index-new.js', path.join(directory, 'assets/link.js'))
    await assert.rejects(readRelease(directory), /symlink forbidden/)
    await rm(path.join(directory, 'assets/link.js'))
    await rm(path.join(directory, 'assets/index-new.js'))
    await assert.rejects(readRelease(directory), /Missing built entry module/)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('immutable fixture manifests reject traversal, duplicates, unsorted paths and edited bytes', () => {
  const digest = sha256('fixture')
  for (const text of [
    `${digest}  ../escape\n`,
    `${digest}  /escape\n`,
    `${digest}  a\n${digest}  a\n`,
    `${digest}  z\n${digest}  a\n`,
    `${digest}  a`
  ]) {
    assert.throws(() => parseFileManifest(text))
  }
  const text = `${digest}  index.html\n${digest}  sw.js\n`
  const pin = {
    originalManifestSha256: sha256(text),
    fixtureManifestSha256: sha256(text),
    indexSha256: digest,
    swSha256: digest
  }
  const descriptor = { files: parseFileManifest(text), indexSha256: digest, swSha256: digest }
  assert.doesNotThrow(() => assertFixtureIdentity(pin, text, text, descriptor))
  assert.throws(() => assertFixtureIdentity(pin, text.replace('index', 'other'), text, descriptor), /reviewed pins/)
  assert.throws(() => assertFixtureIdentity(pin, text, text, { ...descriptor, files: [] }), /inventory changed/)
  assert.throws(
    () =>
      assertFixtureIdentity(pin, text, text, {
        ...descriptor,
        files: [...descriptor.files, { file: '.hidden', sha256: digest }]
      }),
    /inventory changed/
  )
  assert.throws(
    () =>
      assertFixtureIdentity(pin, text, text, {
        ...descriptor,
        files: [{ file: 'index.html', sha256: 'edited' }, descriptor.files[1]]
      }),
    /inventory changed/
  )
  assert.throws(
    () => assertFixtureIdentity(pin, text, text, { ...descriptor, swSha256: 'edited' }),
    /worker identity changed/
  )
  const other = text.replace(digest, sha256('different'))
  assert.throws(
    () => assertFixtureIdentity({ ...pin, fixtureManifestSha256: sha256(other) }, text, other, descriptor),
    /exact subset/
  )
})

test('retained actual baseline verifies completely without installing or building its old toolchain', async () => {
  const baseline = await verifyBaseline()
  assert.equal(baseline.release.files.size, 20)
  assert.equal(baseline.release.descriptor.precache.length, 15)
  assert.equal(baseline.pin.indexSha256, 'e1d790d4df3dddfaa97b9ef822fd41a162ffa6c3927d8801c7b50de4d90b389e')
  assert.equal(baseline.pin.originalManifestSha256, '6d240822975f7602c7286311f1026e4ec368e3fc23286517d10b6c399639c94f')
})
