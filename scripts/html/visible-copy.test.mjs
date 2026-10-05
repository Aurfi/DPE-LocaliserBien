import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
function activeVue(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (['__tests__', 'tests'].includes(entry.name)) return []
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) return activeVue(file)
    return entry.name.endsWith('.vue') ? [file] : []
  })
}

test('active Vue copy omits free and no-account marketing', () => {
  for (const file of activeVue(path.join(root, 'src'))) {
    assert.doesNotMatch(
      fs.readFileSync(file, 'utf8'),
      /\bgratuit\w*|\bsans[\s,;:-]+(?:compte|inscription|abonnement)\b/i,
      path.relative(root, file)
    )
  }
  assert(
    fs.readFileSync(path.join(root, 'src/App.vue'), 'utf8').includes("Service de localisation d'annonce immobilière")
  )
  assert(
    fs
      .readFileSync(path.join(root, 'src/components/fonctionnalites/dpe/FormulaireRechercheDPE.vue'), 'utf8')
      .includes('Recopiez les critères de l’annonce.</p>')
  )
  assert(
    fs
      .readFileSync(path.join(root, 'src/views/FAQ.vue'), 'utf8')
      .includes('Deux façons de rechercher un bien dans les données DPE.</p>')
  )
})
