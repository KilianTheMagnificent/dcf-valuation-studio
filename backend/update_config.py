"""Auto-update configuration.

GITHUB_REPO is the "owner/repo" the app checks for new releases. `release.sh`
fills `_BAKED_REPO` in automatically from your git remote when you publish; you
can also set it by hand, or override at runtime with the DCF_UPDATE_REPO env var.
Leave it empty to disable update checks (the app just won't look for updates).
"""
import os

# release.sh rewrites the line below with your repo slug, e.g. "yourname/dcf-valuation-studio".
_BAKED_REPO = "KilianTheMagnificent/dcf-valuation-studio"

GITHUB_REPO = (os.environ.get("DCF_UPDATE_REPO", "").strip() or _BAKED_REPO).strip()
