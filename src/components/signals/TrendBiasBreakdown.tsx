import type { CSSProperties } from 'react'

type TrendBiasBreakdownProps = {
  emaAlignment: number
  macdAlignment: number
  trendScore: number
  emaWeight: number
  macdWeight: number
}

type TrendRow = {
  label: string
  value: number
  meta?: string
}

const clampScore = (value: number) => Math.min(Math.max(value, -1), 1)

const resolveBarStyle = (value: number): CSSProperties => {
  const clamped = clampScore(value)
  const magnitude = Math.abs(clamped)
  const halfWidth = magnitude * 50

  if (halfWidth === 0) {
    return { left: '50%', width: '0%' }
  }

  if (clamped > 0) {
    return { left: '50%', width: `${halfWidth}%` }
  }

  return { left: `${50 - halfWidth}%`, width: `${halfWidth}%` }
}

const resolveBarClass = (value: number) => {
  if (value > 0) {
    return 'bg-emerald-400/80'
  }

  if (value < 0) {
    return 'bg-rose-400/80'
  }

  return 'bg-slate-500/70'
}

const resolveValueClass = (value: number) => {
  if (value > 0) {
    return 'text-emerald-200'
  }

  if (value < 0) {
    return 'text-rose-200'
  }

  return 'text-slate-300'
}

const formatScore = (value: number) => {
  const clamped = clampScore(value)
  let normalized = Math.round(clamped * 100) / 100

  if (Object.is(normalized, -0)) {
    normalized = 0
  }

  const formatted = normalized
    .toFixed(2)
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '')

  if (normalized > 0) {
    return `+${formatted}`
  }

  return formatted
}

export function TrendBiasBreakdown({
  emaAlignment,
  macdAlignment,
  trendScore,
  emaWeight,
  macdWeight,
}: TrendBiasBreakdownProps) {
  const rows: TrendRow[] = [
    {
      label: 'EMA alignment',
      value: emaAlignment,
      meta: `${Math.round(emaWeight * 100)}% weight`,
    },
    {
      label: 'MACD alignment',
      value: macdAlignment,
      meta: `${Math.round(macdWeight * 100)}% weight`,
    },
    {
      label: 'Trend score',
      value: trendScore,
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      {rows.map(({ label, value, meta }) => (
        <div key={label} className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-400/80">
            <span>{label}</span>
            {meta ? <span>{meta}</span> : null}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-800/80">
              <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-slate-600/70" />
              <div
                className={`absolute top-0 h-full rounded-full transition-all duration-500 ease-out ${resolveBarClass(value)}`}
                style={resolveBarStyle(value)}
              />
            </div>
            <span className={`font-mono text-[11px] ${resolveValueClass(value)}`}>
              {formatScore(value)}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
