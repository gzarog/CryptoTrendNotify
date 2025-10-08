import { describe, expect, it } from 'vitest'

import {
  buildReasons,
  getCombinedSignal,
  getMultiTimeframeSignal,
  scoreSignal,
} from '../signals'
import type { HeatmapResult } from '../../types/heatmap'
import type { CombinedSignal, TimeframeSignalSnapshot } from '../../types/signals'

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
  }

  return {
    ...base,
    ...overrides,
    ema: { ...base.ema, ...(overrides.ema ?? {}) },
    votes: { ...base.votes, ...(overrides.votes ?? {}) },
    stochRsi: { ...base.stochRsi, ...(overrides.stochRsi ?? {}) },
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
      label: 'NEUTRAL',
    })
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
