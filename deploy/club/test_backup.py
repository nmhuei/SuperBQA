"""Run with: python3 -m unittest discover -s deploy/club -p 'test_*.py'."""

import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import subprocess
import tarfile
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("club_backup", ROOT / "scripts/club-backup.py")
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class BackupSafetyTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)

    def tar_bytes(self, entries):
        buffer = io.BytesIO()
        with tarfile.open(fileobj=buffer, mode="w:gz") as archive:
            for name, content, kind in entries:
                entry = tarfile.TarInfo(name)
                entry.type = kind
                entry.size = len(content) if kind == tarfile.REGTYPE else 0
                entry.linkname = "/tmp/escape" if kind == tarfile.SYMTYPE else ""
                archive.addfile(entry, io.BytesIO(content))
        return buffer.getvalue()

    def make_archive(self, uploads=None):
        payloads = {
            "database.dump": b"PostgreSQL custom dump placeholder",
            "uploads.tar.gz": uploads or self.tar_bytes([
                ("challenge.txt", b"challenge contents", tarfile.REGTYPE),
            ]),
            "config.tar.gz": self.tar_bytes([
                (".env", b"RCTF_TOKEN_KEY='preserved-secret'\n", tarfile.REGTYPE),
                ("config/00-club.yaml", b"ctfName: Club\n", tarfile.REGTYPE),
            ]),
            "metadata.json": json.dumps({
                "format_version": 1, "postgres_major": 18,
            }).encode(),
        }
        checksum = "".join(
            f"{hashlib.sha256(value).hexdigest()}  {key}\n"
            for key, value in payloads.items()
        )
        payloads["SHA256SUMS"] = checksum.encode()
        path = self.root / "backup.tar.gz"
        path.write_bytes(self.tar_bytes([
            (key, value, tarfile.REGTYPE) for key, value in payloads.items()
        ]))
        Path(str(path) + ".sha256").write_text(backup.digest(path) + "  backup.tar.gz\n")
        return path

    def test_valid_archive_checks_all_payloads_and_keeps_secrets_private(self):
        archive = self.make_archive()
        destination = self.root / "verified"
        backup.unpack(archive, destination)
        self.assertEqual((destination / "configuration/.env").read_text(),
                         "RCTF_TOKEN_KEY='preserved-secret'\n")
        self.assertEqual(stat.S_IMODE((destination / "configuration/.env").stat().st_mode), 0o600)

    def test_corrupted_outer_archive_is_rejected_before_extraction(self):
        archive = self.make_archive()
        archive.write_bytes(archive.read_bytes() + b"tampered")
        with self.assertRaisesRegex(ValueError, "checksum"):
            backup.unpack(archive, self.root / "verified")
        self.assertFalse((self.root / "verified").exists())

    def test_nested_path_traversal_is_rejected(self):
        archive = self.make_archive(self.tar_bytes([
            ("../../escape.txt", b"unsafe", tarfile.REGTYPE),
        ]))
        with self.assertRaisesRegex(ValueError, "Unsafe archive path"):
            backup.unpack(archive, self.root / "verified")
        self.assertFalse((self.root / "escape.txt").exists())

    def test_nested_symlink_is_rejected(self):
        archive = self.make_archive(self.tar_bytes([
            ("unsafe-link", b"", tarfile.SYMTYPE),
        ]))
        with self.assertRaisesRegex(ValueError, "link"):
            backup.unpack(archive, self.root / "verified")

    def test_existing_initialization_is_not_overwritten(self):
        state = self.root / "state"
        backup.initialize(state, "https://ctf.example.com", "test-club", "8081")
        before = (state / ".env").read_bytes()
        with self.assertRaisesRegex(ValueError, "refusing to overwrite"):
            backup.initialize(state, "https://ctf.example.com", "test-club", "8081")
        self.assertEqual((state / ".env").read_bytes(), before)
        self.assertEqual(stat.S_IMODE((state / ".env").stat().st_mode), 0o600)

    def test_restore_keeps_drill_identity_and_recovers_original_token_key(self):
        stage = self.root / "verified"
        backup.unpack(self.make_archive(), stage)
        state = self.root / "state"
        backup.initialize(state, "http://127.0.0.1:8081", "rctf-club-drill", "8081")
        current = self.root / "current.json"
        current.write_text(json.dumps({
            "name": "rctf-club-drill",
            "services": {"rctf": {
                "ports": [{"target": 80, "published": "8081", "host_ip": "127.0.0.1"}],
                "environment": {"RCTF_ORIGIN": "http://127.0.0.1:8081"},
            }},
        }))
        backup.restore_config(stage, state, current)
        env = (state / ".env").read_text()
        self.assertIn("RCTF_TOKEN_KEY='preserved-secret'", env)
        self.assertIn("COMPOSE_PROJECT_NAME='rctf-club-drill'", env)
        self.assertIn("RCTF_HTTP_PORT='8081'", env)
        self.assertEqual(stat.S_IMODE((state / ".env").stat().st_mode), 0o600)

    def test_public_http_origin_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "HTTPS"):
            backup.validate_origin("http://ctf.example.com")

    def test_alternate_state_requires_an_explicit_distinct_project(self):
        state = self.root / "drill"
        with self.assertRaisesRegex(ValueError, "explicit PROJECT and PORT"):
            backup.initialize(state, "http://127.0.0.1:8081")
        with self.assertRaisesRegex(ValueError, "distinct project"):
            backup.initialize(state, "http://127.0.0.1:8081", "rctf-club", "8081")
        self.assertFalse(state.exists())

    def run_guarded_backup(self, wrong_mount=False):
        state = self.root / "state"
        backup.initialize(state, "https://ctf.example.com", "test-club", "8081")
        binary_dir = self.root / "bin"
        binary_dir.mkdir()
        fake_docker = binary_dir / "docker"
        fake_docker.write_text('''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
args = sys.argv[1:]
with open(os.environ["DOCKER_TEST_LOG"], "a") as log:
    log.write(json.dumps(args) + "\\n")
if args[0] == "compose":
    if "config" in args and "--format" in args:
        print(json.dumps({"name": "test-club", "services": {"rctf": {"image": "local/rctf-club:release"}}}))
    elif "ps" in args:
        print("app-container")
elif args[0] == "inspect":
    template = args[2]
    if ".Destination" in template:
        print(os.environ["DOCKER_TEST_MOUNT"])
    elif ".State.Running" in template:
        print("true")
    elif ".Config.Image" in template:
        print("local/rctf-club:release")
    elif ".Image" in template:
        print("sha256:" + "a" * 64)
elif args[:2] == ["image", "inspect"]:
    print("sha256:" + "b" * 64)
''')
        fake_docker.chmod(0o755)
        log = self.root / "docker.log"
        result = subprocess.run(
            [str(ROOT / "scripts/club-ops.sh"), "backup"],
            env={
                **os.environ,
                "PATH": str(binary_dir) + ":" + os.environ["PATH"],
                "CLUB_STATE_DIR": str(state),
                "XDG_RUNTIME_DIR": str(self.root / "runtime"),
                "DOCKER_TEST_LOG": str(log),
                "DOCKER_TEST_MOUNT": str(self.root / "other/config" if wrong_mount else state / "config"),
            },
            capture_output=True, text=True,
        )
        commands = [json.loads(line) for line in log.read_text().splitlines()]
        self.assertEqual(result.returncode, 1)
        self.assertFalse(any("stop" in command for command in commands))
        return result.stderr

    def test_moved_image_tag_is_rejected_before_application_stop(self):
        self.assertIn("Release tag moved", self.run_guarded_backup())

    def test_other_state_project_is_rejected_before_application_stop(self):
        self.assertIn("different state directory", self.run_guarded_backup(wrong_mount=True))


if __name__ == "__main__":
    unittest.main()
