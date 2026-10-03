# Ordinary CSS maintenance

Tailwind CSS and the HTML compilation helper have been retired from this project.
There is no Tailwind compiler, generation command, configuration loader, or purge
step. Builds use Vite, Vue's scoped-style compiler, PostCSS, and Autoprefixer.

## Provenance and cascade

The CSS was migrated once from the independently validated calendar-date
candidate of 3 October 2026. `src/styles/provenance.json` records the original
source/configuration and output identity, the exact former configuration as
historical data, and retained CSS hashes. Retained rules came from the expanded
original global stylesheet, not from a combined bundle containing Vue scope IDs.
The old unused app selectors that Tailwind did not emit remain absent; this
migration preserves the validated output rather than reviving unused styles.

The imports in `src/style.css` preserve this precise order:

1. `retained-foundation.css`: Tailwind 3.4.19 reset and custom-property defaults.
2. `app-base.css`: editable app defaults, theme and accessibility rules.
3. `retained-container.css`: the six former framework container rules.
4. `app-components.css`: editable app-owned semantic component rules.
5. `retained-utilities.css`: the finite existing utility vocabulary.

The container rules originally appeared between app base and component rules;
they have deliberately not been moved. These are ordinary unlayered styles.
Adding native cascade layers would change precedence. Application base/component
CSS is editable; preserve import order and selector specificity when changing it.

`FormulaireRechercheDPE.vue` still owns its scoped styles. The three former
compiler directives were expanded into the four selectors actually emitted,
including the composed hover selector. Vue continues to generate scope IDs on
each build; no bundled or previously scoped stylesheet was copied back.

## Future changes

Prefer explicit semantic classes and ordinary CSS for new UI. Existing names in
`src/styles/retained-utilities.classes.json` may be reused. Adding an arbitrary
framework-looking class does not generate a rule. The class-coverage check runs
before development/build and in CI; it checks static and reviewed dynamic class
sources against retained or app-defined styles. Keep new conditional branches
and helper outputs finite and reviewable. Do not bypass the check with an
unbounded class-construction pattern or an indiscriminate allowlist.

The checker separately records five exact pre-existing unstyled marker names
(three map group labels, card-metadata and score-badge), scoped to their original
files with reasons. Those markers are not a utility allowlist; they do not gain
styles in this migration.

Do not reinstall the old compiler to regenerate this stylesheet. If a future
redesign needs a new styling system, treat that as a separately reviewed migration.
Do not automatically purge retained rules: a rule may be used in an uncommon
state, a responsive variant, a dynamic branch, or a component loaded on demand.

## License

The application license does not replace the Tailwind license. Each retained
source stylesheet includes Tailwind Labs' complete MIT notice. The same notice
ships as `THIRD_PARTY_NOTICES.txt` in the public site. Keep those notices when
redistributing or modifying this retained CSS.

## Verification boundary

Ordered CSS selectors and declarations, HTML metadata and six structured-data
blocks, application module graphs, source logic identity, artifact sizes, and
205 department JSON files are compared with the validated candidate. Exact
built-file identity is not expected: CSS scope IDs, file hashes, license text,
HTML formatting, and corrected JSON-LD apostrophe serialization can change.
Unit, policy and artifact checks do not replace desktop/mobile light/dark and
real-service browser review of the final frozen output.
