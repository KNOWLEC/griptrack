import { db } from '../db/db'
import {
  appendRevision,
  completedSessions,
  findExercise,
  getCurrentRevision,
  getSettings,
} from '../db/repo'
import type { CoachReview, ExerciseAdjustment, Program } from '../db/types'
import { coachResponseSchema } from './validation'
import { daysAgoStr } from './dates'

const MAX_WEIGHT_CHANGE = 0.15 // sanity clamp on AI weight adjustments

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
  sinceDate: string
}

export async function reviewPayloadSummary(): Promise<ReviewSummary> {
  const since = daysAgoStr(28)
  const sessions = await completedSessions(since)
  return { sessionCount: sessions.length, sinceDate: since }
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
  const sessions = await completedSessions(since)

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
    const updated: CoachReview = {
      ...review,
      status: 'received',
      coachingNotes: parsed.data.coachingNotes,
      adjustments,
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

/** Apply the selected adjustments as a new program revision. */
export async function applyReview(
  reviewId: string,
  selectedIndices: number[],
): Promise<void> {
  const review = await db.coachReviews.get(reviewId)
  if (!review || !review.adjustments) throw new Error('Review not found')
  const revision = await getCurrentRevision()
  if (!revision) throw new Error('No program found')

  const program = structuredClone(revision.program)
  let applied = 0
  for (const i of selectedIndices) {
    const adj = review.adjustments[i]
    if (!adj) continue
    const exercise = findExercise(program, adj.dayId, adj.exerciseId)
    if (!exercise) continue
    Object.assign(exercise, adj.changes)
    applied++
  }
  if (applied === 0) throw new Error('No applicable adjustments selected')

  const newRev = await appendRevision(
    program,
    'coach-review',
    review.id,
    `Coach review: ${applied} adjustment${applied === 1 ? '' : 's'} applied`,
  )
  await db.coachReviews.update(reviewId, {
    status: 'applied',
    appliedRevisionId: newRev.id,
  })
}

export async function rejectReview(reviewId: string): Promise<void> {
  await db.coachReviews.update(reviewId, { status: 'rejected' })
}
