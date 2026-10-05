"""Release activation tests use real local Git history, never hosting access."""
import contextlib
import copy
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

import ovh_release as release
import release_intent as intent


class IntentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.old_cwd = Path.cwd()
        os.chdir(self.root)
        self.addCleanup(os.chdir, self.old_cwd)
        self.git('init', '-q')
        self.git('config', 'user.name', 'Offline release tests')
        self.git('config', 'user.email', 'tests@example.invalid')
        self.write('app.txt', 'reviewed application')
        self.write(intent.INTENT_PATH, {'schema': 1, 'operation': 'none'})
        self.source = self.commit('reviewed application')
        self.plan = {'schema': 2, 'source_commit': self.source, 'candidate_sha256': 'a' * 64,
                     'files': [{'path': 'index.html', 'before': 'b' * 64},
                               {'path': '.htaccess', 'before': None, 'after': 'c' * 64}]}
        self.active = {'schema': 1, 'operation': 'deploy',
                       'reviewed_application_commit': self.source,
                       'plan_sha256': release.plan_digest(self.plan),
                       'candidate_sha256': 'a' * 64, 'expected_index_sha256': 'b' * 64,
                       'expected_htaccess_sha256': 'c' * 64, 'release_id': 'reviewed-release-001'}
        self.env = {'GITHUB_REPOSITORY': intent.REPOSITORY, 'GITHUB_REF': 'refs/heads/main',
                    'GITHUB_EVENT_NAME': 'push'}
        self.event = {'before': self.source}

    def git(self, *args):
        return subprocess.check_output(['git', *args], text=True, stderr=subprocess.DEVNULL).strip()

    def write(self, name, data):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data) if isinstance(data, dict) else data)

    def commit(self, message):
        self.git('add', '.')
        self.git('commit', '-qm', message)
        return self.git('rev-parse', 'HEAD')

    def prepare(self):
        self.write(intent.INTENT_PATH, self.active)
        self.write(intent.PLAN_PATH, self.plan)
        self.env['GITHUB_SHA'] = self.commit('reviewed release intent')

    def evaluate(self):
        return intent.evaluate(self.event, self.env)

    def reject(self):
        with self.assertRaises((release.ReleaseError, subprocess.CalledProcessError)):
            self.evaluate()

    def test_valid_release_only_push(self):
        self.prepare()
        self.assertEqual(self.evaluate()['source_commit'], self.source)

    def test_inactive_intent_is_inert(self):
        self.write(intent.INTENT_PATH, '{"operation":"none","schema":1}\n')
        self.env['GITHUB_SHA'] = self.commit('inactive formatting')
        self.assertIsNone(self.evaluate())

    def test_ordinary_push_without_intent_change_is_inert(self):
        self.write('app.txt', 'new application')
        self.env['GITHUB_SHA'] = self.commit('application update')
        self.assertIsNone(self.evaluate())

    def test_old_active_intent_is_inert_on_later_copy_change(self):
        self.prepare()
        self.event['before'] = self.env['GITHUB_SHA']
        self.write('app.txt', 'later copy')
        self.env['GITHUB_SHA'] = self.commit('later copy')
        self.assertIsNone(self.evaluate())

    def test_pull_requests_forks_and_non_main_cannot_activate(self):
        self.prepare()
        for key, value in [('GITHUB_EVENT_NAME', 'pull_request'),
                           ('GITHUB_REPOSITORY', 'another/repository'),
                           ('GITHUB_REF', 'refs/heads/develop')]:
            with self.subTest(key=key):
                self.assertIsNone(intent.evaluate(self.event, {**self.env, key: value}))

    def test_preflight_does_not_activate_deploy(self):
        self.prepare()
        self.env['GITHUB_EVENT_NAME'] = 'workflow_dispatch'
        self.event = {'inputs': {'operation': 'preflight'}}
        self.assertIsNone(self.evaluate())

    def test_workflow_and_application_edits_reject(self):
        for path in ('app.txt', '.github/workflows/ci.yml', 'scripts/deployment/ovh_release.py',
                     'e2e-pwa/fixtures/new/index.html', 'package-lock.json'):
            with self.subTest(path=path):
                self.git('reset', '--hard', self.source)
                self.git('clean', '-fd')
                self.write(path, 'unexpected change')
                self.prepare()
                self.reject()

    def test_multicommit_push_rejects(self):
        self.write('app.txt', 'unreviewed application')
        self.active['reviewed_application_commit'] = self.commit('another app commit')
        self.prepare()
        self.reject()

    def test_wrong_reviewed_parent_rejects(self):
        self.active['reviewed_application_commit'] = 'f' * 40
        self.prepare()
        self.reject()

    def test_merge_commit_rejects(self):
        self.prepare()
        head = self.env['GITHUB_SHA']
        tree = self.git('rev-parse', 'HEAD^{tree}')
        merged = self.git('commit-tree', tree, '-p', head, '-p', self.source, '-m', 'merge')
        self.git('reset', '--hard', merged)
        self.env['GITHUB_SHA'] = merged
        self.reject()

    def test_checkout_substitution_rejects(self):
        self.prepare()
        self.env['GITHUB_SHA'] = self.source
        self.reject()

    def test_new_branch_push_rejects(self):
        self.prepare()
        self.event['before'] = '0' * 40
        self.reject()

    def test_plan_tamper_rejects(self):
        self.plan['files'][0]['before'] = 'e' * 64
        self.prepare()
        self.reject()

    def test_candidate_digest_mismatch_rejects(self):
        self.active['candidate_sha256'] = 'e' * 64
        self.prepare()
        self.reject()

    def test_index_mismatch_rejects(self):
        self.active['expected_index_sha256'] = 'e' * 64
        self.prepare()
        self.reject()

    def test_config_mismatch_rejects(self):
        self.active['expected_htaccess_sha256'] = 'e' * 64
        self.prepare()
        self.reject()

    def test_config_replacement_plan_rejects(self):
        self.plan['files'][1]['before'] = 'c' * 64
        self.active['plan_sha256'] = release.plan_digest(self.plan)
        self.prepare()
        self.reject()

    def test_duplicate_entrypoints_reject(self):
        self.plan['files'].append(copy.deepcopy(self.plan['files'][0]))
        self.active['plan_sha256'] = release.plan_digest(self.plan)
        self.prepare()
        self.reject()

    def test_unknown_recovery_source_rejects(self):
        self.plan['source_commit'] = 'f' * 40
        self.active['plan_sha256'] = release.plan_digest(self.plan)
        self.prepare()
        self.reject()

    def test_extra_intent_fields_reject(self):
        self.active['skip_tests'] = True
        self.prepare()
        self.reject()

    def test_output_injection_in_release_id_rejects(self):
        self.active['release_id'] = 'release-001\nenabled=true'
        self.prepare()
        self.reject()

    def test_invalid_fingerprint_rejects(self):
        self.active['expected_index_sha256'] = 'not-reviewed'
        self.prepare()
        self.reject()

    def test_valid_manual_confirmation(self):
        self.prepare()
        self.env['GITHUB_EVENT_NAME'] = 'workflow_dispatch'
        self.event = {'inputs': {'operation': 'deploy', 'reviewed_commit': self.env['GITHUB_SHA'],
                                'expected_index_sha256': 'b' * 64, 'htaccess': 'preserve'}}
        self.assertEqual(self.evaluate()['release_id'], self.active['release_id'])

    def test_manual_confirmation_cannot_override_reviewed_values(self):
        self.prepare()
        self.env['GITHUB_EVENT_NAME'] = 'workflow_dispatch'
        inputs = {'operation': 'deploy', 'reviewed_commit': self.env['GITHUB_SHA'],
                  'expected_index_sha256': 'b' * 64, 'htaccess': 'preserve'}
        for key, value in [('reviewed_commit', self.source), ('expected_index_sha256', 'e' * 64),
                           ('htaccess', 'confirmed-absent')]:
            with self.subTest(key=key):
                self.event = {'inputs': {**inputs, key: value}}
                self.reject()

    def test_manual_deploy_with_inactive_intent_rejects(self):
        self.env.update(GITHUB_SHA=self.source, GITHUB_EVENT_NAME='workflow_dispatch')
        self.event = {'inputs': {'operation': 'deploy'}}
        self.reject()


if __name__ == '__main__':
    unittest.main()
