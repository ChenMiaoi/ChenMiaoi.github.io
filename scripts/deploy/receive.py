#!/usr/bin/env python3
"""Restricted SSH receiver. Installed root-owned; runs as nyachen-deploy."""

import contextlib
import datetime
import fcntl
import hashlib
from html.parser import HTMLParser
import json
import os
from pathlib import Path, PurePosixPath
import re
import shlex
import shutil
import signal
import subprocess
import sys
import tarfile
import tempfile
import time

ROOT = Path('/var/www/nyachen-deploy')
RELEASE_ID = re.compile(r'[0-9a-f]{40}-[1-9][0-9]*-[1-9][0-9]*\Z')
MAX_ARCHIVE = 256 * 1024 * 1024
MAX_EXPANDED = 512 * 1024 * 1024
REQUIRED = ('index.html', 'content-index.json', 'sitemap-index.xml', 'pagefind/pagefind.js')
HOME_PREFIXES = ('/', '/en/', '/zh_TW/', '/ja/')


class HomepageMarkers(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.orbital = False
        self.redirect = None
        self.refreshes = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'body':
            self.orbital = 'orbital-site' in (attrs.get('class') or '').split()
            self.redirect = attrs.get('data-archive-redirect')
        elif tag == 'meta' and (attrs.get('http-equiv') or '').lower() == 'refresh':
            self.refreshes.append(attrs.get('content') or '')


def validate_homepages(load_page):
    homepage = HomepageMarkers(load_page('/'))
    # Older releases render the welcome page at / and remain valid rollback targets.
    if homepage.orbital:
        return False
    for prefix in HOME_PREFIXES:
        page = homepage if prefix == '/' else HomepageMarkers(load_page(prefix))
        target = prefix + 'hello-world/'
        refresh = re.fullmatch(r'\s*0\s*;\s*url\s*=\s*(/[^;\s]+)\s*',
                               page.refreshes[0], re.IGNORECASE) if len(page.refreshes) == 1 else None
        if page.redirect != target or not refresh or refresh[1] != target:
            raise ValueError(f'Production homepage {prefix} must be Orbital or redirect to {target}')
        if not HomepageMarkers(load_page(target)).orbital:
            raise ValueError(f'Welcome page {target} must be Orbital')
    return True


def activate_runtime(site):
    unit = Path('/etc/systemd/system/nyachen-contributions.service')
    dynamic = (site / 'runtime/server.mjs').is_file()
    if not unit.is_file():
        if dynamic:
            raise RuntimeError('Install the contribution service with setup-runtime.sh first')
        return
    subprocess.run(['sudo', '-n', '/usr/bin/systemctl', 'restart' if dynamic else 'stop',
                    'nyachen-contributions.service'], check=True, timeout=40)
    if dynamic:
        release = json.loads((site / 'deployment.json').read_text())['release']
        for _ in range(30):
            try:
                result = subprocess.check_output(['curl', '-fsS', '--max-time', '1',
                    'http://127.0.0.1:4336/api/contributions/health'], stderr=subprocess.DEVNULL)
                if json.loads(result)['release'] == release:
                    return
            except (subprocess.SubprocessError, ValueError, KeyError):
                pass
            time.sleep(0.5)
        raise RuntimeError('Contribution service did not become ready')


def check_origin(release):
    # Connect directly to Nginx while retaining SNI and certificate validation.
    def fetch(path):
        return subprocess.check_output([
            'curl', '--fail', '--silent', '--show-error', '--noproxy', '*',
            '--connect-timeout', '5', '--max-time', '20',
            '--resolve', 'nyachen.cn:443:127.0.0.1',
            f'https://nyachen.cn{path}',
        ])

    metadata = json.loads(fetch('/deployment.json'))
    if metadata['release'] != release:
        raise RuntimeError('Origin is serving a different release')
    if not validate_homepages(lambda path: fetch(path).decode('utf-8')):
        fetch('/en/')
    fetch('/pagefind/pagefind.js')
    if metadata.get('runtime'):
        health = json.loads(fetch('/api/contributions/health'))
        if health.get('release') != release or not health.get('ok'):
            raise RuntimeError('Origin contribution service is serving a different release')
        feed = json.loads(fetch('/contributions.json'))
        if feed.get('version') != 1 or not feed.get('activity'):
            raise RuntimeError('Origin contribution feed is unavailable')


class Deployer:
    def __init__(self, root=ROOT, healthcheck=check_origin, activate=activate_runtime):
        self.root = Path(root)
        self.healthcheck = healthcheck
        self.activate = activate

    @contextlib.contextmanager
    def locked(self):
        with (self.root / '.deploy.lock').open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            yield

    def target(self, name):
        link = self.root / name
        if not link.is_symlink():
            raise RuntimeError(f'{name} must be a symlink')
        target = link.resolve(strict=True)
        if target.parent != self.root / 'releases':
            raise RuntimeError(f'{name} points outside releases')
        return target

    def point(self, name, target):
        temporary = self.root / f'.{name}.next'
        temporary.unlink(missing_ok=True)
        temporary.symlink_to(target.relative_to(self.root), target_is_directory=True)
        os.replace(temporary, self.root / name)

    def unpack(self, stream, expected_hash, stage):
        archive_path = stage / 'upload.tar.gz'
        digest = hashlib.sha256()
        size = 0
        with archive_path.open('xb') as output:
            while chunk := stream.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_ARCHIVE:
                    raise ValueError('Archive exceeds 256 MiB')
                digest.update(chunk)
                output.write(chunk)
        if digest.hexdigest() != expected_hash:
            raise ValueError('Upload checksum mismatch')
        site = stage / 'site'
        site.mkdir(mode=0o755)
        expanded = 0
        seen = set()
        with tarfile.open(archive_path, 'r:gz') as archive:
            for member in archive:
                path = PurePosixPath(member.name)
                if str(path) == '.' and member.isdir():
                    continue
                if (path.is_absolute() or '..' in path.parts or '\\' in member.name
                        or any(part.startswith('.') for part in path.parts)
                        or path == PurePosixPath('deployment.json')
                        or not (member.isdir() or member.isfile())):
                    raise ValueError(f'Unsafe archive member: {member.name}')
                if path in seen or len(seen) >= 50000:
                    raise ValueError('Duplicate path or too many archive entries')
                seen.add(path)
                expanded += member.size
                if expanded > MAX_EXPANDED:
                    raise ValueError('Expanded site exceeds 512 MiB')
                dest = site.joinpath(*path.parts)
                if member.isdir():
                    dest.mkdir(parents=True, exist_ok=True, mode=0o755)
                else:
                    dest.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
                    with archive.extractfile(member) as source, dest.open('xb') as output:
                        shutil.copyfileobj(source, output)
                    dest.chmod(0o644)
        for filename in REQUIRED:
            required = site / filename
            if not required.is_file() or required.stat().st_size == 0:
                raise ValueError(f'Missing required build output: {filename}')
        def load_page(path):
            page = site / path.lstrip('/') / 'index.html'
            if not page.is_file():
                raise ValueError(f'Missing required homepage output: {path}')
            return page.read_text(encoding='utf-8')
        validate_homepages(load_page)
        if (site / 'runtime').exists() and not (site / 'runtime/server.mjs').is_file():
            raise ValueError('Missing contribution runtime entrypoint')
        return site

    def upload(self, release, digest, stream, validate=False):
        if not RELEASE_ID.fullmatch(release) or not re.fullmatch(r'[0-9a-f]{64}', digest):
            raise ValueError('Invalid release ID or checksum')
        with self.locked(), tempfile.TemporaryDirectory(dir=self.root / '.staging') as temp:
            previous = self.target('current')
            destination = self.root / 'releases' / release
            if destination.exists():
                raise ValueError('Release already exists; use a new run attempt')
            site = self.unpack(stream, digest, Path(temp))
            metadata = {
                'release': release, 'commit': release.split('-')[0],
                'deployedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                'runtime': (site / 'runtime/server.mjs').is_file(),
            }
            (site / 'deployment.json').write_text(json.dumps(metadata) + '\n')
            # ACME challenges survive every version switch without Nginx edits.
            (site / '.well-known').symlink_to(self.root / 'shared' / '.well-known', target_is_directory=True)
            if validate:
                return {'validated': release, 'current': previous.name}
            site.rename(destination)
            try:
                self.point('current', destination)
                self.activate(destination)
                self.healthcheck(release)
            except BaseException:
                self.point('current', previous)
                self.activate(previous)
                shutil.rmtree(destination)
                raise
            self.point('previous', previous)
            # A cleanup failure must not turn a successful switch into a failed deploy.
            try:
                self.prune()
            except OSError as error:
                print(f'Release cleanup warning: {error}', file=sys.stderr)
            return metadata

    def rollback(self):
        with self.locked():
            old = self.target('current')
            previous = self.target('previous')
            if not RELEASE_ID.fullmatch(previous.name):
                raise ValueError('No previously deployed site to roll back to')
            try:
                self.point('current', previous)
                self.activate(previous)
                self.healthcheck(previous.name)
            except BaseException:
                self.point('current', old)
                self.activate(old)
                raise
            self.point('previous', old)
            return {'rolledBackTo': previous.name}

    def prune(self):
        protected = {self.target('current'), self.target('previous')}
        releases = sorted(
            (p for p in (self.root / 'releases').iterdir()
             if RELEASE_ID.fullmatch(p.name) and p.is_dir() and not p.is_symlink()),
            key=lambda p: p.stat().st_mtime_ns, reverse=True,
        )
        for release in releases[5:]:
            if release not in protected:
                shutil.rmtree(release)

    def status(self):
        with self.locked():
            return {name: self.target(name).name for name in ('current', 'previous')
                    if (self.root / name).is_symlink()}


def main():
    os.umask(0o022)
    def interrupted(signum, _frame):
        raise RuntimeError(f'Deployment interrupted by signal {signum}')
    for signum in (signal.SIGTERM, signal.SIGHUP, signal.SIGINT):
        signal.signal(signum, interrupted)
    # No shell execution, arbitrary destination, or environment overrides from SSH.
    args = shlex.split(os.environ.get('SSH_ORIGINAL_COMMAND', ''))
    deployer = Deployer()
    if len(args) == 3 and args[0] in ('deploy', 'validate'):
        result = deployer.upload(args[1], args[2], sys.stdin.buffer, args[0] == 'validate')
    elif args == ['rollback']:
        result = deployer.rollback()
    elif args == ['status']:
        result = deployer.status()
    else:
        raise ValueError('Allowed commands: deploy/validate RELEASE SHA256, rollback, status')
    print(json.dumps(result))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'Deployment failed: {error}', file=sys.stderr)
        sys.exit(1)
