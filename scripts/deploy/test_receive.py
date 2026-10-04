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


def archive(extra=(), omit=()):
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode='w:gz') as tar:
        for name in (*receive.REQUIRED, 'en/index.html'):
            if name in omit:
                continue
            data = b'<html><body class="orbital-site">site</body></html>'
            member = tarfile.TarInfo('./' + name)
            member.size = len(data)
            tar.addfile(member, io.BytesIO(data))
        for member in extra:
            tar.addfile(member, io.BytesIO(b'x' * member.size))
    return output.getvalue()


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
