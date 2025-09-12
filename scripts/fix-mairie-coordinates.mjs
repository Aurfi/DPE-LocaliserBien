#!/usr/bin/env node
/**
 * Fix mairie coordinates when they differ too much from commune centroid.
 * - Scans all public/data/departments/communes-dept-*.json files
 * - For each commune, compares centre.coordinates vs mairie.coordinates
 * - If distance > 30km, replaces mairie.coordinates with centre.coordinates
 *
 * Usage:
 *   node scripts/fix-mairie-coordinates.mjs           # dry run (no changes)
 *   node scripts/fix-mairie-coordinates.mjs --write   # apply changes in place
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const DATA_DIR = path.join(ROOT, 'public', 'data', 'departments')

const toRadians = deg => (deg * Math.PI) / 180

function haversineKm([lon1, lat1], [lon2, lat2]) {
  if ([lon1, lat1, lon2, lat2].some(v => typeof v !== 'number' || Number.isNaN(v))) return Infinity
  const R = 6371
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function processFile(filePath, write = false, thresholdKm = 15) {
  const content = fs.readFileSync(filePath, 'utf8')
  const json = JSON.parse(content)
  const communes = json.communes || []

  let updated = 0
  let checked = 0
  const issues = []

  for (const c of communes) {
    const centre = c?.centre?.coordinates
    const mairie = c?.mairie?.coordinates
    if (!Array.isArray(centre) || !Array.isArray(mairie) || centre.length < 2 || mairie.length < 2) continue
    const dist = haversineKm(centre, mairie)
    checked++
    if (dist > thresholdKm) {
      issues.push({ nom: c.nom, code: c.code, distKm: Math.round(dist * 10) / 10, old: mairie, fix: centre })
      if (write) {
        c.mairie.coordinates = [...centre]
        updated++
      }
    }
  }

  if (write && updated > 0) {
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2))
  }

  return { file: path.basename(filePath), checked, issues, updated }
}

function main() {
  const write = process.argv.includes('--write')
  const thresholdArg = process.argv.find(a => a.startsWith('--threshold='))
  const thresholdKm = thresholdArg ? Number(thresholdArg.split('=')[1]) : 15
  if (!fs.existsSync(DATA_DIR)) {
    process.exit(1)
  }

  const files = fs.readdirSync(DATA_DIR).filter(f => /^communes-dept-\d+\.json$/.test(f))
  let _totalUpdated = 0
  let _totalIssues = 0
  const summaries = []

  for (const f of files) {
    const res = processFile(path.join(DATA_DIR, f), write, thresholdKm)
    _totalUpdated += res.updated
    _totalIssues += res.issues.length
    summaries.push(res)
  }
  if (write)
    for (const s of summaries) {
      if (s.issues.length === 0) continue
      for (const _i of s.issues.slice(0, 10)) {
      }
      if (s.issues.length > 10) {
      }
    }
}

main()
