import { calculateEMA, calculateRSI, calculateSMA, calculateStochasticRSI } from './indicators.js'
import { broadcastNotification, normalizeNotificationPayload } from './push-delivery.js'

function normalizeSymbol(value) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim().toUpperCase()
  return trimmed.length > 0 ? trimmed : null
}

const ENV_SYMBOLS = (process.env.PUSH_WATCH_SYMBOLS
  ? process.env.PUSH_WATCH_SYMBOLS.split(',')
  : [])
  .map((symbol) => normalizeSymbol(symbol))
  .filter(Boolean)

const MOMENTUM_TIMEFRAMES = ['5', '15', '30', '60', '120', '240', '360']
const MOVING_AVERAGE_TIMEFRAMES = ['5', '15', '30', '60', '120', '240', '360']
const MOMENTUM_INTENSITY_BY_LEVEL = {
  1: 'green',
  2: 'yellow',
  3: 'orange',
  4: 'red',
}
const MOMENTUM_EMOJI_BY_INTENSITY = {
  green: '🟢',
  yellow: '🟡',
  orange: '🟠',
  red: '🔴',
}

const DEFAULT_MOMENTUM_BOUNDS = {
  rsiLower: 20,
  rsiUpper: 80,
  stochasticLower: 20,
  stochasticUpper: 80,
}

const RSI_SETTINGS = {
  '5': { period: 8 },
  '15': { period: 11 },
  '30': { period: 13 },
  '60': { period: 15 },
  '120': { period: 17 },
  '240': { period: 20 },
  '360': { period: 23 },
}

const STOCHASTIC_SETTINGS = {
  '5': { rsiLength: 7, stochLength: 7, kSmoothing: 2, dSmoothing: 2 },
  '15': { rsiLength: 9, stochLength: 9, kSmoothing: 3, dSmoothing: 3 },
  '30': { rsiLength: 12, stochLength: 12, kSmoothing: 3, dSmoothing: 3 },
  '60': { rsiLength: 14, stochLength: 14, kSmoothing: 3, dSmoothing: 3 },
  '120': { rsiLength: 16, stochLength: 16, kSmoothing: 3, dSmoothing: 3 },
  '240': { rsiLength: 21, stochLength: 21, kSmoothing: 4, dSmoothing: 4 },
  '360': { rsiLength: 24, stochLength: 24, kSmoothing: 4, dSmoothing: 4 },
}

const DEFAULT_STOCHASTIC_SETTING = { rsiLength: 14, stochLength: 14, kSmoothing: 3, dSmoothing: 3 }
const MOVING_AVERAGE_PAIRS = [
  { pairLabel: 'EMA 10 / EMA 50', intensity: 'green', tag: 'ema10-ema50' },
  { pairLabel: 'EMA 10 / MA 200', intensity: 'yellow', tag: 'ema10-ma200' },
  { pairLabel: 'EMA 50 / MA 200', intensity: 'orange', tag: 'ema50-ma200' },
]

const MAX_BAR_LIMIT = 5000
const BYBIT_REQUEST_LIMIT = 200
const MOMENTUM_BAR_LIMIT = 400
const MOVING_AVERAGE_BAR_LIMIT = 400
const SHARED_BAR_LIMIT = Math.max(MOMENTUM_BAR_LIMIT, MOVING_AVERAGE_BAR_LIMIT)
const POLL_INTERVAL_MS = Number.parseInt(process.env.PUSH_MARKET_WATCH_INTERVAL_MS ?? '60000', 10)
const ENABLED = (process.env.PUSH_ENABLE_MARKET_WATCH ?? 'true').toLowerCase() !== 'false'

function formatIntervalLabel(value) {
  const mapping = {
    5: '5m',
    15: '15m',
    30: '30m',
    60: '60m',
    120: '120m',
    240: '240m (4h)',
    360: '360m (6h)',
  }
  return mapping[value] ?? `${value}m`
}

function detectLatestCross(fast, slow) {
  const length = Math.min(fast.length, slow.length)

  for (let i = length - 1; i >= 1; i -= 1) {
    const prevFast = fast[i - 1]
    const prevSlow = slow[i - 1]
    const currentFast = fast[i]
    const currentSlow = slow[i]

    if (prevFast == null || prevSlow == null || currentFast == null || currentSlow == null) {
      continue
    }

    const previousDifference = prevFast - prevSlow
    const currentDifference = currentFast - currentSlow

    const crossedUp = previousDifference < 0 && currentDifference >= 0
    const crossedDown = previousDifference > 0 && currentDifference <= 0

    if (crossedUp) {
      return { index: i, direction: 'golden' }
    }

    if (crossedDown) {
      return { index: i, direction: 'death' }
    }
  }

  return null
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

    const oldestCandle = candles.reduce((oldest, candle) =>
      candle.openTime < oldest.openTime ? candle : oldest,
    candles[0])

    nextEndTime = oldestCandle.openTime - 1
  }

  const deduped = Array.from(
    collected.reduce((acc, candle) => acc.set(candle.openTime, candle), new Map()).values(),
  )

  return deduped.sort((a, b) => a.openTime - b.openTime).slice(-sanitizedLimit)
}

function summarizeReadings(readings, selector) {
  return readings.map((reading) => `${reading.timeframeLabel} ${selector(reading)}`).join(' • ')
}

function formatPrice(price) {
  return Number.isFinite(price) ? price.toFixed(5) : String(price)
}

function logNotification(message, details) {
  console.log(`[market-watch] ${message}`, details)
}

export function startMarketWatch({ store }) {
  if (!ENABLED) {
    console.log('Market watch is disabled. Set PUSH_ENABLE_MARKET_WATCH=true to enable server-side alerts.')
    return () => {}
  }

  if (!store) {
    throw new Error('startMarketWatch requires a push subscription store')
  }

  let running = false
  const momentumSignatures = new Map()
  const movingAverageSignatures = new Map()
  const allTimeframes = Array.from(new Set([...MOMENTUM_TIMEFRAMES, ...MOVING_AVERAGE_TIMEFRAMES]))

  function collectSymbols() {
    const seen = new Set()
    const ordered = []

    const addSymbol = (value) => {
      const normalized = normalizeSymbol(value)
      if (!normalized || seen.has(normalized)) {
        return
      }
      seen.add(normalized)
      ordered.push(normalized)
    }

    for (const symbol of ENV_SYMBOLS) {
      addSymbol(symbol)
    }

    for (const entry of store.list()) {
      const filters = entry.filters
      if (!filters || !Array.isArray(filters.symbols)) {
        continue
      }

      for (const symbol of filters.symbols) {
        addSymbol(symbol)
      }
    }

    return ordered
  }

  function haveSameSymbols(previous, next) {
    if (previous.length !== next.length) {
      return false
    }

    return previous.every((symbol, index) => symbol === next[index])
  }

  let trackedSymbols = collectSymbols()

  async function evaluateSymbol(symbol) {
    const candleCache = new Map()

    async function loadCandles(timeframe, limit) {
      const key = `${timeframe}-${limit}`
      if (candleCache.has(key)) {
        return candleCache.get(key)
      }
      const candles = await fetchBybitOHLCV(symbol, timeframe, limit)
      candleCache.set(key, candles)
      return candles
    }

    await Promise.all(allTimeframes.map((timeframe) => loadCandles(timeframe, SHARED_BAR_LIMIT)))

    await evaluateMomentum(symbol, candleCache)
    await evaluateMovingAverages(symbol, candleCache)
  }

  async function evaluateMomentum(symbol, candleCache) {
    const bounds = {
      longRsi: Math.min(DEFAULT_MOMENTUM_BOUNDS.rsiLower, DEFAULT_MOMENTUM_BOUNDS.rsiUpper),
      shortRsi: Math.max(DEFAULT_MOMENTUM_BOUNDS.rsiLower, DEFAULT_MOMENTUM_BOUNDS.rsiUpper),
      longStochastic: Math.min(
        DEFAULT_MOMENTUM_BOUNDS.stochasticLower,
        DEFAULT_MOMENTUM_BOUNDS.stochasticUpper,
      ),
      shortStochastic: Math.max(
        DEFAULT_MOMENTUM_BOUNDS.stochasticLower,
        DEFAULT_MOMENTUM_BOUNDS.stochasticUpper,
      ),
    }

    const timeframeResults = []

    for (const timeframe of MOMENTUM_TIMEFRAMES) {
      const candles = candleCache.get(`${timeframe}-${SHARED_BAR_LIMIT}`)
      if (!candles || candles.length === 0) {
        timeframeResults.push(null)
        continue
      }

      const latest = candles[candles.length - 1]
      if (!latest) {
        timeframeResults.push(null)
        continue
      }

      const closes = candles.map((candle) => candle.close)
      const rsiSetting = RSI_SETTINGS[timeframe] ?? { period: 14 }
      const stochasticSetting = STOCHASTIC_SETTINGS[timeframe] ?? DEFAULT_STOCHASTIC_SETTING

      const rsiValues = calculateRSI(closes, rsiSetting.period)
      const stochasticRsiValues = calculateRSI(closes, stochasticSetting.rsiLength)
      const stochasticSeries = calculateStochasticRSI(stochasticRsiValues, {
        stochLength: stochasticSetting.stochLength,
        kSmoothing: stochasticSetting.kSmoothing,
        dSmoothing: stochasticSetting.dSmoothing,
      })

      const latestRsi = rsiValues[rsiValues.length - 1]
      const latestStochasticD = stochasticSeries.dValues[stochasticSeries.dValues.length - 1]
      const timeframeLabel = formatIntervalLabel(timeframe)

      if (typeof latestRsi !== 'number' || typeof latestStochasticD !== 'number') {
        timeframeResults.push(null)
        continue
      }

      const isLongTrigger = latestRsi < bounds.longRsi && latestStochasticD < bounds.longStochastic
      const isShortTrigger = latestRsi > bounds.shortRsi && latestStochasticD > bounds.shortStochastic

      let direction = null
      if (isLongTrigger) {
        direction = 'long'
      } else if (isShortTrigger) {
        direction = 'short'
      }

      timeframeResults.push({
        timeframe,
        timeframeLabel,
        rsi: latestRsi,
        stochasticD: latestStochasticD,
        openTime: latest.openTime,
        direction,
      })
    }

    const primary = timeframeResults[0]

    if (!primary || !primary.direction) {
      return
    }

    const matchingReadings = []
    for (const result of timeframeResults) {
      if (!result || result.direction !== primary.direction) {
        break
      }
      matchingReadings.push(result)
    }

    const intensityLevel = Math.min(matchingReadings.length, 4)
    const intensity = MOMENTUM_INTENSITY_BY_LEVEL[intensityLevel]

    if (!intensity) {
      return
    }

    const signatureParts = matchingReadings.map((reading) => `${reading.timeframe}:${reading.openTime ?? '0'}`)
    const signature = `${symbol}-${primary.direction}-${signatureParts.join('|')}`

    if (momentumSignatures.get(symbol) === signature) {
      return
    }

    momentumSignatures.set(symbol, signature)

    const readings = matchingReadings.map(({ timeframe, timeframeLabel, rsi, stochasticD, openTime }) => ({
      timeframe,
      timeframeLabel,
      rsi,
      stochasticD,
      openTime,
    }))

    const timeframeSummary = readings.map((reading) => reading.timeframeLabel).join(' • ')
    const rsiSummary = summarizeReadings(readings, (reading) => reading.rsi.toFixed(2))
    const stochasticSummary = summarizeReadings(readings, (reading) => reading.stochasticD.toFixed(2))
    const directionLabel = primary.direction === 'long' ? 'Long' : 'Short'
    const momentumLabel = `${directionLabel} momentum ${timeframeSummary} Rsi ${rsiSummary} Stoch Rsi (stochastic rsi %d ${stochasticSummary})`
    const emoji = MOMENTUM_EMOJI_BY_INTENSITY[intensity]

    const payload = normalizeNotificationPayload({
      title: `${emoji} ${momentumLabel}`,
      body: `${symbol} — Rsi ${rsiSummary} • Stoch Rsi (stochastic rsi %d ${stochasticSummary})`,
      tag: signature,
      data: {
        symbol,
        direction: primary.direction,
        timeframes: readings.map((reading) => reading.timeframe),
        type: 'momentum',
        source: 'server',
      },
    })

    if (!payload) {
      return
    }

    await broadcastNotification(store, payload)
    logNotification('Momentum alert delivered', { symbol, signature, intensity })
  }

  async function evaluateMovingAverages(symbol, candleCache) {
    for (const timeframe of MOVING_AVERAGE_TIMEFRAMES) {
      const candles = candleCache.get(`${timeframe}-${SHARED_BAR_LIMIT}`)

      if (!candles || candles.length === 0) {
        continue
      }

      const closes = candles.map((candle) => candle.close)
      const ema10 = calculateEMA(closes, 10)
      const ema50 = calculateEMA(closes, 50)
      const sma200 = calculateSMA(closes, 200)

      const seriesByKey = {
        'ema10-ema50': { fast: ema10, slow: ema50 },
        'ema10-ma200': { fast: ema10, slow: sma200 },
        'ema50-ma200': { fast: ema50, slow: sma200 },
      }

      for (const config of MOVING_AVERAGE_PAIRS) {
        const pairSeries = seriesByKey[config.tag]
        if (!pairSeries) {
          continue
        }

        const cross = detectLatestCross(pairSeries.fast, pairSeries.slow)
        if (!cross || cross.index !== candles.length - 1) {
          continue
        }

        const candle = candles[cross.index]
        if (!candle) {
          continue
        }

        const price = candle.close
        if (!Number.isFinite(price)) {
          continue
        }

        const timeframeLabel = formatIntervalLabel(timeframe)
        const directionLabel = cross.direction === 'golden' ? 'Golden cross' : 'Death cross'
        const key = `${symbol}-${timeframe}-${config.tag}`
        const signature = `${key}-${cross.direction}-${candle.openTime}`

        if (movingAverageSignatures.get(key) === signature) {
          continue
        }

        movingAverageSignatures.set(key, signature)

        const emoji = MOMENTUM_EMOJI_BY_INTENSITY[config.intensity]
        const priceLabel = formatPrice(price)
        const bodyDirection = directionLabel.toLowerCase()

        const payload = normalizeNotificationPayload({
          title: `${emoji} ${symbol} ${timeframeLabel} ${directionLabel}`,
          body: `${config.pairLabel} ${bodyDirection} at ${priceLabel}`,
          tag: signature,
          data: {
            symbol,
            timeframe,
            pair: config.tag,
            direction: cross.direction,
            type: 'moving-average',
            source: 'server',
          },
        })

        if (!payload) {
          continue
        }

        await broadcastNotification(store, payload)
        logNotification('Moving average cross alert delivered', { symbol, timeframe, pair: config.tag, signature })
      }
    }
  }

  async function tick() {
    if (running) {
      return
    }

    running = true

    try {
      const nextSymbols = collectSymbols()

      if (!haveSameSymbols(trackedSymbols, nextSymbols)) {
        trackedSymbols = nextSymbols
        console.log(
          `[market-watch] Symbol watch list updated: ${
            trackedSymbols.length > 0 ? trackedSymbols.join(', ') : 'none'
          }`,
        )
      }

      if (trackedSymbols.length === 0) {
        return
      }

      for (const symbol of trackedSymbols) {
        try {
          await evaluateSymbol(symbol)
        } catch (symbolError) {
          console.error(`[market-watch] Failed to evaluate ${symbol}`, symbolError)
        }
      }
    } finally {
      running = false
    }
  }

  void tick()

  const interval = setInterval(() => {
    void tick()
  }, Number.isFinite(POLL_INTERVAL_MS) && POLL_INTERVAL_MS > 0 ? POLL_INTERVAL_MS : 60000)

  console.log(
    `Market watch started for ${
      trackedSymbols.length > 0 ? trackedSymbols.join(', ') : 'none'
    } (interval: ${
      Number.isFinite(POLL_INTERVAL_MS) && POLL_INTERVAL_MS > 0 ? POLL_INTERVAL_MS : 60000
    }ms)`
  )

  return () => clearInterval(interval)
}
