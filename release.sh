#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Publish a new version of DCF Valuation Studio.
#   ./release.sh 1.1.0
# Bumps the version, bakes in your GitHub repo, builds the self-contained .app,
# zips it, tags the commit, and publishes a GitHub Release. Installed copies of
# the app then detect the new version and can update themselves.
# -----------------------------------------------------------------------------
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

NEW_VERSION="${1#v}"
if [ -z "$NEW_VERSION" ]; then
  echo "Usage: ./release.sh <version>      e.g.  ./release.sh 1.1.0"
  exit 1
fi

REPO_URL="$(git remote get-url origin 2>/dev/null || true)"
if [ -z "$REPO_URL" ]; then
  echo "✗ No git remote 'origin' found. First create a GitHub repo, then:"
  echo "    git remote add origin https://github.com/<you>/<repo>.git"
  exit 1
fi
REPO_SLUG="$(echo "$REPO_URL" | sed -E 's#^(git@github.com:|https://github.com/)##; s#\.git$##')"
echo "→ Releasing v$NEW_VERSION   (repo: $REPO_SLUG)"

# 1) Bump version + bake the repo so the built app knows where to check for updates.
sed -i '' -E "s|^__version__ = .*|__version__ = \"$NEW_VERSION\"|" backend/version.py
sed -i '' -E "s|^_BAKED_REPO = .*|_BAKED_REPO = \"$REPO_SLUG\"|" backend/update_config.py

# 2) Build the self-contained app (frontend + PyInstaller + sign).
./build_app.sh

# 3) Zip the .app (ditto preserves the bundle structure + symlinks).
APP="dist/DCF Valuation Studio.app"
ZIP="dist/DCF-Valuation-Studio-$NEW_VERSION.zip"
rm -f "$ZIP"
/usr/bin/ditto -c -k --keepParent "$APP" "$ZIP"
echo "→ Packaged: $ZIP"

# 4) Commit + tag.
git add -A
git commit -m "Release v$NEW_VERSION" >/dev/null 2>&1 || true
git tag -f "v$NEW_VERSION"

# 5) Publish to GitHub Releases.
if command -v gh >/dev/null 2>&1; then
  git push origin HEAD
  git push -f origin "v$NEW_VERSION"
  gh release create "v$NEW_VERSION" "$ZIP" --title "v$NEW_VERSION" \
      --notes "DCF Valuation Studio v$NEW_VERSION" \
    || gh release upload "v$NEW_VERSION" "$ZIP" --clobber
  echo ""
  echo "✓ Published v$NEW_VERSION — installed apps will now offer this update."
else
  echo ""
  echo "✓ Built & tagged v$NEW_VERSION. 'gh' (GitHub CLI) isn't installed, so publish manually:"
  echo "    • Easiest:  brew install gh && gh auth login   then re-run ./release.sh $NEW_VERSION"
  echo "    • Or:       git push origin HEAD && git push origin v$NEW_VERSION"
  echo "                then on GitHub → Releases → Draft new release → tag v$NEW_VERSION"
  echo "                → attach $ZIP → Publish."
fi
