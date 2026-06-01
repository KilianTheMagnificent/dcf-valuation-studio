"""
Native-desktop entry point for DCF Valuation Studio.

Runs the FastAPI app (serving BOTH the API and the built React frontend) on a
private localhost port inside a background thread, then opens a real macOS window
(WKWebView via pywebview) pointing at it — no browser, no Vite, no proxy.

This same file is the entry point PyInstaller freezes into the standalone .app.
Set DCF_HEADLESS=1 to run the server without opening a window (used for tests).
"""
from __future__ import annotations

import os
import socket
import sys
import threading
import time
from pathlib import Path

import uvicorn
from fastapi.staticfiles import StaticFiles

from main import app  # the FastAPI instance (API routes + CORS)


def _webapp_dir() -> Path:
    """Locate the built frontend, whether running from source or a frozen bundle."""
    if getattr(sys, "frozen", False):  # PyInstaller bundle: data added as "webapp"
        return Path(getattr(sys, "_MEIPASS")) / "webapp"
    return Path(__file__).resolve().parent.parent / "frontend" / "dist"


def _free_port() -> int:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


# Serve the static frontend at the root. Mounted AFTER the API routes are defined
# (they were registered when `main` was imported), so /api/* still wins.
webapp = _webapp_dir()
if webapp.is_dir():
    app.mount("/", StaticFiles(directory=str(webapp), html=True), name="webapp")
else:  # pragma: no cover - only hit if the build is missing
    print(f"WARNING: frontend build not found at {webapp}", file=sys.stderr)


def main() -> None:
    port = int(os.environ.get("DCF_PORT") or _free_port())
    url = f"http://127.0.0.1:{port}"

    # Force the dependency-light asyncio/h11 stack so the frozen bundle doesn't
    # need uvloop/httptools/websockets binaries.
    config = uvicorn.Config(app, host="127.0.0.1", port=port,
                            log_level="warning", loop="asyncio", http="h11")
    server = uvicorn.Server(config)
    threading.Thread(target=server.run, daemon=True).start()

    # Wait until the server is actually accepting connections.
    for _ in range(150):
        if getattr(server, "started", False):
            break
        time.sleep(0.1)

    if os.environ.get("DCF_HEADLESS") == "1":
        print(f"[headless] DCF Valuation Studio serving at {url}", flush=True)
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            pass
        return

    import webview  # imported here so headless/test mode needs no GUI libs

    webview.create_window(
        "DCF Valuation Studio",
        url,
        width=1480,
        height=940,
        min_size=(1080, 680),
    )
    webview.start()


if __name__ == "__main__":
    main()
