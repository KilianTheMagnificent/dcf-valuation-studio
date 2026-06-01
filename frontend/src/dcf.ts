// ---------------------------------------------------------------------------
// Discounted Cash Flow engine (unlevered / FCFF approach).
//
//   FCFF_t = EBIT_t·(1 − tax) + D&A_t − Capex_t − ΔNWC_t
//   EV     = Σ PV(FCFF_t) + PV(Terminal Value)
//   Equity = EV − Net Debt
//   Fair value / share = Equity / shares outstanding
//
// Runs entirely client-side so every assumption change recalculates instantly.
// ---------------------------------------------------------------------------
import type { Assumptions, CompanyData, TerminalMethod } from './types'

export interface YearProjection {
  period: number // 1..N
  fiscalYear: number
  revenue: number
  growth: number
  ebitMargin: number
  ebit: number
  nopat: number
  da: number
  capex: number
  deltaNwc: number
  fcff: number
  discountFactor: number
  pvFcff: number
}

export interface WaccBreakdown {
  costOfEquity: number
  afterTaxCostOfDebt: number
  weightEquity: number
  weightDebt: number
  wacc: number
}

export interface DcfResult extends WaccBreakdown {
  projections: YearProjection[]
  sumPvFcff: number
  terminalValueGordon: number
  terminalValueExit: number
  terminalValue: number
  pvTerminalValue: number
  enterpriseValue: number
  equityValue: number
  fairValuePerShare: number
  currentPrice: number | null
  upside: number | null // (fair / price) − 1
  tvPctOfEv: number
  impliedExitMultiple: number // EV/EBITDA implied by the Gordon terminal value
  impliedTerminalGrowth: number // perpetuity growth implied by the exit multiple
  terminalEbitda: number
  valid: boolean
  notes: string[]
}

export function computeWacc(a: Assumptions): WaccBreakdown {
  const costOfEquity = a.riskFree + a.beta * a.equityRiskPremium
  const afterTaxCostOfDebt = a.costOfDebt * (1 - a.taxRate)
  const e = Math.max(a.equityWeightValue, 0)
  const d = Math.max(a.debtWeightValue, 0)
  const v = e + d
  const weightEquity = v > 0 ? e / v : 1
  const weightDebt = v > 0 ? d / v : 0
  const wacc = weightEquity * costOfEquity + weightDebt * afterTaxCostOfDebt
  return { costOfEquity, afterTaxCostOfDebt, weightEquity, weightDebt, wacc }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export interface RunOptions {
  waccOverride?: number // for scenario / sensitivity analysis
  terminalGrowthOverride?: number
  exitMultipleOverride?: number
}

export function runDcf(
  a: Assumptions,
  startFiscalYear: number,
  currentPrice: number | null,
  opts: RunOptions = {},
): DcfResult {
  const notes: string[] = []
  const waccBreak = computeWacc(a)
  const wacc = opts.waccOverride ?? waccBreak.wacc
  const terminalGrowth = opts.terminalGrowthOverride ?? a.terminalGrowth
  const exitMultiple = opts.exitMultipleOverride ?? a.exitMultiple

  const N = Math.max(1, Math.round(a.projectionYears))
  const projections: YearProjection[] = []

  let prevRevenue = a.baseRevenue
  let lastEbit = 0
  let lastDa = 0
  let lastFcff = 0
  let sumPvFcff = 0

  for (let t = 1; t <= N; t++) {
    const growth = a.growthRates[t - 1] ?? a.growthRates[a.growthRates.length - 1] ?? 0
    const revenue = prevRevenue * (1 + growth)
    // Operating margin fades linearly from year-1 margin to the terminal margin.
    const marginT = N === 1 ? a.ebitMargin : lerp(a.ebitMargin, a.terminalEbitMargin, (t - 1) / (N - 1))
    const ebit = revenue * marginT
    const nopat = ebit * (1 - a.taxRate)
    const da = revenue * a.daPct
    const capex = revenue * a.capexPct
    const deltaNwc = (revenue - prevRevenue) * a.nwcPctOfDeltaRev
    const fcff = nopat + da - capex - deltaNwc

    const exponent = a.midYear ? t - 0.5 : t
    const discountFactor = 1 / Math.pow(1 + wacc, exponent)
    const pvFcff = fcff * discountFactor
    sumPvFcff += pvFcff

    projections.push({
      period: t,
      fiscalYear: startFiscalYear + t,
      revenue,
      growth,
      ebitMargin: marginT,
      ebit,
      nopat,
      da,
      capex,
      deltaNwc,
      fcff,
      discountFactor,
      pvFcff,
    })

    prevRevenue = revenue
    lastEbit = ebit
    lastDa = da
    lastFcff = fcff
  }

  const terminalEbitda = lastEbit + lastDa

  // --- Terminal value --------------------------------------------------------
  let terminalValueGordon = NaN
  if (wacc > terminalGrowth) {
    terminalValueGordon = (lastFcff * (1 + terminalGrowth)) / (wacc - terminalGrowth)
  } else {
    notes.push('WACC ≤ terminal growth: the Gordon-growth terminal value is undefined.')
  }
  const terminalValueExit = exitMultiple * terminalEbitda

  const terminalValue = selectTerminal(a.terminalMethod, terminalValueGordon, terminalValueExit)

  // Terminal value is an end-of-year-N figure; discount it back N periods
  // (consistent with the mid-year convention when enabled).
  const tvExponent = a.midYear ? N - 0.5 : N
  const pvTerminalValue = terminalValue / Math.pow(1 + wacc, tvExponent)

  const enterpriseValue = sumPvFcff + pvTerminalValue
  const equityValue = enterpriseValue - a.netDebt
  const fairValuePerShare = a.sharesOutstanding > 0 ? equityValue / a.sharesOutstanding : NaN

  const tvPctOfEv = enterpriseValue !== 0 ? pvTerminalValue / enterpriseValue : 0
  const impliedExitMultiple = terminalEbitda !== 0 && Number.isFinite(terminalValueGordon)
    ? terminalValueGordon / terminalEbitda
    : NaN
  // Solve g from: TV = FCFF·(1+g)/(WACC−g)  ⇒  g = (WACC·TV − FCFF)/(TV + FCFF)
  const impliedTerminalGrowth = terminalValueExit + lastFcff !== 0
    ? (wacc * terminalValueExit - lastFcff) / (terminalValueExit + lastFcff)
    : NaN

  const upside = currentPrice && currentPrice > 0 && Number.isFinite(fairValuePerShare)
    ? fairValuePerShare / currentPrice - 1
    : null

  if (tvPctOfEv > 0.85) {
    notes.push(
      `Terminal value is ${(tvPctOfEv * 100).toFixed(0)}% of enterprise value — the result hinges heavily on terminal assumptions.`,
    )
  }
  if (enterpriseValue <= 0) {
    notes.push(
      'Projected free cash flows don’t support a positive enterprise value, so this DCF isn’t meaningful as-is — try a higher margin/growth path or a longer horizon to model a path to profitability.',
    )
  } else if (fairValuePerShare < 0) {
    notes.push('Implied equity value is negative — net debt exceeds the discounted value.')
  }

  const valid = Number.isFinite(fairValuePerShare)

  return {
    ...waccBreak,
    wacc,
    projections,
    sumPvFcff,
    terminalValueGordon,
    terminalValueExit,
    terminalValue,
    pvTerminalValue,
    enterpriseValue,
    equityValue,
    fairValuePerShare,
    currentPrice,
    upside,
    tvPctOfEv,
    impliedExitMultiple,
    impliedTerminalGrowth,
    terminalEbitda,
    valid,
    notes,
  }
}

function selectTerminal(method: TerminalMethod, gordon: number, exit: number): number {
  if (method === 'exit') return exit
  if (method === 'average') {
    if (!Number.isFinite(gordon)) return exit
    return (gordon + exit) / 2
  }
  // gordon (fall back to exit if undefined)
  return Number.isFinite(gordon) ? gordon : exit
}

// ---------------------------------------------------------------------------
// Build the initial editable assumptions from the fetched company data.
// ---------------------------------------------------------------------------
export function buildDefaultAssumptions(data: CompanyData): Assumptions {
  const d = data.defaults
  const years = Math.max(1, Math.round(d.projectionYears))
  return {
    projectionYears: years,
    baseRevenue: d.baseRevenue,
    // Seed from the analyst-anchored growth path when available; otherwise fade.
    growthRates:
      d.growthPath && d.growthPath.length === years
        ? [...d.growthPath]
        : fadeGrowth(d.year1Growth, d.terminalGrowth, years),
    ebitMargin: d.ebitMargin,
    terminalEbitMargin: d.ebitMargin, // flat by default; user can fade it
    taxRate: d.taxRate,
    daPct: d.daPct,
    capexPct: d.capexPct,
    nwcPctOfDeltaRev: d.nwcPctOfDeltaRev,
    riskFree: d.riskFree,
    equityRiskPremium: d.equityRiskPremium,
    beta: d.beta,
    costOfDebt: d.costOfDebt,
    equityWeightValue: data.marketCap ?? (data.price ?? 0) * (data.sharesOutstanding ?? 0),
    debtWeightValue: data.totalDebt,
    terminalMethod: 'gordon',
    terminalGrowth: d.terminalGrowth,
    exitMultiple: d.exitMultiple,
    netDebt: data.netDebt,
    sharesOutstanding: data.sharesOutstanding ?? 0,
    midYear: false,
  }
}

// Linearly fade the growth rate from year-1 toward the terminal rate.
export function fadeGrowth(start: number, terminal: number, years: number): number[] {
  if (years <= 1) return [start]
  const out: number[] = []
  for (let t = 0; t < years; t++) {
    out.push(lerp(start, terminal, t / (years - 1)))
  }
  return out
}
