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

const ALERT_VERSION = 'risk-manager/v1.0'

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

function normalizeLadderConfig(ladders = {}) {
  const { steps: rawSteps, weights: rawWeights } = ladders

  const weights = Array.isArray(rawWeights) ? [...rawWeights] : []
  let steps = Number.isFinite(rawSteps) ? Math.max(0, Math.floor(rawSteps)) : 0

  if (steps <= 0) {
    steps = weights.length > 0 ? weights.length : 1
  }

  if (weights.length < steps) {
    while (weights.length < steps) {
      weights.push(1)
    }
  }

  const truncated = weights.slice(0, steps).map((value) => (Number.isFinite(value) && value > 0 ? value : 0))
  const sum = truncated.reduce((acc, value) => acc + value, 0)

  if (sum <= 0) {
    return new Array(steps).fill(1 / steps)
  }

  return truncated.map((value) => value / sum)
}

function resolveMultiplier(multipliers, index) {
  if (!Array.isArray(multipliers) || multipliers.length === 0) {
    return null
  }

  const clampedIndex = Math.min(index, multipliers.length - 1)
  return Number.isFinite(multipliers[clampedIndex]) ? multipliers[clampedIndex] : null
}

function resolveTakeProfitMultipliers(multipliers, index) {
  if (!Array.isArray(multipliers) || multipliers.length === 0) {
    return [null, null]
  }

  const clampedIndex = Math.min(index, multipliers.length - 1)
  const pair = Array.isArray(multipliers[clampedIndex]) ? multipliers[clampedIndex] : []

  const tp1 = Number.isFinite(pair[0]) ? pair[0] : null
  const tp2 = Number.isFinite(pair[1]) ? pair[1] : tp1

  return [tp1, tp2]
}

export function computeRiskPlan(ctx, cfg, account) {
  if (!ctx || !cfg || !account) {
    return { ok: false, reason: 'invalid_input' }
  }

  const grade = ctx.strengthHint ?? riskGradeFromSignal(ctx)
  const baseRiskPct = baseRiskPctFromGrade(grade, cfg)

  const volFactor = volatilityThrottle(ctx.atrPct, cfg)
  if (volFactor === 0) {
    return { ok: false, reason: 'blocked_by_volatility' }
  }

  const ddFactor = drawdownThrottle(account, cfg)
  const throttle = volFactor * ddFactor

  const tierCap = equityTierCap(account, cfg)

  let finalRiskPct = baseRiskPct * throttle

  if (Number.isFinite(tierCap)) {
    finalRiskPct = Math.min(finalRiskPct, tierCap)
  }

  if (Number.isFinite(cfg.instrumentRiskCapPct)) {
    finalRiskPct = Math.min(finalRiskPct, cfg.instrumentRiskCapPct)
  }

  const openRisk = portfolioOpenRiskPct(account)

  if (
    Number.isFinite(cfg.maxOpenRiskPctPortfolio) &&
    openRisk + finalRiskPct > cfg.maxOpenRiskPctPortfolio
  ) {
    return { ok: false, reason: 'blocked_by_portfolio_risk_cap' }
  }

  const openPositionsCount = Array.isArray(account.openPositions)
    ? account.openPositions.length
    : 0
  if (Number.isFinite(cfg.maxOpenPositions) && openPositionsCount >= cfg.maxOpenPositions) {
    return { ok: false, reason: 'blocked_by_max_positions' }
  }

  const todayPnLPct = Number.isFinite(account.todayRealizedPnLPct)
    ? account.todayRealizedPnLPct
    : 0
  if (Number.isFinite(cfg.maxDailyLossPct) && -todayPnLPct >= cfg.maxDailyLossPct) {
    return { ok: false, reason: 'blocked_by_daily_loss_halt' }
  }

  const equity = Number.isFinite(account.equity) ? account.equity : null
  if (equity === null || equity <= 0 || !Number.isFinite(finalRiskPct)) {
    return { ok: false, reason: 'invalid_account_equity' }
  }

  const riskBudget = equity * (finalRiskPct / 100)

  const normalizedWeights = normalizeLadderConfig(cfg.ladders)
  const steps = normalizedWeights.length

  const atr = Number.isFinite(ctx.atr) ? ctx.atr : null
  const price = Number.isFinite(ctx.price) ? ctx.price : null
  if (atr === null || price === null) {
    return { ok: false, reason: 'invalid_market_context' }
  }

  const side = ctx.side === SIDES.SHORT ? SIDES.SHORT : SIDES.LONG
  const qtyStep = Number.isFinite(cfg.qtyStep) && cfg.qtyStep > 0 ? cfg.qtyStep : 0
  const roundMode = cfg.contractRoundMode ?? ROUND_MODES.NEAREST
  const minOrderQty = Number.isFinite(cfg.minOrderQty) && cfg.minOrderQty > 0 ? cfg.minOrderQty : 0

  const stepsOut = []
  let totalQty = 0

  for (let i = 0; i < steps; i += 1) {
    const weight = normalizedWeights[i]
    const stepRiskBudget = riskBudget * weight

    if (!Number.isFinite(stepRiskBudget) || stepRiskBudget <= 0) {
      // Skip steps that have no capital allocated
      continue
    }

    const slMult = resolveMultiplier(cfg.slMultipliers, i) ?? 0
    const slDelta = atr * Math.abs(slMult)
    const slPrice = priceForSide(price, slDelta, side, OPERATIONS.SUBTRACT)

    if (!Number.isFinite(slPrice)) {
      return { ok: false, reason: 'invalid_stop_loss_price' }
    }

    const perUnitRisk = Math.abs(price - slPrice)
    if (perUnitRisk <= 0 || !Number.isFinite(perUnitRisk)) {
      return { ok: false, reason: 'invalid_per_unit_risk' }
    }

    const qtyRaw = stepRiskBudget / perUnitRisk
    let qtyRounded = qtyRaw

    if (qtyStep > 0) {
      qtyRounded = roundQty(qtyRaw, qtyStep, roundMode)
    }

    if (!Number.isFinite(qtyRounded)) {
      return { ok: false, reason: 'invalid_position_size' }
    }

    if (qtyRounded < minOrderQty) {
      qtyRounded = minOrderQty
    }

    if (qtyRounded <= 0) {
      return { ok: false, reason: 'position_size_below_minimum' }
    }

    const [tp1MultRaw, tp2MultRaw] = resolveTakeProfitMultipliers(cfg.tpMultipliers, i)
    const tp1Delta = atr * (tp1MultRaw ?? 0)
    const tp2Delta = atr * (tp2MultRaw ?? 0)

    const tp1Price = priceForSide(price, Math.abs(tp1Delta), side, OPERATIONS.ADD)
    const tp2Price = priceForSide(price, Math.abs(tp2Delta), side, OPERATIONS.ADD)

    const stepIndex = i + 1
    let entryTrigger = 'retest'
    if (stepIndex === 1) {
      entryTrigger = 'at_market'
    } else if (stepIndex === 2) {
      entryTrigger = 'breakout'
    }

    stepsOut.push({
      stepIndex,
      intent: stepIndex === 1 ? 'ENTER' : 'ADD',
      qty: qtyRounded,
      entryTrigger,
      slPrice,
      tp1Price,
      tp2Price,
    })

    totalQty += qtyRounded
  }

  if (stepsOut.length === 0) {
    return { ok: false, reason: 'no_viable_steps' }
  }

  const trailingPlan = cfg.useHardTPs
    ? { type: 'NONE', multiplier: 0 }
    : { type: 'ATR', multiplier: Number.isFinite(cfg.trailingAtrMultiplier) ? cfg.trailingAtrMultiplier : 1.5 }

  const plan = {
    finalRiskPct,
    riskGrade: grade,
    throttleFactor: throttle,
    positionSizeTotal: totalQty,
    notional: totalQty * price,
    steps: stepsOut,
    trailingPlan,
  }

  return { ok: true, plan }
}

export function buildAlert(ctx, cfg, account) {
  const context = ctx ?? {}
  const config = cfg ?? null
  const accountState = account ?? null

  const portfolioRiskPct = portfolioOpenRiskPct(accountState)
  const planResult = computeRiskPlan(context, config, accountState)

  const defaultStrength = context.strengthHint ?? riskGradeFromSignal(context)

  const basePayload = {
    signal: context.side ?? context.signal ?? null,
    symbol: context.symbol ?? null,
    entry_tf: context.entryTF ?? context.entry_tf ?? null,
    bias: context.bias ?? null,
    votes: context.votes ?? null,
    rsi_htf: context.rsiHTF ?? context.rsi_htf ?? null,
    rsi_ltf: context.rsiLTF ?? context.rsi_ltf ?? null,
    stochrsi: context.stochrsi ?? context.stochRsi ?? null,
    filters: context.filters ?? null,
    timestamp: context.barTimeISO ?? context.timestamp ?? null,
    version: ALERT_VERSION,
  }

  if (!planResult?.ok) {
    return {
      ...basePayload,
      strength: defaultStrength,
      risk_plan: null,
      portfolio_check: {
        allowed: false,
        reason: planResult?.reason ?? 'unknown',
        portfolioOpenRiskPct: portfolioRiskPct,
      },
    }
  }

  const { plan } = planResult

  return {
    ...basePayload,
    strength: plan?.riskGrade ?? defaultStrength,
    risk_plan: plan ?? null,
    portfolio_check: {
      allowed: true,
      reason: null,
      portfolioOpenRiskPct: portfolioRiskPct,
    },
  }
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
