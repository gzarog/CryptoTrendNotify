import type { HeatmapResult } from '../types/heatmap'
import type { SignalDirection, SignalStrength, TradingSignal } from '../types/signals'

const RSI_OVERSOLD = 35
const RSI_OVERBOUGHT = 65
const STOCH_LOW = 20
const STOCH_HIGH = 80

const MAX_SCORE = 100

export function deriveSignalsFromHeatmap(results: HeatmapResult[]): TradingSignal[] {
  return results
    .map((result) => mapHeatmapResultToSignal(result))
    .filter((signal): signal is TradingSignal => signal != null)
    .sort((a, b) => b.createdAt - a.createdAt)
}

function mapHeatmapResultToSignal(result: HeatmapResult): TradingSignal | null {
  if (result.signal === 'NONE') {
    return null
  }

  const side: SignalDirection = result.signal === 'LONG' ? 'Bullish' : 'Bearish'
  const createdAt = result.closedAt ?? result.evaluatedAt ?? Date.now()
  const reasons = buildReasons(result, side)
  const confluenceScore = scoreSignal(result, side, reasons)

  const strength = bucketSignal(confluenceScore)
  const suggestedSL =
    result.signal === 'LONG' ? result.risk.slLong ?? null : result.risk.slShort ?? null
  const suggestedTPBase =
    result.signal === 'LONG'
      ? result.risk.t2Long ?? result.risk.t1Long
      : result.risk.t2Short ?? result.risk.t1Short
  const suggestedTP = suggestedTPBase ?? null

  return {
    symbol: result.symbol,
    tf: result.entryTimeframe,
    timeframeLabel: result.entryLabel,
    side,
    reason: reasons,
    confluenceScore,
    strength,
    suggestedSL,
    suggestedTP,
    metadata: { heatmap: result },
    dedupeKey: `${result.symbol}|${result.entryTimeframe}|${side}`,
    createdAt,
    price: result.price ?? null,
    bias: result.bias,
  }
}

function buildReasons(result: HeatmapResult, side: SignalDirection): string[] {
  const reasons: string[] = []

  if (side === 'Bullish') {
    if (result.gating.long.timing && result.bias === 'BULL' && result.filters.maLongOk) {
      reasons.push('Trend & momentum aligned above MA200')
    }
    if (typeof result.rsiLtf.value === 'number' && result.rsiLtf.value <= RSI_OVERSOLD) {
      reasons.push('RSI oversold')
    }
    if (result.stochEvent === 'cross_up_from_oversold') {
      reasons.push('StochRSI K>D in lower band')
    }
  } else {
    if (result.gating.short.timing && result.bias === 'BEAR' && result.filters.maShortOk) {
      reasons.push('Trend & momentum aligned below MA200')
    }
    if (typeof result.rsiLtf.value === 'number' && result.rsiLtf.value >= RSI_OVERBOUGHT) {
      reasons.push('RSI overbought')
    }
    if (result.stochEvent === 'cross_down_from_overbought') {
      reasons.push('StochRSI K<D in upper band')
    }
  }

  if (result.filters.atrStatus === 'ok') {
    reasons.push('ATR filter satisfied')
  }

  if (reasons.length === 0) {
    reasons.push('Confluence threshold met')
  }

  return reasons
}

function scoreSignal(
  result: HeatmapResult,
  side: SignalDirection,
  reasons: string[],
): number {
  let score = 0

  for (const reason of reasons) {
    if (reason.includes('EMA10 crossed above EMA50') || reason.includes('EMA10 crossed below EMA50')) {
      score += 20
    }
    if (reason.includes('Golden Cross') || reason.includes('Death Cross')) {
      score += 25
    }
    if (reason.includes('RSI over')) {
      score += 10
    }
    if (reason.includes('StochRSI')) {
      score += 10
    }
    if (reason.includes('Trend & momentum aligned')) {
      score += 25
    }
    if (reason.includes('ATR filter satisfied')) {
      score += 5
    }
  }

  if (result.bias === 'BULL' && side === 'Bullish') {
    score += 10
  }
  if (result.bias === 'BEAR' && side === 'Bearish') {
    score += 10
  }

  const dist = result.filters.distPctToMa200
  if (typeof dist === 'number' && Number.isFinite(dist)) {
    if (dist < 0.5) {
      score += 8
    } else if (dist < 1) {
      score += 5
    }
  }

  const rsi = result.rsiLtf.value
  if (typeof rsi === 'number' && Number.isFinite(rsi)) {
    if (side === 'Bullish' && rsi > 50) {
      score += 8
    }
    if (side === 'Bearish' && rsi < 50) {
      score += 8
    }
  }

  const { k, d } = result.stochRsi
  if (
    typeof k === 'number' &&
    typeof d === 'number' &&
    Number.isFinite(k) &&
    Number.isFinite(d)
  ) {
    if (side === 'Bullish' && k > d) {
      score += 5
    }
    if (side === 'Bearish' && k < d) {
      score += 5
    }
    if (side === 'Bullish' && k <= STOCH_LOW && d <= STOCH_LOW) {
      score += 5
    }
    if (side === 'Bearish' && k >= STOCH_HIGH && d >= STOCH_HIGH) {
      score += 5
    }
  }

  const slope = result.ma200.slope
  if (typeof slope === 'number' && Number.isFinite(slope)) {
    if (side === 'Bullish' && slope > 0) {
      score += 5
    }
    if (side === 'Bearish' && slope < 0) {
      score += 5
    }
  }

  return clampScore(score)
}

function bucketSignal(score: number): SignalStrength {
  if (score >= 80) {
    return 'Strong'
  }
  if (score >= 60) {
    return 'Medium'
  }
  return 'Weak'
}

function clampScore(score: number): number {
  if (score < 0) {
    return 0
  }
  if (score > MAX_SCORE) {
    return MAX_SCORE
  }
  return Math.round(score)
}
