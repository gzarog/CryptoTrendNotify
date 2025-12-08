
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

import { MainLayout } from './layouts/MainLayout'
import { DashboardView } from './components/DashboardView'
import { formatDegrees } from './components/signals/quantumFlipThresholdShared'
import {
  calculateEMA,
  calculateADX,
  calculateMACD,
  calculateRSI,
  calculateSMA,
  calculateStochasticRSI,
} from './lib/indicators'
import { deriveSignalsFromHeatmap, deriveTimeframeSnapshots } from './lib/signals'
import { deriveQuantumCompositeSignal } from './lib/quantum'
import { fetchHeatmapResults } from './lib/heatmap'
import type { HeatmapResult } from './types/heatmap'
import {
  showAppNotification,
} from './lib/notifications'
import type {
  CombinedSignalNotification,
  SignalNotification,
  TimeframeSignalSnapshot,
  TradingSignal,
} from './types/signals'
import type {
  MomentumNotification,
  MovingAverageCrossNotification,
  MovingAverageMarker,
  QuantumPhaseNotification,
  MomentumIntensity,
  MomentumReading,
  MomentumComputation
} from './types/app'
import { TIMEFRAMES } from './constants/timeframes'
import { useMarketData, useMultiFrameMarketData } from './hooks/useMarketData'
import { usePushNotifications } from './hooks/usePushNotifications'
import { useHeatmapData } from './hooks/useHeatmapData'

// Re-export types for backward compatibility if needed, though they are now in types/app
export type { MomentumIntensity, MomentumNotification, MovingAverageCrossNotification, MovingAverageMarker, QuantumPhaseNotification } from './types/app'

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

const STOCHASTIC_SETTINGS: Record<string, { rsiLength: number; stochLength: number; kSmoothing: number; dSmoothing: number; label: string }> = {
  '5': { rsiLength: 7, stochLength: 7, kSmoothing: 2, dSmoothing: 2, label: 'RSI 7 • Stoch 7 • %K 2 • %D 2' },
  '15': { rsiLength: 9, stochLength: 9, kSmoothing: 2, dSmoothing: 3, label: 'RSI 9 • Stoch 9 • %K 2 • %D 3' },
  '30': { rsiLength: 12, stochLength: 12, kSmoothing: 3, dSmoothing: 3, label: 'RSI 12 • Stoch 12 • %K 3 • %D 3' },
  '60': { rsiLength: 14, stochLength: 14, kSmoothing: 3, dSmoothing: 3, label: 'RSI 14 • Stoch 14 • %K 3 • %D 3' },
  '120': { rsiLength: 16, stochLength: 16, kSmoothing: 3, dSmoothing: 3, label: 'RSI 16 • Stoch 16 • %K 3 • %D 3' },
  '240': { rsiLength: 21, stochLength: 21, kSmoothing: 4, dSmoothing: 4, label: 'RSI 21 • Stoch 21 • %K 4 (3–4) • %D 4 (3–4)' },
  '360': { rsiLength: 24, stochLength: 24, kSmoothing: 4, dSmoothing: 4, label: 'RSI 24 • Stoch 24 • %K 4 • %D 4' },
}

const DEFAULT_STOCHASTIC_SETTING = {
  rsiLength: 14,
  stochLength: 14,
  kSmoothing: 3,
  dSmoothing: 3,
  label: 'RSI 14 • Stoch 14 • %K 3 • %D 3',
}

const ADX_SETTINGS: Record<string, { length: number; signal: number; label: string }> = {
  '5': { length: 9, signal: 2, label: 'ADX 9 • Signal 2' },
  '15': { length: 12, signal: 3, label: 'ADX 12 • Signal 3' },
  '30': { length: 14, signal: 3, label: 'ADX 14 • Signal 3' },
  '60': { length: 18, signal: 3, label: 'ADX 18 • Signal 3' },
  '120': { length: 20, signal: 4, label: 'ADX 20 • Signal 4' },
  '240': { length: 24, signal: 5, label: 'ADX 24 • Signal 5' },
  '360': { length: 29, signal: 6, label: 'ADX 29 • Signal 6' },
}

const DEFAULT_ADX_SETTING = { length: 14, signal: 3, label: 'ADX 14 • Signal 3' }

const MACD_SETTINGS: Record<
  string,
  { fast: number; slow: number; signal: number; label: string }
> = {
  '5': { fast: 8, slow: 21, signal: 5, label: 'EMA 8 • EMA 21 • Signal 5' },
  '15': { fast: 10, slow: 24, signal: 7, label: 'EMA 10 • EMA 24 • Signal 7' },
  '30': { fast: 12, slow: 26, signal: 9, label: 'EMA 12 • EMA 26 • Signal 9' },
  '60': { fast: 12, slow: 30, signal: 9, label: 'EMA 12 • EMA 30 • Signal 9' },
  '120': { fast: 16, slow: 36, signal: 9, label: 'EMA 16 • EMA 36 • Signal 9' },
  '240': { fast: 20, slow: 40, signal: 9, label: 'EMA 20 • EMA 40 • Signal 9' },
  '360': { fast: 22, slow: 44, signal: 10, label: 'EMA 22 • EMA 44 • Signal 10' },
  '420': { fast: 24, slow: 48, signal: 10, label: 'EMA 24 • EMA 48 • Signal 10' },
}

const DEFAULT_MACD_SETTING = { fast: 12, slow: 26, signal: 9, label: 'EMA 12 • EMA 26 • Signal 9' }

const REFRESH_OPTIONS = [
  { value: '0.5', label: '30s' },
  { value: '1', label: '1m' },
  { value: '5', label: '5m' },
  { value: '15', label: '15m' },
  { value: '30', label: '30m' },
  { value: '60', label: '60m' },
  { value: 'custom', label: 'Custom' },
]

const DEFAULT_REFRESH_SELECTION = '1'

const BAR_COUNT_OPTIONS = [
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
const MAX_SIGNAL_NOTIFICATIONS = 6
const MAX_QUANTUM_PHASE_NOTIFICATIONS = 6
const MIN_COMBINED_SIGNAL_SCORE = 2
const SIGNAL_NOTIFICATION_MIN_SCORE = 60

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

function formatSignedPercent(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) {
    return '0%'
  }

  const multiplier = 10 ** decimals
  const scaled = Math.round(value * 100 * multiplier) / multiplier
  const normalized = Object.is(scaled, -0) ? 0 : scaled

  return normalized > 0
    ? `+${normalized.toFixed(decimals)}%`
    : `${normalized.toFixed(decimals)}%`
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

  // Use the new hook for Push Notifications
  const {
    supportsNotifications,
    notificationPermission,
    pushServerConnected,
    requestPermission: requestNotificationPermission,
    pushNotificationsEnabled
  } = usePushNotifications(
    symbol,
    [...MOMENTUM_SIGNAL_TIMEFRAMES],
    MOVING_AVERAGE_NOTIFICATION_TIMEFRAMES,
    [...MOVING_AVERAGE_PAIR_TAGS]
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
  const notificationTimeframes = MOMENTUM_SIGNAL_TIMEFRAMES
  const lastMomentumTriggerRef = useRef<string | null>(null)
  const lastMovingAverageTriggersRef = useRef<Record<string, string>>({})
  const lastSignalTriggersRef = useRef<Record<string, string>>({})
  const lastCombinedSignalTriggersRef = useRef<Record<string, string>>({})
  const lastQuantumPhaseTriggerRef = useRef<'long' | 'short' | null>(null)
  const [momentumNotifications, setMomentumNotifications] = useState<MomentumNotification[]>([])
  const [movingAverageNotifications, setMovingAverageNotifications] =
    useState<MovingAverageCrossNotification[]>([])
  const [signalNotifications, setSignalNotifications] = useState<SignalNotification[]>([])
  const [combinedSignalNotifications, setCombinedSignalNotifications] =
    useState<CombinedSignalNotification[]>([])
  const [quantumPhaseNotifications, setQuantumPhaseNotifications] = useState<QuantumPhaseNotification[]>([])

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

  // Use new Hook for Market Data
  const { data, isError, error, isLoading, refetch, isFetching, dataUpdatedAt } = useMarketData(
    normalizedSymbol,
    timeframe,
    resolvedBarLimit,
    refreshInterval,
    symbolQueryEnabled
  )

  useEffect(() => {
    const handler = (event: BeforeInstallPromptEvent) => {
      event.preventDefault()
      setInstallPromptEvent(event)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const symbolErrorMessage = isError && error instanceof Error ? error.message : ''
  const normalizedErrorMessage = symbolErrorMessage.toLowerCase()
  const isSymbolRejected =
    symbolQueryEnabled &&
    (normalizedErrorMessage.includes('symbol') ||
      normalizedErrorMessage.includes('instrument') ||
      normalizedErrorMessage.includes('not found'))
  const canStreamSymbol = symbolQueryEnabled && !isSymbolRejected

  // Use MultiFrame Market Data Hook for Notifications
  const notificationQueries = useMultiFrameMarketData(
    normalizedSymbol,
    [...notificationTimeframes],
    resolvedBarLimit,
    refreshInterval,
    canStreamSymbol
  )

  const movingAverageNotificationTimeframes = MOVING_AVERAGE_NOTIFICATION_TIMEFRAMES
  const movingAverageNotificationQueries = useMultiFrameMarketData(
    normalizedSymbol,
    [...movingAverageNotificationTimeframes],
    resolvedBarLimit,
    refreshInterval,
    canStreamSymbol
  )

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

    await requestNotificationPermission()
  }

  const lastUpdatedLabel = useMemo(() => {
    if (!dataUpdatedAt) {
      return '—'
    }
    return LAST_REFRESH_FORMATTER.format(new Date(dataUpdatedAt))
  }, [dataUpdatedAt])

  const closes = useMemo(() => (data ? data.map((candle) => candle.close) : []), [data])
  const highs = useMemo(() => (data ? data.map((candle) => candle.high) : []), [data])
  const lows = useMemo(() => (data ? data.map((candle) => candle.low) : []), [data])

  const macdSetting = useMemo(
    () => MACD_SETTINGS[timeframe] ?? DEFAULT_MACD_SETTING,
    [timeframe],
  )

  const macdSeries = useMemo(() => {
    const { fast, slow, signal, label } = macdSetting
    const { macdLine, signalLine, histogram } = calculateMACD(
      closes,
      fast,
      slow,
      signal,
    )

    return {
      macdLine,
      signalLine,
      histogram,
      label,
    }
  }, [closes, macdSetting])

  const adxSetting = useMemo(
    () => ADX_SETTINGS[timeframe] ?? DEFAULT_ADX_SETTING,
    [timeframe],
  )

  const adxSeries = useMemo(() => {
    const { length, signal, label } = adxSetting
    const { adxLine, signalLine, plusDi, minusDi } = calculateADX(
      highs,
      lows,
      closes,
      length,
      signal,
    )

    return {
      adxLine,
      signalLine,
      plusDi,
      minusDi,
      label,
    }
  }, [adxSetting, closes, highs, lows])

  const ema10Values = useMemo(() => calculateEMA(closes, 10), [closes])
  const ema50Values = useMemo(() => calculateEMA(closes, 50), [closes])
  const sma200Values = useMemo(() => calculateSMA(closes, 200), [closes])

  useEffect(() => {
    lastMomentumTriggerRef.current = null
    lastMovingAverageTriggersRef.current = {}
    lastCombinedSignalTriggersRef.current = {}
    lastQuantumPhaseTriggerRef.current = null
    setMomentumNotifications([])
    setMovingAverageNotifications([])
    setCombinedSignalNotifications([])
    setQuantumPhaseNotifications([])
  }, [normalizedSymbol])

  useEffect(() => {
    if (!pushNotificationsEnabled) {
      lastMomentumTriggerRef.current = null
      lastMovingAverageTriggersRef.current = {}
      lastCombinedSignalTriggersRef.current = {}
      lastQuantumPhaseTriggerRef.current = null
    }
  }, [pushNotificationsEnabled])

  const rsiSetting = useMemo(
    () => RSI_SETTINGS[timeframe] ?? DEFAULT_RSI_SETTING,
    [timeframe],
  )

  const momentumThresholds = useMemo(
    () => ({
      longRsi: Math.max(0, Math.min(100, Number(rsiUpperBoundInput) || DEFAULT_MOMENTUM_BOUNDS.rsiUpper)),
      shortRsi: Math.max(0, Math.min(100, Number(rsiLowerBoundInput) || DEFAULT_MOMENTUM_BOUNDS.rsiLower)),
      longStochastic: Math.max(
        0,
        Math.min(100, Number(stochasticUpperBoundInput) || DEFAULT_MOMENTUM_BOUNDS.stochasticUpper),
      ),
      shortStochastic: Math.max(
        0,
        Math.min(100, Number(stochasticLowerBoundInput) || DEFAULT_MOMENTUM_BOUNDS.stochasticLower),
      ),
    }),
    [rsiLowerBoundInput, rsiUpperBoundInput, stochasticLowerBoundInput, stochasticUpperBoundInput],
  )

  const rsiGuideLines = useMemo(
    () => [
      { value: momentumThresholds.shortRsi, label: 'Short', color: '#f87171' },
      { value: 50, label: 'Neutral', color: '#94a3b8' },
      { value: momentumThresholds.longRsi, label: 'Long', color: '#34d399' },
    ],
    [momentumThresholds.longRsi, momentumThresholds.shortRsi],
  )

  const stochasticGuideLines = useMemo(
    () => [
      { value: momentumThresholds.shortStochastic, label: 'Short', color: '#f87171' },
      { value: 50, label: 'Neutral', color: '#94a3b8' },
      { value: momentumThresholds.longStochastic, label: 'Long', color: '#34d399' },
    ],
    [momentumThresholds.longStochastic, momentumThresholds.shortStochastic],
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

  // Heatmap and Signal Derivations
  const { data: heatmapData, isLoading: heatmapLoading } = useHeatmapData(
    normalizedSymbol,
    resolvedBarLimit,
    refreshInterval,
    symbolQueryEnabled
  )

  const latestHeatmapSnapshot = useMemo(() => {
    if (!heatmapData || heatmapData.length === 0) return null
    return heatmapData.find(h => h.entryTimeframe === timeframe) || null
  }, [heatmapData, timeframe])

  const timeframeSnapshots = useMemo(() => {
    if (!heatmapData) return []
    return deriveTimeframeSnapshots(heatmapData)
  }, [heatmapData])

  const signals = useMemo(() => {
    if (!heatmapData) return []
    return deriveSignalsFromHeatmap(heatmapData)
  }, [heatmapData])

  const compositeQuantumSignal = useMemo(() => {
    if (timeframeSnapshots.length === 0) return null
    return deriveQuantumCompositeSignal(timeframeSnapshots)
  }, [timeframeSnapshots])

  const quantumFlipThreshold = compositeQuantumSignal?.flipThreshold ?? null

  return (
    <MainLayout>
      <DashboardView
        onManualRefresh={() => refetch()}
        isFetching={isFetching}
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
        canInstall={!!installPromptEvent}
        onInstall={() => {
          installPromptEvent?.prompt()
          installPromptEvent?.userChoice.then((choice) => {
            if (choice.outcome === 'accepted') {
              setInstallPromptEvent(null)
            }
          })
        }}
        showUpdateBanner={showUpdateBanner}
        onDismissUpdateBanner={() => setShowUpdateBanner(false)}
        onUpdate={() => updateServiceWorker(true)}
        showOfflineReadyBanner={showOfflineReadyBanner}
        onDismissOfflineReadyBanner={() => setShowOfflineReadyBanner(false)}
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
        signals={signals}
        signalsLoading={heatmapLoading}
        timeframeSnapshots={timeframeSnapshots}
        visibleMovingAverageNotifications={movingAverageNotifications}
        visibleMomentumNotifications={momentumNotifications}
        visibleSignalNotifications={signalNotifications}
        visibleCombinedSignalNotifications={combinedSignalNotifications}
        visibleQuantumPhaseNotifications={quantumPhaseNotifications}
        quantumFlipThreshold={quantumFlipThreshold}
        compositeQuantumSignal={compositeQuantumSignal}
        latestHeatmapSnapshot={latestHeatmapSnapshot}
        formatTriggeredAt={formatTriggeredAt}
        onDismissMovingAverageNotification={(id) =>
          setMovingAverageNotifications((prev) => prev.filter((n) => n.id !== id))
        }
        onDismissMomentumNotification={(id) =>
          setMomentumNotifications((prev) => prev.filter((n) => n.id !== id))
        }
        onDismissSignalNotification={(id) =>
          setSignalNotifications((prev) => prev.filter((n) => n.id !== id))
        }
        onDismissCombinedSignalNotification={(id) =>
          setCombinedSignalNotifications((prev) => prev.filter((n) => n.id !== id))
        }
        onDismissQuantumPhaseNotification={(id) =>
          setQuantumPhaseNotifications((prev) => prev.filter((n) => n.id !== id))
        }
        onClearNotifications={() => {
          setMomentumNotifications([])
          setMovingAverageNotifications([])
          setSignalNotifications([])
          setCombinedSignalNotifications([])
          setQuantumPhaseNotifications([])
        }}
        lastUpdatedLabel={lastUpdatedLabel}
        refreshInterval={refreshInterval}
        formatIntervalLabel={formatIntervalLabel}
        resolvedBarLimit={resolvedBarLimit}
        latestCandle={latestCandle}
        priceChange={priceChange}
        isMarketSummaryCollapsed={isMarketSummaryCollapsed}
        onToggleMarketSummary={() => setIsMarketSummaryCollapsed(!isMarketSummaryCollapsed)}
        movingAverageSeries={movingAverageSeries}
        macdSeries={macdSeries}
        adxSeries={adxSeries}
        rsiLengthDescription={rsiLengthDescription}
        rsiValues={rsiValues}
        labels={labels}
        rsiGuideLines={rsiGuideLines}
        stochasticLengthDescription={stochasticLengthDescription}
        stochasticSeries={stochasticSeries}
        stochasticGuideLines={stochasticGuideLines}
      />
    </MainLayout>
  )
}

export default App
