"""Offline behavioral tests. This fake is NOT evidence of OVH/TLS compatibility."""
import argparse
import contextlib
import ftplib
import io
import os
from pathlib import Path
import re
import ssl
import tempfile
import unittest
from unittest.mock import patch

import ovh_release as release


class FakeFTP:
    def __init__(self, files=None):
        self.files = {'/home/www/' + name: data for name, data in (files or {}).items()}
        self.dirs = {'/home', '/home/www'}
        for path in self.files:
            parent = path.rsplit('/', 1)[0]
            while parent != '/home':
                self.dirs.add(parent)
                parent = parent.rsplit('/', 1)[0]
        self.current = '/home'
        self.calls = []
        self.fail_rename = None
        self.corrupt_stores = False
        self.deny_retr = None
        self.on_manifest = None

    def pwd(self):
        return self.current

    def cwd(self, path):
        self.calls.append(('cwd', path))
        path = '/home/www' if path == './www' else path
        if path not in self.dirs:
            raise ftplib.error_perm('550 unavailable')
        self.current = path

    def mlsd(self, directory, facts=None):
        self.calls.append(('mlsd', directory))
        if directory not in self.dirs:
            raise ftplib.error_perm('550 unavailable')
        out = []
        for path in sorted(self.dirs | self.files.keys()):
            if path.rsplit('/', 1)[0] != directory:
                continue
            name = path.rsplit('/', 1)[1]
            out.append((name, {'type': 'dir' if path in self.dirs else 'file',
                               'size': str(len(self.files.get(path, b'')))}))
        return iter(out)

    def retrbinary(self, command, callback):
        self.calls.append(('retr', command[5:]))
        path = command[5:]
        if path not in self.files or path == self.deny_retr:
            raise ftplib.error_perm('550 unavailable')
        callback(self.files[path])

    def storbinary(self, command, stream):
        path = command[5:]
        self.calls.append(('stor', path))
        if path.rsplit('/', 1)[0] not in self.dirs:
            raise ftplib.error_perm('550 unavailable')
        self.files[path] = b'corrupt' if self.corrupt_stores else stream.read()
        if path.endswith('/manifest.json') and self.on_manifest:
            self.on_manifest(self)

    def mkd(self, path):
        self.calls.append(('mkd', path))
        if path in self.dirs or path.rsplit('/', 1)[0] not in self.dirs:
            raise ftplib.error_perm('550 unavailable')
        self.dirs.add(path)

    def rename(self, source, target):
        self.calls.append(('rename', source, target))
        if target == self.fail_rename:
            raise ftplib.error_perm('550 unavailable')
        self.files[target] = self.files.pop(source)


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.old = {'index.html': b'old html', 'sw.js': b'old worker',
                    'manifest.webmanifest': b'old manifest', '.htaccess': b'private old config',
                    'assets/old-hash.js': b'old js', 'data/existing.json': b'old data',
                    'unknown.txt': b'leave alone'}
        self.new = {'index.html': b'new html', 'sw.js': b'new worker',
                    'manifest.webmanifest': b'new manifest', '.htaccess': b'new config',
                    'assets/new-hash.js': b'new js', 'data/existing.json': b'new data'}
        self.ftp = FakeFTP(self.old)
        self.remote = release.Remote(self.ftp)
        self.args = argparse.Namespace(reviewed_commit='a' * 40,
            expected_index=release.digest(self.old['index.html']),
            release_id='test-release-0001', htaccess='preserve')
        self.env = patch.dict(os.environ, {'GITHUB_SHA': 'a' * 40,
            'GITHUB_REF': 'refs/heads/main',
            'OVH_PRIVATE_BACKUP_CONFIRMED': 'outside-all-document-roots',
            'OVH_RELEASE_ENABLED': 'reviewed-and-approved'})
        self.env.start()
        self.addCleanup(self.env.stop)

    def publish(self):
        with contextlib.redirect_stdout(io.StringIO()):
            release.deploy(self.remote, self.args, self.new)

    def recover(self):
        self.args.expected_index = release.digest(self.ftp.files['/home/www/index.html'])
        with contextlib.redirect_stdout(io.StringIO()):
            release.rollback(self.remote, self.args)

    def public_writes(self):
        return [c for c in self.ftp.calls if c[0] == 'rename' and c[2].startswith('/home/www/')]

    def test_preflight_has_no_remote_writes_or_configuration_contents(self):
        stream = io.StringIO()
        with contextlib.redirect_stdout(stream):
            result = release.preflight(self.remote)
        self.assertEqual(result['index_sha256'], self.args.expected_index)
        self.assertFalse({'stor', 'rename', 'mkd', 'delete'} & {c[0] for c in self.ftp.calls})
        self.assertNotIn('private old config', stream.getvalue())

    def test_order_retention_and_config_preserved(self):
        self.publish()
        paths = [c[2] for c in self.public_writes()]
        self.assertEqual(paths[-2:], ['/home/www/index.html', '/home/www/sw.js'])
        for name in ('.htaccess', 'unknown.txt', 'assets/old-hash.js'):
            self.assertEqual(self.ftp.files['/home/www/' + name], self.old[name])
        self.assertFalse(any(c[0] == 'stor' and c[1].startswith('/home/www/') for c in self.ftp.calls))
        self.assertFalse(any(c[0] == 'delete' for c in self.ftp.calls))

    def test_private_snapshot_precedes_every_public_write(self):
        self.publish()
        manifest_read = next(i for i, c in enumerate(self.ftp.calls)
                             if c[0] == 'retr' and c[1].endswith('/manifest.json'))
        first_public = next(i for i, c in enumerate(self.ftp.calls) if c in self.public_writes())
        self.assertLess(manifest_read, first_public)
        self.assertIn('/home/.localiserbien-releases/test-release-0001/before/index.html', self.ftp.files)
        self.assertFalse(any(p.startswith('/home/www/') and 'before/' in p for p in self.ftp.files))

    def test_exact_config_pin_allows_replace_and_recover(self):
        self.args.htaccess = release.digest(self.old['.htaccess'])
        self.publish()
        self.assertEqual(self.ftp.files['/home/www/.htaccess'], b'new config')
        self.recover()
        self.assertEqual(self.ftp.files['/home/www/.htaccess'], b'private old config')
        self.assertFalse(any(c[0] == 'stor' and c[1].startswith('/home/www/') for c in self.ftp.calls))

    def test_config_wrong_pin_blocks_all_writes(self):
        self.args.htaccess = 'c' * 64
        with self.assertRaises(release.ReleaseError):
            self.publish()
        self.assertFalse({'stor', 'mkd', 'rename'} & {c[0] for c in self.ftp.calls})

    def test_confirm_absent_rejects_existing_config(self):
        self.args.htaccess = 'confirmed-absent'
        with self.assertRaises(release.ReleaseError):
            self.publish()
        self.assertFalse(self.public_writes())

    def test_new_config_rollback_moves_it_back_to_private_storage(self):
        del self.ftp.files['/home/www/.htaccess']
        self.args.htaccess = 'confirmed-absent'
        self.publish()
        self.recover()
        self.assertNotIn('/home/www/.htaccess', self.ftp.files)
        self.assertTrue(any(path.endswith('/introduced-htaccess') for path in self.ftp.files))

    def test_rollback_restores_mutable_files_but_retains_both_asset_generations(self):
        self.publish()
        self.recover()
        for name in ('index.html', 'sw.js', 'manifest.webmanifest', 'data/existing.json'):
            self.assertEqual(self.ftp.files['/home/www/' + name], self.old[name])
        self.assertEqual(self.ftp.files['/home/www/assets/new-hash.js'], b'new js')
        self.assertEqual(self.ftp.files['/home/www/assets/old-hash.js'], b'old js')

    def test_immutable_asset_collision_blocks_all_writes(self):
        self.new['assets/old-hash.js'] = b'different bytes'
        with self.assertRaises(release.ReleaseError):
            self.publish()
        self.assertFalse({'stor', 'mkd', 'rename'} & {c[0] for c in self.ftp.calls})

    def test_rollback_after_snapshot_before_missing_public_directory_creation(self):
        self.new['newdir/test.json'] = b'new data'
        def interrupt(ftp):
            raise OSError('simulated disconnect after durable manifest upload')
        self.ftp.on_manifest = interrupt
        with self.assertRaises(OSError):
            self.publish()
        self.ftp.on_manifest = None
        self.recover()
        self.assertEqual(self.ftp.files['/home/www/index.html'], b'old html')

    def test_new_directory_supported(self):
        self.new['newdir/test.json'] = b'new data'
        self.publish()
        self.assertEqual(self.ftp.files['/home/www/newdir/test.json'], b'new data')

    def test_wrong_commit_ref_backup_confirmation_and_live_index_each_block(self):
        for variable, value in [('GITHUB_SHA', 'b' * 40), ('GITHUB_REF', 'refs/heads/other'),
                                ('OVH_PRIVATE_BACKUP_CONFIRMED', ''), ('OVH_RELEASE_ENABLED', '')]:
            with self.subTest(variable=variable), patch.dict(os.environ, {variable: value}):
                with self.assertRaises(release.ReleaseError):
                    self.publish()
        self.args.expected_index = 'c' * 64
        with self.assertRaises(release.ReleaseError):
            self.publish()
        self.assertFalse({'stor', 'mkd', 'rename'} & {c[0] for c in self.ftp.calls})

    def test_reused_release_id_blocked(self):
        self.publish()
        self.args.expected_index = release.digest(b'new html')
        self.new['index.html'] = b'next html'
        before = dict(self.ftp.files)
        with self.assertRaises(release.ReleaseError):
            self.publish()
        self.assertEqual(before, self.ftp.files)

    def test_missing_live_worker_blocks_all_writes(self):
        del self.ftp.files['/home/www/sw.js']
        before = dict(self.ftp.files)
        with self.assertRaisesRegex(release.ReleaseError, 'first-time service-worker installation'):
            self.publish()
        self.assertEqual(before, self.ftp.files)
        self.assertFalse({'stor', 'mkd', 'rename', 'delete'} & {c[0] for c in self.ftp.calls})

    def test_private_rename_failure_leaves_production_untouched(self):
        self.ftp.fail_rename = '/home/.localiserbien-releases/test-release-0001/probe-a'
        with self.assertRaises(ftplib.error_perm):
            self.publish()
        self.assertFalse(self.public_writes())
        self.assertEqual(self.ftp.files['/home/www/index.html'], b'old html')

    def test_upload_corruption_blocks_promotion(self):
        self.ftp.corrupt_stores = True
        with self.assertRaises(release.ReleaseError):
            self.publish()
        self.assertFalse(self.public_writes())

    def test_drift_during_staging_blocks_promotion(self):
        self.ftp.on_manifest = lambda ftp: ftp.files.update({'/home/www/data/existing.json': b'external'})
        with self.assertRaises(release.ReleaseError):
            self.publish()
        self.assertFalse(self.public_writes())

    def test_partial_publish_recovery(self):
        self.ftp.fail_rename = '/home/www/index.html'
        with self.assertRaises(ftplib.error_perm):
            self.publish()
        self.assertEqual(self.ftp.files['/home/www/index.html'], b'old html')
        self.assertEqual(self.ftp.files['/home/www/sw.js'], b'old worker')
        self.ftp.fail_rename = None
        self.recover()
        self.assertEqual(self.ftp.files['/home/www/data/existing.json'], b'old data')

    def test_unrelated_change_blocks_rollback_before_writes(self):
        self.publish()
        self.ftp.files['/home/www/data/existing.json'] = b'unrelated'
        self.ftp.calls.clear()
        with self.assertRaises(release.ReleaseError):
            self.recover()
        self.assertFalse({'stor', 'mkd', 'rename'} & {c[0] for c in self.ftp.calls})

    def test_corrupt_private_backup_blocks_rollback_before_writes(self):
        self.publish()
        self.ftp.files['/home/.localiserbien-releases/test-release-0001/before/sw.js'] = b'corrupt'
        self.ftp.calls.clear()
        with self.assertRaises(release.ReleaseError):
            self.recover()
        self.assertFalse({'stor', 'mkd', 'rename'} & {c[0] for c in self.ftp.calls})

    def test_config_read_denied_is_not_treated_as_absent_when_listed(self):
        self.ftp.deny_retr = '/home/www/.htaccess'
        with self.assertRaises(ftplib.error_perm):
            release.preflight(self.remote)

    def test_unsafe_manifest_paths_rejected(self):
        for path in ('../secrets', '/etc/passwd', 'assets/../../x.js', '.env', 'data/.secret.json',
                     'file.php', 'assets\\x.js', 'index.html\r\nDELE x'):
            with self.subTest(path=path), self.assertRaises(release.ReleaseError):
                release.relative_path(path)

    def test_symlink_build_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            (Path(directory) / 'index.html').symlink_to('/etc/hosts')
            with self.assertRaises(release.ReleaseError):
                release.inventory(directory)

    def test_cli_guard_fails_before_any_network_connection(self):
        with patch.dict(os.environ, {'OVH_RELEASE_ENABLED': ''}), patch.object(release, 'connect') as connect:
            with patch('sys.argv', ['ovh_release.py', 'deploy']), contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(release.main(), 1)
            connect.assert_not_called()

    def test_cli_redacts_raw_server_errors(self):
        with patch.object(release, 'connect', side_effect=ftplib.error_perm('530 private-user secret-password')):
            output = io.StringIO()
            with patch('sys.argv', ['ovh_release.py', 'preflight']), contextlib.redirect_stderr(output):
                self.assertEqual(release.main(), 1)
            self.assertNotIn('private-user', output.getvalue())
            self.assertNotIn('secret-password', output.getvalue())

    def test_tls_required_before_login_and_on_data(self):
        with patch.dict(os.environ, {'FTP_SERVER': 'ftp.example.test', 'FTP_USERNAME': 'test',
                                     'FTP_PASSWORD': 'secret'}), patch.object(ftplib, 'FTP_TLS') as cls:
            release.connect()
            context = cls.call_args.kwargs['context']
            self.assertTrue(context.check_hostname)
            self.assertEqual(context.verify_mode, ssl.CERT_REQUIRED)
            self.assertGreaterEqual(context.minimum_version, ssl.TLSVersion.TLSv1_2)
            names = [call[0] for call in cls.return_value.mock_calls]
            self.assertEqual(names, ['connect', 'auth', 'login', 'prot_p', 'set_pasv'])

    def test_tls_failure_never_falls_back_to_plaintext_or_sends_password(self):
        with patch.dict(os.environ, {'FTP_SERVER': 'ftp.example.test', 'FTP_USERNAME': 'test',
                                     'FTP_PASSWORD': 'secret'}), patch.object(ftplib, 'FTP_TLS') as cls:
            cls.return_value.auth.side_effect = ssl.SSLCertVerificationError('untrusted')
            with self.assertRaises(ssl.SSLCertVerificationError):
                release.connect()
            cls.return_value.login.assert_not_called()
            cls.return_value.close.assert_called_once()


class WorkflowSafetyTests(unittest.TestCase):
    """Focused structure checks without a third-party YAML dependency in CI."""
    def setUp(self):
        root = Path(__file__).resolve().parents[2]
        self.ci = (root / '.github/workflows/ci.yml').read_text()

    def job(self, name):
        match = re.search(r'^  ' + re.escape(name) + r':\n(.*?)(?=^  [A-Za-z0-9_-]+:|\Z)',
                          self.ci, flags=re.MULTILINE | re.DOTALL)
        self.assertIsNotNone(match, 'Required workflow job is missing: ' + name)
        return match.group(1)

    def test_preflight_skips_build_and_audit_but_other_events_keep_them(self):
        guard = "    if: github.event_name != 'workflow_dispatch' || inputs.operation != 'preflight'"
        for job in ('lint-and-test', 'security-check'):
            self.assertIn(guard, self.job(job).splitlines())
        # Truth table for the exact guard above: pushes/PRs/deploy retain checks.
        for event, operation, expected in [('workflow_dispatch', 'preflight', False),
                                           ('workflow_dispatch', 'deploy', True),
                                           ('push', '', True), ('pull_request', '', True)]:
            with self.subTest(event=event, operation=operation):
                self.assertEqual(event != 'workflow_dispatch' or operation != 'preflight', expected)
        self.assertNotRegex(self.job('preflight'), r'(?m)^    needs:')
        self.assertNotIn('npm ', self.job('preflight'))

    def test_deploy_still_requires_passing_build_and_explicit_main_dispatch(self):
        deploy = self.job('deploy')
        self.assertIn('    needs: lint-and-test', deploy.splitlines())
        self.assertIn("    if: github.ref == 'refs/heads/main' && github.event_name == 'workflow_dispatch' && inputs.operation == 'deploy'",
                      deploy.splitlines())
        self.assertIn('    environment: ovh-production', deploy.splitlines())
        self.assertIn('      cancel-in-progress: false', deploy.splitlines())
        for guard in ('OVH_RELEASE_ENABLED', 'OVH_PRIVATE_BACKUP_CONFIRMED'):
            self.assertIn(guard + ': ${{ vars.' + guard + ' }}', deploy)
        self.assertIn('permissions:\n  contents: read\n', self.ci)

    def test_generated_metadata_makes_no_exact_or_universal_identification_claim(self):
        for prefix in ('APP', 'OG', 'TWITTER'):
            title = re.search(r'^        VITE_' + prefix + r'_TITLE=(.*)$', self.ci, re.MULTILINE)
            description = re.search(r'^        VITE_' + prefix + r'_DESCRIPTION=(.*)$', self.ci, re.MULTILINE)
            self.assertIsNotNone(title)
            self.assertIsNotNone(description)
            self.assertIn('correspondances DPE', title.group(1))
            self.assertIn('correspondances possibles', description.group(1))
            self.assertIn("ne garantit pas l'identification du bien", description.group(1))
        self.assertNotIn('adresse exacte', self.ci)
        self.assertNotIn("n'importe quel bien", self.ci)


if __name__ == '__main__':
    unittest.main()
