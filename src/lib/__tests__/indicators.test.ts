import { describe, expect, it } from 'vitest'

import { calculateEMA, calculateRSI, calculateSMA, calculateStochasticRSI } from '../indicators'

describe('calculateRSI', () => {
  it('returns null entries when data length is less than period', () => {
    const values = [100, 101, 102]
    const result = calculateRSI(values, 5)

    expect(result).toHaveLength(values.length)
    expect(result.every((entry) => entry === null)).toBe(true)
  })

  it('calculates incremental RSI values for a sliding window', () => {
    const values = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42]
    const result = calculateRSI(values, 5)

    expect(result.slice(0, 5)).toEqual([null, null, null, null, expect.any(Number)])
    expect(result[5]).toBeCloseTo(59.029, 3)
    expect(result[7]).toBeCloseTo(73.212, 3)
  })
})

describe('calculateEMA', () => {
  it('produces nulls until enough values are received', () => {
    const values = [10, 20, 30]
    const result = calculateEMA(values, 4)

    expect(result).toEqual([null, null, null])
  })

  it('smooths the input values using the exponential formula', () => {
    const values = [10, 11, 13, 12, 14]
    const result = calculateEMA(values, 3)

    expect(result.slice(0, 3)).toEqual([null, null, expect.any(Number)])
    expect(result[2]).toBeCloseTo(11.333, 3)
    expect(result[4]).toBeCloseTo(13.312, 3)
  })
})

describe('calculateSMA', () => {
  it('yields a moving average once the window is filled', () => {
    const values = [1, 2, 3, 4, 5]
    const result = calculateSMA(values, 3)

    expect(result).toEqual([null, null, 2, 3, 4])
  })
})

describe('calculateStochasticRSI', () => {
  it('derives %K and %D series from RSI values', () => {
    const rsiValues = [null, 40, 45, 55, 60, 50, 65, 70]
    const { kValues, dValues } = calculateStochasticRSI(rsiValues, {
      stochLength: 3,
      kSmoothing: 2,
      dSmoothing: 2,
    })

    expect(kValues.slice(0, 2)).toEqual([null, null])
    expect(kValues[4]).toBeCloseTo(100, 3)
    expect(kValues[6]).toBeGreaterThan(0)
    expect(dValues[6]).toBeGreaterThan(0)
    expect(dValues[6]).toBeLessThanOrEqual(100)
  })

  it('returns zeros when the RSI range collapses', () => {
    const rsiValues = [50, 50, 50, 50]
    const { kValues, dValues } = calculateStochasticRSI(rsiValues, {
      stochLength: 2,
      kSmoothing: 2,
      dSmoothing: 2,
    })

    expect(kValues.filter((value) => value !== null)).toEqual([0, 0, 0])
    expect(dValues.filter((value) => value !== null)).toEqual([0, 0])
  })
})
