import { useState } from 'react'
import type { RepUnit, SetLog } from '../db/types'
import { RpePicker } from './RpePicker'

interface Props {
  setNumber: number
  logged: SetLog | undefined
  prefillWeightKg: number
  prefillReps: number
  weightStepKg: number
  repUnit: RepUnit
  onLog: (set: SetLog) => void
}

export function SetRow({ setNumber, logged, prefillWeightKg, prefillReps, weightStepKg, repUnit, onLog }: Props) {
  const [weight, setWeight] = useState<number>(logged?.weightKg ?? prefillWeightKg)
  const [reps, setReps] = useState<number>(logged?.reps ?? prefillReps)
  const [rpe, setRpe] = useState<number | undefined>(logged?.rpe)
  const [showRpe, setShowRpe] = useState(false)

  const step = weightStepKg > 0 ? weightStepKg : 2.5
  const repLabel = repUnit === 'seconds' ? 's' : repUnit === 'meters' ? 'm' : 'reps'

  const log = () => {
    onLog({
      setNumber,
      weightKg: weight,
      reps,
      rpe,
      loggedAt: new Date().toISOString(),
    })
    setShowRpe(false)
  }

  return (
    <div className={`set-row ${logged ? 'set-row-logged' : ''}`}>
      <div className="set-row-main">
        <span className="set-number">{setNumber}</span>
        <div className="stepper">
          <button className="stepper-btn" onClick={() => setWeight((w) => Math.max(0, round1(w - step)))}>−</button>
          <span className="stepper-value">
            {round1(weight)}
            <small>kg</small>
          </span>
          <button className="stepper-btn" onClick={() => setWeight((w) => round1(w + step))}>+</button>
        </div>
        <div className="stepper">
          <button className="stepper-btn" onClick={() => setReps((r) => Math.max(0, r - 1))}>−</button>
          <span className="stepper-value">
            {reps}
            <small>{repLabel}</small>
          </span>
          <button className="stepper-btn" onClick={() => setReps((r) => r + 1)}>+</button>
        </div>
        <button className={`rpe-toggle ${rpe !== undefined ? 'rpe-toggle-set' : ''}`} onClick={() => setShowRpe((s) => !s)}>
          {rpe !== undefined ? `@${rpe}` : 'RPE'}
        </button>
        <button className={logged ? 'btn-logged' : 'btn-log'} onClick={log}>
          {logged ? '✓' : 'Log'}
        </button>
      </div>
      {showRpe && <RpePicker value={rpe} onChange={setRpe} />}
    </div>
  )
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
