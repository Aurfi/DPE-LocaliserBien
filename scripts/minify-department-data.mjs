import assert from 'node:assert/strict'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

// Build output only: retain every field, identifier, record and source date.
const source = path.resolve('public/data/departments')
const output = path.resolve('dist/data/departments')
let before = 0
let after = 0
let count = 0
for (const name of readdirSync(source)
  .filter(name => name.endsWith('.json'))
  .sort()) {
  const input = readFileSync(path.join(source, name), 'utf8')
  const data = JSON.parse(input)
  const existingOutput = JSON.parse(readFileSync(path.join(output, name), 'utf8'))
  assert.deepEqual(existingOutput, data, `build copy differs from source: ${name}`)
  const packed = JSON.stringify(data)
  assert.deepEqual(JSON.parse(packed), data, `minification changed data: ${name}`)
  writeFileSync(path.join(output, name), packed, 'utf8')
  before += Buffer.byteLength(input)
  after += Buffer.byteLength(packed)
  count++
}
assert(count > 0, 'no department files were processed')
process.stdout.write(`Lossless department JSON: ${count} files, ${before} -> ${after} bytes; source dates unchanged.\n`)
