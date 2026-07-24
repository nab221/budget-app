#!/bin/bash
#
# (Re)build the macOS launcher apps into ~/Applications and apply their icons.
# Run this again if you move the repo or change the launcher scripts.
#
set -euo pipefail

PROJECT_DIR="/Users/anderson/Codes/budget-app"
APPS_DIR="$HOME/Applications"
ASSETS="$PROJECT_DIR/scripts/assets"
BUILD_DIR="${TMPDIR:-/tmp}/budget-app-iconsets"

mkdir -p "$APPS_DIR"

# Regenerate the .icns files from source (needs python3 + Pillow).
if command -v python3 >/dev/null 2>&1; then
  rm -rf "$BUILD_DIR"
  python3 "$ASSETS/make-icon.py" "$BUILD_DIR"
  iconutil -c icns "$BUILD_DIR/launch.iconset" -o "$ASSETS/budget-app.icns"
  iconutil -c icns "$BUILD_DIR/stop.iconset" -o "$ASSETS/stop.icns"
fi

build() {
  local name="$1" script="$2" icon="$3"
  local app="$APPS_DIR/$name.app"
  rm -rf "$app"
  osacompile -e "do shell script \"$script\"" -o "$app"
  if [ -f "$icon" ]; then
    cp "$icon" "$app/Contents/Resources/applet.icns"
  fi
  touch "$app"
  echo "built $app"
}

build "Budget App" "$PROJECT_DIR/scripts/launch-app.sh" "$ASSETS/budget-app.icns"
build "Stop Budget App" "$PROJECT_DIR/scripts/stop-app.sh" "$ASSETS/stop.icns"

# Nudge LaunchServices / Finder to refresh the icon cache.
touch "$APPS_DIR"
echo "done"
