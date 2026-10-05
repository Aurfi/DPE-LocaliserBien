# Reviewed SFTP releases

Production uses the existing `ovh-production` environment and
`localiserbien-production` concurrency group. It uses the existing
`FTP_SERVER`, `FTP_USERNAME` and `FTP_PASSWORD` secrets over encrypted SFTP.
The previously approved Ed25519 pin is unchanged:
`SHA256:6053kGsbCzj0rOIpNAz9SNbToAfBc/rUoX/LlnG1AhY`.
No host-key learning, credential creation, new permission or trust-store update
is part of this route. The Actions token remains read-only and checkouts never
persist credentials.

## Ordinary changes do not deploy

`release-intent.json` starts with `{"schema":1,"operation":"none"}`.
Pull requests, non-main pushes, and main pushes that do not change that file
cannot activate production. An old intent left in the tree is inert on later
pushes. Merging this workflow without an active intent does not deploy anything.

## Prepare and review one release

1. Land and test the application and any immutable public recovery fixtures on
   main. Keep the recovery bytes in `public/` or `e2e-pwa/fixtures/`, at an exact
   ancestor commit. Never put hosting archives, secrets or private configuration
   into the repository, staging area, logs or artifacts.
2. Inspect the exact successful CI `build-artifacts` candidate. Generate a schema-2
   `public-release-plan.json` with every candidate path, its reviewed live before
   hash (or verified absence), candidate after hash and public recovery source.
   The engine verifies every live path again before its first staging write and
   before promotion. For any changed existing file, recovery bytes must hash to
   its approved before value. Old immutable assets are retained, never overwritten
   with different bytes or deleted.
3. Review the plan, candidate digest, live index hash, existing route-config hash,
   unique release ID, recovery procedure and exact application commit. Set an
   active intent with exactly these fields:
   - `schema`: `1`
   - `operation`: `"deploy"`
   - `reviewed_application_commit`: exact 40-character current main commit
   - `plan_sha256`: `ovh_release.plan_digest(plan)` (canonical JSON SHA-256)
   - `candidate_sha256`: `ovh_release.build_digest(inventory("dist"))`
   - `expected_index_sha256`: approved live index hash, matching the plan
   - `expected_htaccess_sha256`: approved existing configuration hash, matching
     the candidate `.htaccess` bytes; the configuration is preserved, not uploaded
   - `release_id`: unique 8–101-character alphanumeric/hyphen/underscore identifier
4. Only after release approval, make a single commit directly on that reviewed
   main commit, changing `release-intent.json` and optionally
   `public-release-plan.json`. No application, workflow, dependency, test or
   recovery-source file may change in this commit. Push that one commit to main.
   A squash-merged release-only PR is also acceptable if its sole parent is the
   exact reviewed main commit. A multi-commit push or merge commit fails closed.
5. The existing production environment gate is still applied by GitHub. Lint,
   unit/coverage, dependency policy, offline SFTP safety, PWA lifecycle and product
   browser tests must all pass. Deployment downloads the same run's tested build;
   it cannot silently rebuild or substitute it. The protected job revalidates the
   intent, digest, pinned recovery checkout and current-main observation before
   connecting to hosting. That main-branch check is a point-in-time observation;
   main can advance while a transfer is running. Every candidate before-hash and the preserved config
   hash must still match. Unique staging, overwrite-rename probing, readbacks,
   service-worker-last promotion and final hash verification remain mandatory.
6. Verify public HTTP/routing, mobile layout and old-tab/PWA behavior before
   reporting the release complete. Retain the release commit, plan, source commit
   and release ID for recovery. CI file readbacks alone are not full live QA.

There is no need to edit the workflow for each release. An unchanged stale
intent never automatically publishes another copy change. A changed main or live
hash requires renewed review, rather than bypassing the guard or weakening trust.

## Manual entrypoints

Actions → CI/CD Pipeline → Run workflow → `preflight` uses pinned SFTP and is
read-only. It prints hashes and safe status, never credentials or config contents.

Manual `deploy` uses exactly the same active-intent and test gates. Run it on the
release-only main commit and supply that exact commit as `reviewed_commit`, the
intent's live hash as `expected_index_sha256`, and `preserve` for `htaccess`.
This is an alternate entrypoint, not a requirement for the normal release-intent
push. The reusable route does not support replacing or introducing `.htaccess`.

## Failure and recovery

No automatic rollback runs after an uncertain transfer. Stop and inspect first;
do not blindly reuse a release ID or rerun a partially promoted release. The
manual **Recover a reviewed OVH release** workflow now uses the same SFTP pin
and retains its existing `OVH_RELEASE_ENABLED` environment-variable gate. It also
requires an explicitly reviewed current `.htaccess` hash. This preserve-only
workflow rejects legacy plans that would remove an introduced `.htaccess` before
any recovery write; those require a separate configuration-recovery review. The engine's rollback
command remains available with separately approved
recovery action, exact original plan/release commit, immutable recovery checkout,
current live index hash and release ID:

```sh
python3 scripts/deployment/ovh_sftp_release.py rollback \
  --reviewed-commit "$GITHUB_SHA" \
  --plan /path/to/original-public-release-plan.json \
  --plan-commit ORIGINAL_RELEASE_COMMIT \
  --baseline-root /path/to/pinned-public-recovery-checkout \
  --expected-index CURRENT_LIVE_INDEX_SHA256 \
  --expected-htaccess APPROVED_PRESERVED_CONFIG_SHA256 \
  --htaccess preserve --release-id ORIGINAL_RELEASE_ID
```

Run only in an authorized main production context using the existing credentials,
host pin and `OVH_RELEASE_ENABLED=reviewed-and-approved` gate. Rollback validates
the public manifest and exact plan, allows only known before/after states,
refuses unrelated live drift, restores verified public bytes, leaves added assets
for newer tabs, and performs readbacks. It does not delete unknown files, copy
private configuration or automatically clean up stages. Verify HTTP and PWA
recovery afterward.
