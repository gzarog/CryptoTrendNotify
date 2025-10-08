import { Badge } from './Badge'
import { PercentageBar } from './PercentageBar'
import {
  BIAS_STATUS_CLASS,
  COMBINED_STRENGTH_GRADIENT,
  DIRECTION_BADGE_CLASS,
  STAGE_BADGE_CLASS,
  STAGE_LABEL,
  STRENGTH_BADGE_CLASS,
} from './constants'
import {
  clampPercentage,
  formatPrice,
  formatSignedValue,
  resolveBiasDirection,
  toDirectionKey,
} from './utils'
import type { TimeframeSignalSnapshot } from '../../types/signals'

type TimeframeOverviewCardProps = {
  snapshot: TimeframeSignalSnapshot
}

type BiasStatus = {
  label: string
  value: number
}

export function TimeframeOverviewCard({ snapshot }: TimeframeOverviewCardProps) {
  const directionKey = toDirectionKey(snapshot.combined.direction)
  const stageLabel = STAGE_LABEL[snapshot.stage]
  const stageClass = STAGE_BADGE_CLASS[snapshot.stage]
  const trendBadge = DIRECTION_BADGE_CLASS[toDirectionKey(snapshot.trend)] ?? DIRECTION_BADGE_CLASS.neutral
  const momentumBadge =
    DIRECTION_BADGE_CLASS[toDirectionKey(snapshot.momentum)] ?? DIRECTION_BADGE_CLASS.neutral
  const combinedBadge =
    DIRECTION_BADGE_CLASS[directionKey] ?? DIRECTION_BADGE_CLASS.neutral
  const strengthClass = snapshot.strength
    ? STRENGTH_BADGE_CLASS[snapshot.strength.toLowerCase()] ?? STRENGTH_BADGE_CLASS.weak
    : null
  const gradient = COMBINED_STRENGTH_GRADIENT[directionKey] ?? COMBINED_STRENGTH_GRADIENT.neutral
  const combinedStrength = clampPercentage(snapshot.combined.strength ?? 0)
  const { trendBias, momentumBias, confirmation, combinedScore } = snapshot.combined.breakdown
  const biasStatuses: BiasStatus[] = [
    { label: 'Trend', value: trendBias },
    { label: 'Momentum', value: momentumBias },
    { label: 'Confirmation', value: confirmation },
    { label: 'Total', value: combinedScore },
  ]

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{snapshot.timeframeLabel}</p>
          <p className="text-sm text-slate-300">Price {formatPrice(snapshot.price)}</p>
        </div>
        <Badge className={stageClass}>Stage {stageLabel}</Badge>
      </header>

      <section className="flex flex-wrap gap-2 text-[11px] uppercase tracking-wide text-slate-300">
        <Badge className={trendBadge}>Trend {toDirectionKey(snapshot.trend)}</Badge>
        <Badge className={momentumBadge}>Momentum {toDirectionKey(snapshot.momentum)}</Badge>
        <Badge tone="muted">Bias {snapshot.bias.toLowerCase()}</Badge>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs text-slate-300">
          <span>Combined signal</span>
          <Badge className={combinedBadge}>{directionKey}</Badge>
        </div>
        <PercentageBar gradient={gradient} value={combinedStrength} />
      </section>

      <section className="flex flex-col gap-3 text-xs text-slate-200">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Bias contribution
        </span>
        <div className="grid grid-cols-2 gap-2 text-[11px] uppercase tracking-wide sm:grid-cols-4">
          {biasStatuses.map(({ label, value }) => {
            const statusDirection = toDirectionKey(resolveBiasDirection(value))
            const statusClass = BIAS_STATUS_CLASS[statusDirection] ?? BIAS_STATUS_CLASS.neutral

            return (
              <div
                key={`${snapshot.timeframe}-${label}`}
                className={`flex flex-col gap-1 rounded-xl border px-3 py-2 text-left ${statusClass}`}
              >
                <span className="text-[10px] font-semibold tracking-wide text-slate-400/80">{label}</span>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide">{statusDirection}</span>
                  <span className="font-mono text-[11px]">{formatSignedValue(value)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <footer className="flex items-center justify-between text-xs text-slate-300">
        <span>Confluence strength</span>
        {snapshot.strength && strengthClass ? (
          <Badge className={strengthClass}>
            {snapshot.strength}
            {snapshot.confluenceScore != null ? ` • ${snapshot.confluenceScore}` : ''}
          </Badge>
        ) : (
          <span className="text-slate-500">—</span>
        )}
      </footer>
    </article>
  )
}
