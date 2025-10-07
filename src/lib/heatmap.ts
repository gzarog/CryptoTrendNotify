import type { HeatmapResult } from '../types/heatmap'

const DEFAULT_API_PATH = '/api/heatmap/snapshots'

function buildHeatmapUrl(symbol: string): URL {
  const rawBase = import.meta.env.VITE_HEATMAP_API_URL
  const apiBase = import.meta.env.VITE_API_BASE_URL
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

    if (apiBase && typeof apiBase === 'string' && apiBase.length > 0) {
      try {
        const base = new URL(apiBase)
        return new URL(DEFAULT_API_PATH, base)
      } catch {
        try {
          const normalized = new URL(apiBase, origin)
          return new URL(DEFAULT_API_PATH, normalized)
        } catch {
          // fall through to origin-based default
        }
      }
    }

    if (import.meta.env.DEV && !rawBase && !apiBase) {
      return new URL('http://localhost:4000/api/heatmap/snapshots')
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
