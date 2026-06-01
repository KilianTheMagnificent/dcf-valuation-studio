#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Build the self-contained "DCF Valuation Studio.app" for macOS.
# Bundles an embedded Python + all libraries + the React build + a native
# WebKit window. The result needs NO Python/Node to run.
# -----------------------------------------------------------------------------
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

VENV="backend/venv"
APP="dist/DCF Valuation Studio.app"

if [ ! -d "$VENV" ]; then
  echo "→ Creating Python virtual environment..."
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install --quiet --upgrade pip
fi

echo "→ Installing runtime + build dependencies..."
"$VENV/bin/pip" install --quiet -r backend/requirements.txt
"$VENV/bin/pip" install --quiet -r backend/requirements-desktop.txt

echo "→ Building the frontend..."
( cd frontend && npm install && npm run build )

echo "→ Generating the app icon..."
"$VENV/bin/python" build_assets/make_icon.py
iconutil -c icns build_assets/icon.iconset -o build_assets/icon.icns

echo "→ Packaging the .app with PyInstaller (this takes a few minutes)..."
"$VENV/bin/pyinstaller" --noconfirm --clean dcf.spec

# Clear filesystem detritus, then ad-hoc sign. macOS Sequoia keeps re-adding a
# system `com.apple.provenance` xattr to the bundled .so files, which can make
# codesign report "resource fork ... not allowed" — so retry a few times. The app
# runs on PyInstaller's own ad-hoc signature regardless, so this never aborts the
# build (important: release.sh relies on build_app.sh succeeding).
echo "→ Clearing detritus + ad-hoc signing (required on Apple Silicon)..."
_sign() {
  find "$APP" -name '.DS_Store' -delete 2>/dev/null || true
  dot_clean -m "$APP" 2>/dev/null || true
  xattr -cr "$APP" 2>/dev/null || true
  codesign --force --deep --sign - "$APP" 2>/dev/null
}
if _sign || { sleep 2; _sign; } || { sleep 3; _sign; }; then
  echo "  ✓ ad-hoc signed"
else
  echo "  ⚠ couldn't fully re-sign (harmless system xattr) — the app still launches."
fi

echo ""
echo "✓ Built: $APP"
echo "  Launch:   open '$APP'"
echo "  Install:  drag it into /Applications (or run: cp -R '$APP' /Applications/)"
