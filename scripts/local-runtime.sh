#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"
export PATH="${BUN_INSTALL:-$HOME/.bun}/bin:$PATH"

case "${1:-status}" in
  services)
    sudo -n service postgresql start
    sudo -n service redis-server start
    ;;
  api)
    export PORT="${PORT:-3000}"
    export LOG_LEVEL="${LOG_LEVEL:-info}"
    exec bun run dev:api
    ;;
  web)
    cd apps/web
    exec bun run dev --host 0.0.0.0 --port 5173 --strictPort
    ;;
  status)
    pg_isready -h 127.0.0.1 -p 5432
    redis-cli -h 127.0.0.1 -p 6379 -n 13 ping
    curl --fail --silent --show-error http://127.0.0.1:3000/api/readyz
    printf '\n'
    ;;
  *)
    printf 'Usage: %s {services|api|web|status}\n' "$0" >&2
    exit 2
    ;;
esac
