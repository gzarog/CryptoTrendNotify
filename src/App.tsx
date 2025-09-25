import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRegisterSW } from 'virtual:pwa-register/react'

import { LineChart } from './components/LineChart'
import { calculateRSI, calculateStochasticRSI } from './lib/indicators'

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

  const lastUpdatedLabel = useMemo(() => {
    if (!dataUpdatedAt) {
      return '—'
    }
    return LAST_REFRESH_FORMATTER.format(new Date(dataUpdatedAt))
  }, [dataUpdatedAt])

  const closes = useMemo(() => (data ? data.map((candle) => candle.close) : []), [data])

  const rsiSetting = useMemo(
    () => RSI_SETTINGS[timeframe] ?? DEFAULT_RSI_SETTING,
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
  const stochasticValues = useMemo(
    () => calculateStochasticRSI(rsiValues, rsiSetting.period),
    [rsiValues, rsiSetting.period],
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
              onClick={() => refetch()}
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
                title={`Stochastic RSI (${rsiLengthDescription})`}
                data={stochasticValues}
                labels={labels}
                color="#34d399"
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
