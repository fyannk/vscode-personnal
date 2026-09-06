#!/usr/bin/env python3
"""Prepare a managed upstream checkout without altering an existing VS Code tree."""
import argparse
import json
import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def git(*args, cwd=ROOT):
    return subprocess.check_output(['git', *args], cwd=cwd, text=True).strip()


def prepare(tag, expected_commit=None):
    if not re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+', tag):
        raise ValueError('Expected a stable VS Code tag such as 1.136.1')
    if expected_commit and not re.fullmatch(r'[0-9a-f]{40}', expected_commit):
        raise ValueError('Expected a full upstream commit SHA')
    checkout = ROOT / '.work' / tag / 'vscode'
    if not checkout.exists():
        checkout.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(['git', 'clone', '--depth=1', '--branch', tag,
                        'https://github.com/microsoft/vscode.git', str(checkout)], check=True)
    commit = git('rev-parse', 'HEAD', cwd=checkout)
    if git('rev-parse', f'{tag}^{{commit}}', cwd=checkout) != commit:
        raise ValueError('Managed checkout is not at the requested tag')
    if expected_commit and commit != expected_commit:
        raise ValueError(f'Upstream commit mismatch: expected {expected_commit}, got {commit}')
    if not (checkout / 'extensions/copilot/package.json').is_file():
        raise ValueError('This upstream release does not contain bundled Copilot')
    # Fail visibly if upstream changes the local build contract; do not ship without Copilot.
    build = (checkout / 'build/gulpfile.vscode.ts').read_text()
    if 'compileCopilotExtensionBuildTask,' not in build:
        raise ValueError('Reinspect upstream: local Linux task may no longer compile Copilot')
    overlay = checkout / '.personal-build'
    shutil.copytree(ROOT / 'overlay', overlay, dirs_exist_ok=True,
                    ignore=shutil.ignore_patterns('node_modules', 'logs', 'dist', '__pycache__'))
    (overlay / 'upstream.json').write_text(json.dumps({'tag': tag, 'commit': commit}, indent=2) + '\n')
    config = json.loads((ROOT / 'config.json').read_text())
    try:
        customization_commit = git('rev-parse', 'HEAD')
    except subprocess.CalledProcessError:
        customization_commit = 'uncommitted'
    info = {'upstreamTag': tag, 'upstreamCommit': commit,
            'customizationCommit': customization_commit, **config}
    (overlay / 'build-info.json').write_text(json.dumps(info, indent=2) + '\n')
    return checkout


if __name__ == '__main__':
    defaults = json.loads((ROOT / 'upstream.json').read_text())
    parser = argparse.ArgumentParser()
    parser.add_argument('--tag', default=defaults['tag'])
    parser.add_argument('--commit')
    args = parser.parse_args()
    commit = args.commit or (defaults['commit'] if args.tag == defaults['tag'] else None)
    print(prepare(args.tag, commit))
