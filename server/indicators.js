const DEFAULT_PERIOD = 14

export function calculateRSI(values, period = DEFAULT_PERIOD) {
  const result = new Array(values.length).fill(null)

  if (values.length <= period) {
    return result
  }

  let gains = 0
  let losses = 0

  for (let i = 1; i <= period; i += 1) {
    const difference = values[i] - values[i - 1]
    if (difference >= 0) {
      gains += difference
    } else {
      losses -= difference
    }
  }

  let averageGain = gains / period
  let averageLoss = losses / period

  result[period] = computeRS(averageGain, averageLoss)

  for (let i = period + 1; i < values.length; i += 1) {
    const difference = values[i] - values[i - 1]
    const gain = difference > 0 ? difference : 0
    const loss = difference < 0 ? -difference : 0

    averageGain = ((averageGain * (period - 1)) + gain) / period
    averageLoss = ((averageLoss * (period - 1)) + loss) / period

    result[i] = computeRS(averageGain, averageLoss)
  }

  return result
}

export function calculateEMA(values, period) {
  const normalizedPeriod = Math.max(1, Math.floor(period))
  const result = new Array(values.length).fill(null)

  if (values.length < normalizedPeriod) {
    return result
  }

  let sum = 0
  for (let i = 0; i < normalizedPeriod; i += 1) {
    sum += values[i]
  }

  let previousEma = sum / normalizedPeriod
  result[normalizedPeriod - 1] = previousEma

  const multiplier = 2 / (normalizedPeriod + 1)

  for (let i = normalizedPeriod; i < values.length; i += 1) {
    const value = values[i]
    previousEma = (value - previousEma) * multiplier + previousEma
    result[i] = previousEma
  }

  return result
}

export function calculateSMA(values, period) {
  const normalizedPeriod = Math.max(1, Math.floor(period))
  const result = new Array(values.length).fill(null)

  if (values.length < normalizedPeriod) {
    return result
  }

  let windowSum = 0

  for (let i = 0; i < values.length; i += 1) {
    windowSum += values[i]

    if (i >= normalizedPeriod) {
      windowSum -= values[i - normalizedPeriod]
    }

    if (i >= normalizedPeriod - 1) {
      result[i] = windowSum / normalizedPeriod
    }
  }

  return result
}

export function calculateStochasticRSI(rsiValues, options = {}) {
  const {
    stochLength = DEFAULT_PERIOD,
    kSmoothing = 3,
    dSmoothing = 3,
  } = options

  const normalizedStochLength = Math.max(1, Math.floor(stochLength))
  const normalizedKSmoothing = Math.max(1, Math.floor(kSmoothing))
  const normalizedDSmoothing = Math.max(1, Math.floor(dSmoothing))

  const rawValues = new Array(rsiValues.length).fill(null)

  for (let i = 0; i < rsiValues.length; i += 1) {
    const currentRSI = rsiValues[i]
    if (currentRSI == null) {
      continue
    }

    const start = Math.max(0, i - normalizedStochLength + 1)
    let lowest = Infinity
    let highest = -Infinity
    let count = 0

    for (let j = start; j <= i; j += 1) {
      const value = rsiValues[j]
      if (value == null) {
        continue
      }

      lowest = Math.min(lowest, value)
      highest = Math.max(highest, value)
      count += 1
    }

    if (count < normalizedStochLength) {
      continue
    }

    if (highest === lowest) {
      rawValues[i] = 0
    } else {
      rawValues[i] = ((currentRSI - lowest) / (highest - lowest)) * 100
    }
  }

  const kValues = applySimpleMovingAverage(rawValues, normalizedKSmoothing)
  const dValues = applySimpleMovingAverage(kValues, normalizedDSmoothing)

  return {
    kValues,
    dValues,
    rawValues,
  }
}

export function calculateATR(candles, period = DEFAULT_PERIOD) {
  const normalizedPeriod = Math.max(1, Math.floor(period))
  const result = new Array(candles.length).fill(null)

  if (candles.length < 1) {
    return result
  }

  const trueRanges = new Array(candles.length).fill(null)

  for (let i = 0; i < candles.length; i += 1) {
    const candle = candles[i]
    if (!candle) {
      continue
    }

    const high = candle.high
    const low = candle.low
    const close = candle.close

    if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
      continue
    }

    if (i === 0) {
      trueRanges[i] = high - low
      continue
    }

    const previousClose = candles[i - 1]?.close

    if (!Number.isFinite(previousClose)) {
      trueRanges[i] = high - low
      continue
    }

    const highLow = high - low
    const highPreviousClose = Math.abs(high - previousClose)
    const lowPreviousClose = Math.abs(low - previousClose)
    trueRanges[i] = Math.max(highLow, highPreviousClose, lowPreviousClose)
  }

  if (candles.length < normalizedPeriod) {
    return result
  }

  let windowSum = 0
  for (let i = 0; i < normalizedPeriod; i += 1) {
    windowSum += trueRanges[i] ?? 0
  }

  let previousAtr = windowSum / normalizedPeriod
  result[normalizedPeriod - 1] = previousAtr

  for (let i = normalizedPeriod; i < candles.length; i += 1) {
    const trueRange = trueRanges[i]
    if (trueRange == null) {
      continue
    }

    previousAtr = ((previousAtr * (normalizedPeriod - 1)) + trueRange) / normalizedPeriod
    result[i] = previousAtr
  }

  return result
}

function applySimpleMovingAverage(values, period) {
  if (period <= 1) {
    return values.slice()
  }

  const result = new Array(values.length).fill(null)
  const window = []

  for (let i = 0; i < values.length; i += 1) {
    const value = values[i]
    if (value == null) {
      window.length = 0
      continue
    }

    window.push(value)

    if (window.length < period) {
      continue
    }

    if (window.length > period) {
      window.shift()
    }

    const sum = window.reduce((accumulator, entry) => accumulator + entry, 0)
    result[i] = sum / period
  }

  return result
}

function computeRS(averageGain, averageLoss) {
  if (averageLoss === 0) {
    return 100
  }

  if (averageGain === 0) {
    return 0
  }

  const rs = averageGain / averageLoss
  return 100 - 100 / (1 + rs)
}
