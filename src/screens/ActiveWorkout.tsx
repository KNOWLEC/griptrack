import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import {
  finishSession,
  getInProgressSession,
  getSettings,
  logSet,
  recentLogsForExercise,
  recentMeanFatigue,
  substituteExercise,
} from '../db/repo'
import { suggestTargets, type Suggestion } from '../lib/progression'
import type { BjjFatigue, Exercise, SetLog } from '../db/types'
import { SetRow } from '../components/SetRow'
import { RestTimer } from '../components/RestTimer'
import { FatigueRating } from '../components/FatigueRating'

interface TimerState {
  startedAtMs: number
  durationSeconds: number
}

export function ActiveWorkout() {
  const navigate = useNavigate()
  const [exerciseIdx, setExerciseIdx] = useState(0)
  const [extraSets, setExtraSets] = useState<Record<string, number>>({})
  const [timer, setTimer] = useState<TimerState>()
  const [finishing, setFinishing] = useState(false)
  const [notes, setNotes] = useState('')
  const [fatigue, setFatigue] = useState<BjjFatigue>()

  const session = useLiveQuery(getInProgressSession)
  const settings = useLiveQuery(getSettings)
  const revision = useLiveQuery(
    () => (session ? db.programRevisions.get(session.programRevisionId) : undefined),
    [session?.programRevisionId],
  )

  const day = revision?.program.days.find((d) => d.id === session?.dayId)

  const suggestions = useLiveQuery(
    async () => {
      if (!day) return undefined
      const meanFatigue = await recentMeanFatigue()
      const out = new Map<string, Suggestion>()
      for (const ex of day.exercises) {
        const logs = await recentLogsForExercise(ex.id)
        out.set(ex.id, suggestTargets(ex, logs.map((l) => l.log), meanFatigue))
      }
      return out
    },
    [day?.id],
  )

  const sessionLoaded = session !== undefined
  if (!sessionLoaded) return <div className="screen" />
  if (!session) {
    navigate('/', { replace: true })
    return null
  }
  if (!day) return <div className="screen" />

  const idx = Math.min(exerciseIdx, day.exercises.length - 1)
  const exercise: Exercise = day.exercises[idx]
  const exLog = session.exercises.find((e) => e.exerciseId === exercise.id)
  const suggestion = suggestions?.get(exercise.id)
  const setCount = Math.max(exercise.targetSets, exLog?.sets.length ?? 0) + (extraSets[exercise.id] ?? 0)
  const loggedCount = session.exercises.reduce((n, e) => n + e.sets.length, 0)

  const handleLog = (set: SetLog) => {
    void logSet(session.id, exercise.id, set)
    setTimer({ startedAtMs: Date.now(), durationSeconds: exercise.restSeconds })
  }

  const handleFinish = async () => {
    await finishSession(session.id, notes.trim() || undefined, fatigue)
    navigate('/history')
  }

  const unit = exercise.repUnit ?? 'reps'
  const lastLoggedWeight = exLog?.sets.length ? exLog.sets[exLog.sets.length - 1].weightKg : undefined
  const prefillWeight = lastLoggedWeight ?? suggestion?.weightKg ?? exercise.targetWeightKg ?? 0

  return (
    <div className="screen screen-workout">
      <header className="screen-header">
        <h1>{day.name}</h1>
        <button className="btn-ghost" onClick={() => setFinishing(true)}>
          Finish
        </button>
      </header>

      <div className="exercise-pager">
        <button className="pager-btn" disabled={idx === 0} onClick={() => setExerciseIdx(idx - 1)}>
          ‹
        </button>
        <span className="pager-label">
          {idx + 1} / {day.exercises.length}
        </span>
        <button
          className="pager-btn"
          disabled={idx === day.exercises.length - 1}
          onClick={() => setExerciseIdx(idx + 1)}
        >
          ›
        </button>
      </div>

      <div className="workout-card" key={exercise.id}>
        <h2>{exLog?.exerciseName ?? exercise.name}</h2>
        <span className="exercise-target">
          {exercise.targetSets}×
          {exercise.repRangeMin === exercise.repRangeMax
            ? exercise.repRangeMax
            : `${exercise.repRangeMin}-${exercise.repRangeMax}`}
          {unit === 'seconds' ? 's' : unit === 'meters' ? 'm' : ''}
          {exercise.perSide ? '/side' : ''}
          {exercise.targetRpe ? ` · RPE ${exercise.targetRpe}` : ''} · rest {Math.round(exercise.restSeconds / 60 * 10) / 10}min
        </span>
        {suggestion?.note && <p className="exercise-note">{suggestion.note}</p>}
        {exercise.notes && <p className="exercise-cue">{exercise.notes}</p>}

        {exercise.substitutions && exercise.substitutions.length > 0 && (
          <select
            className="substitution-select"
            value={exLog?.exerciseName ?? exercise.name}
            onChange={(e) => void substituteExercise(session.id, exercise.id, e.target.value)}
          >
            <option value={exercise.name}>{exercise.name}</option>
            {exercise.substitutions.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>
        )}

        <div className="set-list">
          {Array.from({ length: setCount }, (_, i) => i + 1).map((setNumber) => (
            <SetRow
              key={`${exercise.id}-${setNumber}`}
              setNumber={setNumber}
              logged={exLog?.sets.find((s) => s.setNumber === setNumber)}
              prefillWeightKg={prefillWeight}
              prefillReps={exercise.repRangeMax}
              weightStepKg={exercise.loadIncrementKg || 2.5}
              repUnit={unit}
              onLog={handleLog}
            />
          ))}
        </div>
        <button
          className="btn-ghost"
          onClick={() => setExtraSets((m) => ({ ...m, [exercise.id]: (m[exercise.id] ?? 0) + 1 }))}
        >
          + Add set
        </button>
      </div>

      {timer && settings && (
        <RestTimer
          durationSeconds={timer.durationSeconds}
          startedAtMs={timer.startedAtMs}
          soundOn={settings.restTimerSoundOn}
          onDismiss={() => setTimer(undefined)}
        />
      )}

      {finishing && (
        <div className="sheet-backdrop" onClick={() => setFinishing(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2>Finish session</h2>
            <p className="muted">{loggedCount} sets logged</p>
            <label className="field-label">How beat up are you from BJJ?</label>
            <FatigueRating value={fatigue} onChange={setFatigue} />
            <label className="field-label">Session notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything worth remembering — tweaks, pain, PRs…"
              rows={3}
            />
            <button className="btn-primary btn-big" onClick={handleFinish}>
              Save & finish
            </button>
            <button className="btn-ghost" onClick={() => setFinishing(false)}>
              Keep training
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
