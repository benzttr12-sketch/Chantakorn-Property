#!/usr/bin/env python3
"""Scan LINE credential copies without printing matched values or source lines."""
import argparse
import base64
import getpass
import os
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import quote

INCIDENT_COMMIT = '86c359b6274e55abd9109e044b9a27c1de979b6a'
LITERAL = re.compile(
    rb'(?:DEFAULT_LINE_CHANNEL_SECRET|LINE_CHANNEL_SECRET|LINE_CHANNEL_ACCESS_TOKEN|'
    rb'channelSecret|channelAccessToken|channel_secret|channel_access_token)'
    rb'[\s\"\']*[:=]\s*[\"\']([0-9a-fA-F]{32}|[A-Za-z0-9+/=_-]{60,})[\"\']'
)
ENV_LITERAL = re.compile(rb'^LINE_CHANNEL_(?:SECRET|ACCESS_TOKEN)=(\S+)', re.MULTILINE)
PRESET_LITERAL = re.compile(rb'setLine(?:Secret|Token)\(\s*[\"\'](?:[0-9a-fA-F]{32}|[A-Za-z0-9+/=_-]{60,})[\"\']')


def git(*args, check=True):
    result = subprocess.run(['git', *args], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if check and result.returncode:
        raise RuntimeError('Git operation failed; run this from the repository.')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--history', action='store_true', help='Scan all locally reachable blobs, commits, and tags')
    parser.add_argument('--index', action='store_true', help='Scan staged content instead of working files')
    parser.add_argument('--prompt', action='store_true', help='Read replacement secret/token with hidden terminal prompts')
    parser.add_argument('--secret-file', type=Path, help='Read newline-separated credentials from a protected file outside Git')
    parser.add_argument('--build-dir', action='append', type=Path, default=[], help='Also scan this local output directory')
    args = parser.parse_args()
    if args.prompt and not sys.stdin.isatty():
        raise RuntimeError('Hidden credential prompts require an interactive terminal.')
    needles = []
    incident = git('show', INCIDENT_COMMIT + ':src/lib/line-auth.ts', check=False)
    match = re.search(rb'DEFAULT_LINE_CHANNEL_SECRET\s*=\s*([\"\'])(.*?)\1', incident.stdout)
    if match and match[2]:
        needles.append(match[2])
    for key in ['LINE_CHANNEL_SECRET', 'LINE_CHANNEL_ACCESS_TOKEN']:
        if os.environ.get(key):
            needles.append(os.environ[key].encode())
    if args.secret_file:
        needles.extend(value for value in args.secret_file.read_bytes().splitlines() if value)
    if args.prompt:
        for label in ['Replacement channel secret', 'Replacement channel access token']:
            value = getpass.getpass(label + ' (input hidden; blank to skip): ')
            if value:
                needles.append(value.encode())
    representations = set()
    for value in needles:
        representations.update([value, base64.b64encode(value), value.hex().encode(),
                                quote(value.decode(), safe='').encode()])
    matches = 0
    scanned = 0

    def inspect(label, content):
        nonlocal matches, scanned
        scanned += 1
        exact = any(value in content for value in representations)
        literal = bool(LITERAL.search(content) or PRESET_LITERAL.search(content))
        env_literal = label.endswith(('.env', '.env.example', '.env.local')) and bool(ENV_LITERAL.search(content))
        if exact or literal or env_literal:
            matches += 1
            print('Credential match:', label)  # Never emit content or a credential fingerprint.

    paths = git('ls-files', '-z').stdout.split(b'\0')
    for raw in paths:
        if not raw:
            continue
        path = os.fsdecode(raw)
        if args.index:
            inspect(path, git('show', ':' + path).stdout)
        elif Path(path).is_file():
            inspect(path, Path(path).read_bytes())
    if args.history:
        objects = git('rev-list', '--objects', '--all').stdout.splitlines()
        for entry in objects:
            oid, _, path = entry.partition(b' ')
            kind = git('cat-file', '-t', oid.decode()).stdout.strip()
            if kind in [b'blob', b'commit', b'tag']:
                inspect('history:' + (os.fsdecode(path) if path else oid.decode()),
                        git('cat-file', kind.decode(), oid.decode()).stdout)
    for directory in args.build_dir:
        if not directory.is_dir():
            raise RuntimeError('Requested build directory does not exist.')
        for path in sorted(directory.rglob('*')):
            if path.is_file() and not path.is_symlink():
                inspect(str(path), path.read_bytes())
    print(f'Scanned {scanned} files/objects; {matches} credential matches.')
    if not needles:
        print('No exact credential supplied; only credential-literal patterns were checked.')
    return 1 if matches else 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (RuntimeError, OSError):
        print('Scan failed; no credential values were printed.', file=sys.stderr)
        sys.exit(2)
