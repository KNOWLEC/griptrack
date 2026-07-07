import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { appendRevision, getCurrentRevision, listRevisions, revertToRevision } from '../db/repo'
import type { Exercise, Program } from '../db/types'

export function ProgramView() {
  const revision = useLiveQuery(getCurrentRevision)
  const revisions = useLiveQuery(listRevisions)
  const [draft, setDraft] = useState<Program>()
  const [showHistory, setShowHistory] = useState(false)
  const [openDayId, setOpenDayId] = useState<string>()

  if (!revision) return <div className="screen" />

  const editing = draft !== undefined
  const program = draft ?? revision.program

  const updateExercise = (dayId: string, exerciseId: string, patch: Partial<Exercise>) => {
    if (!draft) return
    const next = structuredClone(draft)
    const ex = next.days.find((d) => d.id === dayId)?.exercises.find((e) => e.id === exerciseId)
    if (ex) Object.assign(ex, patch)
    setDraft(next)
  }

  const save = async () => {
    if (!draft) return
    await appendRevision(draft, 'manual', undefined, 'Manual edit')
    setDraft(undefined)
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <h1>Program</h1>
        {editing ? (
          <span>
            <button className="btn-ghost" onClick={() => setDraft(undefined)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={save}>
              Save
            </button>
          </span>
        ) : (
          <button className="btn-ghost" onClick={() => setDraft(structuredClone(revision.program))}>
            Edit
          </button>
        )}
      </header>
      <p className="muted">
        {program.name} · revision {revision.revision} ({revision.source})
      </p>

      {program.days.map((day) => (
        <div key={day.id} className="detail-card">
          <button
            className="day-toggle"
            onClick={() => setOpenDayId(openDayId === day.id ? undefined : day.id)}
          >
            <h3>{day.name}</h3>
            <span className="muted">{openDayId === day.id ? '▾' : '▸'}</span>
          </button>
          {openDayId === day.id &&
            day.exercises.map((ex) => (
              <div key={ex.id} className="program-exercise">
                <span className="exercise-name">{ex.name}</span>
                {editing ? (
                  <div className="program-edit-grid">
                    <label>
                      Sets
                      <input
                        type="number"
                        value={ex.targetSets}
                        min={1}
                        onChange={(e) => updateExercise(day.id, ex.id, { targetSets: Number(e.target.value) })}
                      />
                    </label>
                    <label>
                      Reps min
                      <input
                        type="number"
                        value={ex.repRangeMin}
                        min={1}
                        onChange={(e) => updateExercise(day.id, ex.id, { repRangeMin: Number(e.target.value) })}
                      />
                    </label>
                    <label>
                      Reps max
                      <input
                        type="number"
                        value={ex.repRangeMax}
                        min={1}
                        onChange={(e) => updateExercise(day.id, ex.id, { repRangeMax: Number(e.target.value) })}
                      />
                    </label>
                    <label>
                      Weight kg
                      <input
                        type="number"
                        step="2.5"
                        value={ex.targetWeightKg ?? ''}
                        onChange={(e) =>
                          updateExercise(day.id, ex.id, {
                            targetWeightKg: e.target.value === '' ? undefined : Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      RPE
                      <input
                        type="number"
                        step="0.5"
                        min={5}
                        max={10}
                        value={ex.targetRpe ?? ''}
                        onChange={(e) =>
                          updateExercise(day.id, ex.id, {
                            targetRpe: e.target.value === '' ? undefined : Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      Rest s
                      <input
                        type="number"
                        step="15"
                        value={ex.restSeconds}
                        onChange={(e) => updateExercise(day.id, ex.id, { restSeconds: Number(e.target.value) })}
                      />
                    </label>
                  </div>
                ) : (
                  <span className="muted">
                    {ex.targetSets}×
                    {ex.repRangeMin === ex.repRangeMax ? ex.repRangeMax : `${ex.repRangeMin}-${ex.repRangeMax}`}
                    {ex.repUnit === 'seconds' ? 's' : ex.repUnit === 'meters' ? 'm' : ''}
                    {ex.perSide ? '/side' : ''}
                    {ex.targetWeightKg ? ` @ ${ex.targetWeightKg}kg` : ''}
                    {ex.targetRpe ? ` · RPE ${ex.targetRpe}` : ''}
                  </span>
                )}
              </div>
            ))}
        </div>
      ))}

      <button className="btn-ghost" onClick={() => setShowHistory((s) => !s)}>
        {showHistory ? 'Hide' : 'Show'} revision history ({revisions?.length ?? 0})
      </button>
      {showHistory &&
        revisions?.map((rev) => (
          <div key={rev.id} className="revision-item">
            <div>
              <span>
                Rev {rev.revision} <span className={`badge badge-src-${rev.source}`}>{rev.source}</span>
              </span>
              <span className="muted">
                {new Date(rev.createdAt).toLocaleString()}
                {rev.note ? ` — ${rev.note}` : ''}
              </span>
            </div>
            {rev.id !== revision.id && (
              <button
                className="btn-ghost"
                onClick={() => {
                  if (window.confirm(`Revert the program to revision ${rev.revision}?`)) {
                    void revertToRevision(rev.id)
                  }
                }}
              >
                Revert to this
              </button>
            )}
          </div>
        ))}
    </div>
  )
}
