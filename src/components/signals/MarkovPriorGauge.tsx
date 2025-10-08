import { Badge } from './Badge'
import { formatSignedValue } from './utils'

type MarkovPriorGaugeProps = {
  priorScore: number
  state: 'D' | 'R' | 'B' | 'U' | null
}

const STATE_LABEL: Record<'D' | 'R' | 'B' | 'U', string> = {
  D: 'Downtrend',
  R: 'Reversal',
  B: 'Base',
  U: 'Uptrend',
}

const STATE_BADGE_CLASS: Record<'bearish' | 'bullish' | 'neutral', string> = {
  bearish: 'border-rose-400/40 bg-rose-500/10 text-rose-200',
  bullish: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
  neutral: 'border-slate-400/40 bg-slate-500/10 text-slate-200',
}

const PRIOR_DESCRIPTIONS = [
  { threshold: 0.45, label: 'Strong bullish persistence' },
  { threshold: 0.2, label: 'Bullish continuation tilt' },
  { threshold: 0.05, label: 'Mild bullish lean' },
  { threshold: -0.05, label: 'Balanced / indecisive' },
  { threshold: -0.2, label: 'Mild bearish lean' },
  { threshold: -0.45, label: 'Bearish continuation tilt' },
  { threshold: -1, label: 'Strong bearish persistence' },
]

export function MarkovPriorGauge({ priorScore, state }: MarkovPriorGaugeProps) {
  const normalized = Math.min(Math.max((priorScore + 1) / 2, 0), 1)
  const pointerLeft = `${normalized * 100}%`
  const priorScoreLabel = formatSignedValue(priorScore, 2)

  const description = (() => {
    for (const entry of PRIOR_DESCRIPTIONS) {
      if (priorScore >= entry.threshold) {
        return entry.label
      }
    }
    return 'Balanced / indecisive'
  })()

  const badgeTone: 'bullish' | 'bearish' | 'neutral' =
    priorScore > 0.05 ? 'bullish' : priorScore < -0.05 ? 'bearish' : 'neutral'

  const stateLabel = state ? STATE_LABEL[state] ?? 'Unknown' : 'Unclassified'
  const badgeClass = STATE_BADGE_CLASS[badgeTone]

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400">
        <span>Markov prior</span>
        <Badge className={badgeClass}>{stateLabel}</Badge>
      </div>
      <div className="flex flex-col gap-2">
        <div className="relative h-2 w-full rounded-full bg-gradient-to-r from-rose-500 via-slate-600 to-emerald-400">
          <span
            className="absolute top-1/2 h-3 w-0.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.6)]"
            style={{ left: pointerLeft, transform: 'translate(-50%, -50%)' }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-300">
          <span>{description}</span>
          <span className="font-mono text-xs text-slate-100">{priorScoreLabel}</span>
        </div>
      </div>
    </div>
  )
}
