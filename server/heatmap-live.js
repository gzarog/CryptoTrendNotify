import { calculateATR, calculateEMA, calculateRSI, calculateSMA, calculateStochasticRSI } from './indicators.js'

const TIMEFRAME_CONFIGS = [
  { value: '5', label: '5m', rsiPeriod: 8, stoch: { rsiLength: 7, stochLength: 7, kSmoothing: 2, dSmoothing: 2 } },
  { value: '15', label: '15m', rsiPeriod: 11, stoch: { rsiLength: 9, stochLength: 9, kSmoothing: 2, dSmoothing: 3 } },
  { value: '30', label: '30m', rsiPeriod: 13, stoch: { rsiLength: 12, stochLength: 12, kSmoothing: 3, dSmoothing: 3 } },
  { value: '60', label: '60m', rsiPeriod: 15, stoch: { rsiLength: 14, stochLength: 14, kSmoothing: 3, dSmoothing: 3 } },
  { value: '120', label: '120m', rsiPeriod: 17, stoch: { rsiLength: 16, stochLength: 16, kSmoothing: 3, dSmoothing: 3 } },
  { value: '240', label: '240m (4h)', rsiPeriod: 20, stoch: { rsiLength: 21, stochLength: 21, kSmoothing: 4, dSmoothing: 4 } },
  { value: '360', label: '360m (6h)', rsiPeriod: 23, stoch: { rsiLength: 24, stochLength: 24, kSmoothing: 4, dSmoothing: 4 } },
]

const ATR_PERIOD = 14
const MAX_BAR_LIMIT = 500
const BYBIT_REQUEST_LIMIT = 200
const ATR_BOUNDS = { min: 0.5, max: 10 }
const MA_DISTANCE_TOO_CLOSE_THRESHOLD = 0.25

function clamp(value, min, max) {
  if (Number.isNaN(value)) {
    return min
  }
  return Math.min(Math.max(value, min), max)
}

async function fetchBybitOHLCV(symbol, interval, limit) {
  const sanitizedLimit = Math.min(Math.max(Math.floor(limit), 1), MAX_BAR_LIMIT)
  const collected = []
  let nextEndTime

  while (collected.length < sanitizedLimit) {
    const url = new URL('https://api.bybit.com/v5/market/kline')
    url.searchParams.set('category', 'linear')
    url.searchParams.set('symbol', symbol)
    url.searchParams.set('interval', interval)

    const batchLimit = Math.min(sanitizedLimit - collected.length, BYBIT_REQUEST_LIMIT)
    url.searchParams.set('limit', batchLimit.toString())

    if (nextEndTime !== undefined) {
      url.searchParams.set('end', nextEndTime.toString())
    }

    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      throw new Error(`Unable to load data (status ${response.status})`)
    }

    const payload = await response.json()

    if (payload.retCode !== 0 || !payload.result?.list) {
      throw new Error(payload.retMsg || 'Bybit API returned an error')
    }

    const candles = payload.result.list.map((entry) => ({
      openTime: Number(entry[0]),
      open: Number(entry[1]),
      high: Number(entry[2]),
      low: Number(entry[3]),
      close: Number(entry[4]),
      volume: Number(entry[5]),
      turnover: Number(entry[6] ?? 0),
      closeTime: Number(entry[0]) + 1,
    }))

    if (candles.length === 0) {
      break
    }

    collected.push(...candles)

    if (candles.length < batchLimit) {
      break
    }

    const oldestCandle = candles.reduce((oldest, candle) => (candle.openTime < oldest.openTime ? candle : oldest), candles[0])
    nextEndTime = oldestCandle.openTime - 1
  }

  const deduped = Array.from(
    collected.reduce((acc, candle) => acc.set(candle.openTime, candle), new Map()).values(),
  )

  return deduped.sort((a, b) => a.openTime - b.openTime).slice(-sanitizedLimit)
}

function getLastFiniteValue(series) {
  for (let i = series.length - 1; i >= 0; i -= 1) {
    const value = series[i]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }
  return null
}

function getPreviousFiniteValue(series) {
  let seenFinite = false
  for (let i = series.length - 1; i >= 0; i -= 1) {
    const value = series[i]
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (seenFinite) {
        return value
      }
      seenFinite = true
    }
  }
  return null
}

function averageRecentValues(series, period) {
  let count = 0
  let sum = 0

  for (let i = series.length - 1; i >= 0 && count < period; i -= 1) {
    const value = series[i]
    if (typeof value === 'number' && Number.isFinite(value)) {
      sum += value
      count += 1
    }
  }

  if (count === 0) {
    return null
  }

  return sum / count
}

function resolveBias(price, ma200) {
  if (price == null || ma200 == null) {
    return 'NEUTRAL'
  }

  const diff = price - ma200
  if (Math.abs(diff) < ma200 * 0.001) {
    return 'NEUTRAL'
  }

  return diff > 0 ? 'BULL' : 'BEAR'
}

function resolveTrendDirection(ema10, ema50) {
  if (ema10 == null || ema50 == null) {
    return 'Neutral'
  }

  if (ema10 > ema50) {
    return 'Bullish'
  }

  if (ema10 < ema50) {
    return 'Bearish'
  }

  return 'Neutral'
}

function resolveMomentumDirection(rsi, stochK, stochD) {
  if (rsi == null || stochK == null || stochD == null) {
    return 'Neutral'
  }

  const rsiBias = rsi > 52 ? 1 : rsi < 48 ? -1 : 0
  const stochBias = stochK > stochD ? 1 : stochK < stochD ? -1 : 0
  const combined = rsiBias + stochBias

  if (combined > 0) {
    return 'Bullish'
  }

  if (combined < 0) {
    return 'Bearish'
  }

  return 'Neutral'
}

function resolveStochEvent(stochRaw, prevStochRaw, stochK, stochD, prevK, prevD) {
  if (
    stochRaw == null ||
    prevStochRaw == null ||
    stochK == null ||
    stochD == null ||
    prevK == null ||
    prevD == null
  ) {
    return null
  }

  if (prevK <= prevD && stochK > stochD && prevStochRaw <= 20 && stochRaw > prevStochRaw) {
    return 'cross_up_from_oversold'
  }

  if (prevK >= prevD && stochK < stochD && prevStochRaw >= 80 && stochRaw < prevStochRaw) {
    return 'cross_down_from_overbought'
  }

  return null
}

function detectCrossDirection(fastSeries, slowSeries) {
  const length = Math.min(fastSeries.length, slowSeries.length)

  if (length < 2) {
    return null
  }

  const currentFast = fastSeries[length - 1]
  const currentSlow = slowSeries[length - 1]
  const previousFast = fastSeries[length - 2]
  const previousSlow = slowSeries[length - 2]

  if (
    currentFast == null ||
    currentSlow == null ||
    previousFast == null ||
    previousSlow == null
  ) {
    return null
  }

  const prevDiff = previousFast - previousSlow
  const currentDiff = currentFast - currentSlow

  if (prevDiff <= 0 && currentDiff > 0) {
    return 'cross_up'
  }

  if (prevDiff >= 0 && currentDiff < 0) {
    return 'cross_down'
  }

  return null
}

function resolveMovingAverageCrosses(ema10Series, ema50Series, ma200Series) {
  const crosses = []

  const emaCross = detectCrossDirection(ema10Series, ema50Series)
  if (emaCross === 'cross_up') {
    crosses.push({ pair: 'ema10-ema50', direction: 'bullish' })
  } else if (emaCross === 'cross_down') {
    crosses.push({ pair: 'ema10-ema50', direction: 'bearish' })
  }

  const ema10Ma200 = detectCrossDirection(ema10Series, ma200Series)
  if (ema10Ma200 === 'cross_up') {
    crosses.push({ pair: 'ema10-ma200', direction: 'bullish' })
  } else if (ema10Ma200 === 'cross_down') {
    crosses.push({ pair: 'ema10-ma200', direction: 'bearish' })
  }

  const ema50Ma200 = detectCrossDirection(ema50Series, ma200Series)
  if (ema50Ma200 === 'cross_up') {
    crosses.push({ pair: 'ema50-ma200', direction: 'golden' })
  } else if (ema50Ma200 === 'cross_down') {
    crosses.push({ pair: 'ema50-ma200', direction: 'death' })
  }

  return crosses
}

function resolveSignal(trend, bias, momentum, stochRaw) {
  const normalizedStoch = stochRaw == null ? null : stochRaw / 100

  const bullishSetup =
    trend === 'Bullish' &&
    momentum === 'Bullish' &&
    bias !== 'BEAR' &&
    (normalizedStoch == null || normalizedStoch <= 0.8)

  const bearishSetup =
    trend === 'Bearish' &&
    momentum === 'Bearish' &&
    bias !== 'BULL' &&
    (normalizedStoch == null || normalizedStoch >= 0.2)

  if (bullishSetup && !bearishSetup) {
    return 'LONG'
  }

  if (bearishSetup && !bullishSetup) {
    return 'SHORT'
  }

  return 'NONE'
}

function resolveStrengthLabel(trend, momentum, bias) {
  let score = 0
  if (trend === 'Bullish') score += 1
  if (trend === 'Bearish') score -= 1
  if (momentum === 'Bullish') score += 1
  if (momentum === 'Bearish') score -= 1
  if (bias === 'BULL') score += 1
  if (bias === 'BEAR') score -= 1

  const magnitude = Math.abs(score)

  if (magnitude >= 3) {
    return 'strong'
  }

  if (magnitude === 2) {
    return 'standard'
  }

  return 'weak'
}

function resolveAtrStatus(atrPct) {
  if (atrPct == null || !Number.isFinite(atrPct)) {
    return 'missing'
  }

  if (atrPct < ATR_BOUNDS.min) {
    return 'too-low'
  }

  if (atrPct > ATR_BOUNDS.max) {
    return 'too-high'
  }

  return 'ok'
}

function resolveMaDistanceStatus(distPct) {
  if (distPct == null || !Number.isFinite(distPct)) {
    return 'missing'
  }

  if (Math.abs(distPct) < MA_DISTANCE_TOO_CLOSE_THRESHOLD) {
    return 'too-close'
  }

  return 'ok'
}

function resolveStage(signal, cooldownOk, longTiming, shortTiming) {
  if (signal === 'LONG' || signal === 'SHORT') {
    return 'triggered'
  }

  if (!cooldownOk) {
    return 'cooldown'
  }

  if (!longTiming && !shortTiming) {
    return 'gated'
  }

  return 'ready'
}

function resolveVotes(trend, momentum, bias, stochRaw) {
  const breakdown = []

  const trendVote =
    trend === 'Bullish' ? 'bull' : trend === 'Bearish' ? 'bear' : trend === 'Neutral' ? 'neutral' : 'na'
  breakdown.push({ timeframe: 'trend', label: 'Trend', value: trend === 'Bullish' ? 1 : trend === 'Bearish' ? -1 : 0, vote: trendVote })

  const momentumVote =
    momentum === 'Bullish'
      ? 'bull'
      : momentum === 'Bearish'
        ? 'bear'
        : momentum === 'Neutral'
          ? 'neutral'
          : 'na'
  breakdown.push({ timeframe: 'momentum', label: 'Momentum', value: momentum === 'Bullish' ? 1 : momentum === 'Bearish' ? -1 : 0, vote: momentumVote })

  const biasVote = bias === 'BULL' ? 'bull' : bias === 'BEAR' ? 'bear' : bias === 'NEUTRAL' ? 'neutral' : 'na'
  breakdown.push({ timeframe: 'bias', label: 'Bias', value: bias === 'BULL' ? 1 : bias === 'BEAR' ? -1 : 0, vote: biasVote })

  const stochVote =
    stochRaw == null
      ? 'na'
      : stochRaw <= 40
        ? 'bull'
        : stochRaw >= 60
          ? 'bear'
          : 'neutral'
  breakdown.push({ timeframe: 'stoch', label: 'Stoch RSI', value: stochRaw ?? 0, vote: stochVote })

  let bull = 0
  let bear = 0
  let total = 0

  for (const entry of breakdown) {
    if (entry.vote === 'na') {
      continue
    }

    total += 1
    if (entry.vote === 'bull') {
      bull += 1
    } else if (entry.vote === 'bear') {
      bear += 1
    }
  }

  const mode = bull === bear ? 'all' : 'majority'

  return {
    bull,
    bear,
    total,
    mode,
    breakdown,
  }
}

function evaluateHistoricalSignals(length, closes, ema10Series, ema50Series, ma200Series, rsiSeries, stoch) {
  const signals = []

  for (let i = 0; i < length; i += 1) {
    const price = closes[i]
    const ema10 = ema10Series[i]
    const ema50 = ema50Series[i]
    const ma200 = ma200Series[i]
    const rsi = rsiSeries[i]
    const stochK = stoch.kValues[i]
    const stochD = stoch.dValues[i]
    const stochRaw = stoch.rawValues[i]

    if (
      price == null ||
      ema10 == null ||
      ema50 == null ||
      ma200 == null ||
      rsi == null ||
      stochK == null ||
      stochD == null ||
      stochRaw == null
    ) {
      signals.push('NONE')
      continue
    }

    const bias = resolveBias(price, ma200)
    const trend = resolveTrendDirection(ema10, ema50)
    const momentum = resolveMomentumDirection(rsi, stochK, stochD)
    signals.push(resolveSignal(trend, bias, momentum, stochRaw))
  }

  return signals
}

function resolveCooldown(signals) {
  const requiredBars = 3
  let barsSinceSignal = null
  let lastAlertSide = null

  for (let i = signals.length - 1; i >= 0; i -= 1) {
    const signal = signals[i]
    if (signal !== 'NONE') {
      barsSinceSignal = signals.length - 1 - i
      lastAlertSide = signal
      break
    }
  }

  const ok = barsSinceSignal == null || barsSinceSignal >= requiredBars

  return {
    requiredBars,
    barsSinceSignal,
    ok,
    lastAlertSide: lastAlertSide,
    lastExtremeMarker: null,
  }
}

function resolveGating(trend, momentum, bias) {
  const longTiming = trend === 'Bullish' && momentum === 'Bullish' && bias !== 'BEAR'
  const shortTiming = trend === 'Bearish' && momentum === 'Bearish' && bias !== 'BULL'

  const longBlockers = []
  const shortBlockers = []

  if (!longTiming) {
    if (trend !== 'Bullish') longBlockers.push('trend')
    if (momentum !== 'Bullish') longBlockers.push('momentum')
    if (bias !== 'BULL') longBlockers.push('bias')
  }

  if (!shortTiming) {
    if (trend !== 'Bearish') shortBlockers.push('trend')
    if (momentum !== 'Bearish') shortBlockers.push('momentum')
    if (bias !== 'BEAR') shortBlockers.push('bias')
  }

  return {
    long: { timing: longTiming, blockers: Array.from(new Set(longBlockers)) },
    short: { timing: shortTiming, blockers: Array.from(new Set(shortBlockers)) },
  }
}

function resolveFilters(price, ma200, atrValue, bias) {
  const atrPct = price != null && atrValue != null && price !== 0 ? (atrValue / price) * 100 : null
  const atrStatus = resolveAtrStatus(atrPct)
  const maSide = bias === 'BULL' ? 'above' : bias === 'BEAR' ? 'below' : 'unknown'
  const distPctToMa200 = price != null && ma200 != null ? ((price - ma200) / ma200) * 100 : null
  const maDistanceStatus = resolveMaDistanceStatus(distPctToMa200)

  return {
    atrPct,
    atrBounds: { ...ATR_BOUNDS },
    atrStatus,
    maSide,
    maLongOk: bias !== 'BEAR' && ma200 != null && price != null ? price >= ma200 : false,
    maShortOk: bias !== 'BULL' && ma200 != null && price != null ? price <= ma200 : false,
    distPctToMa200,
    maDistanceStatus,
    useMa200Filter: true,
  }
}

function resolveRisk(price, atrValue) {
  if (price == null || atrValue == null || !Number.isFinite(price) || !Number.isFinite(atrValue)) {
    return {
      atr: null,
      slLong: null,
      t1Long: null,
      t2Long: null,
      slShort: null,
      t1Short: null,
      t2Short: null,
    }
  }

  const atrClamped = clamp(atrValue, 0, price)

  return {
    atr: atrValue,
    slLong: price - atrClamped,
    t1Long: price + atrClamped,
    t2Long: price + atrClamped * 2,
    slShort: price + atrClamped,
    t1Short: price - atrClamped,
    t2Short: price - atrClamped * 2,
  }
}

function buildBaseSnapshot(symbol, timeframe, label) {
  return {
    entryTimeframe: timeframe,
    entryLabel: label,
    symbol,
    evaluatedAt: null,
    closedAt: null,
    bias: 'NEUTRAL',
    strength: 'weak',
    signal: 'NONE',
    stochEvent: null,
    ema: { ema10: null, ema50: null },
    movingAverageCrosses: [],
    votes: { bull: 0, bear: 0, total: 0, mode: 'all', breakdown: [] },
    stochRsi: { k: null, d: null, rawNormalized: null },
    rsiLtf: { value: null, sma5: null, okLong: false, okShort: false },
    filters: {
      atrPct: null,
      atrBounds: { ...ATR_BOUNDS },
      atrStatus: 'missing',
      maSide: 'unknown',
      maLongOk: false,
      maShortOk: false,
      distPctToMa200: null,
      maDistanceStatus: 'missing',
      useMa200Filter: true,
    },
    gating: {
      long: { timing: false, blockers: [] },
      short: { timing: false, blockers: [] },
    },
    cooldown: {
      requiredBars: 3,
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
    ma200: { value: null, slope: null },
  }
}

export async function buildLiveSnapshots(symbol) {
  const snapshots = await Promise.all(
    TIMEFRAME_CONFIGS.map(async (config) => {
      const base = buildBaseSnapshot(symbol, config.value, config.label)

      try {
        const candles = await fetchBybitOHLCV(symbol, config.value, MAX_BAR_LIMIT)

        if (!candles || candles.length === 0) {
          return base
        }

        const closes = candles.map((candle) => candle.close)

        const ema10Series = calculateEMA(closes, 10)
        const ema50Series = calculateEMA(closes, 50)
        const ma200Series = calculateSMA(closes, 200)

        const rsiSeries = calculateRSI(closes, config.rsiPeriod)
        const stoch = calculateStochasticRSI(rsiSeries, config.stoch)
        const atrSeries = calculateATR(candles, ATR_PERIOD)

        const price = closes[closes.length - 1] ?? null
        const ema10 = getLastFiniteValue(ema10Series)
        const ema50 = getLastFiniteValue(ema50Series)
        const ma200 = getLastFiniteValue(ma200Series)
        const previousMa200 = getPreviousFiniteValue(ma200Series)
        const rsiValue = getLastFiniteValue(rsiSeries)
        const rsiSma5 = averageRecentValues(rsiSeries, 5)
        const stochK = getLastFiniteValue(stoch.kValues)
        const stochD = getLastFiniteValue(stoch.dValues)
        const stochRaw = getLastFiniteValue(stoch.rawValues)
        const prevStochRaw = getPreviousFiniteValue(stoch.rawValues)
        const prevStochK = getPreviousFiniteValue(stoch.kValues)
        const prevStochD = getPreviousFiniteValue(stoch.dValues)
        const atrValue = getLastFiniteValue(atrSeries)

        const bias = resolveBias(price, ma200)
        const trend = resolveTrendDirection(ema10, ema50)
        const momentum = resolveMomentumDirection(rsiValue, stochK, stochD)
        const stochEvent = resolveStochEvent(stochRaw, prevStochRaw, stochK, stochD, prevStochK, prevStochD)
        const signal = resolveSignal(trend, bias, momentum, stochRaw)
        const strength = resolveStrengthLabel(trend, momentum, bias)

        const historicalSignals = evaluateHistoricalSignals(
          closes.length,
          closes,
          ema10Series,
          ema50Series,
          ma200Series,
          rsiSeries,
          stoch,
        )
        const cooldown = resolveCooldown(historicalSignals)
        const gating = resolveGating(trend, momentum, bias)
        const filters = resolveFilters(price, ma200, atrValue, bias)
        const risk = resolveRisk(price, atrValue)
        const votes = resolveVotes(trend, momentum, bias, stochRaw)
        const movingAverageCrosses = resolveMovingAverageCrosses(ema10Series, ema50Series, ma200Series)

        const slope =
          ma200 != null && previousMa200 != null
            ? ((ma200 - previousMa200) / previousMa200) * 100
            : null

        const stage = resolveStage(signal, cooldown.ok, gating.long.timing, gating.short.timing)

        return {
          ...base,
          evaluatedAt: candles[candles.length - 1]?.closeTime ?? Date.now(),
          bias,
          strength,
          signal,
          stochEvent,
          ema: { ema10, ema50 },
          movingAverageCrosses,
          votes,
          stochRsi: {
            k: stochK,
            d: stochD,
            rawNormalized: stochRaw != null ? stochRaw / 100 : null,
          },
          rsiLtf: {
            value: rsiValue,
            sma5: rsiSma5,
            okLong: rsiValue != null && rsiValue <= 40,
            okShort: rsiValue != null && rsiValue >= 60,
          },
          filters,
          gating,
          cooldown,
          risk,
          price,
          ma200: { value: ma200, slope },
        }
      } catch (error) {
        console.error(`Failed to compute heatmap snapshot for ${symbol} ${config.value}`, error)
        return base
      }
    }),
  )

  return snapshots
}
