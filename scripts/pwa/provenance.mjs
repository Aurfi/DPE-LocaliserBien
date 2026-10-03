import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readRelease, sha256 } from './artifacts.mjs'

export const baselineIds = ['earlier-candidate-7fe6a35', 'public-production-2026-10-03']

export function parseFileManifest(text) {
  if (!text.endsWith('\n')) throw new Error('Manifest must end in LF')
  const entries = text
    .slice(0, -1)
    .split('\n')
    .map(line => {
      const match = line.match(/^([a-f0-9]{64}) {2}([a-zA-Z0-9_./-]+)$/)
      if (
        !match ||
        match[2].startsWith('/') ||
        match[2].split('/').some(part => !part || part === '.' || part === '..')
      ) {
        throw new Error('Invalid manifest line or path')
      }
      return { file: match[2], sha256: match[1] }
    })
  const names = entries.map(entry => entry.file)
  if (new Set(names).size !== names.length || names.join('\n') !== [...names].sort().join('\n')) {
    throw new Error('Manifest must have unique sorted paths')
  }
  return entries
}

export function assertFixtureIdentity(pin, originalText, fixtureText, descriptor) {
  if (sha256(originalText) !== pin.originalManifestSha256 || sha256(fixtureText) !== pin.fixtureManifestSha256) {
    throw new Error('Artifact manifests do not match reviewed pins')
  }
  const original = new Map(parseFileManifest(originalText).map(entry => [entry.file, entry.sha256]))
  const fixture = parseFileManifest(fixtureText)
  for (const entry of fixture) {
    if (original.get(entry.file) !== entry.sha256)
      throw new Error('Fixture is not an exact subset of the original artifact')
  }
  const actual = new Map(descriptor.files.map(entry => [entry.file, entry.sha256]))
  if (actual.size !== fixture.length || fixture.some(entry => actual.get(entry.file) !== entry.sha256)) {
    throw new Error('Fixture bytes or file inventory changed')
  }
  if (descriptor.indexSha256 !== pin.indexSha256 || descriptor.swSha256 !== pin.swSha256) {
    throw new Error('Historical index or worker identity changed')
  }
}

export async function verifyBaseline(id = baselineIds[0]) {
  if (id === baselineIds[1]) return verifyProductionBaseline()
  if (id !== baselineIds[0]) throw new Error('Unknown baseline identifier')
  const pin = JSON.parse(await readFile(new URL('./baseline.json', import.meta.url), 'utf8'))
  const directory = path.resolve(pin.directory)
  const [originalText, fixtureText, provenance, release] = await Promise.all([
    readFile(path.join(directory, 'original-artifact.sha256'), 'utf8'),
    readFile(path.join(directory, 'fixture.sha256'), 'utf8'),
    readFile(path.join(directory, 'provenance.json'), 'utf8').then(JSON.parse),
    readRelease(path.join(directory, 'static'), { includeHidden: true })
  ])
  assertFixtureIdentity(pin, originalText, fixtureText, release.descriptor)
  if (
    provenance.sourceRevision !== pin.sourceRevision ||
    provenance.originalArtifact.manifestSha256 !== pin.originalManifestSha256 ||
    provenance.fixture.manifestSha256 !== pin.fixtureManifestSha256 ||
    provenance.originalArtifact.files !== parseFileManifest(originalText).length ||
    provenance.fixture.files !== release.files.size ||
    provenance.fixture.bytes !== [...release.files.values()].reduce((sum, file) => sum + file.bytes.length, 0) ||
    provenance.fixture.precacheEntries !== release.descriptor.precache.length
  ) {
    throw new Error('Fixture provenance disagrees with verified artifact')
  }
  return { pin, provenance, release, directory: path.join(directory, 'static') }
}

// Validate metadata as inert JSON; no captured source is ever executed in Node.
export function assertPublicCapture(pin, http, descriptor) {
  const inventory = new Map(descriptor.files.map(entry => [entry.file, entry.sha256]))
  const captures = http.requests.filter(request => request.phase === 'capture' && request.status === 200)
  const stable = http.requests.filter(request => request.phase === 'end-stability')
  if (
    http.origin !== pin.origin ||
    captures.length !== inventory.size ||
    new Set(captures.map(request => request.file)).size !== inventory.size ||
    http.requests[0]?.startedAt !== pin.captureStartedAt ||
    http.requests.at(-1)?.completedAt !== pin.captureCompletedAt ||
    stable.length !== 2 ||
    !['index.html', 'sw.js'].every(file => stable.some(request => request.file === file))
  ) {
    throw new Error('Public capture inventory or stability window disagrees')
  }
  for (const request of http.requests) {
    const expectedUrl = new URL(request.file, `${pin.origin}/`).href
    if (
      request.requestedUrl !== expectedUrl ||
      request.effectiveUrl !== expectedUrl ||
      request.effectiveOrigin !== pin.origin ||
      request.tlsVerified !== true ||
      !Number.isFinite(request.durationSeconds) ||
      request.durationSeconds < 0 ||
      request.durationSeconds > 30 ||
      !Number.isFinite(Date.parse(request.startedAt)) ||
      !Number.isFinite(Date.parse(request.completedAt)) ||
      request.startedAt > request.completedAt ||
      request.startedAt < pin.captureStartedAt ||
      request.completedAt > pin.captureCompletedAt
    ) {
      throw new Error('Public capture request origin, TLS, time or duration disagrees')
    }
    if (request.status === 404 && request.file === 'manifest.json' && request.phase === 'capture') continue
    if (
      request.status !== 200 ||
      !['capture', 'end-stability'].includes(request.phase) ||
      inventory.get(request.file) !== request.sha256
    ) {
      throw new Error('Public capture response does not match retained bytes')
    }
  }
}

async function verifyProductionBaseline() {
  const pin = JSON.parse(await readFile(new URL('./production-baseline.json', import.meta.url), 'utf8'))
  const directory = path.resolve(pin.directory)
  const [captureText, fixtureText, httpText, provenance, release] = await Promise.all([
    readFile(path.join(directory, 'capture.sha256'), 'utf8'),
    readFile(path.join(directory, 'fixture.sha256'), 'utf8'),
    readFile(path.join(directory, 'http-capture.json'), 'utf8'),
    readFile(path.join(directory, 'provenance.json'), 'utf8').then(JSON.parse),
    readRelease(path.join(directory, 'static'), { includeHidden: true })
  ])
  assertFixtureIdentity(
    { ...pin, originalManifestSha256: pin.captureManifestSha256 },
    captureText,
    fixtureText,
    release.descriptor
  )
  if (sha256(httpText) !== pin.httpEvidenceSha256) throw new Error('Public HTTP evidence changed')
  const http = JSON.parse(httpText)
  assertPublicCapture(pin, http, release.descriptor)
  for (const request of http.requests.filter(request => request.status === 200)) {
    const bytes = release.files.get(request.file).bytes
    if (request.bytes !== bytes.length || request.md5 !== createHash('md5').update(bytes).digest('hex')) {
      throw new Error('Public HTTP size or MD5 disagrees with captured bytes')
    }
  }
  const capture = provenance.publicCapture
  const totalBytes = [...release.files.values()].reduce((sum, file) => sum + file.bytes.length, 0)
  if (
    pin.sourceRevision !== null ||
    provenance.sourceRevision !== null ||
    capture.origin !== pin.origin ||
    capture.startedAt !== pin.captureStartedAt ||
    capture.completedAt !== pin.captureCompletedAt ||
    capture.manifestSha256 !== pin.captureManifestSha256 ||
    capture.httpEvidenceSha256 !== pin.httpEvidenceSha256 ||
    capture.indexAndWorkerStable !== true ||
    capture.matchedMd5Revisions !== release.descriptor.precache.filter(entry => entry.revision !== null).length ||
    capture.files !== release.files.size ||
    capture.bytes !== totalBytes ||
    provenance.fixture.manifestSha256 !== pin.fixtureManifestSha256 ||
    provenance.fixture.files !== release.files.size ||
    provenance.fixture.bytes !== totalBytes ||
    provenance.fixture.precacheEntries !== release.descriptor.precache.length
  ) {
    throw new Error('Public capture provenance disagrees with verified artifact')
  }
  return { pin, provenance, release, directory: path.join(directory, 'static') }
}

async function main(command) {
  const baselines = await Promise.all(baselineIds.map(id => verifyBaseline(id)))
  if (command === 'verify') return
  if (command !== 'record') throw new Error('Use: node scripts/pwa/provenance.mjs verify|record')
  const candidate = await readRelease('dist')
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  if (process.env.GITHUB_SHA && process.env.GITHUB_SHA !== commit)
    throw new Error('Checkout is not the workflow candidate SHA')
  await mkdir('reports/pwa', { recursive: true })
  await writeFile(
    'reports/pwa/builds.json',
    `${JSON.stringify(
      {
        baselines: Object.fromEntries(
          baselines.map((baseline, index) => [
            baselineIds[index],
            { ...baseline.provenance, build: baseline.release.descriptor }
          ])
        ),
        candidate: { commit, build: candidate.descriptor },
        toolchain: { node: process.version, baselineInstall: 'none; checked-in immutable static fixture' },
        scope:
          'Two independent localhost upgrades: retained earlier candidate and hash-pinned public production capture to the same-run candidate. Capture is not atomic and does not establish the deployed source commit or private OVH/Apache/backup controls.'
      },
      null,
      2
    )}\n`
  )
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(process.argv[2])
}
