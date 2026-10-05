import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const removedClaims = /\bgratuit\w*|\bsans[\s,;:-]+(?:compte|inscription|abonnement)\b|\bfree\b/i
const activeSources = [
  '../../index.html',
  '../../vite.config.js',
  '../../src/config/index.js',
  '../../public/manifest.example.json',
  '../../public/sitemap.xml.template',
  '../../README.md'
]

test('active authored metadata, fallbacks and public examples omit removed service claims', () => {
  for (const file of activeSources) {
    assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), 'utf8'), removedClaims, file)
  }
})

test('service structured metadata does not advertise zero-price offers', () => {
  const template = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
  assert.doesNotMatch(template, /"offers"\s*:/)
  assert.doesNotMatch(template, /"price"\s*:\s*"?0(?:\.0+)?"?\s*[,}]/)
})
