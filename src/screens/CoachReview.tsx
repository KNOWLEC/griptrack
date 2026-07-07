import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db/db'
import { getCurrentRevision, getSettings } from '../db/repo'
import { applyReview, rejectReview, requestReview, reviewPayloadSummary } from '../lib/coachApi'
import { AdjustmentDiff } from '../components/AdjustmentDiff'
import { ProgramChangeCard } from '../components/ProgramChangeCard'
import { findExercise } from '../db/repo'
import type { CoachReview as Review } from '../db/types'

export function CoachReview() {
  const settings = useLiveQuery(getSettings)
  const revision = useLiveQuery(getCurrentRevision)
  const reviews = useLiveQuery(() => db.coachReviews.orderBy('requestedAt').reverse().toArray())
  const [summary, setSummary] = useState<{ sessionCount: number; bjjCount: number; sinceDate: string }>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    void reviewPayloadSummary().then(setSummary)
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [reviews?.length])

  const configured = Boolean(settings?.backendUrl && settings?.backendSecret)
  const canRequest = configured && online && !busy

  const request = async () => {
    setBusy(true)
    setError(undefined)
    try {
      await requestReview()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const actionable = reviews?.find((r) => r.status === 'received')
  const past = reviews?.filter((r) => r !== actionable) ?? []

  return (
    <div className="screen">
      <header className="screen-header">
        <h1>Coach</h1>
      </header>
      <p className="muted">
        Claude reviews your recent training and adjusts upcoming targets. Built-in progression keeps
        working offline either way.
      </p>

      {!configured && (
        <p className="warn-card">
          Backend not configured — add the URL and secret in <Link to="/settings">Settings</Link>.
        </p>
      )}
      {configured && !online && <p className="warn-card">You're offline — coach review needs a connection.</p>}

      <button className="btn-primary btn-big" disabled={!canRequest} onClick={request}>
        {busy ? 'Asking the coach…' : 'Request review'}
      </button>
      {summary && (
        <p className="muted small">
          Will send: last 28 days — {summary.sessionCount} gym session
          {summary.sessionCount === 1 ? '' : 's'}, {summary.bjjCount} BJJ session
          {summary.bjjCount === 1 ? '' : 's'} + current program.
        </p>
      )}
      {error && <p className="error-card">{error}</p>}

      {actionable && revision && <ActionableReview review={actionable} program={revision.program} />}

      {past.length > 0 && (
        <>
          <h2 className="section-title">Past reviews</h2>
          {past.map((r) => (
            <PastReview key={r.id} review={r} />
          ))}
        </>
      )}
    </div>
  )
}

function ActionableReview({ review, program }: { review: Review; program: import('../db/types').Program }) {
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set((review.adjustments ?? []).map((a, i) => (a.flagged ? -1 : i)).filter((i) => i >= 0)),
  )
  const [selectedChanges, setSelectedChanges] = useState<Set<number>>(
    () =>
      new Set(
        (review.programChanges ?? []).map((c, i) => (c.flagged ? -1 : i)).filter((i) => i >= 0),
      ),
  )
  const [busy, setBusy] = useState(false)

  const toggleIn = (set: React.Dispatch<React.SetStateAction<Set<number>>>) => (i: number) =>
    set((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  const toggle = toggleIn(setSelected)
  const toggleChange = toggleIn(setSelectedChanges)

  const totalSelected = selected.size + selectedChanges.size

  const apply = async () => {
    setBusy(true)
    try {
      await applyReview(review.id, [...selected], [...selectedChanges])
    } finally {
      setBusy(false)
    }
  }

  const hasProposals =
    (review.adjustments?.length ?? 0) > 0 || (review.programChanges?.length ?? 0) > 0

  return (
    <div className="review-card">
      <h2 className="section-title">Coach's notes</h2>
      <p className="coaching-notes">{review.coachingNotes}</p>

      {(review.adjustments?.length ?? 0) > 0 && (
        <>
          <h2 className="section-title">Proposed target adjustments</h2>
          {review.adjustments!.map((adj, i) => (
            <AdjustmentDiff
              key={i}
              adjustment={adj}
              exercise={findExercise(program, adj.dayId, adj.exerciseId)}
              selected={selected.has(i)}
              onToggle={() => toggle(i)}
            />
          ))}
        </>
      )}

      {(review.programChanges?.length ?? 0) > 0 && (
        <>
          <h2 className="section-title">Proposed exercise changes</h2>
          {review.programChanges!.map((change, i) => (
            <ProgramChangeCard
              key={i}
              change={change}
              program={program}
              selected={selectedChanges.has(i)}
              onToggle={() => toggleChange(i)}
            />
          ))}
        </>
      )}

      {hasProposals ? (
        <button className="btn-primary btn-big" disabled={totalSelected === 0 || busy} onClick={apply}>
          Apply {totalSelected} change{totalSelected === 1 ? '' : 's'}
        </button>
      ) : (
        <p className="muted">No changes proposed — keep doing what you're doing.</p>
      )}
      <button className="btn-ghost" onClick={() => void rejectReview(review.id)}>
        Dismiss review
      </button>
    </div>
  )
}

function PastReview({ review }: { review: Review }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="revision-item">
      <div>
        <span>
          {new Date(review.requestedAt).toLocaleDateString()}{' '}
          <span className={`badge badge-review-${review.status}`}>{review.status}</span>
        </span>
        {review.status === 'error' && <span className="muted small">{review.error}</span>}
        {open && review.coachingNotes && <p className="coaching-notes small">{review.coachingNotes}</p>}
      </div>
      {review.coachingNotes && (
        <button className="btn-ghost" onClick={() => setOpen((o) => !o)}>
          {open ? 'Hide' : 'View'}
        </button>
      )}
    </div>
  )
}
