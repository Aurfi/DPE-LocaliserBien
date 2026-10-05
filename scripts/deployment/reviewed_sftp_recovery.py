#!/usr/bin/env python3
"""Execute only explicit reviewed recovery; never trigger rollback automatically."""
import argparse
import os
from pathlib import Path
import sys

import ovh_release as release
import ovh_sftp_release as adapter
import recovery_intent
from release_intent import git

PLAN_PATH = '.recovery-plan/scripts/deployment/public-release-plan.json'


def recover(intent, baseline_root, connect=adapter.connect_sftp):
    args = argparse.Namespace(reviewed_commit=os.environ.get('GITHUB_SHA', ''),
        plan_commit=intent['release_plan_commit'], release_id=intent['release_id'],
        expected_index=intent['expected_index_sha256'], expected_htaccess=intent['expected_htaccess_sha256'],
        htaccess='preserve', plan=PLAN_PATH, baseline_root=str(baseline_root))
    release.check_mutation_approval(args)
    plan, _, _ = release.load_plan(args)
    release.require(release.plan_digest(plan) == intent['plan_sha256'], 'Original recovery plan differs from review.')
    connection = None
    try:
        connection = connect()
        release.rollback(release.Remote(connection), args)
    finally:
        if connection is not None:
            connection.close()


def main():
    try:
        intent = recovery_intent.current_intent()
        release.require(intent is not None, 'No new reviewed recovery is active.')
        release.require(git('-C', '.recovery-plan', 'rev-parse', 'HEAD') == intent['release_plan_commit'],
                        'Original release checkout differs from review.')
        release.require(git('-C', '.release-baseline', 'rev-parse', 'HEAD') == intent['source_commit'],
                        'Recovery-source checkout differs from its pinned commit.')
        release.require(git('-C', '.latest-main', 'rev-parse', 'HEAD') == os.environ.get('GITHUB_SHA'),
                        'Main advanced; review recovery again instead of using a stale run.')
        recover(intent, Path('.release-baseline'))
        return 0
    except release.ReleaseError as error:
        print('Stopped: ' + str(error), file=sys.stderr)
    except (OSError, ValueError, KeyError, TypeError, recovery_intent.common.subprocess.SubprocessError,
            release.ftplib.Error, adapter.paramiko.SSHException, adapter.paramiko.SFTPError, EOFError):
        print('Stopped: reviewed SFTP recovery failed; inspect current state before further action.', file=sys.stderr)
    return 1


if __name__ == '__main__':
    sys.exit(main())
