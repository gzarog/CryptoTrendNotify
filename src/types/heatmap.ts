export type HeatmapVoteBreakdown = {
  timeframe: string
  label: string
  value: number | null
  vote: 'bull' | 'bear' | 'neutral' | 'na'
}

export type HeatmapFiltersStatus = {
  atrPct: number | null
  atrBounds: { min: number; max: number }
  atrStatus: 'ok' | 'too-low' | 'too-high' | 'missing'
  maSide: 'above' | 'below' | 'unknown'
  maLongOk: boolean
  maShortOk: boolean
  distPctToMa200: number | null
  maDistanceStatus: 'ok' | 'too-close' | 'missing'
  useMa200Filter: boolean
}

export type HeatmapGating = {
  timing: boolean
  blockers: string[]
}

export type MovingAverageCrossPair = 'ema10-ema50' | 'ema10-ma200' | 'ema50-ma200'

export type MovingAverageCrossDirection =
  | 'golden'
  | 'death'
  | 'bullish'
  | 'bearish'
  | 'cross_up'
  | 'cross_down'
  | 'up'
  | 'down'
  | 'above'
  | 'below'
  | 'long'
  | 'short'

export type MovingAverageCrossEvent = {
  pair: MovingAverageCrossPair
  direction: MovingAverageCrossDirection
}

export type HeatmapResult = {
  entryTimeframe: string
  entryLabel: string
  symbol: string
  evaluatedAt: number | null
  closedAt: number | null
  bias: 'BULL' | 'BEAR' | 'NEUTRAL'
  strength: 'weak' | 'standard' | 'strong'
  signal: 'LONG' | 'SHORT' | 'NONE'
  stochEvent: 'cross_up_from_oversold' | 'cross_down_from_overbought' | null
  ema: {
    ema10: number | null
    ema50: number | null
  }
  movingAverageCrosses?: MovingAverageCrossEvent[] | null
  votes: {
    bull: number
    bear: number
    total: number
    mode: 'all' | 'majority'
    breakdown: HeatmapVoteBreakdown[]
  }
  stochRsi: {
    k: number | null
    d: number | null
    rawNormalized: number | null
  }
  rsiLtf: {
    value: number | null
    sma5: number | null
    okLong: boolean
    okShort: boolean
  }
  filters: HeatmapFiltersStatus
  gating: {
    long: HeatmapGating
    short: HeatmapGating
  }
  cooldown: {
    requiredBars: number
    barsSinceSignal: number | null
    ok: boolean
    lastAlertSide: 'LONG' | 'SHORT' | null
    lastExtremeMarker: 'longExtremeSeen' | 'shortExtremeSeen' | null
  }
  risk: {
    atr: number | null
    slLong: number | null
    t1Long: number | null
    t2Long: number | null
    slShort: number | null
    t1Short: number | null
    t2Short: number | null
  }
  price: number | null
  ma200: {
    value: number | null
    slope: number | null
  }
  adx?: {
    value: number | null
    plusDI: number | null
    minusDI: number | null
    slope: number | null
  }
}
