# Real PWA lifecycle regression

## Status and release gate

This is a reviewed test addition; the browser test still requires a successful CI
run. Unit tests, test discovery and lint do not constitute browser-pass evidence.
The new `pwa-lifecycle` job runs only on ordinary PR/push events. The production
deployment job is unchanged: green manual deploy checks alone do **not** establish
release readiness. Require a successful PWA job for the exact same candidate SHA,
then independently establish the actual previous-production identity and perform
authorized OVH/Apache checks before a production-ready claim.

No application logic, UI, dependencies, existing UI Playwright configuration or
production build bytes are changed. The new browser harness is excluded from
Vitest application coverage; prior coverage inputs and the 70% thresholds remain
unchanged. Frozen fixture bytes are excluded from formatting and protected against
Git line-ending conversion.

## Two actual static artifacts, one current toolchain

- Candidate: this workflow run's exact `build-artifacts`, produced by the existing
  lint/test/build job. The PWA job downloads it from the same run, without rebuilding
  or rewriting it. The recorded checkout SHA must equal the workflow's `GITHUB_SHA`.
- Baseline: a checked-in, immutable subset of an earlier verified candidate build,
  source revision `7fe6a35b66a0fd4b4813617477cb7e720d1d94a4`. Its original full
  artifact inventory SHA-256 is
  `6d240822975f7602c7286311f1026e4ec368e3fc23286517d10b6c399639c94f` and HTML SHA-256
  is `e1d790d4df3dddfaa97b9ef822fd41a162ffa6c3927d8801c7b50de4d90b389e`.

The baseline contains 20 actual files (628,713 bytes): the real worker, its imported
Workbox helper, all 15 original precache entries and required startup resources.
The full original checksum inventory and a pinned subset inventory are retained.
CI verifies exact files and bytes, original-artifact membership and provenance
before opening any browser page. Identical old/new worker or app-entry bytes fail
closed. See [the fixture README](e2e-pwa/fixtures/baseline-7fe6a35/README.md) for
omissions and preserved Open Licence, MIT and ISC attribution.

**No old package install, old compiler, source rebuild, external baseline download
or expiring artifact dependency exists.** The current locked dependency tree is
unchanged. Historical compiled fixture files are test data, not installed packages
or production output, and are never imported into the application build.

This is **earlier candidate → current candidate**, not “current production →
candidate.” The previously deployed production bytes are not established by this
fixture. Other earlier release versions, real devices and production hosting remain
separate verification targets.

`reports/pwa/builds.json` records artifact identities, candidate SHA, Node version,
worker/index hashes, real precache lists and every visible build-file SHA-256.
The fixture verifies these descriptions against the actual served files again.

## Browser sequence and assertions

1. A passive observer opens before any service worker exists. The real old app
   then installs its worker. Both tabs must acquire a genuinely activated
   controller, and every old precache response must match the original body hash.
2. Reload while still serving the old artifact to model a returning user. A
   forwarding-only listener observer waits for the app's async Workbox registration
   listeners; the real old form must render before promotion.
3. Keep both tabs open, switch the local server atomically to the candidate, and
   call `ServiceWorkerRegistration.update()` on the existing registration. Do not
   rewrite/unregister the worker, force `skipWaiting`, manipulate clocks, close old
   tabs, navigate manually or reload manually after promotion.
4. Retain the old controller object in the observer. Require a different controller,
   the old worker becoming redundant, the new worker activated, one controller
   change, the expected active registration and no worker left waiting. Record the
   actual candidate worker bytes served.
5. Observe the app's own automatic reload in the already-open tab, a new document,
   the new entry asset and a usable candidate form. A reload alone cannot satisfy
   the independent worker/controller assertions.
6. Compare every real precache URL and response body SHA-256 to the candidate.
   Verify obsolete entries disappear and a deliberately seeded incompatible
   Workbox-format sentinel cache is removed by `cleanupOutdatedCaches`.
7. Fetch synthetic same-origin results twice and require fresh responses. Run the
   candidate UI's actual search with synthetic ADEME responses and require visible
   results. CacheStorage must contain only the exact candidate precache, with no
   API response, query, result body or extra cache.
8. Disable page networking and terminate all fixture-server requests. Known public
   routes, including the FAQ redirect and query variants, must serve exact cached
   HTML via the worker, mount Vue and render the correct heading. Unknown/private
   paths, API paths and missing assets must fail rather than receive the app shell.
   Previously fetched result URLs must fail offline, with caches still unchanged.

The Node server binds an ephemeral `127.0.0.1` port and serves real files with
`no-store`. It has **no SPA fallback** and no browser-accessible promotion endpoint.
This removes server fallback and HTTP-cache false positives while using genuine
browser ServiceWorker and CacheStorage implementations.

The ordinary UI suite retains `serviceWorkers: 'block'`. This isolated Chromium
suite uses `serviceWorkers: 'allow'`, zero retries and bounded event/assertion waits,
with no fixed sleeps or hardcoded Workbox update-age thresholds.

## Network and CI boundaries

- `ubuntu-latest`, read-only repository permission, no persisted checkout
  credentials, no `pull_request_target`, production environment, deploy action,
  production credential or production test origin.
- Current lockfile only; official browser/OS installation:
  `npx --no-install playwright install --with-deps chromium`.
  No arbitrary executable override or external debugging endpoint.
- Context routing supplies synthetic ADEME/IGN responses and aborts other external
  requests. A separate deny-only proxy blocks requests that Playwright cannot
  intercept, including worker-owned requests. It never forwards or resolves an
  external destination. Only the fixture's exact loopback port bypasses it; implicit
  loopback bypass is disabled.
- Playwright 1.55 does not inspect worker requests by default. No private or
  experimental flag is enabled. Worker updates arrive through the real local server;
  offline transport is enforced there as well as at the browser context.
- Failure traces, screenshots/video, provenance and server request digests are
  retained for 14 days. Old dependencies, credentials and unrelated local files are
  not included in this evidence artifact.

## Commands

On a supported runner, with the exact current candidate artifact already in `dist/`:

```sh
npm ci
npm run test:pwa:unit
npx --no-install playwright install --with-deps chromium
node scripts/pwa/provenance.mjs record
npm run test:pwa
```

Non-browser checks use the installed toolchain and no network:

```sh
node --test scripts/pwa/*.test.mjs
node scripts/pwa/provenance.mjs verify
./node_modules/.bin/playwright test --config=playwright.pwa.config.js --list
./node_modules/.bin/biome check .
```

References: [Playwright service workers](https://playwright.dev/docs/service-workers),
[CI installation](https://playwright.dev/docs/ci), and
[browser installation](https://playwright.dev/docs/browsers).
