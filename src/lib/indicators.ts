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

type StochasticRSIOptions = {
  stochLength?: number
  kSmoothing?: number
  dSmoothing?: number
}

type StochasticRSIResult = {
  kValues: Array<number | null>
  dValues: Array<number | null>
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
  }
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
