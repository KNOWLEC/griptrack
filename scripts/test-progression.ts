// Unit checks for the fallback progression engine.
// Run: node --experimental-strip-types scripts/test-progression.ts
import { suggestTargets } from '../src/lib/progression.ts'
import type { Exercise, ExerciseLog } from '../src/db/types.ts'

const squat: Exercise = {
  id: 'back-squat',
  name: 'Back Squat',
  targetSets: 4,
  repRangeMin: 4,
  repRangeMax: 6,
  targetRpe: 7,
  restSeconds: 180,
  loadIncrementKg: 5,
  progression: 'double',
}

function log(sets: [number, number, number?][]): ExerciseLog {
  return {
    exerciseId: 'back-squat',
    exerciseName: 'Back Squat',
    sets: sets.map(([weightKg, reps, rpe], i) => ({
      setNumber: i + 1,
      weightKg,
      reps,
      rpe,
      loggedAt: '2026-07-01T12:00:00Z',
    })),
  }
}

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`)
  if (!ok) failures++
}

// 1. No prior log → program target
let s = suggestTargets({ ...squat, targetWeightKg: 100 }, [], undefined)
check('no prior log: weight', s.weightKg, 100)
check('no prior log: direction', s.direction, 'hold')

// 2. Increase: all sets topped the range at <= target RPE
s = suggestTargets(squat, [log([[100, 6, 7], [100, 6, 7], [100, 6, 6.5], [100, 6, 7]])], 2)
check('increase: weight', s.weightKg, 105)
check('increase: direction', s.direction, 'up')

// 3. Hold: reps in range but below max
s = suggestTargets(squat, [log([[100, 6, 7], [100, 5, 7.5], [100, 5, 8], [100, 4, 8]])], 2)
check('hold: weight', s.weightKg, 100)
check('hold: direction', s.direction, 'hold')

// 4. Back-off: RPE >= 9.5 last session
s = suggestTargets(squat, [log([[100, 6, 8], [100, 5, 9.5], [100, 4, 9.5], [100, 4, 9]])], 2)
check('back-off rpe: weight', s.weightKg, 95)
check('back-off rpe: direction', s.direction, 'down')

// 5. Back-off: below rep floor in both of last two sessions
s = suggestTargets(squat, [log([[100, 3, 8], [100, 3, 8]]), log([[100, 3, 8], [100, 3, 8]])], 2)
check('back-off floor twice: direction', s.direction, 'down')
check('back-off floor twice: weight', s.weightKg, 95)

// 6. Floor missed only once → not a back-off (hold, add reps)
s = suggestTargets(squat, [log([[100, 3, 8]]), log([[100, 5, 7]])], 2)
check('floor missed once: direction', s.direction, 'hold')

// 7. Fatigue gate: topped the range but mean fatigue >= 4 → hold
s = suggestTargets(squat, [log([[100, 6, 7], [100, 6, 7], [100, 6, 7], [100, 6, 7]])], 4.3)
check('fatigue gate: weight', s.weightKg, 100)
check('fatigue gate: direction', s.direction, 'hold')

// 8. progression 'hold' → always last weight
s = suggestTargets({ ...squat, progression: 'hold' }, [log([[20, 12, 7]])], 2)
check('hold mode: weight', s.weightKg, 20)

// 9. progression 'none' → no suggestion churn
s = suggestTargets({ ...squat, progression: 'none', targetWeightKg: undefined }, [log([[0, 20]])], 2)
check('none mode: direction', s.direction, 'none')

// 10. Warmup sets ignored: warmup missed floor but working sets topped → increase
const withWarmup: ExerciseLog = {
  exerciseId: 'back-squat',
  exerciseName: 'Back Squat',
  sets: [
    { setNumber: 1, weightKg: 60, reps: 3, isWarmup: true, loggedAt: '2026-07-01T12:00:00Z' },
    { setNumber: 2, weightKg: 100, reps: 6, rpe: 7, loggedAt: '2026-07-01T12:05:00Z' },
    { setNumber: 3, weightKg: 100, reps: 6, rpe: 7, loggedAt: '2026-07-01T12:10:00Z' },
  ],
}
s = suggestTargets(squat, [withWarmup], 2)
check('warmups ignored: direction', s.direction, 'up')
check('warmups ignored: weight', s.weightKg, 105)

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nAll progression checks passed')
