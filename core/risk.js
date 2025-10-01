const ROUND_MODES = {
  ROUND_DOWN: 'round_down',
  NEAREST: 'nearest',
}

const SIDES = {
  LONG: 'LONG',
  SHORT: 'SHORT',
}

const OPERATIONS = {
  ADD: '+',
  SUBTRACT: '-',
}

export function clamp(x, lo, hi) {
  if (!Number.isFinite(x)) {
    return lo
  }

  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    throw new Error('clamp bounds must be finite numbers')
  }

  if (lo > hi) {
    throw new Error('clamp lower bound must be <= upper bound')
  }

  return Math.min(Math.max(x, lo), hi)
}

export function roundQty(qty, step, mode = ROUND_MODES.NEAREST) {
  if (!Number.isFinite(qty)) {
    return NaN
  }

  if (!Number.isFinite(step) || step <= 0) {
    return qty
  }

  const ratio = qty / step

  if (mode === ROUND_MODES.ROUND_DOWN) {
    return Math.floor(ratio) * step
  }

  return Math.round(ratio) * step
}

export function priceForSide(base, delta, side, op) {
  if (!Number.isFinite(base) || !Number.isFinite(delta)) {
    return null
  }

  const normalizedSide = side === SIDES.SHORT ? SIDES.SHORT : SIDES.LONG
  const normalizedOp = op === OPERATIONS.SUBTRACT ? OPERATIONS.SUBTRACT : OPERATIONS.ADD

  if (normalizedSide === SIDES.LONG) {
    return normalizedOp === OPERATIONS.SUBTRACT ? base - delta : base + delta
  }

  return normalizedOp === OPERATIONS.SUBTRACT ? base + delta : base - delta
}

export function riskGradeFromSignal(ctx) {
  const votes = ctx?.votes ?? {}
  const bull = Number.isFinite(votes.bull) ? votes.bull : 0
  const bear = Number.isFinite(votes.bear) ? votes.bear : 0
  const total = Number.isFinite(votes.total) ? votes.total : bull + bear

  if (total <= 0) {
    return 'weak'
  }

  const maSlopeOk = ctx?.maSlopeOk ?? true
  const aligned = maSlopeOk && (bull === total || bear === total)

  if (aligned) {
    return 'strong'
  }

  const majority = bull > bear || bear > bull
  return majority ? 'standard' : 'weak'
}

export function baseRiskPctFromGrade(grade, cfg) {
  if (!cfg) {
    return 0
  }

  switch (grade) {
    case 'weak':
      return cfg.baseRiskWeakPct ?? 0
    case 'standard':
      return cfg.baseRiskStdPct ?? 0
    case 'strong':
      return cfg.baseRiskStrongPct ?? 0
    default:
      return 0
  }
}

export function volatilityThrottle(atrPct, cfg) {
  if (!cfg || !Number.isFinite(atrPct)) {
    return 0
  }

  const { volMaxAtrPct, volMinAtrPct, volHighCutFactor = 1, volLowBoostFactor = 1 } = cfg

  if (!Number.isFinite(volMaxAtrPct) || !Number.isFinite(volMinAtrPct)) {
    return 0
  }

  if (atrPct > volMaxAtrPct || atrPct < volMinAtrPct) {
    return 0
  }

  if (atrPct > volMaxAtrPct * 0.66) {
    return volHighCutFactor
  }

  if (atrPct < volMinAtrPct * 1.5) {
    return volLowBoostFactor
  }

  return 1
}

export function drawdownThrottle(account, cfg) {
  if (!account || !cfg || !cfg.drawdownThrottle) {
    return 1
  }

  const { equityPeak, equity } = account
  if (!Number.isFinite(equityPeak) || !Number.isFinite(equity) || equityPeak <= 0) {
    return 1
  }

  const ddPct = ((equityPeak - equity) / equityPeak) * 100
  const thresholds = Array.isArray(cfg.drawdownThrottle.thresholds)
    ? cfg.drawdownThrottle.thresholds
    : []
  const factors = Array.isArray(cfg.drawdownThrottle.factors)
    ? cfg.drawdownThrottle.factors
    : []

  let factor = 1

  for (let i = 0; i < thresholds.length && i < factors.length; i += 1) {
    if (ddPct >= thresholds[i]) {
      factor *= factors[i]
    }
  }

  return clamp(factor, 0, 1)
}

export function equityTierCap(account, cfg) {
  if (!account || !cfg || !Array.isArray(cfg.equityTiers)) {
    return 100
  }

  const { equity } = account
  if (!Number.isFinite(equity)) {
    return cfg.equityTiers[cfg.equityTiers.length - 1]?.capPct ?? 100
  }

  for (const tier of cfg.equityTiers) {
    if (equity >= tier.min && equity < tier.max) {
      return tier.capPct
    }
  }

  const fallbackTier = cfg.equityTiers[cfg.equityTiers.length - 1]
  return fallbackTier?.capPct ?? 100
}

export function portfolioOpenRiskPct(account) {
  if (!account || !Array.isArray(account.openPositions)) {
    return 0
  }

  return account.openPositions.reduce((sum, position) => {
    const value = Number.isFinite(position?.riskAtOpenPct)
      ? position.riskAtOpenPct
      : 0
    return sum + value
  }, 0)
}

export function buildAtrRiskLevels(price, atr, config) {
  if (!Number.isFinite(price) || !Number.isFinite(atr) || !config) {
    return null
  }

  const slDelta = (config.atrMultSl ?? 0) * atr
  const tp1Delta = (config.atrMultTp1 ?? 0) * atr
  const tp2Delta = (config.atrMultTp2 ?? 0) * atr

  return {
    atr,
    mSL: config.atrMultSl ?? null,
    mTP: [config.atrMultTp1 ?? null, config.atrMultTp2 ?? null],
    risk$: null,
    long: {
      SL: priceForSide(price, slDelta, SIDES.LONG, OPERATIONS.SUBTRACT),
      T1: priceForSide(price, tp1Delta, SIDES.LONG, OPERATIONS.ADD),
      T2: priceForSide(price, tp2Delta, SIDES.LONG, OPERATIONS.ADD),
    },
    short: {
      SL: priceForSide(price, slDelta, SIDES.SHORT, OPERATIONS.SUBTRACT),
      T1: priceForSide(price, tp1Delta, SIDES.SHORT, OPERATIONS.ADD),
      T2: priceForSide(price, tp2Delta, SIDES.SHORT, OPERATIONS.ADD),
    },
  }
}

export const RISK_CONSTANTS = {
  ROUND_MODES,
  SIDES,
  OPERATIONS,
}
