import { useMemo, useState } from 'react'
import type { HeatmapResult } from '../types/heatmap'
import type { QuantumCompositeSignal } from '../lib/quantum'
import {
  DEFAULT_HEDGE_CONFIG,
  calculateHedge,
  type HedgeDecision,
  type HedgePrediction,
  type HedgePosition,
} from '../lib/hedging'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatNumber(value: number | null, fractionDigits = 4): string {
  if (!Number.isFinite(value ?? NaN)) {
    return '—'
  }

  return (value as number).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  })
}

function formatPercent(value: number | null, fractionDigits = 1, signed = false): string {
  if (!Number.isFinite(value ?? NaN)) {
    return '—'
  }

  const multiplier = 10 ** fractionDigits
  const scaled = Math.round((value as number) * 100 * multiplier) / multiplier
  const normalized = Object.is(scaled, -0) ? 0 : scaled
  const base = normalized.toFixed(fractionDigits)

  if (signed && normalized > 0) {
    return `+${base}%`
  }

  return `${base}%`
}

function toFiniteOrNull(value: unknown): number | null {
  if (typeof value !== 'number') {
    return null
  }

  return Number.isFinite(value) ? value : null
}

type HedgingCalculatorPanelProps = {
  symbol: string
  currentPrice: number | null | undefined
  isPriceLoading: boolean
  quantumSignal: QuantumCompositeSignal | null
  latestSnapshot: HeatmapResult | null
}

const TREND_STATES = ['Down', 'Base', 'Reversal', 'Up'] as const

type ProbabilityVector = Record<(typeof TREND_STATES)[number], number>

const DEFAULT_PROBABILITIES: ProbabilityVector = {
  Down: 0,
  Base: 0,
  Reversal: 0,
  Up: 0,
}

export function HedgingCalculatorPanel({
  symbol,
  currentPrice,
  isPriceLoading,
  quantumSignal,
  latestSnapshot,
}: HedgingCalculatorPanelProps) {
  const [positionDirection, setPositionDirection] = useState<'long' | 'short'>('long')
  const [entryPriceInput, setEntryPriceInput] = useState('')
  const [leverageInput, setLeverageInput] = useState('')
  const [quantityInput, setQuantityInput] = useState('')

  const entryPrice = useMemo(() => {
    const parsed = Number.parseFloat(entryPriceInput)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }, [entryPriceInput])

  const leverage = useMemo(() => {
    const parsed = Number.parseFloat(leverageInput)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }, [leverageInput])

  const quantity = useMemo(() => {
    const parsed = Number.parseFloat(quantityInput)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }, [quantityInput])

  const normalizedCurrentPrice = useMemo(() => {
    if (typeof currentPrice !== 'number' || !Number.isFinite(currentPrice) || currentPrice <= 0) {
      return null
    }

    return currentPrice
  }, [currentPrice])

  const notional = useMemo(() => {
    if (entryPrice === null || quantity === null) {
      return null
    }

    return entryPrice * quantity
  }, [entryPrice, quantity])

  const requiredMargin = useMemo(() => {
    if (notional === null || leverage === null) {
      return null
    }

    return notional / leverage
  }, [leverage, notional])

  const unrealizedPnl = useMemo(() => {
    if (entryPrice === null || quantity === null || normalizedCurrentPrice === null) {
      return null
    }

    const pnl =
      positionDirection === 'long'
        ? (normalizedCurrentPrice - entryPrice) * quantity
        : (entryPrice - normalizedCurrentPrice) * quantity

    return pnl
  }, [entryPrice, normalizedCurrentPrice, positionDirection, quantity])

  const probabilityVector = useMemo<ProbabilityVector>(() => {
    if (!quantumSignal) {
      return DEFAULT_PROBABILITIES
    }

    const base: ProbabilityVector = { ...DEFAULT_PROBABILITIES }

    for (const entry of quantumSignal.probabilities ?? []) {
      if (!TREND_STATES.includes(entry.state)) {
        continue
      }
      const probability = toFiniteOrNull(entry.probability)
      if (probability !== null) {
        base[entry.state] = probability
      }
    }

    const fused = quantumSignal.debug?.fusedVector
    if (fused) {
      for (const state of TREND_STATES) {
        const candidate = toFiniteOrNull(fused[state])
        if (candidate !== null) {
          base[state] = candidate
        }
      }
    }

    return base
  }, [quantumSignal])

  const prediction = useMemo<HedgePrediction | null>(() => {
    if (normalizedCurrentPrice === null) {
      return null
    }

    const atr = toFiniteOrNull(latestSnapshot?.risk?.atr)
    const ema10 = toFiniteOrNull(latestSnapshot?.ema?.ema10)
    const ema50 = toFiniteOrNull(latestSnapshot?.ema?.ema50)
    const ma200 = toFiniteOrNull(latestSnapshot?.ma200?.value)
    const macdValue = toFiniteOrNull(latestSnapshot?.macd?.value)
    const macdSignal = toFiniteOrNull(latestSnapshot?.macd?.signal)
    const macdHist = toFiniteOrNull(latestSnapshot?.macd?.histogram)
    const adxValue = toFiniteOrNull(latestSnapshot?.adx?.value)
    const timestamp = toFiniteOrNull(latestSnapshot?.evaluatedAt ?? latestSnapshot?.closedAt)

    return {
      currentPrice: normalizedCurrentPrice,
      atr,
      pUp: probabilityVector.Up,
      pDown: probabilityVector.Down,
      pReversal: probabilityVector.Reversal,
      pBase: probabilityVector.Base,
      ema10,
      ema50,
      ma200,
      macd: { value: macdValue, signal: macdSignal, hist: macdHist },
      adx: adxValue,
      timestamp,
    }
  }, [latestSnapshot, normalizedCurrentPrice, probabilityVector])

  const position = useMemo<HedgePosition | null>(() => {
    if (entryPrice === null || quantity === null || normalizedCurrentPrice === null) {
      return null
    }

    return {
      symbol,
      side: positionDirection === 'long' ? 'LONG' : 'SHORT',
      entryPrice,
      quantity,
      leverage,
    }
  }, [entryPrice, leverage, normalizedCurrentPrice, positionDirection, quantity, symbol])

  const decision = useMemo<HedgeDecision | null>(() => {
    if (!position || !prediction) {
      return null
    }

    return calculateHedge(position, prediction, DEFAULT_HEDGE_CONFIG)
  }, [position, prediction])

  const hedgeNotional = useMemo(() => {
    if (!decision?.hedgeQty || !prediction) {
      return null
    }

    return decision.hedgeQty * prediction.currentPrice
  }, [decision?.hedgeQty, prediction])

  const pnlLabel = useMemo(() => {
    if (unrealizedPnl === null) {
      return '—'
    }

    const prefix = unrealizedPnl > 0 ? '+' : ''
    return `${prefix}${currencyFormatter.format(unrealizedPnl)}`
  }, [unrealizedPnl])

  const decisionReasons = useMemo(() => {
    if (!decision) {
      return []
    }

    if (decision.reasons.length > 0) {
      return decision.reasons
    }

    return decision.shouldHedge ? ['Model triggered hedge without named condition'] : ['All hedge triggers idle']
  }, [decision])

  const context = decision?.context ?? null

  const timestampLabel = useMemo(() => {
    if (!prediction?.timestamp) {
      return '—'
    }

    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(prediction.timestamp))
  }, [prediction?.timestamp])

  const probabilityEntries = useMemo(
    () => [
      { label: 'Down risk', value: probabilityVector.Down },
      { label: 'Base consolidation', value: probabilityVector.Base },
      { label: 'Reversal setup', value: probabilityVector.Reversal },
      { label: 'Upside continuation', value: probabilityVector.Up },
    ],
    [probabilityVector.Base, probabilityVector.Down, probabilityVector.Reversal, probabilityVector.Up],
  )

  const decisionCardClass = !decision
    ? 'border-slate-400/30 bg-slate-900/60 text-slate-200'
    : decision.shouldHedge
      ? 'border-rose-400/40 bg-rose-500/10 text-rose-100'
      : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'

  return (
    <section className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col">
          <h2 className="text-base font-semibold text-white">Hedging assistant</h2>
          <p className="text-xs text-slate-400">
            Provide your position details to evaluate a protective hedge for {symbol}.
          </p>
        </div>
        <div className="flex flex-col items-start text-xs text-slate-400 sm:items-end">
          <span className="uppercase tracking-wider text-slate-300">Latest model snapshot</span>
          <span>{timestampLabel}</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="hedge-direction" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Position direction
          </label>
          <select
            id="hedge-direction"
            value={positionDirection}
            onChange={(event) => setPositionDirection(event.target.value as 'long' | 'short')}
            className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-medium text-white shadow focus:border-indigo-400 focus:outline-none"
          >
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="hedge-entry-price" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Entry price
          </label>
          <input
            id="hedge-entry-price"
            inputMode="decimal"
            value={entryPriceInput}
            onChange={(event) => setEntryPriceInput(event.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="e.g. 27000"
            className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-medium text-white shadow focus:border-indigo-400 focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="hedge-leverage" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Leverage
          </label>
          <input
            id="hedge-leverage"
            inputMode="decimal"
            value={leverageInput}
            onChange={(event) => setLeverageInput(event.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="e.g. 5"
            className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-medium text-white shadow focus:border-indigo-400 focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="hedge-quantity" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Quantity
          </label>
          <input
            id="hedge-quantity"
            inputMode="decimal"
            value={quantityInput}
            onChange={(event) => setQuantityInput(event.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="e.g. 0.5"
            className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-medium text-white shadow focus:border-indigo-400 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid gap-4 rounded-2xl border border-white/5 bg-slate-950/40 p-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-slate-400">Latest price</span>
          <span className="text-lg font-semibold text-white">
            {normalizedCurrentPrice !== null ? formatNumber(normalizedCurrentPrice, 4) : 'Waiting for data…'}
          </span>
          {isPriceLoading && <span className="text-[11px] text-slate-500">Refreshing market data…</span>}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-slate-400">Unrealized P&amp;L</span>
          <span
            className={`text-lg font-semibold ${
              unrealizedPnl === null ? 'text-slate-300' : unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {pnlLabel}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-slate-400">Notional value</span>
          <span className="text-lg font-semibold text-white">
            {notional !== null ? currencyFormatter.format(notional) : '—'}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-slate-400">Required margin</span>
          <span className="text-lg font-semibold text-white">
            {requiredMargin !== null ? currencyFormatter.format(requiredMargin) : '—'}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-slate-400">ATR (model)</span>
          <span className="text-lg font-semibold text-white">
            {prediction?.atr != null ? formatNumber(prediction.atr, 4) : '—'}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-slate-400">ADX strength</span>
          <span className="text-lg font-semibold text-white">
            {prediction?.adx != null ? formatNumber(prediction.adx, 2) : '—'}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={`flex flex-col gap-4 rounded-2xl border p-5 ${decisionCardClass}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider">Model decision</span>
              <span className="text-xl font-semibold">
                {!decision
                  ? 'Provide price, quantity, and live data'
                  : decision.shouldHedge && decision.hedgeSide && decision.hedgeQty
                    ? `Hedge ${decision.hedgeSide} ${formatNumber(decision.hedgeQty, 6)} units`
                    : 'No hedge needed now'}
              </span>
            </div>
            <button
              type="button"
              disabled={!decision?.shouldHedge || !decision.hedgeQty}
              title="Connect execution to place the hedge automatically"
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                decision?.shouldHedge && decision.hedgeQty
                  ? 'bg-white/10 text-white hover:bg-white/20'
                  : 'bg-white/5 text-white/60'
              }`}
            >
              Place hedge
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wider">Suggested hedge direction</span>
              <span className="text-sm font-semibold">
                {decision?.hedgeSide ?? '—'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wider">Suggested hedge size</span>
              <span className="text-sm font-semibold">
                {decision?.hedgeQty ? `${formatNumber(decision.hedgeQty, 6)} units` : '—'}
              </span>
              {hedgeNotional !== null && (
                <span className="text-[11px]">≈ {currencyFormatter.format(hedgeNotional)}</span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wider">Target exposure after hedge</span>
              <span className="text-sm font-semibold">
                {decision?.targetExposureAfter != null ? `${formatNumber(decision.targetExposureAfter, 6)} units` : '—'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wider">Estimated protection</span>
              <span className="text-sm font-semibold">
                {decision?.estProtectionQuote != null ? currencyFormatter.format(decision.estProtectionQuote) : '—'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/60 p-5">
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-slate-400">Trigger diagnostics</span>
            <ul className="list-disc space-y-1 pl-4 text-sm text-slate-200">
              {decisionReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wider text-slate-400">PnL vs -R multiple</span>
              <span className="text-sm font-semibold text-white">
                {context ? `${currencyFormatter.format(context.pnl)} / ${currencyFormatter.format(context.rPnl)}` : '—'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wider text-slate-400">Expected downside</span>
              <span className="text-sm font-semibold text-white">
                {context ? currencyFormatter.format(context.expectedDownside) : '—'}
              </span>
              <span className="text-[11px] text-slate-400">
                Threshold {context ? currencyFormatter.format(context.thresholdQuote) : '—'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wider text-slate-400">Prob gap (down - up)</span>
              <span className="text-sm font-semibold text-white">
                {context ? formatPercent(context.probGapDown, 1, true) : '—'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wider text-slate-400">Momentum against / Trend against</span>
              <span className="text-sm font-semibold text-white">
                {context ? `${context.momentumAgainst ? 'Yes' : 'No'} / ${context.trendAgainst ? 'Yes' : 'No'}` : '—'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wider text-slate-400">Current exposure</span>
              <span className="text-sm font-semibold text-white">
                {context ? currencyFormatter.format(Math.abs(context.currentExposureQuote)) : '—'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wider text-slate-400">Target exposure</span>
              <span className="text-sm font-semibold text-white">
                {context ? currencyFormatter.format(Math.abs(context.targetExposureQuote)) : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 rounded-2xl border border-white/5 bg-slate-950/40 p-5 sm:grid-cols-2">
        <div className="flex flex-col gap-3">
          <span className="text-xs uppercase tracking-wider text-slate-400">Quantum probability mix</span>
          <ul className="grid gap-2">
            {probabilityEntries.map((entry) => (
              <li key={entry.label} className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-900/60 px-3 py-2 text-sm text-white">
                <span>{entry.label}</span>
                <span>{formatPercent(entry.value, 1)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-3">
          <span className="text-xs uppercase tracking-wider text-slate-400">Momentum snapshot</span>
          <div className="grid gap-2">
            <div className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-900/60 px-3 py-2 text-sm text-white">
              <span>MACD histogram</span>
              <span>{prediction?.macd.hist != null ? formatNumber(prediction.macd.hist, 4) : '—'}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-900/60 px-3 py-2 text-sm text-white">
              <span>EMA10 / EMA50</span>
              <span>
                {prediction?.ema10 != null ? formatNumber(prediction.ema10, 4) : '—'}
                {' / '}
                {prediction?.ema50 != null ? formatNumber(prediction.ema50, 4) : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-900/60 px-3 py-2 text-sm text-white">
              <span>MA200</span>
              <span>{prediction?.ma200 != null ? formatNumber(prediction.ma200, 4) : '—'}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
