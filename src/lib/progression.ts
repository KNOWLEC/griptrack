import type { Exercise, ExerciseLog } from '../db/types'

export type Direction = 'up' | 'hold' | 'down' | 'none'

export interface Suggestion {
  weightKg?: number
  direction: Direction
  note: string
}

const FATIGUE_GATE = 4 // mean bjjFatigue >= this suppresses increases
const RPE_HARD_STOP = 9.5

/**
 * Built-in fallback double progression. Pure function — computes a suggested
 * target at session start; never writes program revisions.
 *
 * priorLogs: completed logs for this exercise, newest first (up to 2).
 * meanFatigue: mean bjjFatigue over the last ~3 completed sessions.
 */
export function suggestTargets(
  exercise: Exercise,
  priorLogs: ExerciseLog[],
  meanFatigue: number | undefined,
): Suggestion {
  const base = exercise.targetWeightKg

  if (exercise.progression === 'none') {
    return { weightKg: base, direction: 'none', note: '' }
  }

  const last = priorLogs[0]
  const lastWorking = last?.sets.filter((s) => !s.isWarmup) ?? []
  if (!last || lastWorking.length === 0) {
    return { weightKg: base, direction: 'hold', note: base ? 'Program target' : 'Pick a starting weight (RPE 7)' }
  }

  const lastWeight = Math.max(...lastWorking.map((s) => s.weightKg))
  const targetRpe = exercise.targetRpe ?? 8

  if (exercise.progression === 'hold') {
    return { weightKg: lastWeight, direction: 'hold', note: 'Same as last time' }
  }

  // Back-off: any RPE >= 9.5 last session, or below repRangeMin in both of the
  // last two sessions.
  const anyHardStop = lastWorking.some((s) => (s.rpe ?? 0) >= RPE_HARD_STOP)
  const failedFloor = (log: ExerciseLog) =>
    log.sets.filter((s) => !s.isWarmup).some((s) => s.reps < exercise.repRangeMin)
  const failedTwice = priorLogs.length >= 2 && failedFloor(priorLogs[0]) && failedFloor(priorLogs[1])
  if (anyHardStop || failedTwice) {
    const reduced = roundToIncrement(lastWeight * 0.95, 2.5)
    return {
      weightKg: reduced,
      direction: 'down',
      note: anyHardStop ? 'RPE too high last time — backing off 5%' : 'Missed rep floor twice — backing off 5%',
    }
  }

  // Increase: every working set hit the top of the rep range at <= target RPE.
  const allTopped = lastWorking.every(
    (s) => s.reps >= exercise.repRangeMax && (s.rpe === undefined || s.rpe <= targetRpe),
  )
  if (allTopped) {
    if (meanFatigue !== undefined && meanFatigue >= FATIGUE_GATE) {
      return {
        weightKg: lastWeight,
        direction: 'hold',
        note: 'High BJJ fatigue — holding the load this session',
      }
    }
    const inc = exercise.loadIncrementKg
    if (inc <= 0) {
      return { weightKg: lastWeight, direction: 'hold', note: 'Topped the range — add a rep or slow the tempo' }
    }
    return {
      weightKg: lastWeight + inc,
      direction: 'up',
      note: `Topped the range last time — up ${inc}kg`,
    }
  }

  // Hold: reps in range but below max, or RPE above target but under 9.5.
  return { weightKg: lastWeight, direction: 'hold', note: 'Same weight — add reps' }
}

export function roundToIncrement(kg: number, increment: number): number {
  return Math.round(kg / increment) * increment
}
