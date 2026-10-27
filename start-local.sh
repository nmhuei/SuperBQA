#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

export PATH="$HOME/.bun/bin:$PATH"

# 1. Start Redis if not running
if ! redis-cli -a DO_NOT_USE_ME ping >/dev/null 2>&1; then
    echo "[+] Starting local Redis..."
    mkdir -p "$DIR/.data/redis"
    redis-server --port 6379 --requirepass DO_NOT_USE_ME --dir "$DIR/.data/redis" --daemonize yes
else
    echo "[*] Redis is already running."
fi

# 2. Start PostgreSQL if not running
if ! /usr/lib/postgresql/18/bin/pg_ctl -D "$DIR/.data/postgres_local" status >/dev/null 2>&1; then
    echo "[+] Starting local PostgreSQL..."
    /usr/lib/postgresql/18/bin/pg_ctl -D "$DIR/.data/postgres_local" -o "-k /tmp" -l "$DIR/.data/postgres_local/logfile" start
else
    echo "[*] PostgreSQL is already running."
fi

echo "[+] Starting SuperBQA (rCTF) dev servers..."
echo "    Web & Admin UI: http://127.0.0.1:5173"
echo "    API Backend:    http://127.0.0.1:3000"
echo ""

bun dev
