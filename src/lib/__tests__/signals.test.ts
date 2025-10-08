import { describe, expect, it } from 'vitest'

import {
  buildReasons,
  buildTrendMatrixMarkov,
  getCombinedSignal,
  getMultiTimeframeSignal,
  hasNConsecutiveTimeframes,
  runMultiTfModel,
  scoreSignal,
  aggregateMultiTfMarkov,
  evaluateSnapshotWithMarkov,
  qualifiesForTradeMarkov,
} from '../signals'
import type { HeatmapResult } from '../../types/heatmap'
import type {
  CombinedSignal,
  CombinedSignalBreakdown,
  MarkovTimeframeEvaluation,
  TimeframeSignalSnapshot,
} from '../../types/signals'

function createBaseHeatmapResult(overrides: Partial<HeatmapResult> = {}): HeatmapResult {
  const base: HeatmapResult = {
    entryTimeframe: '15',
    entryLabel: '15m',
    symbol: 'TEST',
    evaluatedAt: null,
    closedAt: null,
    bias: 'NEUTRAL',
    strength: 'standard',
    signal: 'NONE',
    stochEvent: null,
    ema: {
      ema10: null,
      ema50: null,
    },
    movingAverageCrosses: [],
    votes: {
      bull: 0,
      bear: 0,
      total: 0,
      mode: 'all',
      breakdown: [],
    },
    adx: {
      value: null,
      plusDI: null,
      minusDI: null,
      slope: null,
    },
    stochRsi: {
      k: null,
      d: null,
      rawNormalized: null,
    },
    macd: {
      value: null,
      signal: null,
      histogram: null,
    },
    rsiLtf: {
      value: null,
      sma5: null,
      okLong: false,
      okShort: false,
    },
    filters: {
      atrPct: null,
      atrBounds: { min: 0, max: 0 },
      atrStatus: 'too-low',
      maSide: 'unknown',
      maLongOk: false,
      maShortOk: false,
      distPctToMa200: null,
      maDistanceStatus: 'missing',
      useMa200Filter: false,
    },
    gating: {
      long: { timing: false, blockers: [] },
      short: { timing: false, blockers: [] },
    },
    cooldown: {
      requiredBars: 0,
      barsSinceSignal: null,
      ok: true,
      lastAlertSide: null,
      lastExtremeMarker: null,
    },
    risk: {
      atr: null,
      slLong: null,
      t1Long: null,
      t2Long: null,
      slShort: null,
      t1Short: null,
      t2Short: null,
    },
    price: null,
    ma200: {
      value: null,
      slope: null,
    },
    markov: {
      priorScore: 0,
      currentState: null,
      transitionMatrix: null,
    },
  }

  return {
    ...base,
    ...overrides,
    ema: { ...base.ema, ...(overrides.ema ?? {}) },
    votes: { ...base.votes, ...(overrides.votes ?? {}) },
    stochRsi: { ...base.stochRsi, ...(overrides.stochRsi ?? {}) },
    macd: { ...base.macd, ...(overrides.macd ?? {}) },
    rsiLtf: { ...base.rsiLtf, ...(overrides.rsiLtf ?? {}) },
    filters: { ...base.filters, ...(overrides.filters ?? {}) },
    gating: {
      long: { ...base.gating.long, ...(overrides.gating?.long ?? {}) },
      short: { ...base.gating.short, ...(overrides.gating?.short ?? {}) },
    },
    cooldown: { ...base.cooldown, ...(overrides.cooldown ?? {}) },
    risk: { ...base.risk, ...(overrides.risk ?? {}) },
    ma200: { ...base.ma200, ...(overrides.ma200 ?? {}) },
    movingAverageCrosses:
      overrides.movingAverageCrosses ?? base.movingAverageCrosses,
    adx: { ...base.adx, ...(overrides.adx ?? {}) },
    markov: { ...base.markov, ...(overrides.markov ?? {}) },
  }
}

function createSnapshot(
  combined: CombinedSignal,
  overrides: Partial<TimeframeSignalSnapshot> &
    Pick<TimeframeSignalSnapshot, 'timeframe' | 'timeframeLabel'>,
): TimeframeSignalSnapshot {
  return {
    timeframe: overrides.timeframe,
    timeframeLabel: overrides.timeframeLabel,
    trend: 'Neutral',
    momentum: 'Neutral',
    stage: 'ready',
    confluenceScore: null,
    strength: null,
    price: null,
    bias: 'NEUTRAL',
    slopeMa200: null,
    side: null,
    combined,
    ...overrides,
  }
}

function createBreakdown(
  overrides: Partial<CombinedSignalBreakdown> = {},
): CombinedSignalBreakdown {
  const base: CombinedSignalBreakdown = {
    bias: 'Bullish',
    momentum: 'StrongBullish',
    trendStrength: 'Strong',
    adxDirection: 'ConfirmBull',
    adxIsRising: true,
    adxValue: 30,
    rsiValue: 60,
    stochKValue: 70,
    emaFast: 110,
    emaSlow: 105,
    maLong: 100,
    macdValue: 2,
    macdSignal: 1.5,
    macdHistogram: 0.5,
    trendScore: 0.6,
    trendComponents: {
      emaAlignment: 1,
      macdAlignment: 1,
    },
    markov: { priorScore: 0.6, currentState: 'B' },
    signalStrength: 2.6,
    signalStrengthRaw: 2.6,
    label: 'STRONG_BUY',
  }

  return {
    ...base,
    ...overrides,
    markov: { ...base.markov, ...(overrides.markov ?? {}) },
    trendComponents: {
      ...base.trendComponents,
      ...(overrides.trendComponents ?? {}),
    },
  }
}

function createCombinedSignalFromBreakdown(
  breakdown: CombinedSignalBreakdown,
  directionOverride?: CombinedSignal['direction'],
): CombinedSignal {
  const direction: CombinedSignal['direction'] =
    directionOverride ?? (breakdown.signalStrength >= 0 ? 'Bullish' : 'Bearish')
  const strength = Math.round(
    Math.min(Math.max(Math.abs(breakdown.signalStrength) / 3, 0), 1) * 100,
  )

  return {
    direction,
    strength,
    breakdown,
  }
}

function createEvaluation(
  timeframe: string,
  timeframeLabel: string,
  breakdownOverrides: Partial<CombinedSignalBreakdown> = {},
): { snapshot: TimeframeSignalSnapshot; evaluation: MarkovTimeframeEvaluation } {
  const breakdown = createBreakdown(breakdownOverrides)
  const combined = createCombinedSignalFromBreakdown(breakdown)
  const snapshot = createSnapshot(combined, {
    timeframe,
    timeframeLabel,
    trend: breakdown.signalStrength >= 0 ? 'Bullish' : 'Bearish',
    momentum: breakdown.signalStrength >= 0 ? 'Bullish' : 'Bearish',
    bias: breakdown.signalStrength >= 0 ? 'BULL' : 'BEAR',
    side: breakdown.signalStrength >= 0 ? 'Bullish' : 'Bearish',
  })

  return {
    snapshot,
    evaluation: evaluateSnapshotWithMarkov(snapshot),
  }
}

describe('getCombinedSignal', () => {
  it('classifies a fully aligned bullish trend as a strong buy', () => {
    const result = createBaseHeatmapResult({
      bias: 'BULL',
      ema: { ema10: 105, ema50: 100 },
      ma200: { value: 95, slope: 0.4 },
      rsiLtf: { value: 62, sma5: null, okLong: true, okShort: false },
      stochRsi: { k: 72, d: 65, rawNormalized: null },
      adx: { value: 32, plusDI: 35, minusDI: 18, slope: 0.8 },
    })

    const combined = getCombinedSignal(result)

    expect(combined.direction).toBe('Bullish')
    expect(combined.strength).toBe(100)
    expect(combined.breakdown).toMatchObject({
      bias: 'Bullish',
      momentum: 'StrongBullish',
      trendStrength: 'Strong',
      adxDirection: 'ConfirmBull',
      adxIsRising: true,
      adxValue: 32,
      rsiValue: 62,
      stochKValue: 72,
      signalStrength: 3,
      signalStrengthRaw: 3,
      markov: { priorScore: 0, currentState: null },
      label: 'STRONG_BUY',
    })
  })

  it('classifies a fully aligned bearish trend as a strong sell', () => {
    const result = createBaseHeatmapResult({
      bias: 'BEAR',
      ema: { ema10: 90, ema50: 95 },
      ma200: { value: 102, slope: -0.5 },
      rsiLtf: { value: 40, sma5: null, okLong: false, okShort: true },
      stochRsi: { k: 25, d: 35, rawNormalized: null },
      adx: { value: 29, plusDI: 18, minusDI: 34, slope: -0.6 },
    })

    const combined = getCombinedSignal(result)

    expect(combined.direction).toBe('Bearish')
    expect(combined.strength).toBe(100)
    expect(combined.breakdown).toMatchObject({
      bias: 'Bearish',
      momentum: 'StrongBearish',
      trendStrength: 'Strong',
      adxDirection: 'ConfirmBear',
      adxIsRising: false,
      adxValue: 29,
      rsiValue: 40,
      stochKValue: 25,
      signalStrength: -3,
      signalStrengthRaw: -3,
      markov: { priorScore: 0, currentState: null },
      label: 'STRONG_SELL',
    })
  })

  it('recognises forming bullish trends with rising ADX as buy-forming', () => {
    const result = createBaseHeatmapResult({
      bias: 'BULL',
      ema: { ema10: 104, ema50: 99 },
      ma200: { value: 94, slope: 0.2 },
      rsiLtf: { value: 61, sma5: null, okLong: true, okShort: false },
      stochRsi: { k: 68, d: 55, rawNormalized: null },
      adx: { value: 22, plusDI: 30, minusDI: 20, slope: 0.5 },
    })

    const combined = getCombinedSignal(result)

    expect(combined.direction).toBe('Bullish')
    expect(combined.strength).toBe(67)
    expect(combined.breakdown).toMatchObject({
      trendStrength: 'Forming',
      adxIsRising: true,
      signalStrength: 2,
      signalStrengthRaw: 2,
      markov: { priorScore: 0, currentState: null },
      label: 'BUY_FORMING',
    })
  })

  it('falls back to neutral when directional evidence is missing', () => {
    const combined = getCombinedSignal(createBaseHeatmapResult())

    expect(combined.direction).toBe('Neutral')
    expect(combined.strength).toBe(0)
    expect(combined.breakdown).toMatchObject({
      bias: 'Neutral',
      momentum: 'Weak',
      trendStrength: 'Weak',
      adxDirection: 'NoConfirm',
      adxIsRising: false,
      signalStrength: 0,
      signalStrengthRaw: 0,
      markov: { priorScore: 0, currentState: null },
      label: 'NEUTRAL',
    })
  })

  it('leans bullish when MACD alignment is positive even if EMAs are flat', () => {
    const combined = getCombinedSignal(
      createBaseHeatmapResult({
        ema: { ema10: 100, ema50: 100 },
        ma200: { value: 100, slope: 0 },
        macd: { value: 1.2, signal: 0.8, histogram: 0.4 },
        rsiLtf: { value: 58, sma5: null, okLong: true, okShort: false },
        stochRsi: { k: 62, d: 55, rawNormalized: null },
        adx: { value: 18, plusDI: 24, minusDI: 21, slope: 0.2 },
      }),
    )

    expect(combined.breakdown.bias).toBe('Bullish')
    expect(combined.breakdown.trendScore).toBeGreaterThan(0)
    expect(combined.breakdown.trendComponents.emaAlignment).toBe(0)
    expect(combined.breakdown.trendComponents.macdAlignment).toBeGreaterThan(0)
  })

  it('leans bearish when MACD alignment is negative even if EMAs are flat', () => {
    const combined = getCombinedSignal(
      createBaseHeatmapResult({
        ema: { ema10: 100, ema50: 100 },
        ma200: { value: 100, slope: 0 },
        macd: { value: -1.3, signal: -0.9, histogram: -0.5 },
        rsiLtf: { value: 42, sma5: null, okLong: false, okShort: true },
        stochRsi: { k: 38, d: 45, rawNormalized: null },
        adx: { value: 19, plusDI: 18, minusDI: 26, slope: -0.2 },
      }),
    )

    expect(combined.breakdown.bias).toBe('Bearish')
    expect(combined.breakdown.trendScore).toBeLessThan(0)
    expect(combined.breakdown.trendComponents.emaAlignment).toBe(0)
    expect(combined.breakdown.trendComponents.macdAlignment).toBeLessThan(0)
  })
})

describe('getMultiTimeframeSignal', () => {
  it('aggregates weighted scores across unordered timeframe snapshots', () => {
    const strongBullishCombined = getCombinedSignal(
      createBaseHeatmapResult({
        entryTimeframe: '15',
        entryLabel: '15m',
        bias: 'BULL',
        ema: { ema10: 110, ema50: 105 },
        ma200: { value: 100, slope: 0.6 },
        rsiLtf: { value: 65, sma5: null, okLong: true, okShort: false },
        stochRsi: { k: 75, d: 60, rawNormalized: null },
        adx: { value: 31, plusDI: 36, minusDI: 15, slope: 0.9 },
      }),
    )

    const weakBullishCombined = getCombinedSignal(
      createBaseHeatmapResult({
        entryTimeframe: '5',
        entryLabel: '5m',
        bias: 'BULL',
        ema: { ema10: 108, ema50: 103 },
        ma200: { value: 100, slope: 0.3 },
        rsiLtf: { value: 58, sma5: null, okLong: true, okShort: false },
        stochRsi: { k: 65, d: 55, rawNormalized: null },
        adx: { value: 18, plusDI: 24, minusDI: 16, slope: -0.2 },
      }),
    )

    const strongBearishCombined = getCombinedSignal(
      createBaseHeatmapResult({
        entryTimeframe: '60',
        entryLabel: '1h',
        bias: 'BEAR',
        ema: { ema10: 92, ema50: 96 },
        ma200: { value: 104, slope: -0.7 },
        rsiLtf: { value: 39, sma5: null, okLong: false, okShort: true },
        stochRsi: { k: 30, d: 42, rawNormalized: null },
        adx: { value: 34, plusDI: 20, minusDI: 40, slope: -0.3 },
      }),
    )

    const snapshots: TimeframeSignalSnapshot[] = [
      createSnapshot(strongBearishCombined, {
        timeframe: '60',
        timeframeLabel: '1h',
        trend: 'Bearish',
        momentum: 'Bearish',
        bias: 'BEAR',
        side: 'Bearish',
      }),
      createSnapshot(weakBullishCombined, {
        timeframe: '5',
        timeframeLabel: '5m',
        trend: 'Bullish',
        momentum: 'Bullish',
        bias: 'BULL',
        side: 'Bullish',
      }),
      createSnapshot(strongBullishCombined, {
        timeframe: '15',
        timeframeLabel: '15m',
        trend: 'Bullish',
        momentum: 'Bullish',
        bias: 'BULL',
        side: 'Bullish',
      }),
    ]

    const multi = getMultiTimeframeSignal(snapshots)

    expect(multi).not.toBeNull()
    expect(multi?.direction).toBe('Bearish')
    expect(multi?.combinedScore).toBeCloseTo(-1.3, 5)
    expect(multi?.normalizedScore).toBe(-0.5)
    expect(multi?.strength).toBe(5)
    expect(multi?.combinedBias).toEqual({ dir: 'Bearish', strength: 'Weak' })

    expect(multi?.contributions.map((c) => c.timeframe)).toEqual(['5', '15', '60'])

    expect(multi?.contributions[0]?.weightedScore).toBeCloseTo(0.5, 5)
    expect(multi?.contributions[1]?.weightedScore).toBeCloseTo(2.1, 5)
    expect(multi?.contributions[2]?.weightedScore).toBeCloseTo(-3.9, 5)
  })
})

describe('Markov multi timeframe model utilities', () => {
  it('extracts Markov-aware evaluations from snapshots', () => {
    const { snapshot, evaluation } = createEvaluation('5', '5m', {
      rsiValue: 55.6,
      stochKValue: 62.3,
      adxValue: 22.8,
      signalStrength: 1.23,
      signalStrengthRaw: 1.23,
      markov: { priorScore: 0.34, currentState: 'R' },
    })

    expect(snapshot.timeframe).toBe('5')
    expect(evaluation.timeframe).toBe('5')
    expect(evaluation.timeframeLabel).toBe('5m')
    expect(evaluation.signalStrength).toBeCloseTo(1.23, 5)
    expect(evaluation.markov.priorScore).toBeCloseTo(0.34, 5)
  })

  it('builds a rounded trend matrix ordered by timeframe', () => {
    const evalA = createEvaluation('5', '5m', {
      rsiValue: 55.64,
      stochKValue: 62.33,
      adxValue: 23.84,
      signalStrength: 1.276,
      signalStrengthRaw: 1.21,
      markov: { priorScore: 0.338, currentState: 'R' },
    }).evaluation
    const evalB = createEvaluation('15', '15m', {
      bias: 'Bearish',
      momentum: 'StrongBearish',
      trendStrength: 'Strong',
      adxDirection: 'ConfirmBear',
      adxValue: 28.4,
      rsiValue: 38.2,
      stochKValue: 24.6,
      signalStrength: -2.41,
      signalStrengthRaw: -2.18,
      markov: { priorScore: -0.512, currentState: 'D' },
      label: 'STRONG_SELL',
    }).evaluation

    const matrix = buildTrendMatrixMarkov({ '15': evalB, '5': evalA })

    expect(matrix).toHaveLength(2)
    expect(matrix[0]).toMatchObject({
      timeframe: '5',
      timeframeLabel: '5m',
      bias: 'Bullish',
      rsi: 55.6,
      stochK: 62.3,
      adx: 23.8,
      prior: 0.34,
      scoreRaw: 1.21,
      score: 1.28,
    })
    expect(matrix[1]).toMatchObject({
      timeframe: '15',
      bias: 'Bearish',
      prior: -0.51,
      score: -2.41,
      label: 'STRONG_SELL',
    })
  })

  it('aggregates posterior scores with timeframe weights', () => {
    const eval5 = createEvaluation('5', '5m', {
      signalStrength: 1.2,
      signalStrengthRaw: 1.2,
      markov: { priorScore: 0.4, currentState: 'B' },
    }).evaluation
    const eval15 = createEvaluation('15', '15m', {
      signalStrength: 2.4,
      signalStrengthRaw: 2.4,
      markov: { priorScore: 0.55, currentState: 'B' },
    }).evaluation
    const eval30 = createEvaluation('30', '30m', {
      signalStrength: -0.5,
      signalStrengthRaw: -0.5,
      markov: { priorScore: -0.1, currentState: 'R' },
    }).evaluation

    const aggregate = aggregateMultiTfMarkov({ '5': eval5, '30': eval30, '15': eval15 })

    expect(aggregate.combinedScore).toBeCloseTo(1.78, 5)
    expect(aggregate.combinedBias).toEqual({ dir: 'Bullish', strength: 'Weak' })
  })

  it('scores timeframe qualification based on posterior and prior alignment', () => {
    const supportive = createEvaluation('5', '5m', {
      signalStrength: 1.1,
      signalStrengthRaw: 1.1,
      markov: { priorScore: 0.32, currentState: 'B' },
    }).evaluation
    const weakPrior = createEvaluation('15', '15m', {
      signalStrength: 1.05,
      signalStrengthRaw: 1.05,
      markov: { priorScore: 0.05, currentState: 'R' },
    }).evaluation
    const strongOpposing = createEvaluation('30', '30m', {
      signalStrength: 2.6,
      signalStrengthRaw: 2.6,
      markov: { priorScore: -0.6, currentState: 'D' },
    }).evaluation
    const mildOpposing = createEvaluation('60', '60m', {
      signalStrength: 2.6,
      signalStrengthRaw: 2.6,
      markov: { priorScore: -0.2, currentState: 'R' },
    }).evaluation

    expect(qualifiesForTradeMarkov(supportive)).toBe(true)
    expect(qualifiesForTradeMarkov(weakPrior)).toBe(false)
    expect(qualifiesForTradeMarkov(strongOpposing)).toBe(false)
    expect(qualifiesForTradeMarkov(mildOpposing)).toBe(true)
  })

  it('detects consecutive qualified timeframes respecting the configured order', () => {
    const evals: Record<string, MarkovTimeframeEvaluation> = {}
    const a = createEvaluation('5', '5m').evaluation
    const b = createEvaluation('15', '15m').evaluation
    const c = createEvaluation('30', '30m').evaluation
    const d = createEvaluation('60', '60m', {
      signalStrength: 0.4,
      signalStrengthRaw: 0.4,
      markov: { priorScore: 0.5, currentState: 'B' },
    }).evaluation

    evals['5'] = a
    evals['15'] = b
    evals['30'] = c
    evals['60'] = d

    expect(hasNConsecutiveTimeframes(['5', '15', '60'], 2, evals)).toBe(true)
    expect(hasNConsecutiveTimeframes(['5', '15', '60'], 3, evals)).toBe(false)
    expect(hasNConsecutiveTimeframes(['5', '15', '30'], 3, evals)).toBe(true)
  })

  it('runs the full multi-timeframe model with Markov-weighted aggregation', () => {
    const s5 = createEvaluation('5', '5m', {
      signalStrength: 2.6,
      signalStrengthRaw: 2.6,
      markov: { priorScore: 0.6, currentState: 'B' },
    })
    const s15 = createEvaluation('15', '15m', {
      signalStrength: 1.8,
      signalStrengthRaw: 1.8,
      markov: { priorScore: 0.45, currentState: 'R' },
    })
    const s30 = createEvaluation('30', '30m', {
      signalStrength: 1.1,
      signalStrengthRaw: 1.1,
      markov: { priorScore: 0.32, currentState: 'R' },
    })
    const s60 = createEvaluation('60', '60m', {
      signalStrength: 0.4,
      signalStrengthRaw: 0.4,
      markov: { priorScore: 0.2, currentState: 'R' },
    })

    const result = runMultiTfModel([s30.snapshot, s60.snapshot, s5.snapshot, s15.snapshot])

    expect(new Set(Object.keys(result.perTimeframe))).toEqual(
      new Set(['5', '15', '30', '60']),
    )
    expect(result.trendMatrix).toHaveLength(4)
    expect(result.combined.combinedScore).toBeCloseTo(4.18, 5)
    expect(result.combined.combinedBias).toEqual({ dir: 'Bullish', strength: 'Medium' })
    expect(result.qualifiedTimeframes).toEqual(['5', '15', '30'])
    expect(result.emitTradeSignal).toBe(true)
  })
})

describe('scoreSignal moving average cross bonuses', () => {
  it('awards bonus for bullish EMA10/EMA50 cross reasons', () => {
    const result = createBaseHeatmapResult({
      movingAverageCrosses: [
        { pair: 'ema10-ema50', direction: 'bullish' },
      ],
    })

    const reasons = buildReasons(result, 'Bullish')
    expect(reasons).toContain('EMA10 crossed above EMA50')

    const score = scoreSignal(result, 'Bullish', reasons)
    expect(score).toBe(20)
  })

  it('awards bonus for bearish EMA10/EMA50 cross reasons', () => {
    const result = createBaseHeatmapResult({
      movingAverageCrosses: [
        { pair: 'ema10-ema50', direction: 'bearish' },
      ],
    })

    const reasons = buildReasons(result, 'Bearish')
    expect(reasons).toContain('EMA10 crossed below EMA50')

    const score = scoreSignal(result, 'Bearish', reasons)
    expect(score).toBe(20)
  })

  it('awards bonus for golden cross reasons', () => {
    const result = createBaseHeatmapResult({
      movingAverageCrosses: [
        { pair: 'ema50-ma200', direction: 'golden' },
      ],
    })

    const reasons = buildReasons(result, 'Bullish')
    expect(reasons).toContain('Golden Cross')

    const score = scoreSignal(result, 'Bullish', reasons)
    expect(score).toBe(25)
  })

  it('awards bonus for death cross reasons', () => {
    const result = createBaseHeatmapResult({
      movingAverageCrosses: [
        { pair: 'ema50-ma200', direction: 'death' },
      ],
    })

    const reasons = buildReasons(result, 'Bearish')
    expect(reasons).toContain('Death Cross')

    const score = scoreSignal(result, 'Bearish', reasons)
    expect(score).toBe(25)
  })
})
