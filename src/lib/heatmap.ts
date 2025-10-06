import type { HeatmapResult } from '../types/heatmap'

const DEFAULT_API_PATH = '/api/heatmap/snapshots'

function buildHeatmapUrl(symbol: string): URL {
  const rawBase = import.meta.env.VITE_HEATMAP_API_URL
  const origin = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'http://localhost'

  const baseUrl = (() => {
    if (rawBase && typeof rawBase === 'string' && rawBase.length > 0) {
      try {
        return new URL(rawBase)
      } catch {
        return new URL(rawBase, origin)
      }
    }

    return new URL(DEFAULT_API_PATH, origin)
  })()

  baseUrl.searchParams.set('symbol', symbol)
  return baseUrl
}

export async function fetchHeatmapResults(symbol: string): Promise<HeatmapResult[]> {
  if (!symbol) {
    return []
  }

  const url = buildHeatmapUrl(symbol)
  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Unable to load heatmap data (status ${response.status})`)
  }

  const payload = await response.json()

  if (Array.isArray(payload)) {
    return payload as HeatmapResult[]
  }

  if (payload && typeof payload === 'object' && Array.isArray(payload.results)) {
    return payload.results as HeatmapResult[]
  }

  return []
}
