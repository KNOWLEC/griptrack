export type ProgressionMode = 'double' | 'hold' | 'none'
export type RepUnit = 'reps' | 'seconds' | 'meters'

export interface Exercise {
  id: string // stable slug, e.g. 'back-squat'
  name: string
  targetSets: number
  repRangeMin: number
  repRangeMax: number
  repUnit?: RepUnit // default 'reps'
  perSide?: boolean // e.g. split squats, Copenhagen plank
  targetRpe?: number
  restSeconds: number
  targetWeightKg?: number // undefined = bodyweight or "pick a weight"
  loadIncrementKg: number
  progression: ProgressionMode
  notes?: string
  substitutions?: string[]
}

export interface WorkoutDay {
  id: string
  name: string
  weekdayHints: number[] // 0=Sun..6=Sat, used by Today screen; not enforced
  exercises: Exercise[]
}

export interface Program {
  id: string
  name: string
  days: WorkoutDay[]
}

export type RevisionSource = 'seed' | 'manual' | 'coach-review' | 'revert'

export interface ProgramRevision {
  id: string
  programId: string
  revision: number // monotonic
  createdAt: string // ISO
  source: RevisionSource
  sourceRef?: string // CoachReview.id, or revision id reverted to
  note?: string
  program: Program // full immutable snapshot
}

export interface SetLog {
  setNumber: number
  weightKg: number
  reps: number
  rpe?: number // 6-10 in 0.5 steps
  isWarmup?: boolean
  loggedAt: string
}

export interface ExerciseLog {
  exerciseId: string
  exerciseName: string // denormalized so history survives program edits
  substitutedFor?: string
  sets: SetLog[]
  notes?: string
}

export type SessionStatus = 'in-progress' | 'completed' | 'abandoned'
export type BjjFatigue = 1 | 2 | 3 | 4 | 5

export interface SessionLog {
  id: string
  programRevisionId: string
  dayId: string
  dayName: string
  date: string // YYYY-MM-DD
  startedAt: string
  endedAt?: string
  status: SessionStatus
  exercises: ExerciseLog[]
  sessionNotes?: string
  bjjFatigue?: BjjFatigue // 1 fresh - 5 wrecked
}

// ---------- BJJ session log ----------

export type BjjIntensity = 1 | 2 | 3 | 4 | 5 // 1 drilling … 5 competition prep

export interface BjjSession {
  id: string
  date: string // YYYY-MM-DD (the evening of the session)
  loggedAt: string
  durationMin: number
  intensity: BjjIntensity
  notes?: string
}

export const BJJ_INTENSITY_LABELS: Record<BjjIntensity, string> = {
  1: 'Drilling',
  2: 'Light',
  3: 'Moderate',
  4: 'Hard rounds',
  5: 'Comp prep',
}

export interface AdjustmentChanges {
  targetWeightKg?: number
  targetSets?: number
  repRangeMin?: number
  repRangeMax?: number
  targetRpe?: number
}

export interface ExerciseAdjustment {
  dayId: string
  exerciseId: string
  changes: AdjustmentChanges
  reason: string
  flagged?: string // set client-side when a sanity check tripped
}

export type ProgramChangeAction = 'swap' | 'add' | 'remove'

export interface ProgramChange {
  action: ProgramChangeAction
  dayId: string
  exerciseId: string // existing exercise for swap/remove; equals newExercise.id for add
  newExercise?: Exercise // required for swap/add
  reason: string
  flagged?: string // set client-side when a sanity check tripped
}

export type ReviewStatus = 'pending' | 'received' | 'applied' | 'rejected' | 'error'

export interface CoachReview {
  id: string
  requestedAt: string
  baseRevisionId: string
  status: ReviewStatus
  coachingNotes?: string
  adjustments?: ExerciseAdjustment[]
  programChanges?: ProgramChange[]
  appliedRevisionId?: string
  error?: string
  rawResponse?: string
}

export interface AppSettings {
  id: 'singleton'
  backendUrl: string
  backendSecret: string
  units: 'kg' | 'lb'
  restTimerSoundOn: boolean
  autoProgressionOn: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'singleton',
  backendUrl: '',
  backendSecret: '',
  units: 'kg',
  restTimerSoundOn: true,
  autoProgressionOn: true,
}
