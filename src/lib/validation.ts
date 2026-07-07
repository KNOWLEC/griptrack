import { z } from 'zod'

// ---------- Coach review response (mirrors backend/coach_schema.py) ----------

export const adjustmentChangesSchema = z
  .object({
    targetWeightKg: z.number().positive().optional(),
    targetSets: z.number().int().min(1).max(10).optional(),
    repRangeMin: z.number().int().min(1).max(50).optional(),
    repRangeMax: z.number().int().min(1).max(100).optional(),
    targetRpe: z.number().min(5).max(10).optional(),
  })
  .strict()

export const exerciseAdjustmentSchema = z
  .object({
    dayId: z.string(),
    exerciseId: z.string(),
    changes: adjustmentChangesSchema,
    reason: z.string(),
  })
  .strict()

const coachNewExerciseSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    targetSets: z.number().int().min(1).max(10),
    repRangeMin: z.number().int().min(1).max(100),
    repRangeMax: z.number().int().min(1).max(100),
    targetRpe: z.number().min(5).max(10).optional(),
    restSeconds: z.number().int().min(15).max(600),
    targetWeightKg: z.number().positive().optional(),
    loadIncrementKg: z.number().min(0).max(20),
    progression: z.enum(['double', 'hold', 'none']),
    notes: z.string().optional(),
  })
  .strict()

export const programChangeSchema = z
  .object({
    action: z.enum(['swap', 'add', 'remove']),
    dayId: z.string(),
    exerciseId: z.string(),
    newExercise: coachNewExerciseSchema.optional(),
    reason: z.string(),
  })
  .strict()

export const coachResponseSchema = z.object({
  coachingNotes: z.string(),
  adjustments: z.array(exerciseAdjustmentSchema),
  programChanges: z.array(programChangeSchema).default([]),
})

export type CoachResponse = z.infer<typeof coachResponseSchema>

// ---------- Backup file ----------

const setLogSchema = z.object({
  setNumber: z.number(),
  weightKg: z.number(),
  reps: z.number(),
  rpe: z.number().optional(),
  isWarmup: z.boolean().optional(),
  loggedAt: z.string(),
})

const exerciseLogSchema = z.object({
  exerciseId: z.string(),
  exerciseName: z.string(),
  substitutedFor: z.string().optional(),
  sets: z.array(setLogSchema),
  notes: z.string().optional(),
})

const sessionSchema = z.object({
  id: z.string(),
  programRevisionId: z.string(),
  dayId: z.string(),
  dayName: z.string(),
  date: z.string(),
  startedAt: z.string(),
  endedAt: z.string().optional(),
  status: z.enum(['in-progress', 'completed', 'abandoned']),
  exercises: z.array(exerciseLogSchema),
  sessionNotes: z.string().optional(),
  bjjFatigue: z.number().int().min(1).max(5).optional(),
})

const exerciseSchema = z.object({
  id: z.string(),
  name: z.string(),
  targetSets: z.number(),
  repRangeMin: z.number(),
  repRangeMax: z.number(),
  repUnit: z.enum(['reps', 'seconds', 'meters']).optional(),
  perSide: z.boolean().optional(),
  targetRpe: z.number().optional(),
  restSeconds: z.number(),
  targetWeightKg: z.number().optional(),
  loadIncrementKg: z.number(),
  progression: z.enum(['double', 'hold', 'none']),
  notes: z.string().optional(),
  substitutions: z.array(z.string()).optional(),
})

const programSchema = z.object({
  id: z.string(),
  name: z.string(),
  days: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      weekdayHints: z.array(z.number()),
      exercises: z.array(exerciseSchema),
    }),
  ),
})

const revisionSchema = z.object({
  id: z.string(),
  programId: z.string(),
  revision: z.number(),
  createdAt: z.string(),
  source: z.enum(['seed', 'manual', 'coach-review', 'revert']),
  sourceRef: z.string().optional(),
  note: z.string().optional(),
  program: programSchema,
})

const coachReviewSchema = z.object({
  id: z.string(),
  requestedAt: z.string(),
  baseRevisionId: z.string(),
  status: z.enum(['pending', 'received', 'applied', 'rejected', 'error']),
  coachingNotes: z.string().optional(),
  adjustments: z
    .array(exerciseAdjustmentSchema.extend({ flagged: z.string().optional() }))
    .optional(),
  programChanges: z
    .array(programChangeSchema.extend({ flagged: z.string().optional() }))
    .optional(),
  appliedRevisionId: z.string().optional(),
  error: z.string().optional(),
  rawResponse: z.string().optional(),
})

const bjjSessionSchema = z.object({
  id: z.string(),
  date: z.string(),
  loggedAt: z.string(),
  durationMin: z.number(),
  intensity: z.number().int().min(1).max(5),
  notes: z.string().optional(),
})

const settingsSchema = z.object({
  id: z.literal('singleton'),
  backendUrl: z.string(),
  backendSecret: z.string(),
  units: z.enum(['kg', 'lb']),
  restTimerSoundOn: z.boolean(),
  autoProgressionOn: z.boolean(),
})

export const backupFileSchema = z.object({
  app: z.literal('griptrack'),
  version: z.union([z.literal(1), z.literal(2)]),
  exportedAt: z.string(),
  programRevisions: z.array(revisionSchema),
  sessions: z.array(sessionSchema),
  coachReviews: z.array(coachReviewSchema),
  settings: z.array(settingsSchema),
  bjjSessions: z.array(bjjSessionSchema).default([]), // absent in v1 backups
})

export type BackupFile = z.infer<typeof backupFileSchema>
