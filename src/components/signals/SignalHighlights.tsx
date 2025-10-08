import { Badge } from './Badge'
import { STRENGTH_BADGE_CLASS } from './constants'
import { formatPrice } from './utils'
import type { TradingSignal } from '../../types/signals'

type SignalHighlightsProps = {
  signals: TradingSignal[]
}

export function SignalHighlights({ signals }: SignalHighlightsProps) {
  if (signals.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-3">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Featured opportunities</p>
        <p className="text-sm text-slate-300">
          Highest scoring signals surfaced from the confluence engine
        </p>
      </header>

      {signals.map((signal) => {
        const badgeClass =
          (signal.strength && STRENGTH_BADGE_CLASS[signal.strength.toLowerCase()]) ?? STRENGTH_BADGE_CLASS.weak

        return (
          <article
            key={`${signal.dedupeKey}-${signal.createdAt}`}
            className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4"
          >
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {signal.timeframeLabel} • {signal.side}
                </p>
                <p className="text-lg font-semibold text-white">{signal.symbol}</p>
              </div>
              <div className="flex flex-col items-end gap-2 text-right">
                <Badge className={badgeClass}>
                  {signal.strength} • {signal.confluenceScore}
                </Badge>
                <span className="text-xs text-slate-300">Price {formatPrice(signal.price)}</span>
              </div>
            </header>

            <section className="grid gap-3 text-sm text-slate-200 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Reasons</span>
                <ul className="flex list-disc flex-col gap-1 pl-4 text-xs text-slate-300">
                  {signal.reason.map((reason, index) => (
                    <li key={`${signal.dedupeKey}-reason-${index}`}>{reason}</li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Risk plan</span>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                  <div className="flex flex-col rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-left">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">SL</span>
                    <span className="font-mono text-sm text-white">{formatPrice(signal.suggestedSL)}</span>
                  </div>
                  <div className="flex flex-col rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-left">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">TP</span>
                    <span className="font-mono text-sm text-white">{formatPrice(signal.suggestedTP)}</span>
                  </div>
                </div>
              </div>
            </section>

            <footer className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-wide text-slate-500">
              <span>Bias {signal.bias.toLowerCase()}</span>
              <span>Key {signal.dedupeKey}</span>
            </footer>
          </article>
        )
      })}
    </div>
  )
}
