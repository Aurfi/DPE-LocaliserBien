import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

// Schema v1 preserves the current consumer paths and numeric precision. Source
// metadata stays in the pinned source archive, outside the release payload.
export function projectDepartment(data) {
  return {
    departmentCode: data.departmentCode,
    communes: data.communes.map(commune => ({
      nom: commune.nom,
      code: commune.code,
      codesPostaux: commune.codesPostaux,
      centre: { coordinates: commune.centre.coordinates },
      mairie: { coordinates: commune.mairie.coordinates },
      radius: commune.radius
    })),
    postalCodes: Object.fromEntries(
      Object.entries(data.postalCodes).map(([postcode, area]) => [
        postcode,
        {
          communes: area.communes,
          communeCount: area.communeCount,
          center: area.center,
          coverageRadius: area.coverageRadius
        }
      ])
    )
  }
}

export function collectRuntimeData(root = process.cwd()) {
  const source = path.join(root, 'public/data/departments')
  const manifest = JSON.parse(readFileSync(path.join(root, 'src/data/geography/source-manifest.json'), 'utf8'))
  const files = readdirSync(source)
    .filter(name => name.endsWith('.json'))
    .sort()
  assert.deepEqual(files, Object.keys(manifest.sourceHashes).sort(), 'source inventory differs from pinned manifest')
  const output = new Map()
  for (const name of files) {
    const bytes = readFileSync(path.join(source, name))
    assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.sourceHashes[name], `source drift: ${name}`)
    if (!name.startsWith('communes-dept-')) continue
    const data = JSON.parse(bytes)
    assert.equal(name, `communes-dept-${data.departmentCode}.json`)
    output.set(name, JSON.stringify(projectDepartment(data)))
  }
  assert.equal(output.size, 105, 'unexpected geography inventory; review source refresh separately')
  // Hash actual projected bytes, not a timestamp. A payload/schema change gets a
  // new URL and cannot silently mutate data used by already-open app versions.
  const digest = createHash('sha256')
  for (const [name, bytes] of output) digest.update(name).update('\0').update(bytes).update('\0')
  const basePath = `/data/geography-v1-${digest.digest('hex').slice(0, 16)}/`
  return { output, directory: { schemaVersion: 1, basePath } }
}

export function verifyRuntimeDirectory(root, runtime) {
  const directory = path.join(root, runtime.directory.basePath)
  assert.deepEqual(readdirSync(directory).sort(), [...runtime.output.keys()], 'runtime file inventory changed')
  for (const [name, bytes] of runtime.output) {
    assert.equal(readFileSync(path.join(directory, name), 'utf8'), bytes, `runtime content changed: ${name}`)
  }
}
