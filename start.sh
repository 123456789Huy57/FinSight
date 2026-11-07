#!/bin/sh
set -eu

cd /app/backend
alembic upgrade head
python3 -m uvicorn main:app --host 127.0.0.1 --port 8000 &
backend_pid=$!
cd /app
npm --prefix /app/frontend run start &
frontend_pid=$!

stop_services() {
  kill "$backend_pid" "$frontend_pid" 2>/dev/null || true
}
trap stop_services INT TERM
set +e
wait "$frontend_pid"
status=$?
stop_services
exit "$status"
