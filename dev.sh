#!/usr/bin/env bash
# Launch both dev servers for cEDHcube.
#   ./dev.sh          # start both in foreground (Ctrl-C stops both)
#   ./dev.sh -b       # start both in background, log to .dev/*.log
set -euo pipefail
cd "$(dirname "$0")"

BACKEND_PID=""
FRONTEND_PID=""
cleanup() {
  [[ -n "$BACKEND_PID" ]] && kill "$BACKEND_PID" 2>/dev/null || true
  [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT

log_dir=".dev"
mkdir -p "$log_dir"

start_backend() {
  echo "[backend] uvicorn on :8000"
  if [[ "${1:-}" == "-b" ]]; then
    ./venv/bin/python -m uvicorn app:app --reload --port 8000 --host 0.0.0.0 \
      >"$log_dir/backend.log" 2>&1 &
    BACKEND_PID=$!
  else
    ./venv/bin/python -m uvicorn app:app --reload --port 8000 --host 0.0.0.0 &
    BACKEND_PID=$!
  fi
}

start_frontend() {
  echo "[frontend] vite on :5173"
  if [[ "${1:-}" == "-b" ]]; then
    (cd frontend && npx vite --host 0.0.0.0 --port 5173) >"$log_dir/frontend.log" 2>&1 &
    FRONTEND_PID=$!
  else
    (cd frontend && npx vite --host 0.0.0.0 --port 5173) &
    FRONTEND_PID=$!
  fi
}

if [[ "${1:-}" == "-b" ]]; then
  start_backend -b
  start_frontend -b
  echo "Both servers starting in background."
  echo "  backend log:  $log_dir/backend.log"
  echo "  frontend log: $log_dir/frontend.log"
  echo "App: http://localhost:5173  API: http://localhost:8000"
  exit 0
fi

start_backend
start_frontend
wait
