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

export function calculateStochasticRSI(
  rsiValues: Array<number | null>,
  period = DEFAULT_PERIOD,
): Array<number | null> {
  const result: Array<number | null> = new Array(rsiValues.length).fill(null)

  for (let i = 0; i < rsiValues.length; i += 1) {
    const currentRSI = rsiValues[i]
    if (currentRSI == null) {
      continue
    }

    const start = Math.max(0, i - period + 1)
    const window = rsiValues.slice(start, i + 1).filter((value): value is number => value != null)

    if (window.length < period) {
      continue
    }

    const lowest = Math.min(...window)
    const highest = Math.max(...window)

    if (highest === lowest) {
      result[i] = 0
    } else {
      result[i] = ((currentRSI - lowest) / (highest - lowest)) * 100
    }
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
