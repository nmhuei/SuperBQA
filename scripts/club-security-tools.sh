#!/usr/bin/env bash
# Pinned release archives, verified against upstream release checksums.
set -euo pipefail
umask 077

[[ $# -ge 2 ]] || { echo 'Usage: scripts/club-security-tools.sh INSTALL_DIR gitleaks|trivy|actionlint [...]' >&2; exit 2; }
install_dir="$(realpath -m -- "$1")"
shift
[[ "$(uname -s)" == Linux ]] || { echo 'This installer supports Linux only.' >&2; exit 2; }
architecture="$(uname -m)"
stage="$(mktemp -d)"
trap 'rm -rf -- "$stage"' EXIT
mkdir -p -- "$install_dir"

for tool in "$@"; do
  case "$tool:$architecture" in
    gitleaks:x86_64)
      release=gitleaks/gitleaks/v8.30.1
      archive=gitleaks_8.30.1_linux_x64.tar.gz
      checksum=551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb ;;
    gitleaks:aarch64)
      release=gitleaks/gitleaks/v8.30.1
      archive=gitleaks_8.30.1_linux_arm64.tar.gz
      checksum=e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080 ;;
    trivy:x86_64)
      release=aquasecurity/trivy/v0.76.1
      archive=trivy_0.76.1_Linux-64bit.tar.gz
      checksum=c7cbe3137fb8a48a17574bede3dd6beb16742d1e9772929940fc90082c39d9c0 ;;
    trivy:aarch64)
      release=aquasecurity/trivy/v0.76.1
      archive=trivy_0.76.1_Linux-ARM64.tar.gz
      checksum=e174dff2a6dba5e3ae41f8d0537a6324405bd08132497340304c6b20e0f16a1f ;;
    actionlint:x86_64)
      release=rhysd/actionlint/v1.7.12
      archive=actionlint_1.7.12_linux_amd64.tar.gz
      checksum=8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8 ;;
    actionlint:aarch64)
      release=rhysd/actionlint/v1.7.12
      archive=actionlint_1.7.12_linux_arm64.tar.gz
      checksum=325e971b6ba9bfa504672e29be93c24981eeb1c07576d730e9f7c8805afff0c6 ;;
    *) echo 'Unsupported tool or architecture.' >&2; exit 2 ;;
  esac
  project="${release%/*}"
  version="${release##*/}"
  curl --fail --silent --show-error --location --retry 3 \
    --proto '=https' --tlsv1.2 \
    "https://github.com/$project/releases/download/$version/$archive" \
    --output "$stage/$archive"
  printf '%s  %s\n' "$checksum" "$stage/$archive" | sha256sum --check --status
  tar -xzf "$stage/$archive" -C "$stage" "$tool"
  install -m 0755 "$stage/$tool" "$install_dir/$tool"
  printf 'Installed %s %s (archive SHA-256 verified).\n' "$tool" "$version"
done
