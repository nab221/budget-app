#!/bin/bash
#
# Launch the budget-app dev server (if it isn't already running) and open it
# in the default browser. Invoked by the "Budget App.app" launcher, but also
# safe to run directly from a terminal.
#
set -euo pipefail

PROJECT_DIR="/Users/anderson/Codes/budget-app"
PORT=5173
URL="http://localhost:${PORT}/budget-app/"
LOG="${PROJECT_DIR}/.launch-dev.log"

# A double-clicked .app does not inherit a login shell's PATH, so Homebrew's
# node/npm won't be found unless we add them explicitly.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${PATH:-}"

cd "$PROJECT_DIR"

# Start the dev server only if nothing is already listening on the port.
if ! curl -s -o /dev/null "http://localhost:${PORT}/"; then
  nohup npm run dev >"$LOG" 2>&1 </dev/null &
  disown || true

  # Wait for Vite to come up (up to ~30s).
  for _ in $(seq 1 60); do
    if curl -s -o /dev/null "http://localhost:${PORT}/"; then
      break
    fi
    sleep 0.5
  done
fi

open "$URL"
