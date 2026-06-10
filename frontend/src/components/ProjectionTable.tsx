import React, { useState } from 'react'
import type { DcfResult } from '../dcf'
import { copyText } from '../clipboard'
import { fmtCompact, fmtPct } from '../format'

interface Props {
  result: DcfResult
  currency: string
  ticker?: string
}

export function ProjectionTable({ result, currency, ticker }: Props) {
  const p = result.projections
  const money = (v: number) => fmtCompact(v, currency)
  const [copied, setCopied] = useState(false)

  // Tab-separated raw values — pastes straight into Excel / Numbers / Sheets.
  async function copyTable() {
    const head = [`${ticker ?? ''} (${currency})`, ...p.map((y) => `FY${y.fiscalYear}`)]
    const raw: [string, (y: (typeof p)[number]) => number][] = [
      ['Revenue', (y) => y.revenue],
      ['Revenue growth', (y) => y.growth],
      ['EBIT', (y) => y.ebit],
      ['Operating margin', (y) => y.ebitMargin],
      ['NOPAT', (y) => y.nopat],
      ['D&A', (y) => y.da],
      ['Capex', (y) => -y.capex],
      ['Change in NWC', (y) => -y.deltaNwc],
      ['Unlevered FCF', (y) => y.fcff],
      ['Discount factor', (y) => y.discountFactor],
      ['PV of FCF', (y) => y.pvFcff],
    ]
    const lines = [head.join('\t')]
    for (const [label, fn] of raw) lines.push([label, ...p.map((y) => String(fn(y)))].join('\t'))
    lines.push(['PV of terminal value', String(result.pvTerminalValue)].join('\t'))
    lines.push(['Enterprise value', String(result.enterpriseValue)].join('\t'))
    lines.push(['Equity value', String(result.equityValue)].join('\t'))
    lines.push(['Fair value per share', String(result.fairValuePerShare)].join('\t'))
    if (await copyText(lines.join('\n'))) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    }
  }

  const rows: { label: string; vals: string[]; emph?: boolean; muted?: boolean }[] = [
    { label: 'Revenue', vals: p.map((y) => money(y.revenue)) },
    { label: 'Revenue growth', vals: p.map((y) => fmtPct(y.growth, 1)), muted: true },
    { label: 'EBIT', vals: p.map((y) => money(y.ebit)) },
    { label: 'Operating margin', vals: p.map((y) => fmtPct(y.ebitMargin, 1)), muted: true },
    { label: 'NOPAT', vals: p.map((y) => money(y.nopat)) },
    { label: '+ D&A', vals: p.map((y) => money(y.da)) },
    { label: '– Capex', vals: p.map((y) => money(-y.capex)) },
    { label: '– Δ NWC', vals: p.map((y) => money(-y.deltaNwc)) },
    { label: 'Unlevered FCF', vals: p.map((y) => money(y.fcff)), emph: true },
    { label: 'Discount factor', vals: p.map((y) => y.discountFactor.toFixed(3)), muted: true },
    { label: 'PV of FCF', vals: p.map((y) => money(y.pvFcff)), emph: true },
  ]

  return (
    <div className="card">
      <div className="card-title">
        Cash-flow projection
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <span className="hint">unlevered FCF, discounted at {fmtPct(result.wacc, 2)}</span>
          <button className={`toolbtn${copied ? ' done' : ''}`} onClick={copyTable}>
            {copied ? '✓ Copied' : '⧉ Copy for Excel'}
          </button>
        </span>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th className="lbl">{currency}</th>
              {p.map((y) => (
                <th key={y.period}>FY{y.fiscalYear}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className={r.emph ? 'emph' : ''}>
                <td className="lbl" style={r.muted ? { color: 'var(--muted)', fontWeight: 500 } : {}}>{r.label}</td>
                {r.vals.map((v, i) => (
                  <td key={i} style={r.muted ? { color: 'var(--muted)' } : {}}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bridge" style={{ marginTop: 12 }}>
        <div className="line">
          <span className="k">Sum of PV of forecast FCF</span>
          <span className="v">{fmtCompact(result.sumPvFcff, currency)}</span>
        </div>
        <div className="line">
          <span className="k">PV of terminal value</span>
          <span className="v">{fmtCompact(result.pvTerminalValue, currency)}</span>
        </div>
        <div className="line total">
          <span className="k">Enterprise value</span>
          <span className="v">{fmtCompact(result.enterpriseValue, currency)}</span>
        </div>
      </div>
    </div>
  )
}
