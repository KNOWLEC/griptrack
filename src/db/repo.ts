import { db } from './db'
import type {
  AppSettings,
  BjjFatigue,
  Exercise,
  ExerciseLog,
  Program,
  ProgramRevision,
  RevisionSource,
  SessionLog,
  SetLog,
  WorkoutDay,
} from './types'
import { DEFAULT_SETTINGS } from './types'

// ---------- Program revisions ----------

export async function getCurrentRevision(): Promise<ProgramRevision | undefined> {
  return db.programRevisions.orderBy('revision').last()
}

export async function listRevisions(): Promise<ProgramRevision[]> {
  return db.programRevisions.orderBy('revision').reverse().toArray()
}

export async function appendRevision(
  program: Program,
  source: RevisionSource,
  sourceRef?: string,
  note?: string,
): Promise<ProgramRevision> {
  return db.transaction('rw', db.programRevisions, async () => {
    const current = await db.programRevisions.orderBy('revision').last()
    const rev: ProgramRevision = {
      id: crypto.randomUUID(),
      programId: program.id,
      revision: (current?.revision ?? 0) + 1,
      createdAt: new Date().toISOString(),
      source,
      sourceRef,
      note,
      program: structuredClone(program),
    }
    await db.programRevisions.add(rev)
    return rev
  })
}

export async function revertToRevision(revisionId: string): Promise<ProgramRevision> {
  const target = await db.programRevisions.get(revisionId)
  if (!target) throw new Error('Revision not found')
  return appendRevision(
    target.program,
    'revert',
    target.id,
    `Reverted to revision ${target.revision}`,
  )
}

// ---------- Sessions ----------

export async function getInProgressSession(): Promise<SessionLog | undefined> {
  return db.sessions.where('status').equals('in-progress').first()
}

export async function startSession(day: WorkoutDay, revisionId: string): Promise<SessionLog> {
  const existing = await getInProgressSession()
  if (existing) return existing
  const now = new Date()
  const session: SessionLog = {
    id: crypto.randomUUID(),
    programRevisionId: revisionId,
    dayId: day.id,
    dayName: day.name,
    date: toDateStr(now),
    startedAt: now.toISOString(),
    status: 'in-progress',
    exercises: day.exercises.map((ex) => ({
      exerciseId: ex.id,
      exerciseName: ex.name,
      sets: [],
    })),
  }
  await db.sessions.add(session)
  return session
}

export async function logSet(
  sessionId: string,
  exerciseId: string,
  set: SetLog,
): Promise<void> {
  await db.transaction('rw', db.sessions, async () => {
    const session = await db.sessions.get(sessionId)
    if (!session) throw new Error('Session not found')
    const ex = session.exercises.find((e) => e.exerciseId === exerciseId)
    if (!ex) throw new Error('Exercise not in session')
    const idx = ex.sets.findIndex((s) => s.setNumber === set.setNumber)
    if (idx >= 0) ex.sets[idx] = set
    else ex.sets.push(set)
    ex.sets.sort((a, b) => a.setNumber - b.setNumber)
    await db.sessions.put(session)
  })
}

export async function substituteExercise(
  sessionId: string,
  exerciseId: string,
  substituteName: string,
): Promise<void> {
  await db.transaction('rw', db.sessions, async () => {
    const session = await db.sessions.get(sessionId)
    if (!session) return
    const ex = session.exercises.find((e) => e.exerciseId === exerciseId)
    if (!ex) return
    if (substituteName === ex.exerciseName) return
    ex.substitutedFor = ex.substitutedFor ?? ex.exerciseName
    ex.exerciseName = substituteName
    await db.sessions.put(session)
  })
}

export async function finishSession(
  sessionId: string,
  notes: string | undefined,
  bjjFatigue: BjjFatigue | undefined,
): Promise<void> {
  // Drop exercises with no logged sets; keep the session honest.
  await db.transaction('rw', db.sessions, async () => {
    const session = await db.sessions.get(sessionId)
    if (!session) return
    session.exercises = session.exercises.filter((e) => e.sets.length > 0)
    session.status = session.exercises.length > 0 ? 'completed' : 'abandoned'
    session.endedAt = new Date().toISOString()
    session.sessionNotes = notes || undefined
    session.bjjFatigue = bjjFatigue
    await db.sessions.put(session)
  })
}

export async function abandonSession(sessionId: string): Promise<void> {
  await db.sessions.update(sessionId, {
    status: 'abandoned',
    endedAt: new Date().toISOString(),
  })
}

export async function completedSessions(sinceDate?: string): Promise<SessionLog[]> {
  let sessions = await db.sessions.where('status').equals('completed').toArray()
  if (sinceDate) sessions = sessions.filter((s) => s.date >= sinceDate)
  return sessions.sort((a, b) => a.startedAt.localeCompare(b.startedAt))
}

/** Most recent completed logs for one exercise, newest first. */
export async function recentLogsForExercise(
  exerciseId: string,
  limit = 2,
): Promise<{ session: SessionLog; log: ExerciseLog }[]> {
  const sessions = await completedSessions()
  const out: { session: SessionLog; log: ExerciseLog }[] = []
  for (let i = sessions.length - 1; i >= 0 && out.length < limit; i--) {
    const log = sessions[i].exercises.find(
      (e) => e.exerciseId === exerciseId && !e.substitutedFor,
    )
    if (log && log.sets.some((s) => !s.isWarmup)) out.push({ session: sessions[i], log })
  }
  return out
}

/** Mean BJJ-fatigue over the last n completed sessions that rated it. */
export async function recentMeanFatigue(n = 3): Promise<number | undefined> {
  const sessions = await completedSessions()
  const rated = sessions.filter((s) => s.bjjFatigue !== undefined).slice(-n)
  if (rated.length === 0) return undefined
  return rated.reduce((sum, s) => sum + (s.bjjFatigue ?? 0), 0) / rated.length
}

// ---------- Settings ----------

export async function getSettings(): Promise<AppSettings> {
  return (await db.settings.get('singleton')) ?? DEFAULT_SETTINGS
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<void> {
  const current = await getSettings()
  await db.settings.put({ ...current, ...patch, id: 'singleton' })
}

// ---------- Helpers ----------

export function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function findExercise(program: Program, dayId: string, exerciseId: string): Exercise | undefined {
  return program.days.find((d) => d.id === dayId)?.exercises.find((e) => e.id === exerciseId)
}
