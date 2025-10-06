export type SignalDirection = 'Bullish' | 'Bearish'

export type SignalStrength = 'Weak' | 'Medium' | 'Strong'

export type CombinedSignalDirection = SignalDirection | 'Neutral'

export type CombinedSignalBreakdown = {
  trendBias: number
  momentumBias: number
  confirmation: number
  combinedScore: number
}

export type CombinedSignal = {
  direction: CombinedSignalDirection
  strength: number
  breakdown: CombinedSignalBreakdown
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
  confluenceScore: number | null
  strength: SignalStrength | null
  price: number | null
  bias: 'BULL' | 'BEAR' | 'NEUTRAL'
  slopeMa200: number | null
  side: SignalDirection | null
  combined: CombinedSignal
}
