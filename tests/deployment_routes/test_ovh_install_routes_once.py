"""Offline routing guards; no live authentication or writes."""
import errno
import io
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts/deployment'))
sys.path.insert(0, str(ROOT / 'tests/deployment_sftp'))
import ovh_install_routes_once as routes
import ovh_release as release
import ovh_sftp_release as adapter
import test_ovh_sftp_release as fixtures
import test_ovh_release as original

DATA = (ROOT / 'public/.htaccess').read_bytes()
RID = 'github-routes-test-release'
TARGET = '/home/www/.htaccess'

class FakeSFTP(fixtures.FakeSFTP):
    def rename(self, source, target):
        if target in self.ftp.files or target in self.ftp.dirs:
            raise FileExistsError(errno.EEXIST, 'existing target')
        return self.ftp.rename(source, target)
    def posix_rename(self, *args):
        raise AssertionError('Overwrite rename is forbidden for route installation')

class RoutingTests(unittest.TestCase):
    def setUp(self):
        self.original = {'index.html': b'index', 'sw.js': b'worker', 'manifest.webmanifest': b'manifest'}
        self.ftp = original.FakeFTP(self.original)
        self.sftp = FakeSFTP(self.ftp)
        self.remote = release.Remote(adapter.SFTPBridge(Mock(), self.sftp))
        self.patches = patch.dict(routes.LIVE_HASHES, {p:release.digest(b) for p,b in self.original.items()}, clear=True)
        self.patches.start(); self.addCleanup(self.patches.stop)
        self.verify = Mock(return_value=[{'path':'/informations','status':200}])
    def install(self):
        return routes.install(self.remote, DATA, RID, verify=self.verify)
    def mutation_calls(self):
        return [c for c in self.ftp.calls if c[0] in ('stor','rename','mkd','delete')]
    def test_exact_reviewed_public_config(self):
        self.assertEqual(release.digest(DATA), routes.CONFIG_SHA)
        self.assertNotIn(b'Options', DATA); self.assertNotIn(b'Require', DATA)
    def test_success_only_adds_exact_config_and_public_record(self):
        before=dict(self.ftp.files); self.install()
        self.assertEqual(self.ftp.files[TARGET],DATA)
        for p,b in before.items():self.assertEqual(self.ftp.files[p],b)
        self.verify.assert_called_once_with(RID)
        self.assertFalse(any(c[0]=='delete' for c in self.ftp.calls))
    def test_existing_file_directory_and_symlink_all_block(self):
        for mode in ('file','dir','symlink'):
            with self.subTest(mode=mode):
                with patch.object(self.sftp,'lstat',return_value=Mock(st_mode={'file':0o100644,'dir':0o40755,'symlink':0o120777}[mode])):
                    with self.assertRaises(release.ReleaseError):routes.require_absent(self.sftp,TARGET)
    def test_existing_config_blocks_before_any_write(self):
        self.ftp.files[TARGET]=b'private';
        with self.assertRaises(release.ReleaseError):self.install()
        self.assertEqual(self.ftp.files[TARGET],b'private');self.assertEqual(self.mutation_calls(),[])
    def test_permission_and_other_errors_are_not_absence(self):
        for code in (errno.EACCES,errno.EPERM,errno.EIO):
            with self.subTest(code=code),patch.object(self.sftp,'lstat',side_effect=OSError(code,'unsafe')):
                with self.assertRaises(release.ReleaseError):routes.require_absent(self.sftp,TARGET)
    def test_missing_is_accepted(self):
        routes.require_absent(self.sftp,TARGET)
    def test_bad_artifact_or_identity_blocks_writes(self):
        with self.assertRaises(release.ReleaseError):routes.install(self.remote,b'other',RID,self.verify)
        self.ftp.files['/home/www/index.html']=b'drift'
        with self.assertRaises(release.ReleaseError):self.install()
        self.assertEqual(self.mutation_calls(),[])
    def test_staging_corruption_blocks_promotion(self):
        self.ftp.corrupt_stores=True
        with self.assertRaises(release.ReleaseError):self.install()
        self.assertNotIn(TARGET,self.ftp.files)
    def test_config_appearing_during_staging_is_preserved(self):
        self.ftp.on_manifest=lambda ftp:ftp.files.__setitem__(TARGET,b'other config')
        with self.assertRaises(release.ReleaseError):self.install()
        self.assertEqual(self.ftp.files[TARGET],b'other config')
    def test_live_identity_drift_during_staging_blocks_promotion(self):
        self.ftp.on_manifest=lambda ftp:ftp.files.__setitem__('/home/www/sw.js',b'drift')
        with self.assertRaises(release.ReleaseError):self.install()
        self.assertNotIn(TARGET,self.ftp.files)
    def test_standard_rename_rejects_race_without_overwrite(self):
        old=self.sftp.rename
        def race(source,target):
            self.ftp.files[target]=b'concurrent config';return old(source,target)
        with patch.object(self.sftp,'rename',side_effect=race):
            with self.assertRaises(FileExistsError):self.install()
        self.assertEqual(self.ftp.files[TARGET],b'concurrent config')
    def test_http_failure_leaves_config_for_review_without_moving_it(self):
        self.verify.side_effect=release.ReleaseError('bad HTTP')
        with self.assertRaises(release.ReleaseError):self.install()
        self.assertEqual(self.ftp.files[TARGET],DATA)
        self.assertFalse(any('reverted-route-config' in p for p in self.ftp.files))
        self.assertEqual(len([c for c in self.ftp.calls if c[0]=='rename']),1)
    def test_changed_config_is_never_moved_or_exposed_after_http_failure(self):
        def changed(_):
            self.ftp.files[TARGET]=b'unknown';raise release.ReleaseError('bad HTTP')
        self.verify.side_effect=changed
        with self.assertRaises(release.ReleaseError):self.install()
        self.assertEqual(self.ftp.files[TARGET],b'unknown')
        self.assertFalse(any(b==b'unknown' and p!=TARGET for p,b in self.ftp.files.items()))
        self.assertEqual(len([c for c in self.ftp.calls if c[0]=='rename']),1)
    def test_http_acceptance_and_failure_cases(self):
        def good(path,token):
            if path.startswith('/faq'):return 301,{'Location':'/informations'},b''
            if '__missing_' in path:return 404,{},b'missing'
            if path=='/sw.js':return 200,{},b'worker'
            if path=='/manifest.webmanifest':return 200,{},b'manifest'
            return 200,{},b'index'
        self.assertEqual(len(routes.verify_http(RID,good)),12)
        for kind in ('route404','soft404','external_redirect','worker_drift','manifest_drift'):
            def bad(path,token):
                if kind=='route404' and path=='/informations':return 404,{},b'missing'
                if kind=='soft404' and '__missing_' in path:return 200,{},b'index'
                if kind=='external_redirect' and path.startswith('/faq'):return 301,{'Location':'https://other.example/informations'},b''
                if kind=='worker_drift' and path=='/sw.js':return 200,{},b'wrong'
                if kind=='manifest_drift' and path=='/manifest.webmanifest':return 200,{},b'wrong'
                return good(path,token)
            with self.subTest(kind=kind),self.assertRaises(release.ReleaseError):routes.verify_http(RID,bad)

if __name__=='__main__':unittest.main(verbosity=2)
