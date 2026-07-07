import type { Exercise, Program, ProgramChange } from '../db/types'

interface Props {
  change: ProgramChange
  program: Program
  selected: boolean
  onToggle: () => void
}

const ACTION_LABELS = { swap: 'Swap', add: 'Add', remove: 'Remove' } as const

export function ProgramChangeCard({ change, program, selected, onToggle }: Props) {
  const day = program.days.find((d) => d.id === change.dayId)
  const existing = day?.exercises.find((e) => e.id === change.exerciseId)

  return (
    <label className={`adjustment-card ${selected ? 'adjustment-card-selected' : ''}`}>
      <div className="adjustment-head">
        <input type="checkbox" checked={selected} onChange={onToggle} />
        <span className={`change-action change-action-${change.action}`}>
          {ACTION_LABELS[change.action]}
        </span>
        <span className="muted small">{day?.name ?? change.dayId}</span>
      </div>
      <div className="change-detail">
        {change.action === 'swap' && (
          <>
            <span className="old">{existing?.name ?? change.exerciseId}</span> →{' '}
            <strong>{change.newExercise?.name}</strong> <ExerciseSpec ex={change.newExercise} />
          </>
        )}
        {change.action === 'add' && (
          <>
            <strong>{change.newExercise?.name}</strong> <ExerciseSpec ex={change.newExercise} />
          </>
        )}
        {change.action === 'remove' && (
          <span className="old">{existing?.name ?? change.exerciseId}</span>
        )}
      </div>
      <p className="adjustment-reason">{change.reason}</p>
      {change.flagged && <p className="adjustment-flag">⚠ {change.flagged}</p>}
    </label>
  )
}

function ExerciseSpec({ ex }: { ex: Exercise | undefined }) {
  if (!ex) return null
  return (
    <span className="muted">
      ({ex.targetSets}×
      {ex.repRangeMin === ex.repRangeMax ? ex.repRangeMax : `${ex.repRangeMin}-${ex.repRangeMax}`}
      {ex.targetRpe ? ` @RPE ${ex.targetRpe}` : ''})
    </span>
  )
}
