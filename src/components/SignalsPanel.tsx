import { useMemo, useState } from 'react'
import { getMultiTimeframeSignal } from '../lib/signals'
import { TIMEFRAMES } from '../constants/timeframes'
import type { TimeframeSignalSnapshot, TradingSignal } from '../types/signals'

const STRENGTH_BADGE_CLASS: Record<string, string> = {
  weak: 'bg-emerald-500/10 text-emerald-200 border-emerald-400/40',
  medium: 'bg-amber-500/10 text-amber-200 border-amber-400/40',
  strong: 'bg-orange-500/10 text-orange-200 border-orange-400/40',
}

const DIRECTION_BADGE_CLASS: Record<string, string> = {
  bullish: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
  bearish: 'border-rose-400/40 bg-rose-500/10 text-rose-200',
  neutral: 'border-slate-400/40 bg-slate-500/10 text-slate-200',
}

const STAGE_BADGE_CLASS: Record<TimeframeSignalSnapshot['stage'], string> = {
  ready: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
  cooldown: 'border-amber-400/40 bg-amber-500/10 text-amber-200',
  gated: 'border-slate-400/40 bg-slate-500/10 text-slate-200',
  triggered: 'border-sky-400/40 bg-sky-500/10 text-sky-200',
}

const STAGE_LABEL: Record<TimeframeSignalSnapshot['stage'], string> = {
  ready: 'Ready',
  cooldown: 'Cooldown',
  gated: 'Gated',
  triggered: 'Triggered',
}

const COMBINED_STRENGTH_GRADIENT: Record<string, string> = {
  bullish: 'from-emerald-400 to-emerald-500',
  bearish: 'from-rose-400 to-rose-500',
  neutral: 'from-slate-500 to-slate-400',
}

const BIAS_STATUS_CLASS: Record<string, string> = {
  bullish: 'border-emerald-400/40 bg-emerald-500/5 text-emerald-200',
  bearish: 'border-rose-400/40 bg-rose-500/5 text-rose-200',
  neutral: 'border-slate-400/30 bg-slate-700/20 text-slate-200',
}

const DISABLED_CARD_CLASS = 'border-white/5 bg-slate-900/30 text-slate-500'
const DISABLED_BADGE_CLASS = 'border-slate-600/40 bg-slate-800/40 text-slate-400'

const formatSignedValue = (value: number, decimalPlaces = 0): string => {
  if (!Number.isFinite(value)) {
    return '0'
  }

  const factor = 10 ** decimalPlaces
  let normalized = decimalPlaces > 0 ? Math.round(value * factor) / factor : Math.round(value)

  if (Object.is(normalized, -0)) {
    normalized = 0
  }

  const formatted = decimalPlaces > 0
    ? normalized.toFixed(decimalPlaces).replace(/\.0+$/, '')
    : normalized.toString()

  if (normalized > 0) {
    return `+${formatted}`
  }

  return formatted
}

const resolveBiasDirection = (value: number) => {
  if (value > 0) {
    return 'Bullish'
  }

  if (value < 0) {
    return 'Bearish'
  }

  return 'Neutral'
}

type SignalsPanelProps = {
  signals: TradingSignal[]
  snapshots: TimeframeSignalSnapshot[]
  isLoading: boolean
}

export function SignalsPanel({ signals, snapshots, isLoading }: SignalsPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const normalizedSignals = useMemo(
    () => signals.slice().sort((a, b) => b.confluenceScore - a.confluenceScore),
    [signals],
  )

  const multiTimeframeSignal = useMemo(() => getMultiTimeframeSignal(snapshots), [snapshots])

  const normalizedSnapshots = useMemo(() => {
    const UNIT_MULTIPLIERS: Record<string, number> = {
      M: 1,
      H: 60,
      D: 60 * 24,
      W: 60 * 24 * 7,
    }

    const parseTimeframeWeight = (value: string) => {
      const trimmed = value.trim()
      if (trimmed.length === 0) {
        return Number.POSITIVE_INFINITY
      }

      const asNumber = Number(trimmed)
      if (Number.isFinite(asNumber)) {
        return asNumber
      }

      const normalized = trimmed.toUpperCase()
      const unitPrefixMatch = normalized.match(/^([A-Z]+)(\d+)$/)
      if (unitPrefixMatch) {
        const [, unit, amount] = unitPrefixMatch
        const multiplier = UNIT_MULTIPLIERS[unit] ?? null
        if (multiplier != null) {
          return multiplier * Number(amount)
        }
      }

      const unitSuffixMatch = normalized.match(/^(\d+)([A-Z]+)$/)
      if (unitSuffixMatch) {
        const [, amount, unit] = unitSuffixMatch
        const multiplier = UNIT_MULTIPLIERS[unit] ?? null
        if (multiplier != null) {
          return multiplier * Number(amount)
        }
      }

      return Number.POSITIVE_INFINITY
    }

    return snapshots
      .slice()
      .sort((a, b) => {
        const aWeight = parseTimeframeWeight(a.timeframe)
        const bWeight = parseTimeframeWeight(b.timeframe)

        if (aWeight === bWeight) {
          return a.timeframe.localeCompare(b.timeframe)
        }

        return aWeight - bWeight
      })
  }, [snapshots])

  const snapshotsByTimeframe = useMemo(() => {
    const map = new Map<string, TimeframeSignalSnapshot>()

    for (const snapshot of normalizedSnapshots) {
      map.set(snapshot.timeframe, snapshot)
    }

    return map
  }, [normalizedSnapshots])

  const formatDirection = (value: TimeframeSignalSnapshot['trend']) =>
    value.toLowerCase()

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/60">
      <header className="flex items-center justify-between gap-3 border-b border-white/5 px-6 py-4">
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Signals
          </span>
          <span className="text-sm text-slate-300">Actionable confluence across timeframes</span>
        </div>
        <button
          type="button"
          onClick={() => setIsCollapsed((previous) => !previous)}
          className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-100 transition hover:border-white/20 hover:text-white"
        >
          {isCollapsed ? 'Expand' : 'Collapse'}
          <span className={`transition-transform ${isCollapsed ? '' : 'rotate-180'}`}>⌃</span>
        </button>
      </header>
      {!isCollapsed && (
        <div className="flex flex-col gap-4 px-6 py-5">
          {multiTimeframeSignal && (
            <article className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Multi-timeframe bias
                </span>
                {(() => {
                  const directionKey = multiTimeframeSignal.direction.toLowerCase()
                  const badgeClass =
                    DIRECTION_BADGE_CLASS[directionKey] ?? DIRECTION_BADGE_CLASS.neutral

                  return (
                    <span
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${badgeClass}`}
                    >
                      {multiTimeframeSignal.direction.toLowerCase()}
                    </span>
                  )
                })()}
              </div>
              {(() => {
                const directionKey = multiTimeframeSignal.direction.toLowerCase()
                const gradient =
                  COMBINED_STRENGTH_GRADIENT[directionKey] ?? COMBINED_STRENGTH_GRADIENT.neutral
                const strengthValue = Math.round(
                  Math.min(Math.max(multiTimeframeSignal.strength, 0), 100),
                )

                return (
                  <div className="flex items-center gap-2">
                    <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`absolute inset-y-0 left-0 bg-gradient-to-r ${gradient}`}
                        style={{ width: `${strengthValue}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-200">
                      {strengthValue}%
                    </span>
                  </div>
                )
              })()}
              <div className="flex flex-wrap gap-3 text-[11px] uppercase tracking-wide text-slate-400">
                <span>Bias {formatSignedValue(multiTimeframeSignal.bias, 1)}</span>
                <span>Timeframes {multiTimeframeSignal.contributions.length}</span>
              </div>
              {multiTimeframeSignal.contributions.length > 0 && (
                <div className="flex flex-col gap-2 text-xs text-slate-300">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Timeframe contributions
                  </span>
                  <div className="grid gap-2 text-[11px] uppercase tracking-wide sm:grid-cols-2 xl:grid-cols-3">
                    {multiTimeframeSignal.contributions.map((entry) => {
                      const directionKey = entry.signal.direction.toLowerCase()
                      const badgeClass =
                        DIRECTION_BADGE_CLASS[directionKey] ?? DIRECTION_BADGE_CLASS.neutral
                      const formattedWeight = Number.isInteger(entry.weight)
                        ? entry.weight.toString()
                        : entry.weight.toFixed(1).replace(/\.0+$/, '')

                      return (
                        <div
                          key={`multi-${entry.timeframe}`}
                          className={`flex flex-col gap-1 rounded-xl border px-3 py-2 ${badgeClass}`}
                        >
                          <div className="flex items-center justify-between text-[11px] uppercase tracking-wide">
                            <span>{entry.timeframeLabel}</span>
                            <span>{Math.round(entry.signal.strength)}%</span>
                          </div>
                          <div className="flex items-baseline justify-between text-xs">
                            <span className="font-semibold uppercase tracking-wide">
                              {entry.signal.direction.toLowerCase()}
                            </span>
                            <span className="font-mono text-[11px]">
                              {formatSignedValue(entry.bias)}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-200/80">
                            Weight ×{formattedWeight}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </article>
          )}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {TIMEFRAMES.map(({ value, label }) => {
              const snapshot = snapshotsByTimeframe.get(value)

              if (!snapshot) {
                return (
                  <article
                    key={`placeholder-${value}`}
                    className={`flex flex-col gap-3 rounded-2xl border p-4 ${DISABLED_CARD_CLASS}`}
                  >
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-wide">
                      <span>{label}</span>
                      <span
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${DISABLED_BADGE_CLASS}`}
                      >
                        Stage Unavailable
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-wide">
                      <span className={`rounded-full border px-3 py-1 ${DISABLED_BADGE_CLASS}`}>
                        Trend unavailable
                      </span>
                      <span className={`rounded-full border px-3 py-1 ${DISABLED_BADGE_CLASS}`}>
                        Momentum unavailable
                      </span>
                      <span className={`rounded-full border px-3 py-1 ${DISABLED_BADGE_CLASS}`}>
                        Bias unavailable
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs">
                        <span>Combined signal</span>
                        <span
                          className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${DISABLED_BADGE_CLASS}`}
                        >
                          Unavailable
                        </span>
                      </div>
                      <div className="flex items-center gap-2 opacity-70">
                        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-800/50">
                          <div className="absolute inset-y-0 left-0 bg-slate-700/40" style={{ width: '0%' }} />
                        </div>
                        <span className="text-xs font-semibold">0%</span>
                      </div>
                    </div>
                    <p className="text-xs">No signal data for this timeframe yet.</p>
                  </article>
                )
              }

              const trendKey = formatDirection(snapshot.trend)
              const momentumKey = formatDirection(snapshot.momentum)
              const trendClass =
                DIRECTION_BADGE_CLASS[trendKey] ?? DIRECTION_BADGE_CLASS.neutral
              const momentumClass =
                DIRECTION_BADGE_CLASS[momentumKey] ?? DIRECTION_BADGE_CLASS.neutral
              const strengthKey = snapshot.strength?.toLowerCase()
              const strengthClass =
                strengthKey != null
                  ? STRENGTH_BADGE_CLASS[strengthKey] ?? STRENGTH_BADGE_CLASS.weak
                  : null
              const stageClass = STAGE_BADGE_CLASS[snapshot.stage]
              const stageLabel = STAGE_LABEL[snapshot.stage]
              const combinedDirectionKey = formatDirection(snapshot.combined.direction)
              const combinedDirectionClass =
                DIRECTION_BADGE_CLASS[combinedDirectionKey] ?? DIRECTION_BADGE_CLASS.neutral
              const combinedStrength = Math.round(
                Math.min(Math.max(snapshot.combined.strength ?? 0, 0), 100),
              )
              const combinedGradient =
                COMBINED_STRENGTH_GRADIENT[combinedDirectionKey] ??
                COMBINED_STRENGTH_GRADIENT.neutral
              const { trendBias, momentumBias, confirmation, combinedScore } =
                snapshot.combined.breakdown
              const biasStatuses = [
                { label: 'Trend', value: trendBias },
                { label: 'Momentum', value: momentumBias },
                { label: 'Confirmation', value: confirmation },
                { label: 'Total', value: combinedScore },
              ]

              return (
                <article
                  key={`${snapshot.timeframe}-${snapshot.timeframeLabel}`}
                  className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4"
                >
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400">
                    <span>{snapshot.timeframeLabel}</span>
                    <div className="flex items-center gap-2">
                      <span>
                        {snapshot.price != null && Number.isFinite(snapshot.price)
                          ? snapshot.price.toFixed(5)
                          : '—'}
                      </span>
                      <span
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${stageClass}`}
                      >
                        Stage {stageLabel}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-wide">
                    <span className={`rounded-full border px-3 py-1 ${trendClass}`}>
                      Trend {formatDirection(snapshot.trend)}
                    </span>
                    <span className={`rounded-full border px-3 py-1 ${momentumClass}`}>
                      Momentum {formatDirection(snapshot.momentum)}
                    </span>
                    <span className="rounded-full border border-slate-400/40 bg-slate-500/10 px-3 py-1 text-slate-200">
                      Bias {snapshot.bias.toLowerCase()}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span>Combined signal</span>
                      <span
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${combinedDirectionClass}`}
                      >
                        {formatDirection(snapshot.combined.direction)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className={`absolute inset-y-0 left-0 bg-gradient-to-r ${combinedGradient}`}
                          style={{ width: `${combinedStrength}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-slate-200">
                        {combinedStrength}%
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 text-xs text-slate-300">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Current bias status
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-[11px] uppercase tracking-wide sm:grid-cols-4">
                      {biasStatuses.map(({ label: biasLabel, value }) => {
                        const direction = resolveBiasDirection(value)
                        const directionKey = direction.toLowerCase()
                        const badgeClass =
                          BIAS_STATUS_CLASS[directionKey] ?? BIAS_STATUS_CLASS.neutral

                        return (
                          <div
                            key={`${snapshot.timeframe}-${biasLabel}`}
                            className={`flex flex-col gap-1 rounded-xl border px-3 py-2 text-left ${badgeClass}`}
                          >
                            <span className="text-[10px] font-semibold tracking-wide text-slate-400/80">
                              {biasLabel}
                            </span>
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-xs font-semibold uppercase tracking-wide">
                                {direction.toLowerCase()}
                              </span>
                              <span className="font-mono text-[11px]">
                                {formatSignedValue(value)}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span>Confluence strength</span>
                    {snapshot.strength && strengthClass ? (
                      <span
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${strengthClass}`}
                      >
                        {snapshot.strength}
                        {snapshot.confluenceScore != null
                          ? ` • ${snapshot.confluenceScore}`
                          : ''}
                      </span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
          {isLoading ? (
            <p className="text-sm text-slate-400">Calculating signals…</p>
          ) : normalizedSignals.length === 0 ? (
            <p className="text-sm text-slate-400">No qualified signals yet. Check back soon.</p>
          ) : (
            normalizedSignals.slice(0, 6).map((signal) => {
              const strengthKey = signal.strength.toLowerCase()
              const badgeClass =
                STRENGTH_BADGE_CLASS[strengthKey] ?? STRENGTH_BADGE_CLASS.weak

              return (
                <article
                  key={`${signal.dedupeKey}-${signal.createdAt}`}
                  className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        {signal.timeframeLabel} • {signal.side}
                      </span>
                      <span className="text-lg font-semibold text-white">{signal.symbol}</span>
                    </div>
                    <div className="flex flex-col items-end gap-2 text-right">
                      <span
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${badgeClass}`}
                      >
                        {signal.strength} • {signal.confluenceScore}
                      </span>
                      {signal.price != null && Number.isFinite(signal.price) && (
                        <span className="text-xs text-slate-300">Price {signal.price.toFixed(5)}</span>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-2 text-xs text-slate-300 md:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Reasons
                      </span>
                      <ul className="flex list-disc flex-col gap-1 pl-4">
                        {signal.reason.map((reason, index) => (
                          <li key={`${signal.dedupeKey}-reason-${index}`}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Risk plan
                      </span>
                      <span>
                        SL{' '}
                        {signal.suggestedSL != null && Number.isFinite(signal.suggestedSL)
                          ? signal.suggestedSL.toFixed(5)
                          : '—'}
                      </span>
                      <span>
                        TP{' '}
                        {signal.suggestedTP != null && Number.isFinite(signal.suggestedTP)
                          ? signal.suggestedTP.toFixed(5)
                          : '—'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-wide text-slate-500">
                    <span>Bias {signal.bias.toLowerCase()}</span>
                    <span>Key {signal.dedupeKey}</span>
                  </div>
                </article>
              )
            })
          )}
        </div>
      )}
    </section>
  )
}
