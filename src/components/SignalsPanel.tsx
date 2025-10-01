import { useMemo, useState } from 'react'
import type { TradingSignal } from '../types/signals'

const STRENGTH_BADGE_CLASS: Record<string, string> = {
  weak: 'bg-emerald-500/10 text-emerald-200 border-emerald-400/40',
  medium: 'bg-amber-500/10 text-amber-200 border-amber-400/40',
  strong: 'bg-orange-500/10 text-orange-200 border-orange-400/40',
}

type SignalsPanelProps = {
  signals: TradingSignal[]
  isLoading: boolean
}

export function SignalsPanel({ signals, isLoading }: SignalsPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const normalizedSignals = useMemo(
    () => signals.slice().sort((a, b) => b.confluenceScore - a.confluenceScore),
    [signals],
  )

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
