declare module '../../core/risk.js' {
  export type RoundMode = 'round_down' | 'nearest'
  export type TradeSide = 'LONG' | 'SHORT'
  export type PriceOperation = '+' | '-'

  export type SignalVotes = {
    bull: number
    bear: number
    total: number
  }

  export type SignalContext = {
    votes: SignalVotes
    maSlopeOk?: boolean | null
    strengthHint?: 'weak' | 'standard' | 'strong' | null
    atrPct?: number | null
    atr?: number | null
    price?: number | null
    side?: TradeSide | null
  }

  export type RiskConfig = {
    baseRiskWeakPct?: number
    baseRiskStdPct?: number
    baseRiskStrongPct?: number
    volMaxAtrPct?: number
    volMinAtrPct?: number
    volHighCutFactor?: number
    volLowBoostFactor?: number
    drawdownThrottle?: {
      thresholds?: number[]
      factors?: number[]
    }
    equityTiers?: Array<{
      min: number
      max: number
      capPct: number
    }>
    atrMultSl?: number
    atrMultTp1?: number
    atrMultTp2?: number
    instrumentRiskCapPct?: number
    maxOpenRiskPctPortfolio?: number
    maxOpenPositions?: number
    maxDailyLossPct?: number
    ladders?: {
      steps?: number
      weights?: number[]
    }
    slMultipliers?: number[]
    tpMultipliers?: Array<[number, number]>
    qtyStep?: number
    contractRoundMode?: RoundMode
    minOrderQty?: number
    useHardTPs?: boolean
    trailingAtrMultiplier?: number
  }

  export type AccountState = {
    equityPeak: number
    equity: number
    openPositions: Array<{
      riskAtOpenPct: number
    }>
    todayRealizedPnLPct?: number
  }

  export type RiskPlanStep = {
    stepIndex: number
    intent: 'ENTER' | 'ADD'
    qty: number
    entryTrigger: 'at_market' | 'breakout' | 'retest'
    slPrice: number
    tp1Price: number | null
    tp2Price: number | null
  }

  export type RiskPlanTrailing = {
    type: 'NONE' | 'ATR'
    multiplier: number
  }

  export type RiskPlan = {
    finalRiskPct: number
    riskGrade: 'weak' | 'standard' | 'strong' | string
    throttleFactor: number
    positionSizeTotal: number
    notional: number
    steps: RiskPlanStep[]
    trailingPlan: RiskPlanTrailing
  }

  export type RiskPlanResult =
    | { ok: true; plan: RiskPlan }
    | { ok: false; reason: string }

  export type RiskLeg = {
    SL: number | null
    T1: number | null
    T2: number | null
  }

  export type AtrRiskLevels = {
    atr: number
    mSL: number | null
    mTP: Array<number | null>
    risk$: null
    long: RiskLeg
    short: RiskLeg
  }

  export function clamp(x: number, lo: number, hi: number): number
  export function roundQty(qty: number, step: number, mode?: RoundMode): number
  export function priceForSide(
    base: number,
    delta: number,
    side: TradeSide,
    op: PriceOperation,
  ): number | null
  export function riskGradeFromSignal(ctx: SignalContext): 'weak' | 'standard' | 'strong'
  export function baseRiskPctFromGrade(grade: string, cfg: RiskConfig): number
  export function volatilityThrottle(atrPct: number, cfg: RiskConfig): number
  export function drawdownThrottle(account: AccountState, cfg: RiskConfig): number
  export function equityTierCap(account: AccountState, cfg: RiskConfig): number
  export function portfolioOpenRiskPct(account: AccountState): number
  export function computeRiskPlan(
    ctx: SignalContext,
    cfg: RiskConfig,
    account: AccountState,
  ): RiskPlanResult
  export function buildAtrRiskLevels(
    price: number,
    atr: number,
    config: RiskConfig,
  ): AtrRiskLevels | null
  export const RISK_CONSTANTS: {
    ROUND_MODES: Record<'ROUND_DOWN' | 'NEAREST', RoundMode>
    SIDES: Record<'LONG' | 'SHORT', TradeSide>
    OPERATIONS: Record<'ADD' | 'SUBTRACT', PriceOperation>
  }
}
