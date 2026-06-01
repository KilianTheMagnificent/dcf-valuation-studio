import React from 'react'
import type { DcfResult } from '../dcf'
import { fmtCompact, fmtPct } from '../format'

export function ProjectionTable({ result, currency }: { result: DcfResult; currency: string }) {
  const p = result.projections
  const money = (v: number) => fmtCompact(v, currency)

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
        <span className="hint">unlevered free cash flow, discounted at {fmtPct(result.wacc, 2)}</span>
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
