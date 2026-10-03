import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readRelease, sha256 } from './artifacts.mjs'

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

export async function verifyBaseline() {
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

async function main(command) {
  const baseline = await verifyBaseline()
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
        baseline: { ...baseline.provenance, build: baseline.release.descriptor },
        candidate: { commit, build: candidate.descriptor },
        toolchain: { node: process.version, baselineInstall: 'none; checked-in immutable static fixture' },
        scope:
          'Earlier candidate artifact to same-run candidate on localhost. Actual previous production identity and OVH checks remain separate release gates.'
      },
      null,
      2
    )}\n`
  )
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(process.argv[2])
}
