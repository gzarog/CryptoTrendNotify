export type HedgeSide = 'LONG' | 'SHORT'

export type HedgePosition = {
  symbol: string
  side: HedgeSide
  entryPrice: number
  quantity: number
  leverage?: number | null
}

export type HedgePrediction = {
  currentPrice: number
  atr: number | null
  pUp: number
  pDown: number
  pReversal: number
  pBase: number
  ema10: number | null
  ema50: number | null
  ma200: number | null
  macd: {
    value: number | null
    signal: number | null
    hist: number | null
  }
  adx: number | null
  timestamp: number | null
}

export type HedgeConfig = {
  hedgeRatio: number
  kAtr: number
  flipDelta: number
  rMultiple: number
  thresholdPctOfNotional: number
  lotStep?: number | null
  maxHedgeOfPosition?: number | null
}

export type HedgeDecision = {
  shouldHedge: boolean
  reasons: string[]
  hedgeSide: HedgeSide | null
  hedgeQty: number | null
  targetExposureAfter: number | null
  estProtectionQuote: number | null
  context: {
    pnl: number
    rPnl: number
    moveAtr: number
    expectedDownside: number
    thresholdQuote: number
    probGapDown: number
    momentumAgainst: boolean
    trendAgainst: boolean
    currentExposureQuote: number
    targetExposureQuote: number
    deltaToHedgeQuote: number
  } | null
}

export const DEFAULT_HEDGE_CONFIG: HedgeConfig = {
  hedgeRatio: 0.6,
  kAtr: 1.1,
  flipDelta: 0.1,
  rMultiple: 1,
  thresholdPctOfNotional: 0.02,
  lotStep: 0.0001,
  maxHedgeOfPosition: 0.8,
}

function sign(side: HedgeSide): 1 | -1 {
  return side === 'LONG' ? 1 : -1
}

function roundToStep(value: number, step: number): number {
  if (!Number.isFinite(value)) {
    return NaN
  }

  const normalizedStep = Number.isFinite(step) && step > 0 ? step : 1
  return Math.round(value / normalizedStep) * normalizedStep
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function calculateHedge(
  position: HedgePosition,
  prediction: HedgePrediction,
  config: HedgeConfig,
): HedgeDecision {
  if (
    !isFiniteNumber(position.entryPrice) ||
    !isFiniteNumber(position.quantity) ||
    position.entryPrice <= 0 ||
    position.quantity <= 0 ||
    !isFiniteNumber(prediction.currentPrice) ||
    prediction.currentPrice <= 0
  ) {
    return {
      shouldHedge: false,
      reasons: ['Invalid position or price inputs'],
      hedgeSide: null,
      hedgeQty: null,
      targetExposureAfter: null,
      estProtectionQuote: null,
      context: null,
    }
  }

  if (!isFiniteNumber(prediction.atr) || (prediction.atr ?? 0) <= 0) {
    return {
      shouldHedge: false,
      reasons: ['ATR unavailable – cannot size hedge'],
      hedgeSide: null,
      hedgeQty: null,
      targetExposureAfter: null,
      estProtectionQuote: null,
      context: null,
    }
  }

  const lotStep = Number.isFinite(config.lotStep ?? NaN) && (config.lotStep ?? 0) > 0 ? (config.lotStep as number) : 0.0001
  const sideSign = sign(position.side)
  const notional = prediction.currentPrice * position.quantity
  const pnl =
    sideSign * (prediction.currentPrice - position.entryPrice) * position.quantity

  const moveAtr = config.kAtr * (prediction.atr as number)
  const expectedDownside = prediction.pDown * moveAtr * position.quantity
  const thresholdQuote = config.thresholdPctOfNotional * notional

  const atrStop = moveAtr * position.quantity
  const rPnl = -config.rMultiple * atrStop

  const probGapDown = prediction.pDown - prediction.pUp

  const macdHist = isFiniteNumber(prediction.macd.hist) ? (prediction.macd.hist as number) : 0
  const momentumAgainst =
    (position.side === 'LONG' && macdHist < 0) ||
    (position.side === 'SHORT' && macdHist > 0)

  const trendAgainst =
    (position.side === 'LONG' &&
      isFiniteNumber(prediction.ema10) &&
      isFiniteNumber(prediction.ema50) &&
      (prediction.ema10 as number) < (prediction.ema50 as number)) ||
    (position.side === 'SHORT' &&
      isFiniteNumber(prediction.ema10) &&
      isFiniteNumber(prediction.ema50) &&
      (prediction.ema10 as number) > (prediction.ema50 as number))

  let trigger = false
  const reasons: string[] = []

  if (pnl <= rPnl) {
    trigger = true
    reasons.push('PnL<=-R')
  }

  if (expectedDownside > thresholdQuote) {
    trigger = true
    reasons.push('ExpectedDown>threshold')
  }

  const adxValue = isFiniteNumber(prediction.adx) ? (prediction.adx as number) : 0
  if (probGapDown >= config.flipDelta && momentumAgainst && adxValue >= 20) {
    trigger = true
    reasons.push('ProbFlipRisk + ADX')
  }

  const context = {
    pnl,
    rPnl,
    moveAtr,
    expectedDownside,
    thresholdQuote,
    probGapDown,
    momentumAgainst,
    trendAgainst,
    currentExposureQuote: sideSign * notional,
    targetExposureQuote: 0,
    deltaToHedgeQuote: 0,
  }

  if (!trigger) {
    return {
      shouldHedge: false,
      reasons,
      hedgeSide: null,
      hedgeQty: null,
      targetExposureAfter: null,
      estProtectionQuote: null,
      context,
    }
  }

  const currentExposureQuote = context.currentExposureQuote
  const targetExposureQuote = currentExposureQuote * (1 - config.hedgeRatio)
  const deltaToHedgeQuote = currentExposureQuote - targetExposureQuote

  const rawHedgeQty = Math.abs(deltaToHedgeQuote) / prediction.currentPrice
  const maxHedgeMultiplier = Number.isFinite(config.maxHedgeOfPosition ?? NaN)
    ? (config.maxHedgeOfPosition as number)
    : 0.8
  const capQty = Math.max(0, maxHedgeMultiplier) * position.quantity
  const unclampedQty = Math.min(rawHedgeQty, capQty)
  let hedgeQty = roundToStep(unclampedQty, lotStep)

  if (!isFiniteNumber(hedgeQty) || hedgeQty < 0) {
    hedgeQty = 0
  }

  const hedgeSide: HedgeSide = position.side === 'LONG' ? 'SHORT' : 'LONG'

  const estProtection = Math.min(Math.abs(deltaToHedgeQuote), expectedDownside)

  context.targetExposureQuote = targetExposureQuote
  context.deltaToHedgeQuote = deltaToHedgeQuote

  return {
    shouldHedge: hedgeQty > 0,
    reasons,
    hedgeSide: hedgeQty > 0 ? hedgeSide : null,
    hedgeQty: hedgeQty > 0 ? hedgeQty : null,
    targetExposureAfter:
      hedgeQty > 0 ? Math.abs(targetExposureQuote) / prediction.currentPrice : null,
    estProtectionQuote: hedgeQty > 0 ? estProtection : null,
    context,
  }
}
