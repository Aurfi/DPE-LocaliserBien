# OVH release and recovery runbook

## Current verification boundary

This is prepared tooling, not a completed deployment. The release branch and
pull request do not authorize FTP login, live writes, production-environment
configuration or recovery operations. Unit tests use an in-memory FTP double; they do **not** prove
OVH credentials, explicit-FTPS compatibility, server permissions, rename
atomicity, private-directory isolation, or HTTP behavior.

The tool replaces the previous third-party FTP synchronization action. It uses
Python's standard library, the existing three secret names, and explicit FTPS on
port 21. It requires trusted certificates and matching hostnames, TLS 1.2 or newer,
and protected data connections. There is no plaintext/insecure-TLS fallback.

An existing readable live `sw.js` is required. Deployment refuses a missing worker
before any remote write. First-time service-worker installation is unsupported
until a separate recovery plan is designed and tested: retaining newly introduced
public files during rollback would otherwise leave the new worker in place.

## Owner/admin checks before any production write

1. Review the final commit, tests and browser evidence. Complete publisher/privacy
   requirements, real-device checks, service-worker upgrade checks and the hosting
   verification gates below. Do not approve
   a different commit from the one actually reviewed. No dependency upgrades are
   included in this tooling.
2. Confirm the existing OVH multisite document root is `./www/` relative to the FTP
   account's initial directory. The tool deliberately does not guess an alternative
   root or adapt silently to a user jailed directly into `www`.
3. Inspect **every** OVH multisite mapping, aliases and symlinks. Confirm the sibling
   directory `./.localiserbien-releases/` is outside **all** HTTP document roots and
   cannot be served through an alias or symlink. A leading dot alone is not privacy
   protection. If this cannot be established, do not enable deployment. Use a
   separately designed private backup/staging route instead.
4. Ensure enough private storage for both the before-images of changed files and
   staged new files. Preserve an independent private full-site backup as recovery material. This tool snapshots only changed release files; it is not a
   full-account backup or a substitute for that archive.
5. Configure the GitHub environment `ovh-production`, restrict deployments to main,
   and configure an appropriate required reviewer. Referencing an environment in
   YAML does **not** create its protection rules. Verify feature availability on the
   repository's GitHub plan. Moving credentials or changing their access scope is a
   separate owner/admin security action; this runbook does not authorize it.
6. Reuse `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`. The server value must be a bare
   certificate-matching hostname, not a URL or IP substitution. Do not paste
   credentials into chat, workflow inputs, source, command arguments or artifacts.
   A certificate/authentication error is a stop condition, never a reason to weaken
   certificate validation. Actual FTPS support remains to be checked.
7. Only after the preceding checks and appropriate approval, set these non-secret
   environment variables on `ovh-production`:
   - `OVH_PRIVATE_BACKUP_CONFIRMED=outside-all-document-roots`
   - `OVH_RELEASE_ENABLED=reviewed-and-approved`
   These are explicit fail-closed guards, not independent evidence that checks were
   performed. Leave them unset until the checks are genuinely complete.
8. Coordinate a single writer during publication/recovery: no manual FTP edits,
   parallel deployments from other workflows, or hosting-panel restores. The
   shared GitHub concurrency group serializes these two workflows only.

## Read-only preflight

After the reviewed workflow is authorized and present on main, manually run
`CI/CD Pipeline` with operation `preflight`. Pushes and pull requests build/test
but do not use FTP secrets or publish. A manual preflight skips the frontend
build/test and dependency-policy jobs. Deployments, pushes and pull requests retain
those checks. Preflight needs no enabling variables.

The preflight only authenticates with protected FTPS, navigates/lists directories,
and reads `index.html` and `.htaccess`. It prints the public entrypoint fingerprint,
the configuration fingerprint (never its contents), and explicit unverified flags.
It issues no STOR, MKD, RNFR/RNTO, DELE or CHMOD. It does not test write permission,
backup privacy, available capacity or rename behavior. It does not fetch unrelated
FTP content or expose account/directory listings in logs.

`absent-or-inaccessible` for `.htaccess` is deliberately ambiguous: a server can
hide dotfiles or deny their retrieval. Inspect it privately in OVH or an authorized
client before asserting absence. The previous uploaded archive did not include
`.htaccess`; that is not evidence that the live server lacks one.

Existing configuration choices for a later deployment:
- `preserve` (default): never overwrite the live `.htaccess`. Existing live routing
  must then be tested; new route fixes are not guaranteed to be active.
- A 64-character SHA-256: privately inspect the exact current file and approve its
  replacement with the reviewed route-only build configuration. Deployment fails
  if the live fingerprint differs. A hash by itself is not a review of its meaning.
  If it contains rules that must survive, merge them into the candidate first and
  repeat review/testing; the tool does not merge unknown configuration. Never put
  credentials or private server configuration into public source/build artifacts.
  If a merge cannot safely be public, preserve the file and use a separately
  authorized private server-side configuration change.
- `confirmed-absent`: an explicit owner confirmation of verified live absence,
  authorizing installation of the reviewed build `.htaccess`. A listed but
  unreadable file blocks, and an existing readable file blocks.

## Deploy the exact reviewed build

Manually run the CI workflow on main with operation `deploy`, the exact full
`reviewed_commit`, a fresh `expected_index_sha256` from preflight, and the chosen
`htaccess` policy. Approve the environment gate only after the release checklist.
Inputs are passed through quoted environment variables, not interpolated into shell
commands. Runtime checks bind the reviewed SHA to `GITHUB_SHA` and main.

Lint, frontend tests with coverage thresholds, offline deployment tests, build,
built-site validation and the dependency-policy job must all pass. Full and
production npm audits must report zero findings, with no advisory exceptions.
Raw audits, installed-tree and browser-module evidence are retained outside the
public build. The deployment job downloads **this run's** build and checks it again.
A successful PWA lifecycle job for the exact same candidate SHA is also a release
review requirement; the manual deployment job alone does not establish it. See
PWA_LIFECYCLE_TESTS.md for its scope and the separate prior-production identity gate.

The tool then:
1. Reads current versions of candidate paths and computes a change plan. It refuses
   unsafe paths/types/symlinks it can identify, oversize files, and different bytes
   at an existing immutable asset name.
2. Creates a unique private release directory. It probes overwrite-rename within
   that private directory; failure stops before live file promotion.
3. Copies changed previous files to private `before/`, and uploads new bytes into
   private `stage/`. Every copy is downloaded and SHA-256 checked. This includes any
   reviewed previous `.htaccess`; its bytes never go to GitHub artifacts or logs.
4. Writes/readbacks the private manifest **before** modifying live files and prints
   its recovery release ID. Keep this ID with the authorized release record. If
   stopped before a manifest exists, live file promotion has not started.
5. Rechecks the before-state and then promotes staged files by rename, assets/data
   first, `index.html` next, optional `.htaccess` next, `sw.js` last. Every promoted
   file is read back. The target is never deleted first. No failed rename is worked
   around by deleting the old target.

Old hashed assets and unrelated files remain in place. No deployment manifest from
another tool is consumed, no broad cleanup runs, and no retention expiry deletes
backups. Storage growth is intentional until the owner approves a separate,
reviewed cleanup after the old-tab/rollback window.

**Atomicity limit:** this is per-file rename-based promotion, not an atomic whole-
site switch. Real OVH cross-directory overwrite behavior and its filesystem
atomicity still need verification. A private probe checks only basic capability.
Stable-name data/manifest files can briefly represent different release generations;
releases must remain backward compatible. Changing `index.html` and the service
worker cannot be one FTP transaction. Existing service-worker caches are browser
state and are not reversed merely by restoring server files. Incompatible schema,
base-path or SW migration changes need another deployment design.

After file readback, verify public HTTPS homepage, exact JS/CSS bytes or build
identity, direct deep routes, genuine 404s for missing assets, one bounded search,
new/reloaded tabs, and an already-open previous-release tab. Passing FTP readback
is not successful HTTP/device QA. Record failures and use an explicitly authorized
recovery if needed; the workflow never silently auto-rolls back.

## Recover a specific private snapshot

Recovery is a separate manual workflow, `Recover a reviewed OVH release`. It does
not require a new frontend build/dependency install, so broken build infrastructure
need not prevent recovery. It runs the offline tool tests before the secret step.

1. Obtain authorization to restore the specific release snapshot. Run a fresh
   read-only preflight and review the current fingerprint and live situation.
2. Select main and supply the reviewed current commit containing the recovery tool,
   the original `release_id`, and the current live index fingerprint.
3. Approve the same environment protection gate. Runtime enabling variables and
   main/commit/fingerprint checks still apply.
4. The tool verifies every backup before writing, and requires every changed live
   file to match either that release's before-state or after-state. This supports
   an interrupted partial promotion. Unrelated edits or corrupt backups block the
   entire recovery before the first write; resolve those privately rather than
   forcing restoration over unknown changes.
5. Prior bytes are staged privately and promoted in the same safe order. Newly
   introduced hashed assets/data are retained for already-open newer tabs. If the
   release introduced `.htaccess`, restoring its confirmed prior absence moves the
   file back into private storage, rather than deleting it. Existing routing config
   is restored only if it was explicitly replaced by this release.
6. Repeat HTTPS/routes/search/new-tab/old-tab/service-worker checks. Report recovery
   as verified on OVH only once those actual checks pass.

Recovery restores prior versions of changed files, not the exact previous directory
listing. It deliberately retains newly added public files and old assets. The
private snapshot is retained even after success. A later release or manual live
edit may cause an older snapshot's automated recovery to refuse; do not bypass the
fingerprint guard. A connection loss after a rename has an uncertain result: use
preflight and inspect the private snapshot before deciding what to retry.

## Local verification (no credentials or network)

```sh
python3 -m unittest discover -s scripts/deployment -p 'test_*.py' -v
node scripts/check-built-site.mjs
npm run lint
git diff --check
```

The deployment tests use an in-memory FTP double, including TLS call-order mocks,
failed rename, corrupt transfer, drift, partial promotion, configuration handling,
private snapshots, and rollback. They do not implement or test a real FTPS server.
No production credentials are needed or read by these tests.

## Primary references

- [Python FTP_TLS and protected data connections](https://docs.python.org/3/library/ftplib.html#ftplib.FTP_TLS)
- [Python verified TLS contexts](https://docs.python.org/3/library/ssl.html#ssl.create_default_context)
- [OVH hosting FTP/SFTP connection information](https://docs.ovhcloud.com/en/guides/web-cloud/web-hosting/ftp-connection)
- [GitHub deployment protection and environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
- [GitHub manually running workflows](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)
