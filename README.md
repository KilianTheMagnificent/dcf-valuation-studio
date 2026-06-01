# DCF Valuation Studio

Automated **discounted cash-flow (DCF) valuation** for any public company. Type a
ticker and the app pulls the financial statements automatically from Yahoo
Finance, builds a full unlevered-FCF model with sensible default assumptions,
then lets you adjust every judgment-call variable with live, instant
recalculation.

---

## Desktop app (macOS) — run it like a native app

No browser, no terminal — its own window and Dock icon.

```bash
./build_app.sh
```

This produces a fully self-contained **`dist/DCF Valuation Studio.app`** (~85 MB) with
an embedded Python, every library, and the frontend baked in — it needs **no Python or
Node installed to run**. Then:

- **Launch:** double-click the app, or `open "dist/DCF Valuation Studio.app"`
- **Install:** drag it into `/Applications`

It opens a native macOS window (Apple's built-in WebKit) and runs its data server
privately inside the app. *Building* the bundle still needs Python 3.9+ and Node 18+
(one-time). The app is **ad-hoc signed**, so the Mac that built it runs it directly; if
you copy it to **another** Mac, Gatekeeper blocks it the first time — right-click →
**Open** → **Open**, or run
`xattr -dr com.apple.quarantine "DCF Valuation Studio.app"`.

---

## Keeping it updated

The app **checks GitHub for a newer version on launch** and shows an "Update available"
banner — click **Update & restart** and it downloads the new version, swaps itself in,
and relaunches (no reinstalling). The footer always shows the current version and a
**Check for updates** link.

### One-time setup (enables auto-update)
Updates are delivered through your own **GitHub Releases**:

1. Create an empty GitHub repo, e.g. `dcf-valuation-studio`.
2. Point this project at it:
   ```bash
   git remote add origin https://github.com/<you>/dcf-valuation-studio.git
   ```
3. *(recommended)* install the GitHub CLI so publishing is one command:
   ```bash
   brew install gh && gh auth login
   ```

### Publishing a new version
After making changes:

```bash
./release.sh 1.1.0
```

This bumps the version, bakes in your repo, builds + zips the `.app`, tags the commit,
and creates a GitHub Release with the zip attached. Every installed copy then offers the
update. (Without `gh` it builds + tags and prints the manual upload steps.)

> The first release bakes your repo into the app, so **install that build** (drag to
> `/Applications`) — from then on it updates itself.

---

## Run in the browser (developer mode)

For development with hot-reload, run the two servers instead:

```bash
./run.sh
```

The script creates the Python virtual environment, installs all dependencies (first
run only), starts both servers, and opens your browser at **http://localhost:5173**.

Press **Ctrl+C** to stop.

### Prerequisites
- **Python 3.9+** (for the data backend)
- **Node.js 18+** (for the React frontend)

### Running manually (two terminals)

```bash
# Terminal 1 — backend (financial-data API)
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --port 8000

# Terminal 2 — frontend
cd frontend
npm install
npm run dev          # → http://localhost:5173
```

---

## What it does

1. **Auto-fetches the hard data** — revenue, EBIT, EBITDA, D&A, capex,
   working-capital changes, debt, cash, shares outstanding and the live price come
   straight from Yahoo Finance (no API key). These objective facts are shown
   **read-only** in a locked "Reported data" panel — they're not analyst judgment,
   so they can't be edited.
2. **Seeds the assumptions from aggregated analyst consensus** — forward revenue
   growth comes from Wall-Street consensus estimates, the risk-free rate from the
   live 10-year Treasury (`^TNX`), beta from the market, and margins / tax /
   reinvestment intensity from the company's own filings. Every default shows its
   provenance (analyst · market · filings).
3. **Lets you override every judgment call** — anything that's "up to
   interpretation" is an editable slider seeded with a sensible, market-informed
   default, and the valuation recomputes instantly. The analyst consensus price
   target is shown alongside your intrinsic value as a benchmark.

### The model

Unlevered free cash flow:

```
FCFF = EBIT·(1 − tax) + D&A − Capex − ΔNet Working Capital
EV   = Σ PV(FCFF_t) + PV(Terminal Value)
Equity value = EV − Net Debt
Fair value / share = Equity value ÷ Shares outstanding
```

### Adjustable assumptions
| Group | Variables |
|-------|-----------|
| **Growth** | Per-year revenue growth (editable each year, with a smooth year-1→terminal fade), projection horizon (3–10 yrs) |
| **Profitability** | Operating (EBIT) margin — year 1 *and* terminal (linear fade), tax rate |
| **Reinvestment** | D&A %, capex %, Δ net working capital (% of revenue change) |
| **WACC (CAPM)** | Risk-free rate, equity risk premium, beta, pre-tax cost of debt — weighted by market capital structure |
| **Terminal value** | Gordon perpetuity growth **or** exit EV/EBITDA multiple (or the average), with cross-checks (implied multiple ↔ implied growth) |
| **Convention** | Mid-year discounting toggle |

### Outputs
- **Intrinsic value per share** with upside/downside vs. the live market price
- **Enterprise → equity value bridge**
- **Scenario range** — auto-perturbed bear / base / bull cases on a football-field chart
- **Year-by-year cash-flow projection** table
- **2-D sensitivity heatmap** — WACC × perpetuity growth (or × exit multiple)
- **History & forecast charts** — revenue, free cash flow, margin trend, value composition

---

## How it's built

```
DCF App/
├── run.sh                  # browser/dev launcher (two servers)
├── build_app.sh            # builds the standalone macOS .app
├── dcf.spec                # PyInstaller bundle definition
├── build_assets/           # app-icon generator (make_icon.py → icon.icns)
├── backend/                # Python · FastAPI — fetches data only
│   ├── main.py             #   API endpoints (/api/company/{ticker})
│   ├── data_provider.py    #   yfinance + analyst-consensus extraction, default derivation
│   ├── desktop.py          #   native-app entry: serves frontend+API, opens WebKit window
│   ├── requirements.txt    #   runtime deps
│   └── requirements-desktop.txt  # build-only deps (pywebview, pyinstaller, Pillow)
└── frontend/               # React + TypeScript (Vite)
    └── src/
        ├── dcf.ts          #   the DCF engine (runs client-side)
        ├── App.tsx         #   layout & state
        └── components/     #   reported-data, analyst-consensus, WACC, sensitivity, charts …
```

The DCF math lives entirely in the **frontend** (`src/dcf.ts`), so moving a slider
recalculates instantly with no server round-trip. The **backend** only fetches and
normalises financial data.

- In **dev mode**, the Vite dev server proxies `/api` to FastAPI (two processes).
- In the **packaged app**, `desktop.py` runs FastAPI in a background thread serving
  *both* the API and the built frontend on one private port, and points a native
  pywebview (WKWebView) window at it — so there's no browser, no proxy, and no Node.

---

## Notes & limitations

- **Data source:** Yahoo Finance (via `yfinance`). It's free and needs no key, but
  data can occasionally be delayed, rate-limited, or have gaps. Warnings appear in
  the app when a field had to be defaulted.
- **Best for** profitable, non-financial operating companies. Banks, insurers and
  pre-profit firms have cash-flow dynamics a standard unlevered DCF doesn't capture.
- **International tickers** work — use Yahoo's suffix format (e.g. `SAP.DE`,
  `7203.T`, `NESN.SW`).
- This is an analytical tool, **not investment advice**. A DCF is only as good as
  its assumptions — the whole point of the sliders is to make that explicit.
