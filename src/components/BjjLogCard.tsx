import { useEffect, useState } from 'react'
import { logBjjSession, suggestedBjjLogDate, toDateStr } from '../db/repo'
import { BJJ_INTENSITY_LABELS, type BjjIntensity } from '../db/types'

const INTENSITIES = [1, 2, 3, 4, 5] as BjjIntensity[]

export function BjjLogCard() {
  const [open, setOpen] = useState(false)
  const [promptDate, setPromptDate] = useState<string>()
  const [date, setDate] = useState(toDateStr(new Date()))
  const [duration, setDuration] = useState(90)
  const [intensity, setIntensity] = useState<BjjIntensity>()
  const [notes, setNotes] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void suggestedBjjLogDate().then((d) => {
      setPromptDate(d)
      if (d) {
        setDate(d)
        setOpen(true)
      }
    })
  }, [])

  const save = async () => {
    if (!intensity) return
    await logBjjSession({
      date,
      durationMin: duration,
      intensity,
      notes: notes.trim() || undefined,
    })
    setSaved(true)
    setOpen(false)
    setPromptDate(undefined)
    setIntensity(undefined)
    setNotes('')
  }

  if (saved && !open) {
    return (
      <div className="bjj-card bjj-card-saved">
        🥋 BJJ session logged — <button className="link-btn" onClick={() => { setSaved(false); setOpen(true); setDate(toDateStr(new Date())) }}>log another</button>
      </div>
    )
  }

  if (!open) {
    return (
      <button className="bjj-card bjj-card-collapsed" onClick={() => setOpen(true)}>
        🥋 Log a BJJ session
      </button>
    )
  }

  return (
    <div className="bjj-card">
      <div className="bjj-card-head">
        <span className="bjj-card-title">
          {promptDate ? '🥋 How was BJJ last night?' : '🥋 Log a BJJ session'}
        </span>
        <button className="btn-ghost" onClick={() => setOpen(false)}>
          ✕
        </button>
      </div>

      <label className="field-label">Date</label>
      <input type="date" value={date} max={toDateStr(new Date())} onChange={(e) => setDate(e.target.value)} />

      <label className="field-label">Duration</label>
      <div className="stepper bjj-duration">
        <button className="stepper-btn" onClick={() => setDuration((d) => Math.max(15, d - 15))}>−</button>
        <span className="stepper-value">
          {duration}
          <small>min</small>
        </span>
        <button className="stepper-btn" onClick={() => setDuration((d) => d + 15)}>+</button>
      </div>

      <label className="field-label">Intensity</label>
      <div className="fatigue-rating">
        {INTENSITIES.map((level) => (
          <button
            key={level}
            className={`fatigue-chip ${intensity === level ? 'fatigue-chip-active' : ''}`}
            onClick={() => setIntensity(level)}
          >
            <span className="fatigue-emoji">{level}</span>
            <span className="fatigue-label">{BJJ_INTENSITY_LABELS[level]}</span>
          </button>
        ))}
      </div>

      <label className="field-label">Notes</label>
      <textarea
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="What you worked, injuries, how the rounds went…"
      />

      <button className="btn-primary btn-big" disabled={!intensity} onClick={save}>
        Save BJJ session
      </button>
    </div>
  )
}
