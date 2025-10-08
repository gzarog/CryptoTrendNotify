import { formatSignedValue } from './utils'

type TrendAlignmentVizProps = {
  emaAlignment: number
  macdAlignment: number
  blendedScore: number
}

const LABELS: { key: keyof TrendAlignmentVizProps; label: string }[] = [
  { key: 'emaAlignment', label: 'EMA alignment' },
  { key: 'macdAlignment', label: 'MACD alignment' },
  { key: 'blendedScore', label: 'Blended trend score' },
]

export function TrendAlignmentViz({ emaAlignment, macdAlignment, blendedScore }: TrendAlignmentVizProps) {
  const values: TrendAlignmentVizProps = { emaAlignment, macdAlignment, blendedScore }

  return (
    <div className="flex flex-col gap-3">
      {LABELS.map(({ key, label }) => {
        const value = values[key]
        return (
          <div key={key} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-400/80">
              <span>{label}</span>
              <span className="font-mono text-[10px] text-slate-100">{formatSignedValue(value, 2)}</span>
            </div>
            <AlignmentBar value={value} />
          </div>
        )
      })}
    </div>
  )
}

type AlignmentBarProps = {
  value: number
}

function AlignmentBar({ value }: AlignmentBarProps) {
  const clamped = Math.max(Math.min(value, 1), -1)
  const magnitude = Math.abs(clamped)

  if (magnitude === 0) {
    return (
      <div className="relative h-2 rounded-full bg-slate-800/80">
        <div className="absolute inset-y-0 left-1/2 w-px bg-slate-600/60" />
      </div>
    )
  }

  const widthPercentage = `${magnitude * 50}%`
  const sideClass = clamped >= 0 ? 'left-1/2' : 'right-1/2'
  const colorClass = clamped >= 0 ? 'bg-emerald-400/80' : 'bg-rose-400/80'

  return (
    <div className="relative h-2 overflow-hidden rounded-full bg-slate-800/80">
      <div className="absolute inset-y-0 left-1/2 w-px bg-slate-600/60" />
      <div
        className={`absolute inset-y-0 ${sideClass} ${colorClass}`}
        style={{ width: widthPercentage }}
      />
    </div>
  )
}
