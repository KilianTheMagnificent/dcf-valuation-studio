import React from 'react'
import type { AnalystData } from '../types'
import { fmtMoney, fmtSignedPct, fmtPct } from '../format'

interface Props {
  analyst: AnalystData
  price: number | null
  currency: string
}

export function AnalystConsensus({ analyst, price, currency }: Props) {
  if (!analyst?.available) {
    return (
      <div className="card">
        <div className="card-title">Analyst consensus</div>
        <div className="muted" style={{ fontSize: 13 }}>
          No analyst coverage available for this ticker — defaults fall back to the
          company's own historical figures.
        </div>
      </div>
    )
  }

  const pt = analyst.priceTarget
  const targetUpside =
    pt?.mean && price && price > 0 ? pt.mean / price - 1 : null

  return (
    <div className="card">
      <div className="card-title">
        <span>Analyst consensus</span>
        <span className="hint">
          {analyst.numAnalysts ? `${Math.round(analyst.numAnalysts)} analysts · ` : ''}aggregated by Yahoo
        </span>
      </div>

      <div className="analyst-top">
        <div>
          <div className="fv-label" style={{ marginBottom: 2 }}>Mean price target</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span className="num" style={{ fontSize: 26, fontWeight: 720 }}>
              {fmtMoney(pt?.mean ?? null, currency)}
            </span>
            {targetUpside != null && (
              <span className={`num ${targetUpside >= 0 ? 'pos' : 'neg'}`} style={{ fontWeight: 650, fontSize: 14 }}>
                {fmtSignedPct(targetUpside, 1)} vs price
              </span>
            )}
          </div>
          <div className="muted num" style={{ fontSize: 12, marginTop: 3 }}>
            range {fmtMoney(pt?.low ?? null, currency)} – {fmtMoney(pt?.high ?? null, currency)}
          </div>
        </div>
        {analyst.recommendation && (
          <span className={`rec-chip rec-${recClass(analyst.recommendation)}`}>
            {analyst.recommendation.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      <hr className="divider" />
      <div className="analyst-grid">
        <Stat k="Revenue growth · next FY" v={fmtPct(analyst.revenueGrowthY1, 1)} hot />
        <Stat k="Revenue growth · FY+2" v={fmtPct(analyst.revenueGrowthY2, 1)} hot />
        <Stat k="EPS growth · next FY" v={fmtPct(analyst.epsGrowthY1, 1)} />
        <Stat k="EPS growth · FY+2" v={fmtPct(analyst.epsGrowthY2, 1)} />
        {analyst.longTermGrowth != null && (
          <Stat k="Long-term growth (5y)" v={fmtPct(analyst.longTermGrowth, 1)} />
        )}
      </div>
      <div className="locked-note" style={{ color: 'var(--accent)', background: 'var(--accent-soft)' }}>
        These consensus figures seed the editable revenue-growth path below — adjust
        them freely to run your own view.
      </div>
    </div>
  )
}

function Stat({ k, v, hot }: { k: string; v: string; hot?: boolean }) {
  return (
    <div className="ag-item">
      <div className="ag-k">{k}</div>
      <div className={`ag-v num ${hot ? 'hot' : ''}`}>{v}</div>
    </div>
  )
}

function recClass(rec: string): string {
  const r = rec.toLowerCase()
  if (r.includes('strong_buy') || r === 'buy') return 'buy'
  if (r.includes('sell') || r.includes('underperform')) return 'sell'
  return 'hold'
}
