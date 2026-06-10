import React from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import type { CompanyData } from '../types'
import type { DcfResult } from '../dcf'
import { useChartPalette, type ChartPalette } from '../theme'
import { fmtCompact } from '../format'

interface Props {
  data: CompanyData
  result: DcfResult
}

export function HistoryCharts({ data, result }: Props) {
  const cur = data.currency
  const h = data.history
  const pal = useChartPalette()

  const revData = [
    ...h.years.map((y, i) => ({ year: `FY${y}`, actual: h.revenue[i], proj: null as number | null })),
    ...result.projections.map((p) => ({ year: `FY${p.fiscalYear}`, actual: null as number | null, proj: p.revenue })),
  ]
  const fcfData = [
    ...h.years.map((y, i) => ({ year: `FY${y}`, actual: h.fcf[i], proj: null as number | null })),
    ...result.projections.map((p) => ({ year: `FY${p.fiscalYear}`, actual: null as number | null, proj: p.fcff })),
  ]
  const marginData = h.years.map((y, i) => ({
    year: `FY${y}`,
    margin: h.ebitMargin[i] != null ? (h.ebitMargin[i] as number) * 100 : null,
  }))

  const tick = (v: number) => fmtCompact(v, '').replace(/^\$/, '')
  const axisProps = {
    tick: { fontSize: 11, fill: pal.axis },
    tickLine: false as const,
  }

  return (
    <div className="card">
      <div className="card-title">History &amp; forecast</div>
      <div className="chart-grid">
        <ChartBox title={`Revenue (${cur})`} sub="solid = reported · light = forecast">
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={revData} margin={{ top: 6, right: 6, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="gradProj" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={pal.forecast} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={pal.forecast} stopOpacity={0.45} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={pal.grid} vertical={false} />
              <XAxis dataKey="year" {...axisProps} axisLine={{ stroke: pal.grid }} />
              <YAxis tickFormatter={tick} {...axisProps} axisLine={false} width={44} />
              <Tooltip content={<CompactTip currency={cur} pal={pal} />} cursor={{ fill: 'rgba(99,102,241,0.07)' }} />
              <Bar dataKey="actual" name="Reported" fill={pal.reported} radius={[3, 3, 0, 0]} />
              <Bar dataKey="proj" name="Forecast" fill="url(#gradProj)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>

        <ChartBox title={`Free cash flow (${cur})`} sub="reported FCF vs. forecast unlevered FCF">
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={fcfData} margin={{ top: 6, right: 6, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="gradFcf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={pal.fcfForecast} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={pal.fcfForecast} stopOpacity={0.5} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={pal.grid} vertical={false} />
              <XAxis dataKey="year" {...axisProps} axisLine={{ stroke: pal.grid }} />
              <YAxis tickFormatter={tick} {...axisProps} axisLine={false} width={44} />
              <Tooltip content={<CompactTip currency={cur} pal={pal} />} cursor={{ fill: 'rgba(52,211,153,0.07)' }} />
              <Bar dataKey="actual" name="Reported" radius={[3, 3, 0, 0]}>
                {fcfData.map((d, i) => (
                  <Cell key={i} fill={(d.actual ?? 0) >= 0 ? pal.fcfPos : pal.fcfNeg} />
                ))}
              </Bar>
              <Bar dataKey="proj" name="Forecast" fill="url(#gradFcf)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>

        <ChartBox title="Operating margin trend" sub="reported EBIT margin">
          <ResponsiveContainer width="100%" height={210}>
            <ComposedChart data={marginData} margin={{ top: 6, right: 6, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={pal.grid} vertical={false} />
              <XAxis dataKey="year" {...axisProps} axisLine={{ stroke: pal.grid }} />
              <YAxis tickFormatter={(v) => `${v.toFixed(0)}%`} {...axisProps} axisLine={false} width={40} />
              <Tooltip
                formatter={(v: any) => [`${Number(v).toFixed(1)}%`, 'EBIT margin']}
                contentStyle={{
                  background: pal.tooltipBg, border: `1px solid ${pal.tooltipBorder}`,
                  borderRadius: 8, color: pal.text, fontSize: 12,
                }}
              />
              <Line type="monotone" dataKey="margin" stroke={pal.line} strokeWidth={2.4} dot={{ r: 3, fill: pal.line }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartBox>

        <ChartBox title="Value composition" sub="where the enterprise value comes from">
          <ResponsiveContainer width="100%" height={210}>
            <BarChart
              layout="vertical"
              data={[
                { name: 'PV forecast FCF', v: result.sumPvFcff },
                { name: 'PV terminal value', v: result.pvTerminalValue },
                { name: 'Enterprise value', v: result.enterpriseValue },
              ]}
              margin={{ top: 6, right: 16, left: 4, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={pal.grid} horizontal={false} />
              <XAxis type="number" tickFormatter={tick} {...axisProps} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: pal.axis }} width={120} tickLine={false} axisLine={false} />
              <Tooltip content={<CompactTip currency={cur} pal={pal} />} cursor={{ fill: 'rgba(99,102,241,0.07)' }} />
              <Bar dataKey="v" radius={[0, 4, 4, 0]}>
                {[pal.comp1, pal.comp2, pal.comp3].map((c, i) => (
                  <Cell key={i} fill={c} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>
      </div>
    </div>
  )
}

function ChartBox({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12.5, fontWeight: 620, marginBottom: 2 }}>{title}</div>
      {sub && <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>{sub}</div>}
      {children}
    </div>
  )
}

function CompactTip({ active, payload, label, currency, pal }: any) {
  if (!active || !payload?.length) return null
  const p = pal as ChartPalette
  return (
    <div style={{
      background: p.tooltipBg, border: `1px solid ${p.tooltipBorder}`, borderRadius: 8,
      padding: '8px 11px', boxShadow: '0 4px 16px rgba(0,0,0,0.18)', fontSize: 12, color: p.text,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.filter((x: any) => x.value != null).map((x: any, i: number) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
          <span style={{ opacity: 0.75 }}>{x.name}</span>
          <span className="num" style={{ fontWeight: 600 }}>{fmtCompact(x.value, currency)}</span>
        </div>
      ))}
    </div>
  )
}
