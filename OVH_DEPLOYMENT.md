# OVH public-static release and recovery

## Verification boundary

This is prepared tooling, not a completed OVH deployment. A branch or pull request
does not authorize FTP login, secret access, live writes, environment configuration,
or recovery. Offline tests use an in-memory FTP double and do not prove actual OVH
FTPS support, destination permissions, rename atomicity, or HTTP/device behavior.

The existing owner-held archive is useful recovery material. A second copy in a
private OVH directory is not a prerequisite for this public-static release. The
reviewed recovery plan identifies exact old public bytes already available at a
pinned commit in this public repository. The whole hosting ZIP, private account
files and server configuration must never be uploaded to GitHub or public staging.

A complete fresh authenticated comparison is still mandatory immediately before
any deployment writes. A historical ZIP, matching homepage, or sampled HTTP check
alone does not prove the entire current origin state. The deployment command reads
every planned candidate path and blocks unexpected hashes or supposed additions
that already exist. The earlier HTTP verification attempt was incomplete and is
not treated as a current whole-site snapshot.

## Public recovery plan

`scripts/deployment/public-baseline.json` describes previously observed public
paths, their SHA-256 hashes, and exact public source locations. Its source commit
is immutable. `public-release-plan.json` binds an explicitly selected candidate:
its complete path/hash inventory, before/after hashes, and public before-images.
The tool verifies every needed before-image before contacting OVH, then verifies
the actual live before-state before creating even a staging directory.

Generate a plan locally for the exact candidate being reviewed:

```sh
python3 scripts/deployment/make_public_plan.py \
  --dist dist \
  --baseline-root PATH_TO_PINNED_PUBLIC_SOURCE_CHECKOUT \
  --output scripts/deployment/public-release-plan.json
```

Review and commit the generated plan with the release. Generation does not approve
it or assert that production still matches it. Candidate paths/hashes must match
that plan exactly at deployment time. A changed candidate needs a new plan and
review; the generator does not assume a fixed file count or department-data layout.
An existing file without an available exact public before-image cannot be changed.

Only candidate paths are planned. Files omitted from the new build are neither
overwritten nor deleted. In particular, moving compact geography data to versioned
URLs must retain the older `/data/departments/` files for old open tabs. This reduces
new-release payload, not necessarily immediate total hosting disk use.

The current baseline is release-specific, not an automatic backup discovery
framework. Unexpected origin changes, privately configured files, or a different
existing immutable asset must stop the release and be reviewed separately.

## Owner/admin checks

1. Review the actual final commit, exact build, public plan, tests, dependency and
   browser evidence. Complete publisher/privacy, real-device, old-tab and routing
   checks. A successful PWA lifecycle run for the final candidate remains required;
   the manual deployment job by itself does not establish this.
2. Confirm the actual website document root is `./www/` relative to the FTP login's
   initial directory. This tool does not guess another root or silently adapt to a
   login jailed into `www`.
3. Confirm adequate hosting space for public staging and retained asset generations.
   There is no private backup directory or need to prove all multisite roots for
   backup privacy. Staging is deliberately public and contains only reviewed public
   build bytes, public hash metadata, and already-public recovery bytes.
4. Keep `ovh-production` restricted to main with an appropriate required reviewer.
   YAML does not establish those environment protections. Verify plan availability.
   Changing credential scope or security settings requires separate authorization.
5. Reuse `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD` only in the existing approved
   secret context. Do not copy them into chat, command arguments, source or artifacts.
   Use a certificate-matching hostname, explicit FTPS on port 21, TLS 1.2 or newer,
   certificate/hostname verification and protected data connections. No plaintext
   or insecure-certificate fallback is supported.
6. Only after authorization and the preceding checks, enable
   `OVH_RELEASE_ENABLED=reviewed-and-approved`. It is a fail-closed guard, not proof
   of the checks. No `OVH_PRIVATE_BACKUP_CONFIRMED` variable is needed by this design.
7. Coordinate one writer: no manual FTP editing, other deployment workflows or
   hosting restores during publication/recovery. GitHub's shared concurrency group
   serializes these workflows only.

## Configuration is separate

- `preserve` is the default and never changes `.htaccess`. Direct-route behavior
  must then be checked against the existing server configuration.
- `confirmed-absent` requires explicit owner verification that `.htaccess` really
  is absent and approval to install the reviewed public route-only configuration.
  A missing file in the ZIP or an HTTP 403/404 does not prove absence. An FTP 550
  can also mean unreadable; verify hidden-file behavior privately before approving.
  An existing readable or listed-but-unreadable configuration blocks installation.
- Replacing existing unknown/private configuration is unsupported by this public
  recovery path. Preserve it and review a separate authorized configuration change.
  Never stage a private configuration file in this design.

If the release introduced the reviewed route-only `.htaccess`, rollback verifies
its exact known public bytes and moves it out of the active path, restoring its
confirmed prior absence. It never deletes an existing private configuration.

## Read-only FTPS preflight

After the workflow is authorized and available on main, manually run `CI/CD
Pipeline` with operation `preflight`. It authenticates using verified FTPS,
navigates/lists the expected destination, and reads `index.html` and `.htaccess`.
It prints fingerprints and explicit unverified flags, never configuration bytes.
It performs no STOR, MKD, RNFR/RNTO, DELE or CHMOD. This quick preflight does not
replace deployment's full targeted before-state comparison or test write/rename
capability. A credential or certificate boundary is a stop, not a bypass request.

## Deploy the reviewed candidate

Manually run on main with operation `deploy`, exact full `reviewed_commit`, a fresh
`expected_index_sha256`, and the approved configuration policy. Environment approval,
main/SHA binding, lint, coverage tests, offline release tests, built-site validation,
full and production dependency audits remain required. Pushes and PRs do not publish.
The job uses that run's exact build and checks out the pinned public recovery source
with read-only repository permissions and `persist-credentials: false`.

The tool:
1. Validates the exact build/plan and every required public before-image locally.
2. Reads every planned origin path. Any unexpected bytes, existing supposed addition,
   unsafe directory/file type, or immutable-name collision blocks every remote write.
3. Creates a unique `_localiserbien-stage-RELEASE_ID/` below `www`. This is intentionally
   public. It probes overwrite-rename there using harmless public text, then stages
   reviewed new bytes with hash readback. No private archive/configuration is copied.
4. Writes/readbacks a public recovery record containing the original release commit,
   plan hash, release ID, configuration choice and initial public index hash. Keep
   the original full release commit and release ID with the release record. The full
   reviewed plan remains retrievable from that immutable repository commit.
5. Rechecks the full before-state, promotes assets/data first, index next, optional
   reviewed new route configuration next, and service worker last. Each target is
   renamed over without delete-first fallback, then read back. A final whole-plan
   hash check runs before reporting FTP-level success.

No broad sync, destructive cleanup, manifest-based deletion or backup expiry runs.
Old hashed assets, omitted legacy data and unknown unrelated files remain untouched.
Failures do not silently trigger rollback. If a connection drops after rename, its
outcome is uncertain: obtain a fresh fingerprint and inspect the release record.

This is per-file promotion, not a whole-site transaction. The rename probe proves
basic capability only, not actual filesystem atomicity. Stable names can briefly
represent mixed generations. Use backward-compatible data or versioned paths.
Restoring server files does not itself reverse browser service-worker state.

After file checks, verify HTTPS homepage/build identity, deep routes, genuine missing
asset 404s, one bounded search, new/reloaded tabs, an open previous-generation tab,
and service-worker recovery behavior. FTP readback alone is not HTTP/device QA.

## Recover the specific release

Recovery is a separate explicitly authorized manual workflow. Select main and pass:
- `reviewed_commit`: current reviewed main commit containing the recovery tool
- `release_plan_commit`: original deployed full commit containing that release's plan
- `release_id`: original printed recovery ID
- `expected_index_sha256`: fresh current live index fingerprint

The workflow checks out the original plan at its full commit even if main has since
advanced, then checks out that plan's pinned public before-image source. It needs no
fresh frontend build, npm installation or expiring build artifact. It verifies the
public server recovery record against the original commit and local plan hash.

Before writing, every affected live file must match that release's before or after
hash, and all recovery bytes must be intact. Partial promotions can be recovered;
unrelated manual/later-release edits block rollback. Public before-images are staged,
read back and promoted in the same safe order. Newly added public assets/data remain
for open newer tabs. Final hashes/absence are checked, then repeat HTTP/PWA/device QA.

Recovery restores the prior release behavior, not an exact directory listing. A
rollback deliberately retains introduced public files. This conservative plan expects
those additions absent at a fresh deployment, so redeploying after rollback requires
an updated reviewed baseline/plan that accounts for retained files; do not bypass the
before-state guard. Staging cleanup is a separate owner-approved operation.

## Offline checks

```sh
python3 -m unittest discover -s scripts/deployment -p 'test_*.py' -v
python3 -m py_compile scripts/deployment/ovh_release.py scripts/deployment/make_public_plan.py
node scripts/check-built-site.mjs
npm run lint
```

Focused fake-FTP tests cover immutable collisions, absent/unknown paths, full-surface
drift, incomplete promotion, intact/corrupt recovery sources, plan/commit identity,
public-only staging, configuration preservation/absence, retained assets/data,
TLS ordering, redacted errors and final-state guards. They do not use credentials
or contact production.

## References

- [Python FTP_TLS](https://docs.python.org/3/library/ftplib.html#ftplib.FTP_TLS)
- [Python verified TLS contexts](https://docs.python.org/3/library/ssl.html#ssl.create_default_context)
- [OVH hosting FTP/SFTP connections](https://docs.ovhcloud.com/en/guides/web-cloud/web-hosting/ftp-connection)
- [GitHub deployment environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
