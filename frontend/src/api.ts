import type { CompanyData } from './types'

export async function fetchCompany(ticker: string): Promise<CompanyData> {
  const res = await fetch(`/api/company/${encodeURIComponent(ticker.trim())}`)
  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body?.detail) detail = body.detail
    } catch {
      /* ignore parse error, keep generic message */
    }
    throw new Error(detail)
  }
  return res.json()
}

// ---- Auto-update -----------------------------------------------------------
export interface UpdateInfo {
  currentVersion: string
  packaged: boolean
  configured: boolean
  available: boolean
  latestVersion?: string | null
  downloadUrl?: string | null
  releaseNotes?: string
  releaseUrl?: string | null
  reason?: string
}

export async function checkUpdate(force = false): Promise<UpdateInfo> {
  const res = await fetch(`/api/update/check${force ? '?force=true' : ''}`)
  if (!res.ok) throw new Error(`Update check failed (${res.status})`)
  return res.json()
}

export async function applyUpdate(): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch('/api/update/apply', { method: 'POST' })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body?.detail || `Update failed (${res.status})`)
  return body
}
