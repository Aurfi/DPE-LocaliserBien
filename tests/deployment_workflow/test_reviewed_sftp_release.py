"""No-network reusable deployment and workflow boundary regressions."""
import contextlib
import io
import json
from pathlib import Path
import re
import sys
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts/deployment'))
sys.path.insert(0, str(ROOT / 'tests/deployment_sftp'))
import ovh_release as release
import reviewed_sftp_release as reviewed
import test_ovh_release as original
import test_ovh_sftp_release as sftp_tests


class PreservedConfigurationTests(sftp_tests.EngineOverSFTPTests):
    """Existing failure and rollback suite also runs with exact config preservation."""
    def setUp(self):
        super().setUp()
        self.args.expected_htaccess = release.digest(self.old['.htaccess'])

    def publish(self):
        # Legacy first-time config tests remain valid outside the preserve-only route.
        if self.args.htaccess != 'preserve':
            self.args.expected_htaccess = ''
        super().publish()

    def test_config_drift_blocks_all_remote_writes(self):
        self.prepare_plan()
        self.ftp.files['/home/www/.htaccess'] = b'unknown change'
        with self.assertRaises(release.ReleaseError):
            release.deploy(self.remote, self.args, self.new)
        self.assertFalse({'stor', 'rename', 'mkd'} & {x[0] for x in self.ftp.calls})

    def test_config_drift_during_staging_blocks_live_promotion(self):
        self.ftp.on_manifest = lambda ftp: ftp.files.update({'/home/www/.htaccess': b'changed'})
        with self.assertRaises(release.ReleaseError):
            self.publish()
        self.assertEqual(self.public_writes(), [])

    def test_config_drift_during_promotion_stops_next_live_write(self):
        def drift(ftp, source, target):
            if target == '/home/www/data/existing.json':
                ftp.files['/home/www/.htaccess'] = b'changed during promotion'
        self.ftp.on_rename = drift
        with self.assertRaises(release.ReleaseError):
            self.publish()
        self.assertEqual(self.ftp.files['/home/www/index.html'], self.old['index.html'])
        self.assertEqual(self.ftp.files['/home/www/sw.js'], self.old['sw.js'])

    def test_preserve_only_recovery_rejects_legacy_config_removal_before_writes(self):
        del self.ftp.files['/home/www/.htaccess']
        self.args.htaccess = 'confirmed-absent'
        self.publish()
        self.args.expected_htaccess = release.digest(self.new['.htaccess'])
        self.args.htaccess = 'preserve'
        self.ftp.calls.clear()
        with self.assertRaisesRegex(release.ReleaseError, 'cannot remove an introduced'):
            self.recover()
        self.assertFalse({'stor', 'rename', 'mkd'} & {x[0] for x in self.ftp.calls})
        self.assertEqual(self.ftp.files['/home/www/index.html'], self.new['index.html'])
        self.assertEqual(self.ftp.files['/home/www/sw.js'], self.new['sw.js'])
        self.assertEqual(self.ftp.files['/home/www/.htaccess'], self.new['.htaccess'])

    def test_config_drift_blocks_rollback_writes(self):
        self.publish()
        self.ftp.calls.clear()
        self.ftp.files['/home/www/.htaccess'] = b'changed'
        with self.assertRaises(release.ReleaseError):
            self.recover()
        self.assertFalse({'stor', 'rename', 'mkd'} & {x[0] for x in self.ftp.calls})


class EntrypointTests(original.ReleaseTests):
    def setUp(self):
        super().setUp()
        self.prepare_plan()
        self.plan = json.loads(Path(self.args.plan).read_text())
        self.intent = {'expected_index_sha256': self.args.expected_index,
                       'expected_htaccess_sha256': release.digest(self.old['.htaccess']),
                       'release_id': self.args.release_id,
                       'plan_sha256': release.plan_digest(self.plan),
                       'candidate_sha256': release.build_digest(self.new)}

    def test_valid_reviewed_candidate_publishes_and_closes(self):
        self.ftp.close = Mock()
        connection = Mock(return_value=self.ftp)
        with patch.object(reviewed.release_intent, 'PLAN_PATH', self.args.plan), contextlib.redirect_stdout(io.StringIO()):
            reviewed.publish(self.intent, self.new, self.root, connect=connection)
        connection.assert_called_once()
        self.ftp.close.assert_called_once()
        self.assertEqual(self.ftp.files['/home/www/index.html'], self.new['index.html'])

    def test_substituted_artifact_rejects_before_connection(self):
        connection = Mock()
        with patch.object(reviewed.release_intent, 'PLAN_PATH', self.args.plan):
            with self.assertRaises(release.ReleaseError):
                reviewed.publish(self.intent, {**self.new, 'index.html': b'substituted'}, self.root, connect=connection)
        connection.assert_not_called()

    def test_plan_digest_tamper_rejects_before_connection(self):
        connection = Mock()
        self.intent['plan_sha256'] = 'f' * 64
        with patch.object(reviewed.release_intent, 'PLAN_PATH', self.args.plan):
            with self.assertRaises(release.ReleaseError):
                reviewed.publish(self.intent, self.new, self.root, connect=connection)
        connection.assert_not_called()

    def test_missing_recovery_bytes_reject_before_connection(self):
        connection = Mock()
        (self.root / 'public/index.html').write_bytes(b'wrong recovery bytes')
        with patch.object(reviewed.release_intent, 'PLAN_PATH', self.args.plan):
            with self.assertRaises(release.ReleaseError):
                reviewed.publish(self.intent, self.new, self.root, connect=connection)
        connection.assert_not_called()

    def test_connection_closed_after_live_drift(self):
        self.ftp.close = Mock()
        self.ftp.files['/home/www/index.html'] = b'changed live index'
        with patch.object(reviewed.release_intent, 'PLAN_PATH', self.args.plan):
            with self.assertRaises(release.ReleaseError):
                reviewed.publish(self.intent, self.new, self.root, connect=Mock(return_value=self.ftp))
        self.ftp.close.assert_called_once()
        self.assertFalse({'stor', 'rename', 'mkd'} & {x[0] for x in self.ftp.calls})


class MainEntrypointTests(unittest.TestCase):
    def setUp(self):
        self.intent = {'source_commit': 'b' * 40}
        self.environ = patch.dict(reviewed.os.environ, {'GITHUB_SHA': 'a' * 40})
        self.environ.start()
        self.addCleanup(self.environ.stop)

    def run_main(self, intent_value, commits):
        with patch('sys.argv', ['reviewed_sftp_release.py']), \
             patch.object(reviewed.release_intent, 'current_intent', return_value=intent_value), \
             patch.object(reviewed.release_intent, 'git', side_effect=commits), \
             patch.object(reviewed.release, 'inventory', return_value={'index.html': b'candidate'}), \
             patch.object(reviewed, 'publish') as publish, \
             contextlib.redirect_stderr(io.StringIO()):
            result = reviewed.main()
            return result, publish

    def test_advanced_main_rejects_before_publish(self):
        result, publish = self.run_main(self.intent, ['b' * 40, 'c' * 40])
        self.assertEqual(result, 1)
        publish.assert_not_called()

    def test_substituted_baseline_commit_rejects_before_publish(self):
        result, publish = self.run_main(self.intent, ['c' * 40, 'a' * 40])
        self.assertEqual(result, 1)
        publish.assert_not_called()

    def test_no_intent_rejects_before_publish(self):
        result, publish = self.run_main(None, [])
        self.assertEqual(result, 1)
        publish.assert_not_called()

    def test_matching_checkouts_reach_only_reviewed_publish(self):
        result, publish = self.run_main(self.intent, ['b' * 40, 'a' * 40])
        self.assertEqual(result, 0)
        publish.assert_called_once()



class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.text = (ROOT / '.github/workflows/ci.yml').read_text()
        starts = list(re.finditer(r'^  ([a-z][a-z-]+):$', self.text, re.M))
        self.jobs = {match.group(1): self.text[match.end():starts[i + 1].start() if i + 1 < len(starts) else len(self.text)]
                     for i, match in enumerate(starts)}

    def test_only_protected_jobs_use_existing_host_secrets(self):
        for name, job in self.jobs.items():
            if 'secrets.FTP_' not in job:
                continue
            self.assertIn(name, ('preflight', 'deploy'))
            self.assertIn('environment: ovh-production', job)
            self.assertIn('group: localiserbien-production', job)
            self.assertIn('cancel-in-progress: false', job)
            self.assertIn('OVH_SFTP_HOST_KEY_TYPE: ssh-ed25519', job)
            self.assertIn('SHA256:6053kGsbCzj0rOIpNAz9SNbToAfBc/rUoX/LlnG1AhY', job)

    def test_token_remains_read_only_and_no_persisted_checkout_credentials(self):
        self.assertIn('permissions:\n  contents: read\n', self.text)
        self.assertNotIn(': write', self.text)
        for block in self.text.split('uses: actions/checkout@v4')[1:]:
            self.assertIn('persist-credentials: false', block.split('    - ')[0])

    def test_every_test_gate_is_required_and_same_run_artifact_used(self):
        deploy = self.jobs['deploy']
        self.assertIn('needs: [lint-and-test, security-check, pwa-lifecycle, deployment-safety, release-intent]', deploy)
        self.assertIn("needs.release-intent.outputs.enabled == 'true'", deploy)
        self.assertIn('name: build-artifacts', deploy)
        self.assertNotIn('npm run build', deploy)
        self.assertNotIn('run-id:', deploy)
        self.assertIn("inputs.operation == 'deploy'", self.jobs['pwa-lifecycle'])

    def test_no_spent_release_jobs_or_ftps_deploy_path(self):
        self.assertFalse(any('once' in key or 'edf392c' in key for key in self.jobs))
        self.assertNotIn('ovh_release.py deploy', self.text)
        self.assertNotIn('FTP_TLS', self.text)
        self.assertIn('ovh_sftp_release.py preflight', self.jobs['preflight'])
        self.assertIn('reviewed_sftp_release.py', self.jobs['deploy'])

    def test_committed_intent_has_an_explicit_operation(self):
        intent = json.loads((ROOT / 'scripts/deployment/release-intent.json').read_text())
        self.assertEqual(intent['schema'], 1)
        self.assertIn(intent['operation'], ('none', 'deploy'))

    def test_rollback_retains_manual_production_and_variable_gates(self):
        rollback = (ROOT / '.github/workflows/ovh-rollback.yml').read_text()
        self.assertIn('workflow_dispatch:', rollback)
        self.assertNotRegex(rollback, r'(?m)^  (push|pull_request):')
        self.assertIn('environment: ovh-production', rollback)
        self.assertIn('group: localiserbien-production', rollback)
        self.assertIn('cancel-in-progress: false', rollback)
        self.assertIn('OVH_RELEASE_ENABLED: ${{ vars.OVH_RELEASE_ENABLED }}', rollback)
        self.assertIn('OVH_SFTP_HOST_KEY_TYPE: ssh-ed25519', rollback)
        self.assertIn('SHA256:6053kGsbCzj0rOIpNAz9SNbToAfBc/rUoX/LlnG1AhY', rollback)
        self.assertIn('ovh_sftp_release.py rollback', rollback)
        self.assertIn('--expected-htaccess "$EXPECTED_HTACCESS"', rollback)
        self.assertIn('expected_htaccess_sha256:', rollback)
        self.assertNotIn('ovh_release.py rollback', rollback)

    def test_all_six_metadata_descriptions_unchanged(self):
        descriptions = [line.split('DESCRIPTION', 1)[1] for line in self.text.splitlines() if 'DESCRIPTION' in line]
        self.assertEqual(len(descriptions), 6)
        for line in descriptions:
            self.assertIn("Recherchez gratuitement des correspondances possibles dans les données DPE publiques en France. Un résultat ne garantit pas l'identification du bien.", line)


if __name__ == '__main__':
    unittest.main()
