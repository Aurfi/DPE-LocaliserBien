"""Offline explicit-recovery behavior and workflow isolation tests."""
import contextlib
import io
import json
import os
from pathlib import Path
import re
import sys
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts/deployment'))
sys.path.insert(0, str(ROOT / 'tests/deployment_sftp'))
import ovh_release as release
import ovh_sftp_release as adapter
import reviewed_sftp_recovery as recovery
import test_ovh_release as original
import test_ovh_sftp_release as fixtures


class RecoveryEntrypointTests(unittest.TestCase):
    def setUp(self):
        self.fixture = original.ReleaseTests(methodName='test_order_retention_and_config_preserved')
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.fixture.remote = release.Remote(adapter.SFTPBridge(Mock(), fixtures.FakeSFTP(self.fixture.ftp)))
        self.fixture.publish()
        self.ftp = self.fixture.ftp
        self.ftp.calls.clear()
        self.bridge = adapter.SFTPBridge(Mock(), fixtures.FakeSFTP(self.ftp))
        self.intent = {'release_plan_commit': 'a' * 40, 'release_id': self.fixture.args.release_id,
                       'expected_index_sha256': release.digest(self.fixture.new['index.html']),
                       'expected_htaccess_sha256': release.digest(self.fixture.old['.htaccess']),
                       'plan_sha256': release.plan_digest(json.loads(Path(self.fixture.args.plan).read_text()))}
        self.plan_patch = patch.object(recovery, 'PLAN_PATH', self.fixture.args.plan)
        self.plan_patch.start()
        self.addCleanup(self.plan_patch.stop)

    def run_recovery(self):
        with contextlib.redirect_stdout(io.StringIO()):
            recovery.recover(self.intent, self.fixture.root, connect=Mock(return_value=self.bridge))

    def assert_no_writes(self):
        self.assertFalse({'stor', 'rename', 'mkd'} & {call[0] for call in self.ftp.calls})

    def test_explicit_recovery_restores_mutables_retains_assets_and_closes(self):
        self.run_recovery()
        for name in ('index.html', 'sw.js', 'manifest.webmanifest', 'data/existing.json', '.htaccess'):
            self.assertEqual(self.ftp.files['/home/www/' + name], self.fixture.old[name])
        self.assertEqual(self.ftp.files['/home/www/assets/new-hash.js'], self.fixture.new['assets/new-hash.js'])
        self.bridge.client.close.assert_called_once()

    def test_known_partial_promotion_is_recoverable(self):
        self.ftp.files['/home/www/sw.js'] = self.fixture.old['sw.js']
        self.run_recovery()
        self.assertEqual(self.ftp.files['/home/www/index.html'], self.fixture.old['index.html'])
        self.assertEqual(self.ftp.files['/home/www/sw.js'], self.fixture.old['sw.js'])

    def test_unknown_live_drift_blocks_all_writes(self):
        self.ftp.files['/home/www/data/existing.json'] = b'unknown edit'
        with self.assertRaises(release.ReleaseError):
            self.run_recovery()
        self.assert_no_writes()

    def test_config_drift_blocks_all_writes(self):
        self.ftp.files['/home/www/.htaccess'] = b'unknown config'
        with self.assertRaises(release.ReleaseError):
            self.run_recovery()
        self.assert_no_writes()

    def test_wrong_original_release_identity_blocks_all_writes(self):
        self.intent['release_plan_commit'] = 'b' * 40
        with self.assertRaises(release.ReleaseError):
            self.run_recovery()
        self.assert_no_writes()

    def test_wrong_live_index_blocks_all_writes(self):
        self.intent['expected_index_sha256'] = 'f' * 64
        with self.assertRaises(release.ReleaseError):
            self.run_recovery()
        self.assert_no_writes()

    def test_plan_digest_tamper_rejects_before_connection(self):
        self.intent['plan_sha256'] = 'f' * 64
        connect = Mock()
        with self.assertRaises(release.ReleaseError):
            recovery.recover(self.intent, self.fixture.root, connect=connect)
        connect.assert_not_called()

    def test_missing_recovery_bytes_reject_before_connection(self):
        (self.fixture.root / 'public/index.html').write_bytes(b'wrong original')
        connect = Mock()
        with self.assertRaises(release.ReleaseError):
            recovery.recover(self.intent, self.fixture.root, connect=connect)
        connect.assert_not_called()


class RecoveryMainTests(unittest.TestCase):
    def run_main(self, intent, refs):
        with patch.dict(os.environ, {'GITHUB_SHA': 'a' * 40}), \
             patch.object(recovery.recovery_intent, 'current_intent', return_value=intent), \
             patch.object(recovery, 'git', side_effect=refs), patch.object(recovery, 'recover') as recover, \
             contextlib.redirect_stderr(io.StringIO()):
            return recovery.main(), recover

    def test_all_three_exact_checkouts_are_required_before_connection(self):
        intent = {'release_plan_commit': 'b' * 40, 'source_commit': 'c' * 40}
        for refs in [['d' * 40], ['b' * 40, 'd' * 40], ['b' * 40, 'c' * 40, 'd' * 40]]:
            result, recover = self.run_main(intent, refs)
            self.assertEqual(result, 1)
            recover.assert_not_called()

    def test_no_intent_rejects_before_recovery(self):
        result, recover = self.run_main(None, [])
        self.assertEqual(result, 1)
        recover.assert_not_called()

    def test_valid_checkouts_reach_explicit_recovery(self):
        result, recover = self.run_main({'release_plan_commit': 'b' * 40, 'source_commit': 'c' * 40},
                                       ['b' * 40, 'c' * 40, 'a' * 40])
        self.assertEqual(result, 0)
        recover.assert_called_once()


class RecoveryWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.workflow = (ROOT / '.github/workflows/ovh-rollback.yml').read_text()

    def job(self, name):
        return re.search(r'^  ' + re.escape(name) + r':\n(.*?)(?=^  [A-Za-z0-9_-]+:|\Z)',
                         self.workflow, re.M | re.S).group(1)

    def test_manual_gate_is_unchanged_and_never_runs_on_push(self):
        manual = self.job('rollback')
        self.assertIn("github.event_name == 'workflow_dispatch'", manual)
        self.assertIn('OVH_RELEASE_ENABLED: ${{ vars.OVH_RELEASE_ENABLED }}', manual)

    def test_intent_gate_has_no_hosting_secrets_or_environment(self):
        validator = self.job('recovery-intent')
        self.assertIn("github.event_name == 'push'", validator)
        self.assertNotIn('secrets.', validator)
        self.assertNotIn('environment:', validator)
        self.assertIn('persist-credentials: false', validator)

    def test_explicit_recovery_preserves_all_boundaries_and_tests_before_secrets(self):
        job = self.job('recover-reviewed-intent')
        for text in ('needs: [recovery-intent]', "needs.recovery-intent.outputs.enabled == 'true'",
                     'environment: ovh-production', 'group: localiserbien-production',
                     'cancel-in-progress: false', 'OVH_SFTP_HOST_KEY_TYPE: ssh-ed25519',
                     'SHA256:6053kGsbCzj0rOIpNAz9SNbToAfBc/rUoX/LlnG1AhY',
                     'recovery_intent.py --require-active', 'tests/deployment_workflow',
                     'ref: ${{ needs.recovery-intent.outputs.release_plan_commit }}',
                     'ref: ${{ needs.recovery-intent.outputs.source_commit }}',
                     'reviewed_sftp_recovery.py', 'OVH_RELEASE_ENABLED: reviewed-and-approved'):
            self.assertIn(text, job)
        self.assertLess(job.index('python3 -m unittest'), job.index('secrets.FTP_'))
        self.assertNotIn('if: always()', job)
        self.assertNotIn('continue-on-error', job)
        self.assertNotIn('workflow_run:', self.workflow)
        self.assertIn('permissions:\n  contents: read', self.workflow)
        self.assertNotIn(': write', self.workflow)

    def test_intent_file_has_an_explicit_operation(self):
        intent = json.loads((ROOT / 'scripts/deployment/recovery-intent.json').read_text())
        self.assertEqual(intent['schema'], 1)
        self.assertIn(intent['operation'], ('none', 'rollback'))


if __name__ == '__main__':
    unittest.main()
