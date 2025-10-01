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
  }

  export type AccountState = {
    equityPeak: number
    equity: number
    openPositions: Array<{
      riskAtOpenPct: number
    }>
  }

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
