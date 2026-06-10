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

# Ad-hoc sign (required on Apple Silicon). Signing IN PLACE under ~/Desktop is
# unreliable: iCloud/file-provider sync keeps re-adding xattrs ("resource fork
# ... detritus not allowed") in a race with codesign. So stage the bundle in a
# temp dir outside any synced folder, clean + sign + VERIFY there, then move the
# signed copy back over dist/.
echo "→ Ad-hoc signing in a temp stage (avoids iCloud xattr races)..."
STAGE="$(mktemp -d)"
ditto "$APP" "$STAGE/app.app"
SIGNED=""
for _try in 1 2 3 4 5; do
  find "$STAGE/app.app" -name '.DS_Store' -delete 2>/dev/null || true
  dot_clean -m "$STAGE/app.app" 2>/dev/null || true
  xattr -cr "$STAGE/app.app" 2>/dev/null || true
  if codesign --force --deep --sign - "$STAGE/app.app" 2>/dev/null \
      && codesign --verify "$STAGE/app.app" 2>/dev/null; then
    SIGNED=yes
    break
  fi
  sleep 1
done
if [ -n "$SIGNED" ]; then
  rm -rf "$APP"
  ditto "$STAGE/app.app" "$APP"
  echo "  ✓ ad-hoc signed + verified"
else
  echo "  ⚠ couldn't get a verified signature — the app still launches on PyInstaller's own."
fi
rm -rf "$STAGE"

echo ""
echo "✓ Built: $APP"
echo "  Launch:   open '$APP'"
echo "  Install:  drag it into /Applications (or run: cp -R '$APP' /Applications/)"
