"""Real-Git activation failure cases for explicit recovery; no hosting access."""
import json
import hashlib
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

import ovh_release as release
import recovery_intent as intent


class RecoveryIntentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        old = Path.cwd()
        os.chdir(self.root)
        self.addCleanup(os.chdir, old)
        self.git('init', '-q')
        self.git('config', 'user.name', 'Offline recovery test')
        self.git('config', 'user.email', 'test@example.invalid')
        self.write('app.txt', 'application')
        self.write(intent.INTENT_PATH, {'schema': 1, 'operation': 'none'})
        self.source = self.commit('recovery sources')
        self.plan = {'schema': 2, 'source_commit': self.source, 'candidate_sha256': 'a' * 64, 'files': []}
        self.write(intent.common.PLAN_PATH, self.plan)
        self.original = self.commit('original release')
        self.write('app.txt', 'later reviewed application')
        self.reviewed = self.commit('current reviewed main')
        self.active = {'schema': 1, 'operation': 'rollback', 'reviewed_recovery_commit': self.reviewed,
                       'release_plan_commit': self.original, 'release_id': 'original-release-001',
                       'plan_sha256': release.plan_digest(self.plan), 'expected_index_sha256': 'b' * 64,
                       'expected_htaccess_sha256': 'c' * 64}
        self.event = {'before': self.reviewed}
        self.env = {'GITHUB_REPOSITORY': intent.common.REPOSITORY, 'GITHUB_REF': 'refs/heads/main',
                    'GITHUB_EVENT_NAME': 'push'}

    def git(self, *args):
        return subprocess.check_output(['git', *args], text=True, stderr=subprocess.DEVNULL).strip()

    def write(self, name, value):
        p = self.root / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(value) if isinstance(value, dict) else value)

    def commit(self, message):
        self.git('add', '.')
        self.git('commit', '-qm', message)
        return self.git('rev-parse', 'HEAD')

    def prepare(self):
        self.write(intent.INTENT_PATH, self.active)
        self.env['GITHUB_SHA'] = self.commit('reviewed recovery-only intent')

    def evaluate(self):
        return intent.evaluate(self.event, self.env)

    def reject(self):
        with self.assertRaises((release.ReleaseError, subprocess.CalledProcessError)):
            self.evaluate()

    def test_valid_recovery_after_main_advanced_uses_original_plan(self):
        self.prepare()
        result = self.evaluate()
        self.assertEqual(result['source_commit'], self.source)
        self.assertEqual(result['release_plan_commit'], self.original)

    def test_inactive_extension_does_not_activate(self):
        self.write(intent.INTENT_PATH, '{"operation":"none","schema":1}\n')
        self.env['GITHUB_SHA'] = self.commit('inactive extension')
        self.assertIsNone(self.evaluate())

    def test_stale_intent_on_ordinary_push_is_inert(self):
        self.prepare()
        self.event['before'] = self.env['GITHUB_SHA']
        self.write('app.txt', 'ordinary change')
        self.env['GITHUB_SHA'] = self.commit('ordinary update')
        self.assertIsNone(self.evaluate())

    def test_pr_fork_non_main_and_manual_events_are_inert(self):
        self.prepare()
        for key, value in [('GITHUB_EVENT_NAME', 'pull_request'), ('GITHUB_EVENT_NAME', 'workflow_dispatch'),
                           ('GITHUB_REPOSITORY', 'someone/fork'), ('GITHUB_REF', 'refs/heads/develop')]:
            self.assertIsNone(intent.evaluate(self.event, {**self.env, key: value}))

    def test_any_extra_file_change_rejects(self):
        for path in ('app.txt', intent.common.PLAN_PATH, '.github/workflows/ovh-rollback.yml'):
            self.git('reset', '--hard', self.reviewed)
            self.write(path, 'unexpected change')
            self.prepare()
            self.reject()

    def test_multi_commit_push_rejects(self):
        self.write('app.txt', 'intervening change')
        self.active['reviewed_recovery_commit'] = self.commit('intervening main')
        self.prepare()
        self.reject()

    def test_wrong_reviewed_parent_rejects(self):
        self.active['reviewed_recovery_commit'] = self.original
        self.prepare()
        self.reject()

    def test_merge_commit_rejects(self):
        self.prepare()
        merged = self.git('commit-tree', self.git('rev-parse', 'HEAD^{tree}'), '-p', self.env['GITHUB_SHA'],
                          '-p', self.source, '-m', 'merge')
        self.git('reset', '--hard', merged)
        self.env['GITHUB_SHA'] = merged
        self.reject()

    def test_checkout_substitution_rejects(self):
        self.prepare()
        self.env['GITHUB_SHA'] = self.original
        self.reject()

    def test_unrelated_original_commit_rejects(self):
        self.active['release_plan_commit'] = 'f' * 40
        self.prepare()
        self.reject()

    def test_plan_digest_mismatch_rejects(self):
        self.active['plan_sha256'] = 'e' * 64
        self.prepare()
        self.reject()

    def test_output_injection_and_empty_fingerprints_reject(self):
        for key, value in [('release_id', 'original-001\nenabled=true'), ('expected_index_sha256', ''),
                           ('expected_htaccess_sha256', 'not-a-sha')]:
            self.git('reset', '--hard', self.reviewed)
            active = self.active.copy()
            self.active[key] = value
            self.prepare()
            self.reject()
            self.active = active

    def test_extra_field_rejects(self):
        self.active['automatic_on_failure'] = True
        self.prepare()
        self.reject()


class RecoveryFixtureTests(unittest.TestCase):
    def test_all_six_public_before_images_keep_verified_production_bytes(self):
        root = Path(__file__).resolve().parents[2] / 'e2e-pwa/fixtures/production-2026-10-05/static'
        hashes = {
            'index.html': 'a3500dfac937951659125bec6341bfc2664286d2529e5dd424ddea1f4dd4f0ef',
            'sw.js': 'c6364a1aa4137e9f2c9b23c359c975aa6949e3265e946d8b5f20ccd4aab4c04a',
            'robots.txt': 'f060ffedbdfb044217dabda65184601d920fe6901f7faa22376479986501a0bd',
            'robots.txt.template': 'cd81852a62af8d04c449a7611a90c7f0df688842321cf7d88f3200107beac630',
            'sitemap.xml': 'eeef63fdba2c9c63deb4bc0375a4955c9581d3dc859d44bdff27369abb155475',
            'sitemap.xml.template': '65c27676c17880dfdfdd335bb59d44ef10477cc1a88aa739697e48a0bd62ae70',
        }
        for name, expected in hashes.items():
            with self.subTest(path=name):
                self.assertEqual(hashlib.sha256((root / name).read_bytes()).hexdigest(), expected)


if __name__ == '__main__':
    unittest.main()
