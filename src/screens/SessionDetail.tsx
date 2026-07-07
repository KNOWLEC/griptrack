import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams } from 'react-router-dom'
import { db } from '../db/db'
import { completedSessions } from '../db/repo'
import { formatDate } from '../lib/dates'

export function SessionDetail() {
  const { id } = useParams()
  const session = useLiveQuery(() => (id ? db.sessions.get(id) : undefined), [id])

  const trends = useLiveQuery(async () => {
    if (!session) return undefined
    const all = await completedSessions()
    const out = new Map<string, number[]>()
    for (const ex of session.exercises) {
      const points: number[] = []
      for (const s of all) {
        const log = s.exercises.find((e) => e.exerciseId === ex.exerciseId && !e.substitutedFor)
        const working = log?.sets.filter((set) => !set.isWarmup) ?? []
        if (working.length > 0) points.push(Math.max(...working.map((set) => set.weightKg)))
      }
      out.set(ex.exerciseId, points.slice(-8))
    }
    return out
  }, [session?.id])

  if (!session) return <div className="screen" />

  return (
    <div className="screen">
      <header className="screen-header">
        <Link to="/history" className="btn-ghost">
          ‹ Back
        </Link>
        <h1>{session.dayName}</h1>
      </header>
      <p className="muted">
        {formatDate(session.date)}
        {session.bjjFatigue ? ` · BJJ fatigue ${session.bjjFatigue}/5` : ''}
      </p>
      {session.sessionNotes && <p className="session-notes">“{session.sessionNotes}”</p>}

      {session.exercises.map((ex) => (
        <div key={ex.exerciseId} className="detail-card">
          <div className="detail-card-head">
            <h3>
              {ex.exerciseName}
              {ex.substitutedFor && <span className="muted"> (for {ex.substitutedFor})</span>}
            </h3>
            <Sparkline points={trends?.get(ex.exerciseId) ?? []} />
          </div>
          <table className="set-table">
            <tbody>
              {ex.sets.map((set) => (
                <tr key={set.setNumber}>
                  <td className="muted">#{set.setNumber}</td>
                  <td>{set.weightKg}kg</td>
                  <td>× {set.reps}</td>
                  <td className="muted">{set.rpe !== undefined ? `@${set.rpe}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null
  const w = 80
  const h = 24
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const coords = points
    .map((p, i) => `${(i / (points.length - 1)) * w},${h - 3 - ((p - min) / range) * (h - 6)}`)
    .join(' ')
  return (
    <svg className="sparkline" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={coords} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}
