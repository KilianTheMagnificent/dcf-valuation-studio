import React, { useEffect, useMemo, useState } from 'react'
import type { Assumptions, CompanyData } from './types'
import { fetchCompany, checkUpdate, applyUpdate, type UpdateInfo } from './api'
import { buildDefaultAssumptions, runDcf } from './dcf'
import { CompanyHeader } from './components/CompanyHeader'
import { ReportedData } from './components/ReportedData'
import { AnalystConsensus } from './components/AnalystConsensus'
import { AssumptionsPanel } from './components/AssumptionsPanel'
import { WaccBuilder } from './components/WaccBuilder'
import { TerminalPanel } from './components/TerminalPanel'
import { ValuationSummary } from './components/ValuationSummary'
import { ScenarioBar } from './components/ScenarioBar'
import { ProjectionTable } from './components/ProjectionTable'
import { SensitivityTable } from './components/SensitivityTable'
import { HistoryCharts } from './components/HistoryCharts'
import { UpdateBanner } from './components/UpdateBanner'

const EXAMPLES = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'KO']

export default function App() {
  const [ticker, setTicker] = useState('')
  const [data, setData] = useState<CompanyData | null>(null)
  const [assumptions, setAssumptions] = useState<Assumptions | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [applying, setApplying] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [checkMsg, setCheckMsg] = useState<string | null>(null)

  // Check for a newer release once on launch (silent if none / not configured).
  useEffect(() => {
    checkUpdate().then(setUpdateInfo).catch(() => {})
  }, [])

  async function handleApply() {
    setApplying(true)
    setUpdateError(null)
    try {
      await applyUpdate() // app downloads the update, then quits & relaunches itself
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
    setTicker(s)
    setLoading(true)
    setError(null)
    try {
      const d = await fetchCompany(s)
      setData(d)
      setAssumptions(buildDefaultAssumptions(d))
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
  const reset = () => data && setAssumptions(buildDefaultAssumptions(data))

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
            load(ticker)
          }}
        >
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="TICKER (e.g. AAPL)"
            spellCheck={false}
            autoFocus
          />
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Loading…' : 'Value it'}
          </button>
        </form>
      </header>

      <UpdateBanner info={updateInfo} applying={applying} error={updateError} onApply={handleApply} />

      <div className="container">
        {!data && !loading && !error && <EmptyState onPick={load} />}
        {loading && (
          <div className="empty">
            <div className="spinner" />
            <div>Pulling financial statements for <strong>{ticker}</strong>…</div>
          </div>
        )}
        {error && (
          <div className="error-box">
            <strong>Couldn’t load {ticker}.</strong> {error}
          </div>
        )}

        {data && assumptions && result && (
          <>
            <CompanyHeader data={data} />
            {data.warnings.length > 0 && (
              <div className="card" style={{ padding: '12px 16px' }}>
                {data.warnings.map((w, i) => (
                  <div className="note info" key={i} style={{ marginTop: i ? 8 : 0 }}>
                    <span className="ic">ℹ</span>
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="layout" style={{ marginTop: 4 }}>
              <div className="col-controls">
                <ReportedData data={data} />
                <AssumptionsPanel a={assumptions} update={update} sources={data.defaultSources} />
                <WaccBuilder a={assumptions} update={update} sources={data.defaultSources} />
                <TerminalPanel a={assumptions} update={update} result={result} currency={data.currency} />
                <button className="btn" onClick={reset}>↺ Reset to data-derived defaults</button>
              </div>

              <div className="col-output">
                <ValuationSummary result={result} data={data} />
                <AnalystConsensus analyst={data.analyst} price={data.price} currency={data.currency} />
                <ScenarioBar a={assumptions} startFiscalYear={startFY} price={data.price} currency={data.currency} analystTarget={data.analyst?.priceTarget?.mean ?? null} />
                <ProjectionTable result={result} currency={data.currency} />
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

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="empty">
      <div className="big">Value any public company in seconds</div>
      <div>
        Enter a ticker and the app pulls the financials automatically, builds a full
        discounted-cash-flow model, then lets you adjust every assumption live.
      </div>
      <div className="examples">
        {EXAMPLES.map((s) => (
          <div className="ex-chip" key={s} onClick={() => onPick(s)}>
            {s}
          </div>
        ))}
      </div>
    </div>
  )
}
