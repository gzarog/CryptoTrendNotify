import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useRegisterSW } from 'virtual:pwa-register/react'

import { DashboardView } from './components/DashboardView'
import { calculateEMA, calculateRSI, calculateSMA, calculateStochasticRSI } from './lib/indicators'
import {
  checkPushServerConnection,
  ensurePushSubscription,
  isNotificationSupported,
  requestNotificationPermission,
  showAppNotification,
} from './lib/notifications'

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

const CRYPTO_OPTIONS = ['DOGEUSDT', 'BTCUSDT', 'ETHUSDT', 'XRPUSDT', 'SOLUSDT']

const TIMEFRAMES: TimeframeOption[] = [
  { value: '5', label: '5m' },
  { value: '15', label: '15m' },
  { value: '30', label: '30m' },
  { value: '60', label: '60m' },
  { value: '120', label: '120m' },
  { value: '240', label: '240m (4h)' },
  { value: '360', label: '360m (6h)' },
]

const MOMENTUM_SIGNAL_TIMEFRAMES = ['5', '15', '30', '60'] as const
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
  '15': { rsiLength: 9, stochLength: 9, kSmoothing: 3, dSmoothing: 3, label: 'RSI 9 • Stoch 9 • %K 3 (2–3) • %D 3' },
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
    return stored && CRYPTO_OPTIONS.includes(stored) ? stored : CRYPTO_OPTIONS[0]
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
  const notificationTimeframes = MOMENTUM_SIGNAL_TIMEFRAMES
  const lastMomentumTriggerRef = useRef<string | null>(null)
  const [momentumNotifications, setMomentumNotifications] = useState<MomentumNotification[]>([])
  const [pushServerConnected, setPushServerConnected] = useState<boolean | null>(null)

  useEffect(() => {
    writeLocalStorage(STORAGE_KEYS.symbol, symbol)
  }, [symbol])

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

  const notificationsEnabled = supportsNotifications && notificationPermission === 'granted'

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
    if (!notificationsEnabled) {
      return
    }

    let cancelled = false

    const initializeSubscription = async () => {
      const subscriptionEstablished = await ensurePushSubscription()

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
  }, [notificationsEnabled, updatePushServerStatus])

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
      const subscriptionEstablished = await ensurePushSubscription()
      setPushServerConnected(subscriptionEstablished)

      if (!subscriptionEstablished) {
        void updatePushServerStatus()
        return
      }
    }

    void updatePushServerStatus()
  }

  useEffect(() => {
    const handler = (event: BeforeInstallPromptEvent) => {
      event.preventDefault()
      setInstallPromptEvent(event)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const { data, isError, error, isLoading, refetch, isFetching, dataUpdatedAt } = useQuery<Candle[]>({
    queryKey: ['bybit-kline', symbol, timeframe, resolvedBarLimit],
    queryFn: () => fetchBybitOHLCV(symbol, timeframe, resolvedBarLimit),
    refetchInterval: refreshInterval,
    refetchIntervalInBackground: true,
    retry: 1,
    placeholderData: (previousData) => previousData,
  })

  const notificationQueries = useQueries({
    queries: notificationTimeframes.map((value) => ({
      queryKey: ['notification-kline', symbol, value, resolvedBarLimit],
      queryFn: () => fetchBybitOHLCV(symbol, value, resolvedBarLimit),
      enabled: notificationsEnabled,
      refetchInterval: refreshInterval,
      refetchIntervalInBackground: true,
      retry: 1,
      placeholderData: (previousData: Candle[] | undefined) => previousData,
    })),
  })

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
    setMomentumNotifications([])
  }, [symbol])

  useEffect(() => {
    if (!notificationsEnabled) {
      lastMomentumTriggerRef.current = null
    }
  }, [notificationsEnabled])

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

  const visibleMomentumNotifications = useMemo(() => momentumNotifications, [momentumNotifications])

  useEffect(() => {
    if (!notificationsEnabled) {
      return
    }

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

    const intensity = MOMENTUM_INTENSITY_BY_LEVEL[matchingReadings.length]

    if (!intensity) {
      return
    }

    const signatureParts = matchingReadings.map(
      (reading) => `${reading.timeframe}:${reading.openTime ?? '0'}`,
    )
    const signature = `${symbol}-${primary.direction}-${signatureParts.join('|')}`

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
      symbol,
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
      body: `${symbol} — Rsi ${rsiSummary} • Stoch Rsi (stochastic rsi %d ${stochasticSummary})`,
      tag: signature,
      data: {
        symbol,
        direction: primary.direction,
        timeframes: readings.map((reading) => reading.timeframe),
      },
    })
  }, [
    notificationQueries,
    notificationTimeframes,
    notificationsEnabled,
    momentumThresholds,
    symbol,
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
    await refetch()

    if (notificationsEnabled) {
      await Promise.all(
        notificationQueries.map((query) =>
          query.refetch ? query.refetch({ cancelRefetch: false }) : Promise.resolve(null),
        ),
      )
    }
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
      cryptoOptions={CRYPTO_OPTIONS}
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
      momentumThresholds={momentumThresholds}
      visibleMomentumNotifications={visibleMomentumNotifications}
      formatTriggeredAt={formatTriggeredAtLabel}
      onDismissMomentumNotification={dismissMomentumNotification}
      lastUpdatedLabel={lastUpdatedLabel}
      refreshInterval={refreshInterval}
      formatIntervalLabel={formatIntervalLabel}
      resolvedBarLimit={resolvedBarLimit}
      latestCandle={latestCandle}
      priceChange={priceChange}
      isMarketSummaryCollapsed={isMarketSummaryCollapsed}
      onToggleMarketSummary={toggleMarketSummary}
      movingAverageSeries={movingAverageSeries}
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
