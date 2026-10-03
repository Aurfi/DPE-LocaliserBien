import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { collectRuntimeData, projectDepartment, verifyRuntimeDirectory } from './runtime-data.mjs'

const runtime = collectRuntimeData()

test('preserves every runtime field of all 34,969 communes and 6,326 postal areas exactly', () => {
  let communes = 0
  let areas = 0
  let bytes = 0
  for (const [name, text] of runtime.output) {
    const source = JSON.parse(readFileSync(path.join('public/data/departments', name)))
    const projected = JSON.parse(text)
    assert.equal(projected.departmentCode, source.departmentCode)
    assert.equal(projected.communes.length, source.communes.length)
    source.communes.forEach((commune, index) => {
      const packed = projected.communes[index]
      for (const field of ['nom', 'code', 'codesPostaux', 'radius']) assert.deepEqual(packed[field], commune[field])
      assert.deepEqual(packed.centre.coordinates, commune.centre.coordinates)
      assert.deepEqual(packed.mairie.coordinates, commune.mairie.coordinates)
      assert.equal(typeof packed.code, 'string')
      assert(packed.codesPostaux.every(code => typeof code === 'string' && /^\d{5}$/.test(code)))
      assert(!('population' in packed) && !('surface' in packed))
      communes++
    })
    assert.deepEqual(Object.keys(projected.postalCodes), Object.keys(source.postalCodes))
    for (const [postcode, area] of Object.entries(projected.postalCodes)) {
      for (const field of ['communes', 'communeCount', 'center', 'coverageRadius']) {
        assert.deepEqual(area[field], source.postalCodes[postcode][field])
      }
      areas++
    }
    bytes += Buffer.byteLength(text)
  }
  assert.equal(runtime.output.size, 105)
  assert.equal(communes, 34969)
  assert.equal(areas, 6326)
  assert.equal(bytes, 6719346)
})

test('uses a deterministic content-addressed directory distinct from legacy URLs', () => {
  assert.deepEqual(collectRuntimeData().directory, runtime.directory)
  assert.match(runtime.directory.basePath, /^\/data\/geography-v1-[a-f0-9]{16}\/$/)
  assert.deepEqual(JSON.parse(readFileSync('src/data/geography/runtime-directory.json')), runtime.directory)
  assert(![...runtime.output.keys()].some(name => name.includes('averages')))
  const digest = createHash('sha256')
  for (const [name, bytes] of runtime.output) digest.update(name).update('\0').update(bytes).update('\0')
  assert(runtime.directory.basePath.includes(digest.digest('hex').slice(0, 16)))
})

test('rejects missing, extra, or modified output rather than publishing a partial projection', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'geography-runtime-test-'))
  try {
    const directory = path.join(root, runtime.directory.basePath)
    mkdirSync(directory, { recursive: true })
    assert.throws(() => verifyRuntimeDirectory(root, runtime), /inventory/)
    for (const [name, text] of runtime.output) writeFileSync(path.join(directory, name), text)
    verifyRuntimeDirectory(root, runtime)
    writeFileSync(path.join(directory, 'unexpected.json'), '{}')
    assert.throws(() => verifyRuntimeDirectory(root, runtime), /inventory/)
    rmSync(path.join(directory, 'unexpected.json'))
    const name = [...runtime.output.keys()][0]
    writeFileSync(path.join(directory, name), '{}')
    assert.throws(() => verifyRuntimeDirectory(root, runtime), /content changed/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('does not mutate the source objects or round fractional coordinates/radii', () => {
  const source = JSON.parse(readFileSync('public/data/departments/communes-dept-13.json'))
  const before = JSON.stringify(source)
  const result = projectDepartment(source)
  assert.equal(JSON.stringify(source), before)
  assert.deepEqual(result.communes[0].centre.coordinates, source.communes[0].centre.coordinates)
  assert.equal(result.communes[0].radius, source.communes[0].radius)
})
