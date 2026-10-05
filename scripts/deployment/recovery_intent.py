#!/usr/bin/env python3
"""Validate an explicitly reviewed rollback-only main commit, without hosting access."""
import json
import os
import sys

import ovh_release as release
import release_intent as common

INTENT_PATH = 'scripts/deployment/recovery-intent.json'
ACTIVE_KEYS = {'schema', 'operation', 'reviewed_recovery_commit', 'release_plan_commit',
               'release_id', 'plan_sha256', 'expected_index_sha256', 'expected_htaccess_sha256'}


def evaluate(event, environ, read=common.read_json, run_git=common.git):
    if (environ.get('GITHUB_REPOSITORY') != common.REPOSITORY or
            environ.get('GITHUB_REF') != 'refs/heads/main' or environ.get('GITHUB_EVENT_NAME') != 'push'):
        return None
    head, before = environ.get('GITHUB_SHA', ''), event.get('before', '')
    release.require(release.COMMIT.fullmatch(head) and release.COMMIT.fullmatch(before) and before != '0' * 40,
                    'Recovery requires exact existing main history.')
    release.require(run_git('rev-parse', 'HEAD') == head, 'Recovery checkout differs from workflow commit.')
    if not run_git('diff', '--name-only', before, head, '--', INTENT_PATH):
        return None
    intent = read(INTENT_PATH)
    release.require(isinstance(intent, dict) and intent.get('schema') == 1, 'Invalid recovery intent schema.')
    if intent.get('operation') == 'none':
        release.require(set(intent) == {'schema', 'operation'}, 'Inactive recovery intent has unexpected fields.')
        return None
    release.require(set(intent) == ACTIVE_KEYS and intent.get('operation') == 'rollback',
                    'Invalid active recovery intent.')
    reviewed, original = intent['reviewed_recovery_commit'], intent['release_plan_commit']
    for value in (reviewed, original):
        release.require(isinstance(value, str) and release.COMMIT.fullmatch(value), 'Exact recovery commit required.')
    release.require(before == reviewed and run_git('rev-list', '--parents', '-n', '1', head).split() == [head, reviewed],
                    'Recovery must be a one-commit, non-merge child of reviewed current main.')
    release.require(run_git('diff', '--name-only', reviewed, head).splitlines() == [INTENT_PATH],
                    'Only the explicitly reviewed recovery intent may change.')
    release.require(isinstance(intent['release_id'], str) and release.RELEASE.fullmatch(intent['release_id']),
                    'Original release ID is required.')
    for key in ('plan_sha256', 'expected_index_sha256', 'expected_htaccess_sha256'):
        release.require(isinstance(intent[key], str) and release.SHA256.fullmatch(intent[key]),
                        'Exact reviewed recovery fingerprints are required.')
    run_git('merge-base', '--is-ancestor', original, reviewed)
    plan = json.loads(run_git('show', original + ':' + common.PLAN_PATH))
    release.require(isinstance(plan, dict) and plan.get('schema') == 2 and
                    release.plan_digest(plan) == intent['plan_sha256'], 'Original reviewed recovery plan digest differs.')
    source = plan.get('source_commit', '')
    release.require(isinstance(source, str) and release.COMMIT.fullmatch(source), 'Invalid original recovery source.')
    run_git('merge-base', '--is-ancestor', source, original)
    return {**intent, 'source_commit': source}


def current_intent():
    return evaluate(common.read_json(os.environ['GITHUB_EVENT_PATH']), os.environ)


def main():
    try:
        intent = current_intent()
        release.require('--require-active' not in sys.argv or intent is not None, 'No new reviewed recovery is active.')
        output = {'enabled': 'true' if intent else 'false'}
        if intent:
            output.update({key: intent[key] for key in ('release_plan_commit', 'source_commit')})
        if os.environ.get('GITHUB_OUTPUT'):
            with open(os.environ['GITHUB_OUTPUT'], 'a') as stream:
                for key, value in output.items():
                    stream.write(key + '=' + value + '\n')
        print(json.dumps(output, sort_keys=True))
        return 0
    except release.ReleaseError as error:
        print('Stopped: ' + str(error), file=sys.stderr)
    except (OSError, ValueError, KeyError, TypeError, common.subprocess.SubprocessError):
        print('Stopped: immutable recovery intent/history could not be verified.', file=sys.stderr)
    return 1


if __name__ == '__main__':
    sys.exit(main())
