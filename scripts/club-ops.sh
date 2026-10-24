#!/usr/bin/env bash
# Container-side variables must remain literal until Docker executes sh.
# shellcheck disable=SC2016
set -euo pipefail
umask 077

repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
deploy_dir="$repo_dir/deploy/club"
state_dir="${CLUB_STATE_DIR:-$deploy_dir}"
state_dir="$(realpath -m -- "$state_dir")"
helper="$repo_dir/scripts/club-backup.py"
export CLUB_CONFIG_DIR="$state_dir/config"

usage() {
  cat <<'USAGE'
Usage: scripts/club-ops.sh COMMAND
  init ORIGIN [PROJECT PORT]   Generate secrets; alternate state requires project/port
  validate                     Validate Compose without starting containers
  build                        Build the customized API, CLI, and web image
  up                           Start with health checks; migrations run on startup
  status                       Show services and readiness health
  logs                         Follow the last 100 application log lines
  backup                       Pause app; archive database, uploads, config, secrets
  verify ARCHIVE               Verify archive and payload checksums without Docker
  restore ARCHIVE --replace-data
                               Replace database/uploads/config; requires local image
  compose ARGS...              Run Compose with the same project/config settings

CLUB_STATE_DIR selects another state directory; init then requires a distinct project/port.
Backups contain credentials and flags; encrypt them before off-host storage.
USAGE
}

fail() { printf '%s\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null || fail "Required command is missing: $1"; }
compose() {
  docker compose --project-directory "$deploy_dir" \
    --env-file "$state_dir/.env" -f "$deploy_dir/compose.yaml" "$@"
}

action="${1:-help}"
shift || true
case "$action" in
  help|-h|--help) usage; exit 0 ;;
  init)
    [[ $# == 1 || $# == 3 ]] || fail 'Usage: init ORIGIN [PROJECT PORT]'
    exec python3 "$helper" init "$state_dir" "$@"
    ;;
  verify)
    [[ $# == 1 ]] || fail 'verify requires the backup archive path'
    stage="$(mktemp -d)"
    trap 'rm -rf -- "$stage"' EXIT
    python3 "$helper" unpack "$1" "$stage"
    exit 0
    ;;
  restore)
    [[ $# == 2 && "$2" == --replace-data ]] || \
      fail 'Restore replaces database, uploads, and configuration. Invoke: restore ARCHIVE --replace-data'
    ;;
  validate|build|up|status|logs|backup|compose) ;;
  *) usage >&2; exit 2 ;;
esac

for executable in docker python3 tar sha256sum; do need "$executable"; done
[[ -f "$state_dir/.env" && -d "$CLUB_CONFIG_DIR" ]] || fail 'Run init first'
chmod 600 "$state_dir/.env"
docker compose version >/dev/null
compose config --quiet
case "$action" in
  up|backup|restore)
    need flock
    project="$(compose config --format json | python3 -c 'import json,sys; print(json.load(sys.stdin)["name"])')"
    lock_dir="${XDG_RUNTIME_DIR:-$HOME/.cache}/rctf-club-locks"
    mkdir -p "$lock_dir"
    chmod 700 "$lock_dir"
    exec 9> "$lock_dir/$project.lock"
    flock -n 9 || fail 'Another state-changing club operation is already running'
    existing_app="$(compose ps --all --quiet rctf)"
    if [[ -n "$existing_app" ]]; then
      mounted_config="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/app/rctf.d"}}{{.Source}}{{end}}{{end}}' "$existing_app")"
      [[ "$mounted_config" == "$CLUB_CONFIG_DIR" ]] || \
        fail 'This Compose project belongs to a different state directory; choose a distinct project name'
    fi
    ;;
esac

case "$action" in
  validate) printf 'Compose configuration is valid.\n' ;;
  build) compose build --pull rctf ;;
  up) compose up -d --no-build --wait --wait-timeout 180 ;;
  status)
    compose ps
    compose exec -T rctf bun -e \
      'const r = await fetch("http://127.0.0.1/api/readyz"); console.log(await r.text()); process.exit(r.ok ? 0 : 1)'
    ;;
  logs) compose logs --tail 100 -f rctf ;;
  compose) compose "$@" ;;
  backup)
    mkdir -p "$state_dir/backups"
    chmod 700 "$state_dir/backups"
    stage="$(mktemp -d "$state_dir/backups/.backup-XXXXXX")"
    app_id="$(compose ps --all --quiet rctf)"
    [[ -n "$app_id" ]] || fail 'Create the application container before backing up'
    was_running="$(docker inspect --format '{{.State.Running}}' "$app_id")"
    image_id="$(docker inspect --format '{{.Image}}' "$app_id")"
    image_name="$(docker inspect --format '{{.Config.Image}}' "$app_id")"
    tagged_image_id="$(docker image inspect --format '{{.Id}}' "$image_name")"
    [[ "$tagged_image_id" == "$image_id" ]] || \
      fail 'Release tag moved since this container started; retain its original image before backup'
    project="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$app_id")"
    compose config --format json > "$stage/current-compose.json"
    python3 - "$stage/current-compose.json" "$image_name" <<'PY'
import json, sys
if json.load(open(sys.argv[1]))['services']['rctf']['image'] != sys.argv[2]:
    raise SystemExit('Configured release differs from running image; reconcile before backup')
PY
    app_stopped=false
    cleanup_backup() {
      result=$?
      trap - EXIT
      if [[ "$app_stopped" == true && "$was_running" == true ]]; then
        compose start rctf >&2 || result=1
      fi
      rm -rf -- "$stage"
      exit "$result"
    }
    trap cleanup_backup EXIT
    app_stopped=true
    compose stop rctf >&2
    compose exec -T postgres sh -c \
      'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl' \
      > "$stage/database.dump"
    compose run --rm -T --no-deps --entrypoint tar rctf \
      -C /app/uploads -czf - . > "$stage/uploads.tar.gz"
    tar -C "$state_dir" -czf "$stage/config.tar.gz" config .env
    python3 "$helper" manifest "$stage" "$image_id" "$image_name" "$project"
    archive="$state_dir/backups/rctf-club-v1-$(date -u +%Y%m%dT%H%M%S)-${RANDOM}.tar.gz"
    tar -C "$stage" -czf "$archive" \
      database.dump uploads.tar.gz config.tar.gz metadata.json SHA256SUMS
    chmod 600 "$archive"
    (cd -- "$(dirname -- "$archive")" && sha256sum -- "$(basename -- "$archive")") \
      > "$archive.sha256"
    chmod 600 "$archive.sha256"
    printf '%s\n' "$archive"
    ;;
  restore)
    archive="$(realpath -- "$1")"
    stage="$(mktemp -d "$state_dir/.restore-XXXXXX")"
    # Keep the validated stage on any failure for operator inspection.
    printf 'Restore staging directory: %s\n' "$stage" >&2
    python3 "$helper" unpack "$archive" "$stage"
    compose config --format json > "$stage/current-compose.json"
    image_id="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["application_image_id"])' "$stage/metadata.json")"
    image_name="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["application_image"])' "$stage/metadata.json")"
    actual_id="$(docker image inspect --format '{{.Id}}' "$image_name")"
    [[ "$actual_id" == "$image_id" ]] || \
      fail 'Restore requires the exact archived application image; load it before continuing'
    # Validate dump readability before stopping the application or replacing data.
    compose run --rm -T --no-deps --entrypoint pg_restore postgres --list \
      < "$stage/database.dump" > /dev/null
    compose stop rctf
    python3 "$helper" restore-config "$stage" "$state_dir" "$stage/current-compose.json"
    compose config --quiet
    compose up -d --wait --wait-timeout 120 postgres redis
    compose exec -T postgres sh -c \
      'dropdb --force --if-exists -U "$POSTGRES_USER" "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" -O "$POSTGRES_USER" "$POSTGRES_DB"'
    compose exec -T postgres sh -c \
      'exec pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl --exit-on-error' \
      < "$stage/database.dump"
    # POSTGRES_PASSWORD only affects new clusters; synchronize the existing role too.
    compose exec -T postgres sh -c \
      'exec psql -v ON_ERROR_STOP=1 --set=password="$POSTGRES_PASSWORD" -U "$POSTGRES_USER" -d postgres' <<'SQL'
ALTER ROLE rctf WITH PASSWORD :'password';
SQL
    compose run --rm -T --no-deps --entrypoint sh rctf -ec \
      'find /app/uploads -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +; tar -C /app/uploads -xzf -; chown -R rctf:rctf /app/uploads' \
      < "$stage/uploads.tar.gz"
    # Only this stack owns this Redis instance; all authoritative data is PostgreSQL.
    compose exec -T redis sh -c \
      'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli FLUSHALL' > /dev/null
    compose up -d --no-build --wait --wait-timeout 180 rctf
    rm -rf -- "$stage"
    printf 'Restore completed; verify login, uploads, standings, membership, and practice.\n'
    ;;
esac
