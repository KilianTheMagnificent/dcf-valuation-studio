import React from 'react'
import type { Assumptions, DefaultSources } from '../types'
import { fadeGrowth } from '../dcf'
import { Slider, Toggle, SourceTag } from './controls'

interface Props {
  a: Assumptions
  update: (patch: Partial<Assumptions>) => void
  sources?: DefaultSources
}

export function AssumptionsPanel({ a, update, sources }: Props) {
  const setGrowthAt = (i: number, v: number) => {
    const next = [...a.growthRates]
    next[i] = v
    update({ growthRates: next })
  }
  const setYears = (n: number) => {
    const years = Math.round(n)
    const cur = a.growthRates
    let next: number[]
    if (years <= cur.length) {
      next = cur.slice(0, years) // shrink: keep the leading (analyst-anchored) years
    } else {
      // grow: keep existing years, fade the new tail from the last value to terminal
      next = [...cur]
      const lastVal = cur[cur.length - 1] ?? a.terminalGrowth
      const startIdx = cur.length - 1
      for (let i = cur.length; i < years; i++) {
        const frac = years - 1 > startIdx ? (i - startIdx) / (years - 1 - startIdx) : 1
        next.push(lastVal + (a.terminalGrowth - lastVal) * frac)
      }
    }
    update({ projectionYears: years, growthRates: next })
  }
  const resetFade = () => {
    const start = a.growthRates[0] ?? a.terminalGrowth
    update({ growthRates: fadeGrowth(start, a.terminalGrowth, a.projectionYears) })
  }

  return (
    <div className="card">
      <div className="card-title">
        Operating assumptions
        <span className="hint">drag to revalue live</span>
      </div>

      <Slider
        label="Projection horizon"
        value={a.projectionYears}
        min={3}
        max={10}
        step={1}
        unit=" yrs"
        onChange={setYears}
      />

      {/* Per-year revenue growth */}
      <div className="control">
        <div className="row">
          <label>Revenue growth — per year</label>
          <button className="btn btn-ghost btn-sm" onClick={resetFade}>
            smooth fade ↺
          </button>
        </div>
        <div className="growth-cells">
          {a.growthRates.map((g, i) => (
            <div className="growth-cell" key={i}>
              <span className="yr">Y{i + 1}</span>
              <input
                type="number"
                step={0.5}
                value={round(g * 100, 2)}
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  if (!Number.isNaN(v)) setGrowthAt(i, v / 100)
                }}
              />
            </div>
          ))}
        </div>
        <div className="sublabel">Seeded from consensus, fully editable. Values in %.</div>
      </div>
      <SourceTag label={sources?.growth} analyst={sources?.growth?.startsWith('Analyst')} />

      <hr className="divider" />

      <Slider
        label="Operating (EBIT) margin — year 1"
        value={a.ebitMargin}
        min={-20}
        max={70}
        step={0.5}
        percent
        unit="%"
        onChange={(v) => update({ ebitMargin: v })}
      />
      <Slider
        label="Operating margin — terminal year"
        sublabel="margin fades linearly from year 1 to here"
        value={a.terminalEbitMargin}
        min={-20}
        max={70}
        step={0.5}
        percent
        unit="%"
        onChange={(v) => update({ terminalEbitMargin: v })}
      />
      <Slider
        label="Tax rate"
        value={a.taxRate}
        min={0}
        max={40}
        step={0.5}
        percent
        unit="%"
        onChange={(v) => update({ taxRate: v })}
      />

      <hr className="divider" />

      <Slider
        label="Depreciation & amortization"
        sublabel="% of revenue"
        value={a.daPct}
        min={0}
        max={25}
        step={0.25}
        percent
        unit="%"
        onChange={(v) => update({ daPct: v })}
      />
      <Slider
        label="Capital expenditure"
        sublabel="% of revenue"
        value={a.capexPct}
        min={0}
        max={30}
        step={0.25}
        percent
        unit="%"
        onChange={(v) => update({ capexPct: v })}
      />
      <Slider
        label="Δ Net working capital"
        sublabel="% of each year's revenue change (negative = WC releases cash)"
        value={a.nwcPctOfDeltaRev}
        min={-25}
        max={40}
        step={0.5}
        percent
        unit="%"
        onChange={(v) => update({ nwcPctOfDeltaRev: v })}
      />

      <hr className="divider" />
      <Toggle
        label="Mid-year convention"
        hint="discount cash flows at mid-period"
        checked={a.midYear}
        onChange={(v) => update({ midYear: v })}
      />
    </div>
  )
}

function round(n: number, d = 2): number {
  const f = Math.pow(10, d)
  return Math.round(n * f) / f
}
