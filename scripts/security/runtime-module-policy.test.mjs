import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { assertNoBuildToolRuntimeModules, runtimeModuleGraph } from './runtime-module-policy.mjs'

const policy = JSON.parse(readFileSync(new URL('../../security-policy.json', import.meta.url), 'utf8'))
const chunk = (modules = {}, imports = [], dynamicImports = []) => ({ type: 'chunk', modules, imports, dynamicImports })

test('allows Vue, browser Workbox helper, ordinary chunks and static assets', () => {
  assert.doesNotThrow(() =>
    assertNoBuildToolRuntimeModules(
      {
        'app.js': chunk(
          {
            '/project/node_modules/vue/dist/vue.js': {},
            '/project/node_modules/workbox-window/build/workbox-window.js': {}
          },
          ['assets/vue-vendor.js']
        ),
        'app.css': { type: 'asset' }
      },
      policy
    )
  )
})

for (const name of policy.buildToolRuntimePackages) {
  for (const id of [
    `/project/node_modules/${name}/index.js`,
    `/project/node_modules/other/node_modules/${name}/index.js`,
    `C:\\project\\node_modules\\${name.replaceAll('/', '\\')}\\index.js`,
    `\0/project/node_modules/${name}/index.js?commonjs-proxy`
  ]) {
    test(`blocks build-tool browser module ${id}`, () => {
      assert.throws(
        () => assertNoBuildToolRuntimeModules({ 'app.js': chunk({ [id]: {} }) }, policy),
        /crossed into browser/
      )
    })
  }
  for (const id of [name, `${name}/index.js`, `${name}?commonjs-proxy`, `/project/node_modules/${name}/index.js`]) {
    test(`blocks static and dynamic external import ${id}`, () => {
      for (const output of [chunk({}, [id]), chunk({}, [], [id])]) {
        assert.throws(() => assertNoBuildToolRuntimeModules({ 'app.js': output }, policy), /external import/)
      }
    })
  }
}

test('checks facade module identity even when the module map is empty', () => {
  const output = { ...chunk(), facadeModuleId: '/project/node_modules/vite/dist/index.js' }
  assert.throws(() => assertNoBuildToolRuntimeModules({ 'app.js': output }, policy), /crossed into browser/)
})

test('does not confuse prefixes, source file names or asset chunk names with package identities', () => {
  assert.doesNotThrow(() =>
    assertNoBuildToolRuntimeModules(
      {
        'app.js': chunk(
          { '/project/src/vite-plugin.js': {}, '/project/node_modules/vite-compatible/index.js': {} },
          ['assets/vite.js'],
          ['vite-compatible']
        )
      },
      policy
    )
  )
})

for (const [name, bundle, changedPolicy] of [
  ['missing bundle', null, policy],
  ['invalid chunk', { 'app.js': {} }, policy],
  ['missing modules', { 'app.js': { type: 'chunk', imports: [], dynamicImports: [] } }, policy],
  ['missing imports', { 'app.js': { type: 'chunk', modules: {}, dynamicImports: [] } }, policy],
  ['non-string import', { 'app.js': chunk({}, [null]) }, policy],
  ['missing runtime policy', { 'app.js': chunk() }, {}],
  ['old exception-only policy', { 'app.js': chunk() }, { schemaVersion: 1, exceptions: [] }],
  ['empty runtime boundary', { 'app.js': chunk() }, { ...policy, buildToolRuntimePackages: [] }]
]) {
  test(`fails closed on ${name}`, () => {
    assert.throws(() => assertNoBuildToolRuntimeModules(bundle, changedPolicy))
  })
}

test('records a deterministic root-relative module graph without changing browser output', () => {
  const bundle = {
    'app.js': {
      ...chunk(
        { '/project/src/app.js': {}, '\0/project/node_modules/vue/index.js?proxy': {} },
        ['vue.js'],
        ['view.js']
      ),
      facadeModuleId: '/project/src/app.js',
      isEntry: true,
      isDynamicEntry: false
    },
    'app.css': { type: 'asset' }
  }
  const before = structuredClone(bundle)
  const graph = runtimeModuleGraph(bundle, '/project')
  assert.deepEqual(bundle, before)
  assert.deepEqual(graph.publicJavaScript, ['app.js'])
  assert.deepEqual(graph.chunks[0].modules, ['\0<root>/node_modules/vue/index.js?proxy', '<root>/src/app.js'])
  assert.deepEqual(graph.chunks[0].imports, ['vue.js'])
  assert.deepEqual(graph.chunks[0].dynamicImports, ['view.js'])
  assert.equal(JSON.stringify(graph).includes('/project'), false)
})

for (const id of ['\0vite/preload-helper.js', '\0vite/modulepreload-polyfill.js']) {
  test(`allows the exact Vite browser helper module ${id}`, () => {
    assert.doesNotThrow(() => assertNoBuildToolRuntimeModules({ 'app.js': chunk({ [id]: {} }) }, policy))
    assert.throws(() => assertNoBuildToolRuntimeModules({ 'app.js': chunk({}, [id]) }, policy), /external import/)
  })
}
for (const id of [
  'vite',
  'vite/preload-helper.js',
  'vite/modulepreload-polyfill.js',
  '\0vite/compiler.js',
  '\0vite/preload-helper.js?different'
]) {
  test(`still denies compiler imports and lookalike virtual helper ${id}`, () => {
    assert.throws(
      () => assertNoBuildToolRuntimeModules({ 'app.js': chunk({ [id]: {} }) }, policy),
      /crossed into browser/
    )
  })
}
