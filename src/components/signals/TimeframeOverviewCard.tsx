import { Badge } from './Badge'
import { PercentageBar } from './PercentageBar'
import { MarkovPriorGauge } from './MarkovPriorGauge'
import {
  COMBINED_STRENGTH_GRADIENT,
  DIRECTION_BADGE_CLASS,
  STAGE_BADGE_CLASS,
  STAGE_LABEL,
  STRENGTH_BADGE_CLASS,
} from './constants'
import { clampPercentage, formatPrice, formatSignedValue, toDirectionKey } from './utils'
import { TrendAlignmentViz } from './TrendAlignmentViz'
import type { TimeframeSignalSnapshot } from '../../types/signals'

type TimeframeOverviewCardProps = {
  snapshot: TimeframeSignalSnapshot
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
  const breakdown = snapshot.combined.breakdown
  const momentumLabel =
    breakdown.momentum === 'StrongBullish'
      ? 'Strong bullish'
      : breakdown.momentum === 'StrongBearish'
      ? 'Strong bearish'
      : 'Weak'
  const adxDirectionLabel = (() => {
    if (breakdown.adxDirection === 'ConfirmBull') {
      return breakdown.adxIsRising ? 'Confirm bull (rising)' : 'Confirm bull'
    }
    if (breakdown.adxDirection === 'ConfirmBear') {
      return breakdown.adxIsRising ? 'Confirm bear (rising)' : 'Confirm bear'
    }
    return breakdown.adxIsRising ? 'No confirmation (rising)' : 'No confirmation'
  })()
  const signalLabel = breakdown.label.replace(/_/g, ' ')

  const classification = [
    { label: 'Label', value: signalLabel },
    { label: 'Score', value: formatSignedValue(breakdown.signalStrength) },
    { label: 'Bias', value: breakdown.bias.toLowerCase() },
    { label: 'Momentum', value: momentumLabel.toLowerCase() },
    { label: 'Trend', value: breakdown.trendStrength.toLowerCase() },
    { label: 'ADX', value: adxDirectionLabel.toLowerCase() },
  ]

  const formatIndicator = (value: number | null | undefined, decimals = 1) => {
    if (value == null || !Number.isFinite(value)) {
      return '—'
    }
    return value.toFixed(decimals)
  }

  const trendComponents = breakdown.trendComponents ?? {
    emaAlignment: 0,
    macdAlignment: 0,
  }
  const trendScore = Number.isFinite(breakdown.trendScore)
    ? (breakdown.trendScore as number)
    : 0

  const indicatorSnapshot = [
    { label: 'RSI', value: formatIndicator(breakdown.rsiValue) },
    { label: 'Stoch %K', value: formatIndicator(breakdown.stochKValue) },
    { label: 'ADX', value: formatIndicator(breakdown.adxValue) },
    { label: 'EMA fast', value: formatPrice(breakdown.emaFast, 5) },
    { label: 'EMA slow', value: formatPrice(breakdown.emaSlow, 5) },
    { label: 'MA long', value: formatPrice(breakdown.maLong, 5) },
    { label: 'MACD', value: formatIndicator(breakdown.macdValue, 2) },
    { label: 'MACD signal', value: formatIndicator(breakdown.macdSignal, 2) },
    { label: 'MACD hist', value: formatIndicator(breakdown.macdHistogram, 2) },
    { label: 'Trend score', value: formatSignedValue(trendScore, 2) },
  ]
  const markovPriorScore = Number.isFinite(breakdown.markov.priorScore)
    ? (breakdown.markov.priorScore as number)
    : null
  const markovState = breakdown.markov.currentState ?? null

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
          Signal classification
        </span>
        <div className="grid gap-2 text-[11px] uppercase tracking-wide sm:grid-cols-2">
          {classification.map(({ label, value }) => (
            <div
              key={`${snapshot.timeframe}-${label}`}
              className="flex flex-col gap-1 rounded-xl border border-white/10 bg-slate-900/40 px-3 py-2 text-left"
            >
              <span className="text-[10px] font-semibold tracking-wide text-slate-400/80">{label}</span>
              <span className="font-semibold text-white">{value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3 text-xs text-slate-200">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Trend alignment
        </span>
        <TrendAlignmentViz
          emaAlignment={trendComponents.emaAlignment}
          macdAlignment={trendComponents.macdAlignment}
          blendedScore={trendScore}
        />
      </section>

      {markovPriorScore != null && (
        <section className="flex flex-col gap-3 text-xs text-slate-200">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Markov directional prior
          </span>
          <MarkovPriorGauge priorScore={markovPriorScore} state={markovState} />
        </section>
      )}

      <section className="flex flex-col gap-3 text-xs text-slate-200">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Indicator snapshot
        </span>
        <div className="grid gap-2 text-[11px] uppercase tracking-wide sm:grid-cols-3">
          {indicatorSnapshot.map(({ label, value }) => (
            <div
              key={`${snapshot.timeframe}-${label}`}
              className="flex flex-col gap-1 rounded-xl border border-white/10 bg-slate-900/30 px-3 py-2 text-left"
            >
              <span className="text-[10px] font-semibold tracking-wide text-slate-400/80">{label}</span>
              <span className="font-mono text-[11px] text-slate-100">{value}</span>
            </div>
          ))}
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
