#!/usr/bin/env python3
"""Install only the reviewed public route file when SFTP proves it is absent."""
import errno
import json
import os
from pathlib import Path
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

import ovh_release as release
from ovh_sftp_release import connect_sftp

CONFIG_SHA = 'dfc61c3c3c61be691cbac1d0cd3f052eedf08bf5620e95809018d2b8a88d5762'
LIVE_HASHES = {
    'index.html': 'a3500dfac937951659125bec6341bfc2664286d2529e5dd424ddea1f4dd4f0ef',
    'manifest.webmanifest': 'a67ab9d4649f8566c917a5e9cd7e98724ea796e3a39030a32f83b599cab7ab14',
    'sw.js': 'c6364a1aa4137e9f2c9b23c359c975aa6949e3265e946d8b5f20ccd4aab4c04a',
}
ORIGIN = 'https://localiserbien.fr'


def require_absent(sftp, path):
    try:
        sftp.lstat(path)
    except OSError as error:
        release.require(error.errno == errno.ENOENT,
                        'Absence was not proven; permission and other errors forbid writes.')
        return
    raise release.ReleaseError('A destination already exists; no existing configuration may be replaced.')


def check_identity(remote):
    for path, expected in LIVE_HASHES.items():
        release.require(release.observed_hash(remote, path) == expected,
                        'The live application differs from the reviewed deployed release.')


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, file_pointer, code, message, headers, new_url):
        return None


def fetch_http(path, token):
    url = ORIGIN + path + '?release-check=' + urllib.parse.quote(token, safe='')
    request = urllib.request.Request(url, headers={
        'User-Agent': 'LocaliserBien-route-verification/1.0', 'Cache-Control': 'no-cache'})
    opener = urllib.request.build_opener(NoRedirect())
    try:
        response = opener.open(request, timeout=25)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        body = response.read(1024 * 1024 + 1)
        release.require(len(body) <= 1024 * 1024, 'HTTP response exceeds the verification bound.')
        return response.code, response.headers, body


def verify_http(token, fetch=fetch_http):
    report = []
    for path in ('/', '/informations', '/informations/', '/mentions-legales', '/mentions-legales/'):
        code, headers, body = fetch(path, token)
        release.require(code == 200 and release.digest(body) == LIVE_HASHES['index.html'],
                        'Known route did not serve the exact deployed index with HTTP 200.')
        report.append({'path': path, 'status': code, 'index_sha256': release.digest(body)})
    for path in ('/manifest.webmanifest', '/sw.js'):
        code, headers, body = fetch(path, token)
        release.require(code == 200 and release.digest(body) == LIVE_HASHES[path[1:]],
                        'Public manifest or service worker differs from the reviewed deployed release.')
        report.append({'path': path, 'status': code, 'sha256': release.digest(body)})
    for path in ('/faq', '/faq/'):
        code, headers, body = fetch(path, token)
        destination = urllib.parse.urlsplit(urllib.parse.urljoin(ORIGIN, headers.get('Location', '')))
        release.require(code == 301 and destination.scheme == 'https' and
                        destination.hostname == 'localiserbien.fr' and destination.port in (None, 443) and
                        destination.username is None and destination.password is None and
                        destination.path == '/informations',
                        'Legacy FAQ route did not return its intended same-site permanent redirect.')
        report.append({'path': path, 'status': code, 'destination': destination.path})
    for path in ('/assets/__missing_' + token + '.js', '/data/__missing_' + token + '.json',
                 '/__missing_' + token):
        code, headers, body = fetch(path, token)
        release.require(code == 404, 'A missing asset or unknown route became a soft 404.')
        report.append({'path': path, 'status': code})
    return report


def install(remote, data, release_id, verify=verify_http):
    release.require(release.digest(data) == CONFIG_SHA, 'Route bytes are not the reviewed public config.')
    release.require(release.RELEASE.fullmatch(release_id or ''), 'Invalid routing release ID.')
    target = remote.web + '/.htaccess'
    check_identity(remote)
    require_absent(remote.ftp.sftp, target)
    stage = remote.web + '/' + release.STAGE_PREFIX + release_id
    require_absent(remote.ftp.sftp, stage)
    remote.ftp.sftp.mkdir(stage, mode=0o755)
    staged = stage + '/reviewed-route-config.txt'
    remote.store(staged, data)
    record = {'schema': 1, 'release_id': release_id, 'commit': os.environ.get('GITHUB_SHA'),
              'before': None, 'after_sha256': CONFIG_SHA, 'live_hashes': LIVE_HASHES}
    remote.store(stage + '/manifest.json', json.dumps(record, sort_keys=True).encode())
    check_identity(remote)
    require_absent(remote.ftp.sftp, target)
    # Unlike posix_rename, standard SFTP rename MUST fail if target now exists.
    try:
        remote.ftp.sftp.rename(staged, target)
    except Exception:
        print('Routing rename completion is uncertain; inspect exact target and staging state before retrying.',
              file=sys.stderr, flush=True)
        raise
    print('Route config introduced. Recovery release ID: ' + release_id, flush=True)
    try:
        release.require(release.digest(remote.read(target)) == CONFIG_SHA,
                        'Introduced routing config failed readback.')
        report = verify(release_id)
        check_identity(remote)
        release.require(release.digest(remote.read(target)) == CONFIG_SHA,
                        'Routing config drifted after HTTP checks.')
    except Exception:
        print('Routing acceptance failed after installation. Leave configuration untouched; inspect exact live state before any reviewed reversal.',
              file=sys.stderr, flush=True)
        raise
    print(json.dumps({'routing_checks': report, 'route_config_sha256': CONFIG_SHA,
                      'recovery_release_id': release_id}, sort_keys=True), flush=True)
    print('Reviewed routing installation and HTTP acceptance checks passed.', flush=True)


def main():
    bridge = None
    try:
        sha = os.environ.get('GITHUB_SHA', '')
        release.require(re.fullmatch(r'[0-9a-f]{40}', sha) and
                        os.environ.get('GITHUB_REF') == 'refs/heads/main' and
                        os.environ.get('OVH_ROUTE_INSTALL_ENABLED') == 'reviewed-and-approved',
                        'Routing installation is not enabled for this reviewed main job.')
        run, attempt = os.environ.get('GITHUB_RUN_ID', ''), os.environ.get('GITHUB_RUN_ATTEMPT', '')
        release.require(run.isdecimal() and attempt.isdecimal(), 'Workflow provenance is unavailable.')
        source = Path('dist/.htaccess')
        release.require(source.is_file() and not source.is_symlink() and source.stat().st_size < 4096,
                        'Reviewed routing artifact is unavailable or unsafe.')
        data = source.read_bytes()
        release.require(release.digest(data) == CONFIG_SHA, 'Routing artifact differs from the reviewed hash.')
        bridge = connect_sftp()
        remote = release.Remote(bridge)
        install(remote, data, 'github-routes-' + run + '-' + attempt + '-' + sha[:12])
        return 0
    except Exception:
        print('Stopped: routing installation or verification failed; no unknown configuration may be replaced.',
              file=sys.stderr)
        return 1
    finally:
        if bridge is not None:
            try:
                bridge.close()
            except Exception:
                print('SFTP close did not confirm completion; check the recorded operation result.', file=sys.stderr)


if __name__ == '__main__':
    sys.exit(main())
