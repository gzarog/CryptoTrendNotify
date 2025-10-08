import { Badge } from './Badge'
import { PercentageBar } from './PercentageBar'
import {
  COMBINED_STRENGTH_GRADIENT,
  DIRECTION_BADGE_CLASS,
} from './constants'
import { clampPercentage, formatSignedValue, formatWeight, toDirectionKey } from './utils'
import type { MultiTimeframeSignal } from './types'

type MultiTimeframeSummaryProps = {
  signal: MultiTimeframeSignal
}

export function MultiTimeframeSummary({ signal }: MultiTimeframeSummaryProps) {
  const direction = toDirectionKey(signal.direction)
  const strengthValue = clampPercentage(signal.strength)
  const gradient = COMBINED_STRENGTH_GRADIENT[direction] ?? COMBINED_STRENGTH_GRADIENT.neutral
  const directionBadge = DIRECTION_BADGE_CLASS[direction] ?? DIRECTION_BADGE_CLASS.neutral
  const normalizedScore = formatSignedValue(signal.normalizedScore, 1)
  const weightedScore = formatSignedValue(signal.combinedScore, 1)
  const biasStrengthLabel = signal.combinedBias.strength.toLowerCase()

  return (
    <article className="rounded-3xl border border-white/10 bg-slate-950/70 shadow-lg">
      <header className="flex items-start justify-between gap-3 rounded-t-3xl border-b border-white/5 bg-slate-900/60 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Multi-timeframe bias</p>
          <p className="text-base font-semibold text-white">Aggregated conviction across {signal.contributions.length} timeframes</p>
        </div>
        <Badge className={directionBadge}>{direction}</Badge>
      </header>

      <div className="flex flex-col gap-5 px-5 py-4">
        <section className="flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Combined strength</span>
          <PercentageBar gradient={gradient} value={strengthValue} />
          <div className="flex flex-wrap gap-4 text-xs text-slate-300">
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">Bias</span>
              <span className="font-semibold text-white">{normalizedScore}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">Weighted score</span>
              <span className="font-semibold text-white">{weightedScore}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">Bias strength</span>
              <span className="font-semibold text-white">{biasStrengthLabel}</span>
            </div>
          </div>
        </section>

        {signal.contributions.length > 0 && (
          <section className="flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Timeframe contributions</span>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {signal.contributions.map((entry) => {
                const contributionDirection = toDirectionKey(entry.signal.direction)
                const badgeClass =
                  DIRECTION_BADGE_CLASS[contributionDirection] ?? DIRECTION_BADGE_CLASS.neutral
                const scoreLabel = formatSignedValue(entry.score)
                const weightedScoreLabel = formatSignedValue(entry.weightedScore, 1)
                const signalLabel = entry.signal.breakdown.label.replace(/_/g, ' ')

                return (
                  <div
                    key={`mtf-${entry.timeframe}`}
                    className={`flex flex-col gap-2 rounded-2xl border border-white/10 bg-slate-900/40 p-3`}
                  >
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400">
                      <span>{entry.timeframeLabel}</span>
                      <Badge className={badgeClass}>{contributionDirection}</Badge>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-semibold text-white">
                        {clampPercentage(entry.signal.strength)}%
                      </span>
                      <span className="font-mono text-[11px] text-slate-300">{scoreLabel}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 text-[10px] uppercase tracking-wide text-slate-400">
                      <span className="font-semibold text-slate-200/90">{signalLabel}</span>
                      <span>•</span>
                      <span>Score {scoreLabel}</span>
                      <span>•</span>
                      <span>Weighted {weightedScoreLabel}</span>
                    </div>
                    <span className="text-[10px] uppercase tracking-wide text-slate-400">
                      Weight ×{formatWeight(entry.weight)}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </article>
  )
}
