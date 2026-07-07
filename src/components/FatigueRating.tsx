import type { BjjFatigue } from '../db/types'

const LEVELS: { value: BjjFatigue; label: string; emoji: string }[] = [
  { value: 1, label: 'Fresh', emoji: '😀' },
  { value: 2, label: 'Good', emoji: '🙂' },
  { value: 3, label: 'Worked', emoji: '😐' },
  { value: 4, label: 'Beat up', emoji: '😮‍💨' },
  { value: 5, label: 'Wrecked', emoji: '🥵' },
]

interface Props {
  value: BjjFatigue | undefined
  onChange: (value: BjjFatigue) => void
}

export function FatigueRating({ value, onChange }: Props) {
  return (
    <div className="fatigue-rating">
      {LEVELS.map((level) => (
        <button
          key={level.value}
          className={`fatigue-chip ${value === level.value ? 'fatigue-chip-active' : ''}`}
          onClick={() => onChange(level.value)}
        >
          <span className="fatigue-emoji">{level.emoji}</span>
          <span className="fatigue-label">{level.label}</span>
        </button>
      ))}
    </div>
  )
}
