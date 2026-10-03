#!/usr/bin/env python3
"""Conservative, explicit-FTPS release tool. No sync, broad delete, or TLS fallback.

Preflight is read-only. Deploy/rollback require exact release/live fingerprints and
a reviewed public recovery plan. Private hosting files are never copied or staged.
"""
import argparse
import ftplib
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import ssl
import sys
import uuid

MAX_BYTES = 64 * 1024 * 1024
STAGE_PREFIX = '_localiserbien-stage-'
PLAN_FILE = Path(__file__).with_name('public-release-plan.json')
SHA256 = re.compile(r'^[a-f0-9]{64}$')
COMMIT = re.compile(r'^[a-f0-9]{40}$')
RELEASE = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_-]{7,100}$')
SAFE_PATH = re.compile(r'^[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*$')
PUBLIC_EXTENSIONS = {'.html', '.js', '.css', '.json', '.png', '.ico', '.svg', '.txt',
                     '.xml', '.webmanifest', '.template', '.woff', '.woff2'}


class ReleaseError(Exception):
    """A message constructed by this tool, safe to print without server details."""


def require(condition, message):
    if not condition:
        raise ReleaseError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def relative_path(name):
    require(isinstance(name, str) and SAFE_PATH.fullmatch(name), 'Unsafe release path.')
    parts = PurePosixPath(name).parts
    require(all(p not in ('.', '..') for p in parts), 'Unsafe release path.')
    require(not any(p.startswith('.') for p in parts) or name == '.htaccess',
            'Unexpected hidden release path.')
    require(name == '.htaccess' or PurePosixPath(name).suffix in PUBLIC_EXTENSIONS,
            'Unexpected release file type.')
    return name


def immutable_path(name):
    return name.startswith('assets/') or bool(re.fullmatch(r'workbox-[A-Za-z0-9_-]+\.js', name))


def promotion_order(name):
    # All assets and mutable data first; entry HTML next; SW only after its precache.
    return ({'index.html': 1, '.htaccess': 2, 'sw.js': 3}.get(name, 0), name)


def inventory(dist):
    root = Path(dist)
    require(root.is_dir() and not root.is_symlink(), 'Build directory is missing or unsafe.')
    files = {}
    for path in sorted(root.rglob('*')):
        require(not path.is_symlink(), 'Build symlinks are forbidden.')
        if path.is_dir():
            require(not any(p.startswith('.') for p in path.relative_to(root).parts),
                    'Unexpected hidden build directory.')
            continue
        name = relative_path(path.relative_to(root).as_posix())
        require(path.is_file() and path.stat().st_size <= MAX_BYTES, 'Invalid build file size.')
        files[name] = path.read_bytes()
    require({'index.html', 'sw.js', '.htaccess', 'manifest.webmanifest'} <= files.keys(),
            'Build is missing required entry/configuration files.')
    require(len(files) <= 2000, 'Unexpected build file count.')
    require(b'RewriteRule' in files['.htaccess'], 'Reviewed routing configuration is missing.')
    return files


class Remote:
    def __init__(self, ftp):
        self.ftp = ftp
        self.home = ftp.pwd().rstrip('/') or '/'
        ftp.cwd('./www')
        self.web = ftp.pwd().rstrip('/')
        require(self.web and self.web != self.home and self.web.endswith('/www'),
                'Document root did not resolve to the expected www child.')
        ftp.cwd(self.home)

    def entries(self, directory):
        # Do not interpret a 550 listing/permission failure as an empty directory.
        return dict(self.ftp.mlsd(directory, facts=['type', 'size']))

    def optional(self, path):
        parent, name = path.rsplit('/', 1)
        facts = self.entries(parent).get(name)
        if facts is None:
            # Dotfiles can be omitted by a server's directory listing. Try a direct
            # read; a 550 is ambiguous and .htaccess absence needs owner verification.
            if name == '.htaccess':
                try:
                    return self.read(path)
                except ftplib.error_perm as error:
                    if str(error).startswith('550'):
                        return None
                    raise
            return None
        require(facts.get('type') == 'file', 'A release target is not a regular file.')
        require(int(facts.get('size', '0')) <= MAX_BYTES, 'Remote file exceeds safety limit.')
        return self.read(path)

    def web_optional(self, name):
        current = self.web
        for part in PurePosixPath(name).parts[:-1]:
            facts = self.entries(current).get(part)
            if facts is None:
                return None
            require(facts.get('type') == 'dir', 'A release directory is not a regular directory.')
            current += '/' + part
        return self.optional(self.web + '/' + name)

    def read(self, path):
        stream = io.BytesIO()
        def receive(chunk):
            require(stream.tell() + len(chunk) <= MAX_BYTES, 'Remote file exceeds safety limit.')
            stream.write(chunk)
        self.ftp.retrbinary('RETR ' + path, receive)
        return stream.getvalue()

    def mkdir(self, path):
        parent, name = path.rsplit('/', 1)
        facts = self.entries(parent).get(name)
        if facts is None:
            self.ftp.mkd(path)
        else:
            require(facts.get('type') == 'dir', 'A required directory is not a regular directory.')

    def parents(self, base, name):
        current = base
        for part in PurePosixPath(name).parts[:-1]:
            current += '/' + part
            self.mkdir(current)

    def store(self, path, data):
        self.ftp.storbinary('STOR ' + path, io.BytesIO(data))
        require(digest(self.read(path)) == digest(data), 'Uploaded file failed readback verification.')

    def rename(self, source, target):
        # NEVER delete the live target first. If overwrite-rename is unsupported,
        # fail safely rather than introducing a missing-file window.
        self.ftp.rename(source, target)


def connect():
    values = [os.environ.get(k, '') for k in ('FTP_SERVER', 'FTP_USERNAME', 'FTP_PASSWORD')]
    require(all(values), 'Required FTP secrets are unavailable.')
    server, username, password = values
    require(re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9.-]*', server),
            'FTP_SERVER must be a bare certificate-matching hostname.')
    context = ssl.create_default_context()
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    ftp = ftplib.FTP_TLS(context=context, timeout=45)
    try:
        ftp.connect(server, 21)
        ftp.auth()                   # Encrypt BEFORE sending username or password.
        ftp.login(username, password)
        ftp.prot_p()                 # Encrypt listings and file-transfer data too.
        ftp.set_pasv(True)
        return ftp
    except BaseException:
        ftp.close()
        raise


def fingerprint(data):
    return digest(data) if data is not None else 'absent-or-inaccessible'


def preflight(remote):
    index = remote.optional(remote.web + '/index.html')
    require(index is not None, 'Live index.html was not readable; verify destination/access.')
    config = remote.optional(remote.web + '/.htaccess')
    result = {
        'mode': 'read-only', 'transport': 'explicit FTPS; verified TLS; protected data',
        'document_root': './www/', 'index_sha256': digest(index),
        'htaccess_sha256': fingerprint(config),
        'writes_tested': False, 'rename_atomicity_tested': False,
        'public_recovery_plan_verified': False, 'rollback_tested_on_ovh': False,
    }
    print(json.dumps(result, indent=2))
    return result


def check_mutation_approval(args):
    require(COMMIT.fullmatch(args.reviewed_commit or ''), 'The reviewed 40-character commit is required.')
    require(args.reviewed_commit == os.environ.get('GITHUB_SHA'),
            'The checked-out workflow commit differs from the reviewed commit.')
    require(os.environ.get('GITHUB_REF') == 'refs/heads/main', 'Only reviewed main may mutate production.')
    require(os.environ.get('OVH_RELEASE_ENABLED') == 'reviewed-and-approved',
            'Production release gates have not been enabled by the owner.')
    require(SHA256.fullmatch(args.expected_index or ''), 'The exact live index fingerprint is required.')
    require(RELEASE.fullmatch(args.release_id or ''), 'A valid release ID is required.')


def check_index(remote, expected):
    value = remote.optional(remote.web + '/index.html')
    require(value is not None and digest(value) == expected,
            'Live index changed or is unreadable; run preflight and review again.')


def snapshot_path(remote, release_id):
    require(RELEASE.fullmatch(release_id or ''), 'A valid release ID is required.')
    # This staging area is deliberately public. It must NEVER contain private
    # configuration, a whole hosting archive, credentials or unreviewed live bytes.
    return remote.web + '/' + STAGE_PREFIX + release_id


def build_digest(files):
    return digest(''.join(name + '\0' + digest(data) + '\n'
                          for name, data in sorted(files.items())).encode())


def make_plan(files, baseline):
    require(baseline.get('schema') == 1 and COMMIT.fullmatch(baseline.get('source_commit', '')),
            'Invalid public baseline identity.')
    old = {}
    for entry in baseline.get('files', []):
        name = relative_path(entry.get('path'))
        require(name != '.htaccess' and name not in old and SHA256.fullmatch(entry.get('sha256', '')),
                'Invalid public baseline entry.')
        old[name] = entry
    require(all(name in old for name in ('index.html', 'sw.js')),
            'A known installed entrypoint and service worker are required.')
    entries = []
    for name, data in sorted(files.items()):
        prior = old.get(name)
        entries.append({'path': name, 'before': prior['sha256'] if prior else None,
                        'after': digest(data), 'source': prior.get('source') if prior else None})
    return {'schema': 2, 'source_commit': baseline['source_commit'],
            'candidate_sha256': build_digest(files), 'files': entries}


def load_plan(args, files=None):
    path = Path(args.plan)
    require(path.is_file() and not path.is_symlink() and path.stat().st_size <= MAX_BYTES,
            'Reviewed public recovery plan is missing or unsafe.')
    plan = json.loads(path.read_bytes())
    require(isinstance(plan, dict) and plan.get('schema') == 2 and
            COMMIT.fullmatch(plan.get('source_commit', '')) and
            SHA256.fullmatch(plan.get('candidate_sha256', '')), 'Invalid public recovery plan.')
    entries = plan.get('files')
    require(isinstance(entries, list) and 0 < len(entries) <= 2000, 'Invalid recovery entry count.')
    seen, restore = set(), {}
    root = Path(args.baseline_root)
    require(root.is_dir() and not root.is_symlink(), 'Pinned public baseline checkout is unavailable.')
    for entry in entries:
        require(isinstance(entry, dict), 'Invalid recovery entry.')
        name = relative_path(entry.get('path'))
        require(name not in seen, 'Duplicate recovery entry.')
        seen.add(name)
        before, after, source = entry.get('before'), entry.get('after'), entry.get('source')
        require((before is None or isinstance(before, str) and SHA256.fullmatch(before)) and
                isinstance(after, str) and SHA256.fullmatch(after), 'Invalid recovery fingerprint.')
        require(name != '.htaccess' or before is None, 'Private configuration replacement is unsupported.')
        if before is None or before == after:
            restore[name] = None
            continue
        require(isinstance(source, str), 'Changed existing file has no public recovery source.')
        relative_path(source)
        require(source.startswith(('public/', 'e2e-pwa/fixtures/')),
                'Recovery source is outside the reviewed public source areas.')
        local = root
        for part in PurePosixPath(source).parts:
            local = local / part
            require(not local.is_symlink(), 'Recovery symlinks are forbidden.')
        require(local.is_file() and local.stat().st_size <= MAX_BYTES,
                'Public recovery source is missing or too large.')
        data = local.read_bytes()
        require(digest(data) == before, 'Public recovery source failed hash verification.')
        restore[name] = data
    require({'index.html', 'sw.js', '.htaccess', 'manifest.webmanifest'} <= seen,
            'Recovery plan lacks required build entries.')
    by_name = {entry['path']: entry for entry in entries}
    require(all(by_name[name]['before'] is not None for name in ('index.html', 'sw.js')),
            'First-time entrypoint or service-worker installation is unsupported.')
    require(digest(''.join(name + '\0' + by_name[name]['after'] + '\n'
                           for name in sorted(seen)).encode()) == plan['candidate_sha256'],
            'Recovery plan candidate digest is inconsistent.')
    if files is not None:
        require(set(files) == seen and build_digest(files) == plan['candidate_sha256'],
                'Build differs from the explicitly reviewed recovery plan; regenerate and review it.')
    return plan, entries, restore


def plan_digest(plan):
    return digest(json.dumps(plan, sort_keys=True, separators=(',', ':')).encode())


def selected_entries(entries, choice):
    require(choice in ('preserve', 'confirmed-absent'),
            'Only configuration preservation or explicitly confirmed absence is supported.')
    return [entry for entry in entries if choice != 'preserve' or entry['path'] != '.htaccess']


def config_guard(remote, choice):
    selected_entries([], choice)
    if choice == 'confirmed-absent':
        require(remote.optional(remote.web + '/.htaccess') is None,
                'Live .htaccess exists; preserve it and review any configuration change separately.')


def staged_path(base, name):
    # An Apache configuration file must not become active inside staging.
    return base + '/' + ('reviewed-route-config.txt' if name == '.htaccess' else 'files/' + name)


def observed_hash(remote, name):
    value = remote.web_optional(name)
    return digest(value) if value is not None else None


def verify_before(remote, entries):
    for entry in entries:
        require(observed_hash(remote, entry['path']) == entry['before'],
                'Live path differs from the reviewed public baseline; no promotion is permitted.')


def probe_rename(remote, base):
    remote.store(base + '/probe-a.txt', b'public rename probe: old')
    remote.store(base + '/probe-b.txt', b'public rename probe: new')
    remote.rename(base + '/probe-b.txt', base + '/probe-a.txt')
    require(remote.read(base + '/probe-a.txt') == b'public rename probe: new',
            'Public overwrite-rename probe failed.')


def deploy(remote, args, files):
    check_mutation_approval(args)
    plan, entries, _ = load_plan(args, files)
    entries = selected_entries(entries, args.htaccess)
    check_index(remote, args.expected_index)
    config_guard(remote, args.htaccess)
    require(all(entry['before'] is None or entry['before'] == entry['after'] or
                not immutable_path(entry['path']) for entry in entries),
            'Existing immutable asset has different bytes; refusing to overwrite it.')
    # This compares ALL candidate paths, including supposed additions and
    # unchanged files. A stale backup or unknown live file blocks every write.
    verify_before(remote, entries)
    changes = [entry for entry in entries if entry['before'] != entry['after']]
    require(changes, 'No changes to publish.')
    base = snapshot_path(remote, args.release_id)
    require(STAGE_PREFIX + args.release_id not in remote.entries(remote.web),
            'Release ID already exists; do not reuse its staging or recovery record.')
    remote.ftp.mkd(base)
    probe_rename(remote, base)
    for entry in changes:
        name = entry['path']
        staged = staged_path(base, name)
        remote.parents(base, staged[len(base) + 1:])
        remote.store(staged, files[name])
    # Public hashes/identifiers only; the private ZIP and live configuration bytes
    # never enter this directory, GitHub artifacts or logs.
    manifest = {'schema': 2, 'release_id': args.release_id, 'commit': args.reviewed_commit,
                'initial_index_sha256': args.expected_index, 'htaccess': args.htaccess,
                'plan_sha256': plan_digest(plan)}
    remote.store(base + '/manifest.json', json.dumps(manifest, sort_keys=True).encode())
    print('Pinned public recovery bytes verified. Recovery release ID: ' + args.release_id, flush=True)
    verify_before(remote, entries)
    check_index(remote, args.expected_index)
    config_guard(remote, args.htaccess)
    for entry in sorted(changes, key=lambda c: promotion_order(c['path'])):
        name = entry['path']
        require(observed_hash(remote, name) == entry['before'],
                'Live file changed during promotion; use the reviewed recovery plan.')
        remote.parents(remote.web, name)
        remote.rename(staged_path(base, name), remote.web + '/' + name)
        require(digest(remote.read(remote.web + '/' + name)) == entry['after'],
                'Promotion readback failed; use the reviewed recovery plan.')
    for entry in entries:
        require(observed_hash(remote, entry['path']) == entry['after'],
                'Final release state drifted; inspect the reviewed recovery plan.')
    print('Release file readbacks passed. HTTP, routing, device, and old-tab checks are still required.')


def load_snapshot(remote, args):
    plan, entries, restore = load_plan(args)
    base = snapshot_path(remote, args.release_id)
    manifest = json.loads(remote.read(base + '/manifest.json'))
    require(isinstance(manifest, dict) and manifest.get('schema') == 2 and
            manifest.get('release_id') == args.release_id and
            manifest.get('plan_sha256') == plan_digest(plan) and
            COMMIT.fullmatch(args.plan_commit or '') and
            manifest.get('commit') == args.plan_commit and
            SHA256.fullmatch(manifest.get('initial_index_sha256', '')),
            'Recovery record does not match the reviewed public plan.')
    return base, selected_entries(entries, manifest.get('htaccess')), restore


def rollback(remote, args):
    check_mutation_approval(args)
    check_index(remote, args.expected_index)
    base, entries, restore = load_snapshot(remote, args)
    current = {}
    # Partial before/after states are recoverable; unknown edits stop all writes.
    for entry in entries:
        name = entry['path']
        current[name] = observed_hash(remote, name)
        require(current[name] in (entry['before'], entry['after']),
                'A live file has an unrelated change; automatic rollback is blocked.')
    changes = [entry for entry in entries if entry['before'] != entry['after']]
    stage = base + '/rollback-' + uuid.uuid4().hex
    remote.ftp.mkd(stage)
    for entry in changes:
        name = entry['path']
        data = restore[name]
        if data is not None and current[name] != entry['before']:
            staged = staged_path(stage, name)
            remote.parents(stage, staged[len(stage) + 1:])
            remote.store(staged, data)
    check_index(remote, args.expected_index)
    # Recheck the full planned surface again after staging.
    for entry in entries:
        require(observed_hash(remote, entry['path']) == current[entry['path']],
                'Live file changed during recovery staging; no rollback promotion performed.')
    for entry in sorted(changes, key=lambda c: promotion_order(c['path'])):
        name, data = entry['path'], restore[entry['path']]
        require(observed_hash(remote, name) == current[name],
                'Live file changed during rollback; stop and review.')
        if data is not None and current[name] != entry['before']:
            remote.rename(staged_path(stage, name), remote.web + '/' + name)
            require(digest(remote.read(remote.web + '/' + name)) == entry['before'],
                    'Rollback readback failed; public recovery sources are retained.')
        elif entry['before'] is None and name == '.htaccess' and current[name] is not None:
            # Only the reviewed, already-public route-only configuration can enter
            # this path. Unknown or private configuration is rejected above.
            remote.rename(remote.web + '/' + name, stage + '/introduced-route-config.txt')
            require(observed_hash(remote, name) is None,
                    'Configuration absence was not restored; inspect before retrying.')
        # Added public assets/data stay available to open newer tabs. No DELE.
    for entry in entries:
        name = entry['path']
        expected = (entry['before'] if entry['before'] is not None or name == '.htaccess'
                    else current[name])
        require(observed_hash(remote, name) == expected,
                'Final recovery state drifted; do not report recovery complete.')
    print('Rollback file readbacks passed; HTTP and service-worker recovery still require verification.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=['preflight', 'deploy', 'rollback'])
    parser.add_argument('--dist', default='dist')
    parser.add_argument('--reviewed-commit', default='')
    parser.add_argument('--expected-index', default='')
    parser.add_argument('--htaccess', default='preserve')
    parser.add_argument('--release-id', default='')
    parser.add_argument('--plan', default=str(PLAN_FILE))
    parser.add_argument('--baseline-root', default='.')
    parser.add_argument('--plan-commit', default='')
    args = parser.parse_args()
    ftp = None
    try:
        # Fail on local approval/build errors BEFORE touching the network.
        if args.operation != 'preflight':
            check_mutation_approval(args)
        if args.operation == 'rollback':
            require(COMMIT.fullmatch(args.plan_commit or ''),
                    'The exact original release commit containing its recovery plan is required.')
        files = inventory(args.dist) if args.operation == 'deploy' else None
        if args.operation != 'preflight':
            load_plan(args, files)  # Verify all public recovery bytes BEFORE network access.
        ftp = connect()
        remote = Remote(ftp)
        if args.operation == 'preflight':
            preflight(remote)
        elif args.operation == 'deploy':
            deploy(remote, args, files)
        else:
            rollback(remote, args)
        return 0
    except ReleaseError as error:
        print('Stopped: ' + str(error), file=sys.stderr)
    except (ftplib.Error, OSError, ValueError, KeyError, TypeError):
        # Raw FTP responses, TLS errors, hostnames, usernames and file contents can
        # expose account details. Do not print exceptions or tracebacks in CI.
        print('Stopped: secure transfer or validation failed. Inspect privately; do not weaken TLS.',
              file=sys.stderr)
    finally:
        if ftp is not None:
            ftp.close()
    return 1


if __name__ == '__main__':
    sys.exit(main())
