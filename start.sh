#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ ! -d backend/node_modules || ! -d frontend/node_modules ]]; then
  echo 'Install dependencies first: npm ci && npm run install:all' >&2
  exit 1
fi
node --import ./backend/node_modules/tsx/dist/loader.mjs backend/src/index.ts &
api_pid=$!
node frontend/node_modules/vite/bin/vite.js frontend --host 127.0.0.1 &
web_pid=$!
trap 'kill "$api_pid" "$web_pid" 2>/dev/null || true' EXIT INT TERM
wait -n "$api_pid" "$web_pid"
