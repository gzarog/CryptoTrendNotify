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

const CRYPTO_OPTIONS = ['DOGEUSDT', 'BTCUSDT', 'ETHUSDT', 'XRPUSDT', 'SOLUSDT']

const TIMEFRAMES: TimeframeOption[] = [
  { value: '5', label: '5m' },
  { value: '15', label: '15m' },
  { value: '30', label: '30m' },
  { value: '60', label: '60m' },
  { value: '120', label: '120m' },
  { value: '240', label: '240m' },
  { value: '360', label: '360m' },
]

const REFRESH_OPTIONS: RefreshOption[] = [
  { value: '5', label: '5m' },
  { value: '15', label: '15m' },
  { value: '30', label: '30m' },
  { value: '60', label: '60m' },
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

async function fetchBybitOHLCV(symbol: string, interval: string): Promise<Candle[]> {
  const url = new URL('https://api.bybit.com/v5/market/kline')
  url.searchParams.set('category', 'linear')
  url.searchParams.set('symbol', symbol)
  url.searchParams.set('interval', interval)
  url.searchParams.set('limit', '200')

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

  return payload.result.list
    .map((entry) => ({
      openTime: Number(entry[0]),
      open: Number(entry[1]),
      high: Number(entry[2]),
      low: Number(entry[3]),
      close: Number(entry[4]),
      volume: Number(entry[5]),
      turnover: Number(entry[6] ?? 0),
      closeTime: Number(entry[0]) + 1,
    }))
    .sort((a, b) => a.openTime - b.openTime)
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

function App() {
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [showUpdateBanner, setShowUpdateBanner] = useState(false)
  const [showOfflineReadyBanner, setShowOfflineReadyBanner] = useState(false)

  const [symbol, setSymbol] = useState(CRYPTO_OPTIONS[0])
  const [timeframe, setTimeframe] = useState(TIMEFRAMES[0].value)
  const [refreshSelection, setRefreshSelection] = useState(REFRESH_OPTIONS[0].value)
  const [customRefresh, setCustomRefresh] = useState('15')

  const refreshInterval = useMemo(
    () => resolveRefreshInterval(refreshSelection, customRefresh),
    [refreshSelection, customRefresh],
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

  const { data, isError, error, isLoading, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['bybit-kline', symbol, timeframe],
    queryFn: () => fetchBybitOHLCV(symbol, timeframe),
    refetchInterval: refreshInterval,
    refetchIntervalInBackground: true,
    retry: 1,
    keepPreviousData: true,
  })

  const lastUpdatedLabel = useMemo(() => {
    if (!dataUpdatedAt) {
      return '—'
    }
    return LAST_REFRESH_FORMATTER.format(new Date(dataUpdatedAt))
  }, [dataUpdatedAt])

  const closes = useMemo(() => (data ? data.map((candle) => candle.close) : []), [data])

  const rsiValues = useMemo(() => calculateRSI(closes), [closes])
  const stochasticValues = useMemo(() => calculateStochasticRSI(rsiValues), [rsiValues])

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

  const guideLines = useMemo(
    () => [
      { value: 70, label: '70', color: 'rgba(239, 68, 68, 0.7)' },
      { value: 50, label: '50', color: 'rgba(148, 163, 184, 0.5)' },
      { value: 30, label: '30', color: 'rgba(16, 185, 129, 0.7)' },
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
        <section className="grid gap-6 rounded-3xl border border-white/5 bg-slate-900/60 p-6 sm:grid-cols-2 lg:grid-cols-4">
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
          <div className="flex flex-col justify-between gap-2 rounded-2xl border border-white/5 bg-slate-950/50 p-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">Last auto refresh</p>
              <p className="text-lg font-semibold text-white">{lastUpdatedLabel}</p>
              <p className="text-xs text-slate-400">
                {refreshInterval
                  ? `Every ${
                      refreshSelection === 'custom'
                        ? `${customRefresh || '—'}m`
                        : formatIntervalLabel(refreshSelection)
                    }`
                  : 'Auto refresh disabled'}
              </p>
            </div>
            {latestCandle && (
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400">Last close</p>
                <p className="text-lg font-semibold text-white">{latestCandle.close.toFixed(5)}</p>
                {priceChange && (
                  <p
                    className={`text-xs font-medium ${
                      priceChange.difference >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {priceChange.difference >= 0 ? '+' : ''}
                    {priceChange.difference.toFixed(5)} ({priceChange.percent.toFixed(2)}%)
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          {isLoading && (
            <div className="col-span-full flex flex-col gap-3 rounded-3xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-400">
              <p>Loading live market data…</p>
            </div>
          )}
          {isError && (
            <div className="col-span-full rounded-3xl border border-rose-500/40 bg-rose-500/10 p-6 text-sm text-rose-200">
              <p>{error instanceof Error ? error.message : 'Failed to load data.'}</p>
            </div>
          )}
          {!isLoading && !isError && (
            <>
              <LineChart title="RSI (14)" data={rsiValues} labels={labels} color="#818cf8" yDomain={{ min: 0, max: 100 }} guideLines={guideLines} />
              <LineChart
                title="Stochastic RSI (14)"
                data={stochasticValues}
                labels={labels}
                color="#34d399"
                yDomain={{ min: 0, max: 100 }}
                guideLines={guideLines}
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
