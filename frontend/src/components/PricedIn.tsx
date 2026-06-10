import React, { useMemo } from 'react'
import type { Assumptions } from '../types'
import { computeWacc, impliedUniformGrowth, impliedWacc } from '../dcf'
import { fmtPct } from '../format'

interface Props {
  a: Assumptions
  startFiscalYear: number
  price: number | null
}

// Reverse DCF: instead of asking "what is it worth?", ask "what does today's
// price already assume?" — the fastest sanity check on any valuation.
export function PricedIn({ a, startFiscalYear, price }: Props) {
  const { g, w, yourAvgGrowth, yourWacc } = useMemo(() => {
    const g = impliedUniformGrowth(a, startFiscalYear, price)
    const w = impliedWacc(a, startFiscalYear, price)
    const yourAvgGrowth = a.growthRates.length
      ? a.growthRates.reduce((s, x) => s + x, 0) / a.growthRates.length
      : 0
    return { g, w, yourAvgGrowth, yourWacc: computeWacc(a).wacc }
  }, [a, startFiscalYear, price])

  if (!price || price <= 0) return null

  return (
    <div className="card">
      <div className="card-title">
        What's priced in — reverse DCF
        <span className="hint">solve the model backwards from today's price</span>
      </div>
      <div className="pi-grid">
        <div className="pi-item">
          <div className="pi-k">Revenue growth needed to justify the price</div>
          <div className="pi-v num">{g != null ? `${fmtPct(g, 1)} / yr` : 'n/a'}</div>
          <div className="pi-vs num">
            {g != null
              ? `flat for ${a.projectionYears} yrs · your path averages ${fmtPct(yourAvgGrowth, 1)}`
              : 'no growth rate in −60%…+150% reaches the price'}
          </div>
        </div>
        <div className="pi-item">
          <div className="pi-k">Discount rate the price implies</div>
          <div className="pi-v num">{w != null ? fmtPct(w, 2) : 'n/a'}</div>
          <div className="pi-vs num">
            {w != null
              ? `your WACC is ${fmtPct(yourWacc, 2)} — ${w > yourWacc ? 'market demands more return (cheaper than your model)' : 'market accepts less return (richer than your model)'}`
              : 'no discount rate reconciles price with these cash flows'}
          </div>
        </div>
      </div>
      <div className="pi-note">
        Each number re-solves the DCF holding everything else at <em>your</em> assumptions.
        If the implied growth looks heroic — or the implied discount rate looks too thin for
        the risk — the market is more optimistic than you are.
      </div>
    </div>
  )
}
