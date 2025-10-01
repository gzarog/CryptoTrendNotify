import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useRegisterSW } from 'virtual:pwa-register/react'

import { DashboardView } from './components/DashboardView'
import {
  calculateATR,
  calculateEMA,
  calculateRSI,
  calculateSMA,
  calculateStochasticRSI,
} from './lib/indicators'
import type { HeatmapResult } from './types/heatmap'
import {
  checkPushServerConnection,
  ensurePushSubscription,
  isNotificationSupported,
  requestNotificationPermission,
  showAppNotification,
  type PushSubscriptionFilters,
} from './lib/notifications'
import {
  buildAlert,
  buildAtrRiskLevels,
  riskGradeFromSignal,
} from './lib/risk'
import {
  createDefaultAccountState,
  createRiskConfigFromHeatmapConfig,
} from './lib/risk-presets'
import type { AlertPayload, RiskConfig } from './lib/risk'

export type Candle = {
  openTime: number
  closeTime: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  turnover: number
}

type BybitKlineResponse = {
  retCode: number
  retMsg: string
  result?: {
    list?: string[][]
  }
}

type TimeframeOption = {
  value: string
  label: string
}

type RefreshOption = {
  value: string
  label: string
}

type BarCountOption = {
  value: string
  label: string
}

type StochasticSetting = {
  rsiLength: number
  stochLength: number
  kSmoothing: number
  dSmoothing: number
  label: string
}

export type MomentumIntensity = 'green' | 'yellow' | 'orange' | 'red'

type MomentumReading = {
  timeframe: string
  timeframeLabel: string
  rsi: number
  stochasticD: number
  openTime: number
}

export type MomentumNotification = {
  id: string
  symbol: string
  direction: 'long' | 'short'
  intensity: MomentumIntensity
  label: string
  timeframeSummary: string
  rsiSummary: string
  stochasticSummary: string
  readings: MomentumReading[]
  triggeredAt: number
}

type MomentumComputation = MomentumReading & { direction: 'long' | 'short' | null }

export type MovingAverageMarker = {
  index: number
  value: number
  color: string
  label: string
}

export type MovingAverageCrossNotification = {
  id: string
  symbol: string
  timeframe: string
  timeframeLabel: string
  pairLabel: string
  direction: 'golden' | 'death'
  intensity: Exclude<MomentumIntensity, 'red'>
  price: number
  triggeredAt: number
}

export type HeatmapNotification = {
  id: string
  kind: 'signal' | 'status'
  symbol: string
  entryTimeframe: string
  entryLabel: string
  direction: HeatmapResult['signal']
  bias: 'BULL' | 'BEAR' | 'NEUTRAL'
  strength: AlertPayload['strength'] | null
  alert?: AlertPayload
  statusSummary?: string
  triggeredAt: number
}

const TIMEFRAMES: TimeframeOption[] = [
  { value: '5', label: '5m' },
  { value: '15', label: '15m' },
  { value: '30', label: '30m' },
  { value: '60', label: '60m' },
  { value: '120', label: '120m' },
  { value: '240', label: '240m (4h)' },
  { value: '360', label: '360m (6h)' },
]

const MOMENTUM_SIGNAL_TIMEFRAMES = ['5', '15', '30', '60', '120', '240', '360'] as const
const MOMENTUM_INTENSITY_BY_LEVEL: Record<number, MomentumIntensity> = {
  1: 'green',
  2: 'yellow',
  3: 'orange',
  4: 'red',
}

const MOMENTUM_EMOJI_BY_INTENSITY: Record<MomentumIntensity, string> = {
  green: '🟢',
  yellow: '🟡',
  orange: '🟠',
  red: '🔴',
}

const MOVING_AVERAGE_NOTIFICATION_TIMEFRAMES = TIMEFRAMES.map((option) => option.value)
const MOVING_AVERAGE_PAIR_TAGS = ['ema10-ema50', 'ema10-ma200', 'ema50-ma200'] as const

const HEATMAP_ENTRY_TIMEFRAMES = ['5', '15', '30', '60', '120', '240', '360'] as const
type HeatmapEntryTimeframe = (typeof HEATMAP_ENTRY_TIMEFRAMES)[number]

const HEATMAP_SIGNAL_LABELS: Record<HeatmapResult['signal'], string> = {
  LONG: 'Long signal',
  SHORT: 'Short signal',
  NONE: 'No signal',
}

const HEATMAP_STATUS_EMOJI_BY_BIAS: Record<HeatmapResult['bias'], string> = {
  BULL: '🟢',
  BEAR: '🔴',
  NEUTRAL: '⚪️',
}

const HEATMAP_CONFIGS: Record<HeatmapEntryTimeframe, {
  entryLabel: string
  htfList: string[]
  rsiLenHtf: Record<string, number>
  rsiLenLtf: number
  stochLenLtf: number
  kSmooth: number
  dSmooth: number
  requireAllHtf: boolean
  confirmHtfClose: boolean
  coolDownBars: number
  useMa200Filter: boolean
  minDistToMa200: number
  atrLength: number
  atrMultSl: number
  atrMultTp1: number
  atrMultTp2: number
  riskPctPerTrade: number
  volMinAtrPct: number
  volMaxAtrPct: number
}> = {
  '5': {
    entryLabel: '5m',
    htfList: ['60', '120', '240'],
    rsiLenHtf: { '60': 14, '120': 16, '240': 21 },
    rsiLenLtf: 7,
    stochLenLtf: 7,
    kSmooth: 2,
    dSmooth: 2,
    requireAllHtf: false,
    confirmHtfClose: true,
    coolDownBars: 6,
    useMa200Filter: true,
    minDistToMa200: 0.25,
    atrLength: 14,
    atrMultSl: 1.2,
    atrMultTp1: 1.0,
    atrMultTp2: 1.8,
    riskPctPerTrade: 0.0075,
    volMinAtrPct: 0.15,
    volMaxAtrPct: 3.0,
  },
  '15': {
    entryLabel: '15m',
    htfList: ['60', '120', '240'],
    rsiLenHtf: { '60': 15, '120': 17, '240': 21 },
    rsiLenLtf: 9,
    stochLenLtf: 9,
    kSmooth: 2,
    dSmooth: 3,
    requireAllHtf: false,
    confirmHtfClose: true,
    coolDownBars: 6,
    useMa200Filter: true,
    minDistToMa200: 0.25,
    atrLength: 14,
    atrMultSl: 1.2,
    atrMultTp1: 1.0,
    atrMultTp2: 1.8,
    riskPctPerTrade: 0.0075,
    volMinAtrPct: 0.15,
    volMaxAtrPct: 3.0,
  },
  '30': {
    entryLabel: '30m',
    htfList: ['60', '120', '240'],
    rsiLenHtf: { '60': 15, '120': 17, '240': 21 },
    rsiLenLtf: 12,
    stochLenLtf: 12,
    kSmooth: 3,
    dSmooth: 3,
    requireAllHtf: false,
    confirmHtfClose: true,
    coolDownBars: 6,
    useMa200Filter: true,
    minDistToMa200: 0.25,
    atrLength: 14,
    atrMultSl: 1.2,
    atrMultTp1: 1.0,
    atrMultTp2: 1.8,
    riskPctPerTrade: 0.0075,
    volMinAtrPct: 0.15,
    volMaxAtrPct: 3.0,
  },
  '60': {
    entryLabel: '60m (1h)',
    htfList: ['120', '240', '360'],
    rsiLenHtf: { '120': 16, '240': 21, '360': 24 },
    rsiLenLtf: 14,
    stochLenLtf: 14,
    kSmooth: 3,
    dSmooth: 3,
    requireAllHtf: false,
    confirmHtfClose: true,
    coolDownBars: 6,
    useMa200Filter: true,
    minDistToMa200: 0.25,
    atrLength: 14,
    atrMultSl: 1.2,
    atrMultTp1: 1.0,
    atrMultTp2: 1.8,
    riskPctPerTrade: 0.0075,
    volMinAtrPct: 0.15,
    volMaxAtrPct: 3.0,
  },
  '120': {
    entryLabel: '120m (2h)',
    htfList: ['240', '360'],
    rsiLenHtf: { '240': 21, '360': 24 },
    rsiLenLtf: 16,
    stochLenLtf: 16,
    kSmooth: 3,
    dSmooth: 3,
    requireAllHtf: false,
    confirmHtfClose: true,
    coolDownBars: 6,
    useMa200Filter: true,
    minDistToMa200: 0.25,
    atrLength: 14,
    atrMultSl: 1.2,
    atrMultTp1: 1.0,
    atrMultTp2: 1.8,
    riskPctPerTrade: 0.0075,
    volMinAtrPct: 0.15,
    volMaxAtrPct: 3.0,
  },
  '240': {
    entryLabel: '240m (4h)',
    htfList: ['360'],
    rsiLenHtf: { '360': 24 },
    rsiLenLtf: 21,
    stochLenLtf: 21,
    kSmooth: 4,
    dSmooth: 4,
    requireAllHtf: false,
    confirmHtfClose: true,
    coolDownBars: 6,
    useMa200Filter: true,
    minDistToMa200: 0.25,
    atrLength: 14,
    atrMultSl: 1.2,
    atrMultTp1: 1.0,
    atrMultTp2: 1.8,
    riskPctPerTrade: 0.0075,
    volMinAtrPct: 0.15,
    volMaxAtrPct: 3.0,
  },
  '360': {
    entryLabel: '360m (6h)',
    htfList: [],
    rsiLenHtf: {},
    rsiLenLtf: 24,
    stochLenLtf: 24,
    kSmooth: 4,
    dSmooth: 4,
    requireAllHtf: false,
    confirmHtfClose: true,
    coolDownBars: 6,
    useMa200Filter: true,
    minDistToMa200: 0.25,
    atrLength: 14,
    atrMultSl: 1.2,
    atrMultTp1: 1.0,
    atrMultTp2: 1.8,
    riskPctPerTrade: 0.0075,
    volMinAtrPct: 0.15,
    volMaxAtrPct: 3.0,
  },
}

const HEATMAP_NEUTRAL_BAND = { lower: 45, upper: 55 }

const RSI_SETTINGS: Record<string, { period: number; label: string }> = {
  '5': { period: 8, label: '7–9' },
  '15': { period: 11, label: '9–12' },
  '30': { period: 13, label: '12–14' },
  '60': { period: 15, label: '14–16' },
  '120': { period: 17, label: '16–18' },
  '240': { period: 20, label: '18–21' },
  '360': { period: 23, label: '21–24' },
}

const DEFAULT_RSI_SETTING = { period: 14, label: '14' }

const STOCHASTIC_SETTINGS: Record<string, StochasticSetting> = {
  '5': { rsiLength: 7, stochLength: 7, kSmoothing: 2, dSmoothing: 2, label: 'RSI 7 • Stoch 7 • %K 2 • %D 2' },
  '15': { rsiLength: 9, stochLength: 9, kSmoothing: 2, dSmoothing: 3, label: 'RSI 9 • Stoch 9 • %K 2 • %D 3' },
  '30': { rsiLength: 12, stochLength: 12, kSmoothing: 3, dSmoothing: 3, label: 'RSI 12 • Stoch 12 • %K 3 • %D 3' },
  '60': { rsiLength: 14, stochLength: 14, kSmoothing: 3, dSmoothing: 3, label: 'RSI 14 • Stoch 14 • %K 3 • %D 3' },
  '120': { rsiLength: 16, stochLength: 16, kSmoothing: 3, dSmoothing: 3, label: 'RSI 16 • Stoch 16 • %K 3 • %D 3' },
  '240': { rsiLength: 21, stochLength: 21, kSmoothing: 4, dSmoothing: 4, label: 'RSI 21 • Stoch 21 • %K 4 (3–4) • %D 4 (3–4)' },
  '360': { rsiLength: 24, stochLength: 24, kSmoothing: 4, dSmoothing: 4, label: 'RSI 24 • Stoch 24 • %K 4 • %D 4' },
}

const DEFAULT_STOCHASTIC_SETTING: StochasticSetting = {
  rsiLength: 14,
  stochLength: 14,
  kSmoothing: 3,
  dSmoothing: 3,
  label: 'RSI 14 • Stoch 14 • %K 3 • %D 3',
}

const REFRESH_OPTIONS: RefreshOption[] = [
  { value: '1', label: '1m' },
  { value: '5', label: '5m' },
  { value: '15', label: '15m' },
  { value: '30', label: '30m' },
  { value: '60', label: '60m' },
  { value: 'custom', label: 'Custom' },
]

const DEFAULT_REFRESH_SELECTION = '1'

const BAR_COUNT_OPTIONS: BarCountOption[] = [
  { value: '100', label: '100' },
  { value: '200', label: '200' },
  { value: '400', label: '400' },
  { value: '600', label: '600' },
  { value: '800', label: '800' },
  { value: '1000', label: '1000' },
  { value: '2000', label: '2000' },
  { value: '3000', label: '3000' },
  { value: '4000', label: '4000' },
  { value: '5000', label: '5000' },
  { value: 'custom', label: 'Custom' },
]

const DATE_FORMATTERS: Record<'short' | 'long', Intl.DateTimeFormat> = {
  short: new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }),
  long: new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }),
}

const LAST_REFRESH_FORMATTER = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

const GUIDE_VALUE_FORMATTER = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const DEFAULT_BAR_LIMIT = 200
const MAX_BAR_LIMIT = 5000
const MAX_MOMENTUM_NOTIFICATIONS = 6
const MAX_MOVING_AVERAGE_NOTIFICATIONS = 6
const MAX_HEATMAP_NOTIFICATIONS = 6

const DEFAULT_MOMENTUM_BOUNDS = {
  rsiLower: 20,
  rsiUpper: 80,
  stochasticLower: 20,
  stochasticUpper: 80,
}

const STORAGE_KEYS = {
  symbol: 'ctn:symbol',
  timeframe: 'ctn:timeframe',
  refreshSelection: 'ctn:refreshSelection',
  customRefresh: 'ctn:customRefresh',
  barSelection: 'ctn:barSelection',
  customBarCount: 'ctn:customBarCount',
  marketSummaryCollapsed: 'ctn:marketSummaryCollapsed',
  rsiLowerBound: 'ctn:rsiLowerBound',
  rsiUpperBound: 'ctn:rsiUpperBound',
  stochasticLowerBound: 'ctn:stochasticLowerBound',
  stochasticUpperBound: 'ctn:stochasticUpperBound',
  currentEquity: 'ctn:currentEquity',
  riskBudgetPercent: 'ctn:riskBudgetPercent',
  atrMultiplier: 'ctn:atrMultiplier',
} as const

const isBrowser = typeof window !== 'undefined'

type CrossDirection = 'golden' | 'death'

type CrossDetection = {
  index: number
  direction: CrossDirection
}

function detectLatestCross(
  fast: Array<number | null>,
  slow: Array<number | null>,
): CrossDetection | null {
  const length = Math.min(fast.length, slow.length)

  for (let i = length - 1; i >= 1; i -= 1) {
    const prevFast = fast[i - 1]
    const prevSlow = slow[i - 1]
    const currentFast = fast[i]
    const currentSlow = slow[i]

    if (
      prevFast == null ||
      prevSlow == null ||
      currentFast == null ||
      currentSlow == null
    ) {
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

function readLocalStorage(key: string): string | null {
  if (!isBrowser) {
    return null
  }

  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLocalStorage(key: string, value: string) {
  if (!isBrowser) {
    return
  }

  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Ignore write errors (e.g., storage full or disabled)
  }
}
// Bybit caps the /market/kline endpoint at 200 results per response, so the fetcher
// issues batched requests when callers ask for a larger window.
const BYBIT_REQUEST_LIMIT = 200

async function fetchBybitOHLCV(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  const sanitizedLimit = Math.min(Math.max(Math.floor(limit), 1), MAX_BAR_LIMIT)
  const collected: Candle[] = []
  let nextEndTime: number | undefined

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

    const payload = (await response.json()) as BybitKlineResponse

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
    collected
      .reduce((acc, candle) => acc.set(candle.openTime, candle), new Map<number, Candle>())
      .values(),
  )

  return deduped.sort((a, b) => a.openTime - b.openTime).slice(-sanitizedLimit)
}

function resolveRefreshInterval(selection: string, customValue: string): number | false {
  if (selection === 'custom') {
    const minutes = Number(customValue)
    return Number.isFinite(minutes) && minutes > 0 ? minutes * 60_000 : false
  }

  const minutes = Number(selection)
  return Number.isFinite(minutes) && minutes > 0 ? minutes * 60_000 : false
}

function formatIntervalLabel(value: string): string {
  const match = TIMEFRAMES.find((item) => item.value === value)
  return match ? match.label : `${value}m`
}

function formatTimestamp(timestamp: number, timeframe: string): string {
  const formatter = Number(timeframe) >= 60 ? DATE_FORMATTERS.long : DATE_FORMATTERS.short
  return formatter.format(new Date(timestamp))
}

function formatTriggeredAt(timestamp: number): string {
  const date = new Date(timestamp)
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear().toString()
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const seconds = date.getSeconds().toString().padStart(2, '0')

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`
}

function timeframeToMillis(value: string): number | null {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }
  return parsed * 60_000
}

function isCandleClosed(candle: Candle | undefined, timeframe: string): boolean {
  if (!candle) {
    return false
  }

  const duration = timeframeToMillis(timeframe)
  if (!Number.isFinite(duration)) {
    return false
  }

  const closeTime = candle.openTime + duration
  return Number.isFinite(closeTime) && Date.now() >= closeTime
}

function extractClosedCloses(
  candles: Candle[] | undefined,
  timeframe: string,
  confirmClose: boolean,
): number[] {
  if (!candles || candles.length === 0) {
    return []
  }

  const result = candles.slice()

  if (confirmClose && result.length > 0) {
    const lastCandle = result[result.length - 1]
    if (!isCandleClosed(lastCandle, timeframe)) {
      result.pop()
    }
  }

  return result.map((candle) => candle.close)
}

function findPreviousIndex(series: Array<number | null>, start: number): number | null {
  for (let i = start; i >= 0; i -= 1) {
    const value = series[i]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return i
    }
  }
  return null
}

function findAlignedIndex(
  seriesA: Array<number | null>,
  seriesB: Array<number | null>,
  start: number,
): number | null {
  const length = Math.min(seriesA.length, seriesB.length)
  for (let i = Math.min(start, length - 1); i >= 0; i -= 1) {
    const valueA = seriesA[i]
    const valueB = seriesB[i]
    if (
      typeof valueA === 'number' &&
      Number.isFinite(valueA) &&
      typeof valueB === 'number' &&
      Number.isFinite(valueB)
    ) {
      return i
    }
  }
  return null
}

function computeRecentAverage(values: Array<number | null>, length: number): number | null {
  if (!Array.isArray(values) || length <= 0) {
    return null
  }

  const collected: number[] = []

  for (let i = values.length - 1; i >= 0 && collected.length < length; i -= 1) {
    const value = values[i]
    if (typeof value === 'number' && Number.isFinite(value)) {
      collected.push(value)
    }
  }

  if (collected.length < length) {
    return null
  }

  const sum = collected.reduce((accumulator, entry) => accumulator + entry, 0)
  return sum / collected.length
}

function resolveBarLimit(selection: string, customValue: string): number | null {
  const parseValue = (value: string) => {
    const parsed = Number.parseInt(value, 10)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null
    }
    return Math.min(parsed, MAX_BAR_LIMIT)
  }

  if (selection === 'custom') {
    return parseValue(customValue)
  }

  return parseValue(selection)
}

function App() {
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [showUpdateBanner, setShowUpdateBanner] = useState(false)
  const [showOfflineReadyBanner, setShowOfflineReadyBanner] = useState(false)

  const [symbol, setSymbol] = useState(() => {
    const stored = readLocalStorage(STORAGE_KEYS.symbol)
    if (typeof stored === 'string') {
      return stored.trim().toUpperCase()
    }

    return ''
  })
  const [timeframe, setTimeframe] = useState(() => {
    const stored = readLocalStorage(STORAGE_KEYS.timeframe)
    return stored && TIMEFRAMES.some((option) => option.value === stored)
      ? stored
      : TIMEFRAMES[0].value
  })
  const [refreshSelection, setRefreshSelection] = useState(() => {
    const stored = readLocalStorage(STORAGE_KEYS.refreshSelection)
    return stored && REFRESH_OPTIONS.some((option) => option.value === stored)
      ? stored
      : DEFAULT_REFRESH_SELECTION
  })
  const [customRefresh, setCustomRefresh] = useState(
    () => readLocalStorage(STORAGE_KEYS.customRefresh) ?? '1',
  )
  const [barSelection, setBarSelection] = useState(() => {
    const stored = readLocalStorage(STORAGE_KEYS.barSelection)
    return stored && BAR_COUNT_OPTIONS.some((option) => option.value === stored)
      ? stored
      : '200'
  })
  const [customBarCount, setCustomBarCount] = useState(
    () => readLocalStorage(STORAGE_KEYS.customBarCount) ?? DEFAULT_BAR_LIMIT.toString(),
  )
  const [isMarketSummaryCollapsed, setIsMarketSummaryCollapsed] = useState(() => {
    const stored = readLocalStorage(STORAGE_KEYS.marketSummaryCollapsed)
    return stored === 'true' ? true : stored === 'false' ? false : false
  })
  const supportsNotifications = isNotificationSupported()
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() =>
    supportsNotifications ? Notification.permission : 'denied',
  )
  const [rsiLowerBoundInput, setRsiLowerBoundInput] = useState(
    () =>
      readLocalStorage(STORAGE_KEYS.rsiLowerBound) ??
      DEFAULT_MOMENTUM_BOUNDS.rsiLower.toString(),
  )
  const [rsiUpperBoundInput, setRsiUpperBoundInput] = useState(
    () =>
      readLocalStorage(STORAGE_KEYS.rsiUpperBound) ??
      DEFAULT_MOMENTUM_BOUNDS.rsiUpper.toString(),
  )
  const [stochasticLowerBoundInput, setStochasticLowerBoundInput] = useState(
    () =>
      readLocalStorage(STORAGE_KEYS.stochasticLowerBound) ??
      DEFAULT_MOMENTUM_BOUNDS.stochasticLower.toString(),
  )
  const [stochasticUpperBoundInput, setStochasticUpperBoundInput] = useState(
    () =>
      readLocalStorage(STORAGE_KEYS.stochasticUpperBound) ??
      DEFAULT_MOMENTUM_BOUNDS.stochasticUpper.toString(),
  )
  const [currentEquityInput, setCurrentEquityInput] = useState(
    () => readLocalStorage(STORAGE_KEYS.currentEquity) ?? '',
  )
  const [riskBudgetPercentInput, setRiskBudgetPercentInput] = useState(
    () => readLocalStorage(STORAGE_KEYS.riskBudgetPercent) ?? '0.75',
  )
  const [atrMultiplierInput, setAtrMultiplierInput] = useState(
    () => readLocalStorage(STORAGE_KEYS.atrMultiplier) ?? '1',
  )
  const notificationTimeframes = MOMENTUM_SIGNAL_TIMEFRAMES
  const lastMomentumTriggerRef = useRef<string | null>(null)
  const lastMovingAverageTriggersRef = useRef<Record<string, string>>({})
  const lastHeatmapTriggersRef = useRef<Record<string, string>>({})
  const lastHeatmapStatusRef = useRef<Record<string, string>>({})
  const heatmapStateRef = useRef<
    Record<
      string,
      {
        lastSignalOpenTime: number | null
        lastExtremeMarker: 'longExtremeSeen' | 'shortExtremeSeen' | null
        lastAlertSide: 'LONG' | 'SHORT' | null
      }
    >
  >({})
  const [momentumNotifications, setMomentumNotifications] = useState<MomentumNotification[]>([])
  const [movingAverageNotifications, setMovingAverageNotifications] =
    useState<MovingAverageCrossNotification[]>([])
  const [heatmapNotifications, setHeatmapNotifications] =
    useState<HeatmapNotification[]>([])
  const [pushServerConnected, setPushServerConnected] = useState<boolean | null>(null)

  const normalizedSymbol = useMemo(() => symbol.trim().toUpperCase(), [symbol])
  const symbolQueryEnabled = normalizedSymbol.length > 0

  useEffect(() => {
    writeLocalStorage(STORAGE_KEYS.symbol, normalizedSymbol)
  }, [normalizedSymbol])

  useEffect(() => {
    writeLocalStorage(STORAGE_KEYS.timeframe, timeframe)
  }, [timeframe])

  useEffect(() => {
    writeLocalStorage(STORAGE_KEYS.refreshSelection, refreshSelection)
  }, [refreshSelection])

  useEffect(() => {
    writeLocalStorage(STORAGE_KEYS.customRefresh, customRefresh)
  }, [customRefresh])

  useEffect(() => {
    writeLocalStorage(STORAGE_KEYS.barSelection, barSelection)
  }, [barSelection])

  useEffect(() => {
    writeLocalStorage(STORAGE_KEYS.customBarCount, customBarCount)
  }, [customBarCount])

  useEffect(() => {
    writeLocalStorage(
      STORAGE_KEYS.marketSummaryCollapsed,
      isMarketSummaryCollapsed ? 'true' : 'false',
    )
  }, [isMarketSummaryCollapsed])

  useEffect(() => {
    writeLocalStorage(STORAGE_KEYS.rsiLowerBound, rsiLowerBoundInput)
  }, [rsiLowerBoundInput])

  useEffect(() => {
    writeLocalStorage(STORAGE_KEYS.rsiUpperBound, rsiUpperBoundInput)
  }, [rsiUpperBoundInput])

  useEffect(() => {
    writeLocalStorage(STORAGE_KEYS.stochasticLowerBound, stochasticLowerBoundInput)
  }, [stochasticLowerBoundInput])

  useEffect(() => {
    writeLocalStorage(STORAGE_KEYS.stochasticUpperBound, stochasticUpperBoundInput)
  }, [stochasticUpperBoundInput])

  useEffect(() => {
    writeLocalStorage(STORAGE_KEYS.currentEquity, currentEquityInput)
  }, [currentEquityInput])

  useEffect(() => {
    writeLocalStorage(STORAGE_KEYS.riskBudgetPercent, riskBudgetPercentInput)
  }, [riskBudgetPercentInput])

  useEffect(() => {
    writeLocalStorage(STORAGE_KEYS.atrMultiplier, atrMultiplierInput)
  }, [atrMultiplierInput])

  const fetchPushServerStatus = useCallback(async () => checkPushServerConnection(), [])

  const updatePushServerStatus = useCallback(async () => {
    const connected = await fetchPushServerStatus()
    setPushServerConnected(connected)
    return connected
  }, [fetchPushServerStatus])

  const refreshInterval = useMemo(
    () => resolveRefreshInterval(refreshSelection, customRefresh),
    [refreshSelection, customRefresh],
  )

  const resolvedBarLimit = useMemo(
    () => resolveBarLimit(barSelection, customBarCount) ?? DEFAULT_BAR_LIMIT,
    [barSelection, customBarCount],
  )

  const { updateServiceWorker } = useRegisterSW({
    onNeedRefresh() {
      setShowUpdateBanner(true)
    },
    onOfflineReady() {
      setShowOfflineReadyBanner(true)
    },
  })

  useEffect(() => {
    if (!supportsNotifications) {
      setNotificationPermission('denied')
      return
    }

    setNotificationPermission(Notification.permission)
  }, [supportsNotifications])

  const pushNotificationsEnabled = supportsNotifications && notificationPermission === 'granted'

  useEffect(() => {
    let cancelled = false

    const checkStatus = async () => {
      const connected = await fetchPushServerStatus()

      if (!cancelled) {
        setPushServerConnected(connected)
      }
    }

    void checkStatus()

    return () => {
      cancelled = true
    }
  }, [fetchPushServerStatus])

  useEffect(() => {
    const handler = (event: BeforeInstallPromptEvent) => {
      event.preventDefault()
      setInstallPromptEvent(event)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const { data, isError, error, isLoading, refetch, isFetching, dataUpdatedAt } = useQuery<Candle[]>({
    queryKey: ['bybit-kline', normalizedSymbol, timeframe, resolvedBarLimit],
    queryFn: () => fetchBybitOHLCV(normalizedSymbol, timeframe, resolvedBarLimit),
    refetchInterval: refreshInterval,
    refetchIntervalInBackground: true,
    retry: 1,
    enabled: symbolQueryEnabled,
    placeholderData: (previousData) => previousData,
  })

  const symbolErrorMessage = isError && error instanceof Error ? error.message : ''
  const normalizedErrorMessage = symbolErrorMessage.toLowerCase()
  const isSymbolRejected =
    symbolQueryEnabled &&
    (normalizedErrorMessage.includes('symbol') ||
      normalizedErrorMessage.includes('instrument') ||
      normalizedErrorMessage.includes('not found'))
  const canStreamSymbol = symbolQueryEnabled && !isSymbolRejected

  const notificationQueries = useQueries({
    queries: notificationTimeframes.map((value) => ({
      queryKey: ['bybit-kline', normalizedSymbol, value, resolvedBarLimit],
      queryFn: () => fetchBybitOHLCV(normalizedSymbol, value, resolvedBarLimit),
      refetchInterval: refreshInterval,
      refetchIntervalInBackground: true,
      retry: 1,
      enabled: canStreamSymbol,
      placeholderData: (previousData: Candle[] | undefined) => previousData,
    })),
  })

  const movingAverageNotificationTimeframes = MOVING_AVERAGE_NOTIFICATION_TIMEFRAMES
  const movingAverageNotificationQueries = useQueries({
    queries: movingAverageNotificationTimeframes.map((value) => ({
      queryKey: ['bybit-kline', normalizedSymbol, value, resolvedBarLimit],
      queryFn: () => fetchBybitOHLCV(normalizedSymbol, value, resolvedBarLimit),
      refetchInterval: refreshInterval,
      refetchIntervalInBackground: true,
      retry: 1,
      enabled: canStreamSymbol,
      placeholderData: (previousData: Candle[] | undefined) => previousData,
    })),
  })

  const subscriptionFilters = useMemo<PushSubscriptionFilters | undefined>(() => {
    if (!canStreamSymbol) {
      return undefined
    }

    return {
      symbols: [normalizedSymbol],
      momentumTimeframes: [...MOMENTUM_SIGNAL_TIMEFRAMES],
      movingAverageTimeframes: [...MOVING_AVERAGE_NOTIFICATION_TIMEFRAMES],
      movingAveragePairs: [...MOVING_AVERAGE_PAIR_TAGS],
    }
  }, [canStreamSymbol, normalizedSymbol])

  useEffect(() => {
    if (!pushNotificationsEnabled) {
      return
    }

    let cancelled = false

    const initializeSubscription = async () => {
      const subscriptionEstablished = await ensurePushSubscription(subscriptionFilters)

      if (cancelled) {
        return
      }

      setPushServerConnected(subscriptionEstablished)

      if (subscriptionEstablished) {
        await updatePushServerStatus()
      }
    }

    void initializeSubscription()

    return () => {
      cancelled = true
    }
  }, [pushNotificationsEnabled, subscriptionFilters, updatePushServerStatus])

  const handleEnableNotifications = async () => {
    if (!supportsNotifications) {
      return
    }

    if (notificationPermission === 'denied') {
      window.alert(
        'Browser notifications are currently blocked for this site. Update the permission to "Allow" if you would like to receive alerts.',
      )
      return
    }

    if (notificationPermission === 'default') {
      const shouldRequestPermission = window.confirm(
        'Momentum notifications are currently disabled. Select "OK" to open the browser prompt where you can accept or reject notifications for this site.',
      )

      if (!shouldRequestPermission) {
        return
      }
    }

    const permission = await requestNotificationPermission()
    setNotificationPermission(permission)

    if (permission === 'granted') {
      const subscriptionEstablished = await ensurePushSubscription(subscriptionFilters)
      setPushServerConnected(subscriptionEstablished)

      if (!subscriptionEstablished) {
        void updatePushServerStatus()
        return
      }
    }

    void updatePushServerStatus()
  }

  useEffect(() => {
    if (!pushNotificationsEnabled) {
      return
    }

    let cancelled = false

    const syncSubscription = async () => {
      const established = await ensurePushSubscription(subscriptionFilters)

      if (cancelled) {
        return
      }

      if (!established) {
        void updatePushServerStatus()
      }
    }

    void syncSubscription()

    return () => {
      cancelled = true
    }
  }, [pushNotificationsEnabled, subscriptionFilters, updatePushServerStatus])

  const lastUpdatedLabel = useMemo(() => {
    if (!dataUpdatedAt) {
      return '—'
    }
    return LAST_REFRESH_FORMATTER.format(new Date(dataUpdatedAt))
  }, [dataUpdatedAt])

  const closes = useMemo(() => (data ? data.map((candle) => candle.close) : []), [data])

  const ema10Values = useMemo(() => calculateEMA(closes, 10), [closes])
  const ema50Values = useMemo(() => calculateEMA(closes, 50), [closes])
  const sma200Values = useMemo(() => calculateSMA(closes, 200), [closes])

  useEffect(() => {
    lastMomentumTriggerRef.current = null
    lastMovingAverageTriggersRef.current = {}
    setMomentumNotifications([])
    setMovingAverageNotifications([])
  }, [normalizedSymbol])

  useEffect(() => {
    heatmapStateRef.current = {}
  }, [normalizedSymbol])

  useEffect(() => {
    if (!pushNotificationsEnabled) {
      lastMomentumTriggerRef.current = null
      lastMovingAverageTriggersRef.current = {}
    }
  }, [pushNotificationsEnabled])

  const rsiSetting = useMemo(
    () => RSI_SETTINGS[timeframe] ?? DEFAULT_RSI_SETTING,
    [timeframe],
  )

  const stochasticSetting = useMemo(
    () => STOCHASTIC_SETTINGS[timeframe] ?? DEFAULT_STOCHASTIC_SETTING,
    [timeframe],
  )

  const rsiLengthDescription = useMemo(() => {
    if (rsiSetting.label === String(rsiSetting.period)) {
      return `${rsiSetting.period}`
    }
    return `${rsiSetting.period} • range ${rsiSetting.label}`
  }, [rsiSetting.label, rsiSetting.period])

  const rsiValues = useMemo(
    () => calculateRSI(closes, rsiSetting.period),
    [closes, rsiSetting.period],
  )
  const stochasticRsiValues = useMemo(
    () => calculateRSI(closes, stochasticSetting.rsiLength),
    [closes, stochasticSetting.rsiLength],
  )
  const stochasticSeries = useMemo(
    () =>
      calculateStochasticRSI(stochasticRsiValues, {
        stochLength: stochasticSetting.stochLength,
        kSmoothing: stochasticSetting.kSmoothing,
        dSmoothing: stochasticSetting.dSmoothing,
      }),
    [
      stochasticRsiValues,
      stochasticSetting.dSmoothing,
      stochasticSetting.kSmoothing,
      stochasticSetting.stochLength,
    ],
  )

  const stochasticLengthDescription = useMemo(
    () => stochasticSetting.label,
    [stochasticSetting.label],
  )

  const labels = useMemo(
    () => (data ? data.map((candle) => formatTimestamp(candle.openTime, timeframe)) : []),
    [data, timeframe],
  )

  const movingAverageMarkers = useMemo(() => {
    const markers: MovingAverageMarker[] = []

    const appendCrossMarkers = (
      fast: Array<number | null>,
      slow: Array<number | null>,
      fastLabel: string,
      slowLabel: string,
    ) => {
      const length = Math.min(fast.length, slow.length)
      for (let i = 1; i < length; i += 1) {
        const prevFast = fast[i - 1]
        const prevSlow = slow[i - 1]
        const currentFast = fast[i]
        const currentSlow = slow[i]

        if (
          prevFast == null ||
          prevSlow == null ||
          currentFast == null ||
          currentSlow == null
        ) {
          continue
        }

        const previousDifference = prevFast - prevSlow
        const currentDifference = currentFast - currentSlow

        const crossedUp = previousDifference < 0 && currentDifference >= 0
        const crossedDown = previousDifference > 0 && currentDifference <= 0

        if (!crossedUp && !crossedDown) {
          continue
        }

        const label = crossedUp
          ? `${fastLabel} crossed above ${slowLabel}`
          : `${fastLabel} crossed below ${slowLabel}`
        const color = crossedUp ? '#34d399' : '#f87171'
        const value =
          currentDifference === 0
            ? currentFast
            : (currentFast + currentSlow) / 2

        markers.push({ index: i, value, color, label })
      }
    }

    appendCrossMarkers(ema10Values, ema50Values, 'EMA 10', 'EMA 50')
    appendCrossMarkers(ema10Values, sma200Values, 'EMA 10', 'MA 200')
    appendCrossMarkers(ema50Values, sma200Values, 'EMA 50', 'MA 200')

    return markers
  }, [ema10Values, ema50Values, sma200Values])

  const latestCandle = data?.[data.length - 1]
  const priceChange = useMemo(() => {
    if (!data || data.length < 2) {
      return null
    }
    const previous = data[data.length - 2]
    const difference = latestCandle!.close - previous.close
    const percent = (difference / previous.close) * 100
    return { difference, percent }
  }, [data, latestCandle])

  const movingAverageSeries = useMemo(
    () => ({
      ema10: ema10Values,
      ema50: ema50Values,
      ma200: sma200Values,
      markers: movingAverageMarkers,
    }),
    [ema10Values, ema50Values, sma200Values, movingAverageMarkers],
  )

  const heatmapResults = useMemo<HeatmapResult[]>(() => {
    if (!canStreamSymbol) {
      heatmapStateRef.current = {}
      return []
    }

    const baseState = { ...heatmapStateRef.current }
    const timeframeCandles = new Map<string, Candle[]>()

    notificationTimeframes.forEach((timeframeValue, index) => {
      const candles = notificationQueries[index]?.data
      if (candles && candles.length > 0) {
        timeframeCandles.set(timeframeValue, candles)
      }
    })

    const results: HeatmapResult[] = []

    for (const entryTimeframe of HEATMAP_ENTRY_TIMEFRAMES) {
      const config = HEATMAP_CONFIGS[entryTimeframe]
      const existingState =
        baseState[entryTimeframe] ?? {
          lastSignalOpenTime: null,
          lastExtremeMarker: null,
          lastAlertSide: null,
        }
      const state = { ...existingState }

      const votesBreakdown: HeatmapResult['votes']['breakdown'] = []
      let bullVotes = 0
      let bearVotes = 0
      let totalVotes = 0

      const appendVote = (timeframeValue: string) => {
        const label = formatIntervalLabel(timeframeValue)
        const htfCloses = extractClosedCloses(
          timeframeCandles.get(timeframeValue),
          timeframeValue,
          config.confirmHtfClose,
        )

        let rsiValue: number | null = null
        if (htfCloses.length > 0) {
          const htfLength = config.rsiLenHtf[timeframeValue] ?? config.rsiLenLtf
          const rsiSeries = calculateRSI(htfCloses, htfLength)
          const lastIndex = findPreviousIndex(rsiSeries, rsiSeries.length - 1)
          if (lastIndex != null) {
            const candidate = rsiSeries[lastIndex]
            if (typeof candidate === 'number' && Number.isFinite(candidate)) {
              rsiValue = candidate
            }
          }
        }

        let vote: HeatmapResult['votes']['breakdown'][number]['vote'] = 'na'

        if (rsiValue != null) {
          totalVotes += 1
          if (rsiValue > HEATMAP_NEUTRAL_BAND.upper) {
            bullVotes += 1
            vote = 'bull'
          } else if (rsiValue < HEATMAP_NEUTRAL_BAND.lower) {
            bearVotes += 1
            vote = 'bear'
          } else {
            vote = 'neutral'
          }
        }

        votesBreakdown.push({ timeframe: timeframeValue, label, value: rsiValue, vote })
      }

      config.htfList.forEach((timeframeValue) => appendVote(timeframeValue))

      let bias: 'BULL' | 'BEAR' | 'NEUTRAL' = 'NEUTRAL'
      if (totalVotes > 0) {
        if (config.requireAllHtf) {
          if (bullVotes === totalVotes) {
            bias = 'BULL'
          } else if (bearVotes === totalVotes) {
            bias = 'BEAR'
          }
        } else if (bullVotes > bearVotes) {
          bias = 'BULL'
        } else if (bearVotes > bullVotes) {
          bias = 'BEAR'
        }
      }

      const entryCandles = timeframeCandles.get(entryTimeframe)

      if (!entryCandles || entryCandles.length === 0) {
        results.push({
          entryTimeframe,
          entryLabel: config.entryLabel,
          symbol: normalizedSymbol,
          evaluatedAt: null,
          closedAt: null,
          bias,
          strength: 'weak',
          signal: 'NONE',
          stochEvent: null,
          votes: {
            bull: bullVotes,
            bear: bearVotes,
            total: totalVotes,
            mode: config.requireAllHtf ? 'all' : 'majority',
            breakdown: votesBreakdown,
          },
          stochRsi: { k: null, d: null, rawNormalized: null },
          rsiLtf: { value: null, sma5: null, okLong: false, okShort: false },
          filters: {
            atrPct: null,
            atrBounds: { min: config.volMinAtrPct, max: config.volMaxAtrPct },
            atrStatus: 'missing',
            maSide: 'unknown',
            maLongOk: !config.useMa200Filter,
            maShortOk: !config.useMa200Filter,
            distPctToMa200: null,
            maDistanceStatus: config.useMa200Filter ? 'missing' : 'ok',
            useMa200Filter: config.useMa200Filter,
          },
          gating: {
            long: { timing: false, blockers: ['Awaiting data'] },
            short: { timing: false, blockers: ['Awaiting data'] },
          },
          cooldown: {
            requiredBars: config.coolDownBars,
            barsSinceSignal: null,
            ok: true,
            lastAlertSide: state.lastAlertSide,
            lastExtremeMarker: state.lastExtremeMarker,
          },
          risk: {
            atr: null,
            slLong: null,
            t1Long: null,
            t2Long: null,
            slShort: null,
            t1Short: null,
            t2Short: null,
          },
          price: null,
          ma200: { value: null, slope: null },
        })
        baseState[entryTimeframe] = state
        continue
      }

      const closesEntry = entryCandles.map((candle) => candle.close)
      const rsiSeries = calculateRSI(closesEntry, config.rsiLenLtf)
      const stochasticSeries = calculateStochasticRSI(rsiSeries, {
        stochLength: config.stochLenLtf,
        kSmoothing: config.kSmooth,
        dSmoothing: config.dSmooth,
      })
      const atrSeries = calculateATR(entryCandles, config.atrLength)
      const ma200Series = calculateSMA(closesEntry, 200)

      const latest = entryCandles[entryCandles.length - 1]
      const timeframeMs = timeframeToMillis(entryTimeframe)
      const latestRsiIndex = findPreviousIndex(rsiSeries, rsiSeries.length - 1)
      const latestRsi =
        latestRsiIndex != null ? rsiSeries[latestRsiIndex] ?? null : null
      const rsiSma5 = computeRecentAverage(rsiSeries, 5)

      const kValues = stochasticSeries.kValues
      const dValues = stochasticSeries.dValues
      const rawValues = stochasticSeries.rawValues
      const currentIndex = findAlignedIndex(kValues, dValues, kValues.length - 1)

      let currentK: number | null = null
      let currentD: number | null = null
      let rawNormalized: number | null = null
      let stochEvent: HeatmapResult['stochEvent'] = null
      let longTiming = false
      let shortTiming = false

      if (currentIndex != null && currentIndex > 0) {
        const previousIndex = findAlignedIndex(kValues, dValues, currentIndex - 1)
        if (previousIndex != null) {
          const candidateK = kValues[currentIndex]
          const candidateD = dValues[currentIndex]
          const prevK = kValues[previousIndex]
          const prevD = dValues[previousIndex]
          const rawValue = rawValues[currentIndex]

          if (
            typeof candidateK === 'number' &&
            Number.isFinite(candidateK) &&
            typeof candidateD === 'number' &&
            Number.isFinite(candidateD) &&
            typeof prevK === 'number' &&
            Number.isFinite(prevK) &&
            typeof prevD === 'number' &&
            Number.isFinite(prevD) &&
            typeof rawValue === 'number' &&
            Number.isFinite(rawValue)
          ) {
            currentK = candidateK
            currentD = candidateD
            rawNormalized = rawValue / 100

            const crossUp = prevK <= prevD && candidateK > candidateD
            const crossDown = prevK >= prevD && candidateK < candidateD

            longTiming = crossUp && rawNormalized < 0.2
            shortTiming = crossDown && rawNormalized > 0.8

            if (longTiming) {
              stochEvent = 'cross_up_from_oversold'
            } else if (shortTiming) {
              stochEvent = 'cross_down_from_overbought'
            }
          }
        }
      }

      if (longTiming && rawNormalized != null && rawNormalized < 0.2) {
        state.lastExtremeMarker = 'longExtremeSeen'
      }

      if (shortTiming && rawNormalized != null && rawNormalized > 0.8) {
        state.lastExtremeMarker = 'shortExtremeSeen'
      }

      const atrIndex = findPreviousIndex(atrSeries, atrSeries.length - 1)
      const latestAtr = atrIndex != null ? atrSeries[atrIndex] ?? null : null
      const maIndex = findPreviousIndex(ma200Series, ma200Series.length - 1)
      const latestMa200 = maIndex != null ? ma200Series[maIndex] ?? null : null
      const prevMaIndex =
        maIndex != null ? findPreviousIndex(ma200Series, maIndex - 1) : null
      const prevMa200 = prevMaIndex != null ? ma200Series[prevMaIndex] ?? null : null
      const ma200Slope =
        typeof latestMa200 === 'number' &&
        Number.isFinite(latestMa200) &&
        typeof prevMa200 === 'number' &&
        Number.isFinite(prevMa200)
          ? latestMa200 - prevMa200
          : null

      const price = latest?.close ?? null
      const atrPct =
        typeof latestAtr === 'number' &&
        Number.isFinite(latestAtr) &&
        typeof price === 'number' &&
        Number.isFinite(price)
          ? (100 * latestAtr) / price
          : null

      const atrStatus = atrPct == null
        ? 'missing'
        : atrPct < config.volMinAtrPct
        ? 'too-low'
        : atrPct > config.volMaxAtrPct
        ? 'too-high'
        : 'ok'

      const distToMa200 =
        typeof price === 'number' &&
        Number.isFinite(price) &&
        typeof latestMa200 === 'number' &&
        Number.isFinite(latestMa200)
          ? (Math.abs(price - latestMa200) / latestMa200) * 100
          : null

      const maSide: 'above' | 'below' | 'unknown' =
        typeof price === 'number' &&
        Number.isFinite(price) &&
        typeof latestMa200 === 'number' &&
        Number.isFinite(latestMa200)
          ? price >= latestMa200
            ? 'above'
            : 'below'
          : 'unknown'

      const maDistanceStatus: 'ok' | 'too-close' | 'missing' =
        !config.useMa200Filter || config.minDistToMa200 <= 0
          ? 'ok'
          : distToMa200 == null
          ? 'missing'
          : distToMa200 >= config.minDistToMa200
          ? 'ok'
          : 'too-close'

      const maLongOk = !config.useMa200Filter || maSide === 'above'
      const maShortOk = !config.useMa200Filter || maSide === 'below'

      const rsiOkLong =
        typeof latestRsi === 'number' && Number.isFinite(latestRsi)
          ? latestRsi > 50 || (rsiSma5 != null && latestRsi > rsiSma5)
          : false

      const rsiOkShort =
        typeof latestRsi === 'number' && Number.isFinite(latestRsi)
          ? latestRsi < 50 || (rsiSma5 != null && latestRsi < rsiSma5)
          : false

      const barsSinceSignalBefore =
        timeframeMs &&
        typeof timeframeMs === 'number' &&
        state.lastSignalOpenTime != null &&
        latest
          ? Math.floor((latest.openTime - state.lastSignalOpenTime) / timeframeMs)
          : null

      const coolDownOk =
        state.lastSignalOpenTime == null ||
        (barsSinceSignalBefore != null && barsSinceSignalBefore >= config.coolDownBars)

      const atrFilterOk = atrStatus === 'ok'
      const distanceFilterOk =
        !config.useMa200Filter || maDistanceStatus === 'ok'

      const longSignal =
        longTiming &&
        bias === 'BULL' &&
        rsiOkLong &&
        maLongOk &&
        coolDownOk &&
        atrFilterOk &&
        distanceFilterOk

      const shortSignal =
        shortTiming &&
        bias === 'BEAR' &&
        rsiOkShort &&
        maShortOk &&
        coolDownOk &&
        atrFilterOk &&
        distanceFilterOk

      if (longSignal && latest) {
        state.lastSignalOpenTime = latest.openTime
        state.lastAlertSide = 'LONG'
      } else if (shortSignal && latest) {
        state.lastSignalOpenTime = latest.openTime
        state.lastAlertSide = 'SHORT'
      }

      const barsSinceSignalAfter =
        timeframeMs &&
        typeof timeframeMs === 'number' &&
        state.lastSignalOpenTime != null &&
        latest
          ? Math.floor((latest.openTime - state.lastSignalOpenTime) / timeframeMs)
          : null

      const cooldownOkAfter =
        state.lastSignalOpenTime == null ||
        (barsSinceSignalAfter != null && barsSinceSignalAfter >= config.coolDownBars)

      const longBlockers: string[] = []
      if (!longTiming) {
        longBlockers.push('No bullish cross')
      }
      if (bias !== 'BULL') {
        longBlockers.push('Bias not bullish')
      }
      if (!rsiOkLong) {
        longBlockers.push('RSI guard')
      }
      if (!maLongOk) {
        longBlockers.push('Price below MA200')
      }
      if (config.useMa200Filter) {
        if (maDistanceStatus === 'too-close') {
          longBlockers.push('Inside MA200 buffer')
        }
        if (maDistanceStatus === 'missing') {
          longBlockers.push('MA200 distance unavailable')
        }
      }
      if (atrStatus === 'too-low') {
        longBlockers.push('ATR below minimum')
      } else if (atrStatus === 'too-high') {
        longBlockers.push('ATR above maximum')
      } else if (atrStatus === 'missing') {
        longBlockers.push('ATR unavailable')
      }
      if (!coolDownOk) {
        longBlockers.push(
          `Cooldown ${barsSinceSignalBefore ?? 0}/${config.coolDownBars}`,
        )
      }

      const shortBlockers: string[] = []
      if (!shortTiming) {
        shortBlockers.push('No bearish cross')
      }
      if (bias !== 'BEAR') {
        shortBlockers.push('Bias not bearish')
      }
      if (!rsiOkShort) {
        shortBlockers.push('RSI guard')
      }
      if (!maShortOk) {
        shortBlockers.push('Price above MA200')
      }
      if (config.useMa200Filter) {
        if (maDistanceStatus === 'too-close') {
          shortBlockers.push('Inside MA200 buffer')
        }
        if (maDistanceStatus === 'missing') {
          shortBlockers.push('MA200 distance unavailable')
        }
      }
      if (atrStatus === 'too-low') {
        shortBlockers.push('ATR below minimum')
      } else if (atrStatus === 'too-high') {
        shortBlockers.push('ATR above maximum')
      } else if (atrStatus === 'missing') {
        shortBlockers.push('ATR unavailable')
      }
      if (!coolDownOk) {
        shortBlockers.push(
          `Cooldown ${barsSinceSignalBefore ?? 0}/${config.coolDownBars}`,
        )
      }

      const direction = longSignal ? 'long' : shortSignal ? 'short' : null
      const maSlopeOk =
        direction === 'long'
          ? (ma200Slope ?? 0) >= 0
          : direction === 'short'
          ? (ma200Slope ?? 0) <= 0
          : true
      const strength = riskGradeFromSignal({
        votes: { bull: bullVotes, bear: bearVotes, total: totalVotes },
        maSlopeOk,
      })

      const priceValue =
        typeof price === 'number' && Number.isFinite(price) ? price : NaN
      const atrValue =
        typeof latestAtr === 'number' && Number.isFinite(latestAtr)
          ? latestAtr
          : NaN
      const riskBlock = buildAtrRiskLevels(priceValue, atrValue, config)

      const signal: 'LONG' | 'SHORT' | 'NONE' = longSignal
        ? 'LONG'
        : shortSignal
        ? 'SHORT'
        : 'NONE'

      const evaluatedAt = latest?.openTime ?? null
      const closedAt =
        timeframeMs && typeof timeframeMs === 'number' && latest
          ? latest.openTime + timeframeMs
          : null

      results.push({
        entryTimeframe,
        entryLabel: config.entryLabel,
        symbol: normalizedSymbol,
        evaluatedAt,
        closedAt,
        bias,
        strength,
        signal,
        stochEvent,
        votes: {
          bull: bullVotes,
          bear: bearVotes,
          total: totalVotes,
          mode: config.requireAllHtf ? 'all' : 'majority',
          breakdown: votesBreakdown,
        },
        stochRsi: {
          k: typeof currentK === 'number' ? currentK : null,
          d: typeof currentD === 'number' ? currentD : null,
          rawNormalized,
        },
        rsiLtf: {
          value:
            typeof latestRsi === 'number' && Number.isFinite(latestRsi)
              ? latestRsi
              : null,
          sma5: rsiSma5,
          okLong: rsiOkLong,
          okShort: rsiOkShort,
        },
        filters: {
          atrPct,
          atrBounds: { min: config.volMinAtrPct, max: config.volMaxAtrPct },
          atrStatus,
          maSide,
          maLongOk,
          maShortOk,
          distPctToMa200: distToMa200,
          maDistanceStatus,
          useMa200Filter: config.useMa200Filter,
        },
        gating: {
          long: { timing: longTiming, blockers: longBlockers },
          short: { timing: shortTiming, blockers: shortBlockers },
        },
        cooldown: {
          requiredBars: config.coolDownBars,
          barsSinceSignal: barsSinceSignalAfter,
          ok: cooldownOkAfter,
          lastAlertSide: state.lastAlertSide,
          lastExtremeMarker: state.lastExtremeMarker,
        },
        risk: {
          atr: riskBlock?.atr ?? null,
          slLong: riskBlock?.long.SL ?? null,
          t1Long: riskBlock?.long.T1 ?? null,
          t2Long: riskBlock?.long.T2 ?? null,
          slShort: riskBlock?.short.SL ?? null,
          t1Short: riskBlock?.short.T1 ?? null,
          t2Short: riskBlock?.short.T2 ?? null,
        },
        price: typeof price === 'number' && Number.isFinite(price) ? price : null,
        ma200: {
          value:
            typeof latestMa200 === 'number' && Number.isFinite(latestMa200)
              ? latestMa200
              : null,
          slope: ma200Slope,
        },
      })

      baseState[entryTimeframe] = state
    }

    heatmapStateRef.current = baseState
    return results
  }, [
    canStreamSymbol,
    notificationQueries,
    notificationTimeframes,
    normalizedSymbol,
  ])

  const momentumThresholds = useMemo(() => {
    const clamp = (value: string, fallback: number) => {
      const parsed = Number(value)
      if (!Number.isFinite(parsed)) {
        return fallback
      }
      return Math.min(Math.max(parsed, 0), 100)
    }

    const rsiLower = clamp(rsiLowerBoundInput, DEFAULT_MOMENTUM_BOUNDS.rsiLower)
    const rsiUpper = clamp(rsiUpperBoundInput, DEFAULT_MOMENTUM_BOUNDS.rsiUpper)
    const stochasticLower = clamp(
      stochasticLowerBoundInput,
      DEFAULT_MOMENTUM_BOUNDS.stochasticLower,
    )
    const stochasticUpper = clamp(
      stochasticUpperBoundInput,
      DEFAULT_MOMENTUM_BOUNDS.stochasticUpper,
    )

    return {
      rsiLower,
      rsiUpper,
      stochasticLower,
      stochasticUpper,
      longRsi: Math.min(rsiLower, rsiUpper),
      shortRsi: Math.max(rsiLower, rsiUpper),
      longStochastic: Math.min(stochasticLower, stochasticUpper),
      shortStochastic: Math.max(stochasticLower, stochasticUpper),
    }
  }, [
    rsiLowerBoundInput,
    rsiUpperBoundInput,
    stochasticLowerBoundInput,
    stochasticUpperBoundInput,
  ])

  const rsiGuideLines = useMemo(
    () => [
      {
        value: momentumThresholds.shortRsi,
        label: GUIDE_VALUE_FORMATTER.format(momentumThresholds.shortRsi),
        color: 'rgba(239, 68, 68, 0.7)',
      },
      { value: 50, label: '50', color: 'rgba(148, 163, 184, 0.5)' },
      {
        value: momentumThresholds.longRsi,
        label: GUIDE_VALUE_FORMATTER.format(momentumThresholds.longRsi),
        color: 'rgba(16, 185, 129, 0.7)',
      },
    ],
    [momentumThresholds.longRsi, momentumThresholds.shortRsi],
  )

  const stochasticGuideLines = useMemo(
    () => [
      {
        value: momentumThresholds.shortStochastic,
        label: GUIDE_VALUE_FORMATTER.format(momentumThresholds.shortStochastic),
        color: 'rgba(239, 68, 68, 0.7)',
      },
      { value: 50, label: '50', color: 'rgba(148, 163, 184, 0.5)' },
      {
        value: momentumThresholds.longStochastic,
        label: GUIDE_VALUE_FORMATTER.format(momentumThresholds.longStochastic),
        color: 'rgba(16, 185, 129, 0.7)',
      },
    ],
    [momentumThresholds.longStochastic, momentumThresholds.shortStochastic],
  )

  useEffect(() => {
    const sanitized = momentumThresholds.rsiLower.toString()
    if (sanitized !== rsiLowerBoundInput) {
      setRsiLowerBoundInput(sanitized)
    }
  }, [momentumThresholds.rsiLower, rsiLowerBoundInput])

  useEffect(() => {
    const sanitized = momentumThresholds.rsiUpper.toString()
    if (sanitized !== rsiUpperBoundInput) {
      setRsiUpperBoundInput(sanitized)
    }
  }, [momentumThresholds.rsiUpper, rsiUpperBoundInput])

  useEffect(() => {
    const sanitized = momentumThresholds.stochasticLower.toString()
    if (sanitized !== stochasticLowerBoundInput) {
      setStochasticLowerBoundInput(sanitized)
    }
  }, [momentumThresholds.stochasticLower, stochasticLowerBoundInput])

  useEffect(() => {
    const sanitized = momentumThresholds.stochasticUpper.toString()
    if (sanitized !== stochasticUpperBoundInput) {
      setStochasticUpperBoundInput(sanitized)
    }
  }, [momentumThresholds.stochasticUpper, stochasticUpperBoundInput])

  useEffect(() => {
    lastMomentumTriggerRef.current = null
  }, [
    momentumThresholds.longRsi,
    momentumThresholds.shortRsi,
    momentumThresholds.longStochastic,
    momentumThresholds.shortStochastic,
  ])

  useEffect(() => {
    lastHeatmapTriggersRef.current = {}
    lastHeatmapStatusRef.current = {}
  }, [normalizedSymbol])

  const visibleMomentumNotifications = useMemo(() => momentumNotifications, [momentumNotifications])
  const visibleMovingAverageNotifications = useMemo(
    () => movingAverageNotifications,
    [movingAverageNotifications],
  )
  const visibleHeatmapNotifications = useMemo(
    () => heatmapNotifications,
    [heatmapNotifications],
  )

  const handleClearNotifications = useCallback(() => {
    setMomentumNotifications([])
    setMovingAverageNotifications([])
    setHeatmapNotifications([])
  }, [])

  useEffect(() => {
    movingAverageNotificationTimeframes.forEach((timeframeValue, index) => {
      const query = movingAverageNotificationQueries[index]
      const candles = query?.data

      if (!candles || candles.length < 2) {
        return
      }

      const closesForTimeframe = candles.map((candle) => candle.close)
      const ema10Series = calculateEMA(closesForTimeframe, 10)
      const ema50Series = calculateEMA(closesForTimeframe, 50)
      const sma200Series = calculateSMA(closesForTimeframe, 200)

      const pairs = [
        {
          fast: ema10Series,
          slow: ema50Series,
          pairLabel: 'EMA 10 / EMA 50',
          intensity: 'green' as const,
          tag: 'ema10-ema50',
        },
        {
          fast: ema10Series,
          slow: sma200Series,
          pairLabel: 'EMA 10 / MA 200',
          intensity: 'yellow' as const,
          tag: 'ema10-ma200',
        },
        {
          fast: ema50Series,
          slow: sma200Series,
          pairLabel: 'EMA 50 / MA 200',
          intensity: 'orange' as const,
          tag: 'ema50-ma200',
        },
      ]

      pairs.forEach((config) => {
        const cross = detectLatestCross(config.fast, config.slow)

        if (!cross || cross.index !== candles.length - 1) {
          return
        }

        const candle = candles[cross.index]

        if (!candle) {
          return
        }

        const price = candle.close

        if (!Number.isFinite(price)) {
          return
        }

        const timeframeLabel = formatIntervalLabel(timeframeValue)
        const directionLabel = cross.direction === 'golden' ? 'Golden cross' : 'Death cross'
        const signatureKey = `${normalizedSymbol}-${timeframeValue}-${config.tag}`
        const signature = `${signatureKey}-${cross.direction}-${candle.openTime}`

        if (lastMovingAverageTriggersRef.current[signatureKey] === signature) {
          return
        }

        lastMovingAverageTriggersRef.current[signatureKey] = signature

        const entry: MovingAverageCrossNotification = {
          id: signature,
          symbol: normalizedSymbol,
          timeframe: timeframeValue,
          timeframeLabel,
          pairLabel: config.pairLabel,
          direction: cross.direction,
          intensity: config.intensity,
          price,
          triggeredAt: candle.openTime ?? Date.now(),
        }

        setMovingAverageNotifications((previous) => {
          const next = [entry, ...previous.filter((item) => item.id !== entry.id)]
          return next.slice(0, MAX_MOVING_AVERAGE_NOTIFICATIONS)
        })

        const emoji = MOMENTUM_EMOJI_BY_INTENSITY[config.intensity]
        const priceLabel = price.toFixed(5)
        const bodyDirection = directionLabel.toLowerCase()

        void showAppNotification({
          title: `${emoji} ${normalizedSymbol} ${timeframeLabel} ${directionLabel}`,
          body: `${config.pairLabel} ${bodyDirection} at ${priceLabel}`,
          tag: signature,
          data: {
            symbol: normalizedSymbol,
            timeframe: timeframeValue,
            pair: config.tag,
            direction: cross.direction,
          },
        })
      })
    })
  }, [
    lastMovingAverageTriggersRef,
    movingAverageNotificationQueries,
    movingAverageNotificationTimeframes,
    normalizedSymbol,
  ])

  useEffect(() => {
    if (heatmapResults.length === 0) {
      return
    }

    const equityValue = Number(currentEquityInput)
    const accountState = Number.isFinite(equityValue) && equityValue > 0
      ? createDefaultAccountState({
          equity: equityValue,
          equityPeak: Math.max(equityValue, equityValue),
        })
      : createDefaultAccountState()

    const riskBudgetValue = Number(riskBudgetPercentInput)
    const riskOverrides: RiskConfig = {}

    if (Number.isFinite(riskBudgetValue) && riskBudgetValue > 0) {
      riskOverrides.baseRiskWeakPct = riskBudgetValue
      riskOverrides.baseRiskStdPct = riskBudgetValue
      riskOverrides.baseRiskStrongPct = riskBudgetValue
      riskOverrides.instrumentRiskCapPct = riskBudgetValue
      riskOverrides.maxOpenRiskPctPortfolio = riskBudgetValue * 4
    }

    heatmapResults.forEach((result) => {
      if (!result) {
        return
      }

      const signatureKey = `${result.symbol}-${result.entryTimeframe}`
      const triggerAt = result.closedAt ?? result.evaluatedAt ?? Date.now()
      const statusSignature = `${result.signal}|${result.strength}|${result.bias}`
      const previousStatusSignature = lastHeatmapStatusRef.current[signatureKey]

      if (previousStatusSignature !== statusSignature) {
        lastHeatmapStatusRef.current[signatureKey] = statusSignature

        if (previousStatusSignature != null && result.signal === 'NONE') {
          const statusLabel = HEATMAP_SIGNAL_LABELS[result.signal]
          const statusSummary = `${statusLabel} · Strength · ${result.strength} · Bias · ${result.bias}`
          const statusEmoji = HEATMAP_STATUS_EMOJI_BY_BIAS[result.bias] ?? '⚪️'

          const statusNotificationId = `${signatureKey}-status-${triggerAt}`

          void showAppNotification({
            title: `${statusEmoji} Heatmap ${result.entryLabel} status ${result.symbol}`,
            body: statusSummary,
            tag: `${signatureKey}-status`,
            data: {
              type: 'heatmap-status',
              source: 'client',
              symbol: result.symbol,
              entryTimeframe: result.entryTimeframe,
              status: {
                signal: result.signal,
                strength: result.strength,
                bias: result.bias,
              },
            },
          })

          const statusEntry: HeatmapNotification = {
            id: statusNotificationId,
            kind: 'status',
            symbol: result.symbol,
            entryTimeframe: result.entryTimeframe,
            entryLabel: result.entryLabel,
            direction: result.signal,
            bias: result.bias,
            strength: result.strength,
            statusSummary,
            triggeredAt: triggerAt,
          }

          setHeatmapNotifications((previous) => {
            const filtered = previous.filter(
              (item) =>
                item.id !== statusEntry.id &&
                !(
                  item.kind === 'status' &&
                  item.symbol === statusEntry.symbol &&
                  item.entryTimeframe === statusEntry.entryTimeframe
                ),
            )

            const next = [statusEntry, ...filtered]
            return next.slice(0, MAX_HEATMAP_NOTIFICATIONS)
          })
        }
      }

      if (result.signal === 'NONE') {
        return
      }

      const signature = `${signatureKey}-${result.signal}-${triggerAt}`

      if (lastHeatmapTriggersRef.current[signatureKey] === signature) {
        return
      }

      lastHeatmapTriggersRef.current[signatureKey] = signature

      const timeframeConfig =
        HEATMAP_CONFIGS[result.entryTimeframe as HeatmapEntryTimeframe]
      if (!timeframeConfig) {
        return
      }

      const riskConfig = createRiskConfigFromHeatmapConfig(timeframeConfig, {
        ...riskOverrides,
      })

      const rsiHtfPayload = result.votes.breakdown.reduce<Record<string, number | null>>(
        (acc, entry) => {
          if (entry?.label) {
            acc[entry.label] = entry.value ?? null
          }
          return acc
        },
        {},
      )

      const alertPayload = buildAlert(
        {
          side: result.signal,
          symbol: result.symbol,
          entryTF: result.entryTimeframe,
          strengthHint: result.strength,
          bias: result.bias,
          votes: {
            bull: result.votes.bull,
            bear: result.votes.bear,
            total: result.votes.total,
          },
          atrPct: result.filters.atrPct,
          atr: result.risk.atr,
          price: result.price,
          rsiHTF: rsiHtfPayload,
          rsiLTF: result.rsiLtf.value,
          stochrsi: {
            k: result.stochRsi.k,
            d: result.stochRsi.d,
            rawNormalized: result.stochRsi.rawNormalized,
            event: result.stochEvent,
          },
          filters: result.filters,
          barTimeISO: Number.isFinite(triggerAt)
            ? new Date(triggerAt).toISOString()
            : null,
        },
        riskConfig,
        accountState,
      )

      const riskPlan = alertPayload.risk_plan
      const blockedReason = alertPayload.portfolio_check.reason
      const readableReason =
        typeof blockedReason === 'string'
          ? blockedReason.replace(/_/g, ' ')
          : 'check limits'

      const riskSummary = riskPlan
        ? `Risk ${riskPlan.finalRiskPct.toFixed(2)}%`
        : `Risk blocked (${readableReason})`

      const directionLabel = result.signal === 'LONG' ? 'Long' : 'Short'
      const title = `${result.signal === 'LONG' ? '🟢' : '🔴'} Heatmap ${directionLabel} ${result.symbol} ${result.entryLabel}`
      const bodyParts = [
        `${result.symbol} ${result.entryLabel} bias ${result.bias}`,
        `Strength ${alertPayload.strength ?? result.strength}`,
        riskSummary,
      ]
      const body = bodyParts.filter(Boolean).join(' — ')

      void showAppNotification({
        title,
        body,
        tag: signature,
        data: {
          type: 'heatmap',
          source: 'client',
          symbol: result.symbol,
          direction: result.signal,
          entryTimeframe: result.entryTimeframe,
          alert: alertPayload,
        },
      })

      const entry: HeatmapNotification = {
        id: signature,
        kind: 'signal',
        symbol: result.symbol,
        entryTimeframe: result.entryTimeframe,
        entryLabel: result.entryLabel,
        direction: result.signal,
        bias: result.bias,
        strength: alertPayload.strength ?? result.strength,
        alert: alertPayload,
        triggeredAt: triggerAt,
      }

      setHeatmapNotifications((previous) => {
        const filtered = previous.filter(
          (item) =>
            item.id !== entry.id &&
            !(
              item.kind === 'status' &&
              item.symbol === entry.symbol &&
              item.entryTimeframe === entry.entryTimeframe
            ),
        )
        const next = [entry, ...filtered]
        return next.slice(0, MAX_HEATMAP_NOTIFICATIONS)
      })
    })
  }, [
    heatmapResults,
    currentEquityInput,
    riskBudgetPercentInput,
    lastHeatmapTriggersRef,
  ])

  useEffect(() => {
    const timeframeResults: Array<MomentumComputation | null> = notificationTimeframes.map((timeframeValue, index) => {
      const query = notificationQueries[index]
      const candles = query?.data

      if (!candles || candles.length === 0) {
        return null
      }

      const latest = candles[candles.length - 1]

      if (!latest) {
        return null
      }

      const closesForTimeframe = candles.map((candle) => candle.close)
      const timeframeRsiSetting = RSI_SETTINGS[timeframeValue] ?? DEFAULT_RSI_SETTING
      const timeframeStochasticSetting =
        STOCHASTIC_SETTINGS[timeframeValue] ?? DEFAULT_STOCHASTIC_SETTING

      const timeframeRsiValues = calculateRSI(closesForTimeframe, timeframeRsiSetting.period)
      const timeframeStochasticRsiValues = calculateRSI(
        closesForTimeframe,
        timeframeStochasticSetting.rsiLength,
      )

      const timeframeStochasticSeries = calculateStochasticRSI(timeframeStochasticRsiValues, {
        stochLength: timeframeStochasticSetting.stochLength,
        kSmoothing: timeframeStochasticSetting.kSmoothing,
        dSmoothing: timeframeStochasticSetting.dSmoothing,
      })

      const latestRsi = timeframeRsiValues[timeframeRsiValues.length - 1]
      const latestStochasticD =
        timeframeStochasticSeries.dValues[timeframeStochasticSeries.dValues.length - 1]
      const timeframeLabel = formatIntervalLabel(timeframeValue)

      if (typeof latestRsi !== 'number' || typeof latestStochasticD !== 'number') {
        return null
      }

      const isLongTrigger =
        latestRsi < momentumThresholds.longRsi &&
        latestStochasticD < momentumThresholds.longStochastic
      const isShortTrigger =
        latestRsi > momentumThresholds.shortRsi &&
        latestStochasticD > momentumThresholds.shortStochastic

      let direction: 'long' | 'short' | null = null

      if (isLongTrigger) {
        direction = 'long'
      } else if (isShortTrigger) {
        direction = 'short'
      }

      return {
        timeframe: timeframeValue,
        timeframeLabel,
        rsi: latestRsi,
        stochasticD: latestStochasticD,
        openTime: latest.openTime,
        direction,
      }
    })

    const primary = timeframeResults[0]

    if (!primary || !primary.direction) {
      return
    }

    const matchingReadings: MomentumComputation[] = []

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

    const signatureParts = matchingReadings.map(
      (reading) => `${reading.timeframe}:${reading.openTime ?? '0'}`,
    )
    const signature = `${normalizedSymbol}-${primary.direction}-${signatureParts.join('|')}`

    if (lastMomentumTriggerRef.current === signature) {
      return
    }

    lastMomentumTriggerRef.current = signature

    const readings: MomentumReading[] = matchingReadings.map(
      ({ timeframe, timeframeLabel, rsi, stochasticD, openTime }) => ({
        timeframe,
        timeframeLabel,
        rsi,
        stochasticD,
        openTime,
      }),
    )

    const timeframeSummary = readings
      .map((reading) => reading.timeframeLabel)
      .join(' • ')
    const rsiSummary = readings
      .map((reading) => `${reading.timeframeLabel} ${reading.rsi.toFixed(2)}`)
      .join(' • ')
    const stochasticSummary = readings
      .map((reading) => `${reading.timeframeLabel} ${reading.stochasticD.toFixed(2)}`)
      .join(' • ')
    const directionLabel = primary.direction === 'long' ? 'Long' : 'Short'
    const momentumLabel = `${directionLabel} momentum ${timeframeSummary} Rsi ${rsiSummary} Stoch Rsi (stochastic rsi %d ${stochasticSummary})`
    const emoji = MOMENTUM_EMOJI_BY_INTENSITY[intensity]

    const entry: MomentumNotification = {
      id: signature,
      symbol: normalizedSymbol,
      direction: primary.direction,
      intensity,
      label: momentumLabel,
      timeframeSummary,
      rsiSummary,
      stochasticSummary,
      readings,
      triggeredAt: readings[0]?.openTime ?? Date.now(),
    }

    setMomentumNotifications((previous) => {
      const next = [entry, ...previous.filter((item) => item.id !== entry.id)]
      return next.slice(0, MAX_MOMENTUM_NOTIFICATIONS)
    })

    void showAppNotification({
      title: `${emoji} ${momentumLabel}`,
      body: `${normalizedSymbol} — Rsi ${rsiSummary} • Stoch Rsi (stochastic rsi %d ${stochasticSummary})`,
      tag: signature,
      data: {
        symbol: normalizedSymbol,
        direction: primary.direction,
        timeframes: readings.map((reading) => reading.timeframe),
      },
    })
  }, [
    notificationQueries,
    notificationTimeframes,
    momentumThresholds,
    normalizedSymbol,
  ])

  const canInstall = useMemo(() => !!installPromptEvent, [installPromptEvent])

  const dismissUpdateBanner = useCallback(() => {
    setShowUpdateBanner(false)
  }, [])

  const dismissOfflineReadyBanner = useCallback(() => {
    setShowOfflineReadyBanner(false)
  }, [])

  const toggleMarketSummary = useCallback(() => {
    setIsMarketSummaryCollapsed((previous) => !previous)
  }, [])

  const dismissMomentumNotification = useCallback((notificationId: string) => {
    setMomentumNotifications((previous) =>
      previous.filter((notification) => notification.id !== notificationId),
    )
  }, [])

  const dismissHeatmapNotification = useCallback((notificationId: string) => {
    setHeatmapNotifications((previous) =>
      previous.filter((notification) => notification.id !== notificationId),
    )
  }, [])

  const dismissMovingAverageNotification = useCallback((notificationId: string) => {
    setMovingAverageNotifications((previous) =>
      previous.filter((notification) => notification.id !== notificationId),
    )
  }, [])

  const formatTriggeredAtLabel = useCallback(formatTriggeredAt, [])

  const handleInstall = async () => {
    if (!installPromptEvent) {
      return
    }

    await installPromptEvent.prompt()
    await installPromptEvent.userChoice
    setInstallPromptEvent(null)
  }

  const handleUpdate = async () => {
    if (updateServiceWorker) {
      await updateServiceWorker(true)
    }
    setShowUpdateBanner(false)
  }

  const handleManualRefresh = async () => {
    if (!canStreamSymbol) {
      return
    }

    await refetch()

    await Promise.all([
      ...notificationQueries.map((query) =>
        query.refetch ? query.refetch({ cancelRefetch: false }) : Promise.resolve(null),
      ),
      ...movingAverageNotificationQueries.map((query) =>
        query.refetch ? query.refetch({ cancelRefetch: false }) : Promise.resolve(null),
      ),
    ])
  }

  return (
    <DashboardView
      canInstall={canInstall}
      isFetching={isFetching}
      onManualRefresh={handleManualRefresh}
      onInstall={handleInstall}
      showUpdateBanner={showUpdateBanner}
      onDismissUpdateBanner={dismissUpdateBanner}
      onUpdate={handleUpdate}
      showOfflineReadyBanner={showOfflineReadyBanner}
      onDismissOfflineReadyBanner={dismissOfflineReadyBanner}
      symbol={symbol}
      onSymbolChange={setSymbol}
      timeframe={timeframe}
      timeframeOptions={TIMEFRAMES}
      onTimeframeChange={setTimeframe}
      barSelection={barSelection}
      barCountOptions={BAR_COUNT_OPTIONS}
      onBarSelectionChange={setBarSelection}
      customBarCount={customBarCount}
      onCustomBarCountChange={setCustomBarCount}
      maxBarLimit={MAX_BAR_LIMIT}
      refreshSelection={refreshSelection}
      refreshOptions={REFRESH_OPTIONS}
      onRefreshSelectionChange={setRefreshSelection}
      customRefresh={customRefresh}
      onCustomRefreshChange={setCustomRefresh}
      pushServerConnected={pushServerConnected}
      supportsNotifications={supportsNotifications}
      notificationPermission={notificationPermission}
      onEnableNotifications={handleEnableNotifications}
      isLoading={isLoading}
      isError={isError}
      error={error}
      rsiLowerBoundInput={rsiLowerBoundInput}
      onRsiLowerBoundInputChange={setRsiLowerBoundInput}
      rsiUpperBoundInput={rsiUpperBoundInput}
      onRsiUpperBoundInputChange={setRsiUpperBoundInput}
      stochasticLowerBoundInput={stochasticLowerBoundInput}
      onStochasticLowerBoundInputChange={setStochasticLowerBoundInput}
      stochasticUpperBoundInput={stochasticUpperBoundInput}
      onStochasticUpperBoundInputChange={setStochasticUpperBoundInput}
      currentEquity={currentEquityInput}
      onCurrentEquityChange={setCurrentEquityInput}
      riskBudgetPercent={riskBudgetPercentInput}
      onRiskBudgetPercentChange={setRiskBudgetPercentInput}
      atrMultiplier={atrMultiplierInput}
      onAtrMultiplierChange={setAtrMultiplierInput}
      momentumThresholds={momentumThresholds}
      visibleMomentumNotifications={visibleMomentumNotifications}
      visibleMovingAverageNotifications={visibleMovingAverageNotifications}
      visibleHeatmapNotifications={visibleHeatmapNotifications}
      formatTriggeredAt={formatTriggeredAtLabel}
      onDismissMomentumNotification={dismissMomentumNotification}
      onDismissHeatmapNotification={dismissHeatmapNotification}
      onDismissMovingAverageNotification={dismissMovingAverageNotification}
      onClearNotifications={handleClearNotifications}
      lastUpdatedLabel={lastUpdatedLabel}
      refreshInterval={refreshInterval}
      formatIntervalLabel={formatIntervalLabel}
      resolvedBarLimit={resolvedBarLimit}
      latestCandle={latestCandle}
      priceChange={priceChange}
      isMarketSummaryCollapsed={isMarketSummaryCollapsed}
      onToggleMarketSummary={toggleMarketSummary}
      movingAverageSeries={movingAverageSeries}
      heatmapResults={heatmapResults}
      rsiLengthDescription={rsiLengthDescription}
      rsiValues={rsiValues}
      labels={labels}
      rsiGuideLines={rsiGuideLines}
      stochasticLengthDescription={stochasticLengthDescription}
      stochasticSeries={stochasticSeries}
      stochasticGuideLines={stochasticGuideLines}
    />
  )
}

export default App
