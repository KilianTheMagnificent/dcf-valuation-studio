import React from 'react'
import type { Assumptions, DefaultSources } from '../types'
import { computeWacc } from '../dcf'
import { fmtPct } from '../format'
import { Slider, SourceTag } from './controls'

interface Props {
  a: Assumptions
  update: (patch: Partial<Assumptions>) => void
  sources?: DefaultSources
}

export function WaccBuilder({ a, update, sources }: Props) {
  const w = computeWacc(a)
  return (
    <div className="card">
      <div className="card-title">
        Discount rate (WACC)
        <span className="val num" style={{ fontSize: 15 }}>{fmtPct(w.wacc, 2)}</span>
      </div>

      <Slider
        label="Risk-free rate"
        sublabel="≈ 10-year government bond yield"
        value={a.riskFree}
        min={0}
        max={8}
        step={0.05}
        percent
        unit="%"
        onChange={(v) => update({ riskFree: v })}
      />
      <SourceTag label={sources?.riskFree} analyst={sources?.riskFree?.startsWith('Live')} />
      <Slider
        label="Equity risk premium"
        value={a.equityRiskPremium}
        min={2}
        max={9}
        step={0.05}
        percent
        unit="%"
        onChange={(v) => update({ equityRiskPremium: v })}
      />
      <Slider
        label="Beta"
        value={a.beta}
        min={0}
        max={2.5}
        step={0.01}
        unit=""
        format={(d) => d.toFixed(2)}
        onChange={(v) => update({ beta: v })}
      />
      <SourceTag label={sources?.beta} />
      <Slider
        label="Pre-tax cost of debt"
        value={a.costOfDebt}
        min={0}
        max={15}
        step={0.05}
        percent
        unit="%"
        onChange={(v) => update({ costOfDebt: v })}
      />

      <hr className="divider" />
      <div className="bridge">
        <div className="line">
          <span className="k">Cost of equity · CAPM</span>
          <span className="v">{fmtPct(w.costOfEquity, 2)}</span>
        </div>
        <div className="line">
          <span className="k">After-tax cost of debt</span>
          <span className="v">{fmtPct(w.afterTaxCostOfDebt, 2)}</span>
        </div>
        <div className="line">
          <span className="k">Capital weights (E / D)</span>
          <span className="v">{fmtPct(w.weightEquity, 0)} / {fmtPct(w.weightDebt, 0)}</span>
        </div>
        <div className="line total">
          <span className="k">WACC</span>
          <span className="v">{fmtPct(w.wacc, 2)}</span>
        </div>
      </div>
    </div>
  )
}
