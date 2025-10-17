import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import type {
  MomentumIntensity,
  MomentumNotification,
  MovingAverageCrossNotification,
  MovingAverageMarker,
  QuantumPhaseNotification,
} from '../App'
import type { QuantumFlipThreshold } from '../lib/quantum'
import type {
  CombinedSignalNotification,
  SignalNotification,
  TimeframeSignalSnapshot,
  TradingSignal,
} from '../types/signals'
import { LineChart } from './LineChart'
import { SignalsPanel } from './SignalsPanel'
import { ExpertSignalsPanel } from './ExpertSignalsPanel'
import { Badge } from './signals/Badge'
import {
  DIRECTIONAL_BADGE_CLASS,
  FLIP_BIAS_LABELS,
  FLIP_BIAS_TEXT_CLASS,
  FLIP_SIGNAL_BADGE_CLASS,
  FLIP_SIGNAL_CATEGORY,
  FLIP_ZONE_BADGE_CLASS,
  FLIP_ZONE_LABELS,
  formatDegrees,
  getPhaseAngleClass,
  toSentenceCase,
} from './signals/quantumFlipThresholdShared'

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

const QUANTUM_PHASE_CARD_CLASSES: Record<'long' | 'short', string> = {
  long: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100',
  short: 'border-rose-400/40 bg-rose-500/10 text-rose-100',
}

const QUANTUM_PHASE_EMOJI: Record<'long' | 'short', string> = {
  long: '🟢',
  short: '🔴',
}

const MOVING_AVERAGE_DIRECTION_LABELS: Record<'golden' | 'death', string> = {
  golden: 'Golden cross',
  death: 'Death cross',
}

const HEATMAP_CARD_CLASS_BY_STRENGTH: Record<string, string> = {
  weak: MOMENTUM_CARD_CLASSES.green,
  standard: MOMENTUM_CARD_CLASSES.yellow,
  strong: MOMENTUM_CARD_CLASSES.orange,
}

const HEATMAP_DEFAULT_CARD_CLASS =
  'border-indigo-400/40 bg-indigo-500/10 text-indigo-100'

function getHeatmapCardClass(strength: string | null | undefined): string {
  if (!strength) {
    return HEATMAP_DEFAULT_CARD_CLASS
  }

  const normalized = strength.toLowerCase()
  return HEATMAP_CARD_CLASS_BY_STRENGTH[normalized] ?? HEATMAP_DEFAULT_CARD_CLASS
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

const COMBINED_DIRECTION_CARD_CLASSES: Record<string, string> = {
  bullish: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100',
  bearish: 'border-rose-400/40 bg-rose-500/10 text-rose-100',
  neutral: 'border-slate-400/40 bg-slate-500/10 text-slate-200',
}

const COMBINED_DIRECTION_EMOJI: Record<'Bullish' | 'Bearish' | 'Neutral', string> = {
  Bullish: '🟢',
  Bearish: '🔴',
  Neutral: '⚪️',
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
  signals: TradingSignal[]
  signalsLoading: boolean
  timeframeSnapshots: TimeframeSignalSnapshot[]
  visibleMovingAverageNotifications: MovingAverageCrossNotification[]
  visibleMomentumNotifications: MomentumNotification[]
  visibleSignalNotifications: SignalNotification[]
  visibleCombinedSignalNotifications: CombinedSignalNotification[]
  visibleQuantumPhaseNotifications: QuantumPhaseNotification[]
  quantumFlipThreshold: QuantumFlipThreshold | null
  formatTriggeredAt: (timestamp: number) => string
  onDismissMovingAverageNotification: (notificationId: string) => void
  onDismissMomentumNotification: (notificationId: string) => void
  onDismissSignalNotification: (notificationId: string) => void
  onDismissCombinedSignalNotification: (notificationId: string) => void
  onDismissQuantumPhaseNotification: (notificationId: string) => void
  onClearNotifications: () => void
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
  macdSeries: {
    macdLine: Array<number | null>
    signalLine: Array<number | null>
    histogram: Array<number | null>
    label: string
  }
  adxSeries: {
    adxLine: Array<number | null>
    signalLine: Array<number | null>
    plusDi: Array<number | null>
    minusDi: Array<number | null>
    label: string
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
  signals,
  signalsLoading,
  timeframeSnapshots,
  visibleMovingAverageNotifications,
  visibleMomentumNotifications,
  visibleSignalNotifications,
  visibleCombinedSignalNotifications,
  visibleQuantumPhaseNotifications,
  quantumFlipThreshold,
  formatTriggeredAt,
  onDismissMovingAverageNotification,
  onDismissMomentumNotification,
  onDismissSignalNotification,
  onDismissCombinedSignalNotification,
  onDismissQuantumPhaseNotification,
  onClearNotifications,
  lastUpdatedLabel,
  refreshInterval,
  formatIntervalLabel,
  resolvedBarLimit,
  latestCandle,
  priceChange,
  isMarketSummaryCollapsed,
  onToggleMarketSummary,
  movingAverageSeries,
  macdSeries,
  adxSeries,
  rsiLengthDescription,
  rsiValues,
  labels,
  rsiGuideLines,
  stochasticLengthDescription,
  stochasticSeries,
  stochasticGuideLines,
}: DashboardViewProps) {
  const [isNotificationPopupOpen, setIsNotificationPopupOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  const allNotifications = useMemo(
    () =>
      [
        ...visibleSignalNotifications.map((entry) => ({
          type: 'signal' as const,
          triggeredAt: entry.triggeredAt,
          payload: entry,
        })),
        ...visibleCombinedSignalNotifications.map((entry) => ({
          type: 'combined' as const,
          triggeredAt: entry.triggeredAt,
          payload: entry,
        })),
        ...visibleQuantumPhaseNotifications.map((entry) => ({
          type: 'quantum-phase' as const,
          triggeredAt: entry.triggeredAt,
          payload: entry,
        })),
        ...visibleMovingAverageNotifications.map((entry) => ({
          type: 'moving-average' as const,
          triggeredAt: entry.triggeredAt,
          payload: entry,
        })),
        ...visibleMomentumNotifications.map((entry) => ({
          type: 'momentum' as const,
          triggeredAt: entry.triggeredAt,
          payload: entry,
        })),
      ].sort((a, b) => b.triggeredAt - a.triggeredAt),
    [
      visibleSignalNotifications,
      visibleMomentumNotifications,
      visibleMovingAverageNotifications,
      visibleCombinedSignalNotifications,
      visibleQuantumPhaseNotifications,
    ],
  )

  const totalNotificationCount =
    visibleSignalNotifications.length +
    visibleCombinedSignalNotifications.length +
    visibleQuantumPhaseNotifications.length +
    visibleMomentumNotifications.length +
    visibleMovingAverageNotifications.length

  const quantumFlipSummary = useMemo(() => {
    if (!quantumFlipThreshold) {
      return null
    }

    const signalCategory = FLIP_SIGNAL_CATEGORY[quantumFlipThreshold.signal]

    return {
      zoneLabel: FLIP_ZONE_LABELS[quantumFlipThreshold.state],
      zoneBadgeClass: FLIP_ZONE_BADGE_CLASS[quantumFlipThreshold.state],
      biasLabel: FLIP_BIAS_LABELS[quantumFlipThreshold.bias],
      biasBadgeClass: DIRECTIONAL_BADGE_CLASS[quantumFlipThreshold.bias],
      biasTextClass: FLIP_BIAS_TEXT_CLASS[quantumFlipThreshold.bias],
      signalLabel: toSentenceCase(quantumFlipThreshold.signal),
      signalBadgeClass: FLIP_SIGNAL_BADGE_CLASS[signalCategory],
      phaseAngleLabel: formatDegrees(quantumFlipThreshold.phaseAngle),
      phaseAngleClass: getPhaseAngleClass(quantumFlipThreshold.phaseAngle),
    }
  }, [quantumFlipThreshold])

  const handleToggleNotifications = () => {
    if (totalNotificationCount === 0) {
      return
    }

    setIsNotificationPopupOpen((previous) => !previous)
  }

  const handleClearNotifications = () => {
    onClearNotifications()
    setIsNotificationPopupOpen(false)
  }

  return (
    <div
      className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100"
      aria-busy={isFetching}
    >
      <header className="sticky top-0 z-40 border-b border-white/5 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Crypto momentum dashboard</h1>
            <p className="text-sm text-slate-400">Live Bybit OHLCV data with RSI signals ready for the web and PWA.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {quantumFlipSummary && (
              <div className="flex min-w-[260px] flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-left shadow-[0_0_20px_rgba(15,23,42,0.45)] sm:min-w-[380px] sm:gap-4">
                <div className="flex flex-wrap gap-2">
                  <Badge className={quantumFlipSummary.zoneBadgeClass}>{quantumFlipSummary.zoneLabel}</Badge>
                  <Badge className={quantumFlipSummary.biasBadgeClass}>{quantumFlipSummary.biasLabel}</Badge>
                  <Badge className={quantumFlipSummary.signalBadgeClass}>{quantumFlipSummary.signalLabel}</Badge>
                </div>
                <dl className="grid gap-y-2 text-[11px] text-slate-400 sm:grid-cols-2 sm:items-start sm:gap-x-8">
                  <div className="space-y-1">
                    <dt className="font-semibold uppercase tracking-[0.18em] text-slate-500">Signal call</dt>
                    <dd className={`text-sm font-semibold leading-tight text-slate-100 ${quantumFlipSummary.biasTextClass}`}>
                      {quantumFlipSummary.signalLabel}
                    </dd>
                    <dd className="text-xs font-medium text-slate-400">{quantumFlipSummary.biasLabel}</dd>
                  </div>
                  <div className="space-y-1 text-left sm:text-right">
                    <dt className="font-semibold uppercase tracking-[0.18em] text-slate-500">Phase angle</dt>
                    <dd className={`text-sm font-semibold leading-tight ${quantumFlipSummary.phaseAngleClass}`}>
                      {quantumFlipSummary.phaseAngleLabel}
                    </dd>
                    <dd className="text-xs text-slate-500">Needs ±45° trigger.</dd>
                  </div>
                </dl>
              </div>
            )}
            <button
              type="button"
              onClick={() => void onManualRefresh()}
              disabled={isFetching}
              className="rounded-full border border-indigo-400/60 px-4 py-2 text-sm font-semibold text-indigo-100 transition hover:border-indigo-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isFetching ? 'Refreshing…' : 'Refresh now'}
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={handleToggleNotifications}
                className="relative flex items-center justify-center rounded-full border border-indigo-400/60 bg-slate-950/80 px-3 py-2 text-lg text-indigo-100 transition hover:border-indigo-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                aria-label={
                  totalNotificationCount > 0
                    ? `View ${totalNotificationCount} notifications`
                    : 'No notifications available'
                }
                aria-haspopup="dialog"
                aria-expanded={isNotificationPopupOpen}
                disabled={totalNotificationCount === 0}
              >
                <span aria-hidden="true">🔔</span>
                {totalNotificationCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-semibold text-white">
                    {totalNotificationCount}
                  </span>
                )}
              </button>
              {isNotificationPopupOpen && (
                <div className="absolute right-0 z-50 mt-3 w-80 rounded-2xl border border-white/10 bg-slate-900/95 p-4 text-sm shadow-xl">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Notifications
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsNotificationPopupOpen(false)}
                      className="text-xs text-slate-400 transition hover:text-white"
                    >
                      Close
                    </button>
                  </div>
                  <div className="flex max-h-80 flex-col gap-3 overflow-y-auto pr-1">
                    {allNotifications.length === 0 ? (
                      <p className="text-xs text-slate-500">No notifications available.</p>
                    ) : (
                      allNotifications.map((notification) => {
                        if (notification.type === 'signal') {
                          const entry = notification.payload
                          const normalizedStrength = entry.strength.toLowerCase()
                          const cardClasses = getHeatmapCardClass(normalizedStrength)
                          const emoji = entry.side === 'Bullish' ? '🟢' : '🔴'
                          const reasonSummary =
                            entry.reasons.length > 0
                              ? entry.reasons.slice(0, 2).join(' • ')
                              : '—'

                          return (
                            <div
                              key={`signal-${entry.id}`}
                              className={`flex flex-col gap-2 rounded-xl border px-3 py-2 text-xs ${cardClasses}`}
                            >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-[11px] font-semibold uppercase tracking-wide">
                                {emoji} {entry.side} signal
                              </span>
                              <button
                                type="button"
                                onClick={() => onDismissSignalNotification(entry.id)}
                                className="flex h-5 w-5 items-center justify-center rounded-full border border-white/20 text-xs text-white/70 transition hover:border-white/40 hover:bg-white/10 hover:text-white"
                                aria-label="Dismiss signal notification"
                              >
                                ×
                              </button>
                            </div>
                            <span className="text-sm font-semibold text-white">{entry.symbol}</span>
                            <span className="text-[11px] text-white/80">
                              {entry.timeframeLabel} • Score {entry.confluenceScore} • Strength {entry.strength}
                            </span>
                            {entry.price != null && Number.isFinite(entry.price) && (
                              <span className="text-[11px] text-white/80">Price {entry.price.toFixed(5)}</span>
                            )}
                            <span className="text-[11px] text-white/80">Reasons: {reasonSummary}</span>
                            <span className="text-[10px] text-white/60">{formatTriggeredAt(entry.triggeredAt)}</span>
                            </div>
                          )
                        }

                        if (notification.type === 'combined') {
                          const entry = notification.payload
                          const directionKey = entry.direction.toLowerCase()
                          const cardClasses =
                            COMBINED_DIRECTION_CARD_CLASSES[directionKey] ??
                            COMBINED_DIRECTION_CARD_CLASSES.neutral
                          const emoji = COMBINED_DIRECTION_EMOJI[entry.direction] ?? '⚪️'
                          const formatScore = (value: number) =>
                            value > 0 ? `+${value}` : value.toString()
                          const momentumLabel =
                            entry.breakdown.momentum === 'StrongBullish'
                              ? 'Strong bullish'
                              : entry.breakdown.momentum === 'StrongBearish'
                              ? 'Strong bearish'
                              : 'Weak'
                          const adxLabel = (() => {
                            if (entry.breakdown.adxDirection === 'ConfirmBull') {
                              return entry.breakdown.adxIsRising
                                ? 'Confirm bull (rising)'
                                : 'Confirm bull'
                            }
                            if (entry.breakdown.adxDirection === 'ConfirmBear') {
                              return entry.breakdown.adxIsRising
                                ? 'Confirm bear (rising)'
                                : 'Confirm bear'
                            }
                            return entry.breakdown.adxIsRising
                              ? 'No confirmation (rising)'
                              : 'No confirmation'
                          })()
                          const breakdownSummary = [
                            entry.breakdown.label.replace(/_/g, ' '),
                            `Score ${formatScore(entry.breakdown.signalStrength)}`,
                            `${entry.breakdown.bias.toLowerCase()} bias`,
                            momentumLabel,
                            `Trend ${entry.breakdown.trendStrength.toLowerCase()} • ${adxLabel}`,
                          ].join(' • ')

                          return (
                            <div
                              key={`combined-${entry.id}`}
                              className={`flex flex-col gap-2 rounded-xl border px-3 py-2 text-xs ${cardClasses}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-wide">
                                  {emoji} {entry.timeframeLabel} combined {entry.direction.toLowerCase()} bias
                                </span>
                                <button
                                  type="button"
                                  onClick={() => onDismissCombinedSignalNotification(entry.id)}
                                  className="flex h-5 w-5 items-center justify-center rounded-full border border-white/20 text-xs text-white/70 transition hover:border-white/40 hover:bg-white/10 hover:text-white"
                                  aria-label="Dismiss combined signal notification"
                                >
                                  ×
                                </button>
                              </div>
                              <span className="text-sm font-semibold text-white">{entry.symbol}</span>
                              <span className="text-[11px] text-white/80">
                                Strength {entry.strength}% • Bias {entry.bias.toLowerCase()}
                              </span>
                              <span className="text-[11px] text-white/80">{breakdownSummary}</span>
                              {entry.price != null && Number.isFinite(entry.price) && (
                                <span className="text-[11px] text-white/80">Price {entry.price.toFixed(5)}</span>
                              )}
                              <span className="text-[10px] text-white/60">{formatTriggeredAt(entry.triggeredAt)}</span>
                            </div>
                          )
                        }

                        if (notification.type === 'quantum-phase') {
                          const entry = notification.payload
                          const cardClasses = QUANTUM_PHASE_CARD_CLASSES[entry.direction]
                          const emoji = QUANTUM_PHASE_EMOJI[entry.direction]
                          const angleLabel = formatDegrees(entry.phaseAngle)
                          const compositeBiasLabel = formatSignedPercent(entry.compositeBias)
                          const biasLabel =
                            entry.flipBias === 'NEUTRAL'
                              ? 'Neutral bias'
                              : entry.flipBias === 'LONG'
                                ? 'Long bias'
                                : 'Short bias'
                          const signalLabel = (() => {
                            const normalized = entry.flipSignal.replace(/_/g, ' ').toLowerCase()
                            return normalized.charAt(0).toUpperCase() + normalized.slice(1)
                          })()

                          return (
                            <div
                              key={`quantum-phase-${entry.id}`}
                              className={`flex flex-col gap-2 rounded-xl border px-3 py-2 text-xs ${cardClasses}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-wide">
                                  {emoji} Quantum phase {entry.direction === 'long' ? 'upswing' : 'downswing'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => onDismissQuantumPhaseNotification(entry.id)}
                                  className="flex h-5 w-5 items-center justify-center rounded-full border border-white/20 text-xs text-white/70 transition hover:border-white/40 hover:bg-white/10 hover:text-white"
                                  aria-label="Dismiss quantum phase notification"
                                >
                                  ×
                                </button>
                              </div>
                              <span className="text-sm font-semibold text-white">{entry.symbol}</span>
                              <span className="text-[11px] text-white/80">Phase angle {angleLabel}</span>
                              <span className="text-[11px] text-white/80">Composite bias {compositeBiasLabel}</span>
                              <span className="text-[11px] text-white/80">{signalLabel} • {biasLabel.toLowerCase()}</span>
                              <span className="text-[10px] text-white/60">{formatTriggeredAt(entry.triggeredAt)}</span>
                            </div>
                          )
                        }

                        if (notification.type === 'moving-average') {
                          const entry = notification.payload
                          const cardClasses =
                            entry.direction === 'death'
                              ? MOMENTUM_CARD_CLASSES.red
                              : MOMENTUM_CARD_CLASSES[entry.intensity]
                          const emoji = MOMENTUM_EMOJI_BY_INTENSITY[entry.intensity]
                          const directionLabel = MOVING_AVERAGE_DIRECTION_LABELS[entry.direction]

                          return (
                            <div
                              key={`moving-${entry.id}`}
                              className={`flex flex-col gap-2 rounded-xl border px-3 py-2 text-xs ${cardClasses}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-wide">
                                  {emoji} {directionLabel}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => onDismissMovingAverageNotification(entry.id)}
                                  className="flex h-5 w-5 items-center justify-center rounded-full border border-white/20 text-xs text-white/70 transition hover:border-white/40 hover:bg-white/10 hover:text-white"
                                  aria-label="Dismiss moving average notification"
                                >
                                  ×
                                </button>
                              </div>
                              <span className="text-sm font-semibold text-white">{entry.symbol}</span>
                              <span className="text-[11px] text-white/80">
                                {entry.timeframeLabel} • {entry.pairLabel}
                              </span>
                              <span className="text-[11px] text-white/80">Price {entry.price.toFixed(5)}</span>
                              <span className="text-[10px] text-white/60">{formatTriggeredAt(entry.triggeredAt)}</span>
                            </div>
                          )
                        }

                        const entry = notification.payload
                        const cardClasses = MOMENTUM_CARD_CLASSES[entry.intensity]
                        const emoji = MOMENTUM_EMOJI_BY_INTENSITY[entry.intensity]

                        return (
                          <div
                            key={`momentum-${entry.id}`}
                            className={`flex flex-col gap-2 rounded-xl border px-3 py-2 text-xs ${cardClasses}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-[11px] font-semibold uppercase tracking-wide">
                                {emoji} {entry.label}
                              </span>
                              <button
                                type="button"
                                onClick={() => onDismissMomentumNotification(entry.id)}
                                className="flex h-5 w-5 items-center justify-center rounded-full border border-white/20 text-xs text-white/70 transition hover:border-white/40 hover:bg-white/10 hover:text-white"
                                aria-label="Dismiss momentum notification"
                              >
                                ×
                              </button>
                            </div>
                            <span className="text-sm font-semibold text-white">{entry.symbol}</span>
                            <span className="text-[11px] text-white/80">RSI {entry.rsiSummary}</span>
                            <span className="text-[11px] text-white/80">
                              Stoch RSI (stochastic RSI %D {entry.stochasticSummary})
                            </span>
                            <span className="text-[10px] text-white/60">{formatTriggeredAt(entry.triggeredAt)}</span>
                          </div>
                        )
                      })
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleClearNotifications}
                    className="mt-4 w-full rounded-full border border-indigo-400/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-indigo-100 transition hover:border-indigo-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={allNotifications.length === 0}
                  >
                    Clear notifications
                  </button>
                </div>
              )}
            </div>
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
            <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-3 text-xs text-indigo-100">
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
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-3 text-xs text-emerald-100">
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

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-6 py-8 lg:flex-row lg:items-start lg:gap-10">
        <aside
          id="dashboard-sidebar"
          className={`relative flex w-full flex-col gap-6 transition-[width] duration-300 lg:sticky lg:top-28 lg:flex-shrink-0 ${
            isSidebarCollapsed ? 'lg:w-16' : 'lg:w-80'
          }`}
          aria-label="Dashboard filters and market snapshot"
        >
          <section
            className={`flex flex-col gap-6 rounded-3xl border border-white/5 bg-slate-900/60 transition-[padding,opacity,transform] duration-300 ${
              isSidebarCollapsed ? 'items-center gap-4 px-3 py-4' : 'p-6'
            }`}
          >
            <div
              className={`flex w-full items-center ${
                isSidebarCollapsed ? 'justify-center' : 'justify-between'
              } gap-3`}
            >
              {!isSidebarCollapsed && (
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                  Filters
                </h2>
              )}
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed((previous) => !previous)}
                className={`flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/60 text-xs font-semibold text-slate-200 transition hover:border-indigo-400 hover:text-white ${
                  isSidebarCollapsed ? 'px-2 py-2' : 'px-3 py-1'
                }`}
                aria-expanded={!isSidebarCollapsed}
              >
                <span className="sr-only">
                  {isSidebarCollapsed ? 'Show dashboard filters' : 'Hide dashboard filters'}
                </span>
                <span aria-hidden="true" className="text-lg leading-none">
                  {isSidebarCollapsed ? '⟩' : '⟨'}
                </span>
                {!isSidebarCollapsed && <span aria-hidden="true">Hide</span>}
                {isSidebarCollapsed && <span aria-hidden="true" className="text-[11px]">Show</span>}
              </button>
            </div>
            {!isSidebarCollapsed && (
              <>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Push server</span>
                      {pushServerConnected === null ? (
                        <span className="text-[11px] text-slate-500">Checking…</span>
                      ) : pushServerConnected ? (
                        <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-200">Connected</span>
                      ) : (
                        <span className="rounded-full bg-rose-500/15 px-3 py-1 text-[11px] font-semibold text-rose-200">Offline</span>
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
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Notifications</span>
                      {supportsNotifications ? (
                        notificationPermission === 'granted' ? (
                          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300">Enabled</span>
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
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="symbol" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Crypto
                    </label>
                    <input
                      id="symbol"
                      type="text"
                      value={symbol}
                      onChange={(event) =>
                        onSymbolChange(event.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase())
                      }
                      placeholder="e.g. BTCUSDT"
                      className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-medium uppercase tracking-wide text-white shadow focus:border-indigo-400 focus:outline-none"
                    />
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
                  </div>
                  {barSelection === 'custom' && (
                    <div className="flex flex-col gap-2">
                      <label htmlFor="custom-bar-count" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Custom bars
                      </label>
                      <input
                        id="custom-bar-count"
                        inputMode="numeric"
                        value={customBarCount}
                        onChange={(event) => onCustomBarCountChange(event.target.value.replace(/[^0-9]/g, ''))}
                        placeholder={`Max ${maxBarLimit}`}
                        className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-medium text-white shadow focus:border-indigo-400 focus:outline-none"
                      />
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <label htmlFor="refresh-interval" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Auto refresh
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
                  </div>
                  {refreshSelection === 'custom' && (
                    <div className="flex flex-col gap-2">
                      <label htmlFor="custom-refresh" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Custom refresh (minutes)
                      </label>
                      <input
                        id="custom-refresh"
                        inputMode="numeric"
                        value={customRefresh}
                        onChange={(event) => onCustomRefreshChange(event.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="e.g. 5"
                        className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-medium text-white shadow focus:border-indigo-400 focus:outline-none"
                      />
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <label htmlFor="rsi-lower-bound" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      RSI lower bound
                    </label>
                    <input
                      id="rsi-lower-bound"
                      inputMode="numeric"
                      value={rsiLowerBoundInput}
                      onChange={(event) =>
                        onRsiLowerBoundInputChange(event.target.value.replace(/[^0-9.]/g, ''))
                      }
                      placeholder="30"
                      className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-medium text-white shadow focus:border-indigo-400 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="rsi-upper-bound" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      RSI upper bound
                    </label>
                    <input
                      id="rsi-upper-bound"
                      inputMode="numeric"
                      value={rsiUpperBoundInput}
                      onChange={(event) =>
                        onRsiUpperBoundInputChange(event.target.value.replace(/[^0-9.]/g, ''))
                      }
                      placeholder="70"
                      className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-medium text-white shadow focus:border-indigo-400 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="stochastic-lower-bound" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Stochastic RSI lower bound
                    </label>
                    <input
                      id="stochastic-lower-bound"
                      inputMode="numeric"
                      value={stochasticLowerBoundInput}
                      onChange={(event) =>
                        onStochasticLowerBoundInputChange(event.target.value.replace(/[^0-9.]/g, ''))
                      }
                      placeholder="20"
                      className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-medium text-white shadow focus:border-indigo-400 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="stochastic-upper-bound" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Stochastic RSI upper bound
                    </label>
                    <input
                      id="stochastic-upper-bound"
                      inputMode="numeric"
                      value={stochasticUpperBoundInput}
                      onChange={(event) =>
                        onStochasticUpperBoundInputChange(event.target.value.replace(/[^0-9.]/g, ''))
                      }
                      placeholder="80"
                      className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-medium text-white shadow focus:border-indigo-400 focus:outline-none"
                    />
                  </div>
                </div>
              </>
            )}

          </section>
          {!isSidebarCollapsed && !isLoading && !isError && (
            <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/60 p-6">
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
                <div className="grid gap-6 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-1">
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
            </section>
          )}
        </aside>
        <section className="flex flex-1 flex-col gap-6">
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
          {!isError && (
            <>
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
                title={`MACD (${macdSeries.label})`}
                labels={labels}
                series={[
                  { name: 'MACD', data: macdSeries.macdLine, color: '#60a5fa' },
                  { name: 'Signal', data: macdSeries.signalLine, color: '#f97316' },
                  { name: 'Histogram', data: macdSeries.histogram, color: '#34d399' },
                ]}
                isLoading={isFetching}
              />
              <LineChart
                title={`ADX (${adxSeries.label})`}
                labels={labels}
                series={[
                  { name: 'ADX', data: adxSeries.adxLine, color: '#facc15' },
                  { name: 'Signal', data: adxSeries.signalLine, color: '#60a5fa' },
                  { name: '+DI', data: adxSeries.plusDi, color: '#34d399' },
                  { name: '-DI', data: adxSeries.minusDi, color: '#f87171' },
                ]}
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
          <SignalsPanel
            signals={signals}
            snapshots={timeframeSnapshots}
            isLoading={isFetching || signalsLoading}
            symbol={symbol}
          />
          <ExpertSignalsPanel
            snapshots={timeframeSnapshots}
            isLoading={isFetching || signalsLoading}
            symbol={symbol}
            timeframe={timeframe}
            timeframeOptions={timeframeOptions}
            resolvedBarLimit={resolvedBarLimit}
            macdLabel={macdSeries.label}
            adxLabel={adxSeries.label}
            rsiLengthDescription={rsiLengthDescription}
            stochasticLengthDescription={stochasticLengthDescription}
          />
        </section>
      </main>

      <footer className="border-t border-white/5 bg-slate-950/80">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-6 py-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} CryptoTrendNotify — Live momentum insights at a glance.</p>
          <p>Built for responsive web and installable PWA experiences.</p>
        </div>
      </footer>
    </div>
  )
}
