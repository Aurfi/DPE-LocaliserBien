#!/usr/bin/env python3
"""Bind an explicitly reviewed public build to known public recovery bytes. No network."""
import argparse
import json
import tempfile
from pathlib import Path
import ovh_release as release


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dist', required=True)
    parser.add_argument('--baseline-map', default=str(Path(__file__).with_name('public-baseline.json')))
    parser.add_argument('--baseline-root', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    files = release.inventory(args.dist)
    baseline = json.loads(Path(args.baseline_map).read_bytes())
    plan = release.make_plan(files, baseline)
    output = Path(args.output)
    # Validate in a sibling temporary file before replacing the selected output.
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8',
                                     dir=output.parent, prefix=output.name + '.',
                                     suffix='.validating', delete=False) as stream:
        stream.write(json.dumps(plan, indent=2) + '\n')
        temporary = Path(stream.name)
    try:
        args.plan = str(temporary)
        release.load_plan(args, files)
        temporary.replace(output)
    finally:
        if temporary.exists():
            temporary.unlink()
    print('Public plan generated; review this exact candidate and its live before-state before deployment.')
    print('Candidate SHA-256: ' + plan['candidate_sha256'])


if __name__ == '__main__':
    main()
