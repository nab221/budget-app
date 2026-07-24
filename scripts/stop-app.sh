#!/bin/bash
#
# Stop the budget-app dev server started by launch-app.sh.
# Invoked by the "Stop Budget App.app" launcher; also safe to run directly.
#
set -uo pipefail

PROJECT_DIR="/Users/anderson/Codes/budget-app"
PATTERN="${PROJECT_DIR}/node_modules/.bin/vite"

notify() {
  osascript -e "display notification \"$1\" with title \"Budget App\"" >/dev/null 2>&1 || true
}

if pkill -f "$PATTERN"; then
  echo "Dev server stopped."
  notify "Dev server stopped."
else
  echo "No dev server was running."
  notify "No dev server was running."
fi
