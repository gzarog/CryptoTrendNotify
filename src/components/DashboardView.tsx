import type { Dispatch, SetStateAction } from 'react'
import type { MomentumIntensity, MomentumNotification, MovingAverageMarker } from '../App'
import { LineChart } from './LineChart'

const MOMENTUM_EMOJI_BY_INTENSITY: Record<MomentumIntensity, string> = {
  green: '🟢',
  yellow: '🟡',
  orange: '🟠',
  red: '🔴',
}

const MOMENTUM_CARD_CLASSES: Record<MomentumIntensity, string> = {
  green: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100',
  yellow: 'border-amber-400/40 bg-amber-500/10 text-amber-100',
  orange: 'border-orange-400/40 bg-orange-500/10 text-orange-100',
  red: 'border-rose-400/40 bg-rose-500/10 text-rose-100',
}

type DashboardViewProps = {
  canInstall: boolean
  isFetching: boolean
  onManualRefresh: () => void | Promise<void>
  onInstall: () => void | Promise<void>
  showUpdateBanner: boolean
  onDismissUpdateBanner: () => void
  onUpdate: () => void | Promise<void>
  showOfflineReadyBanner: boolean
  onDismissOfflineReadyBanner: () => void
  symbol: string
  onSymbolChange: Dispatch<SetStateAction<string>>
  cryptoOptions: string[]
  timeframe: string
  timeframeOptions: Array<{ value: string; label: string }>
  onTimeframeChange: Dispatch<SetStateAction<string>>
  barSelection: string
  barCountOptions: Array<{ value: string; label: string }>
  onBarSelectionChange: Dispatch<SetStateAction<string>>
  customBarCount: string
  onCustomBarCountChange: Dispatch<SetStateAction<string>>
  maxBarLimit: number
  refreshSelection: string
  refreshOptions: Array<{ value: string; label: string }>
  onRefreshSelectionChange: Dispatch<SetStateAction<string>>
  customRefresh: string
  onCustomRefreshChange: Dispatch<SetStateAction<string>>
  pushServerConnected: boolean | null
  supportsNotifications: boolean
  notificationPermission: NotificationPermission
  onEnableNotifications: () => void | Promise<void>
  isLoading: boolean
  isError: boolean
  error: unknown
  rsiLowerBoundInput: string
  onRsiLowerBoundInputChange: Dispatch<SetStateAction<string>>
  rsiUpperBoundInput: string
  onRsiUpperBoundInputChange: Dispatch<SetStateAction<string>>
  stochasticLowerBoundInput: string
  onStochasticLowerBoundInputChange: Dispatch<SetStateAction<string>>
  stochasticUpperBoundInput: string
  onStochasticUpperBoundInputChange: Dispatch<SetStateAction<string>>
  momentumThresholds: {
    longRsi: number
    shortRsi: number
    longStochastic: number
    shortStochastic: number
  }
  visibleMomentumNotifications: MomentumNotification[]
  formatTriggeredAt: (timestamp: number) => string
  onDismissMomentumNotification: (notificationId: string) => void
  lastUpdatedLabel: string
  refreshInterval: number | false
  formatIntervalLabel: (value: string) => string
  resolvedBarLimit: number
  latestCandle?: { close: number } | null
  priceChange: { difference: number; percent: number } | null
  isMarketSummaryCollapsed: boolean
  onToggleMarketSummary: () => void
  movingAverageSeries: {
    ema10: Array<number | null>
    ema50: Array<number | null>
    ma200: Array<number | null>
    markers: MovingAverageMarker[]
  }
  rsiLengthDescription: string
  rsiValues: Array<number | null>
  labels: string[]
  rsiGuideLines: Array<{ value: number; label: string; color: string }>
  stochasticLengthDescription: string
  stochasticSeries: { kValues: Array<number | null>; dValues: Array<number | null> }
  stochasticGuideLines: Array<{ value: number; label: string; color: string }>
}

export function DashboardView({
  canInstall,
  isFetching,
  onManualRefresh,
  onInstall,
  showUpdateBanner,
  onDismissUpdateBanner,
  onUpdate,
  showOfflineReadyBanner,
  onDismissOfflineReadyBanner,
  symbol,
  onSymbolChange,
  cryptoOptions,
  timeframe,
  timeframeOptions,
  onTimeframeChange,
  barSelection,
  barCountOptions,
  onBarSelectionChange,
  customBarCount,
  onCustomBarCountChange,
  maxBarLimit,
  refreshSelection,
  refreshOptions,
  onRefreshSelectionChange,
  customRefresh,
  onCustomRefreshChange,
  pushServerConnected,
  supportsNotifications,
  notificationPermission,
  onEnableNotifications,
  isLoading,
  isError,
  error,
  rsiLowerBoundInput,
  onRsiLowerBoundInputChange,
  rsiUpperBoundInput,
  onRsiUpperBoundInputChange,
  stochasticLowerBoundInput,
  onStochasticLowerBoundInputChange,
  stochasticUpperBoundInput,
  onStochasticUpperBoundInputChange,
  momentumThresholds,
  visibleMomentumNotifications,
  formatTriggeredAt,
  onDismissMomentumNotification,
  lastUpdatedLabel,
  refreshInterval,
  formatIntervalLabel,
  resolvedBarLimit,
  latestCandle,
  priceChange,
  isMarketSummaryCollapsed,
  onToggleMarketSummary,
  movingAverageSeries,
  rsiLengthDescription,
  rsiValues,
  labels,
  rsiGuideLines,
  stochasticLengthDescription,
  stochasticSeries,
  stochasticGuideLines,
}: DashboardViewProps) {
  const formatThreshold = (value: number) =>
    Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2)

  return (
    <div
      className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100"
      aria-busy={isFetching}
    >
      <header className="border-b border-white/5 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Crypto momentum dashboard</h1>
            <p className="text-sm text-slate-400">Live Bybit OHLCV data with RSI signals ready for the web and PWA.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void onManualRefresh()}
              disabled={isFetching}
              className="rounded-full border border-indigo-400/60 px-4 py-2 text-sm font-semibold text-indigo-100 transition hover:border-indigo-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isFetching ? 'Refreshing…' : 'Refresh now'}
            </button>
            {canInstall && (
              <button
                type="button"
                onClick={() => void onInstall()}
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
                  onClick={onDismissUpdateBanner}
                  className="rounded-full border border-indigo-400/60 px-3 py-1 font-medium text-indigo-100 transition hover:border-indigo-300 hover:text-white"
                >
                  Later
                </button>
                <button
                  type="button"
                  onClick={() => void onUpdate()}
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
                onClick={onDismissOfflineReadyBanner}
                className="rounded-full border border-emerald-400/60 px-3 py-1 font-medium text-emerald-100 transition hover:border-emerald-300 hover:text-white"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-8">
        <section className="flex flex-col gap-6 rounded-3xl border border-white/5 bg-slate-900/60 p-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="symbol" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Crypto
              </label>
              <select
                id="symbol"
                value={symbol}
                onChange={(event) => onSymbolChange(event.target.value)}
                className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-medium text-white shadow focus:border-indigo-400 focus:outline-none"
              >
                {cryptoOptions.map((option) => (
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
                onChange={(event) => onTimeframeChange(event.target.value)}
                className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-medium text-white shadow focus:border-indigo-400 focus:outline-none"
              >
                {timeframeOptions.map((option) => (
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
                onChange={(event) => onBarSelectionChange(event.target.value)}
                className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-medium text-white shadow focus:border-indigo-400 focus:outline-none"
              >
                {barCountOptions.map((option) => (
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
                      max={maxBarLimit}
                      value={customBarCount}
                      onChange={(event) => onCustomBarCountChange(event.target.value)}
                      className="w-24 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white focus:border-indigo-400 focus:outline-none"
                    />
                    <span className="text-xs text-slate-400">bars</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Max {maxBarLimit} bars</span>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="refresh-interval" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Refresh interval
              </label>
              <select
                id="refresh-interval"
                value={refreshSelection}
                onChange={(event) => onRefreshSelectionChange(event.target.value)}
                className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-medium text-white shadow focus:border-indigo-400 focus:outline-none"
              >
                {refreshOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {refreshSelection === 'custom' && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={customRefresh}
                    onChange={(event) => onCustomRefreshChange(event.target.value)}
                    className="w-24 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white focus:border-indigo-400 focus:outline-none"
                  />
                  <span className="text-xs text-slate-400">minutes</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Momentum filters
            </span>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="momentum-rsi-long"
                  className="text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                >
                  RSI long ≤
                </label>
                <input
                  id="momentum-rsi-long"
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={rsiLowerBoundInput}
                  onChange={(event) => onRsiLowerBoundInputChange(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-medium text-white shadow focus:border-indigo-400 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="momentum-rsi-short"
                  className="text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                >
                  RSI short ≥
                </label>
                <input
                  id="momentum-rsi-short"
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={rsiUpperBoundInput}
                  onChange={(event) => onRsiUpperBoundInputChange(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-medium text-white shadow focus:border-indigo-400 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="momentum-stoch-long"
                  className="text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                >
                  Stoch %D long ≤
                </label>
                <input
                  id="momentum-stoch-long"
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={stochasticLowerBoundInput}
                  onChange={(event) => onStochasticLowerBoundInputChange(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-medium text-white shadow focus:border-indigo-400 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="momentum-stoch-short"
                  className="text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                >
                  Stoch %D short ≥
                </label>
                <input
                  id="momentum-stoch-short"
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={stochasticUpperBoundInput}
                  onChange={(event) => onStochasticUpperBoundInputChange(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-medium text-white shadow focus:border-indigo-400 focus:outline-none"
                />
              </div>
            </div>
            <span className="text-[11px] text-slate-500">
              Long triggers when RSI ≤ {formatThreshold(momentumThresholds.longRsi)} and Stoch RSI %D ≤{' '}
              {formatThreshold(momentumThresholds.longStochastic)}. Short triggers when RSI ≥{' '}
              {formatThreshold(momentumThresholds.shortRsi)} and Stoch RSI %D ≥{' '}
              {formatThreshold(momentumThresholds.shortStochastic)}.
            </span>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
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
            </div>
            <div className="flex flex-col gap-3">
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
                      onClick={() => void onEnableNotifications()}
                      className="rounded-full border border-indigo-400/60 px-3 py-1 text-[11px] font-semibold text-indigo-100 transition hover:border-indigo-300 hover:text-white"
                    >
                      Enable alerts
                    </button>
                  )
                ) : (
                  <span className="text-[11px] text-slate-500">Not supported in this browser</span>
                )}
              </div>
              {notificationPermission === 'denied' && supportsNotifications && (
                <span className="text-[11px] text-rose-300">
                  Notifications are blocked. Update your browser settings to enable alerts.
                </span>
              )}
            </div>
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
                {visibleMomentumNotifications.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No momentum notifications have been triggered yet. Alerts will surface here once the RSI and Stochastic RSI conditions are met.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch sm:gap-3">
                    {visibleMomentumNotifications.map((entry) => {
                      const cardClasses = MOMENTUM_CARD_CLASSES[entry.intensity]
                      const emoji = MOMENTUM_EMOJI_BY_INTENSITY[entry.intensity]
                      return (
                        <div
                          key={entry.id}
                          className={`flex min-w-[220px] flex-1 flex-col gap-2 rounded-xl border px-3 py-2 text-xs ${cardClasses}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[11px] font-semibold uppercase tracking-wide">
                              {emoji} {entry.label}
                            </span>
                            <button
                              type="button"
                              onClick={() => onDismissMomentumNotification(entry.id)}
                              className="flex h-6 w-6 items-center justify-center rounded-full border border-white/20 text-base text-white/70 transition hover:border-white/40 hover:bg-white/10 hover:text-white"
                              aria-label="Dismiss momentum notification"
                            >
                              ×
                            </button>
                          </div>
                          <span className="text-sm font-semibold text-white">{entry.symbol}</span>
                          <span className="text-[11px] text-white/80">Rsi {entry.rsiSummary}</span>
                          <span className="text-[11px] text-white/80">
                            Stoch Rsi (stochastic rsi %d {entry.stochasticSummary})
                          </span>
                          <span className="text-[10px] text-white/60">
                            {formatTriggeredAt(entry.triggeredAt)}
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
                    onClick={onToggleMarketSummary}
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
            title="Moving averages (EMA 10 • EMA 50 • MA 200)"
            labels={labels}
            series={[
              { name: 'EMA 10', data: movingAverageSeries.ema10, color: '#38bdf8' },
              { name: 'EMA 50', data: movingAverageSeries.ema50, color: '#a855f7' },
              { name: 'MA 200', data: movingAverageSeries.ma200, color: '#f97316' },
            ]}
            markers={movingAverageSeries.markers}
            isLoading={isFetching}
          />
          <LineChart
            title={`RSI (${rsiLengthDescription})`}
            data={rsiValues}
            labels={labels}
            color="#818cf8"
            yDomain={{ min: 0, max: 100 }}
            guideLines={rsiGuideLines}
            isLoading={isFetching}
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
            isLoading={isFetching}
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
