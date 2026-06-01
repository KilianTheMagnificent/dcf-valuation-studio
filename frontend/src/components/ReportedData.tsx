import React from 'react'
import type { CompanyData } from '../types'
import { fmtCompact, fmtMoney, fmtPct } from '../format'

// Hard facts pulled straight from filings / the market. These are NOT analyst
// judgment, so they're shown read-only and cannot be edited.
export function ReportedData({ data }: { data: CompanyData }) {
  const cur = data.currency
  const mc = data.marketCap ?? 0
  const v = mc + data.totalDebt
  const we = v > 0 ? mc / v : 1
  const wd = v > 0 ? data.totalDebt / v : 0
  const ebitda = lastNonNull(data.history.ebitda)

  const rows: [string, string][] = [
    ['Share price', fmtMoney(data.price, cur)],
    ['Market capitalisation', fmtCompact(data.marketCap, cur)],
    ['Shares outstanding', fmtCompact(data.sharesOutstanding, '')],
    [`Base revenue (FY${data.fiscalYearEnd ?? '—'})`, fmtCompact(data.defaults.baseRevenue, cur)],
    [`Latest EBITDA`, fmtCompact(ebitda, cur)],
    ['Total debt', fmtCompact(data.totalDebt, cur)],
    ['Cash & investments', fmtCompact(data.cash, cur)],
    ['Net debt', fmtCompact(data.netDebt, cur)],
    ['Capital weights (E / D)', `${fmtPct(we, 0)} / ${fmtPct(wd, 0)}`],
  ]

  return (
    <div className="card locked">
      <div className="card-title">
        <span>🔒 Reported data</span>
        <span className="hint">objective facts · read-only</span>
      </div>
      <div className="facts">
        {rows.map(([k, val]) => (
          <div className="fact" key={k}>
            <span className="fk">{k}</span>
            <span className="fv num">{val}</span>
          </div>
        ))}
      </div>
      <div className="locked-note">
        Sourced from company filings &amp; live market data — not subject to analyst
        judgment, so these are fixed.
      </div>
    </div>
  )
}

function lastNonNull(arr: (number | null)[]): number | null {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i]
  return null
}
