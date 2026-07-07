const RPE_VALUES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]

interface Props {
  value: number | undefined
  onChange: (rpe: number | undefined) => void
}

export function RpePicker({ value, onChange }: Props) {
  return (
    <div className="rpe-picker">
      {RPE_VALUES.map((rpe) => (
        <button
          key={rpe}
          className={`rpe-chip ${value === rpe ? 'rpe-chip-active' : ''}`}
          onClick={() => onChange(value === rpe ? undefined : rpe)}
        >
          {rpe}
        </button>
      ))}
    </div>
  )
}
