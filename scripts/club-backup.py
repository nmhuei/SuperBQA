#!/usr/bin/env python3
"""Local config generation and validated v1 backup archive handling."""

import base64
import hashlib
import ipaddress
import json
import os
from pathlib import Path, PurePosixPath
import re
import secrets
import shutil
import subprocess
import sys
import tarfile
import time
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
PAYLOADS = {"database.dump", "uploads.tar.gz", "config.tar.gz", "metadata.json"}


def digest(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def validate_origin(value):
    url = urlsplit(value)
    if (
        url.scheme not in {"https", "http"}
        or not url.hostname
        or url.username
        or url.password
        or url.path not in {"", "/"}
        or url.query
        or url.fragment
        or any(character in value for character in "\n\r'$# ")
    ):
        raise ValueError("Use an origin such as https://ctf.example.com")
    if url.scheme == "http" and url.hostname not in {"127.0.0.1", "localhost", "::1"}:
        raise ValueError("Public origins require HTTPS; HTTP is for loopback drills only")
    return value.rstrip("/")


def initialize(directory, origin, project=None, http_port=None):
    directory = Path(directory)
    origin = validate_origin(origin)
    if directory.resolve() != ROOT / "deploy/club" and (project is None or http_port is None):
        raise ValueError("An alternate state directory requires explicit PROJECT and PORT arguments")
    project, http_port = project or "rctf-club", http_port or "8080"
    if not re.fullmatch(r"[a-z0-9][a-z0-9_-]*", project):
        raise ValueError("Invalid Compose project name")
    if not str(http_port).isdigit() or not 1 <= int(http_port) <= 65535:
        raise ValueError("Invalid HTTP port")
    if directory.resolve() != ROOT / "deploy/club" and project == "rctf-club":
        raise ValueError("An alternate state directory must use a distinct project name")
    if (directory / ".env").exists() or (directory / "config").exists():
        raise ValueError("Existing .env or config directory; refusing to overwrite")
    directory.mkdir(parents=True, exist_ok=True)
    config_dir = directory / "config"
    config_dir.mkdir(mode=0o755)
    config_dir.chmod(0o755)
    revision = subprocess.check_output(
        ["git", "rev-parse", "--short=12", "HEAD"], cwd=ROOT, text=True
    ).strip()
    now = int(time.time() * 1000)
    template = (ROOT / "deploy/club/config.example.yaml").read_text()
    template = template.replace("startTime: 0", f"startTime: {now}")
    template = template.replace("endTime: 0", f"endTime: {now + 72 * 3600000}")
    config_path = config_dir / "00-club.yaml"
    config_path.write_text(template)
    config_path.chmod(0o644)  # Public settings; all credentials stay in .env.
    values = {
        "COMPOSE_PROJECT_NAME": project,
        "RCTF_RELEASE": f"{revision}-{time.strftime('%Y%m%d%H%M%S', time.gmtime())}",
        "RCTF_BIND_ADDRESS": "127.0.0.1",
        "RCTF_HTTP_PORT": str(http_port),
        "RCTF_ORIGIN": origin,
        "RCTF_TOKEN_KEY": base64.b64encode(secrets.token_bytes(32)).decode(),
        "RCTF_DATABASE_PASSWORD": secrets.token_hex(32),
        "RCTF_REDIS_PASSWORD": secrets.token_hex(32),
        "RCTF_SMTP_URL": "",
    }
    env_path = directory / ".env"
    with env_path.open("x") as stream:
        os.chmod(env_path, 0o600)
        stream.write("# Generated secrets: keep private; do not commit.\n")
        stream.writelines(f"{key}='{value}'\n" for key, value in values.items())
    print(f"Created {env_path} (600) and public config/00-club.yaml (644)")


def checked_members(archive, allowed=None):
    members = archive.getmembers()
    seen = set()
    for member in members:
        path = PurePosixPath(member.name)
        if path.is_absolute() or ".." in path.parts:
            raise ValueError("Unsafe archive path")
        name = str(path)
        if name in seen or not (member.isfile() or member.isdir()):
            raise ValueError("Duplicate path, link, or special file in archive")
        seen.add(name)
        if allowed is not None and name not in allowed:
            raise ValueError(f"Unexpected archive entry: {name}")
    return members


def extract_regular(archive, directory, members):
    directory = Path(directory)
    for member in members:
        destination = directory / member.name
        if member.isdir():
            destination.mkdir(parents=True, exist_ok=True)
            continue
        destination.parent.mkdir(parents=True, exist_ok=True)
        with archive.extractfile(member) as source, destination.open("xb") as target:
            shutil.copyfileobj(source, target)
        destination.chmod(0o600)


def unpack(archive_path, directory):
    archive_path = Path(archive_path).resolve()
    directory = Path(directory)
    checksum = Path(str(archive_path) + ".sha256").read_text().split()[0]
    if not re.fullmatch(r"[a-fA-F0-9]{64}", checksum) or digest(archive_path) != checksum.lower():
        raise ValueError("Backup archive checksum does not match")
    directory.mkdir(parents=True, exist_ok=True)
    if any(directory.iterdir()):
        raise ValueError("Archive staging directory must be empty")
    directory.chmod(0o700)
    with tarfile.open(archive_path, "r:gz") as archive:
        members = checked_members(archive, PAYLOADS | {"SHA256SUMS"})
        if {member.name for member in members} != PAYLOADS | {"SHA256SUMS"}:
            raise ValueError("Incomplete backup archive")
        extract_regular(archive, directory, members)
    expected = {}
    for line in (directory / "SHA256SUMS").read_text().splitlines():
        checksum, name = line.split("  ", 1)
        if name in expected:
            raise ValueError("Duplicate checksum entry")
        expected[name] = checksum
    if set(expected) != PAYLOADS:
        raise ValueError("Unexpected payload checksum manifest")
    for name, checksum in expected.items():
        if digest(directory / name) != checksum:
            raise ValueError(f"Payload checksum does not match: {name}")
    metadata = json.loads((directory / "metadata.json").read_text())
    if metadata.get("format_version") != 1 or metadata.get("postgres_major") != 18:
        raise ValueError("Unsupported backup format or PostgreSQL major version")
    with tarfile.open(directory / "uploads.tar.gz", "r:gz") as archive:
        checked_members(archive)
    with tarfile.open(directory / "config.tar.gz", "r:gz") as archive:
        members = checked_members(archive)
        for member in members:
            path = PurePosixPath(member.name)
            if str(path) != ".env" and (not path.parts or path.parts[0] != "config"):
                raise ValueError("Unexpected configuration archive entry")
        if not any(member.name == ".env" and member.isfile() for member in members):
            raise ValueError("Backup has no .env secrets")
        extract_regular(archive, directory / "configuration", members)
    print("Backup checksums, version, and archive paths verified")


def manifest(directory, image_id, image_name, project):
    directory = Path(directory)
    metadata = {
        "format_version": 1,
        "postgres_major": 18,
        "created_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "application_image_id": image_id,
        "application_image": image_name,
        "compose_project": project,
        "redis": "Derived caches and locks are reset on restore, not archived",
    }
    (directory / "metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")
    (directory / "SHA256SUMS").write_text(
        "".join(f"{digest(directory / name)}  {name}\n" for name in sorted(PAYLOADS))
    )


def restore_config(stage, directory, current_compose):
    stage, directory = Path(stage), Path(directory)
    current = json.loads(Path(current_compose).read_text())
    service = current["services"]["rctf"]
    port = next(port for port in service["ports"] if port["target"] == 80)
    project = current["name"]
    if not re.fullmatch(r"[a-z0-9][a-z0-9_-]*", project):
        raise ValueError("Invalid destination Compose project name")
    address = str(ipaddress.ip_address(port["host_ip"]))
    published = int(port["published"])
    if not 1 <= published <= 65535:
        raise ValueError("Invalid published port")
    origin = validate_origin(service["environment"]["RCTF_ORIGIN"])
    preserved = {
        "COMPOSE_PROJECT_NAME": project,
        "RCTF_BIND_ADDRESS": address,
        "RCTF_HTTP_PORT": str(published),
        "RCTF_ORIGIN": origin,
    }
    source = stage / "configuration"
    if not (source / "config/00-club.yaml").is_file():
        raise ValueError("Backup has no club configuration")
    env = (source / ".env").read_text()
    env += "\n# Destination routing retained during restore.\n"
    env += "".join(f"{key}='{value}'\n" for key, value in preserved.items())
    if (directory / "config").exists():
        shutil.rmtree(directory / "config")
    shutil.copytree(source / "config", directory / "config")
    for path in (directory / "config").rglob("*"):
        path.chmod(0o755 if path.is_dir() else 0o644)
    (directory / "config").chmod(0o755)
    (directory / ".env").write_text(env)
    (directory / ".env").chmod(0o600)


def main():
    actions = {
        "init": initialize,
        "unpack": unpack,
        "manifest": manifest,
        "restore-config": restore_config,
    }
    try:
        actions[sys.argv[1]](*sys.argv[2:])
    except (OSError, ValueError, KeyError, IndexError, tarfile.TarError) as error:
        print(f"club-backup: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
