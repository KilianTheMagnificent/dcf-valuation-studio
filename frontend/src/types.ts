// Mirrors the JSON returned by the FastAPI backend (`/api/company/{ticker}`).

export interface CompanyHistory {
  years: number[]
  revenue: (number | null)[]
  ebit: (number | null)[]
  ebitda: (number | null)[]
  netIncome: (number | null)[]
  da: (number | null)[]
  capex: (number | null)[]
  increaseNwc: (number | null)[]
  fcf: (number | null)[]
  ebitMargin: (number | null)[]
}

export interface CompanyDefaults {
  projectionYears: number
  baseRevenue: number
  revenueCagr: number
  year1Growth: number
  growthPath: number[] // analyst-anchored growth, length === projectionYears
  ebitMargin: number
  taxRate: number
  daPct: number
  capexPct: number
  nwcPctOfDeltaRev: number
  riskFree: number
  equityRiskPremium: number
  beta: number
  costOfDebt: number
  terminalGrowth: number
  exitMultiple: number
}

// Aggregated Wall-Street consensus from Yahoo (for seeding + benchmarking).
export interface AnalystData {
  available: boolean
  priceTarget: { mean: number | null; median: number | null; high: number | null; low: number | null } | null
  revenueGrowthY1: number | null
  revenueGrowthY2: number | null
  epsGrowthY1: number | null
  epsGrowthY2: number | null
  longTermGrowth: number | null
  numAnalysts: number | null
  recommendation: string | null
  recommendationMean: number | null
}

// Short provenance string per default assumption (analyst / filings / market).
export type DefaultSources = Record<string, string>

export interface CompanyData {
  ticker: string
  name: string
  sector: string | null
  industry: string | null
  currency: string
  price: number | null
  marketCap: number | null
  sharesOutstanding: number | null
  beta: number
  enterpriseValue: number | null
  totalDebt: number
  cash: number
  netDebt: number
  fiscalYearEnd: number | null
  history: CompanyHistory
  defaults: CompanyDefaults
  defaultSources: DefaultSources
  analyst: AnalystData
  warnings: string[]
}

export type TerminalMethod = 'gordon' | 'exit' | 'average'

// Everything the user can tweak. Seeded from CompanyDefaults + market data.
export interface Assumptions {
  projectionYears: number
  baseRevenue: number
  growthRates: number[] // length === projectionYears
  ebitMargin: number // year-1 operating margin
  terminalEbitMargin: number // faded to by the final year
  taxRate: number
  daPct: number
  capexPct: number
  nwcPctOfDeltaRev: number

  // WACC builder
  riskFree: number
  equityRiskPremium: number
  beta: number
  costOfDebt: number
  equityWeightValue: number // market cap, for D/E weighting
  debtWeightValue: number // total debt, for D/E weighting

  // Terminal value
  terminalMethod: TerminalMethod
  terminalGrowth: number
  exitMultiple: number

  // Bridge to equity
  netDebt: number
  sharesOutstanding: number

  midYear: boolean
}
