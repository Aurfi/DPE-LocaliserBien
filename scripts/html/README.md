# Native Vite HTML environment

`index.html` uses Vite's native `%VITE_HTML_*%` substitutions. The small
`environment.mjs` helper supplies compile-time `define` aliases, without an HTML
plugin or another dependency. The original `VITE_*` values and `process.env` are
not changed, so application configuration and the PWA manifest still receive
unescaped values. The `VITE_HTML_*` alias namespace is reserved for this template.

HTML text/attribute aliases escape `&`, `<`, `>`, double quotes and apostrophes.
JSON-LD aliases instead serialize the complete string with `JSON.stringify`,
including the URL suffix where needed, then Unicode-escape HTML delimiters and
Unicode line separators. Do not wrap a JSON-LD placeholder in additional quotes,
and do not use an HTML-escaped alias in a JSON-LD block.

All nine required source variables must be nonempty strings. Configuration fails
with the names of missing/blank variables, without printing their values. Both
the development server and production build use the same helper. The old HTML
minifier is intentionally absent; indentation and comments in the HTML output are
harmless and no replacement minification plugin is installed.

## Verification

Run `node --test scripts/html/*.test.mjs` after installing the project dependencies.
The suite uses Vite's actual native HTML transform in middleware mode, with no
listening HTTP server, browser, application plugins or full build. Existing
`happy-dom` provides inert document parsing; script evaluation and external CSS/JS
loading are disabled.

`fixtures/baseline-seo.json` contains the title, canonical URL, 33 meta tags,
public HTML environment values and all six parsed JSON-LD blocks from the frozen
final candidate's production output, captured on 3 October 2026. Its source HTML
SHA-256 is recorded in the fixture. The viewport tag is excluded from the string
comparison because the old minifier normalized its whitespace and `1.0` value;
its source markup is unchanged.

The baseline had one genuine serialization defect: the two environment-derived
JSON-LD descriptions contained the literal text `l&#39;identification`. Script
contents do not decode HTML entities. The comparison explicitly corrects only
those two descriptions to the original environment value, `l'identification`,
then requires deep equality of every field in all six schemas. No schemas,
static FAQ text, search action or other SEO content were removed or rewritten.

Special-character cases separately verify apostrophes, quotes, ampersands, angle
brackets, backslashes, newlines and Unicode line separators in HTML and parsed
JSON-LD. The suite also covers every missing/blank variable, unchanged source
environment values, all template aliases and Vite's nonrecursive substitution.
These focused tests do not replace the full production build, built-site checks,
unit suite or browser/PWA release gates.
