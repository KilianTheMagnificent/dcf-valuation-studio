import React, { useState } from 'react'
import type { UpdateInfo } from '../api'

interface Props {
  info: UpdateInfo | null
  applying: boolean
  error: string | null
  onApply: () => void
}

// Slim banner shown across the top when a newer release is available.
export function UpdateBanner({ info, applying, error, onApply }: Props) {
  const [showNotes, setShowNotes] = useState(false)
  if (!info?.available) return null

  return (
    <div className="update-banner">
      <div className="ub-main">
        <span className="ub-badge">Update</span>
        <span className="ub-text">
          Version <strong>{info.latestVersion}</strong> is available
          <span className="ub-sub"> · you have {info.currentVersion}</span>
        </span>
        {info.releaseNotes && (
          <button className="ub-link" onClick={() => setShowNotes((s) => !s)}>
            {showNotes ? 'hide notes' : "what's new"}
          </button>
        )}
        <div className="ub-actions">
          {error && <span className="ub-error">{error}</span>}
          <button className="btn btn-primary btn-sm" onClick={onApply} disabled={applying}>
            {applying ? 'Installing… the app will restart' : 'Update & restart'}
          </button>
        </div>
      </div>
      {showNotes && info.releaseNotes && (
        <pre className="ub-notes">{info.releaseNotes}</pre>
      )}
    </div>
  )
}
