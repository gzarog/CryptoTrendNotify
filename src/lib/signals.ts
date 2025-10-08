import type { HeatmapResult } from '../types/heatmap'
import type {
  CombinedSignal,
  CombinedSignalDirection,
  MultiTimeframeSignal,
  MultiTimeframeSignalContribution,
  SignalDirection,
  SignalStage,
  SignalStrength,
  TimeframeSignalSnapshot,
  TradingSignal,
} from '../types/signals'

const RSI_OVERSOLD = 35
const RSI_OVERBOUGHT = 65
const STOCH_LOW = 20
const STOCH_HIGH = 80

const MAX_SCORE = 100

const MULTI_TIMEFRAME_WEIGHTS: Record<string, number> = {
  '5': 1,
  '15': 1.5,
  '30': 2,
  '60': 3,
  '120': 4,
  '240': 5,
  '360': 6,
  '420': 7,
}

const DEFAULT_MULTI_TIMEFRAME_WEIGHT = 1

type MacdSnapshot = {
  hist: number | null | undefined
  line: number | null | undefined
  signal: number | null | undefined
}

export function getCombinedSignal(
  _ohlcv: unknown,
  ema10: number | null | undefined,
  ema50: number | null | undefined,
  ma200: number | null | undefined,
  rsi: number | null | undefined,
  stochRsi: number | null | undefined,
  macd: MacdSnapshot | null | undefined,
): CombinedSignal {
  let trendBias = 0
  let momentumBias = 0
  let confirmation = 0

  const ema10Value = toNumberOrNull(ema10)
  const ema50Value = toNumberOrNull(ema50)
  const ma200Value = toNumberOrNull(ma200)

  if (ema10Value != null && ema50Value != null) {
    if (ma200Value != null && ema10Value > ema50Value && ema50Value > ma200Value) {
      trendBias += 2
    } else if (ema10Value > ema50Value) {
      trendBias += 1
    } else if (ma200Value != null && ema10Value < ema50Value && ema50Value < ma200Value) {
      trendBias -= 2
    } else if (ema10Value < ema50Value) {
      trendBias -= 1
    }
  }

  const rsiValue = toNumberOrNull(rsi)
  const stochRsiValue = toNumberOrNull(stochRsi)

  if (rsiValue != null && stochRsiValue != null) {
    if (rsiValue > 60 && stochRsiValue > 0.7) {
      momentumBias += 1
    } else if (rsiValue < 40 && stochRsiValue < 0.3) {
      momentumBias -= 1
    }
  }

  const macdHist = toNumberOrNull(macd?.hist)
  const macdLine = toNumberOrNull(macd?.line)
  const macdSignal = toNumberOrNull(macd?.signal)

  if (macdHist != null && macdLine != null && macdSignal != null) {
    if (macdHist > 0 && macdLine > macdSignal) {
      confirmation += 1
    } else if (macdHist < 0 && macdLine < macdSignal) {
      confirmation -= 1
    }
  }

  const combinedScore = trendBias + momentumBias + confirmation
  const strength = Math.min(Math.abs(combinedScore) * 25, 100)

  let direction: CombinedSignalDirection = 'Neutral'
  if (combinedScore > 0) {
    direction = 'Bullish'
  } else if (combinedScore < 0) {
    direction = 'Bearish'
  }

  return {
    direction,
    strength,
    breakdown: {
      trendBias,
      momentumBias,
      confirmation,
      combinedScore,
    },
  }
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

export function getMultiTimeframeSignal(
  snapshots: TimeframeSignalSnapshot[],
): MultiTimeframeSignal | null {
  if (snapshots.length === 0) {
    return null
  }

  const contributions: MultiTimeframeSignalContribution[] = []

  let weightedScore = 0
  let totalWeight = 0

  snapshots.forEach((snapshot) => {
    const weight = resolveTimeframeWeight(snapshot.timeframe)
    if (weight <= 0) {
      return
    }

    const signal = snapshot.combined
    const directionSign = signal.direction === 'Bullish' ? 1 : signal.direction === 'Bearish' ? -1 : 0
    const bias = directionSign * signal.strength

    contributions.push({
      timeframe: snapshot.timeframe,
      timeframeLabel: snapshot.timeframeLabel,
      weight,
      signal,
      bias,
    })

    weightedScore += bias * weight
    totalWeight += weight
  })

  if (totalWeight === 0) {
    return {
      direction: 'Neutral',
      bias: 0,
      strength: 0,
      contributions,
    }
  }

  const rawBias = weightedScore / totalWeight
  let normalizedBias = Math.round(rawBias * 10) / 10
  if (Object.is(normalizedBias, -0)) {
    normalizedBias = 0
  }

  let globalDirection: CombinedSignalDirection = 'Neutral'
  if (normalizedBias > 0) {
    globalDirection = 'Bullish'
  } else if (normalizedBias < 0) {
    globalDirection = 'Bearish'
  }

  const strength = Math.min(Math.max(Math.abs(normalizedBias), 0), 100)

  const sortedContributions = contributions
    .slice()
    .sort((a, b) => {
      if (a.weight === b.weight) {
        return a.timeframe.localeCompare(b.timeframe)
      }
      return a.weight - b.weight
    })

  return {
    direction: globalDirection,
    bias: normalizedBias,
    strength,
    contributions: sortedContributions,
  }
}

function mapHeatmapResultToSnapshot(
  result: HeatmapResult,
): TimeframeSignalSnapshot {
  const ema10 = toNumberOrNull(result.ema?.ema10)
  const ema50 = toNumberOrNull(result.ema?.ema50)
  const ma200 = toNumberOrNull(result.ma200.value)
  const price = toNumberOrNull(result.price)

  let trend: TimeframeSignalSnapshot['trend'] = 'Neutral'

  if (ema10 != null && ema50 != null && price != null && ma200 != null) {
    if (ema10 > ema50 && price > ma200) {
      trend = 'Bullish'
    } else if (ema10 < ema50 && price < ma200) {
      trend = 'Bearish'
    }
  }

  const rsi = toNumberOrNull(result.rsiLtf.value)
  const stochK = toNumberOrNull(result.stochRsi.k)
  const stochD = toNumberOrNull(result.stochRsi.d)

  const normalizedStochRsi = resolveNormalizedStochRsi(result)

  let momentum: TimeframeSignalSnapshot['momentum'] = 'Neutral'

  if (rsi != null && stochK != null && stochD != null) {
    if (rsi > 50 && stochK > stochD) {
      momentum = 'Bullish'
    } else if (rsi < 50 && stochK < stochD) {
      momentum = 'Bearish'
    }
  }

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
  const combined = getCombinedSignal(
    null,
    result.ema?.ema10,
    result.ema?.ema50,
    result.ma200.value,
    result.rsiLtf.value,
    normalizedStochRsi,
    null,
  )

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

function resolveNormalizedStochRsi(result: HeatmapResult): number | null {
  const rawNormalized = toNumberOrNull(result.stochRsi.rawNormalized)
  if (rawNormalized != null) {
    if (rawNormalized >= 0 && rawNormalized <= 1) {
      return rawNormalized
    }
    if (rawNormalized >= 0 && rawNormalized <= 100) {
      return clamp01(rawNormalized / 100)
    }
  }

  const kValue = toNumberOrNull(result.stochRsi.k)
  if (kValue != null) {
    return clamp01(kValue / 100)
  }

  const dValue = toNumberOrNull(result.stochRsi.d)
  if (dValue != null) {
    return clamp01(dValue / 100)
  }

  return null
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

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0
  }
  if (value < 0) {
    return 0
  }
  if (value > 1) {
    return 1
  }
  return value
}

function resolveTimeframeWeight(timeframe: string): number {
  const direct = MULTI_TIMEFRAME_WEIGHTS[timeframe]
  if (typeof direct === 'number' && Number.isFinite(direct)) {
    return direct
  }

  const numeric = Number(timeframe)
  if (Number.isFinite(numeric) && numeric > 0) {
    return MULTI_TIMEFRAME_WEIGHTS[String(numeric)] ?? DEFAULT_MULTI_TIMEFRAME_WEIGHT
  }

  return DEFAULT_MULTI_TIMEFRAME_WEIGHT
}
