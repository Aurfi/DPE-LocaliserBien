import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { isRecord, packageNamesInId, validatePolicy } from './dependency-policy.mjs'

const dependencyFields = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']
const severities = ['info', 'low', 'moderate', 'high', 'critical']
const count = value => Number.isSafeInteger(value) && value >= 0
const same = (left, right) =>
  JSON.stringify(Object.entries(left).sort()) === JSON.stringify(Object.entries(right).sort())

export function evaluateAudit({ audit, status, signal, error, label = 'Full' }) {
  const failures = []
  if (status !== 0 || signal || error) failures.push(`${label} audit command failed (status ${status}).`)
  if (
    !isRecord(audit) ||
    Object.hasOwn(audit, 'error') ||
    audit.auditReportVersion !== 2 ||
    !isRecord(audit.vulnerabilities) ||
    !isRecord(audit.metadata?.vulnerabilities) ||
    !isRecord(audit.metadata?.dependencies)
  ) {
    return [...failures, `${label} audit returned an invalid report; no result was accepted.`]
  }
  const totals = audit.metadata.vulnerabilities
  const findings = Object.keys(audit.vulnerabilities)
  if (
    [...severities, 'total'].some(key => !count(totals[key])) ||
    Object.keys(totals).some(key => ![...severities, 'total'].includes(key)) ||
    ['prod', 'dev', 'optional', 'peer', 'peerOptional', 'total'].some(
      key => !count(audit.metadata.dependencies[key])
    ) ||
    totals.total !== findings.length ||
    severities.reduce((sum, key) => sum + totals[key], 0) !== totals.total
  ) {
    failures.push(`${label} audit has malformed or inconsistent counts.`)
  }
  if (findings.length || totals.total !== 0 || severities.some(key => totals[key] !== 0)) {
    failures.push(`${label} audit has findings; no advisory exceptions are allowed.`)
  }
  return failures
}

export function evaluateDependencies({ manifest, lock, policy, tree, status, signal, error, cwd }) {
  const failures = validatePolicy(policy)
  if (failures.length) return failures
  const retired = new Set(policy.retiredPackages)
  if (!isRecord(manifest) || !isRecord(lock) || lock.lockfileVersion !== 3 || !isRecord(lock.packages?.[''])) {
    return [...failures, 'Invalid manifest or npm v3 lockfile.']
  }
  const root = lock.packages['']
  for (const field of dependencyFields) {
    const declared = manifest[field] === undefined ? {} : manifest[field]
    const locked = root[field] === undefined ? {} : root[field]
    if (
      !isRecord(declared) ||
      !isRecord(locked) ||
      Object.values(declared).some(version => typeof version !== 'string' || !version) ||
      !same(declared, locked)
    ) {
      failures.push(`Manifest/lock ${field} drift or invalid dependency map.`)
      continue
    }
    for (const [name, specifier] of Object.entries(declared)) {
      if (
        retired.has(name) ||
        [...retired].some(pkg => specifier === `npm:${pkg}` || specifier.startsWith(`npm:${pkg}@`))
      ) {
        failures.push(`Retired package declared in ${field}: ${name}.`)
      }
    }
  }
  for (const field of ['name', 'version']) {
    if (typeof manifest[field] !== 'string' || manifest[field] !== root[field] || manifest[field] !== lock[field]) {
      failures.push(`Manifest/lock ${field} drift.`)
    }
  }
  for (const [location, entry] of Object.entries(lock.packages)) {
    if (!isRecord(entry)) {
      failures.push(`Malformed lock entry: ${location}.`)
      continue
    }
    for (const name of [...packageNamesInId(location), entry.name]) {
      if (retired.has(name)) failures.push(`Retired package remains in lock: ${location} (${name}).`)
    }
  }
  if (status !== 0 || signal || error || !isRecord(tree) || tree.error) {
    return [...failures, `Installed dependency tree could not be verified (status ${status}).`]
  }
  if (tree.name !== manifest.name || tree.version !== manifest.version) {
    failures.push('Installed dependency tree does not match the manifest identity.')
  }
  const visit = (node, location) => {
    if (
      !isRecord(node) ||
      node.missing ||
      node.invalid ||
      node.extraneous ||
      node.error ||
      (node.problems !== undefined && (!Array.isArray(node.problems) || node.problems.length))
    ) {
      failures.push(`Invalid installed dependency: ${location}.`)
      return
    }
    if (retired.has(node.name)) failures.push(`Retired installed package: ${location} (${node.name}).`)
    if (typeof node.path === 'string') {
      const relative = path.relative(cwd, node.path).replaceAll('\\', '/')
      for (const name of packageNamesInId(relative)) {
        if (retired.has(name)) failures.push(`Retired installed package path: ${relative}.`)
      }
      if (location !== '<root>' && (!lock.packages[relative] || lock.packages[relative].version !== node.version)) {
        failures.push(`Installed/lock version or location drift: ${relative}.`)
      }
    } else {
      failures.push(`Installed dependency has no verifiable path: ${location}.`)
    }
    if (node.dependencies !== undefined && !isRecord(node.dependencies)) {
      failures.push(`Malformed installed dependency map: ${location}.`)
      return
    }
    for (const [name, child] of Object.entries(node.dependencies || {})) {
      if (retired.has(name)) failures.push(`Retired installed package: ${location} > ${name}.`)
      // npm ls represents uninstalled platform/optional-peer dependencies as {}.
      const optional =
        Object.hasOwn(node.optionalDependencies || {}, name) || node.peerDependenciesMeta?.[name]?.optional === true
      if (optional && isRecord(child) && Object.keys(child).length === 0) continue
      visit(child, `${location} > ${name}`)
    }
  }
  visit(tree, '<root>')
  for (const name of Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })) {
    if (!Object.hasOwn(tree.dependencies || {}, name) && !Object.hasOwn(manifest.optionalDependencies || {}, name)) {
      failures.push(`Missing installed direct dependency: ${name}.`)
    }
  }
  return failures
}

export function runAudit({ cwd = process.cwd(), run = spawnSync, now = new Date() } = {}) {
  const reportDir = path.join(cwd, 'reports/security')
  mkdirSync(reportDir, { recursive: true })
  const failures = []
  const hashes = {}
  const read = file => {
    try {
      const content = readFileSync(path.join(cwd, file))
      hashes[file] = createHash('sha256').update(content).digest('hex')
      return content.toString('utf8')
    } catch (error) {
      failures.push(`Cannot read ${file}: ${error.message}`)
      return ''
    }
  }
  const parse = (text, label) => {
    try {
      return JSON.parse(text)
    } catch {
      failures.push(`${label} did not contain valid JSON.`)
      return null
    }
  }
  const policy = parse(read('security-policy.json'), 'Dependency policy')
  const lock = parse(read('package-lock.json'), 'Lockfile')
  const manifest = parse(read('package.json'), 'Manifest')
  for (const file of [
    'vite.config.js',
    'postcss.config.js',
    'scripts/security/dependency-policy.mjs',
    'scripts/security/audit-policy.mjs',
    'scripts/security/runtime-module-policy.mjs'
  ]) {
    read(file)
  }
  const execute = (command, args) => {
    try {
      return run(command, args, { cwd, encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024 })
    } catch (error) {
      return { status: null, signal: null, error, stdout: '', stderr: '' }
    }
  }
  const commands = [
    { name: 'npm-audit', args: ['audit', '--include=dev', '--audit-level=low', '--json'] },
    { name: 'npm-audit-production', args: ['audit', '--omit=dev', '--audit-level=low', '--json'] },
    { name: 'npm-ls', args: ['ls', '--all', '--long', '--include=dev', '--json'] }
  ]
  for (const command of commands) {
    command.result = execute('npm', command.args)
    writeFileSync(path.join(reportDir, `${command.name}.json`), command.result.stdout || '')
    writeFileSync(path.join(reportDir, `${command.name}.stderr.log`), command.result.stderr || '')
    command.document = parse(command.result.stdout || '', command.name)
  }
  const [full, production, installed] = commands
  failures.push(
    ...evaluateAudit({ ...full.result, audit: full.document, label: 'Full' }),
    ...evaluateAudit({ ...production.result, audit: production.document, label: 'Production' }),
    ...evaluateDependencies({ manifest, lock, policy, tree: installed.document, ...installed.result, cwd })
  )
  const commandEvidence = Object.fromEntries(
    commands.map(({ name, args, result }) => [
      name,
      { command: ['npm', ...args], status: result.status, signal: result.signal, error: result.error?.message || null }
    ])
  )
  const context = {
    auditedAt: now.toISOString(),
    commit: execute('git', ['rev-parse', 'HEAD']).stdout?.trim(),
    workingTreeStatus: execute('git', ['status', '--porcelain']).stdout?.trim(),
    evidenceScope: 'Current working tree; commit alone is not the identity when workingTreeStatus is nonempty.',
    lockSha256: hashes['package-lock.json'],
    manifestSha256: hashes['package.json'],
    policySha256: hashes['security-policy.json'],
    checkerSha256: hashes['scripts/security/audit-policy.mjs'],
    runtimeGuardSha256: hashes['scripts/security/runtime-module-policy.mjs'],
    configurationHashes: hashes,
    node: process.version,
    commands: commandEvidence,
    npmAuditExitStatus: full.result.status,
    npmAuditSignal: full.result.signal,
    npmProductionAuditExitStatus: production.result.status,
    npmProductionAuditSignal: production.result.signal,
    npmTreeExitStatus: installed.result.status
  }
  const result = { failures, accepted: [], passed: failures.length === 0 }
  writeFileSync(path.join(reportDir, 'context.json'), `${JSON.stringify(context, null, 2)}\n`)
  writeFileSync(path.join(reportDir, 'policy-result.json'), `${JSON.stringify(result, null, 2)}\n`)
  if (failures.length) {
    process.stderr.write(`Dependency policy failed:\n${failures.join('\n')}\n`)
    return 1
  }
  process.stdout.write(
    'Dependency policy passed: full and production audits are clean; retired dependency tree is absent.\n'
  )
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = runAudit()
}
