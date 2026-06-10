import React, { useState } from 'react'
import type { Assumptions, CompanyData } from '../types'
import type { DcfResult } from '../dcf'
import { copyText } from '../clipboard'
import { fmtCompact, fmtMoney, fmtPct, fmtSignedPct } from '../format'

interface Props {
  result: DcfResult
  data: CompanyData
  assumptions: Assumptions
}

export function ValuationSummary({ result, data, assumptions }: Props) {
  const cur = data.currency
  const up = result.upside
  const upClass = up == null ? '' : up >= 0 ? 'up' : 'down'
  const [copied, setCopied] = useState(false)

  async function copySummary() {
    const a = assumptions
    const lines = [
      `DCF Valuation — ${data.name} (${data.ticker}) · ${new Date().toISOString().slice(0, 10)}`,
      `Fair value/share: ${fmtMoney(result.fairValuePerShare, cur)} vs price ${fmtMoney(result.currentPrice, cur)}${up != null ? ` (${fmtSignedPct(up, 1)})` : ''}`,
      `WACC ${fmtPct(result.wacc, 2)} · terminal: ${a.terminalMethod === 'gordon' ? `Gordon ${fmtPct(a.terminalGrowth, 2)}` : a.terminalMethod === 'exit' ? `exit ${a.exitMultiple.toFixed(1)}× EBITDA` : 'avg(Gordon, exit)'} · horizon ${a.projectionYears}y${a.midYear ? ' · mid-year' : ''}`,
      `Growth: ${a.growthRates.map((g) => fmtPct(g, 1)).join(', ')}`,
      `EBIT margin ${fmtPct(a.ebitMargin, 1)}→${fmtPct(a.terminalEbitMargin, 1)} · tax ${fmtPct(a.taxRate, 1)} · D&A ${fmtPct(a.daPct, 1)} · capex ${fmtPct(a.capexPct, 1)} · ΔNWC ${fmtPct(a.nwcPctOfDeltaRev, 1)}`,
      `EV ${fmtCompact(result.enterpriseValue, cur)} = PV FCF ${fmtCompact(result.sumPvFcff, cur)} + PV TV ${fmtCompact(result.pvTerminalValue, cur)} · net debt ${fmtCompact(data.netDebt, cur)} · equity ${fmtCompact(result.equityValue, cur)}`,
    ]
    if (await copyText(lines.join('\n'))) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    }
  }

  return (
    <div className="card">
      <div className="card-title">
        Intrinsic value — your assumptions
        <button className={`toolbtn${copied ? ' done' : ''}`} onClick={copySummary}>
          {copied ? '✓ Copied' : '⧉ Copy summary'}
        </button>
      </div>
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
