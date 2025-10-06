import { useMemo, useState } from 'react'
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

const COMBINED_STRENGTH_GRADIENT: Record<string, string> = {
  bullish: 'from-emerald-400 to-emerald-500',
  bearish: 'from-rose-400 to-rose-500',
  neutral: 'from-slate-500 to-slate-400',
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
          {normalizedSnapshots.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {normalizedSnapshots.map((snapshot) => {
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
                const combinedDirectionKey = formatDirection(snapshot.combined.direction)
                const combinedDirectionClass =
                  DIRECTION_BADGE_CLASS[combinedDirectionKey] ?? DIRECTION_BADGE_CLASS.neutral
                const combinedStrength = Math.round(
                  Math.min(Math.max(snapshot.combined.strength ?? 0, 0), 100),
                )
                const combinedGradient =
                  COMBINED_STRENGTH_GRADIENT[combinedDirectionKey] ??
                  COMBINED_STRENGTH_GRADIENT.neutral

                return (
                  <article
                    key={`${snapshot.timeframe}-${snapshot.timeframeLabel}`}
                    className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4"
                  >
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400">
                      <span>{snapshot.timeframeLabel}</span>
                      <span>
                        {snapshot.price != null && Number.isFinite(snapshot.price)
                          ? snapshot.price.toFixed(5)
                          : '—'}
                      </span>
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
          )}
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
