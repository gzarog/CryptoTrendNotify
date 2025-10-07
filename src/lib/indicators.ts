const DEFAULT_PERIOD = 14

export function calculateRSI(values: number[], period = DEFAULT_PERIOD): Array<number | null> {
  const result: Array<number | null> = new Array(values.length).fill(null)

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

export function calculateEMA(values: number[], period: number): Array<number | null> {
  const normalizedPeriod = Math.max(1, Math.floor(period))
  const result: Array<number | null> = new Array(values.length).fill(null)

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

export function calculateSMA(values: number[], period: number): Array<number | null> {
  const normalizedPeriod = Math.max(1, Math.floor(period))
  const result: Array<number | null> = new Array(values.length).fill(null)

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

function calculateEMAFromSeries(
  values: Array<number | null>,
  period: number,
): Array<number | null> {
  const normalizedPeriod = Math.max(1, Math.floor(period))
  const result: Array<number | null> = new Array(values.length).fill(null)

  if (values.length === 0 || normalizedPeriod <= 0) {
    return result
  }

  const multiplier = 2 / (normalizedPeriod + 1)
  const window: number[] = []
  let previousEma: number | null = null

  for (let i = 0; i < values.length; i += 1) {
    const value = values[i]
    if (value == null) {
      continue
    }

    window.push(value)

    if (window.length > normalizedPeriod) {
      window.shift()
    }

    if (window.length < normalizedPeriod) {
      continue
    }

    if (previousEma == null) {
      const initialSum = window.reduce((sum, entry) => sum + entry, 0)
      previousEma = initialSum / normalizedPeriod
      result[i] = previousEma
      continue
    }

    previousEma = (value - previousEma) * multiplier + previousEma
    result[i] = previousEma
  }

  return result
}

export function calculateMACD(
  values: number[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number,
): {
  macdLine: Array<number | null>
  signalLine: Array<number | null>
  histogram: Array<number | null>
} {
  const length = values.length
  const macdLine: Array<number | null> = new Array(length).fill(null)

  if (length === 0) {
    return {
      macdLine,
      signalLine: new Array(length).fill(null),
      histogram: new Array(length).fill(null),
    }
  }

  const fastEma = calculateEMA(values, fastPeriod)
  const slowEma = calculateEMA(values, slowPeriod)

  for (let i = 0; i < length; i += 1) {
    const fast = fastEma[i]
    const slow = slowEma[i]

    if (fast == null || slow == null) {
      continue
    }

    macdLine[i] = fast - slow
  }

  const signalLine = calculateEMAFromSeries(macdLine, signalPeriod)
  const histogram = macdLine.map((value, index) => {
    const signal = signalLine[index]
    if (value == null || signal == null) {
      return null
    }
    return value - signal
  })

  return {
    macdLine,
    signalLine,
    histogram,
  }
}

export function calculateADX(
  highs: number[],
  lows: number[],
  closes: number[],
  adxPeriod: number,
  signalPeriod: number,
): {
  adxLine: Array<number | null>
  signalLine: Array<number | null>
  plusDi: Array<number | null>
  minusDi: Array<number | null>
} {
  const length = Math.min(highs.length, lows.length, closes.length)
  const adxLine: Array<number | null> = new Array(length).fill(null)
  const plusDi: Array<number | null> = new Array(length).fill(null)
  const minusDi: Array<number | null> = new Array(length).fill(null)

  const normalizedAdxPeriod = Math.max(1, Math.floor(adxPeriod))
  const normalizedSignalPeriod = Math.max(1, Math.floor(signalPeriod))

  if (length <= normalizedAdxPeriod) {
    return {
      adxLine,
      signalLine: new Array(length).fill(null),
      plusDi,
      minusDi,
    }
  }

  const trueRange: number[] = new Array(length).fill(0)
  const positiveDM: number[] = new Array(length).fill(0)
  const negativeDM: number[] = new Array(length).fill(0)

  for (let i = 1; i < length; i += 1) {
    const currentHigh = highs[i]
    const previousHigh = highs[i - 1]
    const currentLow = lows[i]
    const previousLow = lows[i - 1]
    const previousClose = closes[i - 1]

    const upMove = currentHigh - previousHigh
    const downMove = previousLow - currentLow

    positiveDM[i] = upMove > downMove && upMove > 0 ? upMove : 0
    negativeDM[i] = downMove > upMove && downMove > 0 ? downMove : 0

    const rangeHighLow = currentHigh - currentLow
    const rangeHighClose = Math.abs(currentHigh - previousClose)
    const rangeLowClose = Math.abs(currentLow - previousClose)

    trueRange[i] = Math.max(rangeHighLow, rangeHighClose, rangeLowClose)
  }

  let smoothedTR = 0
  let smoothedPositiveDM = 0
  let smoothedNegativeDM = 0

  for (let i = 1; i <= normalizedAdxPeriod && i < length; i += 1) {
    smoothedTR += trueRange[i]
    smoothedPositiveDM += positiveDM[i]
    smoothedNegativeDM += negativeDM[i]
  }

  if (smoothedTR === 0) {
    return {
      adxLine,
      signalLine: calculateEMAFromSeries(adxLine, normalizedSignalPeriod),
      plusDi,
      minusDi,
    }
  }

  const dxValues: Array<number | null> = new Array(length).fill(null)

  const initialPlusDI = (smoothedPositiveDM / smoothedTR) * 100
  const initialMinusDI = (smoothedNegativeDM / smoothedTR) * 100
  plusDi[normalizedAdxPeriod] = initialPlusDI
  minusDi[normalizedAdxPeriod] = initialMinusDI

  const initialDISum = initialPlusDI + initialMinusDI

  if (initialDISum !== 0) {
    dxValues[normalizedAdxPeriod] =
      (Math.abs(initialPlusDI - initialMinusDI) / initialDISum) * 100
  }

  for (let i = normalizedAdxPeriod + 1; i < length; i += 1) {
    smoothedTR = smoothedTR - smoothedTR / normalizedAdxPeriod + trueRange[i]
    smoothedPositiveDM =
      smoothedPositiveDM - smoothedPositiveDM / normalizedAdxPeriod + positiveDM[i]
    smoothedNegativeDM =
      smoothedNegativeDM - smoothedNegativeDM / normalizedAdxPeriod + negativeDM[i]

    if (smoothedTR === 0) {
      continue
    }

    const currentPlusDI = (smoothedPositiveDM / smoothedTR) * 100
    const currentMinusDI = (smoothedNegativeDM / smoothedTR) * 100

    plusDi[i] = currentPlusDI
    minusDi[i] = currentMinusDI

    const diSum = currentPlusDI + currentMinusDI

    if (diSum === 0) {
      continue
    }

    dxValues[i] = (Math.abs(currentPlusDI - currentMinusDI) / diSum) * 100
  }

  const firstAdxIndex = normalizedAdxPeriod * 2 - 1

  if (firstAdxIndex >= length) {
    return {
      adxLine,
      signalLine: calculateEMAFromSeries(adxLine, normalizedSignalPeriod),
      plusDi,
      minusDi,
    }
  }

  let dxSum = 0
  let dxCount = 0

  for (let i = normalizedAdxPeriod; i <= firstAdxIndex && i < length; i += 1) {
    const value = dxValues[i]
    if (value == null) {
      continue
    }
    dxSum += value
    dxCount += 1
  }

  if (dxCount > 0) {
    const initialAdx = dxSum / dxCount
    adxLine[firstAdxIndex] = initialAdx

    for (let i = firstAdxIndex + 1; i < length; i += 1) {
      const currentDX = dxValues[i]
      const previousAdx = adxLine[i - 1]

      if (currentDX == null || previousAdx == null) {
        continue
      }

      adxLine[i] = ((previousAdx * (normalizedAdxPeriod - 1)) + currentDX) / normalizedAdxPeriod
    }
  }

  const signalLine = calculateEMAFromSeries(adxLine, normalizedSignalPeriod)

  return {
    adxLine,
    signalLine,
    plusDi,
    minusDi,
  }
}

type StochasticRSIOptions = {
  stochLength?: number
  kSmoothing?: number
  dSmoothing?: number
}

type StochasticRSIResult = {
  kValues: Array<number | null>
  dValues: Array<number | null>
  rawValues: Array<number | null>
}

export function calculateStochasticRSI(
  rsiValues: Array<number | null>,
  options: StochasticRSIOptions = {},
): StochasticRSIResult {
  const {
    stochLength = DEFAULT_PERIOD,
    kSmoothing = 3,
    dSmoothing = 3,
  } = options

  const normalizedStochLength = Math.max(1, Math.floor(stochLength))
  const normalizedKSmoothing = Math.max(1, Math.floor(kSmoothing))
  const normalizedDSmoothing = Math.max(1, Math.floor(dSmoothing))

  const rawValues: Array<number | null> = new Array(rsiValues.length).fill(null)

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

export function calculateATR(
  candles: Array<{ high: number; low: number; close: number }>,
  period = DEFAULT_PERIOD,
): Array<number | null> {
  const normalizedPeriod = Math.max(1, Math.floor(period))
  const result: Array<number | null> = new Array(candles.length).fill(null)

  if (candles.length < 1) {
    return result
  }

  const trueRanges: Array<number | null> = new Array(candles.length).fill(null)

  for (let i = 0; i < candles.length; i += 1) {
    const candle = candles[i]
    if (!candle) {
      continue
    }

    const { high, low, close } = candle

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

function applySimpleMovingAverage(values: Array<number | null>, period: number): Array<number | null> {
  if (period <= 1) {
    return values.slice()
  }

  const result: Array<number | null> = new Array(values.length).fill(null)
  const window: number[] = []

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

function computeRS(averageGain: number, averageLoss: number): number {
  if (averageLoss === 0) {
    return 100
  }

  if (averageGain === 0) {
    return 0
  }

  const relativeStrength = averageGain / averageLoss
  return 100 - 100 / (1 + relativeStrength)
}
