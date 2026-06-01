import React from 'react'
import type { CompanyData } from '../types'
import type { DcfResult } from '../dcf'
import { fmtCompact, fmtMoney, fmtSignedPct } from '../format'

export function ValuationSummary({ result, data }: { result: DcfResult; data: CompanyData }) {
  const cur = data.currency
  const up = result.upside
  const upClass = up == null ? '' : up >= 0 ? 'up' : 'down'
  return (
    <div className="card">
      <div className="card-title">Intrinsic value — your assumptions</div>
      <div className="valuation">
        <div className="headline">
          <span className="fv-label">Fair value / share</span>
          <span className="fv num">{fmtMoney(result.fairValuePerShare, cur)}</span>
          <span className="vs num">
            vs. market price {fmtMoney(result.currentPrice, cur)}
            {data.analyst?.priceTarget?.mean
              ? ` · analyst target ${fmtMoney(data.analyst.priceTarget.mean, cur)}`
              : ''}
          </span>
          {up != null && (
            <span className={`upside-badge ${upClass}`}>
              {up >= 0 ? '▲' : '▼'} {fmtSignedPct(up, 1)}
              <span style={{ fontWeight: 500, fontSize: 12 }}>
                {up >= 0 ? 'undervalued' : 'overvalued'}
              </span>
            </span>
          )}
        </div>

        <div className="bridge">
          <div className="line">
            <span className="k">PV of forecast FCF</span>
            <span className="v">{fmtCompact(result.sumPvFcff, cur)}</span>
          </div>
          <div className="line">
            <span className="k">PV of terminal value</span>
            <span className="v">{fmtCompact(result.pvTerminalValue, cur)}</span>
          </div>
          <div className="line total">
            <span className="k">Enterprise value</span>
            <span className="v">{fmtCompact(result.enterpriseValue, cur)}</span>
          </div>
          <div className="line">
            <span className="k">– Net debt</span>
            <span className="v">{fmtCompact(data.netDebt, cur)}</span>
          </div>
          <div className="line total">
            <span className="k">Equity value</span>
            <span className="v">{fmtCompact(result.equityValue, cur)}</span>
          </div>
          <div className="line">
            <span className="k">÷ Shares outstanding</span>
            <span className="v">{fmtCompact(data.sharesOutstanding, '')}</span>
          </div>
        </div>
      </div>

      {result.notes.map((n, i) => (
        <div className="note warn" key={i}>
          <span className="ic">⚠</span>
          <span>{n}</span>
        </div>
      ))}
    </div>
  )
}
