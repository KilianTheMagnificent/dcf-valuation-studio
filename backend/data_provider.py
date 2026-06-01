"""
Pulls raw financials from Yahoo Finance (via yfinance) and derives sensible
default DCF assumptions. The heavy DCF math itself lives in the React frontend
so that adjusting a slider recalculates instantly without a server round-trip;
this module's job is purely: fetch hard data + suggest starting assumptions.

Sign conventions used throughout:
  * Revenue, EBIT, EBITDA, D&A are positive.
  * Capex is stored as a POSITIVE magnitude (Yahoo reports it negative).
  * "increaseNwc" is the cash INVESTED in working capital (positive = cash used).
    Yahoo's cash-flow "Change In Working Capital" is the opposite sign, so we flip it.
"""
from __future__ import annotations

import math
import time
from statistics import median
from typing import Optional

import pandas as pd
import yfinance as yf


# --------------------------------------------------------------------------- #
# Low-level extraction helpers
# --------------------------------------------------------------------------- #
def _row(df: Optional[pd.DataFrame], *names: str) -> Optional[pd.Series]:
    """First matching row (by label) from a yfinance statement DataFrame."""
    if df is None or not hasattr(df, "index") or df.empty:
        return None
    for n in names:
        if n in df.index:
            return df.loc[n]
    return None


def _latest(df: Optional[pd.DataFrame], *names: str) -> Optional[float]:
    """Most recent (left-most column) value for the first matching label."""
    s = _row(df, *names)
    if s is None:
        return None
    s = s.dropna()
    if not len(s):
        return None
    try:
        return float(s.iloc[0])
    except (TypeError, ValueError):
        return None


def _series(df: Optional[pd.DataFrame], *names: str) -> list[tuple[int, float]]:
    """Chronological [(year, value)] for the first matching label (oldest first)."""
    s = _row(df, *names)
    if s is None:
        return []
    out: list[tuple[int, float]] = []
    for col, val in s.items():
        if pd.isna(val):
            continue
        year = getattr(col, "year", None)
        if year is None:
            try:
                year = int(str(col)[:4])
            except ValueError:
                continue
        try:
            out.append((int(year), float(val)))
        except (TypeError, ValueError):
            continue
    out.sort(key=lambda x: x[0])
    return out


def _clamp(x: Optional[float], lo: float, hi: float,
           fallback: Optional[float] = None) -> Optional[float]:
    if x is None or (isinstance(x, float) and (math.isnan(x) or math.isinf(x))):
        return fallback
    return max(lo, min(hi, x))


def _safe_div(a: Optional[float], b: Optional[float]) -> Optional[float]:
    if a is None or b is None or b == 0:
        return None
    return a / b


def _num(x) -> Optional[float]:
    """Coerce to a finite float, or None (handles NaN/None/strings)."""
    try:
        if x is None:
            return None
        f = float(x)
        return None if (math.isnan(f) or math.isinf(f)) else f
    except (TypeError, ValueError):
        return None


# --------------------------------------------------------------------------- #
# Analyst consensus + market data (the "aggregated analyst data" seeds)
# --------------------------------------------------------------------------- #
_RF_CACHE: dict = {"value": None, "ts": 0.0}


def _fetch_risk_free(fallback: float = 0.043) -> tuple[float, bool]:
    """Current US 10-year Treasury yield (^TNX) as a decimal. Returns (rate, is_live).

    Cached for an hour — the long bond doesn't move enough intraday to matter and
    it spares every request an extra network round-trip.
    """
    now = time.time()
    cached = _RF_CACHE.get("value")
    if cached is not None and now - _RF_CACHE.get("ts", 0.0) < 3600:
        return cached, True
    try:
        tnx = yf.Ticker("^TNX")
        px = None
        try:
            px = tnx.fast_info.get("lastPrice")
        except Exception:  # noqa: BLE001
            px = None
        if px is None:
            try:
                px = (tnx.info or {}).get("regularMarketPrice")
            except Exception:  # noqa: BLE001
                px = None
        px = _num(px)
        if px is not None:
            rate = px / 100.0  # ^TNX is quoted directly as a percent (e.g. 4.45)
            if 0.005 <= rate <= 0.10:  # sanity band for a 10y yield
                _RF_CACHE["value"] = rate
                _RF_CACHE["ts"] = now
                return rate, True
    except Exception:  # noqa: BLE001
        pass
    return fallback, False


def _fetch_analyst(tk, info: dict) -> dict:
    """Aggregate Wall-Street consensus from Yahoo: price targets + growth estimates."""
    out: dict = {
        "available": False,
        "priceTarget": None,
        "revenueGrowthY1": None,   # consensus revenue growth, current FY
        "revenueGrowthY2": None,   # consensus revenue growth, next FY
        "epsGrowthY1": None,
        "epsGrowthY2": None,
        "longTermGrowth": None,
        "numAnalysts": _num(info.get("numberOfAnalystOpinions")),
        "recommendation": info.get("recommendationKey"),
        "recommendationMean": _num(info.get("recommendationMean")),
    }

    # --- Price targets --------------------------------------------------------
    pt = None
    try:
        pt = tk.analyst_price_targets
    except Exception:  # noqa: BLE001
        pt = None
    if isinstance(pt, dict) and _num(pt.get("mean")):
        out["priceTarget"] = {k: _num(pt.get(k)) for k in ("mean", "median", "high", "low")}
    elif _num(info.get("targetMeanPrice")):
        out["priceTarget"] = {
            "mean": _num(info.get("targetMeanPrice")),
            "median": _num(info.get("targetMedianPrice")),
            "high": _num(info.get("targetHighPrice")),
            "low": _num(info.get("targetLowPrice")),
        }

    def _growth_from(df, period: str) -> Optional[float]:
        try:
            if df is not None and hasattr(df, "index") and period in df.index \
                    and "growth" in df.columns:
                return _num(df.loc[period, "growth"])
        except Exception:  # noqa: BLE001
            return None
        return None

    # --- Forward revenue growth (the main seed for the projection) ------------
    try:
        re = tk.revenue_estimate
        out["revenueGrowthY1"] = _growth_from(re, "0y")
        out["revenueGrowthY2"] = _growth_from(re, "+1y")
    except Exception:  # noqa: BLE001
        pass

    # --- Forward EPS growth (fallback proxy if revenue estimates are missing) --
    try:
        ee = tk.earnings_estimate
        out["epsGrowthY1"] = _growth_from(ee, "0y")
        out["epsGrowthY2"] = _growth_from(ee, "+1y")
    except Exception:  # noqa: BLE001
        pass

    # --- Long-term (5y) growth estimate, if published -------------------------
    try:
        ge = tk.growth_estimates
        if ge is not None and hasattr(ge, "index") and len(getattr(ge, "columns", [])):
            col = "stockTrend" if "stockTrend" in ge.columns else ge.columns[0]
            for key in ("+5y", "LTG", "5y"):
                if key in ge.index:
                    v = _num(ge.loc[key, col])
                    if v is not None:
                        out["longTermGrowth"] = v
                        break
    except Exception:  # noqa: BLE001
        pass

    out["available"] = bool(
        out["priceTarget"] or out["revenueGrowthY1"] is not None
        or out["epsGrowthY1"] is not None
    )
    return out


# --------------------------------------------------------------------------- #
# Main entry point
# --------------------------------------------------------------------------- #
def get_company_dcf_data(ticker: str) -> dict:
    """Fetch financials for `ticker` and return a JSON-ready dict.

    Raises ValueError with a friendly message if the ticker looks invalid or
    Yahoo returned no usable financial statements.
    """
    ticker = ticker.strip().upper()
    if not ticker:
        raise ValueError("No ticker provided.")

    tk = yf.Ticker(ticker)

    # `.info` is the richest source but occasionally flaky/rate-limited; never
    # let a failure here sink the whole request.
    info: dict = {}
    try:
        info = tk.info or {}
    except Exception:  # noqa: BLE001
        info = {}

    fast: dict = {}
    try:
        fi = tk.fast_info
        fast = {k: fi[k] for k in fi.keys()}
    except Exception:  # noqa: BLE001
        fast = {}

    try:
        income = tk.income_stmt
        balance = tk.balance_sheet
        cash = tk.cashflow
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"Could not download financial statements for '{ticker}': {exc}")

    # We need an income statement (revenue) to run any DCF.
    rev_series = _series(income, "Total Revenue", "Operating Revenue")
    has_price = (info.get("regularMarketPrice") or info.get("currentPrice")
                 or fast.get("lastPrice"))
    if not rev_series:
        if not has_price:
            raise ValueError(
                f"'{ticker}' did not return any data from Yahoo Finance. "
                "Double-check the ticker symbol (e.g. AAPL, MSFT, BRK-B, SAP.DE)."
            )
        # Valid security, but no financial statements (ETF, fund, index, etc.).
        raise ValueError(
            f"'{ticker}' has no income statement on Yahoo Finance — it looks like an "
            "ETF, fund, index or other non-operating security. This tool values "
            "individual operating companies that report revenue and cash flows."
        )

    warnings: list[str] = []

    # ----- Identity / market data ------------------------------------------- #
    name = info.get("longName") or info.get("shortName") or ticker
    sector = info.get("sector")
    industry = info.get("industry")
    currency = info.get("currency") or fast.get("currency") or "USD"

    price = (info.get("currentPrice") or info.get("regularMarketPrice")
             or fast.get("lastPrice"))
    market_cap = info.get("marketCap") or fast.get("marketCap")
    shares = (info.get("sharesOutstanding") or fast.get("shares")
              or _latest(balance, "Ordinary Shares Number", "Share Issued")
              or _latest(income, "Diluted Average Shares", "Basic Average Shares"))
    if not shares and market_cap and price:
        shares = market_cap / price
        warnings.append("Shares outstanding inferred from market cap / price.")

    beta = info.get("beta")
    if beta is None:
        beta = 1.0
        warnings.append("Beta not reported by Yahoo; defaulted to 1.0.")

    # ----- Balance-sheet items ---------------------------------------------- #
    total_debt = _latest(balance, "Total Debt") or info.get("totalDebt") or 0.0
    cash_st = (_latest(balance, "Cash Cash Equivalents And Short Term Investments",
                       "Cash And Cash Equivalents")
               or info.get("totalCash") or 0.0)
    net_debt = total_debt - cash_st

    enterprise_value = info.get("enterpriseValue")
    if enterprise_value is None and market_cap is not None:
        enterprise_value = market_cap + net_debt

    # ----- Historical statement series (chronological) ---------------------- #
    ebit_series = _series(income, "EBIT", "Operating Income",
                          "Total Operating Income As Reported")
    ebitda_series = _series(income, "EBITDA", "Normalized EBITDA")
    netinc_series = _series(income, "Net Income", "Net Income Common Stockholders")
    da_series = _series(cash, "Depreciation And Amortization",
                        "Depreciation Amortization Depletion")
    if not da_series:
        da_series = _series(income, "Reconciled Depreciation")
    capex_series_raw = _series(cash, "Capital Expenditure", "Purchase Of PPE")
    fcf_series = _series(cash, "Free Cash Flow")
    cwc_series = _series(cash, "Change In Working Capital")  # Yahoo sign (flip later)

    rev_map = dict(rev_series)
    years = [y for y, _ in rev_series]

    def aligned(series: list[tuple[int, float]]) -> list[Optional[float]]:
        d = dict(series)
        return [d.get(y) for y in years]

    revenue = [rev_map[y] for y in years]
    ebit = aligned(ebit_series)
    ebitda = aligned(ebitda_series)
    net_income = aligned(netinc_series)
    da = aligned(da_series)
    capex = [(-v if v is not None else None) for v in aligned(capex_series_raw)]  # -> positive
    fcf = aligned(fcf_series)
    # Increase in NWC = -(Yahoo change in working capital)
    increase_nwc = [(-v if v is not None else None) for v in aligned(cwc_series)]
    ebit_margin = [(_safe_div(e, r)) for e, r in zip(ebit, revenue)]

    history = {
        "years": years,
        "revenue": revenue,
        "ebit": ebit,
        "ebitda": ebitda,
        "netIncome": net_income,
        "da": da,
        "capex": capex,
        "increaseNwc": increase_nwc,
        "fcf": fcf,
        "ebitMargin": ebit_margin,
    }

    # ----- Suitability checks + warnings ------------------------------------ #
    if not revenue or revenue[-1] is None or revenue[-1] <= 0:
        raise ValueError(
            f"'{ticker}' has no usable revenue figures on Yahoo Finance, so a DCF "
            "can't be built (common for funds, holding vehicles, or companies with "
            "incomplete filings)."
        )

    latest_ebit = next((v for v in reversed(ebit) if v is not None), None)
    latest_ni = next((v for v in reversed(net_income) if v is not None), None)
    if (sector or "") == "Financial Services":
        warnings.append(
            f"{name} is in Financial Services — banks, insurers and asset managers "
            "don't fit an unlevered free-cash-flow DCF (their 'debt' is operating "
            "funding). Treat this valuation with heavy skepticism."
        )
    if (latest_ebit is not None and latest_ebit < 0) or (latest_ni is not None and latest_ni < 0):
        warnings.append(
            f"{ticker} reported a loss in its latest fiscal year — FCF-based DCF is "
            "unreliable for unprofitable companies, so the fair value may come out "
            "negative or meaningless. Adjust the margin/growth assumptions to model "
            "a path to profitability."
        )

    # ----- Aggregated analyst consensus + live market rate ------------------ #
    analyst = _fetch_analyst(tk, info)
    risk_free, rf_live = _fetch_risk_free()

    # ----- Derive default assumptions --------------------------------------- #
    defaults, default_sources = _derive_defaults(
        income=income, years=years, revenue=revenue, ebit=ebit, da=da,
        capex=capex, increase_nwc=increase_nwc, ebitda=ebitda,
        beta=beta, total_debt=total_debt, enterprise_value=enterprise_value,
        analyst=analyst, risk_free=risk_free, rf_live=rf_live,
        warnings=warnings,
    )

    return {
        "ticker": ticker,
        "name": name,
        "sector": sector,
        "industry": industry,
        "currency": currency,
        "price": price,
        "marketCap": market_cap,
        "sharesOutstanding": shares,
        "beta": beta,
        "enterpriseValue": enterprise_value,
        "totalDebt": total_debt,
        "cash": cash_st,
        "netDebt": net_debt,
        "fiscalYearEnd": years[-1] if years else None,
        "history": history,
        "defaults": defaults,
        "defaultSources": default_sources,
        "analyst": analyst,
        "warnings": warnings,
    }


def _mean(vals: list[Optional[float]]) -> Optional[float]:
    clean = [v for v in vals if v is not None and not math.isnan(v)]
    return sum(clean) / len(clean) if clean else None


def _derive_defaults(*, income, years, revenue, ebit, da, capex, increase_nwc,
                     ebitda, beta, total_debt, enterprise_value,
                     analyst: dict, risk_free: float, rf_live: bool,
                     warnings: list[str]) -> tuple[dict, dict]:
    base_revenue = revenue[-1] if revenue else None

    # Revenue CAGR over the available window (oldest -> newest).
    revenue_cagr = None
    rev_clean = [r for r in revenue if r is not None and r > 0]
    if len(rev_clean) >= 2 and rev_clean[0] > 0:
        n = len(rev_clean) - 1
        revenue_cagr = (rev_clean[-1] / rev_clean[0]) ** (1 / n) - 1
    if revenue_cagr is None:
        revenue_cagr = 0.05
        warnings.append("Revenue history insufficient; default growth set to 5%.")
    revenue_cagr = _clamp(revenue_cagr, -0.10, 0.40, 0.05)
    year1_growth = _clamp(revenue_cagr, -0.05, 0.30, 0.05)

    # EBIT (operating) margin: latest, with sanity fallback to historical mean.
    margins = [m for m in (_safe_div(e, r) for e, r in zip(ebit, revenue))
               if m is not None]
    ebit_margin = margins[-1] if margins else _mean(margins)
    if ebit_margin is None:
        ebit_margin = 0.15
        warnings.append("Operating margin not found; defaulted to 15%.")
    ebit_margin = _clamp(ebit_margin, -0.50, 0.80, 0.15)

    # Effective tax rate.
    tax_provision = _latest(income, "Tax Provision")
    pretax = _latest(income, "Pretax Income")
    tax_rate = _safe_div(tax_provision, pretax)
    if tax_rate is None or tax_rate < 0 or tax_rate > 0.45:
        tax_rate = _latest(income, "Tax Rate For Calcs")
    tax_rate = _clamp(tax_rate, 0.0, 0.40, 0.21)

    # D&A and Capex as % of revenue (historical averages).
    da_ratios = [_safe_div(d, r) for d, r in zip(da, revenue)]
    capex_ratios = [_safe_div(c, r) for c, r in zip(capex, revenue)]
    da_pct = _clamp(_mean(da_ratios), 0.0, 0.30, 0.04)
    capex_pct = _clamp(_mean(capex_ratios), 0.0, 0.30, 0.04)

    # ΔNWC as % of the change in revenue (incremental working-capital intensity).
    nwc_ratios = []
    for i in range(1, len(revenue)):
        d_rev = (revenue[i] or 0) - (revenue[i - 1] or 0)
        inc = increase_nwc[i]
        if inc is not None and abs(d_rev) > 1e-6:
            nwc_ratios.append(inc / d_rev)
    nwc_pct = median(nwc_ratios) if nwc_ratios else 0.0
    # Historical WC ratios are noisy; keep the DEFAULT in a mild band so a
    # working-capital tailwind can't silently inflate the base valuation. The
    # frontend slider still allows the full -25%..+40% range for manual input.
    if nwc_ratios and (nwc_pct <= -0.10 or nwc_pct >= 0.30):
        warnings.append(
            "Working-capital history is volatile; the ΔNWC default was capped — "
            "review this assumption."
        )
    nwc_pct = _clamp(nwc_pct, -0.10, 0.30, 0.0)

    # Cost of debt = interest expense / total debt.
    interest_expense = _latest(income, "Interest Expense",
                               "Interest Expense Non Operating")
    cost_of_debt = _safe_div(interest_expense, total_debt)
    cost_of_debt = _clamp(cost_of_debt, 0.01, 0.15, 0.045)

    # Exit EV/EBITDA multiple defaults to the company's current multiple.
    latest_ebitda = next((v for v in reversed(ebitda) if v), None)
    if not latest_ebitda and ebit and da:
        e = next((v for v in reversed(ebit) if v), None)
        d = next((v for v in reversed(da) if v), None)
        latest_ebitda = (e or 0) + (d or 0) if (e or d) else None
    exit_multiple = _safe_div(enterprise_value, latest_ebitda)
    exit_multiple = _clamp(exit_multiple, 4.0, 40.0, 10.0)

    # ----- Revenue growth path: anchored on analyst consensus, fading to terminal
    projection_years = 5
    terminal_growth = 0.025

    a_y1 = analyst.get("revenueGrowthY1")
    if a_y1 is None:
        a_y1 = analyst.get("epsGrowthY1")
    a_y2 = analyst.get("revenueGrowthY2")
    if a_y2 is None:
        a_y2 = analyst.get("epsGrowthY2")

    if a_y1 is not None:
        growth_source = "Analyst consensus (Yahoo)"
        y1 = _clamp(a_y1, -0.30, 0.60, year1_growth)
    else:
        growth_source = "Historical revenue CAGR (filings)"
        y1 = year1_growth

    # Anchor the first 1–2 years on consensus, then fade linearly to terminal.
    anchors = [y1]
    if a_y2 is not None:
        anchors.append(_clamp(a_y2, -0.30, 0.60, y1))
    growth_path = list(anchors)
    start_idx, start_val, end_idx = len(anchors) - 1, anchors[-1], projection_years - 1
    for i in range(len(anchors), projection_years):
        frac = (i - start_idx) / (end_idx - start_idx) if end_idx > start_idx else 1.0
        growth_path.append(start_val + (terminal_growth - start_val) * frac)
    growth_path = [round(g, 5) for g in growth_path]

    defaults = {
        "projectionYears": projection_years,
        "baseRevenue": base_revenue,
        "revenueCagr": revenue_cagr,
        "year1Growth": growth_path[0],
        "growthPath": growth_path,
        "ebitMargin": ebit_margin,
        "taxRate": tax_rate,
        "daPct": da_pct,
        "capexPct": capex_pct,
        "nwcPctOfDeltaRev": nwc_pct,
        "riskFree": risk_free,
        "equityRiskPremium": 0.05,
        "beta": beta,
        "costOfDebt": cost_of_debt,
        "terminalGrowth": terminal_growth,
        "exitMultiple": exit_multiple,
    }

    # Provenance of each default, surfaced in the UI so the user can see which
    # numbers are analyst-driven vs. derived from filings vs. assumptions.
    sources = {
        "growth": growth_source,
        "ebitMargin": "Latest reported margin (filings)",
        "taxRate": "Effective tax rate (filings)",
        "daPct": "Historical average (filings)",
        "capexPct": "Historical average (filings)",
        "nwcPctOfDeltaRev": "Historical average (filings)",
        "riskFree": "Live 10Y Treasury · ^TNX" if rf_live else "Estimate (10Y UST)",
        "equityRiskPremium": "Standard assumption (~5%)",
        "beta": "Market estimate (Yahoo)",
        "costOfDebt": "Interest expense ÷ debt (filings)",
        "terminalGrowth": "Long-run assumption (~GDP)",
        "exitMultiple": "Current EV/EBITDA (market)",
    }
    return defaults, sources
