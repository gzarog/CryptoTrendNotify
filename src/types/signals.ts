export type SignalDirection = 'Bullish' | 'Bearish'

export type SignalStrength = 'Weak' | 'Medium' | 'Strong'

export type CombinedSignalDirection = SignalDirection | 'Neutral'

export type SignalStage = 'ready' | 'cooldown' | 'gated' | 'triggered'

export type CombinedSignalBreakdown = {
  bias: 'Bullish' | 'Bearish' | 'Neutral'
  momentum: 'StrongBullish' | 'StrongBearish' | 'Weak'
  trendStrength: 'Strong' | 'Forming' | 'Weak'
  adxDirection: 'ConfirmBull' | 'ConfirmBear' | 'NoConfirm'
  adxIsRising: boolean
  adxValue: number | null
  rsiValue: number | null
  stochKValue: number | null
  emaFast: number | null
  emaSlow: number | null
  maLong: number | null
  markov: {
    priorScore: number
    currentState: 'D' | 'R' | 'B' | 'U' | null
  }
  signalStrength: number
  signalStrengthRaw: number
  label:
    | 'STRONG_BUY'
    | 'BUY_FORMING'
    | 'BUY_WEAK'
    | 'NEUTRAL'
    | 'SELL_WEAK'
    | 'SELL_FORMING'
    | 'STRONG_SELL'
}

export type CombinedSignal = {
  direction: CombinedSignalDirection
  strength: number
  breakdown: CombinedSignalBreakdown
}

export type MultiTimeframeSignalContribution = {
  timeframe: string
  timeframeLabel: string
  weight: number
  signal: CombinedSignal
  score: number
  weightedScore: number
}

export type MultiTimeframeSignal = {
  direction: CombinedSignalDirection
  strength: number
  combinedScore: number
  normalizedScore: number
  combinedBias: {
    dir: CombinedSignalDirection
    strength: 'Strong' | 'Medium' | 'Weak' | 'Sideways'
  }
  contributions: MultiTimeframeSignalContribution[]
}

export type CombinedSignalNotification = {
  id: string
  symbol: string
  timeframe: string
  timeframeLabel: string
  direction: CombinedSignalDirection
  strength: number
  breakdown: CombinedSignalBreakdown
  price: number | null
  bias: 'BULL' | 'BEAR' | 'NEUTRAL'
  triggeredAt: number
}

export type MultiTimeframeSignalNotification = {
  id: string
  symbol: string
  direction: CombinedSignalDirection
  normalizedScore: number
  strength: number
  contributions: MultiTimeframeSignalContribution[]
  combinedBias: {
    dir: CombinedSignalDirection
    strength: 'Strong' | 'Medium' | 'Weak' | 'Sideways'
  }
  triggeredAt: number
}

export type TradingSignal = {
  symbol: string
  tf: string
  timeframeLabel: string
  side: SignalDirection
  reason: string[]
  confluenceScore: number
  strength: SignalStrength
  suggestedSL: number | null
  suggestedTP: number | null
  metadata: Record<string, unknown>
  dedupeKey: string
  createdAt: number
  price: number | null
  bias: 'BULL' | 'BEAR' | 'NEUTRAL'
}

export type SignalNotification = {
  id: string
  symbol: string
  timeframe: string
  timeframeLabel: string
  side: SignalDirection
  strength: SignalStrength
  confluenceScore: number
  price: number | null
  reasons: string[]
  triggeredAt: number
}

export type TimeframeSignalSnapshot = {
  timeframe: string
  timeframeLabel: string
  trend: SignalDirection | 'Neutral'
  momentum: SignalDirection | 'Neutral'
  stage: SignalStage
  confluenceScore: number | null
  strength: SignalStrength | null
  price: number | null
  bias: 'BULL' | 'BEAR' | 'NEUTRAL'
  slopeMa200: number | null
  side: SignalDirection | null
  combined: CombinedSignal
}

export type MarkovTimeframeEvaluation = CombinedSignalBreakdown & {
  timeframe: string
  timeframeLabel: string
}

export type TrendMatrixRow = {
  timeframe: string
  timeframeLabel: string
  bias: CombinedSignalBreakdown['bias']
  rsi: number | null
  stochK: number | null
  adx: number | null
  trend: CombinedSignalBreakdown['trendStrength']
  adxDirection: CombinedSignalBreakdown['adxDirection']
  prior: number | null
  label: CombinedSignalBreakdown['label']
  scoreRaw: number
  score: number
}

export type AggregateMultiTfMarkovResult = {
  combinedScore: number
  combinedBias: {
    dir: CombinedSignalDirection
    strength: 'Strong' | 'Medium' | 'Weak' | 'Sideways'
  }
}

export type MultiTimeframeModelSummary = {
  perTimeframe: Record<string, MarkovTimeframeEvaluation>
  trendMatrix: TrendMatrixRow[]
  combined: AggregateMultiTfMarkovResult
  qualifiedTimeframes: string[]
  emitTradeSignal: boolean
}
