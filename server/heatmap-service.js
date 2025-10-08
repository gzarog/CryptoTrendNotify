import { URL } from 'node:url'

import { buildLiveSnapshots } from './heatmap-live.js'

const DEFAULT_SYMBOL = 'BTCUSDT'
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

function buildMockSnapshot(symbol, timeframe, label, template) {
  const price = 30000
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
      atrBounds: { min: 0.8, max: 4 },
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

function buildMockSnapshots(symbol) {
  return MOCK_TIMEFRAMES.map(({ timeframe, label, template }) =>
    buildMockSnapshot(symbol, timeframe, label, template),
  )
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
  if (Array.isArray(upstreamResults) && upstreamResults.length > 0) {
    return upstreamResults
  }

  return buildLiveSnapshots(symbol)
}
