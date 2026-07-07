import { useEffect, useRef, useState } from 'react'
import { formatSeconds } from '../lib/dates'

interface Props {
  durationSeconds: number
  startedAtMs: number
  soundOn: boolean
  onDismiss: () => void
}

/** Wall-clock based countdown — survives screen lock and tab suspends. */
export function RestTimer({ durationSeconds, startedAtMs, soundOn, onDismiss }: Props) {
  const [extraSeconds, setExtraSeconds] = useState(0)
  const [now, setNow] = useState(Date.now())
  const firedRef = useRef(false)

  const total = durationSeconds + extraSeconds
  const elapsed = Math.floor((now - startedAtMs) / 1000)
  const remaining = total - elapsed

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (remaining <= 0 && !firedRef.current) {
      firedRef.current = true
      if (navigator.vibrate) navigator.vibrate([200, 100, 200])
      if (soundOn) beep()
    }
    if (remaining > 0) firedRef.current = false
  }, [remaining, soundOn])

  const done = remaining <= 0
  return (
    <div className={`rest-timer ${done ? 'rest-timer-done' : ''}`}>
      <span className="rest-timer-label">{done ? 'GO' : 'Rest'}</span>
      <span className="rest-timer-clock">{done ? formatSeconds(0) : formatSeconds(remaining)}</span>
      <button className="btn-ghost" onClick={() => setExtraSeconds((s) => s + 30)}>
        +30s
      </button>
      <button className="btn-ghost" onClick={onDismiss}>
        {done ? 'Dismiss' : 'Skip'}
      </button>
    </div>
  )
}

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    osc.start()
    osc.stop(ctx.currentTime + 0.6)
    osc.onended = () => ctx.close()
  } catch {
    // audio not available — vibration already fired
  }
}
