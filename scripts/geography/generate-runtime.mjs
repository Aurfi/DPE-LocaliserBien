import assert from 'node:assert/strict'
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { collectRuntimeData, verifyRuntimeDirectory } from './runtime-data.mjs'

const runtime = collectRuntimeData()
const manifestPath = 'src/data/geography/runtime-directory.json'
const manifestText = `${JSON.stringify(runtime.directory)}\n`
if (process.argv.includes('--finalize')) {
  assert.equal(readFileSync(manifestPath, 'utf8'), manifestText, 'runtime directory needs regeneration')
  verifyRuntimeDirectory('dist', runtime)
  // Generated local build output only. Deployment intentionally leaves the old
  // /data/departments URLs untouched for older open tabs and rollback.
  rmSync('dist/data/departments', { recursive: true, force: true })
} else {
  const directory = path.join('public', runtime.directory.basePath)
  const generatedNames = readdirSync('public/data').filter(name => /^geography-v1-[a-f0-9]{16}$/.test(name))
  assert(
    generatedNames.every(name => name === path.basename(directory)),
    'old generated geography directory exists; remove the ignored local output before regenerating'
  )
  mkdirSync(directory, { recursive: true })
  for (const [name, bytes] of runtime.output) writeFileSync(path.join(directory, name), bytes)
  writeFileSync(manifestPath, manifestText)
  verifyRuntimeDirectory('public', runtime)
}
const bytes = [...runtime.output.values()].reduce((total, text) => total + Buffer.byteLength(text), 0)
process.stdout.write(`Geography runtime: ${runtime.output.size} files, ${bytes} bytes, ${runtime.directory.basePath}\n`)
