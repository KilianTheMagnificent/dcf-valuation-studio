import React from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import type { CompanyData } from '../types'
import type { DcfResult } from '../dcf'
import { fmtCompact } from '../format'

interface Props {
  data: CompanyData
  result: DcfResult
}

export function HistoryCharts({ data, result }: Props) {
  const cur = data.currency
  const h = data.history

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
    revenue: h.revenue[i],
    margin: h.ebitMargin[i] != null ? (h.ebitMargin[i] as number) * 100 : null,
  }))

  const tick = (v: number) => fmtCompact(v, '').replace(/^\$/, '')

  return (
    <div className="card">
      <div className="card-title">History &amp; forecast</div>
      <div className="chart-grid">
        <ChartBox title={`Revenue (${cur})`} sub="solid = reported · light = forecast">
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={revData} margin={{ top: 6, right: 6, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#687287' }} tickLine={false} axisLine={{ stroke: '#e1e5ec' }} />
              <YAxis tickFormatter={tick} tick={{ fontSize: 11, fill: '#687287' }} tickLine={false} axisLine={false} width={44} />
              <Tooltip content={<CompactTip currency={cur} />} cursor={{ fill: 'rgba(79,70,229,0.05)' }} />
              <Bar dataKey="actual" name="Reported" fill="#1c2740" radius={[3, 3, 0, 0]} />
              <Bar dataKey="proj" name="Forecast" fill="#8b8efc" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>

        <ChartBox title={`Free cash flow (${cur})`} sub="reported FCF vs. forecast unlevered FCF">
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={fcfData} margin={{ top: 6, right: 6, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#687287' }} tickLine={false} axisLine={{ stroke: '#e1e5ec' }} />
              <YAxis tickFormatter={tick} tick={{ fontSize: 11, fill: '#687287' }} tickLine={false} axisLine={false} width={44} />
              <Tooltip content={<CompactTip currency={cur} />} cursor={{ fill: 'rgba(21,163,90,0.05)' }} />
              <Bar dataKey="actual" name="Reported" radius={[3, 3, 0, 0]}>
                {fcfData.map((d, i) => (
                  <Cell key={i} fill={(d.actual ?? 0) >= 0 ? '#15803d' : '#dc2b3d'} />
                ))}
              </Bar>
              <Bar dataKey="proj" name="Forecast" fill="#86efac" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>

        <ChartBox title="Operating margin trend" sub="reported EBIT margin">
          <ResponsiveContainer width="100%" height={210}>
            <ComposedChart data={marginData} margin={{ top: 6, right: 6, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#687287' }} tickLine={false} axisLine={{ stroke: '#e1e5ec' }} />
              <YAxis tickFormatter={(v) => `${v.toFixed(0)}%`} tick={{ fontSize: 11, fill: '#687287' }} tickLine={false} axisLine={false} width={40} />
              <Tooltip formatter={(v: any) => [`${Number(v).toFixed(1)}%`, 'EBIT margin']} />
              <Line type="monotone" dataKey="margin" stroke="#4f46e5" strokeWidth={2.4} dot={{ r: 3, fill: '#4f46e5' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartBox>

        <ChartBox title="Value composition" sub="where the enterprise value comes from">
          <ResponsiveContainer width="100%" height={210}>
            <BarChart
              layout="vertical"
              data={[
                { name: 'PV forecast FCF', v: result.sumPvFcff, fill: '#4f46e5' },
                { name: 'PV terminal value', v: result.pvTerminalValue, fill: '#22d3ee' },
                { name: 'Enterprise value', v: result.enterpriseValue, fill: '#1c2740' },
              ]}
              margin={{ top: 6, right: 16, left: 4, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" horizontal={false} />
              <XAxis type="number" tickFormatter={tick} tick={{ fontSize: 11, fill: '#687287' }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#3a4256' }} width={120} tickLine={false} axisLine={false} />
              <Tooltip content={<CompactTip currency={cur} />} cursor={{ fill: 'rgba(79,70,229,0.05)' }} />
              <Bar dataKey="v" radius={[0, 4, 4, 0]}>
                {[0, 1, 2].map((i) => (
                  <Cell key={i} fill={['#4f46e5', '#22d3ee', '#1c2740'][i]} />
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
      <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 2 }}>{title}</div>
      {sub && <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>{sub}</div>}
      {children}
    </div>
  )
}

function CompactTip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #e1e5ec', borderRadius: 8, padding: '8px 11px', boxShadow: '0 4px 16px rgba(16,24,40,0.1)', fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.filter((p: any) => p.value != null).map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="num" style={{ fontWeight: 600 }}>{fmtCompact(p.value, currency)}</span>
        </div>
      ))}
    </div>
  )
}
