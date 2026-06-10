// ---------------------------------------------------------------------------
// Theme management: light / dark, defaulting to the macOS system appearance.
// The choice is persisted; charts read their palette from here so SVG colors
// (which can't use CSS variables for everything) stay in sync with the theme.
// ---------------------------------------------------------------------------
import { useEffect, useState } from 'react'

export type ThemeName = 'light' | 'dark'

const STORAGE_KEY = 'dcf.theme'

function systemTheme(): ThemeName {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function initialTheme(): ThemeName {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : systemTheme()
}

export function applyTheme(t: ThemeName) {
  document.documentElement.setAttribute('data-theme', t)
}

const listeners = new Set<(t: ThemeName) => void>()
let current: ThemeName = initialTheme()
applyTheme(current)

// Follow live macOS appearance changes unless the user picked one explicitly.
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', (e) => {
  if (!localStorage.getItem(STORAGE_KEY)) setTheme(e.matches ? 'dark' : 'light', false)
})

export function setTheme(t: ThemeName, persist = true) {
  current = t
  if (persist) localStorage.setItem(STORAGE_KEY, t)
  applyTheme(t)
  listeners.forEach((fn) => fn(t))
}

export function useTheme(): [ThemeName, () => void] {
  const [theme, set] = useState<ThemeName>(current)
  useEffect(() => {
    listeners.add(set)
    return () => {
      listeners.delete(set)
    }
  }, [])
  return [theme, () => setTheme(current === 'dark' ? 'light' : 'dark')]
}

// ----- Chart palette (Recharts needs concrete colors, not CSS vars) ---------
export interface ChartPalette {
  axis: string
  grid: string
  reported: string
  forecast: string
  fcfPos: string
  fcfNeg: string
  fcfForecast: string
  line: string
  comp1: string
  comp2: string
  comp3: string
  tooltipBg: string
  tooltipBorder: string
  text: string
}

export const CHART_PALETTES: Record<ThemeName, ChartPalette> = {
  light: {
    axis: '#69748c',
    grid: '#eceff5',
    reported: '#1d2940',
    forecast: '#8b8efc',
    fcfPos: '#15803d',
    fcfNeg: '#dc2b3d',
    fcfForecast: '#86efac',
    line: '#4f46e5',
    comp1: '#4f46e5',
    comp2: '#0ea5e9',
    comp3: '#1d2940',
    tooltipBg: '#ffffff',
    tooltipBorder: '#e3e7f0',
    text: '#13192b',
  },
  dark: {
    axis: '#8a93a8',
    grid: '#222a3d',
    reported: '#c7d0e4',
    forecast: '#7a7ef0',
    fcfPos: '#34d399',
    fcfNeg: '#f87171',
    fcfForecast: '#1f6f4d',
    line: '#9da2ff',
    comp1: '#7a7ef0',
    comp2: '#38bdf8',
    comp3: '#c7d0e4',
    tooltipBg: '#171e30',
    tooltipBorder: '#2b3550',
    text: '#e8ecf6',
  },
}

export function useChartPalette(): ChartPalette {
  const [theme] = useTheme()
  return CHART_PALETTES[theme]
}
