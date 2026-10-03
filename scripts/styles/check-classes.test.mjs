import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { analyzeClasses, readProject, selectorClasses } from './check-classes.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const baseline = readProject(root)
const form = 'src/components/fonctionnalites/dpe/FormulaireRechercheDPE.vue'
const card = 'src/components/partages/CarteBien.vue'
const history = 'src/components/fonctionnalites/recherche/RecherchesRecentes.vue'
const header = 'src/components/partages/EnteteResultats.vue'
const results = 'src/components/fonctionnalites/localisation/ResultatsLocaliserDpe.vue'
const changed = (file, before, after) => {
  const files = new Map(baseline)
  assert.ok(files.get(file).includes(before), `mutation source exists in ${file}`)
  files.set(file, files.get(file).replace(before, after))
  return analyzeClasses(files)
}
const fails = (result, pattern) =>
  assert.ok(
    result.errors.some(error => pattern.test(error)),
    result.errors.join('\n') || 'unexpected pass'
  )
const fixture = (template, script = '', css = '.known { color: red }') =>
  new Map([
    ['src/Example.vue', `<template>${template}</template><script>${script}</script>`],
    ['src/styles/app-components.css', css]
  ])

test('the application has 34 finite class bindings across 10 files, including every helper output and prop source', () => {
  const result = analyzeClasses(baseline)
  assert.deepEqual(result.errors, [])
  assert.equal(result.components, 32)
  assert.equal(result.retainedClasses, 528)
  const dynamic = result.bindings.filter(binding => binding.kind === 'dynamic')
  assert.equal(dynamic.length, 34)
  assert.equal(new Set(dynamic.map(binding => binding.file)).size, 10)
  const status = dynamic.find(binding => binding.file === header && binding.source === 'statusClass')
  for (const name of [
    'text-gray-500',
    'text-amber-600',
    'text-green-600',
    'text-orange-600',
    'dark:text-gray-400',
    'font-medium'
  ])
    assert.ok(status.classes.includes(name), name)
  const score = dynamic.find(binding => binding.file === card && binding.source === 'getScoreBadgeClass(score)')
  for (const name of [
    'bg-gray-400',
    'bg-green-500',
    'bg-green-600',
    'bg-yellow-400',
    'bg-orange-400',
    'bg-orange-500',
    'bg-orange-600',
    'bg-red-500',
    'bg-red-600',
    'bg-red-700'
  ])
    assert.ok(score.classes.includes(name), name)
  assert.ok(result.bindings.some(binding => binding.kind === 'classList' && binding.classes.includes('dark')))
})

test('an unsupported static utility fails', () => {
  fails(changed(form, 'class="max-w-4xl mx-auto"', 'class="max-w-4xl mx-auto p-37"'), /unsupported class "p-37"/)
})

test('an unsupported conditional branch fails even when its condition is unknown', () => {
  fails(changed(form, "? 'border-red-500", "? 'border-fuchsia-950"), /unsupported class "border-fuchsia-950"/)
})

test('editing a method map and adding a new map output both fail', () => {
  fails(
    changed(history, "A: 'bg-green-500 text-white'", "A: 'bg-fuchsia-950 text-white'"),
    /unsupported class "bg-fuchsia-950"/
  )
  fails(
    changed(history, "A: 'bg-green-500 text-white'", "H: 'bg-fuchsia-950 text-white', A: 'bg-green-500 text-white'"),
    /unsupported class "bg-fuchsia-950"/
  )
})

test('editing a numeric helper return branch fails', () => {
  fails(
    changed(
      card,
      "if (roundedScore >= 90) return 'bg-green-500 text-white'",
      "if (roundedScore >= 90) return 'bg-fuchsia-950 text-white'"
    ),
    /unsupported class "bg-fuchsia-950"/
  )
})

test('computed helpers are covered', () => {
  fails(
    changed(
      'src/components/mise-en-page/InstallationPWA.vue',
      "return 'text-xs text-blue-600",
      "return 'text-xs text-fuchsia-950"
    ),
    /unsupported class "text-fuchsia-950"/
  )
})

test('setup-exported helpers and their call-throughs are covered', () => {
  fails(
    changed(
      'src/components/fonctionnalites/dpe/RechercheDPERecente.vue',
      "A: 'bg-green-500 text-white'",
      "A: 'bg-fuchsia-950 text-white'"
    ),
    /unsupported class "bg-fuchsia-950"/
  )
})

test('returned object projections include conditional local assignments and map colors', () => {
  const file = 'src/components/fonctionnalites/dpe/ModaleDetailsDPE.vue'
  fails(
    changed(file, "color = 'text-green-600 dark:text-green-400'", "color = 'text-fuchsia-950'"),
    /unsupported class "text-fuchsia-950"/
  )
  fails(changed(file, "color: 'text-gray-500'", "color: 'text-fuchsia-950'"), /unsupported class "text-fuchsia-950"/)
})

test('both a passed class prop and its default are covered at the consuming class binding', () => {
  fails(
    changed(header, "default: 'text-gray-500 dark:text-gray-400'", "default: 'text-fuchsia-950'"),
    /EnteteResultats\.vue:.*unsupported class "text-fuchsia-950"/
  )
  fails(
    changed(results, "return 'text-amber-600 dark:text-amber-400 font-medium'", "return 'text-fuchsia-950'"),
    /EnteteResultats\.vue:.*unsupported class "text-fuchsia-950"/
  )
  fails(
    changed(results, ':statusClass="getMatchStatusClass()"', ':statusClass="externalColor"'),
    /unresolved dynamic: unresolved identifier externalColor/
  )
})

test('new class prop callers, including kebab case, cannot evade validation', () => {
  const files = new Map(baseline)
  files.set(
    'src/Extra.vue',
    `<template><EnteteResultats :status-class="'text-fuchsia-950'" /></template><script>import EnteteResultats from './components/partages/EnteteResultats.vue'; export default { components: { EnteteResultats } }</script>`
  )
  fails(analyzeClasses(files), /unsupported class "text-fuchsia-950"/)
})

test('unresolved string construction and externally supplied classes fail', () => {
  fails(
    changed(card, "return 'bg-gray-400 text-white'", "return 'bg-' + score"),
    /unresolved dynamically assembled class/
  )
  // biome-ignore lint/suspicious/noTemplateCurlyInString: this is Vue source under test, not an interpolated test string.
  fails(analyzeClasses(fixture('<div :class="`bg-${color}-500`" />')), /unresolved dynamically assembled class/)
  fails(analyzeClasses(fixture('<div :class="remoteClass" />')), /unresolved identifier remoteClass/)
  fails(
    analyzeClasses(fixture('<div :class="external()" />', "import external from './external.js'")),
    /call output is not a local finite helper/
  )
})

test('finite literals, arrays, conditional objects and bounded string concatenation work', () => {
  const result = analyzeClasses(
    fixture(
      `<div :class="['known', flag ? 'known' : '', { known: flag }, flag &amp;&amp; 'known', classes(letter) + ' known']" />`,
      `export default { methods: { classes(letter) { const map = { A: 'known', B: 'known' }; return map[letter] || '' } } }`
    )
  )
  assert.deepEqual(result.errors, [])
})

test('legitimate ordinary app classes, including utility-looking names, need explicit CSS and then pass', () => {
  const files = new Map(baseline)
  files.set(
    form,
    files.get(form).replace('class="max-w-4xl mx-auto"', 'class="max-w-4xl mx-auto search-summary bg-brand"')
  )
  fails(analyzeClasses(files), /unsupported class "search-summary"/)
  files.set(
    'src/styles/app-components.css',
    `${files.get('src/styles/app-components.css')}\n.search-summary { padding: 1rem; }\n.bg-brand { background: rebeccapurple; }`
  )
  assert.deepEqual(analyzeClasses(files).errors, [])
})

test('dark, responsive, container and escaped scoped selectors are ordinary CSS', () => {
  const files = fixture('<div class="summary dark:summary sm:summary" />', '')
  files.set(
    'src/Example.vue',
    `${files.get('src/Example.vue')}<style scoped>.dark .summary { color: white } @media(min-width:640px) { .sm\\:summary { color: blue } } @container (min-width:20rem) { .dark\\:summary { color: black } }</style>`
  )
  assert.deepEqual(analyzeClasses(files).errors, [])
  files.set('src/Other.vue', '<template><div class="summary sm:summary" /></template>')
  fails(analyzeClasses(files), /Other\.vue:.*unsupported class "summary"/)
})

test('CSS tokenizer ignores quoted attribute values and decodes escaped utility names', () => {
  assert.deepEqual(
    [...selectorClasses('.dark .sm\\:w-1\\/2:is(.group *)[title=".fake"] .\\31 23:hover /* .comment */')],
    ['dark', 'sm:w-1/2', 'group', '123']
  )
})

test('mutating a finite map or using an unbounded computed object key fails closed', () => {
  fails(
    analyzeClasses(
      fixture(
        '<div :class="classes(value)" />',
        `export default { methods: { classes(value) { const map = { A: 'known' }; map[value] = 'anything'; return map[value] } } }`
      )
    ),
    /mutation of map/
  )
  fails(analyzeClasses(fixture('<div :class="{ [external]: true }" />')), /computed object key is not finite/)
})

test('class-capable spread and dynamic attribute names fail closed', () => {
  fails(analyzeClasses(fixture('<div v-bind="attrs" />')), /v-bind spread\/dynamic key/)
  fails(analyzeClasses(fixture('<div :[name]="value" />')), /v-bind spread\/dynamic key/)
})

test('transition classes and classList classes are checked', () => {
  fails(
    changed(
      'src/components/mise-en-page/BanniereGuide.vue',
      'enter-active-class="transition-all',
      'enter-active-class="p-37'
    ),
    /unsupported class "p-37"/
  )
  fails(
    changed('src/App.vue', "classList.toggle('dark', dark)", "classList.toggle('text-fuchsia-950', dark)"),
    /unsupported class "text-fuchsia-950"/
  )
})

test('removed compiler directives and deleted retained selectors fail', () => {
  fails(
    analyzeClasses(fixture('<div class="known" />', '', '.known { @apply p-4; }')),
    /@apply requires a removed CSS compiler/
  )
  const files = new Map(baseline)
  files.set('src/styles/retained-utilities.classes.json', '["nonexistent-retained-class"]')
  fails(analyzeClasses(files), /retained class inventory has no CSS selector/)
})

test('legacy SVG markers remain exactly scoped and new unstyled names are rejected', () => {
  const markers = JSON.parse(fs.readFileSync(new URL('./unstyled-markers.json', import.meta.url), 'utf8'))
  assert.equal(markers.length, 5)
  for (const marker of markers) {
    assert.ok(marker.reason && marker.evidence)
    for (const file of marker.files) assert.ok(baseline.get(file).includes(marker.class), `${file}: ${marker.class}`)
    fails(analyzeClasses(fixture(`<div class="${marker.class}" />`)), new RegExp(`unsupported class "${marker.class}"`))
  }
  for (const name of ['corse', 'france', 'world']) {
    const marker = markers.find(item => item.class === `${name}-map`)
    assert.match(baseline.get(marker.files[0]), new RegExp(`<g class="${name}-map" transform="`))
  }
  fails(analyzeClasses(fixture('<div class="new-unreviewed-hook" />')), /unsupported class "new-unreviewed-hook"/)
})

test('entry HTML static classes and inline script classes are checked', () => {
  assert.ok(baseline.has('index.html'))
  fails(changed('index.html', 'class="sr-only', 'class="p-37 sr-only'), /index\.html:.*unsupported class "p-37"/)
  fails(
    changed('index.html', "classList.add('dark')", "classList.add('p-37')"),
    /index\.html:.*unsupported class "p-37"/
  )
})

test('ordinary source scripts check DOM class sinks without treating arbitrary strings as classes', () => {
  const files = fixture('<div class="known" />')
  files.set(
    'src/dom.js',
    `const harmless = 'text-fuchsia-950'; document.body.classList.add('known'); document.body.className = 'known'; document.body.setAttribute('class', 'known')`
  )
  assert.deepEqual(analyzeClasses(files).errors, [])
  for (const source of [
    "document.body.classList.add('text-fuchsia-950')",
    "document.body.className = 'text-fuchsia-950'",
    "document.body.setAttribute('class', 'text-fuchsia-950')",
    "document.body.classList.toggle('bg-' + external)"
  ]) {
    files.set('src/dom.js', source)
    fails(analyzeClasses(files), /src\/dom\.js:.*(?:unsupported class|unresolved)/)
  }
})

test('mutations through collection aliases and call initializers fail closed', () => {
  for (const mutation of ["const alias = map; alias.A = 'anything'", 'const result = externalMutation(map)']) {
    fails(
      analyzeClasses(
        fixture(
          '<div :class="classes(value)" />',
          `export default { methods: { classes(value) { const map = { A: 'known' }; ${mutation}; return map[value] } } }`
        )
      ),
      /mutation of/
    )
  }
})

const setupFixture = (script, template = '<div :class="color"/>') =>
  new Map([
    ['src/Example.vue', `<template>${template}</template><script setup>${script}</script>`],
    ['src/styles/app.css', '.known { color: red }']
  ])

test('reassigned source classes and mutated captured maps cannot retain initial finite values', () => {
  for (const script of [
    "let color = 'known'; color = 'p-37';",
    "const map = { A: 'known' }; map.A = 'p-37'; const color = map.A;",
    "const map = { A: 'known' }; const alias = map; alias.A = 'p-37'; const color = map.A;",
    "let color = 'known'; function change() { color = 'p-37' }"
  ])
    fails(analyzeClasses(setupFixture(script)), /source mutation/)
})

test('DOM sink parameters and block bindings shadow unrelated outer classes', () => {
  fails(
    analyzeClasses(
      setupFixture(
        "const color = 'known'; function apply(color) { document.body.classList.add(color) }; apply('p-37');",
        '<div/>'
      )
    ),
    /shadowed parameter color/
  )
  fails(
    analyzeClasses(
      setupFixture("const color = 'known'; { const color = 'p-37'; document.body.classList.add(color) }", '<div/>')
    ),
    /unsupported class "p-37"/
  )
  assert.deepEqual(
    analyzeClasses(setupFixture("const color = 'known'; function unrelated(color) { color = 'p-37' }")).errors,
    []
  )
})

test('optional-chain DOM class sinks are inspected', () => {
  for (const script of [
    "document.body?.classList.add('p-37')",
    "document.body.classList?.add('p-37')",
    "document.body.classList.add?.('p-37')",
    "document.body?.setAttribute('class', 'p-37')"
  ])
    fails(analyzeClasses(setupFixture(script, '<div/>')), /unsupported class "p-37"/)
  assert.deepEqual(analyzeClasses(setupFixture("document.body?.classList.add('known')", '<div/>')).errors, [])
})

test('mutating calls in class-return expressions invalidate the map before its value is read', () => {
  fails(
    analyzeClasses(
      setupFixture(
        "function classes() { const map = { A: 'known' }; return externalMutation(map) && map.A; }",
        '<div :class="classes()"/>'
      )
    ),
    /mutation of map/
  )
})

test('configured @ imports participate in finite class-prop caller tracing', () => {
  const files = new Map([
    [
      'src/Child.vue',
      `<template><div :class="tone"/></template><script>export default { props: { tone: { default: 'known' } } }</script>`
    ],
    [
      'src/Parent.vue',
      `<template><Child :tone="'p-37'"/></template><script>import Child from '@/Child.vue'; export default { components: { Child } }</script>`
    ],
    ['src/styles/app.css', '.known { color: red }']
  ])
  fails(analyzeClasses(files), /unsupported class "p-37"/)
})

test('expression shortcuts never hide map-mutating effects from class analysis', () => {
  for (const condition of [
    'externalMutation(map)',
    '!externalMutation(map)',
    '!!externalMutation(map)',
    'void externalMutation(map)',
    'externalMutation(map) === undefined',
    '(externalMutation(map), true)',
    '(flag ? externalMutation(map) : true)',
    '(!externalMutation(map) || true)'
  ]) {
    fails(
      analyzeClasses(
        setupFixture(
          `function classes() { const map = { A: 'known' }; return (${condition}) && map.A }`,
          '<div :class="classes()"/>'
        )
      ),
      /mutation of map/
    )
  }
})

test('object, array, nested, defaulted and rest destructuring reassignments invalidate their actual targets', () => {
  for (const assignment of [
    '({ color } = external)',
    '[color] = external',
    '({ nested: { renamed: color } } = external)',
    '({ renamed: color = "known" } = external)',
    '({ ...color } = external)',
    '[, ...color] = external'
  ])
    fails(analyzeClasses(setupFixture(`let color = 'known'; ${assignment}`)), /source mutation of color/)
  fails(
    analyzeClasses(setupFixture("const map = { A: 'known' }; ({ x: map.A } = external); const color = map.A")),
    /source mutation of map/
  )
  assert.deepEqual(
    analyzeClasses(setupFixture("const color = 'known'; function unrelated({ color: other }) { other = 'p-37' }"))
      .errors,
    []
  )
})

test('nested helper closure writers are refused instead of modeling captured mutable state', () => {
  for (const script of [
    "function classes() { let color = 'known'; function mutate() { color = 'p-37' }; mutate(); return color }",
    "function classes() { const map = { A: 'known' }; function mutate() { map.A = 'p-37' }; return mutate() && map.A }",
    "function classes() { const mutate = () => { color = 'p-37' }; let color = 'known'; mutate(); return color }",
    "function classes() { const mutators = { mutate() { color = 'p-37' } }; let color = 'known'; mutators.mutate(); return color }"
  ])
    fails(analyzeClasses(setupFixture(script, '<div :class="classes()"/>')), /nested class helper functions/)
})

test('collection member arguments and collection aliases cannot escape unnoticed', () => {
  for (const mutation of ['externalMutation(map.inner)', '!externalMutation(map.inner)', 'map.inner.mutate()']) {
    fails(
      analyzeClasses(
        setupFixture(
          `function classes() { const map = { inner: { A: 'known' } }; ${mutation}; return map.inner.A }`,
          '<div :class="classes()"/>'
        )
      ),
      /mutation of map/
    )
  }
  for (const script of [
    "const map = { inner: { A: 'known' } }; externalMutation(map.inner); const color = map.inner.A",
    "const map = { A: 'known' }; const alias = map; externalMutation(alias); const color = map.A"
  ])
    fails(analyzeClasses(setupFixture(script)), /source mutation/)
})

test('helper-local destructured assignment targets are invalidated', () => {
  for (const assignment of [
    '({color}=external)',
    '[color]=external',
    '({nested:{other:color}}=external)',
    '({x:map.A}=external)'
  ]) {
    fails(
      analyzeClasses(
        setupFixture(
          `function classes() { let color = 'known'; const map = { A: 'known' }; ${assignment}; return [color, map.A] }`,
          '<div :class="classes()"/>'
        )
      ),
      /mutation of/
    )
  }
})

test('loop, switch and catch bindings cannot borrow finite outer DOM-sink values', () => {
  for (const script of [
    "const color='known'; for (const color of ['p-37']) { document.body.classList.add(color) }",
    "const color='known'; for (const color in source) { document.body.classList.add(color) }",
    "const color='known'; for (let color='p-37'; condition; color=next) { document.body.classList.add(color) }",
    "const color='known'; for (const { color } of source) { document.body.classList.add(color) }",
    "const color='known'; switch (key) { case 1: const color='p-37'; document.body.classList.add(color); break; }",
    "const color='known'; try { work() } catch (color) { document.body.classList.add(color) }",
    "const color='known'; try { work() } catch ({ message: color }) { document.body.classList.add(color) }"
  ]) {
    const files = fixture('<div/>')
    files.set('src/dom.js', script)
    fails(analyzeClasses(files), /(?:control-flow binding|shadowed parameter|source mutation)/)
  }
  const files = fixture('<div/>')
  files.set('src/dom.js', "for (const color of source) { document.body.classList.add('known') }")
  assert.deepEqual(analyzeClasses(files).errors, [])
})

test('loop assignment targets invalidate captured class sources conservatively', () => {
  for (const loop of ['for(color of source) {}', 'for(color in source) {}']) {
    fails(analyzeClasses(setupFixture(`let color = 'known'; ${loop}`)), /source mutation of color/)
  }
})
