import React from 'react'

interface SliderProps {
  label: string
  sublabel?: string
  value: number
  min: number
  max: number
  step: number
  percent?: boolean // value stored as decimal, displayed ×100
  unit?: string
  onChange: (v: number) => void
  format?: (displayValue: number) => string
}

/** Range slider that works in "display units" (e.g. percent) but stores decimals. */
export function Slider({
  label, sublabel, value, min, max, step, percent, unit = '', onChange, format,
}: SliderProps) {
  const display = percent ? value * 100 : value
  const pct = Math.min(100, Math.max(0, ((display - min) / (max - min)) * 100))
  const label2 = format ? format(display) : `${trim(display)}${unit}`
  return (
    <div className="control">
      <div className="row">
        <label>{label}</label>
        <span className="val num">{label2}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={display}
        style={{ ['--pct' as any]: `${pct}%` }}
        onChange={(e) => {
          const dv = parseFloat(e.target.value)
          onChange(percent ? dv / 100 : dv)
        }}
      />
      {sublabel && <div className="sublabel">{sublabel}</div>}
    </div>
  )
}

interface NumberFieldProps {
  label: string
  value: number
  percent?: boolean
  step?: number
  suffix?: string
  onChange: (v: number) => void
}

/** Compact labelled numeric input (used in the WACC builder grid). */
export function NumberField({ label, value, percent, step, suffix, onChange }: NumberFieldProps) {
  const display = percent ? round(value * 100, 3) : value
  return (
    <div className="control" style={{ marginBottom: 0 }}>
      <div className="row" style={{ marginBottom: 4 }}>
        <label>{label}</label>
      </div>
      <div className="field-inline">
        <input
          className="numinput"
          type="number"
          step={step ?? (percent ? 0.1 : 1)}
          value={display}
          onChange={(e) => {
            const dv = parseFloat(e.target.value)
            if (Number.isNaN(dv)) return
            onChange(percent ? dv / 100 : dv)
          }}
        />
        {(suffix || percent) && <span className="muted">{suffix ?? '%'}</span>}
      </div>
    </div>
  )
}

interface SegmentedProps<T extends string> {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}

export function Segmented<T extends string>({ value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button
          key={o.value}
          className={o.value === value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Tiny caption showing where a default came from (analyst / filings / market). */
export function SourceTag({ label, analyst }: { label?: string; analyst?: boolean }) {
  if (!label) return null
  return (
    <div className={`source-tag${analyst ? ' analyst' : ''}`} style={{ marginTop: -7, marginBottom: 13 }}>
      <span className="source-dot" />
      {label}
    </div>
  )
}

export function Toggle({ label, checked, onChange, hint }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', fontSize: 13 }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span style={{ fontWeight: 540 }}>{label}</span>
      {hint && <span className="muted" style={{ fontSize: 11.5 }}>{hint}</span>}
    </label>
  )
}

function trim(n: number): string {
  const r = Math.round(n * 100) / 100
  return Number.isInteger(r) ? String(r) : r.toFixed(r >= 100 ? 0 : 1)
}
function round(n: number, d = 2): number {
  const f = Math.pow(10, d)
  return Math.round(n * f) / f
}
