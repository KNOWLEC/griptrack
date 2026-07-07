import { db } from '../db/db'
import type { SessionLog } from '../db/types'
import { backupFileSchema, type BackupFile } from './validation'

export async function buildBackup(): Promise<BackupFile> {
  return {
    app: 'griptrack',
    version: 1,
    exportedAt: new Date().toISOString(),
    programRevisions: (await db.programRevisions.toArray()) as BackupFile['programRevisions'],
    sessions: (await db.sessions.toArray()) as BackupFile['sessions'],
    coachReviews: (await db.coachReviews.toArray()) as BackupFile['coachReviews'],
    settings: (await db.settings.toArray()) as BackupFile['settings'],
  }
}

export async function downloadBackup(): Promise<void> {
  const backup = await buildBackup()
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `griptrack-backup-${backup.exportedAt.slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** Validates and REPLACES all local data. Throws with a readable message on bad files. */
export async function importBackup(file: File): Promise<{ sessions: number; revisions: number }> {
  const text = await file.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Not a valid JSON file')
  }
  const result = backupFileSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error('Not a GripTrack backup file (schema mismatch)')
  }
  const backup = result.data
  await db.transaction('rw', db.programRevisions, db.sessions, db.coachReviews, db.settings, async () => {
    await Promise.all([
      db.programRevisions.clear(),
      db.sessions.clear(),
      db.coachReviews.clear(),
      db.settings.clear(),
    ])
    await db.programRevisions.bulkAdd(backup.programRevisions)
    // zod already enforced bjjFatigue ∈ 1..5, so the widened number is safe to narrow
    await db.sessions.bulkAdd(backup.sessions as SessionLog[])
    await db.coachReviews.bulkAdd(backup.coachReviews)
    await db.settings.bulkAdd(backup.settings)
  })
  return { sessions: backup.sessions.length, revisions: backup.programRevisions.length }
}
