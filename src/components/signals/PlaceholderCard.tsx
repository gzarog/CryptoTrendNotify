import { Badge } from './Badge'
import { DISABLED_BADGE_CLASS, DISABLED_CARD_CLASS } from './constants'

type PlaceholderCardProps = {
  label: string
  value: string
}

export function PlaceholderCard({ label, value }: PlaceholderCardProps) {
  return (
    <article
      key={`placeholder-${value}`}
      className={`flex flex-col gap-3 rounded-2xl border ${DISABLED_CARD_CLASS} p-4`}
    >
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wide">
        <span>{label}</span>
        <Badge className={DISABLED_BADGE_CLASS}>Stage unavailable</Badge>
      </div>
      <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-wide">
        <Badge className={DISABLED_BADGE_CLASS}>Trend unavailable</Badge>
        <Badge className={DISABLED_BADGE_CLASS}>Momentum unavailable</Badge>
        <Badge className={DISABLED_BADGE_CLASS}>Bias unavailable</Badge>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span>Combined signal</span>
          <Badge className={DISABLED_BADGE_CLASS}>Unavailable</Badge>
        </div>
        <div className="flex items-center gap-2 opacity-70">
          <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-800/50">
            <div className="absolute inset-y-0 left-0 bg-slate-700/40" style={{ width: '0%' }} />
          </div>
          <span className="text-xs font-semibold">0%</span>
        </div>
      </div>
      <p className="text-xs text-slate-400">No signal data for this timeframe yet.</p>
    </article>
  )
}
