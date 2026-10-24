"""Safety tests for the distributable-source security scan boundary."""

import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest

spec = importlib.util.spec_from_file_location(
    "club_security", Path(__file__).with_name("club-security.py")
)
security = importlib.util.module_from_spec(spec)
spec.loader.exec_module(security)


class SnapshotSafetyTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.repo = self.root / "repo"
        self.repo.mkdir()
        self.destination = self.root / "snapshot"
        subprocess.run(["git", "init", "--quiet", self.repo], check=True)
        (self.repo / ".gitignore").write_text(".env\nstate/\n")

    def test_includes_new_and_tracked_files_without_ignored_runtime_state(self):
        (self.repo / "app.txt").write_text("reviewed source")
        subprocess.run(["git", "-C", self.repo, "add", "app.txt"], check=True)
        (self.repo / "new file.txt").write_text("new source")
        (self.repo / ".env").write_text("private runtime state")
        (self.repo / "state").mkdir()
        (self.repo / "state/backup.tar").write_text("private backup")
        security.snapshot(self.repo, self.destination)
        self.assertEqual((self.destination / "app.txt").read_text(), "reviewed source")
        self.assertTrue((self.destination / "new file.txt").is_file())
        self.assertFalse((self.destination / ".env").exists())
        self.assertFalse((self.destination / "state").exists())
        self.assertFalse((self.destination / ".git").exists())

    def test_forced_tracked_secret_is_scanned_even_when_ignored(self):
        (self.repo / ".env").write_text("accidentally committed credential")
        subprocess.run(["git", "-C", self.repo, "add", "-f", ".env"], check=True)
        security.snapshot(self.repo, self.destination)
        self.assertTrue((self.destination / ".env").is_file())

    def test_rejects_symlink_to_private_file_without_copying_its_content(self):
        private = self.root / "private"
        private.write_text("outside credential")
        (self.repo / "link").symlink_to(private)
        with self.assertRaisesRegex(ValueError, "link"):
            security.snapshot(self.repo, self.destination)
        self.assertFalse((self.destination / "link").exists())

    def test_rejects_tracked_directory_replaced_by_symlink(self):
        (self.repo / "src").mkdir()
        (self.repo / "src/file").write_text("source")
        subprocess.run(["git", "-C", self.repo, "add", "src/file"], check=True)
        (self.repo / "src/file").unlink()
        (self.repo / "src").rmdir()
        private = self.root / "private"
        private.mkdir()
        (private / "file").write_text("outside credential")
        (self.repo / "src").symlink_to(private, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "link"):
            security.snapshot(self.repo, self.destination)
        self.assertFalse((self.destination / "src/file").exists())

    def test_rejects_destination_inside_repository(self):
        with self.assertRaisesRegex(ValueError, "outside"):
            security.snapshot(self.repo, self.repo / "snapshot")

    def test_does_not_overwrite_existing_destination(self):
        self.destination.mkdir()
        marker = self.destination / "keep"
        marker.write_text("retained")
        with self.assertRaisesRegex(ValueError, "empty"):
            security.snapshot(self.repo, self.destination)
        self.assertEqual(marker.read_text(), "retained")


if __name__ == "__main__":
    unittest.main()
