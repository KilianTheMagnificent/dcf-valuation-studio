import React from 'react'
import type { Assumptions } from '../types'
import { computeWacc, runDcf, type RunOptions } from '../dcf'
import { fmtMoney, fmtPct } from '../format'

interface Props {
  a: Assumptions
  startFiscalYear: number
  price: number | null
  currency: string
}

const WACC_STEPS = [-0.01, -0.005, 0, 0.005, 0.01] // ±100bps
const GROWTH_STEPS = [-0.01, -0.005, 0, 0.005, 0.01]
const EXIT_STEPS = [-4, -2, 0, 2, 4]

export function SensitivityTable({ a, startFiscalYear, price, currency }: Props) {
  const baseWacc = computeWacc(a).wacc
  const useExit = a.terminalMethod === 'exit'
  const colSteps = useExit ? EXIT_STEPS : GROWTH_STEPS
  const colBase = useExit ? a.exitMultiple : a.terminalGrowth

  const waccs = WACC_STEPS.map((s) => baseWacc + s)
  const cols = colSteps.map((s) => (useExit ? Math.max(1, colBase + s) : Math.max(0, colBase + s)))

  return (
    <div className="card">
      <div className="card-title">
        Sensitivity — fair value / share
        <span className="hint">WACC × {useExit ? 'exit multiple' : 'perpetuity growth'}</span>
      </div>
      <div className="sens">
        <table className="heat">
          <thead>
            <tr>
              <td className="axis" style={{ background: 'transparent' }}>
                <span className="axis-title">WACC ↓ / {useExit ? 'Exit ×' : 'g'} →</span>
              </td>
              {cols.map((c, i) => (
                <th key={i}>{useExit ? `${c.toFixed(1)}×` : fmtPct(c, 1)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {waccs.map((wacc, ri) => (
              <tr key={ri}>
                <td className="axis">{fmtPct(wacc, 1)}</td>
                {cols.map((c, ci) => {
                  const opts: RunOptions = { waccOverride: wacc }
                  if (useExit) opts.exitMultipleOverride = c
                  else opts.terminalGrowthOverride = c
                  const res = runDcf(a, startFiscalYear, price, opts)
                  const fv = res.fairValuePerShare
                  const isBase = WACC_STEPS[ri] === 0 && colSteps[ci] === 0
                  return (
                    <td
                      key={ci}
                      className={`cell${isBase ? ' base' : ''}`}
                      style={{ background: cellColor(res.upside, fv, price) }}
                      title={res.upside != null ? `${(res.upside * 100).toFixed(0)}% vs price` : ''}
                    >
                      {fmtMoney(fv, currency)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="heat-caption">
        Outlined cell = your current assumptions. Green = upside vs. today's price, red = downside.
      </div>
    </div>
  )
}

function cellColor(upside: number | null, fv: number, price: number | null): string {
  if (!Number.isFinite(fv)) return '#f1f3f7'
  if (upside == null) return '#eef0fe'
  const clamped = Math.max(-0.5, Math.min(0.5, upside))
  const t = Math.abs(clamped) / 0.5
  if (clamped >= 0) return `rgba(21, 163, 90, ${0.08 + 0.55 * t})`
  return `rgba(220, 43, 61, ${0.08 + 0.55 * t})`
}
