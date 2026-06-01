#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# DCF Valuation Studio — one-command launcher.
# Starts the FastAPI backend (:8000) and the Vite/React frontend (:5173),
# installing dependencies on first run. Press Ctrl+C to stop both.
# -----------------------------------------------------------------------------
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# --- Backend: create venv + install deps on first run ------------------------
if [ ! -d backend/venv ]; then
  echo "→ Creating Python virtual environment..."
  python3 -m venv backend/venv
  backend/venv/bin/python -m pip install --quiet --upgrade pip
  echo "→ Installing backend dependencies..."
  backend/venv/bin/pip install --quiet -r backend/requirements.txt
fi

# --- Frontend: install node deps on first run --------------------------------
if [ ! -d frontend/node_modules ]; then
  echo "→ Installing frontend dependencies..."
  ( cd frontend && npm install )
fi

echo ""
echo "  Backend  →  http://127.0.0.1:8000  (financial data API)"
echo "  Frontend →  http://localhost:5173  (open this in your browser)"
echo ""

# --- Launch both, shut them down together on exit ----------------------------
backend/venv/bin/uvicorn --app-dir backend main:app --port 8000 --log-level warning &
BACK_PID=$!
( cd frontend && npm run dev ) &
FRONT_PID=$!

trap 'echo; echo "Shutting down..."; kill $BACK_PID $FRONT_PID 2>/dev/null; exit 0' INT TERM

# Give the servers a moment, then open the browser (macOS).
sleep 3
command -v open >/dev/null 2>&1 && open http://localhost:5173 || true

wait
