// Number / currency formatting helpers shared across the UI.

export function fmtCompact(value: number | null | undefined, currency = 'USD'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  const sym = currencySymbol(currency)
  if (abs >= 1e12) return `${sign}${sym}${(abs / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `${sign}${sym}${(abs / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${sign}${sym}${(abs / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${sign}${sym}${(abs / 1e3).toFixed(1)}K`
  return `${sign}${sym}${abs.toFixed(0)}`
}

export function fmtMoney(value: number | null | undefined, currency = 'USD'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  const sym = currencySymbol(currency)
  return `${value < 0 ? '-' : ''}${sym}${Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function fmtPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${(value * 100).toFixed(digits)}%`
}

export function fmtSignedPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  const s = (value * 100).toFixed(digits)
  return `${value > 0 ? '+' : ''}${s}%`
}

export function fmtMultiple(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${value.toFixed(1)}×`
}

export function fmtNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function currencySymbol(currency: string): string {
  const map: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CNY: '¥',
    HKD: 'HK$',
    INR: '₹',
    CAD: 'C$',
    AUD: 'A$',
    CHF: 'CHF ',
    KRW: '₩',
    BRL: 'R$',
  }
  return map[currency] ?? `${currency} `
}
