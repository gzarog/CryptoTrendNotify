import type { HeatmapResult } from '../types/heatmap'
import type {
  CombinedSignal,
  CombinedSignalBreakdown,
  CombinedSignalDirection,
  AggregateMultiTfMarkovResult,
  MarkovTimeframeEvaluation,
  MultiTimeframeSignal,
  MultiTimeframeSignalContribution,
  MultiTimeframeModelSummary,
  SignalDirection,
  SignalStage,
  SignalStrength,
  TrendMatrixRow,
  TimeframeSignalSnapshot,
  TradingSignal,
} from '../types/signals'

const RSI_OVERSOLD = 35
const RSI_OVERBOUGHT = 65
const STOCH_LOW = 20
const STOCH_HIGH = 80

const MAX_SCORE = 100

const TIMEFRAME_WEIGHTS: Record<string, number> = {
  '5': 0.5,
  '15': 0.7,
  '30': 1,
  '60': 1.3,
  '120': 1.5,
  '240': 2,
  '360': 2.5,
}

const DEFAULT_MULTI_TIMEFRAME_WEIGHT = 1
const MAX_SIGNAL_STRENGTH = 3
const TOTAL_TIMEFRAME_WEIGHT = Object.values(TIMEFRAME_WEIGHTS).reduce(
  (sum, weight) => sum + weight,
  0,
)

const ADX_STRONG_THRESHOLD = 25
const ADX_FORMING_LO = 20
const PRIOR_WEIGHT = 0.35
const ADX_STRONG_BOOST_BY_PRIOR = 5
const ADX_FORMING_RANGE_BOOST = 3
const RSI_BULL_MIN = 55
const RSI_BEAR_MAX = 45
const STOCH_BULL_MIN = 60
const STOCH_BEAR_MAX = 40

const ORDERED_TIMEFRAMES = Object.keys(TIMEFRAME_WEIGHTS)
  .map((value) => Number(value))
  .filter((value) => Number.isFinite(value))
  .sort((a, b) => a - b)
  .map((value) => String(value))

const SIGNAL_WEAK_THRESHOLD = 0.5
const SIGNAL_FORMING_THRESHOLD = 1.5
const SIGNAL_STRONG_THRESHOLD = 2.5
const PRIOR_SUPPORT_THRESHOLD = 0.25
const PRIOR_STRONG_OPPOSITION_THRESHOLD = 0.45

export function getCombinedSignal(result: HeatmapResult): CombinedSignal {
  const emaFast = toNumberOrNull(result.ema?.ema10)
  const emaSlow = toNumberOrNull(result.ema?.ema50)
  const maLong = toNumberOrNull(result.ma200.value)
  const macdRaw = result.macd as (typeof result.macd & Record<string, unknown>) | undefined
  const macdValue = toNumberOrNull(
    macdRaw?.value ??
      (macdRaw?.['macd'] as number | null | undefined) ??
      (macdRaw?.['macdLine'] as number | null | undefined),
  )
  const macdSignal = toNumberOrNull(
    macdRaw?.signal ?? (macdRaw?.['signalLine'] as number | null | undefined),
  )
  const macdHistogram = toNumberOrNull(
    macdRaw?.histogram ??
      (macdRaw?.['hist'] as number | null | undefined) ??
      (macdRaw?.['histLine'] as number | null | undefined),
  )
  const rsiValue = toNumberOrNull(result.rsiLtf.value)
  const stochKValue = toNumberOrNull(result.stochRsi.k)
  const adxValue = toNumberOrNull(result.adx?.value)
  const plusDI = toNumberOrNull(result.adx?.plusDI)
  const minusDI = toNumberOrNull(result.adx?.minusDI)
  const adxSlope = toNumberOrNull(result.adx?.slope)
  const markovPriorScoreRaw = toNumberOrNull(result.markov.priorScore)
  const markovPriorScore = Math.min(Math.max(markovPriorScoreRaw ?? 0, -1), 1)
  const markovState = result.markov.currentState ?? null

  const { bias, score: trendScoreRaw } = computeTrendBias(
    emaFast,
    emaSlow,
    maLong,
    macdValue,
    macdSignal,
    macdHistogram,
  )
  const trendScore = roundTo(trendScoreRaw, 2)
  const momentum = computeMomentum(bias, rsiValue, stochKValue)
  const trendStrength = computeTrendStrength(adxValue, markovPriorScore)
  const adxDirection = computeAdxDirection(bias, plusDI, minusDI)
  const adxIsRising = isAdxRising(adxSlope)

  const signalStrengthRaw = classifySignalStrength(
    bias,
    momentum,
    trendStrength,
    adxDirection,
    adxIsRising,
  )
  const baseScaled = Math.min(Math.max(signalStrengthRaw / MAX_SIGNAL_STRENGTH, -1), 1)
  const posteriorScaled =
    (1 - PRIOR_WEIGHT) * baseScaled + PRIOR_WEIGHT * markovPriorScore
  const signalStrength = Math.min(
    Math.max(posteriorScaled * MAX_SIGNAL_STRENGTH, -MAX_SIGNAL_STRENGTH),
    MAX_SIGNAL_STRENGTH,
  )
  const label = resolveSignalLabel(signalStrength)

  const direction: CombinedSignalDirection =
    signalStrength > 0 ? 'Bullish' : signalStrength < 0 ? 'Bearish' : 'Neutral'

  const strength = Math.round(
    Math.min(Math.max(Math.abs(signalStrength) / MAX_SIGNAL_STRENGTH, 0), 1) * 100,
  )

  return {
    direction,
    strength,
    breakdown: {
      bias,
      momentum,
      trendStrength,
      adxDirection,
      adxIsRising,
      adxValue,
      rsiValue,
      stochKValue,
      emaFast,
      emaSlow,
      maLong,
      macdValue,
      macdSignal,
      macdHistogram,
      trendScore,
      markov: {
        priorScore: markovPriorScore,
        currentState: markovState,
      },
      signalStrength,
      signalStrengthRaw,
      label,
    },
  }
}

function computeTrendBias(
  emaFast: number | null,
  emaSlow: number | null,
  maLong: number | null,
  macdValue: number | null,
  macdSignal: number | null,
  macdHistogram: number | null,
): { bias: CombinedSignalBreakdown['bias']; score: number } {
  const emaAlignment = resolveEmaAlignment(emaFast, emaSlow, maLong)
  const macdAlignment = resolveMacdAlignment(macdValue, macdSignal, macdHistogram)

  const blendedScore = clampRange(
    emaAlignment === 0
      ? 0.4 * emaAlignment + 0.6 * macdAlignment
      : 0.6 * emaAlignment + 0.4 * macdAlignment,
    -1,
    1,
  )

  if (blendedScore >= 0.2) {
    return { bias: 'Bullish', score: blendedScore }
  }

  if (blendedScore <= -0.2) {
    return { bias: 'Bearish', score: blendedScore }
  }

  return { bias: 'Neutral', score: blendedScore }
}

function resolveEmaAlignment(
  emaFast: number | null,
  emaSlow: number | null,
  maLong: number | null,
): number {
  if (
    emaFast != null &&
    emaSlow != null &&
    maLong != null &&
    emaFast > emaSlow &&
    emaSlow > maLong
  ) {
    return 1
  }

  if (
    emaFast != null &&
    emaSlow != null &&
    maLong != null &&
    emaFast < emaSlow &&
    emaSlow < maLong
  ) {
    return -1
  }

  return 0
}

function resolveMacdAlignment(
  macdValue: number | null,
  macdSignal: number | null,
  macdHistogram: number | null,
): number {
  if (macdValue == null || macdSignal == null || macdHistogram == null) {
    return 0
  }

  if (macdHistogram > 0 && macdValue > macdSignal && macdValue > 0) {
    return 1
  }

  if (macdHistogram < 0 && macdValue < macdSignal && macdValue < 0) {
    return -1
  }

  const histogramSign = valueSign(macdHistogram)
  if (histogramSign === 0) {
    return 0
  }

  return histogramSign * 0.25
}

function valueSign(value: number): number {
  if (value > 0) {
    return 1
  }

  if (value < 0) {
    return -1
  }

  return 0
}

function clampRange(value: number, min: number, max: number): number {
  if (value < min) {
    return min
  }

  if (value > max) {
    return max
  }

  return value
}

function computeMomentum(
  bias: CombinedSignalBreakdown['bias'],
  rsi: number | null,
  stochK: number | null,
): CombinedSignalBreakdown['momentum'] {
  if (rsi == null || stochK == null) {
    return 'Weak'
  }

  if (bias === 'Bullish' && rsi > RSI_BULL_MIN && stochK > STOCH_BULL_MIN) {
    return 'StrongBullish'
  }

  if (bias === 'Bearish' && rsi < RSI_BEAR_MAX && stochK < STOCH_BEAR_MAX) {
    return 'StrongBearish'
  }

  return 'Weak'
}

function computeTrendStrength(
  adxValue: number | null,
  markovPriorScore: number,
): CombinedSignalBreakdown['trendStrength'] {
  if (adxValue == null) {
    return 'Weak'
  }

  const positivePrior = Math.max(0, markovPriorScore)
  const strongThreshold = Math.max(10, ADX_STRONG_THRESHOLD - ADX_STRONG_BOOST_BY_PRIOR * positivePrior)
  const formingLo = Math.max(10, ADX_FORMING_LO - ADX_FORMING_RANGE_BOOST * positivePrior)

  if (adxValue >= strongThreshold) {
    return 'Strong'
  }

  if (adxValue >= formingLo && adxValue < strongThreshold) {
    return 'Forming'
  }

  return 'Weak'
}

function computeAdxDirection(
  bias: CombinedSignalBreakdown['bias'],
  plusDI: number | null,
  minusDI: number | null,
): CombinedSignalBreakdown['adxDirection'] {
  if (bias === 'Bullish' && plusDI != null && minusDI != null && plusDI > minusDI) {
    return 'ConfirmBull'
  }

  if (bias === 'Bearish' && plusDI != null && minusDI != null && minusDI > plusDI) {
    return 'ConfirmBear'
  }

  return 'NoConfirm'
}

function isAdxRising(adxSlope: number | null): boolean {
  if (adxSlope == null) {
    return false
  }
  return adxSlope > 0
}

function classifySignalStrength(
  bias: CombinedSignalBreakdown['bias'],
  momentum: CombinedSignalBreakdown['momentum'],
  trendStrength: CombinedSignalBreakdown['trendStrength'],
  adxDirection: CombinedSignalBreakdown['adxDirection'],
  adxIsRising: boolean,
): number {
  if (
    bias === 'Bullish' &&
    momentum === 'StrongBullish' &&
    trendStrength === 'Strong' &&
    adxDirection === 'ConfirmBull'
  ) {
    return 3
  }

  if (
    bias === 'Bearish' &&
    momentum === 'StrongBearish' &&
    trendStrength === 'Strong' &&
    adxDirection === 'ConfirmBear'
  ) {
    return -3
  }

  if (trendStrength === 'Forming' && adxIsRising) {
    if (momentum === 'StrongBullish' || bias === 'Bullish') {
      return 2
    }
    if (momentum === 'StrongBearish' || bias === 'Bearish') {
      return -2
    }
  }

  if (
    bias === 'Bullish' &&
    (momentum === 'StrongBullish' || adxDirection === 'ConfirmBull')
  ) {
    return 1
  }

  if (
    bias === 'Bearish' &&
    (momentum === 'StrongBearish' || adxDirection === 'ConfirmBear')
  ) {
    return -1
  }

  return 0
}

function resolveSignalLabel(score: number): CombinedSignalBreakdown['label'] {
  if (score >= 2.5) return 'STRONG_BUY'
  if (score >= 1.5) return 'BUY_FORMING'
  if (score >= 0.5) return 'BUY_WEAK'
  if (score > -0.5) return 'NEUTRAL'
  if (score > -1.5) return 'SELL_WEAK'
  if (score > -2.5) return 'SELL_FORMING'
  if (score <= -2.5) return 'STRONG_SELL'
  return 'NEUTRAL'
}

export function deriveSignalsFromHeatmap(results: HeatmapResult[]): TradingSignal[] {
  return results
    .map((result) => mapHeatmapResultToSignal(result))
    .filter((signal): signal is TradingSignal => signal != null)
    .sort((a, b) => b.createdAt - a.createdAt)
}

export function deriveTimeframeSnapshots(
  results: HeatmapResult[],
): TimeframeSignalSnapshot[] {
  return results.map((result) => mapHeatmapResultToSnapshot(result))
}

function resolveCombinedBias(
  score: number,
): { dir: CombinedSignalDirection; strength: 'Strong' | 'Medium' | 'Weak' | 'Sideways' } {
  if (score > 8) {
    return { dir: 'Bullish', strength: 'Strong' }
  }

  if (score > 4) {
    return { dir: 'Bullish', strength: 'Medium' }
  }

  if (score > 1) {
    return { dir: 'Bullish', strength: 'Weak' }
  }

  if (score < -8) {
    return { dir: 'Bearish', strength: 'Strong' }
  }

  if (score < -4) {
    return { dir: 'Bearish', strength: 'Medium' }
  }

  if (score < -1) {
    return { dir: 'Bearish', strength: 'Weak' }
  }

  return { dir: 'Neutral', strength: 'Sideways' }
}

export function getMultiTimeframeSignal(
  snapshots: TimeframeSignalSnapshot[],
): MultiTimeframeSignal | null {
  if (snapshots.length === 0) {
    return null
  }

  const contributions: MultiTimeframeSignalContribution[] = []

  let combinedScore = 0
  let totalWeight = 0

  snapshots.forEach((snapshot) => {
    const weight = resolveTimeframeWeight(snapshot.timeframe)
    if (weight <= 0) {
      return
    }

    const signal = snapshot.combined
    const score = signal.breakdown.signalStrength
    const weightedScore = score * weight

    contributions.push({
      timeframe: snapshot.timeframe,
      timeframeLabel: snapshot.timeframeLabel,
      weight,
      signal,
      score,
      weightedScore,
    })

    combinedScore += weightedScore
    totalWeight += weight
  })

  if (totalWeight === 0) {
    return {
      direction: 'Neutral',
      strength: 0,
      combinedScore: 0,
      normalizedScore: 0,
      combinedBias: { dir: 'Neutral', strength: 'Sideways' },
      contributions,
    }
  }

  const normalizedScoreRaw = combinedScore / totalWeight
  let normalizedScore = Math.round(normalizedScoreRaw * 10) / 10
  if (Object.is(normalizedScore, -0)) {
    normalizedScore = 0
  }

  const combinedBias = resolveCombinedBias(combinedScore)

  const strength = Math.round(
    Math.min(
      Math.max(Math.abs(combinedScore) / (MAX_SIGNAL_STRENGTH * TOTAL_TIMEFRAME_WEIGHT), 0),
      1,
    ) * 100,
  )

  const sortedContributions = contributions
    .slice()
    .sort((a, b) => {
      if (a.weight === b.weight) {
        return a.timeframe.localeCompare(b.timeframe)
      }
      return a.weight - b.weight
    })

  return {
    direction: combinedBias.dir,
    strength,
    combinedScore,
    normalizedScore,
    combinedBias,
    contributions: sortedContributions,
  }
}

function mapHeatmapResultToSnapshot(
  result: HeatmapResult,
): TimeframeSignalSnapshot {
  const price = toNumberOrNull(result.price)

  const combined = getCombinedSignal(result)

  const trend: TimeframeSignalSnapshot['trend'] = combined.breakdown.bias
  const momentumState = combined.breakdown.momentum
  const momentum: TimeframeSignalSnapshot['momentum'] =
    momentumState === 'StrongBullish'
      ? 'Bullish'
      : momentumState === 'StrongBearish'
      ? 'Bearish'
      : 'Neutral'

  let side: SignalDirection | null = null

  if (result.signal === 'LONG') {
    side = 'Bullish'
  } else if (result.signal === 'SHORT') {
    side = 'Bearish'
  } else if (trend === 'Bullish') {
    side = 'Bullish'
  } else if (trend === 'Bearish') {
    side = 'Bearish'
  }

  const reasons = side ? buildReasons(result, side) : []
  const confluenceScore = side ? scoreSignal(result, side, reasons) : null
  const strength = confluenceScore != null ? bucketSignal(confluenceScore) : null

  const stage = resolveSnapshotStage(result, side)

  return {
    timeframe: result.entryTimeframe,
    timeframeLabel: result.entryLabel,
    trend,
    momentum,
    stage,
    confluenceScore,
    strength,
    price: price,
    bias: result.bias,
    slopeMa200: toNumberOrNull(result.ma200.slope),
    side,
    combined,
  }
}

function resolveSnapshotStage(
  result: HeatmapResult,
  resolvedSide: SignalDirection | null,
): SignalStage {
  if (result.signal === 'LONG' || result.signal === 'SHORT') {
    return 'triggered'
  }

  if (!result.cooldown.ok) {
    return 'cooldown'
  }

  const longOpen = Boolean(result.gating.long.timing)
  const shortOpen = Boolean(result.gating.short.timing)

  if (!longOpen && !shortOpen) {
    return 'gated'
  }

  if (resolvedSide === 'Bullish' && !longOpen) {
    return 'gated'
  }

  if (resolvedSide === 'Bearish' && !shortOpen) {
    return 'gated'
  }

  if (result.bias === 'BULL' && !longOpen) {
    return 'gated'
  }

  if (result.bias === 'BEAR' && !shortOpen) {
    return 'gated'
  }

  return 'ready'
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

export function buildReasons(result: HeatmapResult, side: SignalDirection): string[] {
  const reasons: string[] = []

  const crossReasons = collectMovingAverageCrossReasons(result, side)
  for (const reason of crossReasons) {
    if (!reasons.includes(reason)) {
      reasons.push(reason)
    }
  }

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

function collectMovingAverageCrossReasons(
  result: HeatmapResult,
  side: SignalDirection,
): string[] {
  const crosses = Array.isArray(result.movingAverageCrosses)
    ? result.movingAverageCrosses
    : []

  if (crosses.length === 0) {
    return []
  }

  const crossReasons = new Set<string>()

  for (const cross of crosses) {
    if (!cross) {
      continue
    }

    const normalizedDirection = normalizeCrossDirection(cross.direction)

    if (!normalizedDirection) {
      continue
    }

    if (cross.pair === 'ema10-ema50') {
      if (side === 'Bullish' && isBullishCrossDirection(normalizedDirection)) {
        crossReasons.add('EMA10 crossed above EMA50')
      }
      if (side === 'Bearish' && isBearishCrossDirection(normalizedDirection)) {
        crossReasons.add('EMA10 crossed below EMA50')
      }
    }

    if (cross.pair === 'ema50-ma200') {
      if (side === 'Bullish' && isBullishCrossDirection(normalizedDirection)) {
        crossReasons.add('Golden Cross')
      }
      if (side === 'Bearish' && isBearishCrossDirection(normalizedDirection)) {
        crossReasons.add('Death Cross')
      }
    }
  }

  return Array.from(crossReasons)
}

function normalizeCrossDirection(direction: unknown): string | null {
  if (typeof direction !== 'string') {
    return null
  }

  const trimmed = direction.trim().toLowerCase()
  return trimmed.length > 0 ? trimmed : null
}

function isBullishCrossDirection(direction: string): boolean {
  return BULLISH_CROSS_DIRECTIONS.has(direction)
}

function isBearishCrossDirection(direction: string): boolean {
  return BEARISH_CROSS_DIRECTIONS.has(direction)
}

const BULLISH_CROSS_DIRECTIONS = new Set([
  'golden',
  'bullish',
  'cross_up',
  'up',
  'above',
  'long',
])

const BEARISH_CROSS_DIRECTIONS = new Set([
  'death',
  'bearish',
  'cross_down',
  'down',
  'below',
  'short',
])

export function scoreSignal(
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

function toNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
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

function resolveTimeframeWeight(timeframe: string): number {
  const direct = TIMEFRAME_WEIGHTS[timeframe]
  if (typeof direct === 'number' && Number.isFinite(direct)) {
    return direct
  }

  const numeric = Number(timeframe)
  if (Number.isFinite(numeric) && numeric > 0) {
    return TIMEFRAME_WEIGHTS[String(numeric)] ?? DEFAULT_MULTI_TIMEFRAME_WEIGHT
  }

  return DEFAULT_MULTI_TIMEFRAME_WEIGHT
}

function roundNullable(value: number | null | undefined, decimals: number): number | null {
  if (value == null || !Number.isFinite(value)) {
    return null
  }

  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function parseTimeframeToMinutes(value: string): number {
  const numeric = Number(value)
  if (Number.isFinite(numeric)) {
    return numeric
  }

  const trimmed = value.trim().toUpperCase()
  const suffixMatch = trimmed.match(/^(\d+)([SMHDW])$/)
  if (suffixMatch) {
    const [, amountRaw, unit] = suffixMatch
    const amount = Number(amountRaw)
    if (!Number.isFinite(amount)) {
      return Number.POSITIVE_INFINITY
    }

    const multiplier =
      unit === 'S'
        ? 1 / 60
        : unit === 'M'
        ? 1
        : unit === 'H'
        ? 60
        : unit === 'D'
        ? 60 * 24
        : unit === 'W'
        ? 60 * 24 * 7
        : null

    if (multiplier != null) {
      return amount * multiplier
    }
  }

  return Number.POSITIVE_INFINITY
}

function orderTimeframes(
  evaluations: Record<string, MarkovTimeframeEvaluation>,
): string[] {
  const known = ORDERED_TIMEFRAMES.filter((timeframe) => evaluations[timeframe])
  const extras = Object.keys(evaluations)
    .filter((timeframe) => !known.includes(timeframe))
    .sort((a, b) => parseTimeframeToMinutes(a) - parseTimeframeToMinutes(b))

  return [...known, ...extras]
}

export function evaluateSnapshotWithMarkov(
  snapshot: TimeframeSignalSnapshot,
): MarkovTimeframeEvaluation {
  const breakdown = snapshot.combined.breakdown

  return {
    timeframe: snapshot.timeframe,
    timeframeLabel: snapshot.timeframeLabel,
    ...breakdown,
    markov: { ...breakdown.markov },
  }
}

export function buildTrendMatrixMarkov(
  evaluations: Record<string, MarkovTimeframeEvaluation>,
): TrendMatrixRow[] {
  const ordered = orderTimeframes(evaluations)

  return ordered.map((timeframe) => {
    const evaluation = evaluations[timeframe]
    const priorScore = roundNullable(evaluation?.markov?.priorScore ?? null, 2)

    return {
      timeframe,
      timeframeLabel: evaluation?.timeframeLabel ?? timeframe,
      bias: evaluation?.bias ?? 'Neutral',
      rsi: roundNullable(evaluation?.rsiValue ?? null, 1),
      stochK: roundNullable(evaluation?.stochKValue ?? null, 1),
      adx: roundNullable(evaluation?.adxValue ?? null, 1),
      trend: evaluation?.trendStrength ?? 'Weak',
      adxDirection: evaluation?.adxDirection ?? 'NoConfirm',
      prior: priorScore,
      label: evaluation?.label ?? 'NEUTRAL',
      scoreRaw: evaluation ? roundTo(evaluation.signalStrengthRaw, 2) : 0,
      score: evaluation ? roundTo(evaluation.signalStrength, 2) : 0,
    }
  })
}

export function aggregateMultiTfMarkov(
  evaluations: Record<string, MarkovTimeframeEvaluation>,
): AggregateMultiTfMarkovResult {
  let combinedScore = 0

  for (const timeframe of orderTimeframes(evaluations)) {
    const evaluation = evaluations[timeframe]
    if (!evaluation) {
      continue
    }

    const weight = resolveTimeframeWeight(timeframe)
    if (weight <= 0) {
      continue
    }

    combinedScore += evaluation.signalStrength * weight
  }

  const combinedBias = resolveCombinedBias(combinedScore)

  return { combinedScore, combinedBias }
}

export function qualifiesForTradeMarkov(evaluation: MarkovTimeframeEvaluation): boolean {
  if (!evaluation) {
    return false
  }

  const posterior = evaluation.signalStrength
  if (posterior == null || !Number.isFinite(posterior) || posterior === 0) {
    return false
  }

  const magnitude = Math.abs(posterior)
  const priorScore = evaluation.markov?.priorScore ?? 0
  const priorMagnitude = Math.abs(priorScore)
  const aligned = priorScore !== 0 && Math.sign(priorScore) === Math.sign(posterior)

  if (magnitude >= SIGNAL_STRONG_THRESHOLD) {
    if (!aligned && priorMagnitude >= PRIOR_STRONG_OPPOSITION_THRESHOLD) {
      return false
    }
    return true
  }

  if (magnitude >= SIGNAL_FORMING_THRESHOLD) {
    if (!aligned && priorMagnitude >= PRIOR_SUPPORT_THRESHOLD) {
      return false
    }
    return true
  }

  if (magnitude >= SIGNAL_WEAK_THRESHOLD) {
    return aligned && priorMagnitude >= PRIOR_SUPPORT_THRESHOLD
  }

  return false
}

export function hasNConsecutiveTimeframes(
  timeframes: string[],
  n: number,
  evaluations?: Record<string, MarkovTimeframeEvaluation>,
): boolean {
  if (n <= 1) {
    return timeframes.length > 0
  }

  if (timeframes.length === 0) {
    return false
  }

  const ordered = evaluations ? orderTimeframes(evaluations) : ORDERED_TIMEFRAMES
  const qualified = new Set(timeframes)
  let streak = 0

  for (const timeframe of ordered) {
    if (qualified.has(timeframe)) {
      streak += 1
      if (streak >= n) {
        return true
      }
    } else {
      streak = 0
    }
  }

  return false
}

export function runMultiTfModel(
  snapshots: TimeframeSignalSnapshot[],
): MultiTimeframeModelSummary {
  const evaluations: Record<string, MarkovTimeframeEvaluation> = {}

  for (const snapshot of snapshots) {
    evaluations[snapshot.timeframe] = evaluateSnapshotWithMarkov(snapshot)
  }

  const ordered = orderTimeframes(evaluations)
  const trendMatrix = buildTrendMatrixMarkov(evaluations)
  const combined = aggregateMultiTfMarkov(evaluations)
  const qualifiedTimeframes = ordered.filter((timeframe) => {
    const evaluation = evaluations[timeframe]
    return evaluation ? qualifiesForTradeMarkov(evaluation) : false
  })
  const emitTradeSignal = hasNConsecutiveTimeframes(qualifiedTimeframes, 3, evaluations)

  return {
    perTimeframe: evaluations,
    trendMatrix,
    combined,
    qualifiedTimeframes,
    emitTradeSignal,
  }
}
