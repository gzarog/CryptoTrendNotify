import { useMemo, useState } from 'react'
import type { QuantumCompositeSignal } from '../lib/quantum'

const QUANTUM_TONE_STYLES = {
  positive: {
    container: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100',
    label: 'text-emerald-300',
    subtle: 'text-emerald-200',
  },
  negative: {
    container: 'border-rose-500/40 bg-rose-500/10 text-rose-100',
    label: 'text-rose-300',
    subtle: 'text-rose-200',
  },
  neutral: {
    container: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-100',
    label: 'text-indigo-300',
    subtle: 'text-indigo-200',
  },
} as const

type QuantumTone = keyof typeof QUANTUM_TONE_STYLES

type QuantumGuidance = {
  multiplier: number
  tone: QuantumTone
  summary: string
  confidenceLabel: string
  stateLabel: string
  flipSignalLabel: string
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatNumber(value: number | null, fractionDigits = 4): string {
  const normalized = value ?? NaN

  if (!Number.isFinite(normalized)) {
    return '—'
  }

  return normalized.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  })
}

type HedgingCalculatorPanelProps = {
  currentPrice: number | null | undefined
  isPriceLoading: boolean
  quantumSignal: QuantumCompositeSignal | null
}

export function HedgingCalculatorPanel({
  currentPrice,
  isPriceLoading,
  quantumSignal,
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

  const positionIsInLoss = useMemo(() => {
    if (entryPrice === null || normalizedCurrentPrice === null) {
      return null
    }

    return positionDirection === 'long'
      ? normalizedCurrentPrice < entryPrice
      : normalizedCurrentPrice > entryPrice
  }, [entryPrice, normalizedCurrentPrice, positionDirection])

  const quantumGuidance = useMemo<QuantumGuidance | null>(() => {
    if (!quantumSignal) {
      return null
    }

    const normalizedConfidence = Math.min(Math.max(quantumSignal.confidence ?? 0, 0), 1)
    const confidencePct = Math.round(normalizedConfidence * 100)
    const convictionLabel =
      normalizedConfidence >= 0.75
        ? 'high'
        : normalizedConfidence >= 0.55
          ? 'moderate'
          : 'developing'
    const confidenceLabel = `${confidencePct}% ${convictionLabel} confidence`
    const flipSignalLabel = quantumSignal.flipThreshold.signal.toLowerCase()
    const lossActive = positionIsInLoss === true

    let tone: QuantumTone = 'neutral'
    let multiplier = 1
    let summary = ''

    if (quantumSignal.state === 'Up') {
      if (positionDirection === 'long') {
        tone = 'positive'
        multiplier =
          normalizedConfidence >= 0.75 ? 0.5 : normalizedConfidence >= 0.55 ? 0.7 : 0.85
        summary = lossActive
          ? `Quantum engine favors upside (${flipSignalLabel}), so the hedge suggestion is scaled down to keep long exposure while price stabilizes.`
          : `Quantum engine favors upside (${flipSignalLabel}). If hedging becomes necessary, sizing will be tempered to preserve long exposure.`
      } else {
        tone = 'negative'
        multiplier =
          normalizedConfidence >= 0.75 ? 1.4 : normalizedConfidence >= 0.55 ? 1.2 : 1.05
        summary = lossActive
          ? `Quantum engine favors upside (${flipSignalLabel}), opposing the short. Hedge sizing is boosted to guard against a squeeze.`
          : `Quantum engine favors upside (${flipSignalLabel}). If price turns against the short, expect a larger protective hedge.`
      }
    } else if (quantumSignal.state === 'Down') {
      if (positionDirection === 'short') {
        tone = 'positive'
        multiplier =
          normalizedConfidence >= 0.75 ? 0.5 : normalizedConfidence >= 0.55 ? 0.7 : 0.85
        summary = lossActive
          ? `Quantum engine favors further downside (${flipSignalLabel}), so the hedge is tempered to preserve your short exposure.`
          : `Quantum engine favors further downside (${flipSignalLabel}). Future hedges will stay lighter to keep the short active.`
      } else {
        tone = 'negative'
        multiplier =
          normalizedConfidence >= 0.75 ? 1.4 : normalizedConfidence >= 0.55 ? 1.2 : 1.05
        summary = lossActive
          ? `Quantum engine points lower (${flipSignalLabel}), pressuring the long position. Hedge sizing is increased to absorb the move.`
          : `Quantum engine points lower (${flipSignalLabel}). If losses develop, the hedge will scale up quickly to defend the long.`
      }
    } else if (quantumSignal.state === 'Reversal') {
      tone = 'neutral'
      multiplier = normalizedConfidence >= 0.55 ? 0.95 : 1
      summary = lossActive
        ? `Quantum engine is watching for a reversal (${flipSignalLabel}), so hedge sizing stays close to baseline while momentum pivots.`
        : `Quantum engine is watching for a reversal (${flipSignalLabel}). We'll hold the baseline sizing until the move confirms.`
    } else {
      tone = 'neutral'
      multiplier = 1
      summary = lossActive
        ? `Quantum engine reads a base-building phase (${flipSignalLabel}). Hedge sizing stays neutral until conviction returns.`
        : `Quantum engine reads a base-building phase (${flipSignalLabel}). No adjustment is applied until stronger bias develops.`
    }

    const clampedMultiplier = Math.min(Math.max(multiplier, 0.35), 1.6)

    return {
      multiplier: clampedMultiplier,
      tone,
      summary,
      confidenceLabel,
      stateLabel: quantumSignal.state,
      flipSignalLabel,
    }
  }, [positionDirection, positionIsInLoss, quantumSignal])

  const hedge = useMemo(() => {
    if (
      positionIsInLoss !== true ||
      entryPrice === null ||
      quantity === null ||
      normalizedCurrentPrice === null ||
      normalizedCurrentPrice <= 0
    ) {
      return null
    }

    const normalizedRequiredMargin =
      requiredMargin !== null && Number.isFinite(requiredMargin) && requiredMargin > 0 ? requiredMargin : null

    const fallbackMarginFromInputs =
      leverage !== null && Number.isFinite(leverage) && leverage > 0 ? (entryPrice * quantity) / leverage : null

    const marginBasis =
      normalizedRequiredMargin !== null && normalizedRequiredMargin > 0
        ? normalizedRequiredMargin
        : fallbackMarginFromInputs !== null && fallbackMarginFromInputs > 0
          ? fallbackMarginFromInputs
          : null

    let suggestedLeverage: number | null = null

    if (marginBasis !== null) {
      const marketValue = normalizedCurrentPrice * quantity
      const derived = marketValue / marginBasis
      if (Number.isFinite(derived) && derived > 0) {
        suggestedLeverage = derived
      }
    }

    if ((suggestedLeverage === null || suggestedLeverage <= 0) && leverage !== null) {
      suggestedLeverage = leverage > 0 ? leverage : null
    }

    let hedgeNotional: number | null = null
    let hedgeQuantity: number | null = null
    let hedgeMargin: number | null = null
    let projectedBreakEvenPrice: number | null = null
    let breakEvenLocked: boolean = false

    const normalizedSuggestedLeverage =
      suggestedLeverage !== null && Number.isFinite(suggestedLeverage) && suggestedLeverage > 0 ? suggestedLeverage : null

    if (marginBasis !== null && normalizedSuggestedLeverage !== null) {
      const computedNotional = marginBasis * normalizedSuggestedLeverage
      if (Number.isFinite(computedNotional) && computedNotional > 0) {
        hedgeNotional = computedNotional
        const computedQuantity = hedgeNotional / normalizedCurrentPrice
        hedgeQuantity = Number.isFinite(computedQuantity) && computedQuantity > 0 ? computedQuantity : null
        hedgeMargin = marginBasis
      }
    }

    if (hedgeNotional === null || hedgeQuantity === null) {
      const fallbackNotional = entryPrice * quantity
      const fallbackQuantity = fallbackNotional / normalizedCurrentPrice
      hedgeNotional = Number.isFinite(fallbackNotional) && fallbackNotional > 0 ? fallbackNotional : null
      hedgeQuantity = Number.isFinite(fallbackQuantity) && fallbackQuantity > 0 ? fallbackQuantity : null
      hedgeMargin = leverage && hedgeNotional !== null ? hedgeNotional / leverage : null
    }

    const adjustmentMultiplier = quantumGuidance?.multiplier ?? 1

    if (hedgeQuantity !== null && adjustmentMultiplier !== 1) {
      hedgeQuantity *= adjustmentMultiplier
      if (normalizedCurrentPrice !== null) {
        hedgeNotional = normalizedCurrentPrice * hedgeQuantity
      } else if (hedgeNotional !== null) {
        hedgeNotional *= adjustmentMultiplier
      }
      if (hedgeMargin !== null) {
        hedgeMargin *= adjustmentMultiplier
      }
    }

    if (
      entryPrice !== null &&
      quantity !== null &&
      hedgeQuantity !== null &&
      normalizedCurrentPrice !== null
    ) {
      const exposureDelta = quantity - hedgeQuantity
      if (Math.abs(exposureDelta) <= 1e-9) {
        breakEvenLocked = true
      } else {
        const numerator = entryPrice * quantity - normalizedCurrentPrice * hedgeQuantity
        const computedBreakEven = numerator / exposureDelta
        if (Number.isFinite(computedBreakEven) && computedBreakEven > 0) {
          projectedBreakEvenPrice = computedBreakEven
        }
      }
    }

    return {
      direction: positionDirection === 'long' ? 'short' : 'long',
      quantity: hedgeQuantity,
      notional: hedgeNotional,
      margin: hedgeMargin,
      suggestedLeverage: normalizedSuggestedLeverage,
      projectedBreakEvenPrice,
      breakEvenLocked,
      adjustmentMultiplier,
    }
  }, [
    entryPrice,
    leverage,
    normalizedCurrentPrice,
    positionDirection,
    positionIsInLoss,
    quantity,
    requiredMargin,
    quantumGuidance,
  ])

  const pnlLabel = useMemo(() => {
    if (unrealizedPnl === null) {
      return '—'
    }

    const prefix = unrealizedPnl > 0 ? '+' : ''
    return `${prefix}${currencyFormatter.format(unrealizedPnl)}`
  }, [unrealizedPnl])

  return (
    <section className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-slate-900/60 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-white">Hedging assistant</h2>
          <p className="text-xs text-slate-400">
            Evaluate an opposite position to neutralize risk if your trade moves against you.
          </p>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-300">
          Experimental
        </span>
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

      <div className="grid gap-6 rounded-2xl border border-white/5 bg-slate-950/40 p-5 sm:grid-cols-2">
        <div className="flex flex-col gap-4">
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
            {positionIsInLoss === false && (
              <span className="text-[11px] text-emerald-300">Your position is currently profitable.</span>
            )}
            {positionIsInLoss && (
              <span className="text-[11px] text-rose-300">Loss detected based on the latest price.</span>
            )}
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
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-slate-400">Suggested hedge direction</span>
            <span className="text-lg font-semibold text-white">
              {hedge ? hedge.direction.toUpperCase() : '—'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-slate-400">Suggested hedge size</span>
            <span className="text-lg font-semibold text-white">
              {hedge ? `${formatNumber(hedge.quantity, 6)} units` : '—'}
            </span>
            {hedge && hedge.notional !== null && normalizedCurrentPrice !== null && (
              <span className="text-[11px] text-slate-400">
                Matches approximately {currencyFormatter.format(hedge.notional)} of exposure at {formatNumber(normalizedCurrentPrice, 4)}.
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-slate-400">Estimated hedge margin</span>
            <span className="text-lg font-semibold text-white">
              {hedge && hedge.margin !== null ? currencyFormatter.format(hedge.margin) : '—'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-slate-400">Suggested hedge leverage</span>
            <span className="text-lg font-semibold text-white">
              {hedge && hedge.suggestedLeverage !== null ? formatNumber(hedge.suggestedLeverage, 2) : '—'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-slate-400">Projected break-even price</span>
            <span className="text-lg font-semibold text-white">
              {hedge
                ? hedge.projectedBreakEvenPrice !== null
                  ? formatNumber(hedge.projectedBreakEvenPrice, 4)
                  : hedge.breakEvenLocked
                    ? 'Not reachable (fully hedged)'
                    : '—'
                : '—'}
            </span>
            {hedge && hedge.projectedBreakEvenPrice !== null && (
              <span className="text-[11px] text-slate-400">
                Price level where the original position and hedge would offset each other.
              </span>
            )}
            {hedge && hedge.breakEvenLocked && hedge.projectedBreakEvenPrice === null && (
              <span className="text-[11px] text-slate-400">
                This hedge locks in the current loss. Adjust size or leverage to target a recoverable break-even level.
              </span>
            )}
          </div>
          {quantumGuidance && (
            <div
              className={`rounded-2xl border p-4 text-xs ${QUANTUM_TONE_STYLES[quantumGuidance.tone].container}`}
            >
              <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider">
                <span>Quantum overlay</span>
                <span className={QUANTUM_TONE_STYLES[quantumGuidance.tone].label}>
                  {quantumGuidance.confidenceLabel}
                </span>
              </div>
              <span className={`text-[11px] uppercase tracking-widest ${QUANTUM_TONE_STYLES[quantumGuidance.tone].label}`}>
                Flip signal: {quantumGuidance.flipSignalLabel}
              </span>
              <p className="mt-2 text-sm font-semibold text-white">
                {quantumGuidance.stateLabel} bias
              </p>
              <p className={`mt-2 leading-relaxed ${QUANTUM_TONE_STYLES[quantumGuidance.tone].subtle}`}>
                {quantumGuidance.summary}
              </p>
              {hedge && (
                <p className={`mt-2 text-[11px] ${QUANTUM_TONE_STYLES[quantumGuidance.tone].label}`}>
                  Hedge size tuned to {Math.round(hedge.adjustmentMultiplier * 100)}% of the base calculation.
                </p>
              )}
            </div>
          )}
          {positionIsInLoss === false && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-200">
              A hedge is optional while the position is in profit. Monitor price action before committing additional margin.
            </div>
          )}
          {positionIsInLoss && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-200">
              Consider entering the suggested hedge to lock in the current loss and prevent further downside.
            </div>
          )}
          {positionIsInLoss === null && (
            <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-xs text-indigo-200">
              Provide your position details and wait for live pricing to explore hedge scenarios.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
