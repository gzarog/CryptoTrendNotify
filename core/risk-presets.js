import { RISK_CONSTANTS } from './risk.js'

const DEFAULT_LADDER_WEIGHTS = [0.5, 0.3, 0.2]
const DEFAULT_DRAWNDOWN_THRESHOLDS = [5, 10, 15]
const DEFAULT_DRAWNDOWN_FACTORS = [0.7, 0.5, 0.3]
const DEFAULT_EQUITY_TIERS = [
  { min: 0, max: 25_000, capPct: 1 },
  { min: 25_000, max: Number.MAX_SAFE_INTEGER, capPct: 1 },
]

const DEFAULT_ACCOUNT_STATE = {
  equityPeak: 100_000,
  equity: 100_000,
  openPositions: [],
  todayRealizedPnLPct: 0,
}

function clonePositions(positions) {
  if (!Array.isArray(positions)) {
    return []
  }

  return positions
    .map((position) => ({
      riskAtOpenPct: Number.isFinite(position?.riskAtOpenPct)
        ? position.riskAtOpenPct
        : 0,
    }))
    .filter((position) => Number.isFinite(position.riskAtOpenPct))
}

function resolveBaseRiskPct(value, fallback) {
  if (!Number.isFinite(value)) {
    return fallback
  }

  if (value <= 0) {
    return fallback
  }

  return value
}

export function createDefaultAccountState(overrides = {}) {
  const base = {
    ...DEFAULT_ACCOUNT_STATE,
    openPositions: clonePositions(DEFAULT_ACCOUNT_STATE.openPositions),
  }

  const next = { ...base, ...overrides }

  if (Number.isFinite(overrides?.equityPeak) && overrides.equityPeak > 0) {
    next.equityPeak = overrides.equityPeak
  }

  if (Number.isFinite(overrides?.equity) && overrides.equity > 0) {
    next.equity = overrides.equity
  }

  next.openPositions = clonePositions(overrides?.openPositions ?? [])

  if (Number.isFinite(overrides?.todayRealizedPnLPct)) {
    next.todayRealizedPnLPct = overrides.todayRealizedPnLPct
  }

  return next
}

export function createRiskConfigFromHeatmapConfig(config, overrides = {}) {
  if (!config || typeof config !== 'object') {
    return { ...overrides }
  }

  const riskPct = Number.isFinite(config.riskPctPerTrade)
    ? config.riskPctPerTrade * 100
    : 0.75
  const atrMultSl = Number.isFinite(config.atrMultSl) ? config.atrMultSl : 1.2
  const tp1 = Number.isFinite(config.atrMultTp1) ? config.atrMultTp1 : 1
  const tp2 = Number.isFinite(config.atrMultTp2) ? config.atrMultTp2 : tp1

  const baseRiskWeakPct = resolveBaseRiskPct(overrides?.baseRiskWeakPct, riskPct)
  const baseRiskStdPct = resolveBaseRiskPct(overrides?.baseRiskStdPct, riskPct)
  const baseRiskStrongPct = resolveBaseRiskPct(
    overrides?.baseRiskStrongPct,
    Math.max(riskPct, baseRiskStdPct),
  )

  const defaultConfig = {
    baseRiskWeakPct,
    baseRiskStdPct,
    baseRiskStrongPct,
    volMaxAtrPct: Number.isFinite(config.volMaxAtrPct)
      ? config.volMaxAtrPct
      : overrides?.volMaxAtrPct ?? 3,
    volMinAtrPct: Number.isFinite(config.volMinAtrPct)
      ? config.volMinAtrPct
      : overrides?.volMinAtrPct ?? 0.15,
    volHighCutFactor: overrides?.volHighCutFactor ?? 0.6,
    volLowBoostFactor: overrides?.volLowBoostFactor ?? 1.2,
    drawdownThrottle: {
      thresholds:
        Array.isArray(overrides?.drawdownThrottle?.thresholds) &&
        overrides.drawdownThrottle.thresholds.length > 0
          ? overrides.drawdownThrottle.thresholds
          : DEFAULT_DRAWNDOWN_THRESHOLDS,
      factors:
        Array.isArray(overrides?.drawdownThrottle?.factors) &&
        overrides.drawdownThrottle.factors.length > 0
          ? overrides.drawdownThrottle.factors
          : DEFAULT_DRAWNDOWN_FACTORS,
    },
    equityTiers:
      Array.isArray(overrides?.equityTiers) && overrides.equityTiers.length > 0
        ? overrides.equityTiers
        : DEFAULT_EQUITY_TIERS.map((tier) => ({ ...tier, capPct: riskPct })),
    atrMultSl,
    atrMultTp1: tp1,
    atrMultTp2: tp2,
    instrumentRiskCapPct:
      Number.isFinite(overrides?.instrumentRiskCapPct) &&
      overrides.instrumentRiskCapPct > 0
        ? overrides.instrumentRiskCapPct
        : riskPct,
    maxOpenRiskPctPortfolio:
      Number.isFinite(overrides?.maxOpenRiskPctPortfolio) &&
      overrides.maxOpenRiskPctPortfolio > 0
        ? overrides.maxOpenRiskPctPortfolio
        : riskPct * 4,
    maxOpenPositions:
      Number.isFinite(overrides?.maxOpenPositions) && overrides.maxOpenPositions > 0
        ? overrides.maxOpenPositions
        : 4,
    maxDailyLossPct:
      Number.isFinite(overrides?.maxDailyLossPct) && overrides.maxDailyLossPct > 0
        ? overrides.maxDailyLossPct
        : riskPct * 3,
    ladders:
      overrides?.ladders && typeof overrides.ladders === 'object'
        ? overrides.ladders
        : { steps: DEFAULT_LADDER_WEIGHTS.length, weights: DEFAULT_LADDER_WEIGHTS },
    slMultipliers:
      Array.isArray(overrides?.slMultipliers) && overrides.slMultipliers.length > 0
        ? overrides.slMultipliers
        : new Array(DEFAULT_LADDER_WEIGHTS.length).fill(atrMultSl),
    tpMultipliers:
      Array.isArray(overrides?.tpMultipliers) && overrides.tpMultipliers.length > 0
        ? overrides.tpMultipliers
        : new Array(DEFAULT_LADDER_WEIGHTS.length).fill([tp1, tp2]),
    qtyStep:
      Number.isFinite(overrides?.qtyStep) && overrides.qtyStep > 0
        ? overrides.qtyStep
        : 0.001,
    contractRoundMode:
      overrides?.contractRoundMode ?? RISK_CONSTANTS.ROUND_MODES.NEAREST,
    minOrderQty:
      Number.isFinite(overrides?.minOrderQty) && overrides.minOrderQty >= 0
        ? overrides.minOrderQty
        : 0,
    useHardTPs: overrides?.useHardTPs ?? false,
    trailingAtrMultiplier:
      Number.isFinite(overrides?.trailingAtrMultiplier) &&
      overrides.trailingAtrMultiplier > 0
        ? overrides.trailingAtrMultiplier
        : Math.max(tp1, 1.5),
  }

  return {
    ...defaultConfig,
    ...overrides,
    drawdownThrottle: {
      ...defaultConfig.drawdownThrottle,
      ...(overrides?.drawdownThrottle ?? {}),
    },
    equityTiers: overrides?.equityTiers ?? defaultConfig.equityTiers,
  }
}
