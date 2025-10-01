const CONFIG_SECTIONS = [
  {
    title: 'Core configuration',
    items: [
      { label: 'Symbol', value: 'BTCUSDT' },
      { label: 'Entry timeframe', value: '5m (or 15m alternative)' },
      { label: 'Higher timeframe stack', value: '1h · 2h · 4h' },
      { label: 'RSI lengths', value: 'LTF: 9 · HTF: 14/16/21' },
      { label: 'StochRSI', value: 'Len = RSI len · %K=3 · %D=3' },
      { label: 'MA200 filter', value: 'Enabled · minimum distance 0.25%' },
      { label: 'ATR & risk', value: 'ATR 14 · SL 1.2× · TP1 1.0× · TP2 1.8× · risk 0.75%' },
    ],
  },
  {
    title: 'Market regime guardrails',
    items: [
      { label: 'ATR volatility window', value: 'Reject <0.15% or >3.0%' },
      { label: 'Neutral RSI band', value: '45 – 55 → no HTF vote' },
      { label: 'HTF confirmation', value: 'Use closed bars, majority vote unless ALL required' },
      { label: 'Cooldown', value: '6 bars on entry timeframe' },
      { label: 'State tracking', value: 'Last signal index · last extreme marker · last alert side' },
    ],
  },
] as const

const HEATMAP_FRAMES = [
  {
    tf: '5m',
    rsi: '7 – 9',
    stoch: '7 / 7 / %K2 / %D2',
    role: 'Scalp timing — wait for StochRSI cross to confirm micro RSI move.',
  },
  {
    tf: '15m',
    rsi: '9 – 12',
    stoch: '9 / 9 / %K2 / %D3',
    role: 'Intraday scalp — sync with 30m–1h bias before acting.',
  },
  {
    tf: '30m',
    rsi: '12 – 14',
    stoch: '12 / 12 / %K3 / %D3',
    role: 'Intraday swings — use once higher TFs confirm direction.',
  },
  {
    tf: '60m',
    rsi: '14 – 16',
    stoch: '14 / 14 / %K3 / %D3',
    role: 'Trend filter — RSI > 50 bull, < 50 bear. Cross = trigger.',
  },
  {
    tf: '120m',
    rsi: '16 – 18',
    stoch: '16 / 16 / %K3 / %D3',
    role: 'Mini-swing filter — clears chop, pairs with 30m/1h entries.',
  },
  {
    tf: '240m',
    rsi: '18 – 21',
    stoch: '21 / 21 / %K3-4 / %D3-4',
    role: "Swing bias — only take lower TF setups in this direction.",
  },
  {
    tf: '360m',
    rsi: '21 – 24',
    stoch: '24 / 24 / %K4 / %D4',
    role: 'Position bias — sets backdrop for intraday plans.',
  },
] as const

const MAIN_LOOP_STEPS = [
  {
    title: '1.1 Fetch data',
    details: [
      'Pull the latest 500 OHLCV candles for entry TF + 1h/2h/4h stacks.',
      'Synchronize timeframes to avoid partial HTF reads.',
    ],
  },
  {
    title: '1.2 Compute indicators',
    details: [
      'RSI on entry TF plus StochRSI (raw/k/d).',
      'MA200 and ATR 14 used for structure + risk sizing.',
      'HTF RSI values respect closed-bar confirmation flag.',
    ],
  },
  {
    title: '1.3 / 1.4 Filters & bias',
    details: [
      'Reject extremes via ATR% band + distance to MA200.',
      'Vote system: HTF RSI above/below neutral band drives bull/bear bias.',
      'Supports ALL or MAJORITY requirement.',
    ],
  },
  {
    title: '1.5 Timing triggers',
    details: [
      'Long: %K crosses up %D in oversold zone with RSI support.',
      'Short: %K crosses down %D in overbought zone with RSI confirmation.',
      'MA filter ensures trades align with MA200 slope preference.',
    ],
  },
  {
    title: '1.6 / 1.7 Signal gating',
    details: [
      'Cooldown prevents refiring until 6 bars pass.',
      'Track oversold/overbought extremes to manage re-entries.',
      'Final long/short signal requires bias, timing, RSI, MA, cooldown.',
    ],
  },
  {
    title: '1.8 Alert dispatch',
    details: [
      'Only emit on closed bars for non-repainting behaviour.',
      'Payload includes bias votes, RSI/ATR metrics, MA context, and risk block.',
    ],
  },
] as const

const RISK_HELPERS = [
  {
    title: 'Build risk block',
    callout: 'Translate ATR into SL/TP ladder + position sizing.',
    bullets: [
      'SL = price ± (ATR × 1.2).',
      'TP1 = price ± (ATR × 1.0), TP2 = price ± (ATR × 1.8).',
      'Risk capital = equity × 0.75%.',
    ],
  },
  {
    title: 'Grade strength',
    callout: 'Qualitative score based on HTF unanimity + MA200 slope.',
    bullets: [
      'All votes aligned & MA slope ≥ 0 ⇒ strong.',
      'Vote imbalance ⇒ standard, else weak.',
    ],
  },
  {
    title: 'Alert payload',
    callout: 'Structured object for webhooks/bots.',
    bullets: [
      'Side · symbol · timeframe · bias votes.',
      'RSI/ATR data, StochRSI event meta, MA context.',
      'Risk block + ISO timestamp + strength score.',
    ],
  },
] as const

export function RsiStochRsiHeatmap() {
  return (
    <div className="flex w-full flex-col gap-6 rounded-2xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-300">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <h2 className="text-base font-semibold text-white">RSI + StochRSI Execution Map</h2>
        <p className="text-xs text-slate-400">
          Visual decode of the pseudocode pipeline powering alerts — from configuration to risk blocks.
        </p>
      </div>

      <section className="grid gap-4">
        <header className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
            0 · Configuration &amp; state
          </h3>
          <span className="text-[11px] uppercase text-emerald-200/70">what the engine expects</span>
        </header>
        <div className="grid gap-4 lg:grid-cols-2">
          {CONFIG_SECTIONS.map((section) => (
            <div
              key={section.title}
              className="rounded-xl border border-white/5 bg-emerald-400/5 p-4 shadow-inner shadow-emerald-500/10"
            >
              <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-200">
                {section.title}
              </h4>
              <dl className="mt-3 grid gap-2">
                {section.items.map((item) => (
                  <div key={item.label} className="flex flex-col gap-0.5">
                    <dt className="text-[11px] uppercase tracking-wide text-emerald-100/70">
                      {item.label}
                    </dt>
                    <dd className="text-sm text-emerald-50/90">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4">
        <header className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-sky-300">1 · Execution loop</h3>
          <span className="text-[11px] uppercase text-sky-200/70">bar-by-bar routine</span>
        </header>
        <div className="grid gap-3">
          {MAIN_LOOP_STEPS.map((step, index) => (
            <div
              key={step.title}
              className="grid gap-3 rounded-xl border border-white/5 bg-sky-400/5 p-4 md:grid-cols-[auto_minmax(0,1fr)] md:items-start"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-sky-400/40 bg-sky-500/10 text-xs font-semibold text-sky-200">
                {index + 1}
              </span>
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-semibold text-white">{step.title}</h4>
                <ul className="grid gap-1 text-sm text-slate-100/90">
                  {step.details.map((detail) => (
                    <li key={detail} className="flex items-start gap-2">
                      <span className="mt-[6px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-sky-300" />
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4">
        <header className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-300">
            Multi-timeframe oscillator map
          </h3>
          <span className="text-[11px] uppercase text-amber-200/70">RSI ↔ StochRSI pairings</span>
        </header>
        <div className="grid gap-3 lg:grid-cols-3">
          {HEATMAP_FRAMES.map((frame) => (
            <div
              key={frame.tf}
              className="flex flex-col gap-2 rounded-xl border border-white/5 bg-amber-400/5 p-4"
            >
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-amber-200">
                  {frame.tf}
                </span>
                <span className="text-[11px] text-amber-100/80">RSI {frame.rsi}</span>
              </div>
              <div className="rounded-lg border border-amber-400/30 bg-black/20 p-2 text-[13px] text-amber-100">
                StochRSI {frame.stoch}
              </div>
              <p className="text-xs text-amber-50/90">{frame.role}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4">
        <header className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-rose-300">2 · Risk helpers</h3>
          <span className="text-[11px] uppercase text-rose-200/70">automation glue</span>
        </header>
        <div className="grid gap-3 md:grid-cols-3">
          {RISK_HELPERS.map((helper) => (
            <div
              key={helper.title}
              className="flex flex-col gap-3 rounded-xl border border-white/5 bg-rose-400/5 p-4"
            >
              <div className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wide text-rose-200/80">
                  {helper.title}
                </span>
                <h4 className="text-sm font-semibold text-white">{helper.callout}</h4>
              </div>
              <ul className="grid gap-1 text-xs text-rose-50/80">
                {helper.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2">
                    <span className="mt-[6px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-rose-300" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
