import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { evaluateAudit, evaluateDependencies, runAudit } from './audit-policy.mjs'
import { BUILD_TOOL_PACKAGES, RETIRED_PACKAGES, validatePolicy } from './dependency-policy.mjs'

const policyFixture = () => ({
  schemaVersion: 2,
  retiredPackages: [...RETIRED_PACKAGES],
  buildToolRuntimePackages: [...RETIRED_PACKAGES, ...BUILD_TOOL_PACKAGES]
})
const auditFixture = () => ({
  auditReportVersion: 2,
  vulnerabilities: {},
  metadata: {
    vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 },
    dependencies: { prod: 1, dev: 1, optional: 0, peer: 0, peerOptional: 0, total: 2 }
  }
})
function treeFixture(cwd = '/project') {
  const manifest = {
    name: 'site',
    version: '1.0.0',
    dependencies: { vue: '^3.5.0' },
    devDependencies: { vite: '^6.4.3' }
  }
  return {
    cwd,
    status: 0,
    policy: policyFixture(),
    manifest,
    lock: {
      name: manifest.name,
      version: manifest.version,
      lockfileVersion: 3,
      packages: {
        '': structuredClone(manifest),
        'node_modules/vue': { version: '3.5.22' },
        'node_modules/vite': { version: '6.4.3', dev: true }
      }
    },
    tree: {
      name: manifest.name,
      version: manifest.version,
      path: cwd,
      dependencies: {
        vue: { name: 'vue', version: '3.5.22', path: path.join(cwd, 'node_modules/vue') },
        vite: { name: 'vite', version: '6.4.3', path: path.join(cwd, 'node_modules/vite') }
      }
    }
  }
}

test('repository policy has no exceptions and retains every mandatory boundary', () => {
  const policy = JSON.parse(readFileSync(new URL('../../security-policy.json', import.meta.url), 'utf8'))
  assert.deepEqual(validatePolicy(policy), [])
  assert.equal(Object.hasOwn(policy, 'exceptions'), false)
})

test('accepts only a successful, well-formed zero-finding audit', () => {
  assert.deepEqual(evaluateAudit({ audit: auditFixture(), status: 0 }), [])
})

for (const [name, mutate] of [
  [
    'offline response',
    data => {
      data.audit = { error: { code: 'ENOTFOUND' } }
    }
  ],
  [
    'empty response',
    data => {
      data.audit = null
    }
  ],
  [
    'array report',
    data => {
      data.audit = []
    }
  ],
  [
    'old report version',
    data => {
      data.audit.auditReportVersion = 1
    }
  ],
  [
    'array findings',
    data => {
      data.audit.vulnerabilities = []
    }
  ],
  [
    'missing findings',
    data => {
      delete data.audit.vulnerabilities
    }
  ],
  [
    'missing metadata',
    data => {
      delete data.audit.metadata
    }
  ],
  [
    'missing dependency counters',
    data => {
      delete data.audit.metadata.dependencies
    }
  ],
  [
    'missing severity',
    data => {
      delete data.audit.metadata.vulnerabilities.high
    }
  ],
  [
    'unexpected severity',
    data => {
      data.audit.metadata.vulnerabilities.unknown = 0
    }
  ],
  [
    'string total',
    data => {
      data.audit.metadata.vulnerabilities.total = '0'
    }
  ],
  [
    'negative count',
    data => {
      data.audit.metadata.vulnerabilities.high = -1
    }
  ],
  [
    'fractional count',
    data => {
      data.audit.metadata.vulnerabilities.low = 0.5
    }
  ],
  [
    'inconsistent total',
    data => {
      data.audit.metadata.vulnerabilities.total = 1
    }
  ],
  [
    'inconsistent severity',
    data => {
      data.audit.metadata.vulnerabilities.high = 1
    }
  ],
  [
    'hidden finding',
    data => {
      data.audit.vulnerabilities.vue = {}
    }
  ],
  [
    'nonzero command status',
    data => {
      data.status = 1
    }
  ],
  [
    'command failure status',
    data => {
      data.status = 2
    }
  ],
  [
    'null command status',
    data => {
      data.status = null
    }
  ],
  [
    'timeout signal',
    data => {
      data.signal = 'SIGTERM'
    }
  ],
  [
    'spawn error despite zero status',
    data => {
      data.error = new Error('timeout')
    }
  ]
]) {
  for (const label of ['Full', 'Production']) {
    test(`${label} audit fails closed on ${name}`, () => {
      const data = { audit: auditFixture(), status: 0, label }
      mutate(data)
      assert.ok(evaluateAudit(data).length)
    })
  }
}

for (const severity of ['info', 'low', 'moderate', 'high', 'critical']) {
  test(`rejects every new ${severity} finding without exceptions`, () => {
    const audit = auditFixture()
    audit.vulnerabilities.vue = { name: 'vue', severity }
    audit.metadata.vulnerabilities[severity] = 1
    audit.metadata.vulnerabilities.total = 1
    assert.ok(evaluateAudit({ audit, status: 1 }).some(failure => failure.includes('no advisory exceptions')))
  })
}

test('accepts a clean installed tree matching the manifest and lock', () => {
  assert.deepEqual(evaluateDependencies(treeFixture()), [])
})

test('dependency key ordering is not manifest/lock drift', () => {
  const data = treeFixture()
  data.manifest.dependencies = { z: '1.0.0', vue: '^3.5.0' }
  data.lock.packages[''].dependencies = { vue: '^3.5.0', z: '1.0.0' }
  data.lock.packages['node_modules/z'] = { version: '1.0.0' }
  data.tree.dependencies.z = { name: 'z', version: '1.0.0', path: '/project/node_modules/z' }
  assert.deepEqual(evaluateDependencies(data), [])
})

test('allows absent optional platform packages and optional peers represented by npm as empty nodes', () => {
  const data = treeFixture()
  data.tree.dependencies.vite.optionalDependencies = { 'platform-package': '1' }
  data.tree.dependencies.vite.peerDependenciesMeta = { 'optional-peer': { optional: true } }
  data.tree.dependencies.vite.dependencies = { 'platform-package': {}, 'optional-peer': {} }
  assert.deepEqual(evaluateDependencies(data), [])
})

for (const [name, mutate] of [
  [
    'missing policy',
    data => {
      data.policy = null
    }
  ],
  [
    'legacy exception schema',
    data => {
      data.policy = { schemaVersion: 1, exceptions: [] }
    }
  ],
  [
    'added exception field',
    data => {
      data.policy.exceptions = []
    }
  ],
  [
    'deleted retired-package list',
    data => {
      delete data.policy.retiredPackages
    }
  ],
  [
    'empty retired-package list',
    data => {
      data.policy.retiredPackages = []
    }
  ],
  [
    'missing retired package',
    data => {
      data.policy.retiredPackages.pop()
    }
  ],
  [
    'missing build-tool boundary',
    data => {
      data.policy.buildToolRuntimePackages = []
    }
  ],
  [
    'duplicate package policy',
    data => {
      data.policy.retiredPackages.push('braces')
    }
  ],
  [
    'invalid package name',
    data => {
      data.policy.retiredPackages.push('../wrong')
    }
  ],
  [
    'missing manifest',
    data => {
      data.manifest = null
    }
  ],
  [
    'invalid dependency map',
    data => {
      data.manifest.dependencies = []
    }
  ],
  [
    'invalid dependency specifier',
    data => {
      data.manifest.dependencies.vue = null
    }
  ],
  [
    'missing lock',
    data => {
      data.lock = null
    }
  ],
  [
    'legacy lock',
    data => {
      data.lock.lockfileVersion = 1
    }
  ],
  [
    'missing root lock',
    data => {
      delete data.lock.packages['']
    }
  ],
  [
    'malformed lock entry',
    data => {
      data.lock.packages['node_modules/vue'] = null
    }
  ],
  [
    'production manifest drift',
    data => {
      data.manifest.dependencies.vue = '^4.0.0'
    }
  ],
  [
    'development manifest drift',
    data => {
      data.manifest.devDependencies.vite = '^7.0.0'
    }
  ],
  [
    'optional manifest drift',
    data => {
      data.manifest.optionalDependencies = { test: '1' }
    }
  ],
  [
    'peer manifest drift',
    data => {
      data.manifest.peerDependencies = { test: '1' }
    }
  ],
  [
    'root identity drift',
    data => {
      data.lock.packages[''].name = 'other'
    }
  ],
  [
    'top-level identity drift',
    data => {
      data.lock.version = '2.0.0'
    }
  ],
  [
    'failed tree command',
    data => {
      data.status = 1
    }
  ],
  [
    'tree timeout',
    data => {
      data.status = null
    }
  ],
  [
    'tree signal',
    data => {
      data.signal = 'SIGTERM'
    }
  ],
  [
    'tree spawn error',
    data => {
      data.error = new Error('missing npm')
    }
  ],
  [
    'missing installed tree',
    data => {
      data.tree = null
    }
  ],
  [
    'malformed installed dependency map',
    data => {
      data.tree.dependencies = []
    }
  ],
  [
    'tree identity mismatch',
    data => {
      data.tree.name = 'other'
    }
  ],
  [
    'tree problem',
    data => {
      data.tree.problems = ['missing package']
    }
  ],
  [
    'missing direct package',
    data => {
      delete data.tree.dependencies.vue
    }
  ],
  [
    'empty nonoptional dependency',
    data => {
      data.tree.dependencies.vue = {}
    }
  ],
  [
    'invalid installed package',
    data => {
      data.tree.dependencies.vue.invalid = true
    }
  ],
  [
    'extraneous installed package',
    data => {
      data.tree.dependencies.vue.extraneous = true
    }
  ],
  [
    'installed version drift',
    data => {
      data.tree.dependencies.vue.version = '3.4.0'
    }
  ],
  [
    'installed location drift',
    data => {
      data.tree.dependencies.vue.path = '/project/node_modules/other'
    }
  ]
]) {
  test(`dependency tree fails closed on ${name}`, () => {
    const data = treeFixture()
    mutate(data)
    assert.ok(evaluateDependencies(data).length)
  })
}

for (const name of RETIRED_PACKAGES) {
  for (const prefix of ['node_modules/', 'node_modules/parent/node_modules/']) {
    test(`rejects retired lock node ${prefix}${name}`, () => {
      const data = treeFixture()
      data.lock.packages[prefix + name] = { version: '1.0.0', dev: true }
      assert.ok(evaluateDependencies(data).some(failure => failure.includes('Retired package remains in lock')))
    })
  }
  test(`rejects retired installed package ${name}`, () => {
    const data = treeFixture()
    data.tree.dependencies.vite.dependencies = {
      [name]: { name, version: '1.0.0', path: `/project/node_modules/${name}` }
    }
    assert.ok(evaluateDependencies(data).some(failure => failure.includes('Retired installed package')))
  })
  test(`rejects retired declaration or alias ${name}`, () => {
    for (const [key, value] of [
      [name, '1.0.0'],
      ['alias', `npm:${name}@1.0.0`]
    ]) {
      const data = treeFixture()
      data.manifest.devDependencies[key] = value
      data.lock.packages[''].devDependencies[key] = value
      assert.ok(evaluateDependencies(data).some(failure => failure.includes('Retired package declared')))
    }
  })
}

test('rejects an aliased retired lock package by its actual package name', () => {
  const data = treeFixture()
  data.lock.packages['node_modules/alias'] = { name: 'braces', version: '3.0.3' }
  assert.ok(evaluateDependencies(data).some(failure => failure.includes('Retired package remains in lock')))
})

function sandbox(t) {
  const cwd = mkdtempSync(path.join(os.tmpdir(), 'dependency-policy-test-'))
  t.after(() => rmSync(cwd, { recursive: true, force: true }))
  const data = treeFixture(cwd)
  mkdirSync(path.join(cwd, 'scripts/security'), { recursive: true })
  for (const [file, contents] of [
    ['security-policy.json', JSON.stringify(data.policy)],
    ['package.json', JSON.stringify(data.manifest)],
    ['package-lock.json', JSON.stringify(data.lock)],
    ['vite.config.js', 'config'],
    ['postcss.config.js', 'config'],
    ['scripts/security/dependency-policy.mjs', 'policy'],
    ['scripts/security/audit-policy.mjs', 'checker'],
    ['scripts/security/runtime-module-policy.mjs', 'guard']
  ])
    writeFileSync(path.join(cwd, file), contents)
  const calls = []
  const run = (command, args) => {
    calls.push([command, ...args])
    return {
      status: 0,
      signal: null,
      stdout: command === 'git' ? '' : JSON.stringify(args[0] === 'ls' ? data.tree : auditFixture()),
      stderr: ''
    }
  }
  const report = name => JSON.parse(readFileSync(path.join(cwd, 'reports/security', name), 'utf8'))
  return { cwd, run, calls, report }
}

test('runner retains both raw audits, verified installed tree, process status and source hashes', t => {
  const fixture = sandbox(t)
  assert.equal(runAudit(fixture), 0)
  assert.equal(fixture.report('policy-result.json').passed, true)
  assert.deepEqual(fixture.report('policy-result.json').accepted, [])
  assert.equal(fixture.report('npm-audit.json').metadata.vulnerabilities.total, 0)
  assert.equal(fixture.report('npm-audit-production.json').metadata.vulnerabilities.total, 0)
  assert.equal(fixture.report('npm-ls.json').name, 'site')
  const context = fixture.report('context.json')
  assert.equal(context.npmAuditExitStatus, 0)
  assert.equal(context.npmProductionAuditExitStatus, 0)
  assert.match(context.manifestSha256, /^[a-f0-9]{64}$/)
  assert.ok(fixture.calls.some(call => call.includes('--include=dev')))
  assert.ok(fixture.calls.some(call => call.includes('--omit=dev')))
})

for (const target of ['full', 'production', 'tree']) {
  for (const failure of ['invalid-json', 'nonzero-status', 'signal', 'spawn-error']) {
    test(`runner retains evidence and fails on ${target} ${failure}`, t => {
      const fixture = sandbox(t)
      const original = fixture.run
      fixture.run = (command, args) => {
        const result = original(command, args)
        const selected = args[0] === 'ls' ? 'tree' : args.includes('--omit=dev') ? 'production' : 'full'
        if (command === 'npm' && selected === target) {
          if (failure === 'invalid-json') result.stdout = 'not JSON'
          if (failure === 'nonzero-status') result.status = 1
          if (failure === 'signal') result.signal = 'SIGTERM'
          if (failure === 'spawn-error') throw new Error('simulated offline command failure')
        }
        return result
      }
      assert.equal(runAudit(fixture), 1)
      assert.equal(fixture.report('policy-result.json').passed, false)
      assert.equal(Object.keys(fixture.report('context.json').commands).length, 3)
      assert.equal(fixture.calls.filter(call => call[0] === 'npm').length, 3)
    })
  }
}

test('malformed local input still produces a failed policy result and all command evidence', t => {
  const fixture = sandbox(t)
  writeFileSync(path.join(fixture.cwd, 'security-policy.json'), '{')
  assert.equal(runAudit(fixture), 1)
  assert.ok(fixture.report('policy-result.json').failures.some(failure => failure.includes('valid JSON')))
  assert.equal(Object.keys(fixture.report('context.json').commands).length, 3)
})

test('rejects a retired npm alias without an explicit version', () => {
  const data = treeFixture()
  data.manifest.devDependencies.alias = 'npm:braces'
  data.lock.packages[''].devDependencies.alias = 'npm:braces'
  assert.ok(evaluateDependencies(data).some(failure => failure.includes('Retired package declared')))
})

for (const [name, mutate] of [
  [
    'null optional declaration',
    data => {
      data.manifest.optionalDependencies = null
    }
  ],
  [
    'null lock dependency map',
    data => {
      data.lock.packages[''].optionalDependencies = null
    }
  ],
  [
    'non-array problem list',
    data => {
      data.tree.problems = {}
    }
  ]
]) {
  test(`rejects malformed ${name}`, () => {
    const data = treeFixture()
    mutate(data)
    assert.ok(evaluateDependencies(data).length)
  })
}

test('an error member cannot masquerade as a clean audit even when falsy', () => {
  const audit = auditFixture()
  audit.error = null
  assert.ok(evaluateAudit({ audit, status: 0 }).length)
})
