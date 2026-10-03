# Byte-preserved earlier-candidate baseline

These are real, already-built LocaliserBien assets from retained source revision
`7fe6a35b66a0fd4b4813617477cb7e720d1d94a4`. They are a regression baseline for
installation and upgrade, **not verified currently deployed OVH production bytes**.

Before extraction, all 238 original files were rehashed against the previously
recorded full artifact inventory. The preserved `original-artifact.sha256` records
that entire inventory; its own SHA-256 is
`6d240822975f7602c7286311f1026e4ec368e3fc23286517d10b6c399639c94f`.
The format is sorted `file SHA-256`, two spaces, relative path, then LF.

The checked-in `static/` subset is 20 files / 628,713 bytes:

- The original `sw.js` and its actual imported Workbox helper
- The original `index.html` and all 15 entries in its real worker precache
- Two extra favicons referenced by HTML, and the original `noise.svg` UI resource

Every retained runtime file is byte-for-byte identical to its original inventory
entry. `fixture.sha256` describes the exact subset; SHA-256:
`71907e2474fa702d040e7f5bf8e895ac5a4b48a1d9b56de9a4e27f8007d1d26e`.
The verification code rejects changed manifests, missing/extra files, changed bytes,
symlinks, unsafe paths and a fixture entry absent from the original inventory.
Git attributes preserve the runtime files as binary fixture data, preventing
line-ending normalization, text merges and whitespace rewrites. Biome does not
rewrite the frozen assets. Original whitespace is deliberately preserved. No worker or manifest is synthesized, and no old source compiler or
package installation is needed. The fixture remains available after CI artifacts
expire and adds no application dependency.

## Intentional omissions and limits

218 files are omitted: department/geographic JSON and the non-precached commune
name-index chunk, unused icon variants, social metadata images, robots/sitemap
resources/templates, the example manifest, and `.htaccess`. The lifecycle test
opens the old home form and updates its worker; it does not run the old geographic
search or claim complete old-site functionality. The new candidate is a complete
same-run build and receives the synthetic search and offline public-page checks.

Only genuine built bytes are served from this subset. The Node fixture server
has no SPA navigation fallback and adds a separate passive lifecycle observer and
synthetic API endpoint outside the retained bytes. Offline navigation must be
provided by the real worker. Apache/OVH configuration is not simulated.

This fixture never enters `public/`, the application module graph, or production
`dist/`. Its old bundled browser code executes only in the isolated localhost CI
context with synthetic data and external networking denied.

## Attribution

Source: https://github.com/Aurfi/DPE-LocaliserBien

See `THIRD_PARTY_NOTICES.txt` and `licenses/`. Original embedded notices are
preserved in every runtime asset, including MIT and ISC notices. The application's
Open Licence 2.0 text is retained alongside the fixture. Do not regenerate or
edit the baseline to make an upgrade failure disappear. Updating the baseline
requires a separately identified artifact, reviewed hashes and explicit review.
