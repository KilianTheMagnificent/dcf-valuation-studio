"""
Self-updater for the packaged macOS app, backed by GitHub Releases.

check_for_update()  -> compares the bundled version to the latest GitHub release.
apply_update()      -> downloads the release's .app zip, swaps it in for the
                       running bundle, and relaunches (macOS can't overwrite a
                       running .app, so a small detached script does the swap
                       after we quit).

Only the packaged app can self-replace; in dev mode the endpoints report that.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
from pathlib import Path
from typing import Optional

from version import __version__
from update_config import GITHUB_REPO

_GITHUB_API = "https://api.github.com/repos/{repo}/releases/latest"
_CACHE: dict = {"ts": 0.0, "result": None}


def is_packaged() -> bool:
    return bool(getattr(sys, "frozen", False))


def bundle_path() -> Optional[Path]:
    """Absolute path to the running .app bundle, or None if not packaged."""
    if not is_packaged():
        return None
    exe = Path(sys.executable).resolve()
    for parent in exe.parents:
        if parent.suffix == ".app":
            return parent
    return None


def _parse_version(v: str) -> tuple:
    """'v1.10.2' -> (1, 10, 2). Non-numeric suffixes are ignored."""
    out = []
    for chunk in (v or "").strip().lstrip("vV").split("."):
        digits = ""
        for ch in chunk:
            if ch.isdigit():
                digits += ch
            else:
                break
        out.append(int(digits) if digits else 0)
    while len(out) < 3:
        out.append(0)
    return tuple(out[:3])


def _is_newer(latest: str, current: str) -> bool:
    return _parse_version(latest) > _parse_version(current)


def check_for_update(force: bool = False) -> dict:
    """Return info about whether a newer release exists. Cached for an hour."""
    now = time.time()
    if not force and _CACHE["result"] is not None and now - _CACHE["ts"] < 3600:
        return _CACHE["result"]

    base = {
        "currentVersion": __version__,
        "packaged": is_packaged(),
        "configured": bool(GITHUB_REPO),
        "available": False,
    }
    if not GITHUB_REPO:
        result = {**base, "reason": "Updates aren’t configured yet (no GitHub repo set)."}
        _CACHE.update(ts=now, result=result)
        return result

    try:
        req = urllib.request.Request(
            _GITHUB_API.format(repo=GITHUB_REPO),
            headers={"Accept": "application/vnd.github+json",
                     "User-Agent": "DCF-Valuation-Studio"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
        latest = (data.get("tag_name") or "").lstrip("vV")
        asset_url = None
        for asset in data.get("assets", []):
            if (asset.get("name") or "").lower().endswith(".zip"):
                asset_url = asset.get("browser_download_url")
                break
        result = {
            **base,
            "available": bool(latest) and _is_newer(latest, __version__) and bool(asset_url),
            "latestVersion": latest or None,
            "downloadUrl": asset_url,
            "releaseNotes": (data.get("body") or "")[:2000],
            "releaseUrl": data.get("html_url"),
        }
    except Exception as exc:  # noqa: BLE001
        result = {**base, "reason": f"Couldn’t reach GitHub to check for updates: {exc}"}

    _CACHE.update(ts=now, result=result)
    return result


# Detached script: wait for the app to quit, swap the bundle, relaunch.
_SWAP_SCRIPT = r"""#!/bin/bash
# args: PID  OLD_APP  NEW_APP  TMPDIR
PID="$1"; OLD="$2"; NEW="$3"; TMP="$4"
for _ in $(seq 1 120); do kill -0 "$PID" 2>/dev/null || break; sleep 0.5; done
sleep 1
rm -rf "$OLD"
/usr/bin/ditto "$NEW" "$OLD" || { /usr/bin/open "$OLD" 2>/dev/null; exit 1; }
/usr/bin/xattr -dr com.apple.quarantine "$OLD" 2>/dev/null
# Relaunch — retry a few times, launchd can be briefly flaky right after the
# previous instance quits.
for _ in 1 2 3 4 5; do /usr/bin/open "$OLD" && break; sleep 2; done
rm -rf "$TMP"
"""


def apply_update() -> dict:
    """Download the latest release and swap it in. The app quits ~1s after this
    returns so the detached swap script can replace the bundle and relaunch."""
    if not is_packaged():
        return {"ok": False, "error": "Self-update only works in the packaged app "
                                      "(in dev mode, just re-run build_app.sh)."}
    target = bundle_path()
    if target is None:
        return {"ok": False, "error": "Couldn’t locate the running app bundle."}

    info = check_for_update(force=True)
    if not info.get("available") or not info.get("downloadUrl"):
        return {"ok": False, "error": "No update is available to install."}
    download_url = info["downloadUrl"]

    # Only download from GitHub for the configured repo (avoid arbitrary URLs).
    if not download_url.startswith("https://github.com/") and \
       not download_url.startswith("https://objects.githubusercontent.com/"):
        return {"ok": False, "error": "Refusing to download update from an unexpected host."}

    try:
        tmp = Path(tempfile.mkdtemp(prefix="dcf_update_"))
        zip_path = tmp / "update.zip"
        req = urllib.request.Request(download_url, headers={"User-Agent": "DCF-Valuation-Studio"})
        with urllib.request.urlopen(req, timeout=180) as resp, open(zip_path, "wb") as f:
            shutil.copyfileobj(resp, f)

        extract = tmp / "extract"
        extract.mkdir()
        # Extract with ditto, NOT Python's zipfile: ditto preserves the framework
        # symlinks inside the .app (e.g. Python3.framework/Versions/Current). zipfile
        # turns those symlinks into plain files, which breaks the bundle's code
        # signature and macOS then refuses to launch it ("Launchd job spawn failed").
        subprocess.run(["/usr/bin/ditto", "-x", "-k", str(zip_path), str(extract)],
                       check=True)

        new_app = next((p for p in extract.rglob("*.app")), None)
        if new_app is None:
            return {"ok": False, "error": "The downloaded update didn’t contain a .app bundle."}

        script = tmp / "swap.sh"
        script.write_text(_SWAP_SCRIPT)
        script.chmod(0o755)
        subprocess.Popen(
            ["/bin/bash", str(script), str(os.getpid()), str(target), str(new_app), str(tmp)],
            start_new_session=True,
        )
        threading.Timer(0.9, lambda: os._exit(0)).start()
        return {"ok": True, "message": f"Installing v{info.get('latestVersion')} — the app will restart."}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": f"Update failed: {exc}"}
