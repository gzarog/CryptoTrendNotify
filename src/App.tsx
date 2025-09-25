import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useRegisterSW } from 'virtual:pwa-register/react'

import { LineChart } from './components/LineChart'
import { calculateRSI, calculateStochasticRSI } from './lib/indicators'
import {
  checkPushServerConnection,
  ensurePushSubscription,
  isNotificationSupported,
  requestNotificationPermission,
  showAppNotification,
} from './lib/notifications'

type Candle = {
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

type MomentumNotification = {
  id: string
  symbol: string
  timeframe: string
  timeframeLabel: string
  direction: 'long' | 'short'
  rsi: number
  stochasticD: number
  triggeredAt: number
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
  { value: '420', label: '420m (7h)' },
]

const NOTIFICATION_TIMEFRAME_OPTIONS = TIMEFRAMES.filter((option) =>
  ['5', '15', '30'].includes(option.value),
)

const DEFAULT_NOTIFICATION_TIMEFRAME = NOTIFICATION_TIMEFRAME_OPTIONS[0]?.value ?? '5'

const RSI_SETTINGS: Record<string, { period: number; label: string }> = {
  '5': { period: 8, label: '7–9' },
  '15': { period: 11, label: '9–12' },
  '30': { period: 13, label: '12–14' },
  '60': { period: 15, label: '14–16' },
  '120': { period: 17, label: '16–18' },
  '240': { period: 20, label: '18–21' },
  '360': { period: 23, label: '21–24' },
  '420': { period: 26, label: '24–28' },
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
  '420': { rsiLength: 28, stochLength: 28, kSmoothing: 4, dSmoothing: 4, label: 'RSI 28 • Stoch 28 • %K 4 • %D 4' },
}

const DEFAULT_STOCHASTIC_SETTING: StochasticSetting = {
  rsiLength: 14,
  stochLength: 14,
  kSmoothing: 3,
  dSmoothing: 3,
  label: 'RSI 14 • Stoch 14 • %K 3 • %D 3',
}

const REFRESH_OPTIONS: RefreshOption[] = [
  { value: '5', label: '5m' },
  { value: '15', label: '15m' },
  { value: '30', label: '30m' },
  { value: '60', label: '60m' },
  { value: 'custom', label: 'Custom' },
]

const BAR_COUNT_OPTIONS: BarCountOption[] = [
  { value: '500', label: '500' },
  { value: '1000', label: '1000' },
  { value: '1500', label: '1500' },
  { value: '2000', label: '2000' },
  { value: '2500', label: '2500' },
  { value: '3000', label: '3000' },
  { value: '3500', label: '3500' },
  { value: '4000', label: '4000' },
  { value: '4500', label: '4500' },
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

const DEFAULT_BAR_LIMIT = 1000
const MAX_BAR_LIMIT = 5000
const MAX_MOMENTUM_NOTIFICATIONS = 6
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

  const [symbol, setSymbol] = useState(CRYPTO_OPTIONS[0])
  const [timeframe, setTimeframe] = useState(TIMEFRAMES[0].value)
  const [refreshSelection, setRefreshSelection] = useState(REFRESH_OPTIONS[0].value)
  const [customRefresh, setCustomRefresh] = useState('15')
  const [barSelection, setBarSelection] = useState('1000')
  const [customBarCount, setCustomBarCount] = useState(DEFAULT_BAR_LIMIT.toString())
  const [isMarketSummaryCollapsed, setIsMarketSummaryCollapsed] = useState(false)
  const supportsNotifications = isNotificationSupported()
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() =>
    supportsNotifications ? Notification.permission : 'denied',
  )
  const [selectedNotificationTimeframe, setSelectedNotificationTimeframe] = useState<string>(
    DEFAULT_NOTIFICATION_TIMEFRAME,
  )
  const notificationTimeframes = useMemo(
    () => (selectedNotificationTimeframe ? [selectedNotificationTimeframe] : []),
    [selectedNotificationTimeframe],
  )
  const lastNotificationByTimeframeRef = useRef<Record<string, number | null>>({
    [DEFAULT_NOTIFICATION_TIMEFRAME]: null,
  })
  const [momentumNotifications, setMomentumNotifications] = useState<MomentumNotification[]>([])
  const [pushServerConnected, setPushServerConnected] = useState<boolean | null>(null)

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

  const handleSelectNotificationTimeframe = (value: string) => {
    setSelectedNotificationTimeframe((previous) => {
      if (previous === value) {
        return previous
      }

      return value
    })
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
      refetchInterval: Number(value) * 60_000,
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

  useEffect(() => {
    lastNotificationByTimeframeRef.current = {
      [selectedNotificationTimeframe]: null,
    }
    setMomentumNotifications([])
  }, [selectedNotificationTimeframe, symbol])

  useEffect(() => {
    setMomentumNotifications((previous) =>
      previous.filter((entry) => entry.timeframe === selectedNotificationTimeframe),
    )
  }, [selectedNotificationTimeframe])

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

  const rsiGuideLines = useMemo(
    () => [
      { value: 70, label: '70', color: 'rgba(239, 68, 68, 0.7)' },
      { value: 50, label: '50', color: 'rgba(148, 163, 184, 0.5)' },
      { value: 30, label: '30', color: 'rgba(16, 185, 129, 0.7)' },
    ],
    [],
  )

  const stochasticGuideLines = useMemo(
    () => [
      { value: 80, label: '80', color: 'rgba(239, 68, 68, 0.7)' },
      { value: 50, label: '50', color: 'rgba(148, 163, 184, 0.5)' },
      { value: 20, label: '20', color: 'rgba(16, 185, 129, 0.7)' },
    ],
    [],
  )

  useEffect(() => {
    if (!notificationsEnabled) {
      return
    }

    notificationTimeframes.forEach((timeframeValue, index) => {
      const query = notificationQueries[index]
      const candles = query?.data

      if (!candles || candles.length === 0) {
        return
      }

      const latest = candles[candles.length - 1]

      if (!latest) {
        return
      }

      const lastProcessed = lastNotificationByTimeframeRef.current[timeframeValue]

      if (lastProcessed === latest.openTime) {
        return
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

      if (typeof latestRsi === 'number' && typeof latestStochasticD === 'number') {
        if (latestRsi <= 30 && latestStochasticD <= 20) {
          setMomentumNotifications((previous) => {
            const entry: MomentumNotification = {
              id: `${symbol}-${timeframeValue}-${latest.openTime}`,
              symbol,
              timeframe: timeframeValue,
              timeframeLabel,
              direction: 'long',
              rsi: latestRsi,
              stochasticD: latestStochasticD,
              triggeredAt: latest.openTime,
            }

            const next = [entry, ...previous.filter((item) => item.id !== entry.id)]
            return next.slice(0, MAX_MOMENTUM_NOTIFICATIONS)
          })
          void showAppNotification({
            title: `🟢 Long momentum ${timeframeLabel}`,
            body: `${symbol} RSI ${latestRsi.toFixed(2)} • Stoch RSI %D ${latestStochasticD.toFixed(2)}`,
            tag: `long-${symbol}-${timeframeValue}`,
            data: { symbol, timeframe: timeframeValue, direction: 'long' },
          })
        } else if (latestRsi >= 70 && latestStochasticD < 80) {
          setMomentumNotifications((previous) => {
            const entry: MomentumNotification = {
              id: `${symbol}-${timeframeValue}-${latest.openTime}`,
              symbol,
              timeframe: timeframeValue,
              timeframeLabel,
              direction: 'short',
              rsi: latestRsi,
              stochasticD: latestStochasticD,
              triggeredAt: latest.openTime,
            }

            const next = [entry, ...previous.filter((item) => item.id !== entry.id)]
            return next.slice(0, MAX_MOMENTUM_NOTIFICATIONS)
          })
          void showAppNotification({
            title: `🔴 Short momentum ${timeframeLabel}`,
            body: `${symbol} RSI ${latestRsi.toFixed(2)} • Stoch RSI %D ${latestStochasticD.toFixed(2)}`,
            tag: `short-${symbol}-${timeframeValue}`,
            data: { symbol, timeframe: timeframeValue, direction: 'short' },
          })
        }
      }

      lastNotificationByTimeframeRef.current[timeframeValue] = latest.openTime
    })
  }, [
    notificationQueries,
    notificationTimeframes,
    notificationsEnabled,
    symbol,
  ])

  const canInstall = useMemo(() => !!installPromptEvent, [installPromptEvent])

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
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100">
      <header className="border-b border-white/5 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Crypto momentum dashboard</h1>
            <p className="text-sm text-slate-400">Live Bybit OHLCV data with RSI signals ready for the web and PWA.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isFetching}
              className="rounded-full border border-indigo-400/60 px-4 py-2 text-sm font-semibold text-indigo-100 transition hover:border-indigo-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isFetching ? 'Refreshing…' : 'Refresh now'}
            </button>
            {canInstall && (
              <button
                type="button"
                onClick={handleInstall}
                className="rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-indigo-400"
              >
                Install app
              </button>
            )}
          </div>
        </div>
        {showUpdateBanner && (
          <div className="border-t border-indigo-500/40 bg-indigo-500/10">
            <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3 text-xs text-indigo-100">
              <span className="font-medium">A new version is ready.</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowUpdateBanner(false)}
                  className="rounded-full border border-indigo-400/60 px-3 py-1 font-medium text-indigo-100 transition hover:border-indigo-300 hover:text-white"
                >
                  Later
                </button>
                <button
                  type="button"
                  onClick={handleUpdate}
                  className="rounded-full bg-indigo-500 px-3 py-1 font-semibold text-white shadow transition hover:bg-indigo-400"
                >
                  Update now
                </button>
              </div>
            </div>
          </div>
        )}
        {showOfflineReadyBanner && (
          <div className="border-t border-emerald-500/40 bg-emerald-500/10">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3 text-xs text-emerald-100">
              <span className="font-medium">CryptoTrendNotify is ready to work offline.</span>
              <button
                type="button"
                onClick={() => setShowOfflineReadyBanner(false)}
                className="rounded-full border border-emerald-400/60 px-3 py-1 font-medium text-emerald-100 transition hover:border-emerald-300 hover:text-white"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-8">
        <section className="grid gap-6 rounded-3xl border border-white/5 bg-slate-900/60 p-6 sm:grid-cols-2 lg:grid-cols-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="symbol" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Crypto
            </label>
            <select
              id="symbol"
              value={symbol}
              onChange={(event) => setSymbol(event.target.value)}
              className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-medium text-white shadow focus:border-indigo-400 focus:outline-none"
            >
              {CRYPTO_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="timeframe" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Timeframe
            </label>
            <select
              id="timeframe"
              value={timeframe}
              onChange={(event) => setTimeframe(event.target.value)}
              className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-medium text-white shadow focus:border-indigo-400 focus:outline-none"
            >
              {TIMEFRAMES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="bar-count" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Bars
            </label>
            <select
              id="bar-count"
              value={barSelection}
              onChange={(event) => setBarSelection(event.target.value)}
              className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-medium text-white shadow focus:border-indigo-400 focus:outline-none"
            >
              {BAR_COUNT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {barSelection === 'custom' && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={MAX_BAR_LIMIT}
                    value={customBarCount}
                    onChange={(event) => setCustomBarCount(event.target.value)}
                    className="w-24 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white focus:border-indigo-400 focus:outline-none"
                  />
                  <span className="text-xs text-slate-400">bars</span>
                </div>
                <span className="text-[10px] text-slate-500">Max {MAX_BAR_LIMIT} bars</span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Refresh interval</span>
            <div className="flex flex-wrap gap-2">
              {REFRESH_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRefreshSelection(option.value)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                    refreshSelection === option.value
                      ? 'bg-indigo-500 text-white shadow'
                      : 'border border-white/10 text-slate-300 hover:border-indigo-400 hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {refreshSelection === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={customRefresh}
                  onChange={(event) => setCustomRefresh(event.target.value)}
                  className="w-24 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white focus:border-indigo-400 focus:outline-none"
                />
                <span className="text-xs text-slate-400">minutes</span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Push server
              </span>
              {pushServerConnected === null ? (
                <span className="text-[11px] text-slate-500">Checking…</span>
              ) : pushServerConnected ? (
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-200">
                  Connected
                </span>
              ) : (
                <span className="rounded-full bg-rose-500/15 px-3 py-1 text-[11px] font-semibold text-rose-200">
                  Offline
                </span>
              )}
            </div>
            {pushServerConnected === false && (
              <span className="text-[11px] text-rose-300">
                Unable to reach the push server. Start the backend service to deliver notifications.
              </span>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Notifications
              </span>
              {supportsNotifications ? (
                notificationPermission === 'granted' ? (
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300">
                    Enabled
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleEnableNotifications}
                    className="rounded-full border border-indigo-400/60 px-3 py-1 text-[11px] font-semibold text-indigo-100 transition hover:border-indigo-300 hover:text-white"
                  >
                    Enable alerts
                  </button>
                )
              ) : (
                <span className="text-[11px] text-slate-500">Not supported in this browser</span>
              )}
            </div>
            <p className="text-[11px] leading-5 text-slate-500">
              Receive browser and PWA alerts whenever momentum conditions trigger for the selected timeframe.
            </p>
            <div className="flex flex-wrap gap-2">
              {NOTIFICATION_TIMEFRAME_OPTIONS.map((option) => {
                const isSelected = selectedNotificationTimeframe === option.value
                return (
                  <label
                    key={option.value}
                    className={`cursor-pointer rounded-full px-4 py-2 text-xs font-semibold transition ${
                      isSelected
                        ? 'bg-emerald-500/20 text-emerald-200 shadow'
                        : 'border border-white/10 text-slate-300 hover:border-indigo-400 hover:text-white'
                    } ${notificationsEnabled ? '' : 'opacity-50'}`}
                  >
                    <input
                      type="radio"
                      name="notification-timeframe"
                      className="sr-only"
                      checked={isSelected}
                      onChange={() => handleSelectNotificationTimeframe(option.value)}
                      disabled={!notificationsEnabled}
                    />
                    {option.label}
                  </label>
                )
              })}
            </div>
            {notificationPermission === 'denied' && supportsNotifications && (
              <span className="text-[11px] text-rose-300">
                Notifications are blocked. Update your browser settings to enable alerts.
              </span>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-6">
          {isLoading && (
            <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-400">
              <p>Loading live market data…</p>
            </div>
          )}
          {isError && (
            <div className="rounded-3xl border border-rose-500/40 bg-rose-500/10 p-6 text-sm text-rose-200">
              <p>{error instanceof Error ? error.message : 'Failed to load data.'}</p>
            </div>
          )}
          {!isLoading && !isError && (
            <>
              <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Momentum notifications
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Latest alerts for {symbol}
                  </span>
                </div>
                {momentumNotifications.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No momentum notifications have been triggered yet. Alerts will surface here once the
                    RSI and Stochastic RSI conditions are met.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch sm:gap-3">
                    {momentumNotifications.map((entry) => {
                      const isLong = entry.direction === 'long'
                      return (
                        <div
                          key={entry.id}
                          className={`flex min-w-[220px] flex-1 flex-col gap-1 rounded-xl border px-3 py-2 text-xs ${
                            isLong
                              ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
                              : 'border-rose-400/40 bg-rose-500/10 text-rose-100'
                          }`}
                        >
                          <span className="text-[11px] font-semibold uppercase tracking-wide">
                            {isLong ? 'Long momentum' : 'Short momentum'} • {entry.timeframeLabel}
                          </span>
                          <span className="text-sm font-semibold text-white">{entry.symbol}</span>
                          <span className="text-[11px] text-white/80">
                            RSI {entry.rsi.toFixed(2)} • Stoch RSI %D {entry.stochasticD.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-white/60">
                            {DATE_FORMATTERS.short.format(new Date(entry.triggeredAt))}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              <div className="flex w-full flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/60 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-base font-semibold text-white">Market snapshot</h2>
                    <p className="text-xs text-slate-400">Applied across all charts</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMarketSummaryCollapsed((previous) => !previous)}
                    className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-indigo-400 hover:text-white"
                    aria-expanded={!isMarketSummaryCollapsed}
                  >
                    {isMarketSummaryCollapsed ? 'Expand' : 'Collapse'}
                    <span aria-hidden="true">{isMarketSummaryCollapsed ? '▾' : '▴'}</span>
                  </button>
                </div>
                {!isMarketSummaryCollapsed && (
                  <div className="grid gap-6 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs uppercase tracking-wider text-slate-400">Last auto refresh</span>
                      <span className="text-lg font-semibold text-white">{lastUpdatedLabel}</span>
                      <span className="text-xs text-slate-400">
                        {refreshInterval
                          ? `Every ${
                              refreshSelection === 'custom'
                                ? `${customRefresh || '—'}m`
                                : formatIntervalLabel(refreshSelection)
                            }`
                          : 'Auto refresh disabled'}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs uppercase tracking-wider text-slate-400">Data window</span>
                      <span className="text-lg font-semibold text-white">Last {resolvedBarLimit} bars</span>
                      <span className="text-xs text-slate-400">Refresh applies to RSI and Stochastic RSI panels</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs uppercase tracking-wider text-slate-400">Last close</span>
                      <span className="text-lg font-semibold text-white">
                        {latestCandle ? latestCandle.close.toFixed(5) : '—'}
                      </span>
                      {latestCandle && priceChange ? (
                        <span
                          className={`text-xs font-medium ${
                            priceChange.difference >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {priceChange.difference >= 0 ? '+' : ''}
                          {priceChange.difference.toFixed(5)} ({priceChange.percent.toFixed(2)}%)
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Waiting for additional price data…</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <LineChart
                title={`RSI (${rsiLengthDescription})`}
                data={rsiValues}
                labels={labels}
                color="#818cf8"
                yDomain={{ min: 0, max: 100 }}
                guideLines={rsiGuideLines}
              />
              <LineChart
                title={`Stochastic RSI (${stochasticLengthDescription})`}
                labels={labels}
                series={[
                  { name: '%K', data: stochasticSeries.kValues, color: '#34d399' },
                  { name: '%D', data: stochasticSeries.dValues, color: '#f87171' },
                ]}
                yDomain={{ min: 0, max: 100 }}
                guideLines={stochasticGuideLines}
              />
            </>
          )}
        </section>
      </main>

      <footer className="border-t border-white/5 bg-slate-950/80">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-6 py-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} CryptoTrendNotify — Live momentum insights at a glance.</p>
          <p>Built for responsive web and installable PWA experiences.</p>
        </div>
      </footer>
    </div>
  )
}

export default App
