import Dexie, { type EntityTable } from 'dexie'
import type { AppSettings, CoachReview, ProgramRevision, SessionLog } from './types'
import { DEFAULT_SETTINGS } from './types'
import { SEED_PROGRAM } from './seedProgram'

export const db = new Dexie('griptrack') as Dexie & {
  programRevisions: EntityTable<ProgramRevision, 'id'>
  sessions: EntityTable<SessionLog, 'id'>
  coachReviews: EntityTable<CoachReview, 'id'>
  settings: EntityTable<AppSettings, 'id'>
}

db.version(1).stores({
  programRevisions: 'id, programId, revision, createdAt',
  sessions: 'id, date, dayId, status, startedAt',
  coachReviews: 'id, requestedAt, status',
  settings: 'id',
})

// First-launch seeding: revision 1 from the built-in program, default settings.
db.on('populate', (tx) => {
  tx.table('programRevisions').add({
    id: crypto.randomUUID(),
    programId: SEED_PROGRAM.id,
    revision: 1,
    createdAt: new Date().toISOString(),
    source: 'seed',
    note: 'Initial BJJ strength program',
    program: SEED_PROGRAM,
  } satisfies ProgramRevision)
  tx.table('settings').add(DEFAULT_SETTINGS)
})
