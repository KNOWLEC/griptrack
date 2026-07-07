import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db/db'
import { deleteBjjSession } from '../db/repo'
import { formatDate } from '../lib/dates'
import { BJJ_INTENSITY_LABELS, type BjjSession, type SessionLog } from '../db/types'

const FATIGUE_EMOJI = ['', '😀', '🙂', '😐', '😮‍💨', '🥵']

type HistoryItem =
  | { kind: 'gym'; sortKey: string; session: SessionLog }
  | { kind: 'bjj'; sortKey: string; session: BjjSession }

export function History() {
  const items = useLiveQuery(async () => {
    const [gym, bjj] = await Promise.all([
      db.sessions.filter((s) => s.status !== 'in-progress').toArray(),
      db.bjjSessions.toArray(),
    ])
    const merged: HistoryItem[] = [
      ...gym.map((s) => ({ kind: 'gym' as const, sortKey: s.startedAt, session: s })),
      // BJJ sessions happen in the evening — sort them after any gym session that day
      ...bjj.map((s) => ({ kind: 'bjj' as const, sortKey: `${s.date}T21:00:00`, session: s })),
    ]
    return merged.sort((a, b) => b.sortKey.localeCompare(a.sortKey))
  })

  return (
    <div className="screen">
      <header className="screen-header">
        <h1>History</h1>
      </header>
      {items && items.length === 0 && (
        <p className="muted empty-state">No sessions yet — gym workouts and BJJ sessions will show up here.</p>
      )}
      <ul className="session-list">
        {items?.map((item) =>
          item.kind === 'gym' ? (
            <GymRow key={item.session.id} session={item.session} />
          ) : (
            <BjjRow key={item.session.id} session={item.session} />
          ),
        )}
      </ul>
    </div>
  )
}

function GymRow({ session }: { session: SessionLog }) {
  const setCount = session.exercises.reduce((n, e) => n + e.sets.length, 0)
  return (
    <li>
      <Link to={`/history/${session.id}`} className="session-item">
        <div className="session-item-main">
          <span className="session-day">{session.dayName}</span>
          <span className="muted">
            {formatDate(session.date)} · {setCount} sets
            {session.status === 'abandoned' ? ' · abandoned' : ''}
          </span>
        </div>
        {session.bjjFatigue && <span className="session-fatigue">{FATIGUE_EMOJI[session.bjjFatigue]}</span>}
      </Link>
    </li>
  )
}

function BjjRow({ session }: { session: BjjSession }) {
  const remove = () => {
    if (window.confirm('Delete this BJJ session?')) void deleteBjjSession(session.id)
  }
  return (
    <li>
      <div className="session-item session-item-bjj">
        <div className="session-item-main">
          <span className="session-day">🥋 BJJ — {BJJ_INTENSITY_LABELS[session.intensity]}</span>
          <span className="muted">
            {formatDate(session.date)} · {session.durationMin} min
          </span>
          {session.notes && <span className="muted small">“{session.notes}”</span>}
        </div>
        <button className="btn-ghost" onClick={remove}>
          ✕
        </button>
      </div>
    </li>
  )
}
