import React from 'react'
import type { Assumptions, TerminalMethod } from '../types'
import type { DcfResult } from '../dcf'
import { fmtMultiple, fmtPct, fmtCompact } from '../format'
import { Slider, Segmented } from './controls'

interface Props {
  a: Assumptions
  update: (patch: Partial<Assumptions>) => void
  result: DcfResult
  currency: string
}

export function TerminalPanel({ a, update, result, currency }: Props) {
  const showGrowth = a.terminalMethod === 'gordon' || a.terminalMethod === 'average'
  const showExit = a.terminalMethod === 'exit' || a.terminalMethod === 'average'
  return (
    <div className="card">
      <div className="card-title">Terminal value</div>

      <div style={{ marginBottom: 14 }}>
        <Segmented<TerminalMethod>
          value={a.terminalMethod}
          onChange={(v) => update({ terminalMethod: v })}
          options={[
            { value: 'gordon', label: 'Gordon growth' },
            { value: 'exit', label: 'Exit multiple' },
            { value: 'average', label: 'Average' },
          ]}
        />
      </div>

      {showGrowth && (
        <Slider
          label="Perpetuity growth rate"
          sublabel="long-run nominal growth; keep below WACC and ~GDP"
          value={a.terminalGrowth}
          min={0}
          max={5}
          step={0.05}
          percent
          unit="%"
          onChange={(v) => update({ terminalGrowth: v })}
        />
      )}
      {showExit && (
        <Slider
          label="Exit EV / EBITDA multiple"
          value={a.exitMultiple}
          min={3}
          max={35}
          step={0.5}
          unit="×"
          format={(d) => `${d.toFixed(1)}×`}
          onChange={(v) => update({ exitMultiple: v })}
        />
      )}

      <hr className="divider" />
      <div className="bridge">
        <div className="line">
          <span className="k">Terminal value (undiscounted)</span>
          <span className="v">{fmtCompact(result.terminalValue, currency)}</span>
        </div>
        <div className="line">
          <span className="k">TV as % of enterprise value</span>
          <span className="v">{fmtPct(result.tvPctOfEv, 0)}</span>
        </div>
        <div className="line">
          <span className="k muted">↳ Gordon implies exit multiple</span>
          <span className="v">{fmtMultiple(result.impliedExitMultiple)}</span>
        </div>
        <div className="line">
          <span className="k muted">↳ Exit multiple implies growth</span>
          <span className="v">{fmtPct(result.impliedTerminalGrowth, 2)}</span>
        </div>
      </div>
    </div>
  )
}
