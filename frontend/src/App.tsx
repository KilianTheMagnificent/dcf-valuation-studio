import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { Assumptions, CompanyData } from './types'
import { fetchCompany, checkUpdate, applyUpdate, searchTickers, type UpdateInfo, type SearchResult } from './api'
import { buildDefaultAssumptions, runDcf } from './dcf'
import { useTheme } from './theme'
import { CompanyHeader } from './components/CompanyHeader'
import { ReportedData } from './components/ReportedData'
import { AnalystConsensus } from './components/AnalystConsensus'
import { AssumptionsPanel } from './components/AssumptionsPanel'
import { WaccBuilder } from './components/WaccBuilder'
import { TerminalPanel } from './components/TerminalPanel'
import { ValuationSummary } from './components/ValuationSummary'
import { PricedIn } from './components/PricedIn'
import { ScenarioBar } from './components/ScenarioBar'
import { ProjectionTable } from './components/ProjectionTable'
import { SensitivityTable } from './components/SensitivityTable'
import { HistoryCharts } from './components/HistoryCharts'
import { UpdateBanner } from './components/UpdateBanner'

const EXAMPLES = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'KO']
const RECENTS_KEY = 'dcf.recents'
const SAVED_PREFIX = 'dcf.assumptions.v1.'

function readRecents(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]')
    return Array.isArray(v) ? v.filter((s) => typeof s === 'string').slice(0, 8) : []
  } catch {
    return []
  }
}

function pushRecent(sym: string) {
  const next = [sym, ...readRecents().filter((s) => s !== sym)].slice(0, 8)
  localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
}

// Saved per-ticker assumptions: restore the user's tweaks when they reload a
// ticker, but only if the stored shape is still coherent.
function readSavedAssumptions(ticker: string, defaults: Assumptions): Assumptions | null {
  try {
    const raw = localStorage.getItem(SAVED_PREFIX + ticker)
    if (!raw) return null
    const saved = JSON.parse(raw)
    if (!saved || typeof saved !== 'object') return null
    const merged: Assumptions = { ...defaults, ...saved }
    if (
      !Array.isArray(merged.growthRates) ||
      merged.growthRates.length !== merged.projectionYears ||
      merged.growthRates.some((g: unknown) => typeof g !== 'number' || !Number.isFinite(g))
    ) {
      return null
    }
    return merged
  } catch {
    return null
  }
}

export default function App() {
  const [ticker, setTicker] = useState('')
  const [data, setData] = useState<CompanyData | null>(null)
  const [assumptions, setAssumptions] = useState<Assumptions | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [restored, setRestored] = useState(false)
  const [theme, toggleTheme] = useTheme()

  // Search autocomplete
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const suppressSearch = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Updates
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [applying, setApplying] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [checkMsg, setCheckMsg] = useState<string | null>(null)

  useEffect(() => {
    checkUpdate().then(setUpdateInfo).catch(() => {})
  }, [])

  // ⌘K / Ctrl+K focuses the search field, Esc closes the dropdown.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Debounced company-name search.
  useEffect(() => {
    if (suppressSearch.current) {
      suppressSearch.current = false
      return
    }
    const q = ticker.trim()
    if (q.length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    const t = setTimeout(async () => {
      const r = await searchTickers(q).catch(() => [])
      setResults(r)
      setActiveIdx(-1)
      setOpen(r.length > 0 && document.activeElement === inputRef.current)
    }, 220)
    return () => clearTimeout(t)
  }, [ticker])

  // Autosave the user's assumption tweaks per ticker (debounced).
  useEffect(() => {
    if (!data || !assumptions) return
    const t = setTimeout(() => {
      try {
        localStorage.setItem(SAVED_PREFIX + data.ticker, JSON.stringify(assumptions))
      } catch {
        /* storage full/blocked — non-fatal */
      }
    }, 400)
    return () => clearTimeout(t)
  }, [assumptions, data])

  async function handleApply() {
    setApplying(true)
    setUpdateError(null)
    try {
      await applyUpdate()
    } catch (e: any) {
      setUpdateError(e?.message || 'Update failed.')
      setApplying(false)
    }
  }

  async function handleCheckUpdates() {
    setCheckMsg('Checking…')
    try {
      const info = await checkUpdate(true)
      setUpdateInfo(info)
      setCheckMsg(
        info.available
          ? null
          : info.configured
          ? `You’re on the latest version (v${info.currentVersion}).`
          : 'Auto-update isn’t set up yet.',
      )
    } catch {
      setCheckMsg('Couldn’t check for updates.')
    }
  }

  async function load(sym: string) {
    const s = sym.trim().toUpperCase()
    if (!s) return
    suppressSearch.current = true
    setTicker(s)
    setOpen(false)
    setLoading(true)
    setError(null)
    try {
      const d = await fetchCompany(s)
      const defaults = buildDefaultAssumptions(d)
      const saved = readSavedAssumptions(d.ticker, defaults)
      setData(d)
      setAssumptions(saved ?? defaults)
      setRestored(!!saved)
      pushRecent(d.ticker)
      window.scrollTo(0, 0)
    } catch (e: any) {
      setError(e?.message || 'Failed to load company data.')
      setData(null)
      setAssumptions(null)
    } finally {
      setLoading(false)
    }
  }

  const update = (patch: Partial<Assumptions>) =>
    setAssumptions((prev) => (prev ? { ...prev, ...patch } : prev))

  const reset = () => {
    if (!data) return
    localStorage.removeItem(SAVED_PREFIX + data.ticker)
    setAssumptions(buildDefaultAssumptions(data))
    setRestored(false)
  }

  const pick = (r: SearchResult) => load(r.symbol)

  const onSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => (i <= 0 ? results.length - 1 : i - 1))
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault()
      pick(results[activeIdx])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const startFY = data?.fiscalYearEnd ?? new Date().getFullYear()
  const result = useMemo(
    () => (data && assumptions ? runDcf(assumptions, startFY, data.price) : null),
    [data, assumptions, startFY],
  )

  return (
    <>
      <header className="appbar">
        <div className="brand">
          <div className="logo">∫</div>
          <div>
            <h1>DCF Valuation Studio</h1>
            <div className="tag">Automated discounted cash-flow modelling · data via Yahoo Finance</div>
          </div>
        </div>
        <form
          className="search"
          onSubmit={(e) => {
            e.preventDefault()
            if (open && activeIdx >= 0 && results[activeIdx]) pick(results[activeIdx])
            else load(ticker)
          }}
        >
          <div className="search-wrap">
            <input
              ref={inputRef}
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              onKeyDown={onSearchKeyDown}
              onFocus={() => results.length > 0 && setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 140)}
              placeholder="Ticker or company name   ⌘K"
              spellCheck={false}
              autoFocus
            />
            {open && results.length > 0 && (
              <div className="search-drop">
                {results.map((r, i) => (
                  <div
                    key={r.symbol}
                    className={`sd-item${i === activeIdx ? ' active' : ''}`}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      pick(r)
                    }}
                    onMouseEnter={() => setActiveIdx(i)}
                  >
                    <span className="sd-sym">{r.symbol}</span>
                    <span className="sd-name">{r.name}</span>
                    <span className="sd-exch">{r.exchange}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Loading…' : 'Value it'}
          </button>
        </form>
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? '☀︎' : '☾'}
        </button>
      </header>

      <UpdateBanner info={updateInfo} applying={applying} error={updateError} onApply={handleApply} />

      <div className="container">
        {!data && !loading && !error && <EmptyState onPick={load} recents={readRecents()} />}
        {loading && <LoadingSkeleton ticker={ticker} />}
        {error && !loading && (
          <div className="error-box">
            <span>
              <strong>Couldn’t load {ticker}.</strong> {error}
            </span>
            <button className="btn btn-sm" onClick={() => load(ticker)}>↻ Try again</button>
          </div>
        )}

        {!loading && data && assumptions && result && (
          <>
            <CompanyHeader data={data} />
            {(restored || data.warnings.length > 0) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '12px 0 0' }}>
                {restored && (
                  <div>
                    <span className="restored-chip">
                      ✓ Restored your saved assumptions for {data.ticker}
                      <button onClick={reset}>reset to defaults</button>
                    </span>
                  </div>
                )}
                {data.warnings.map((w, i) => (
                  <div className="note info" key={i} style={{ marginTop: 0 }}>
                    <span className="ic">ℹ</span>
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="layout" style={{ marginTop: 14 }}>
              <div className="col-controls">
                <ReportedData data={data} />
                <AssumptionsPanel a={assumptions} update={update} sources={data.defaultSources} />
                <WaccBuilder a={assumptions} update={update} sources={data.defaultSources} />
                <TerminalPanel a={assumptions} update={update} result={result} currency={data.currency} />
                <button className="btn" onClick={reset}>↺ Reset to data-derived defaults</button>
              </div>

              <div className="col-output">
                <ValuationSummary result={result} data={data} assumptions={assumptions} />
                <PricedIn a={assumptions} startFiscalYear={startFY} price={data.price} />
                <AnalystConsensus analyst={data.analyst} price={data.price} currency={data.currency} />
                <ScenarioBar a={assumptions} startFiscalYear={startFY} price={data.price} currency={data.currency} analystTarget={data.analyst?.priceTarget?.mean ?? null} />
                <ProjectionTable result={result} currency={data.currency} ticker={data.ticker} />
                <SensitivityTable a={assumptions} startFiscalYear={startFY} price={data.price} currency={data.currency} />
                <HistoryCharts data={data} result={result} />
              </div>
            </div>

            <div className="foot">
              Fair value is an estimate driven entirely by the assumptions above — not investment advice.<br />
              Financial data from Yahoo Finance (may be delayed or contain gaps). Best suited to profitable,
              non-financial operating companies; banks, insurers and pre-profit firms need a different model.
            </div>
          </>
        )}

        <div className="app-footer">
          <span>DCF Valuation Studio{updateInfo?.currentVersion ? ` · v${updateInfo.currentVersion}` : ''}</span>
          <button className="ub-link" onClick={handleCheckUpdates}>Check for updates</button>
          {checkMsg && <span className="muted">{checkMsg}</span>}
        </div>
      </div>
    </>
  )
}

function EmptyState({ onPick, recents }: { onPick: (s: string) => void; recents: string[] }) {
  return (
    <div className="empty">
      <div className="big">Value any public company in seconds</div>
      <div className="sub-line">
        Type a ticker or company name — the app pulls the financials and analyst consensus
        automatically, builds a full discounted-cash-flow model, and lets you bend every
        assumption live.
      </div>
      <div className="examples">
        {EXAMPLES.map((s) => (
          <div className="ex-chip" key={s} onClick={() => onPick(s)}>
            {s}
          </div>
        ))}
      </div>
      {recents.length > 0 && (
        <>
          <div className="recents-label">Recently viewed</div>
          <div className="examples" style={{ marginTop: 10 }}>
            {recents.map((s) => (
              <div className="ex-chip" key={s} onClick={() => onPick(s)}>
                {s}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function LoadingSkeleton({ ticker }: { ticker: string }) {
  return (
    <div>
      <div className="skel-status">
        Pulling financial statements &amp; analyst consensus for <strong>{ticker}</strong>…
      </div>
      <div className="skel-card" style={{ marginBottom: 18 }}>
        <div className="skel-line w40" />
        <div className="skel-line w60" style={{ marginBottom: 0 }} />
      </div>
      <div className="skel-grid">
        <div className="skel-col">
          {[0, 1].map((i) => (
            <div className="skel-card" key={i}>
              <div className="skel-line w40" />
              <div className="skel-line w80" />
              <div className="skel-line" />
              <div className="skel-line w60" />
              <div className="skel-line w80" style={{ marginBottom: 0 }} />
            </div>
          ))}
        </div>
        <div className="skel-col">
          <div className="skel-card">
            <div className="skel-line w40" />
            <div className="skel-line lg" />
            <div className="skel-line w60" style={{ marginBottom: 0 }} />
          </div>
          <div className="skel-card">
            <div className="skel-line w40" />
            <div className="skel-line" />
            <div className="skel-line w80" style={{ marginBottom: 0 }} />
          </div>
        </div>
      </div>
    </div>
  )
}
