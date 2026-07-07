import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import {
  getCurrentRevision,
  getInProgressSession,
  getSettings,
  recentLogsForExercise,
  recentMeanFatigue,
  startSession,
} from '../db/repo'
import { suggestDayForToday, nextScheduledDay, WEEKDAY_NAMES } from '../lib/dates'
import { suggestTargets, type Suggestion } from '../lib/progression'
import type { WorkoutDay } from '../db/types'
import { BjjLogCard } from '../components/BjjLogCard'

const DIRECTION_BADGE = { up: '↑', hold: '→', down: '↓', none: '' } as const

export function Today() {
  const navigate = useNavigate()
  const [overrideDayId, setOverrideDayId] = useState<string>()

  const revision = useLiveQuery(getCurrentRevision)
  const inProgress = useLiveQuery(getInProgressSession)
  const settings = useLiveQuery(getSettings)

  const program = revision?.program
  const suggestedDay = program ? suggestDayForToday(program) : undefined
  const day: WorkoutDay | undefined =
    (overrideDayId ? program?.days.find((d) => d.id === overrideDayId) : undefined) ?? suggestedDay

  const suggestions = useLiveQuery(
    async () => {
      if (!day || !settings) return undefined
      const meanFatigue = await recentMeanFatigue()
      const out = new Map<string, Suggestion>()
      for (const ex of day.exercises) {
        if (!settings.autoProgressionOn) {
          out.set(ex.id, { weightKg: ex.targetWeightKg, direction: 'none', note: '' })
          continue
        }
        const logs = await recentLogsForExercise(ex.id)
        out.set(ex.id, suggestTargets(ex, logs.map((l) => l.log), meanFatigue))
      }
      return out
    },
    [day?.id, settings?.autoProgressionOn],
  )

  const lastReview = useLiveQuery(() =>
    db.coachReviews.orderBy('requestedAt').reverse().filter((r) => r.status === 'applied' || r.status === 'received').first(),
  )

  if (!program || !revision) return <div className="screen" />

  const start = async () => {
    if (!day) return
    await startSession(day, revision.id)
    navigate('/workout')
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <h1>Today</h1>
        <span className="muted">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
      </header>

      <div className="day-picker">
        <select value={day?.id ?? ''} onChange={(e) => setOverrideDayId(e.target.value || undefined)}>
          {!suggestedDay && <option value="">Rest day — pick a session</option>}
          {program.days.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
              {d.id === suggestedDay?.id ? ' (scheduled)' : ''}
            </option>
          ))}
        </select>
      </div>

      {day ? (
        <>
          <ul className="exercise-list">
            {day.exercises.map((ex) => {
              const s = suggestions?.get(ex.id)
              const unit = ex.repUnit === 'seconds' ? 's' : ex.repUnit === 'meters' ? 'm' : ''
              return (
                <li key={ex.id} className="exercise-item">
                  <div className="exercise-item-head">
                    <span className="exercise-name">{ex.name}</span>
                    {s && s.direction !== 'none' && (
                      <span className={`badge badge-${s.direction}`}>{DIRECTION_BADGE[s.direction]}</span>
                    )}
                  </div>
                  <span className="exercise-target">
                    {ex.targetSets}×{ex.repRangeMin === ex.repRangeMax ? ex.repRangeMax : `${ex.repRangeMin}-${ex.repRangeMax}`}
                    {unit}
                    {ex.perSide ? '/side' : ''}
                    {s?.weightKg ? ` @ ${s.weightKg}kg` : ''}
                    {ex.targetRpe ? ` · RPE ${ex.targetRpe}` : ''}
                  </span>
                  {s?.note && <span className="exercise-note">{s.note}</span>}
                </li>
              )
            })}
          </ul>
          <button className="btn-primary btn-big" onClick={inProgress ? () => navigate('/workout') : start}>
            {inProgress ? 'Resume Workout' : 'Start Workout'}
          </button>
        </>
      ) : (
        <RestDay programDayInfo={nextScheduledDay(program)} />
      )}

      <BjjLogCard />

      {lastReview?.coachingNotes && (
        <div className="coach-note-card">
          <span className="coach-note-title">Latest coach note</span>
          <p>{lastReview.coachingNotes.length > 200 ? lastReview.coachingNotes.slice(0, 200) + '…' : lastReview.coachingNotes}</p>
        </div>
      )}
    </div>
  )
}

function RestDay({ programDayInfo }: { programDayInfo: { day: WorkoutDay; weekday: number } | undefined }) {
  return (
    <div className="rest-day">
      <p>No session scheduled today — recover well.</p>
      {programDayInfo && (
        <p className="muted">
          Next up: {programDayInfo.day.name} on {WEEKDAY_NAMES[programDayInfo.weekday]}. Or pick a day above to train anyway.
        </p>
      )}
    </div>
  )
}
