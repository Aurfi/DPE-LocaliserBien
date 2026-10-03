# Finite class drift check

Run `node scripts/styles/check-classes.mjs` before Vite builds. Run
`node --test scripts/styles/*.test.mjs` in CI. The checker is read-only: it neither
produces CSS nor changes the retained class inventory. It imports only Node,
PostCSS (already a direct dependency), and the SFC/Babel parsers exported by the
existing `vue/compiler-sfc` dependency. There is no Tailwind dependency, utility
compiler, generator, automatic inventory update, or dependency on an external
baseline checkout.

## What is checked

- Static and dynamic Vue classes, including transition `*-class` attributes.
- Entry `index.html` classes, inline CSS and executable inline scripts. JSON-LD
  remains data, not JavaScript or class declarations.
- `classList.add/remove/replace/toggle` (including optional chains), `className =` and literal
  `setAttribute('class', ...)` sinks in SFC scripts and ordinary production
  `src/**/*.js`, `.mjs`, and `.cjs` files. Arbitrary JavaScript strings are not
  treated as class names. DOM sinks use lexical scopes; a shadowed parameter cannot
  borrow a finite outer value. Loop/switch binders and catch parameters are
  conservatively unknown; loops and switches are never executed. Tests and mocks are excluded.
- Every possible output of supported finite expressions: literal strings,
  arrays, object keys, both conditional branches, local literal maps, helper
  return branches, computed properties, exported setup helpers, and projected
  properties of returned objects. Literal-array `v-for` aliases are tracked.
  Helpers use bounded abstract interpretation, not execution or regex extraction.
- Class props such as `statusClass`: their default and all statically registered
  Vue callers are analyzed at the consuming `:class` binding, including
  camelCase/kebab-case attributes and the configured `@/` source alias. Unknown callers' values fail closed.
- Referenced classes must occur in ordinary source CSS or the same component's
  scoped CSS. CSS is parsed with PostCSS, including media/container rules; class
  selector identifiers are tokenized with CSS escape handling. A scoped class in
  another component does not authorize a reference. Utility-looking names are
  accepted when explicitly defined in editable CSS.
- The retained JSON inventory must still have corresponding CSS selectors.
  Unused retained selectors are intentionally not purged.
- Removed `@apply`, `@tailwind`, `@config`, and `@screen` compiler directives fail.

## Deliberate limits and maintenance

This is a narrow checker for the application's class-producing idioms, not a
JavaScript interpreter or proof of all DOM behavior. Branch conditions are
conservatively explored both ways. Unknown map keys consider every own literal
entry and the missing-value case. Dynamic string construction is allowed only
when all parts have finite outputs. Imported helper outputs, recursive helpers,
unknown class strings, source-level reassignments, mutated captured maps,
collection/member aliases passed to calls, nested helper closures,
unsupported helper control flow, spread
bindings and dynamic attribute keys fail with a source diagnostic. Prefer an
explicit literal map or ordinary named CSS rule; do not add a broad allowlist
or a new class compiler. Adding a new supported expression form requires a
focused regression test. External renderers, computed DOM property names,
HTML-string injection, dynamically registered components, and runtime CSS
injection are outside this deliberately limited source contract and should not
be introduced as class-producing routes without extending the checker first.

Five existing unstyled names are documented in `unstyled-markers.json`, scoped
to exact source files. `score-badge` and `card-metadata` are existing test hooks;
`corse-map`, `france-map`, and `world-map` are inert SVG group labels whose
rendering comes from SVG attributes. These are legacy semantic exceptions,
not missing utility definitions. Their exact scope is regression tested.

The baseline coverage test records the current 32 Vue files, 38 `:class`
bindings in 10 files, and 528 retained selector classes. If a reviewed feature
intentionally changes these counts, update that assertion together with tests
for its class-producing paths. Source mutation/call effects are inspected across complete expressions, including
negation and other abstract shortcuts, and destructured assignment targets are
invalidated. These cases are rejected conservatively rather than following mutable runtime state. Mutation tests exercise previously unseen
static utilities, both branch and helper-map edits, computed/setup output,
object projection, passed/default props, unresolved assembly, scoped rules,
entry HTML, DOM sinks, and explicit application-CSS additions.
