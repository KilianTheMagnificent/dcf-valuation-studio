"""
FastAPI backend for the DCF valuation app.

Endpoints
  GET  /api/health            -> liveness check
  GET  /api/company/{ticker}  -> hard financial data + suggested DCF assumptions
  GET  /api/version           -> current app version
  GET  /api/update/check      -> is a newer GitHub release available?
  POST /api/update/apply      -> download + install the update, then relaunch

The DCF math runs client-side; this server only fetches data from Yahoo Finance.
Run with:  uvicorn main:app --reload --port 8000
"""
from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from data_provider import get_company_dcf_data
from updater import apply_update, check_for_update
from version import __version__

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("dcf")

app = FastAPI(title="DCF Valuation API", version=__version__)

# The Vite dev server proxies /api to here, but allow direct cross-origin calls
# too (e.g. if the frontend is served from a different port/host).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/company/{ticker}")
def company(ticker: str) -> dict:
    log.info("Fetching DCF data for %s", ticker)
    try:
        return get_company_dcf_data(ticker)
    except ValueError as exc:
        # Expected, user-facing problems (bad ticker, empty data).
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:  # noqa: BLE001
        log.exception("Unexpected error for %s", ticker)
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch data from Yahoo Finance: {exc}",
        )


@app.get("/api/version")
def version() -> dict:
    return {"version": __version__}


@app.get("/api/update/check")
def update_check(force: bool = False) -> dict:
    """Report whether a newer release is available on GitHub."""
    return check_for_update(force=force)


@app.post("/api/update/apply")
def update_apply() -> dict:
    """Download + install the latest release; the app restarts itself."""
    result = apply_update()
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error", "Update failed."))
    return result
