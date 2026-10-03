# Byte-preserved public production baseline, 2026-10-03

This fixture preserves the exact public response bodies observed at
https://localiserbien.fr between **2026-10-03 16:01:52.403217 UTC and
16:05:07.304378 UTC**. It is an HTTP capture, not a GitHub-commit claim. The
production source revision is explicitly unknown.

The capture contains **20 static files / 1,504,043 bytes**:

- All 16 literal precache entries from the real `sw.js`, including `stats.html`
- The original worker and its literal `workbox-5ffe50d4.js` import
- Two additional favicon files referenced by the captured HTML

The SHA-256 of both `capture.sha256` and `fixture.sha256` is
`52b4c89a1246327d38c15306223b8307f9b435e8c70b224cc1f5a3153380c6c6`.
The captured HTML SHA-256 is
`bfa4b7c203904faeb0afed291ac6bcd3891fa392c88f82f4a635c0c9395c02ff`;
worker SHA-256 is
`0c7fe7f2b5607dbb53e2c15fb4df9f6fb55b754c4ccc8e6ef8ca21cb8cad9e5e`.

Every non-null Workbox revision (eight entries) matches the MD5 of the exact
captured body. The eight revision-null, content-named assets are independently
SHA-256 pinned. Both index and worker were fetched again at capture end and
remained byte-identical. `http-capture.json` preserves UTC request times, status,
duration, exact origin/URL, byte counts, hashes and a whitelist of safe response
headers. No cookies, credentials or private request headers are retained.

The capture used ordinary public HTTPS GETs with certificate verification,
no redirects, no login, and bounded requests/time/size. Only observed same-origin
precache, worker and startup references were fetched. The index-referenced,
non-precached `/manifest.json` returned HTTP 404; that response is documented and
no substitute manifest is invented. The actual precached `manifest.webmanifest`
was present and revision-matched. No third-party font URLs were fetched.

## Test and preservation boundaries

The shared lifecycle test runs once with this baseline and once with the preserved
`7fe6a35` earlier-candidate baseline. Both must independently install their real
worker, upgrade an already-open application tab to the same-run candidate, replace
old caches, serve exact candidate public routes offline, and keep synthetic search
results out of CacheStorage. The old public home has different copy and no
candidate h1, so its real explanatory text and form controls are asserted before
promotion. All candidate assertions are identical between cases.

`stats.html` is retained because the real old worker precaches it. Its bytes may
be fetched and cached by the worker, but the suite never navigates to it, imports
it, or executes its scripts. The suite runs no old search and fetches no real DPE
or address records. External requests are denied in the isolated localhost
browser context. The capture's old Google Fonts references remain unmodified and
are blocked during CI. No runtime-font cache appears in the captured worker.

Git attributes preserve runtime bytes without text conversion; the formatter
excludes them. No worker, manifest, HTML or bundle is synthesized or edited. The
fixture stays outside application sources, `public/`, and production `dist/`.
There is no old dependency install, source build or toolchain modification.

## What this establishes and what it does not

A successful same-commit browser CI run establishes this exact **captured public
production artifact -> candidate** lifecycle in isolated Chromium. Offline
provenance/unit checks alone are not a browser pass. This sequential HTTP capture
is not atomic, even with consistent MD5 revisions and unchanged end hashes.
It does not prove the deployed source commit, other historical/device states,
private server files, Apache/OVH configuration, logs, retention or private backups.
A later deployment requires fresh identity checks and the separate hosting gates.

## Payload and attribution review

The captured HTML/JS/CSS, manifest and parsed statistics metadata were inspected
as inert data for recognizable credentials, private hosts/filesystem paths and
unexpected personal records. No such findings were identified. Public service
contact and provider attribution remain in the application bytes. The statistics
contain build-module paths and sizes, not original source contents or source maps.
This is a scoped inspection, not a guarantee of exhaustive secret detection.

See `THIRD_PARTY_NOTICES.txt` and `licenses/` for preserved Open Licence, MIT, ISC
and supplementary bundled-client notices. The captured legal page provides only
generic Wikimedia Commons attribution for SVG artwork; work-specific provenance
remains unresolved and is not covered by a claim of complete license clearance. Embedded notices remain byte-identical.
Do not rewrite the fixture to make a regression pass; changes require a new,
explicitly identified and reviewed capture.
