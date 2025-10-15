import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildLiveSnapshots } from '../heatmap-live.js'

const originalFetch = global.fetch

const SAMPLE_DATASET = (() => {
  const startTime = 1_700_000_000_000
  const intervalMs = 60_000

  return Array.from({ length: 300 }, (_, index) => {
    const openTime = startTime + index * intervalMs
    const basePrice = 200 + index * 0.25 + Math.sin(index / 5) * 2
    const closePrice = basePrice + Math.sin(index / 3) * 0.6
    const high = Math.max(basePrice, closePrice) + 0.9
    const low = Math.min(basePrice, closePrice) - 0.9

    return [
      String(openTime),
      basePrice.toFixed(2),
      high.toFixed(2),
      low.toFixed(2),
      closePrice.toFixed(2),
      '1500',
      '250000',
    ]
  })
})()

function restoreFetch() {
  if (originalFetch) {
    global.fetch = originalFetch
  } else {
    delete global.fetch
  }
}

describe('buildLiveSnapshots fallback indicators', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input) => {
        const url = new URL(typeof input === 'string' ? input : input.url ?? String(input))
        const hasEnd = url.searchParams.has('end')

        return {
          ok: true,
          json: async () => ({
            retCode: 0,
            result: { list: hasEnd ? [] : SAMPLE_DATASET },
          }),
        }
      }),
    )
  })

  afterEach(() => {
    restoreFetch()
    vi.restoreAllMocks()
  })

  it('populates MACD and ADX values when Bybit data is fetched directly', async () => {
    const snapshots = await buildLiveSnapshots('BTCUSDT', { markovWindowBars: 200 })

    expect(Array.isArray(snapshots)).toBe(true)
    expect(snapshots.length).toBeGreaterThan(0)

    const sample = snapshots[0]

    expect(sample.macd).toBeDefined()
    expect(sample.macd?.value).not.toBeNull()
    expect(Number.isFinite(sample.macd?.value ?? NaN)).toBe(true)
    expect(sample.macd?.signal).not.toBeNull()
    expect(Number.isFinite(sample.macd?.signal ?? NaN)).toBe(true)
    expect(sample.macd?.histogram).not.toBeNull()
    expect(Number.isFinite(sample.macd?.histogram ?? NaN)).toBe(true)

    expect(sample.adx).toBeDefined()
    expect(sample.adx?.value).not.toBeNull()
    expect(Number.isFinite(sample.adx?.value ?? NaN)).toBe(true)
    expect(sample.adx?.plusDI).not.toBeNull()
    expect(Number.isFinite(sample.adx?.plusDI ?? NaN)).toBe(true)
    expect(sample.adx?.minusDI).not.toBeNull()
    expect(Number.isFinite(sample.adx?.minusDI ?? NaN)).toBe(true)
    expect(sample.adx?.slope).not.toBeNull()
    expect(Number.isFinite(sample.adx?.slope ?? NaN)).toBe(true)
  })
})
