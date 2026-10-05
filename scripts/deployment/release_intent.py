#!/usr/bin/env python3
"""Offline, fail-closed activation for an explicitly reviewed main release."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys

import ovh_release as release

INTENT_PATH = 'scripts/deployment/release-intent.json'
PLAN_PATH = 'scripts/deployment/public-release-plan.json'
REPOSITORY = 'Aurfi/DPE-LocaliserBien'
ACTIVE_KEYS = {'schema', 'operation', 'reviewed_application_commit', 'plan_sha256',
               'candidate_sha256', 'expected_index_sha256', 'expected_htaccess_sha256',
               'release_id'}


def git(*args):
    return subprocess.check_output(['git', *args], text=True, stderr=subprocess.DEVNULL).strip()


def read_json(path):
    path = Path(path)
    release.require(path.is_file() and not path.is_symlink() and path.stat().st_size <= release.MAX_BYTES,
                    'Release review file is missing or unsafe.')
    return json.loads(path.read_bytes())


def evaluate(event, environ, read=read_json, run_git=git):
    """Return None for ordinary pushes; validate all active intent without secrets."""
    if environ.get('GITHUB_REPOSITORY') != REPOSITORY or environ.get('GITHUB_REF') != 'refs/heads/main':
        return None
    event_name = environ.get('GITHUB_EVENT_NAME')
    manual = event_name == 'workflow_dispatch' and event.get('inputs', {}).get('operation') == 'deploy'
    if event_name != 'push' and not manual:
        return None
    head = environ.get('GITHUB_SHA', '')
    release.require(release.COMMIT.fullmatch(head), 'Invalid workflow commit.')
    release.require(run_git('rev-parse', 'HEAD') == head, 'Checkout differs from the workflow commit.')
    before = event.get('before', '')
    if not manual:
        release.require(release.COMMIT.fullmatch(before) and before != '0' * 40,
                        'A release check requires an existing main branch.')
        changed = run_git('diff', '--name-only', before, head, '--', INTENT_PATH).splitlines()
        if not changed:
            return None
    intent = read(INTENT_PATH)
    release.require(isinstance(intent, dict) and intent.get('schema') == 1,
                    'Invalid release intent schema.')
    if intent.get('operation') == 'none':
        release.require(set(intent) == {'schema', 'operation'}, 'Inactive intent has unexpected fields.')
        release.require(not manual, 'No reviewed release intent is active.')
        return None
    release.require(set(intent) == ACTIVE_KEYS and intent.get('operation') == 'deploy',
                    'Invalid active release intent.')
    reviewed = intent['reviewed_application_commit']
    release.require(isinstance(reviewed, str) and release.COMMIT.fullmatch(reviewed),
                    'An exact reviewed application commit is required.')
    # A release is a data-only, one-commit child of reviewed main. Its workflow,
    # application, dependencies, tests and recovery sources cannot change here.
    release.require(run_git('rev-list', '--parents', '-n', '1', head).split() == [head, reviewed],
                    'Release must be a direct, non-merge child of the reviewed application commit.')
    if not manual:
        release.require(before == reviewed, 'A release push must contain exactly the reviewed release commit.')
    changed = set(run_git('diff', '--name-only', reviewed, head).splitlines())
    release.require(INTENT_PATH in changed and changed <= {INTENT_PATH, PLAN_PATH},
                    'Only release intent and its reviewed public recovery plan may change.')
    release.require(isinstance(intent['release_id'], str) and release.RELEASE.fullmatch(intent['release_id']),
                    'A unique reviewed release ID is required.')
    for key in ('plan_sha256', 'candidate_sha256', 'expected_index_sha256', 'expected_htaccess_sha256'):
        release.require(isinstance(intent[key], str) and release.SHA256.fullmatch(intent[key]),
                        'An exact release fingerprint is required.')
    plan = read(PLAN_PATH)
    release.require(isinstance(plan, dict) and plan.get('schema') == 2,
                    'Invalid public recovery plan schema.')
    release.require(release.plan_digest(plan) == intent['plan_sha256'], 'Reviewed plan digest differs.')
    release.require(plan.get('candidate_sha256') == intent['candidate_sha256'], 'Reviewed candidate digest differs.')
    source = plan.get('source_commit', '')
    release.require(isinstance(source, str) and release.COMMIT.fullmatch(source), 'Invalid recovery-source commit.')
    run_git('merge-base', '--is-ancestor', source, reviewed)
    entries = plan.get('files')
    release.require(isinstance(entries, list), 'Missing reviewed file inventory.')
    index = [entry for entry in entries if isinstance(entry, dict) and entry.get('path') == 'index.html']
    config = [entry for entry in entries if isinstance(entry, dict) and entry.get('path') == '.htaccess']
    release.require(len(index) == 1 and index[0].get('before') == intent['expected_index_sha256'],
                    'Live index approval differs from the recovery plan.')
    release.require(len(config) == 1 and config[0].get('before') is None and
                    config[0].get('after') == intent['expected_htaccess_sha256'],
                    'This reusable route preserves the already-installed reviewed configuration.')
    if manual:
        inputs = event['inputs']
        release.require(inputs.get('reviewed_commit') == head and
                        inputs.get('expected_index_sha256') == intent['expected_index_sha256'] and
                        inputs.get('htaccess', 'preserve') == 'preserve',
                        'Manual confirmation differs from the reviewed release intent.')
    return {**intent, 'source_commit': source}


def current_intent():
    return evaluate(read_json(os.environ['GITHUB_EVENT_PATH']), os.environ)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--require-active', action='store_true')
    args = parser.parse_args()
    try:
        intent = current_intent()
        release.require(not args.require_active or intent is not None, 'No new reviewed release is active.')
        output = {'enabled': 'true' if intent else 'false'}
        if intent:
            output.update({key: intent[key] for key in ('source_commit', 'release_id', 'candidate_sha256')})
        if os.environ.get('GITHUB_OUTPUT'):
            with open(os.environ['GITHUB_OUTPUT'], 'a') as stream:
                for key, value in output.items():
                    stream.write(key + '=' + value + '\n')
        print(json.dumps(output, sort_keys=True))
        return 0
    except release.ReleaseError as error:
        print('Stopped: ' + str(error), file=sys.stderr)
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError):
        print('Stopped: release intent or immutable Git history could not be verified.', file=sys.stderr)
    return 1


if __name__ == '__main__':
    sys.exit(main())
