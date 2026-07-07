import { db } from '../db/db'
import {
  appendRevision,
  bjjSessionsSince,
  completedSessions,
  findExercise,
  getCurrentRevision,
  getSettings,
} from '../db/repo'
import {
  BJJ_INTENSITY_LABELS,
  type CoachReview,
  type ExerciseAdjustment,
  type Program,
  type ProgramChange,
} from '../db/types'
import { coachResponseSchema } from './validation'
import { daysAgoStr } from './dates'

const MAX_WEIGHT_CHANGE = 0.15 // sanity clamp on AI weight adjustments
const MAX_STRUCTURAL_CHANGES = 3 // flag anything beyond this many swaps/adds/removes

export async function pingBackend(url: string, secret: string): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-App-Secret': secret },
    body: JSON.stringify({ ping: true }),
  })
  if (!res.ok) throw new Error(`Backend responded ${res.status}`)
}

export interface ReviewSummary {
  sessionCount: number
  bjjCount: number
  sinceDate: string
}

export async function reviewPayloadSummary(): Promise<ReviewSummary> {
  const since = daysAgoStr(28)
  const [sessions, bjj] = await Promise.all([completedSessions(since), bjjSessionsSince(since)])
  return { sessionCount: sessions.length, bjjCount: bjj.length, sinceDate: since }
}

/** Request a coach review from the backend; stores the CoachReview record. */
export async function requestReview(): Promise<CoachReview> {
  const settings = await getSettings()
  if (!settings.backendUrl || !settings.backendSecret) {
    throw new Error('Backend not configured — set the URL and secret in Settings')
  }
  const revision = await getCurrentRevision()
  if (!revision) throw new Error('No program found')

  const since = daysAgoStr(28)
  const [sessions, bjjSessions] = await Promise.all([
    completedSessions(since),
    bjjSessionsSince(since),
  ])

  const review: CoachReview = {
    id: crypto.randomUUID(),
    requestedAt: new Date().toISOString(),
    baseRevisionId: revision.id,
    status: 'pending',
  }
  await db.coachReviews.add(review)

  try {
    const res = await fetch(settings.backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-App-Secret': settings.backendSecret },
      body: JSON.stringify({
        program: revision.program,
        sessions: sessions.map((s) => ({
          date: s.date,
          dayId: s.dayId,
          dayName: s.dayName,
          bjjFatigue: s.bjjFatigue,
          sessionNotes: s.sessionNotes,
          exercises: s.exercises.map((e) => ({
            exerciseId: e.exerciseId,
            exerciseName: e.exerciseName,
            substitutedFor: e.substitutedFor,
            notes: e.notes,
            sets: e.sets.map((set) => ({
              weightKg: set.weightKg,
              reps: set.reps,
              rpe: set.rpe,
              isWarmup: set.isWarmup,
            })),
          })),
        })),
        bjjSessions: bjjSessions.map((s) => ({
          date: s.date,
          durationMin: s.durationMin,
          intensity: s.intensity,
          intensityLabel: BJJ_INTENSITY_LABELS[s.intensity],
          notes: s.notes,
        })),
        context: {
          goal: 'BJJ performance (grip, hips, posterior chain, conditioning) + physique',
          bjjSchedule: 'BJJ Mon/Tue/Wed evenings, sometimes Fri or Sat',
          liftingSchedule: 'Lifts at lunchtime BEFORE evening BJJ on the same days, 3-4x/week',
          units: 'kg',
        },
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Backend error ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`)
    }
    const raw = await res.text()
    const parsed = coachResponseSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) throw new Error('Backend returned an unexpected response shape')

    const adjustments = sanitizeAdjustments(parsed.data.adjustments, revision.program)
    const programChanges = sanitizeProgramChanges(
      parsed.data.programChanges as ProgramChange[],
      revision.program,
    )
    const updated: CoachReview = {
      ...review,
      status: 'received',
      coachingNotes: parsed.data.coachingNotes,
      adjustments,
      programChanges,
      rawResponse: raw,
    }
    await db.coachReviews.put(updated)
    return updated
  } catch (err) {
    const updated: CoachReview = {
      ...review,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    }
    await db.coachReviews.put(updated)
    throw err
  }
}

/** Drop adjustments referencing unknown exercises; flag outsized weight changes. */
function sanitizeAdjustments(
  adjustments: ExerciseAdjustment[],
  program: Program,
): ExerciseAdjustment[] {
  const out: ExerciseAdjustment[] = []
  for (const adj of adjustments) {
    const exercise = findExercise(program, adj.dayId, adj.exerciseId)
    if (!exercise) continue
    const flagged: ExerciseAdjustment = { ...adj }
    const newWeight = adj.changes.targetWeightKg
    const oldWeight = exercise.targetWeightKg
    if (newWeight !== undefined && oldWeight !== undefined && oldWeight > 0) {
      const change = Math.abs(newWeight - oldWeight) / oldWeight
      if (change > MAX_WEIGHT_CHANGE) {
        flagged.flagged = `Weight change of ${Math.round(change * 100)}% exceeds the ±15% sanity limit`
      }
    }
    out.push(flagged)
  }
  return out
}

/** Drop structural changes that don't fit the current program; flag excess. */
function sanitizeProgramChanges(changes: ProgramChange[], program: Program): ProgramChange[] {
  const out: ProgramChange[] = []
  for (const change of changes) {
    const day = program.days.find((d) => d.id === change.dayId)
    if (!day) continue
    const existing = day.exercises.find((e) => e.id === change.exerciseId)
    const sanitized: ProgramChange = { ...change }

    if (change.action === 'remove') {
      if (!existing) continue
    } else if (change.action === 'swap') {
      if (!existing || !change.newExercise) continue
    } else if (change.action === 'add') {
      if (!change.newExercise) continue
      const idTaken = program.days.some((d) =>
        d.exercises.some((e) => e.id === change.newExercise!.id),
      )
      if (idTaken) {
        sanitized.flagged = 'New exercise id already exists in the program'
      }
    }

    if (out.length >= MAX_STRUCTURAL_CHANGES && !sanitized.flagged) {
      sanitized.flagged = `More than ${MAX_STRUCTURAL_CHANGES} structural changes in one review — apply with care`
    }
    out.push(sanitized)
  }
  return out
}

/** Apply the selected adjustments and structural changes as one new revision. */
export async function applyReview(
  reviewId: string,
  selectedAdjustments: number[],
  selectedChanges: number[] = [],
): Promise<void> {
  const review = await db.coachReviews.get(reviewId)
  if (!review) throw new Error('Review not found')
  const revision = await getCurrentRevision()
  if (!revision) throw new Error('No program found')

  const program = structuredClone(revision.program)
  let applied = 0

  for (const i of selectedAdjustments) {
    const adj = review.adjustments?.[i]
    if (!adj) continue
    const exercise = findExercise(program, adj.dayId, adj.exerciseId)
    if (!exercise) continue
    Object.assign(exercise, adj.changes)
    applied++
  }

  for (const i of selectedChanges) {
    const change = review.programChanges?.[i]
    if (!change) continue
    const day = program.days.find((d) => d.id === change.dayId)
    if (!day) continue
    const idx = day.exercises.findIndex((e) => e.id === change.exerciseId)
    if (change.action === 'remove') {
      if (idx < 0) continue
      day.exercises.splice(idx, 1)
    } else if (change.action === 'swap') {
      if (idx < 0 || !change.newExercise) continue
      day.exercises.splice(idx, 1, structuredClone(change.newExercise))
    } else if (change.action === 'add') {
      if (!change.newExercise) continue
      if (day.exercises.some((e) => e.id === change.newExercise!.id)) continue
      day.exercises.push(structuredClone(change.newExercise))
    }
    applied++
  }

  if (applied === 0) throw new Error('No applicable changes selected')

  const newRev = await appendRevision(
    program,
    'coach-review',
    review.id,
    `Coach review: ${applied} change${applied === 1 ? '' : 's'} applied`,
  )
  await db.coachReviews.update(reviewId, {
    status: 'applied',
    appliedRevisionId: newRev.id,
  })
}

export async function rejectReview(reviewId: string): Promise<void> {
  await db.coachReviews.update(reviewId, { status: 'rejected' })
}
