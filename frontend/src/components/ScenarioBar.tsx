import React from 'react'
import type { Assumptions } from '../types'
import { computeWacc, runDcf } from '../dcf'
import { fmtMoney, fmtSignedPct } from '../format'

interface Props {
  a: Assumptions
  startFiscalYear: number
  price: number | null
  currency: string
  analystTarget?: number | null
}

interface ScenarioDef {
  key: string
  name: string
  color: string
  dGrowth: number // additive pp to each year's growth (decimal)
  dMargin: number // additive pp to operating margin (decimal)
  dWacc: number // additive pp to WACC (decimal)
  dTermGrowth: number // additive pp to perpetuity growth
  dExit: number // additive turns to exit multiple
}

const SCENARIOS: ScenarioDef[] = [
  { key: 'bear', name: 'Bear', color: '#dc2b3d', dGrowth: -0.03, dMargin: -0.02, dWacc: 0.01, dTermGrowth: -0.005, dExit: -2 },
  { key: 'base', name: 'Base', color: '#4f46e5', dGrowth: 0, dMargin: 0, dWacc: 0, dTermGrowth: 0, dExit: 0 },
  { key: 'bull', name: 'Bull', color: '#15a35a', dGrowth: 0.03, dMargin: 0.02, dWacc: -0.01, dTermGrowth: 0.005, dExit: 2 },
]

export function ScenarioBar({ a, startFiscalYear, price, currency, analystTarget }: Props) {
  const baseWacc = computeWacc(a).wacc
  const rows = SCENARIOS.map((s) => {
    const mod: Assumptions = {
      ...a,
      growthRates: a.growthRates.map((g) => g + s.dGrowth),
      ebitMargin: a.ebitMargin + s.dMargin,
      terminalEbitMargin: a.terminalEbitMargin + s.dMargin,
      terminalGrowth: Math.max(0, a.terminalGrowth + s.dTermGrowth),
      exitMultiple: Math.max(1, a.exitMultiple + s.dExit),
    }
    const res = runDcf(mod, startFiscalYear, price, { waccOverride: baseWacc + s.dWacc })
    return { ...s, fv: res.fairValuePerShare, upside: res.upside }
  })

  const values = rows.map((r) => r.fv).filter((v) => Number.isFinite(v) && v > 0)
  const scaleMax = Math.max(price ?? 0, analystTarget ?? 0, ...values, 1) * 1.08
  const priceLeft = price ? (price / scaleMax) * 100 : null
  const targetLeft = analystTarget ? (analystTarget / scaleMax) * 100 : null

  return (
    <div className="card">
      <div className="card-title">
        Scenario range
        <span className="hint">bear / base / bull — auto-perturbed from your base case</span>
      </div>
      <div className="ff">
        {rows.map((r) => {
          const width = Number.isFinite(r.fv) && r.fv > 0 ? Math.min(100, (r.fv / scaleMax) * 100) : 0
          return (
            <div className="ff-row" key={r.key}>
              <div className="name" style={{ color: r.color }}>{r.name}</div>
              <div className="ff-track">
                <div className="ff-fill" style={{ width: `${width}%`, background: r.color }} />
                {priceLeft != null && (
                  <div className="ff-price-mark" style={{ left: `${Math.min(100, priceLeft)}%` }} />
                )}
                {targetLeft != null && (
                  <div className="ff-target-mark" style={{ left: `${Math.min(100, targetLeft)}%` }} />
                )}
              </div>
              <div className="ffval">
                {fmtMoney(r.fv, currency)}
                <div className="ff-sub" style={{ color: r.upside != null && r.upside >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                  {r.upside != null ? fmtSignedPct(r.upside, 0) : '—'}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
