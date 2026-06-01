import React from 'react'
import type { CompanyData } from '../types'
import { fmtCompact, fmtMoney, fmtMultiple } from '../format'

export function CompanyHeader({ data }: { data: CompanyData }) {
  const evEbitda =
    data.enterpriseValue && data.history.ebitda.length
      ? data.enterpriseValue / (lastNonNull(data.history.ebitda) ?? NaN)
      : null
  return (
    <div className="card">
      <div className="company-head">
        <div className="company-id">
          <h2>
            {data.name}
            <span className="chip">{data.ticker}</span>
          </h2>
          <div className="sub">
            {[data.sector, data.industry].filter(Boolean).join(' · ') || '—'}
            {data.fiscalYearEnd ? ` · FY${data.fiscalYearEnd} financials` : ''}
          </div>
        </div>
        <div className="snapshot">
          <Snap k="Price" v={fmtMoney(data.price, data.currency)} />
          <Snap k="Market cap" v={fmtCompact(data.marketCap, data.currency)} />
          <Snap k="Net debt" v={fmtCompact(data.netDebt, data.currency)} />
          <Snap k="Beta" v={data.beta.toFixed(2)} />
          <Snap k="EV / EBITDA" v={evEbitda ? fmtMultiple(evEbitda) : '—'} />
        </div>
      </div>
    </div>
  )
}

function Snap({ k, v }: { k: string; v: string }) {
  return (
    <div className="snap">
      <div className="k">{k}</div>
      <div className="v num">{v}</div>
    </div>
  )
}

function lastNonNull(arr: (number | null)[]): number | null {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i]
  return null
}
