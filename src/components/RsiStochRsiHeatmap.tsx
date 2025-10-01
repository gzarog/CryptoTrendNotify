const HEATMAP_ROWS = [
  {
    timeframe: '5m',
    rsiLength: '7–9',
    stochRsi: '7 / 7 / 2 / 2',
    usage: 'Scalp timing',
    interpretation:
      'Very sensitive — wait for StochRSI cross to confirm RSI short-term direction.',
    gradient: 'from-emerald-500/30 via-emerald-500/10 to-transparent',
  },
  {
    timeframe: '15m',
    rsiLength: '9–12',
    stochRsi: '9 / 9 / 2 / 3',
    usage: 'Intraday scalp',
    interpretation: 'Good entry timing if aligned with 30m–1h trend bias.',
    gradient: 'from-teal-500/30 via-teal-500/10 to-transparent',
  },
  {
    timeframe: '30m',
    rsiLength: '12–14',
    stochRsi: '12 / 12 / 3 / 3',
    usage: 'Intraday swings',
    interpretation: 'Stronger confirmation; use for entry after higher TF bias agrees.',
    gradient: 'from-sky-500/30 via-sky-500/10 to-transparent',
  },
  {
    timeframe: '60m (1h)',
    rsiLength: '14–16',
    stochRsi: '14 / 14 / 3 / 3',
    usage: 'Trend filter + entry',
    interpretation: 'RSI >50 bullish bias, <50 bearish; StochRSI cross = entry trigger.',
    gradient: 'from-indigo-500/30 via-indigo-500/10 to-transparent',
  },
  {
    timeframe: '120m (2h)',
    rsiLength: '16–18',
    stochRsi: '16 / 16 / 3 / 3',
    usage: 'Mini-swing filter',
    interpretation: 'Filters false moves; use with 30m/1h for tighter entry.',
    gradient: 'from-violet-500/30 via-violet-500/10 to-transparent',
  },
  {
    timeframe: '240m (4h)',
    rsiLength: '18–21',
    stochRsi: '21 / 21 / 3–4 / 3–4',
    usage: "Swing trader's bias",
    interpretation: 'Major trend filter. Only take trades in this direction on lower TFs.',
    gradient: 'from-amber-500/30 via-amber-500/10 to-transparent',
  },
  {
    timeframe: '360m (6h)',
    rsiLength: '21–24',
    stochRsi: '24 / 24 / 4 / 4',
    usage: 'Position bias',
    interpretation: 'Very stable — sets directional backdrop for all intraday trades.',
    gradient: 'from-rose-500/30 via-rose-500/10 to-transparent',
  },
] as const

export function RsiStochRsiHeatmap() {
  return (
    <div className="flex w-full flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-300">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <h2 className="text-base font-semibold text-white">RSI + StochRSI Heatmap</h2>
        <p className="text-xs text-slate-400">
          Multi-timeframe cheat sheet blending RSI bias and StochRSI triggers for faster confluence.
        </p>
      </div>
      <div className="grid gap-3">
        {HEATMAP_ROWS.map((row) => (
          <div
            key={row.timeframe}
            className={`grid gap-3 rounded-xl border border-white/5 bg-gradient-to-r p-4 sm:grid-cols-2 lg:grid-cols-[90px_140px_160px_minmax(0,1fr)] ${row.gradient}`}
          >
            <div className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">Timeframe</span>
              <span className="text-sm font-semibold text-white">{row.timeframe}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">RSI length</span>
              <span className="text-sm text-slate-200">{row.rsiLength}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">StochRSI (Len / %K / %D)</span>
              <span className="text-sm text-slate-200">{row.stochRsi}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">Usage &amp; interpretation</span>
              <span className="text-sm text-slate-100">
                <span className="font-semibold text-white">{row.usage} — </span>
                {row.interpretation}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
