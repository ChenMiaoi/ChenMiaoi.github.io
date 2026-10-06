import hashlib
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

import receive


def release(number):
    return f'{number:040x}-{number}-1'


def archive(extra=(), omit=(), files=None):
    output = io.BytesIO()
    contents = dict.fromkeys((*receive.REQUIRED, 'en/index.html'),
                            b'<html><body class="orbital-site">site</body></html>')
    contents.update(files or {})
    with tarfile.open(fileobj=output, mode='w:gz') as tar:
        for name, data in contents.items():
            if name in omit:
                continue
            member = tarfile.TarInfo('./' + name)
            member.size = len(data)
            tar.addfile(member, io.BytesIO(data))
        for member in extra:
            tar.addfile(member, io.BytesIO(b'x' * member.size))
    return output.getvalue()


def welcome_files():
    files = {}
    for prefix in receive.HOME_PREFIXES:
        target = prefix + 'hello-world/'
        files[prefix.lstrip('/') + 'index.html'] = (
            f'<html><head><meta http-equiv="refresh" content="0;url={target}"></head>'
            f'<body data-archive-redirect="{target}"><a href="{target}">Welcome</a></body></html>'
        ).encode()
        files[target.lstrip('/') + 'index.html'] = b'<html><body class="orbital-site orbital-ready">Welcome</body></html>'
    return files


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for directory in ('releases/empty', '.staging', 'shared/.well-known/acme-challenge'):
            (self.root / directory).mkdir(parents=True, exist_ok=True)
        (self.root / 'current').symlink_to('releases/empty', target_is_directory=True)
        self.checks = []
        self.activations = []
        self.deployer = receive.Deployer(self.root, self.checks.append, self.activations.append)

    def upload(self, number=1, data=None, **kwargs):
        data = archive() if data is None else data
        return self.deployer.upload(release(number), hashlib.sha256(data).hexdigest(), io.BytesIO(data), **kwargs)

    def test_complete_deploy_and_rollback_preserve_shared_challenge(self):
        challenge = self.root / 'shared/.well-known/acme-challenge/test'
        challenge.write_text('preserve')
        self.upload(1)
        self.upload(2)
        current = self.root / 'current'
        self.assertEqual(json.loads((current / 'deployment.json').read_text())['release'], release(2))
        self.assertEqual((current / '.well-known/acme-challenge/test').read_text(), 'preserve')
        self.assertEqual(self.deployer.target('previous').name, release(1))
        self.deployer.rollback()
        self.assertEqual(self.deployer.target('current').name, release(1))
        self.assertEqual(self.deployer.target('previous').name, release(2))

    def test_validation_does_not_publish_or_leave_files(self):
        self.upload(validate=True)
        self.assertEqual(self.deployer.status(), {'current': 'empty'})
        self.assertEqual(list((self.root / '.staging').iterdir()), [])
        self.assertEqual(len(list((self.root / 'releases').iterdir())), 1)
        self.assertEqual(self.checks, [])

    def test_rejects_non_orbital_homepage(self):
        member = tarfile.TarInfo('index.html')
        member.size = 10
        with self.assertRaisesRegex(ValueError, 'must be Orbital'):
            self.upload(data=archive([member], omit=('index.html',)))

    def test_welcome_routes_deploy_and_rollback_to_original_homepage(self):
        self.upload(1)
        self.upload(2, data=archive(files=welcome_files()))
        self.assertEqual(self.deployer.target('current').name, release(2))
        self.deployer.rollback()
        self.assertEqual(self.deployer.target('current').name, release(1))

    def test_rejects_missing_or_non_orbital_welcome_page_in_each_locale(self):
        for prefix in receive.HOME_PREFIXES:
            landing = prefix.lstrip('/') + 'hello-world/index.html'
            with self.subTest(prefix=prefix, missing=True), self.assertRaisesRegex(ValueError, 'Missing required homepage'):
                self.upload(data=archive(files=welcome_files(), omit=(landing,)))
            files = welcome_files()
            files[landing] = b'<html><body>Wrong application</body></html>'
            with self.subTest(prefix=prefix, missing=False), self.assertRaisesRegex(ValueError, 'must be Orbital'):
                self.upload(data=archive(files=files))
        self.assertEqual(self.deployer.status(), {'current': 'empty'})

    def test_rejects_wrong_redirect_or_refresh_in_each_locale(self):
        for prefix in receive.HOME_PREFIXES:
            name = prefix.lstrip('/') + 'index.html'
            target = prefix + 'hello-world/'
            for replacement in ('https://example.com/', '/articles/', '/../hello-world/', '/en/hello-world/' if prefix != '/en/' else '/hello-world/'):
                files = welcome_files()
                files[name] = files[name].replace(target.encode(), replacement.encode())
                with self.subTest(prefix=prefix, replacement=replacement), self.assertRaisesRegex(ValueError, 'must be Orbital or redirect'):
                    self.upload(data=archive(files=files))
            files = welcome_files()
            files[name] = files[name].replace(f'0;url={target}'.encode(), b'0;url=/articles/')
            with self.subTest(prefix=prefix, mismatch=True), self.assertRaisesRegex(ValueError, 'must be Orbital or redirect'):
                self.upload(data=archive(files=files))
        self.assertEqual(self.deployer.status(), {'current': 'empty'})

    def test_ignores_orbital_markers_in_scripts_and_comments(self):
        html = b'<html><script>const html = \'<body class="orbital-site">\';</script><!-- <body class="orbital-site"> --><body>Wrong application</body></html>'
        with self.assertRaisesRegex(ValueError, 'must be Orbital'):
            self.upload(data=archive(files={'index.html': html}))

    def test_origin_checks_welcome_destinations_and_supports_old_homepage(self):
        for files, expected in ((welcome_files(), [*receive.HOME_PREFIXES, *(prefix + 'hello-world/' for prefix in receive.HOME_PREFIXES)]),
                                ({'index.html': b'<body class="orbital-site">', 'en/index.html': b'<body class="orbital-site">'}, ['/', '/en/'])):
            paths = []
            def fetch(args):
                path = args[-1].removeprefix('https://nyachen.cn')
                paths.append(path)
                if path == '/deployment.json':
                    return json.dumps({'release': release(1)}).encode()
                if path == '/pagefind/pagefind.js':
                    return b'pagefind'
                return files[path.lstrip('/') + 'index.html']
            with self.subTest(redirected=len(files) > 2), patch.object(receive.subprocess, 'check_output', side_effect=fetch):
                receive.check_origin(release(1))
            self.assertCountEqual(paths, ['/deployment.json', '/pagefind/pagefind.js', *expected])

    def test_failed_healthcheck_restores_previous_site(self):
        self.upload(1)
        def fail(_release):
            self.assertEqual(self.deployer.target('current').name, release(2))
            raise RuntimeError('origin failure')
        self.deployer.healthcheck = fail
        with self.assertRaisesRegex(RuntimeError, 'origin failure'):
            self.upload(2)
        self.assertEqual(self.deployer.target('current').name, release(1))
        self.assertFalse((self.root / 'releases' / release(2)).exists())
        self.assertEqual(list((self.root / '.staging').iterdir()), [])

    def test_failed_rollback_keeps_current_site(self):
        self.upload(1)
        self.upload(2)
        self.deployer.healthcheck = lambda _: (_ for _ in ()).throw(RuntimeError('failed rollback'))
        with self.assertRaises(RuntimeError):
            self.deployer.rollback()
        self.assertEqual(self.deployer.target('current').name, release(2))

    def test_runtime_failure_restarts_previous_release_and_preserves_data(self):
        self.upload(1)
        data = self.root / 'shared/contributions.json'
        data.write_text('independent persistent data')
        attempts = []
        def activate(site):
            attempts.append(site.name)
            if site.name == release(2):
                raise RuntimeError('runtime failed')
        self.deployer.activate = activate
        with self.assertRaisesRegex(RuntimeError, 'runtime failed'):
            self.upload(2)
        self.assertEqual(attempts, [release(2), release(1)])
        self.assertEqual(data.read_text(), 'independent persistent data')
        self.assertEqual(self.deployer.target('current').name, release(1))

    def test_validation_never_restarts_service(self):
        self.upload(validate=True)
        self.assertEqual(self.activations, [])

    def test_rejects_invalid_archive_paths(self):
        for name in ('../escape', '/etc/escape', 'a/../../escape', '.env', '.well-known/token', 'deployment.json', 'a\\b'):
            with self.subTest(name=name), self.assertRaisesRegex(ValueError, 'Unsafe'):
                self.upload(data=archive([tarfile.TarInfo(name)]))
            self.assertEqual(self.deployer.target('current').name, 'empty')

    def test_rejects_links_and_devices(self):
        for kind in (tarfile.SYMTYPE, tarfile.LNKTYPE, tarfile.CHRTYPE, tarfile.FIFOTYPE):
            member = tarfile.TarInfo('linked')
            member.type = kind
            member.linkname = '/etc/passwd'
            with self.subTest(kind=kind), self.assertRaisesRegex(ValueError, 'Unsafe'):
                self.upload(data=archive([member]))

    def test_rejects_corrupt_or_incomplete_upload(self):
        with self.assertRaisesRegex(ValueError, 'checksum'):
            self.deployer.upload(release(1), '0' * 64, io.BytesIO(archive()[:20]))
        with self.assertRaises(tarfile.TarError):
            self.upload(data=b'not a tar archive')
        self.assertEqual(self.deployer.target('current').name, 'empty')

    def test_rejects_missing_build_and_duplicate_files(self):
        with self.assertRaisesRegex(ValueError, 'Missing required'):
            self.upload(data=archive(omit=('index.html',)))
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            self.upload(data=archive([tarfile.TarInfo('index.html')]))

    def test_rejects_oversized_upload_and_expansion(self):
        with patch.object(receive, 'MAX_ARCHIVE', 1), self.assertRaisesRegex(ValueError, 'Archive exceeds'):
            self.upload()
        with patch.object(receive, 'MAX_EXPANDED', 1), self.assertRaisesRegex(ValueError, 'Expanded site'):
            self.upload()

    def test_duplicate_release_never_overwrites_current(self):
        self.upload()
        with self.assertRaisesRegex(ValueError, 'already exists'):
            self.upload()
        self.assertEqual(self.deployer.target('current').name, release(1))

    def test_rejects_path_in_release_id_and_symlink_outside_releases(self):
        with self.assertRaisesRegex(ValueError, 'Invalid release'):
            self.deployer.upload('../escape', '0' * 64, io.BytesIO())
        (self.root / 'current').unlink()
        (self.root / 'current').symlink_to(self.root.parent, target_is_directory=True)
        with self.assertRaisesRegex(RuntimeError, 'outside releases'):
            self.upload()

    def test_lock_rejects_concurrent_publisher(self):
        with self.deployer.locked(), self.assertRaises(BlockingIOError):
            self.upload()

    def test_retention_keeps_five_releases_and_rollback_target(self):
        for number in range(1, 8):
            self.upload(number)
        remaining = {p.name for p in (self.root / 'releases').iterdir()}
        self.assertEqual(remaining, {'empty', *(release(n) for n in range(3, 8))})
        self.deployer.rollback()
        self.assertEqual(self.deployer.target('current').name, release(6))


if __name__ == '__main__':
    unittest.main()
