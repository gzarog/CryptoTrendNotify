import { describe, expect, it } from 'vitest'

import { buildReasons, scoreSignal } from '../signals'
import type { HeatmapResult } from '../../types/heatmap'

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
  }
}

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
