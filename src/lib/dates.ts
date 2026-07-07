import type { Program, WorkoutDay } from '../db/types'

/** Pick today's suggested workout day from weekday hints (0=Sun..6=Sat). */
export function suggestDayForToday(program: Program, now = new Date()): WorkoutDay | undefined {
  const weekday = now.getDay()
  return program.days.find((d) => d.weekdayHints.includes(weekday))
}

/** The next hinted day after today, for the rest-day message. */
export function nextScheduledDay(
  program: Program,
  now = new Date(),
): { day: WorkoutDay; weekday: number } | undefined {
  for (let offset = 1; offset <= 7; offset++) {
    const weekday = (now.getDay() + offset) % 7
    const day = program.days.find((d) => d.weekdayHints.includes(weekday))
    if (day) return { day, weekday }
  }
  return undefined
}

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function daysAgoStr(n: number, now = new Date()): string {
  const d = new Date(now)
  d.setDate(d.getDate() - n)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

export function formatSeconds(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
