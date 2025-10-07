import { URL } from 'node:url'

const DEFAULT_SYMBOL = 'BTCUSDT'

const BENCHMARK_PRICE_BY_BASE = {
  BTC: 30000,
  ETH: 2100,
  BNB: 305,
  SOL: 95,
  XRP: 0.65,
  DOGE: 0.078,
  ADA: 0.38,
  MATIC: 0.92,
  LTC: 85,
  AVAX: 36,
  DOT: 5.7,
  LINK: 7.4,
}

const QUOTE_SUFFIXES = ['USDT', 'USDC', 'USD', 'BTC', 'ETH']
const DEFAULT_PRICE = BENCHMARK_PRICE_BY_BASE.BTC

const MAX_BAR_LIMIT = 5000
const BYBIT_REQUEST_LIMIT = 200
const ATR_BOUNDS = { min: 0.8, max: 4 }
const MA_DISTANCE_THRESHOLD = 0.5

function roundTo(value, precision = 2) {
  if (!Number.isFinite(value)) {
    return null
  }

  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

function sliceFinite(values) {
  return values.filter((value) => Number.isFinite(value))
}

function formatPrice(value) {
  if (!Number.isFinite(value)) {
    return value
  }

  return value >= 1 ? roundTo(value, 2) : roundTo(value, 6)
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
      headers: {
        Accept: 'application/json',
      },
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

    const oldestCandle = candles.reduce(
      (oldest, candle) => (candle.openTime < oldest.openTime ? candle : oldest),
      candles[0],
    )

    nextEndTime = oldestCandle.openTime - 1
  }

  const deduped = Array.from(
    collected.reduce((acc, candle) => acc.set(candle.openTime, candle), new Map()).values(),
  )

  return deduped.sort((a, b) => a.openTime - b.openTime).slice(-sanitizedLimit)
}

function computeEMA(values, period) {
  const data = sliceFinite(values)
  if (data.length === 0) {
    return null
  }

  const effectiveLength = Math.min(data.length, Math.max(period * 3, period + 1))
  const sample = data.slice(-effectiveLength)

  let ema = sample[0]
  const multiplier = 2 / (period + 1)

  for (let i = 1; i < sample.length; i += 1) {
    ema = sample[i] * multiplier + ema * (1 - multiplier)
  }

  return Number.isFinite(ema) ? ema : null
}

function computeSMAWithOffset(values, period, offset = 0) {
  const endIndex = values.length - offset
  if (endIndex < period || endIndex <= 0) {
    return null
  }

  const slice = values.slice(endIndex - period, endIndex)
  const filtered = sliceFinite(slice)

  if (filtered.length !== period) {
    return null
  }

  const sum = filtered.reduce((total, value) => total + value, 0)
  return sum / filtered.length
}

function computeATR(candles, period) {
  if (!Array.isArray(candles) || candles.length < period + 1) {
    return null
  }

  const trueRanges = []
  for (let i = 1; i < candles.length; i += 1) {
    const current = candles[i]
    const previous = candles[i - 1]

    if (!current || !previous) {
      continue
    }

    const highLow = current.high - current.low
    const highClose = Math.abs(current.high - previous.close)
    const lowClose = Math.abs(current.low - previous.close)

    trueRanges.push(Math.max(highLow, highClose, lowClose))
  }

  if (trueRanges.length < period) {
    return null
  }

  const window = trueRanges.slice(-period)
  const sum = window.reduce((total, value) => total + value, 0)
  return sum / window.length
}

function computeRSISeries(values, period) {
  if (!Array.isArray(values) || values.length < period + 1) {
    return []
  }

  const filtered = sliceFinite(values)
  if (filtered.length < period + 1) {
    return []
  }

  const rsis = []
  let gainSum = 0
  let lossSum = 0

  for (let i = 1; i <= period; i += 1) {
    const change = filtered[i] - filtered[i - 1]
    if (change >= 0) {
      gainSum += change
    } else {
      lossSum -= change
    }
  }

  let avgGain = gainSum / period
  let avgLoss = lossSum / period

  const computeRsiFromAverages = (gain, loss) => {
    if (loss === 0) {
      return 100
    }

    const rs = gain / loss
    return 100 - 100 / (1 + rs)
  }

  rsis.push(computeRsiFromAverages(avgGain, avgLoss))

  for (let i = period + 1; i < filtered.length; i += 1) {
    const change = filtered[i] - filtered[i - 1]
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? -change : 0

    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period

    rsis.push(computeRsiFromAverages(avgGain, avgLoss))
  }

  return rsis
}

function smoothSeries(values, period) {
  if (!Array.isArray(values) || values.length === 0 || period <= 0) {
    return []
  }

  const smoothed = []
  for (let i = 0; i < values.length; i += 1) {
    const start = Math.max(0, i - period + 1)
    const window = values.slice(start, i + 1)
    const filtered = sliceFinite(window)

    if (filtered.length === window.length && filtered.length > 0) {
      const sum = filtered.reduce((total, value) => total + value, 0)
      smoothed.push(sum / filtered.length)
    }
  }

  return smoothed
}

function computeStochRsi(rsiSeries, stochPeriod = 14, smoothK = 3, smoothD = 3) {
  if (!Array.isArray(rsiSeries) || rsiSeries.length < stochPeriod) {
    return { rawNormalized: null, k: null, d: null }
  }

  const stochValues = []
  for (let i = stochPeriod - 1; i < rsiSeries.length; i += 1) {
    const window = rsiSeries.slice(i - stochPeriod + 1, i + 1)
    const min = Math.min(...window)
    const max = Math.max(...window)
    const denominator = max - min

    const raw = denominator === 0 ? 0 : (rsiSeries[i] - min) / denominator
    stochValues.push(raw)
  }

  const kSeries = smoothSeries(stochValues, smoothK)
  const dSeries = smoothSeries(kSeries, smoothD)

  const rawNormalized = stochValues.length > 0 ? stochValues[stochValues.length - 1] : null
  const k = kSeries.length > 0 ? kSeries[kSeries.length - 1] * 100 : null
  const d = dSeries.length > 0 ? dSeries[dSeries.length - 1] * 100 : null

  return {
    rawNormalized: rawNormalized != null ? rawNormalized : null,
    k: k != null ? k : null,
    d: d != null ? d : null,
  }
}

function deriveFiltersFromMetrics(metrics) {
  const atrPct = Number.isFinite(metrics.atrPct) ? roundTo(metrics.atrPct, 2) : null
  const atrStatus =
    atrPct == null
      ? 'missing'
      : atrPct < ATR_BOUNDS.min
      ? 'too-low'
      : atrPct > ATR_BOUNDS.max
      ? 'too-high'
      : 'ok'

  const maSide = metrics.maSide || 'unknown'
  const distPctToMa200 = Number.isFinite(metrics.distPctToMa200)
    ? roundTo(metrics.distPctToMa200, 2)
    : null

  let maDistanceStatus = 'missing'
  if (distPctToMa200 != null) {
    maDistanceStatus = Math.abs(distPctToMa200) >= MA_DISTANCE_THRESHOLD ? 'ok' : 'too-close'
  }

  return {
    atrPct,
    atrBounds: ATR_BOUNDS,
    atrStatus,
    maSide,
    maLongOk: metrics.maLongOk ?? false,
    maShortOk: metrics.maShortOk ?? false,
    distPctToMa200,
    maDistanceStatus,
    useMa200Filter: true,
  }
}

function deriveRiskFromMetrics(price, atr) {
  if (!Number.isFinite(price)) {
    return {
      atr: atr != null && Number.isFinite(atr) ? roundTo(atr, 2) : null,
      slLong: null,
      t1Long: null,
      t2Long: null,
      slShort: null,
      t1Short: null,
      t2Short: null,
    }
  }

  if (!Number.isFinite(atr) || atr <= 0) {
    return {
      atr: atr != null && Number.isFinite(atr) ? roundTo(atr, 2) : null,
      slLong: null,
      t1Long: null,
      t2Long: null,
      slShort: null,
      t1Short: null,
      t2Short: null,
    }
  }

  const stopDistance = atr * 1.5
  const targetDistance = atr * 3

  return {
    atr: roundTo(atr, 2),
    slLong: roundTo(price - stopDistance, 2),
    t1Long: roundTo(price + stopDistance, 2),
    t2Long: roundTo(price + targetDistance, 2),
    slShort: roundTo(price + stopDistance, 2),
    t1Short: roundTo(price - stopDistance, 2),
    t2Short: roundTo(price - targetDistance, 2),
  }
}

function computeMarketMetrics(candles) {
  const closes = candles.map((candle) => candle.close)
  const price = closes.length > 0 ? closes[closes.length - 1] : null

  const ema10 = computeEMA(closes, 10)
  const ema50 = computeEMA(closes, 50)
  const ma200 = computeSMAWithOffset(closes, 200, 0)
  const ma200Previous = computeSMAWithOffset(closes, 200, 5)
  const ma200Slope =
    Number.isFinite(ma200) && Number.isFinite(ma200Previous) ? ma200 - ma200Previous : null

  const atr = computeATR(candles, 14)
  const atrPct = Number.isFinite(atr) && Number.isFinite(price) && price !== 0 ? (atr / price) * 100 : null

  const maSide = Number.isFinite(price) && Number.isFinite(ma200) ? (price >= ma200 ? 'above' : 'below') : 'unknown'
  const maLongOk = maSide === 'above'
  const maShortOk = maSide === 'below'
  const distPctToMa200 =
    Number.isFinite(price) && Number.isFinite(ma200) && ma200 !== 0
      ? ((price - ma200) / ma200) * 100
      : null

  const rsiSeries = computeRSISeries(closes, 14)
  const rsi = rsiSeries.length > 0 ? rsiSeries[rsiSeries.length - 1] : null
  const rsiSma5 = (() => {
    if (rsiSeries.length < 5) {
      return null
    }
    const window = rsiSeries.slice(-5)
    const filtered = sliceFinite(window)
    if (filtered.length !== window.length) {
      return null
    }
    const sum = filtered.reduce((total, value) => total + value, 0)
    return sum / filtered.length
  })()

  const { rawNormalized, k, d } = computeStochRsi(rsiSeries)

  return {
    price,
    ema10,
    ema50,
    ma200,
    ma200Slope,
    atr,
    atrPct,
    maSide,
    maLongOk,
    maShortOk,
    distPctToMa200,
    rsi,
    rsiSma5,
    stochRsi: {
      rawNormalized,
      k,
      d,
    },
  }
}

function resolveMockPrice(symbol) {
  if (typeof symbol !== 'string') {
    return DEFAULT_PRICE
  }

  const normalized = symbol.trim().toUpperCase()
  if (!normalized) {
    return DEFAULT_PRICE
  }

  if (BENCHMARK_PRICE_BY_BASE[normalized] != null) {
    return BENCHMARK_PRICE_BY_BASE[normalized]
  }

  const matchingQuote = QUOTE_SUFFIXES.find((suffix) => normalized.endsWith(suffix))
  const base = matchingQuote ? normalized.slice(0, -matchingQuote.length) : normalized

  if (!base) {
    return DEFAULT_PRICE
  }

  if (BENCHMARK_PRICE_BY_BASE[base] != null) {
    return BENCHMARK_PRICE_BY_BASE[base]
  }

  const asciiSum = base.split('').reduce((total, char) => total + char.charCodeAt(0), 0)

  let scale
  if (base.length >= 5) {
    scale = 10000
  } else if (base.length === 4) {
    scale = 1000
  } else if (base.length === 3) {
    scale = 50
  } else if (base.length === 2) {
    scale = 5
  } else {
    scale = 1
  }

  const fallback = asciiSum / scale

  if (fallback >= 1) {
    return Number(fallback.toFixed(2))
  }

  return Number(fallback.toFixed(4))
}
const MOCK_TIMEFRAMES = [
  {
    timeframe: '5',
    label: '5m',
    template: {
      bias: 'BULL',
      signal: 'NONE',
      gating: {
        long: { timing: true, blockers: [] },
        short: { timing: false, blockers: ['bias'] },
      },
      cooldown: {
        requiredBars: 2,
        barsSinceSignal: 5,
        ok: true,
        lastAlertSide: 'LONG',
        lastExtremeMarker: null,
      },
      stochEvent: 'cross_up_from_oversold',
    },
  },
  {
    timeframe: '15',
    label: '15m',
    template: {
      bias: 'BULL',
      signal: 'LONG',
      gating: {
        long: { timing: true, blockers: [] },
        short: { timing: false, blockers: ['bias'] },
      },
      cooldown: {
        requiredBars: 3,
        barsSinceSignal: 0,
        ok: true,
        lastAlertSide: 'LONG',
        lastExtremeMarker: null,
      },
      stochEvent: 'cross_up_from_oversold',
    },
  },
  {
    timeframe: '60',
    label: '1h',
    template: {
      bias: 'BULL',
      signal: 'NONE',
      gating: {
        long: { timing: false, blockers: ['200 MA misalignment'] },
        short: { timing: false, blockers: ['bias'] },
      },
      cooldown: {
        requiredBars: 4,
        barsSinceSignal: 2,
        ok: true,
        lastAlertSide: 'LONG',
        lastExtremeMarker: null,
      },
      stochEvent: null,
    },
  },
  {
    timeframe: '240',
    label: '4h',
    template: {
      bias: 'BEAR',
      signal: 'NONE',
      gating: {
        long: { timing: false, blockers: ['bias'] },
        short: { timing: true, blockers: [] },
      },
      cooldown: {
        requiredBars: 6,
        barsSinceSignal: 1,
        ok: false,
        lastAlertSide: 'SHORT',
        lastExtremeMarker: 'shortExtremeSeen',
      },
      stochEvent: null,
    },
  },
]

const MOCK_BREAKDOWN = [
  { timeframe: '5', label: '5m', value: 3, vote: 'bull' },
  { timeframe: '15', label: '15m', value: 4, vote: 'bull' },
  { timeframe: '60', label: '1h', value: 2, vote: 'neutral' },
  { timeframe: '240', label: '4h', value: 1, vote: 'bear' },
]

function buildMockSnapshot(symbol, timeframe, label, template, basePrice) {
  const price = basePrice ?? resolveMockPrice(symbol)
  const evaluatedAt = Date.now()

  return {
    entryTimeframe: timeframe,
    entryLabel: label,
    symbol,
    evaluatedAt,
    closedAt: null,
    bias: template.bias,
    strength: 'standard',
    signal: template.signal,
    stochEvent: template.stochEvent,
    ema: {
      ema10: price * 0.998,
      ema50: price * 0.99,
    },
    votes: {
      bull: 6,
      bear: 2,
      total: 8,
      mode: 'all',
      breakdown: MOCK_BREAKDOWN,
    },
    stochRsi: {
      k: 68,
      d: 55,
      rawNormalized: 0.72,
    },
    rsiLtf: {
      value: 57,
      sma5: 54,
      okLong: true,
      okShort: false,
    },
    filters: {
      atrPct: 1.4,
      atrBounds: { ...ATR_BOUNDS },
      atrStatus: 'ok',
      maSide: 'above',
      maLongOk: true,
      maShortOk: false,
      distPctToMa200: 4.2,
      maDistanceStatus: 'ok',
      useMa200Filter: true,
    },
    gating: template.gating,
    cooldown: template.cooldown,
    risk: {
      atr: 220,
      slLong: price - 450,
      t1Long: price + 420,
      t2Long: price + 780,
      slShort: price + 450,
      t1Short: price - 420,
      t2Short: price - 780,
    },
    price,
    ma200: {
      value: price * 0.985,
      slope: 12,
    },
  }
}

function applyMarketMetricsToSnapshot(snapshot, metrics) {
  if (!metrics) {
    return snapshot
  }

  const hasMarketData = [
    metrics.price,
    metrics.ema10,
    metrics.ema50,
    metrics.ma200,
    metrics.atr,
    metrics.rsi,
    metrics.stochRsi?.k,
    metrics.stochRsi?.d,
  ].some((value) => Number.isFinite(value))

  if (!hasMarketData) {
    return snapshot
  }

  const price = Number.isFinite(metrics.price) ? formatPrice(metrics.price) : snapshot.price
  const ema10 = Number.isFinite(metrics.ema10) ? formatPrice(metrics.ema10) : snapshot.ema.ema10
  const ema50 = Number.isFinite(metrics.ema50) ? formatPrice(metrics.ema50) : snapshot.ema.ema50
  const ma200Value = Number.isFinite(metrics.ma200) ? formatPrice(metrics.ma200) : snapshot.ma200.value
  const ma200Slope = Number.isFinite(metrics.ma200Slope) ? roundTo(metrics.ma200Slope, 2) : snapshot.ma200.slope

  const filters = deriveFiltersFromMetrics(metrics)
  const risk = deriveRiskFromMetrics(price, metrics.atr)

  const rsiValue = Number.isFinite(metrics.rsi) ? roundTo(metrics.rsi, 2) : snapshot.rsiLtf.value
  const rsiSma5 = Number.isFinite(metrics.rsiSma5) ? roundTo(metrics.rsiSma5, 2) : snapshot.rsiLtf.sma5
  const stochRsi = {
    k: Number.isFinite(metrics.stochRsi?.k) ? roundTo(metrics.stochRsi.k, 2) : snapshot.stochRsi.k,
    d: Number.isFinite(metrics.stochRsi?.d) ? roundTo(metrics.stochRsi.d, 2) : snapshot.stochRsi.d,
    rawNormalized:
      Number.isFinite(metrics.stochRsi?.rawNormalized)
        ? roundTo(metrics.stochRsi.rawNormalized, 4)
        : snapshot.stochRsi.rawNormalized,
  }

  return {
    ...snapshot,
    price,
    ema: {
      ema10,
      ema50,
    },
    filters,
    risk,
    stochRsi,
    rsiLtf: {
      value: rsiValue,
      sma5: rsiSma5,
      okLong: Number.isFinite(rsiValue) ? rsiValue > 30 && rsiValue < 70 : snapshot.rsiLtf.okLong,
      okShort: Number.isFinite(rsiValue) ? rsiValue > 70 : snapshot.rsiLtf.okShort,
    },
    ma200: {
      value: ma200Value,
      slope: ma200Slope,
    },
  }
}

async function buildSnapshotsFromBybit(symbol) {
  const limit = 600

  const snapshots = await Promise.all(
    MOCK_TIMEFRAMES.map(async ({ timeframe, label, template }) => {
      try {
        const candles = await fetchBybitOHLCV(symbol, timeframe, limit)

        if (!Array.isArray(candles) || candles.length === 0) {
          return buildMockSnapshot(symbol, timeframe, label, template)
        }

        const metrics = computeMarketMetrics(candles)
        const baseSnapshot = buildMockSnapshot(symbol, timeframe, label, template, metrics.price)
        return applyMarketMetricsToSnapshot(baseSnapshot, metrics)
      } catch (error) {
        console.error('Failed to load Bybit OHLC data', { symbol, timeframe, error })
        return buildMockSnapshot(symbol, timeframe, label, template)
      }
    }),
  )

  return snapshots
}

function normalizeSymbol(symbol) {
  if (typeof symbol !== 'string') {
    return DEFAULT_SYMBOL
  }

  const trimmed = symbol.trim().toUpperCase()
  return trimmed.length > 0 ? trimmed : DEFAULT_SYMBOL
}

function resolveUpstreamBase() {
  return process.env.HEATMAP_SERVICE_URL || process.env.VITE_HEATMAP_API_URL || null
}

function buildUpstreamUrl(base, symbol) {
  let url

  try {
    url = new URL(base)
  } catch {
    const normalizedBase = base.startsWith('/') ? base : `/${base}`
    url = new URL(normalizedBase, 'http://localhost')
  }

  if (!url.searchParams.has('symbol')) {
    url.searchParams.set('symbol', symbol)
  } else if (symbol) {
    url.searchParams.set('symbol', symbol)
  }

  return url
}

async function fetchUpstreamSnapshots(symbol) {
  const base = resolveUpstreamBase()
  if (!base) {
    return null
  }

  try {
    const url = buildUpstreamUrl(base, symbol)
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      throw new Error(`Upstream responded with status ${response.status}`)
    }

    const payload = await response.json()

    if (Array.isArray(payload)) {
      return payload
    }

    if (payload && typeof payload === 'object' && Array.isArray(payload.results)) {
      return payload.results
    }

    return []
  } catch (error) {
    console.error('Failed to fetch heatmap snapshots from upstream', error)
    return null
  }
}

export async function getHeatmapSnapshots(rawSymbol) {
  const symbol = normalizeSymbol(rawSymbol)

  const upstreamResults = await fetchUpstreamSnapshots(symbol)
  if (Array.isArray(upstreamResults)) {
    return upstreamResults
  }

  return buildSnapshotsFromBybit(symbol)
}
