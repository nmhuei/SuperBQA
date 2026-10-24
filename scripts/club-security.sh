#!/usr/bin/env bash
set -euo pipefail
umask 077

repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
secret_config="$repo_dir/scripts/club-security-gitleaks.toml"
action="${1:-help}"
case "$action" in
  secrets|dependencies|configuration|sbom|self-test) ;;
  *) echo 'Usage: scripts/club-security.sh secrets|dependencies|configuration|sbom|self-test'; exit 2 ;;
esac
stage="$(mktemp -d)"
trap 'rm -rf -- "$stage"' EXIT

case "$action" in
  self-test)
    python3 "$repo_dir/scripts/club-security-test.py"
    mkdir -p "$stage/secrets/apps/cli/src/commands/seed" "$stage/unsafe"
    # An invented token, assembled only in a temporary directory; never printed.
    python3 - "$stage/secrets/apps/cli/src/commands/seed/data.ts" <<'PY'
import hashlib
from pathlib import Path
import sys
Path(sys.argv[1]).write_text(
    'github_token="' + 'ghp_' + 'Ab9Cd0Ef1Gh2Ij3Kl4Mn5Op6Qr7St8Uv9Wx0' + '"\n'
    + 'api_key="' + hashlib.sha256(b'public scanner fixture').hexdigest() + '"\n'
)
PY
    result=0
    gitleaks dir "$stage/secrets" --config "$secret_config" --redact=100 --no-banner --exit-code 1 \
      --ignore-gitleaks-allow --gitleaks-ignore-path /dev/null \
      --report-format json --report-path "$stage/secrets.json" --log-level error || result=$?
    [[ "$result" == 1 ]] || { echo 'Secret guard did not reject fixture.' >&2; exit 1; }
    python3 - "$stage/secrets.json" <<'PY'
import json, sys
findings = json.load(open(sys.argv[1]))
assert any(item['RuleID'] == 'github-pat' for item in findings), 'Expected token rule did not fire'
assert any(item['RuleID'] == 'generic-api-key' for item in findings), 'Fixture exceptions hid a new key'
assert all(item['Secret'] == 'REDACTED' for item in findings), 'Secret report is not redacted'
PY
    printf 'FROM alpine:3.22\nRUN echo unsafe\n' > "$stage/unsafe/Dockerfile"
    result=0
    trivy config --quiet --skip-check-update --severity HIGH,CRITICAL \
      --ignorefile /dev/null --exit-code 1 --format json \
      --output "$stage/unsafe.json" "$stage/unsafe" || result=$?
    [[ "$result" == 1 ]] || { echo 'Configuration guard did not reject fixture.' >&2; exit 1; }
    python3 - "$stage/unsafe.json" <<'PY'
import json, sys
report = json.load(open(sys.argv[1]))
assert any(item['ID'] == 'DS-0002' for result in report['Results']
           for item in result.get('Misconfigurations', [])), 'Expected root-user rule did not fire'
PY
    echo 'Security guards rejected both harmless fixtures; secret output was redacted.'
    exit 0
    ;;
esac

python3 "$repo_dir/scripts/club-security.py" "$stage/source"
cd -- "$stage/source"
case "$action" in
  secrets)
    # Scan current distributable contents, including new nonignored files locally.
    # Only exact public example values at exact paths are exempted.
    # Ignore ad-hoc suppression comments/files and never print raw secret values.
    result=0
    gitleaks dir . --config "$secret_config" --redact=100 --no-banner --exit-code 1 \
      --ignore-gitleaks-allow --gitleaks-ignore-path /dev/null \
      --report-format json --report-path "$stage/findings.json" || result=$?
    if [[ -f "$stage/findings.json" ]]; then
      python3 - "$stage/findings.json" <<'PY'
import json, sys
for finding in json.load(open(sys.argv[1])):
    print(json.dumps({"rule": finding["RuleID"], "file": finding["File"],
                      "line": finding["StartLine"]}))
PY
    fi
    exit "$result"
    ;;
  dependencies)
    [[ "$(bun --version)" == 1.4.4 ]] || { echo 'Use the repository-pinned Bun 1.4.4.' >&2; exit 1; }
    # Audit reads bun.lock directly; no installation or lifecycle scripts are needed.
    bun audit --audit-level=high
    ;;
  configuration)
    # The default club deployment; separate instancer/Terraform profiles need their own review.
    trivy config --severity HIGH,CRITICAL --ignorefile /dev/null --exit-code 1 deploy/rctf
    ;;
  sbom)
    [[ $# == 2 ]] || { echo 'sbom requires an absolute output filename outside the repository.' >&2; exit 2; }
    output="$(realpath -m -- "$2")"
    [[ "$2" == /* && "$output" != "$repo_dir"/* ]] || { echo 'SBOM output must be outside the repository.' >&2; exit 2; }
    # No CVE DB is needed for an inventory. Bun dev dependencies are included.
    trivy fs --scanners license --include-dev-deps --format cyclonedx --output "$output" .
    ;;
esac
