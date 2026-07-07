import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db/db'
import { formatDate } from '../lib/dates'

const FATIGUE_EMOJI = ['', '😀', '🙂', '😐', '😮‍💨', '🥵']

export function History() {
  const sessions = useLiveQuery(() =>
    db.sessions.orderBy('startedAt').reverse().filter((s) => s.status !== 'in-progress').toArray(),
  )

  return (
    <div className="screen">
      <header className="screen-header">
        <h1>History</h1>
      </header>
      {sessions && sessions.length === 0 && (
        <p className="muted empty-state">No sessions yet — your first workout will show up here.</p>
      )}
      <ul className="session-list">
        {sessions?.map((s) => {
          const setCount = s.exercises.reduce((n, e) => n + e.sets.length, 0)
          return (
            <li key={s.id}>
              <Link to={`/history/${s.id}`} className="session-item">
                <div className="session-item-main">
                  <span className="session-day">{s.dayName}</span>
                  <span className="muted">
                    {formatDate(s.date)} · {setCount} sets
                    {s.status === 'abandoned' ? ' · abandoned' : ''}
                  </span>
                </div>
                {s.bjjFatigue && <span className="session-fatigue">{FATIGUE_EMOJI[s.bjjFatigue]}</span>}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
