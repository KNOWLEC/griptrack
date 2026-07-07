import type { Exercise, ExerciseAdjustment } from '../db/types'

interface Props {
  adjustment: ExerciseAdjustment
  exercise: Exercise | undefined
  selected: boolean
  onToggle: () => void
  readOnly?: boolean
}

const FIELD_LABELS: Record<string, string> = {
  targetWeightKg: 'Weight',
  targetSets: 'Sets',
  repRangeMin: 'Min reps',
  repRangeMax: 'Max reps',
  targetRpe: 'RPE',
}

export function AdjustmentDiff({ adjustment, exercise, selected, onToggle, readOnly }: Props) {
  const changes = Object.entries(adjustment.changes) as [keyof typeof FIELD_LABELS, number][]
  return (
    <label className={`adjustment-card ${selected ? 'adjustment-card-selected' : ''}`}>
      <div className="adjustment-head">
        {!readOnly && <input type="checkbox" checked={selected} onChange={onToggle} />}
        <span className="adjustment-exercise">{exercise?.name ?? adjustment.exerciseId}</span>
      </div>
      <div className="adjustment-changes">
        {changes.map(([field, value]) => {
          const before = exercise?.[field as keyof Exercise]
          const unit = field === 'targetWeightKg' ? 'kg' : ''
          return (
            <span key={field} className="adjustment-change">
              {FIELD_LABELS[field]}: {before !== undefined ? `${before}${unit} → ` : ''}
              <strong>
                {value}
                {unit}
              </strong>
            </span>
          )
        })}
      </div>
      <p className="adjustment-reason">{adjustment.reason}</p>
      {adjustment.flagged && <p className="adjustment-flag">⚠ {adjustment.flagged}</p>}
    </label>
  )
}
