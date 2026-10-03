#!/usr/bin/env python3
"""Conservative, explicit-FTPS release tool. No sync, broad delete, or TLS fallback.

Preflight is read-only. Deploy/rollback require exact release/live fingerprints and
an owner-confirmed backup directory outside ALL web roots. See OVH_DEPLOYMENT.md.
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
BACKUP_NAME = '.localiserbien-releases'
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
        self.private = self.home.rstrip('/') + '/' + BACKUP_NAME
        require(not self.private.startswith(self.web + '/'), 'Backup directory is inside www.')

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
        'backup_privacy_verified': False, 'rollback_tested_on_ovh': False,
    }
    print(json.dumps(result, indent=2))
    return result


def check_mutation_approval(args):
    require(COMMIT.fullmatch(args.reviewed_commit or ''), 'The reviewed 40-character commit is required.')
    require(args.reviewed_commit == os.environ.get('GITHUB_SHA'),
            'The checked-out workflow commit differs from the reviewed commit.')
    require(os.environ.get('GITHUB_REF') == 'refs/heads/main', 'Only reviewed main may mutate production.')
    require(os.environ.get('OVH_PRIVATE_BACKUP_CONFIRMED') == 'outside-all-document-roots',
            'Owner must confirm the sibling backup directory is outside EVERY web document root.')
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
    return remote.private + '/' + release_id


def config_guard(remote, choice):
    require(choice in ('preserve', 'confirmed-absent') or SHA256.fullmatch(choice or ''),
            'Configuration choice must preserve, confirm absence, or pin its current SHA-256.')
    if choice == 'preserve':
        return
    previous = remote.optional(remote.web + '/.htaccess')
    if choice == 'confirmed-absent':
        require(previous is None, 'Live .htaccess exists; review and pin its fingerprint.')
    else:
        require(previous is not None and digest(previous) == choice,
                'Live .htaccess changed or is unreadable; preserve it or review it privately.')


def deploy(remote, args, files):
    check_mutation_approval(args)
    check_index(remote, args.expected_index)
    config_guard(remote, args.htaccess)
    files = dict(files)
    if args.htaccess == 'preserve':
        del files['.htaccess']
    changes, previous = [], {}
    # Full read-only plan before any writes. Existing unknown files are never deleted.
    for name, data in files.items():
        # Missing parent directories are supported only after the read-only plan.
        current = remote.web
        absent_parent = False
        for part in PurePosixPath(name).parts[:-1]:
            facts = remote.entries(current).get(part)
            if facts is None:
                absent_parent = True
                break
            require(facts.get('type') == 'dir', 'A release directory is not a regular directory.')
            current += '/' + part
        old = None if absent_parent else remote.optional(remote.web + '/' + name)
        require(name != 'sw.js' or old is not None,
                'Live sw.js is missing; first-time service-worker installation requires a separate recovery plan.')
        if old == data:
            continue
        require(old is None or not immutable_path(name),
                'Existing immutable asset has different bytes; refusing to overwrite it.')
        previous[name] = old
        changes.append({'path': name, 'before': digest(old) if old is not None else None,
                        'after': digest(data)})
    require(changes, 'No changes to publish.')
    base = snapshot_path(remote, args.release_id)
    remote.mkdir(remote.private)
    require(args.release_id not in remote.entries(remote.private),
            'Release ID already exists; do not reuse or overwrite its recovery snapshot.')
    remote.ftp.mkd(base)
    for subdir in ('before', 'stage'):
        remote.ftp.mkd(base + '/' + subdir)
    # Probe overwrite-rename solely inside the confirmed private directory. This
    # checks capability, not a guarantee of the server filesystem's atomicity.
    remote.store(base + '/probe-a', b'old')
    remote.store(base + '/probe-b', b'new')
    remote.rename(base + '/probe-b', base + '/probe-a')
    require(remote.read(base + '/probe-a') == b'new', 'Private overwrite-rename probe failed.')
    for change in changes:
        name = change['path']
        if previous[name] is not None:
            remote.parents(base + '/before', name)
            remote.store(base + '/before/' + name, previous[name])
        remote.parents(base + '/stage', name)
        remote.store(base + '/stage/' + name, files[name])
    manifest = {'schema': 1, 'release_id': args.release_id, 'commit': args.reviewed_commit,
                'initial_index_sha256': args.expected_index, 'changes': changes}
    remote.store(base + '/manifest.json', json.dumps(manifest, sort_keys=True).encode())
    print('Private recovery snapshot verified. Recovery release ID: ' + args.release_id, flush=True)
    # Recheck EVERY affected file before the first live mutation, not only index.
    for change in changes:
        name = change['path']
        current = previous[name]
        # Missing new directories cannot have drifted unnoticed: verify parents now.
        if current is None:
            remote.parents(remote.web, name)
        observed = remote.optional(remote.web + '/' + name)
        require(observed == current, 'Live files changed while staging; no file promotion performed.')
    check_index(remote, args.expected_index)
    config_guard(remote, args.htaccess)
    for change in sorted(changes, key=lambda c: promotion_order(c['path'])):
        name = change['path']
        # Best-effort per-file race guard. GitHub concurrency does not lock manual FTP editors.
        observed = remote.optional(remote.web + '/' + name)
        require(observed == previous[name], 'Live file changed during promotion; use the recovery snapshot.')
        remote.rename(base + '/stage/' + name, remote.web + '/' + name)
        require(digest(remote.read(remote.web + '/' + name)) == change['after'],
                'Promotion readback failed; use the recovery snapshot.')
    print('Release file readbacks passed. HTTP, routing, device, and old-tab checks are still required.')


def load_snapshot(remote, args):
    base = snapshot_path(remote, args.release_id)
    manifest = json.loads(remote.read(base + '/manifest.json'))
    require(isinstance(manifest, dict) and manifest.get('schema') == 1 and
            manifest.get('release_id') == args.release_id, 'Invalid recovery manifest.')
    changes = manifest.get('changes')
    require(isinstance(changes, list) and 0 < len(changes) <= 2000, 'Invalid recovery entry count.')
    seen, restore = set(), {}
    for change in changes:
        require(isinstance(change, dict), 'Invalid recovery entry.')
        name = relative_path(change.get('path'))
        require(name not in seen, 'Duplicate recovery entry.')
        seen.add(name)
        before, after = change.get('before'), change.get('after')
        require((before is None or isinstance(before, str) and SHA256.fullmatch(before)) and
                isinstance(after, str) and SHA256.fullmatch(after), 'Invalid recovery fingerprint.')
        data = None if before is None else remote.read(base + '/before/' + name)
        require(data is None or digest(data) == before, 'Recovery copy failed hash verification.')
        restore[name] = data
    return base, changes, restore


def rollback(remote, args):
    check_mutation_approval(args)
    check_index(remote, args.expected_index)
    base, changes, restore = load_snapshot(remote, args)
    current = {}
    # A partial interrupted release may have a mix of before/after files. Reject
    # unrelated edits, and validate ALL backup bytes before the first live write.
    for change in changes:
        name = change['path']
        value = remote.web_optional(name)
        observed = digest(value) if value is not None else None
        require(observed in (change['before'], change['after']),
                'A live file has an unrelated change; automatic rollback is blocked.')
        current[name] = value
    stage = base + '/rollback-' + uuid.uuid4().hex
    remote.ftp.mkd(stage)
    for name, data in restore.items():
        if data is not None and data != current[name]:
            remote.parents(stage, name)
            remote.store(stage + '/' + name, data)
    check_index(remote, args.expected_index)
    for change in sorted(changes, key=lambda c: promotion_order(c['path'])):
        name, data = change['path'], restore[change['path']]
        require(remote.web_optional(name) == current[name],
                'Live file changed during rollback; stop and review privately.')
        if data is not None and data != current[name]:
            remote.rename(stage + '/' + name, remote.web + '/' + name)
            require(digest(remote.read(remote.web + '/' + name)) == change['before'],
                    'Rollback readback failed; recovery snapshot is retained.')
        elif data is None and name == '.htaccess' and current[name] is not None:
            # Recoverable move, never DELE. Restore its confirmed previous absence.
            remote.rename(remote.web + '/' + name, stage + '/introduced-htaccess')
        # Newly introduced public assets/data are deliberately retained, protecting
        # open new-build tabs. This is release rollback, not exact tree restoration.
    print('Rollback file readbacks passed; HTTP and service-worker recovery still require verification.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=['preflight', 'deploy', 'rollback'])
    parser.add_argument('--dist', default='dist')
    parser.add_argument('--reviewed-commit', default='')
    parser.add_argument('--expected-index', default='')
    parser.add_argument('--htaccess', default='preserve')
    parser.add_argument('--release-id', default='')
    args = parser.parse_args()
    ftp = None
    try:
        # Fail on local approval/build errors BEFORE touching the network.
        if args.operation != 'preflight':
            check_mutation_approval(args)
        files = inventory(args.dist) if args.operation == 'deploy' else None
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
