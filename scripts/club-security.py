"""Create the source boundary used by local and CI security scans."""

import argparse
from pathlib import Path
import shutil
import stat
import subprocess


def snapshot(repository, destination):
    repository, destination = Path(repository).resolve(), Path(destination).resolve()
    if destination.is_relative_to(repository):
        raise ValueError("Scan destination must be outside the repository")
    if destination.exists() and any(destination.iterdir()):
        raise ValueError("Scan destination must be empty")
    paths = subprocess.check_output(
        ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
        cwd=repository,
    ).split(b"\0")
    destination.mkdir(mode=0o700, parents=True, exist_ok=True)
    destination.chmod(0o700)
    count = 0
    for name in sorted(set(paths) - {b""}):
        relative = Path(name.decode("utf-8", "surrogateescape"))
        if relative.is_absolute() or ".." in relative.parts:
            raise ValueError("Unsafe source path")
        source = repository / relative
        # Reject links, including parent directories replaced after git add.
        # Never dereference a link into ignored state or another directory.
        for path in (source, *source.parents):
            if path == repository:
                break
            if path.is_symlink():
                raise ValueError("Source links are unsupported; refusing to follow link")
        if not source.exists():
            continue  # A tracked file deleted in the working tree.
        if not stat.S_ISREG(source.stat().st_mode):
            raise ValueError("Source must be a regular file (submodules are unsupported)")
        target = destination / relative
        target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        target.chmod(0o600)
        count += 1
    return count


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    count = snapshot(Path(__file__).resolve().parents[1], args.destination)
    print(f"Prepared {count} tracked and nonignored source files.")
