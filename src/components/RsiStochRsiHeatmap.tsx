import type { HeatmapResult } from '../types/heatmap'

type RsiStochRsiHeatmapProps = {
  results: HeatmapResult[]
}

const TIMESTAMP_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

const SIGNAL_STYLES: Record<HeatmapResult['signal'], string> = {
  LONG: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100',
  SHORT: 'border-rose-400/40 bg-rose-500/15 text-rose-100',
  NONE: 'border-slate-400/40 bg-slate-500/15 text-slate-100',
}

const SIGNAL_LABELS: Record<HeatmapResult['signal'], string> = {
  LONG: 'Long signal',
  SHORT: 'Short signal',
  NONE: 'No signal',
}

const STRENGTH_STYLES: Record<HeatmapResult['strength'], string> = {
  strong: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100',
  standard: 'border-amber-400/30 bg-amber-500/10 text-amber-100',
  weak: 'border-slate-400/30 bg-slate-500/10 text-slate-100',
}

const BIAS_STYLES: Record<HeatmapResult['bias'], string> = {
  BULL: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100',
  BEAR: 'border-rose-400/30 bg-rose-500/10 text-rose-100',
  NEUTRAL: 'border-slate-400/30 bg-slate-500/10 text-slate-100',
}

const ATR_STATUS_META = {
  ok: {
    label: 'ATR within range',
    className: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100',
  },
  'too-low': {
    label: 'ATR below minimum',
    className: 'border-amber-400/40 bg-amber-500/10 text-amber-100',
  },
  'too-high': {
    label: 'ATR above maximum',
    className: 'border-rose-400/40 bg-rose-500/10 text-rose-100',
  },
  missing: {
    label: 'ATR unavailable',
    className: 'border-slate-400/40 bg-slate-500/10 text-slate-100',
  },
} satisfies Record<HeatmapResult['filters']['atrStatus'], { label: string; className: string }>

const MA_DISTANCE_META = {
  ok: {
    label: 'Distance satisfied',
    className: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100',
  },
  'too-close': {
    label: 'Too close to MA200',
    className: 'border-rose-400/40 bg-rose-500/10 text-rose-100',
  },
  missing: {
    label: 'Distance unavailable',
    className: 'border-slate-400/40 bg-slate-500/10 text-slate-100',
  },
} satisfies Record<HeatmapResult['filters']['maDistanceStatus'], { label: string; className: string }>

function formatNumber(value: number | null, digits = 2): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toFixed(digits)
    : '—'
}

function formatPercent(value: number | null, digits = 2): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${value.toFixed(digits)}%`
    : '—'
}

function formatRaw(value: number | null): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${(value * 100).toFixed(1)}%`
    : '—'
}

function formatTimestamp(value: number | null): string {
  if (value == null) {
    return '—'
  }
  return TIMESTAMP_FORMATTER.format(new Date(value))
}

function formatEvent(event: HeatmapResult['stochEvent']): string {
  if (!event) {
    return '—'
  }
  return event.replace(/_/g, ' ')
}

function dedupe(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index)
}

export function RsiStochRsiHeatmap({ results }: RsiStochRsiHeatmapProps) {
  return (
    <div className="flex w-full flex-col gap-6 rounded-2xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-300">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <h2 className="text-base font-semibold text-white">RSI + StochRSI Heatmap</h2>
        <p className="text-xs text-slate-400">
          Live evaluation of the RSI + StochRSI pseudocode — bias votes, filter gates, and signal strength per entry timeframe.
        </p>
      </div>

      {results.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-600/60 bg-slate-950/60 p-6 text-center text-xs text-slate-400">
          Waiting for market data to build the heatmap. Confirm a valid symbol is selected above.
        </div>
      ) : (
        <div className="grid gap-6">
          {results.map((result) => {
            const longBlockers = dedupe(result.gating.long.blockers)
            const shortBlockers = dedupe(result.gating.short.blockers)
            const atrMeta = ATR_STATUS_META[result.filters.atrStatus]
            const distanceMeta = MA_DISTANCE_META[result.filters.maDistanceStatus]

            return (
              <article
                key={`${result.symbol}-${result.entryTimeframe}`}
                className="flex flex-col gap-5 rounded-2xl border border-white/5 bg-slate-950/60 p-6 shadow-lg shadow-black/20"
              >
                <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-lg font-semibold text-white">
                      {result.entryLabel} heatmap · {result.symbol || '—'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Closed at {formatTimestamp(result.closedAt)} · Votes {result.votes.bull}/{result.votes.total} bull ·{' '}
                      {result.votes.bear}/{result.votes.total} bear
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${SIGNAL_STYLES[result.signal]}`}
                    >
                      {SIGNAL_LABELS[result.signal]}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${STRENGTH_STYLES[result.strength]}`}
                    >
                      Strength · {result.strength}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${BIAS_STYLES[result.bias]}`}
                    >
                      Bias · {result.bias}
                    </span>
                  </div>
                </header>

                <section className="grid gap-4 lg:grid-cols-2">
                  <div className="grid gap-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/5 bg-white/5 p-4">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">RSI (entry timeframe)</p>
                        <p className="mt-1 text-xl font-semibold text-white">{formatNumber(result.rsiLtf.value)}</p>
                        <p className="text-xs text-slate-400">SMA 5: {formatNumber(result.rsiLtf.sma5)}</p>
                        <p className="mt-2 text-xs text-slate-400">
                          Long guard: {result.rsiLtf.okLong ? 'passed' : 'blocked'} · Short guard:{' '}
                          {result.rsiLtf.okShort ? 'passed' : 'blocked'}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-white/5 p-4">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">StochRSI snapshot</p>
                        <p className="mt-1 text-sm text-slate-200">
                          %K {formatNumber(result.stochRsi.k)} · %D {formatNumber(result.stochRsi.d)}
                        </p>
                        <p className="text-xs text-slate-400">Raw: {formatRaw(result.stochRsi.rawNormalized)}</p>
                        <p className="mt-2 text-xs text-slate-400">Event: {formatEvent(result.stochEvent)}</p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-white/5 p-4">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">Higher timeframe votes</p>
                      <ul className="mt-3 grid gap-2 text-xs text-slate-200 sm:grid-cols-2">
                        {result.votes.breakdown.map((vote) => {
                          const voteLabel =
                            vote.vote === 'na'
                              ? 'n/a'
                              : `${vote.vote.toUpperCase()} · ${formatNumber(vote.value)}`
                          const voteColor =
                            vote.vote === 'bull'
                              ? 'text-emerald-200'
                              : vote.vote === 'bear'
                              ? 'text-rose-200'
                              : vote.vote === 'neutral'
                              ? 'text-amber-200'
                              : 'text-slate-400'
                          return (
                            <li key={`${result.entryTimeframe}-${vote.timeframe}`} className="flex items-center justify-between gap-2">
                              <span className="text-slate-300">{vote.label}</span>
                              <span className={`text-[11px] font-semibold uppercase tracking-wide ${voteColor}`}>{voteLabel}</span>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/5 bg-white/5 p-4">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">ATR filter</p>
                        <p className="mt-1 text-sm text-slate-200">ATR% {formatPercent(result.filters.atrPct)}</p>
                        <p className="text-xs text-slate-400">
                          Bounds {formatPercent(result.filters.atrBounds.min)} – {formatPercent(result.filters.atrBounds.max)}
                        </p>
                        <span
                          className={`mt-3 inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-medium ${atrMeta.className}`}
                        >
                          {atrMeta.label}
                        </span>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-white/5 p-4">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">MA200 context</p>
                        <p className="mt-1 text-sm text-slate-200">
                          Price {formatNumber(result.price)} · MA200 {formatNumber(result.ma200.value)}
                        </p>
                        <p className="text-xs text-slate-400">Slope {formatNumber(result.ma200.slope, 4)}</p>
                        <p className="text-xs text-slate-400">Distance {formatPercent(result.filters.distPctToMa200)}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="inline-flex items-center rounded-full border border-slate-400/40 bg-slate-500/10 px-2 py-1 text-[11px] uppercase tracking-wide text-slate-200">
                            Side · {result.filters.maSide}
                          </span>
                          {result.filters.useMa200Filter && (
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-medium ${distanceMeta.className}`}
                            >
                              {distanceMeta.label}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-white/5 p-4">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">Cooldown state</p>
                      <p className="mt-1 text-sm text-slate-200">
                        {result.cooldown.barsSinceSignal == null
                          ? 'No signals yet'
                          : `${result.cooldown.barsSinceSignal} / ${result.cooldown.requiredBars} bars elapsed`}
                      </p>
                      <p className="text-xs text-slate-400">
                        Status: {result.cooldown.ok ? 'ready for next fire' : 'cooldown active'} · Last alert:{' '}
                        {result.cooldown.lastAlertSide ?? '—'} · Last extreme:{' '}
                        {result.cooldown.lastExtremeMarker ?? '—'}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-white/5 bg-white/5 p-4">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-200">
                      Risk ladder (ATR {formatNumber(result.risk.atr)})
                    </h4>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                        <p className="text-[11px] uppercase tracking-wide text-emerald-200">Long plan</p>
                        <ul className="mt-2 space-y-1">
                          <li>SL {formatNumber(result.risk.slLong)}</li>
                          <li>TP1 {formatNumber(result.risk.t1Long)}</li>
                          <li>TP2 {formatNumber(result.risk.t2Long)}</li>
                        </ul>
                      </div>
                      <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">
                        <p className="text-[11px] uppercase tracking-wide text-rose-200">Short plan</p>
                        <ul className="mt-2 space-y-1">
                          <li>SL {formatNumber(result.risk.slShort)}</li>
                          <li>TP1 {formatNumber(result.risk.t1Short)}</li>
                          <li>TP2 {formatNumber(result.risk.t2Short)}</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/5 p-4">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-200">
                      Gating diagnostics
                    </h4>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-emerald-200">
                          Long pathway {result.gating.long.timing ? '· timing ready' : '· waiting for cross'}
                        </p>
                        <ul className="mt-2 space-y-1 text-xs text-slate-300">
                          {longBlockers.length === 0 ? (
                            <li className="text-emerald-200">All conditions met</li>
                          ) : (
                            longBlockers.map((blocker) => (
                              <li key={`long-${blocker}`}>• {blocker}</li>
                            ))
                          )}
                        </ul>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-rose-200">
                          Short pathway {result.gating.short.timing ? '· timing ready' : '· waiting for cross'}
                        </p>
                        <ul className="mt-2 space-y-1 text-xs text-slate-300">
                          {shortBlockers.length === 0 ? (
                            <li className="text-emerald-200">All conditions met</li>
                          ) : (
                            shortBlockers.map((blocker) => (
                              <li key={`short-${blocker}`}>• {blocker}</li>
                            ))
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                </section>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
