#!/usr/bin/env bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "[*] Stopping SuperBQA (rCTF) processes..."
pkill -f "bun dev" 2>/dev/null || true
pkill -f "apps/api/src/index.ts" 2>/dev/null || true
pkill -f "vite dev" 2>/dev/null || true

echo "[*] Stopping PostgreSQL..."
/usr/lib/postgresql/18/bin/pg_ctl -D "$DIR/.data/postgres_local" stop 2>/dev/null || true

echo "[*] Stopping Redis..."
redis-cli -a DO_NOT_USE_ME shutdown 2>/dev/null || true

echo "[✓] All services stopped."
