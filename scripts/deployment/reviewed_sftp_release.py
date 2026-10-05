#!/usr/bin/env python3
"""Publish only a reviewed, same-run-tested release through the existing SFTP pin."""
import argparse
import os
from pathlib import Path
import subprocess
import sys

import ovh_release as release
import ovh_sftp_release as adapter
import release_intent


def publish(intent, files, baseline_root, connect=adapter.connect_sftp):
    args = argparse.Namespace(reviewed_commit=os.environ.get('GITHUB_SHA', ''),
        expected_index=intent['expected_index_sha256'],
        expected_htaccess=intent['expected_htaccess_sha256'], htaccess='preserve',
        release_id=intent['release_id'], plan=release_intent.PLAN_PATH,
        baseline_root=str(baseline_root))
    release.check_mutation_approval(args)
    plan, _, _ = release.load_plan(args, files)
    release.require(release.plan_digest(plan) == intent['plan_sha256'] and
                    release.build_digest(files) == intent['candidate_sha256'],
                    'Same-run artifact differs from the explicitly reviewed release.')
    connection = None
    try:
        connection = connect()
        release.deploy(release.Remote(connection), args, files)
    finally:
        if connection is not None:
            connection.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline-root', default='.release-baseline')
    parser.add_argument('--latest-main', default='.latest-main')
    parser.add_argument('--dist', default='dist')
    args = parser.parse_args()
    try:
        intent = release_intent.current_intent()
        release.require(intent is not None, 'No new reviewed release is active.')
        # Both checkouts use the existing read-only Actions token. No API token,
        # repository write permission, credential saving, or new grant is needed.
        baseline = release_intent.git('-C', args.baseline_root, 'rev-parse', 'HEAD')
        latest = release_intent.git('-C', args.latest_main, 'rev-parse', 'HEAD')
        release.require(baseline == intent['source_commit'], 'Recovery checkout differs from its pinned commit.')
        release.require(latest == os.environ.get('GITHUB_SHA'), 'Main advanced; review a new release instead of deploying a stale run.')
        publish(intent, release.inventory(args.dist), Path(args.baseline_root))
        return 0
    except release.ReleaseError as error:
        print('Stopped: ' + str(error), file=sys.stderr)
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError, release.ftplib.Error,
            adapter.paramiko.SSHException, adapter.paramiko.SFTPError, EOFError):
        print('Stopped: release validation or pinned transfer failed; inspect the reviewed recovery state before retrying.', file=sys.stderr)
    return 1


if __name__ == '__main__':
    sys.exit(main())
