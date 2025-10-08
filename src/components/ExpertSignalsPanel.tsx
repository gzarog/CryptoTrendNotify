import { useMemo, useState } from 'react'
import type { TimeframeOption } from '../constants/timeframes'
import { getBaseTimeframeWeights, getMultiTimeframeSignal } from '../lib/signals'
import type { CombinedSignalDirection, TimeframeSignalSnapshot } from '../types/signals'
import { Badge } from './signals/Badge'
import { PercentageBar } from './signals/PercentageBar'
import {
  clampPercentage,
  formatSignedValue,
  resolveBiasDirection,
  snapshotsToMap,
  sortSnapshotsByTimeframe,
} from './signals/utils'

type PresetKey = 'BALANCED' | 'SCALPER' | 'SWING'

type FusionWeights = Record<string, number>

type ContributionRow = {
  key: string
  label: string
  baseWeight: number
  presetWeight: number
  signalStrength: number | null
  weightedScore: number | null
  direction: CombinedSignalDirection
  markovPrior: number | null
}

const ENGINE_METADATA = {
  symbol: 'BTCUSDT',
  warmupBars: 300,
  vwapAnchors: ['session', 'day'] as const,
  categoryWeights: {
    trend: 2,
    momentum: 2,
    adx: 1,
    microstructure: 2,
    contrarian: 2,
    onchain: 2,
    vol_regime: 1,
    markov: 2,
    cross_tf: 1,
  } as const,
  categoryMultipliers: {
    '5': {
      trend: 0.8,
      momentum: 1.3,
      adx: 0.8,
      micro: 1.6,
      contrarian: 0.9,
      onchain: 0.4,
      vol_regime: 1,
      markov: 0.6,
    },
    '15': {
      trend: 0.9,
      momentum: 1.2,
      adx: 1,
      micro: 1.4,
      contrarian: 1,
      onchain: 0.5,
      vol_regime: 1,
      markov: 0.7,
    },
    '30': {
      trend: 1.1,
      momentum: 1.1,
      adx: 1.1,
      micro: 1.2,
      contrarian: 1,
      onchain: 0.6,
      vol_regime: 1,
      markov: 0.9,
    },
    '60': {
      trend: 1.3,
      momentum: 1,
      adx: 1.2,
      micro: 1,
      contrarian: 1,
      onchain: 0.8,
      vol_regime: 1,
      markov: 1.1,
    },
    '120': {
      trend: 1.4,
      momentum: 0.9,
      adx: 1.2,
      micro: 0.8,
      contrarian: 1.1,
      onchain: 1,
      vol_regime: 1,
      markov: 1.2,
    },
    '240': {
      trend: 1.5,
      momentum: 0.8,
      adx: 1.1,
      micro: 0.7,
      contrarian: 1.2,
      onchain: 1.2,
      vol_regime: 1.1,
      markov: 1.3,
    },
    '360': {
      trend: 1.6,
      momentum: 0.7,
      adx: 1,
      micro: 0.6,
      contrarian: 1.3,
      onchain: 1.3,
      vol_regime: 1.2,
      markov: 1.4,
    },
  } as const,
  thresholds: {
    strongBuy: 7,
    strongSell: -7,
    neutral: [-2, 2] as const,
  },
  risk: {
    riskPctPerTrade: 0.5,
    atrStopMult: 1.5,
    atrTrailMult: 2,
    tpLadder: [1, 2, 3.5] as const,
  },
} as const

const PRESET_WEIGHT_OVERRIDES: Record<Exclude<PresetKey, 'BALANCED'>, FusionWeights> = {
  SCALPER: {
    '5': 0.2,
    '15': 0.25,
    '30': 0.25,
    '60': 0.15,
    '120': 0.1,
    '240': 0.04,
    '360': 0.01,
    '420': 0,
  },
  SWING: {
    '5': 0.05,
    '15': 0.1,
    '30': 0.2,
    '60': 0.25,
    '120': 0.2,
    '240': 0.12,
    '360': 0.06,
    '420': 0.02,
  },
}

const PRESET_DESCRIPTIONS: Record<PresetKey, string> = {
  BALANCED: 'Balanced fusion — default blend across intraday to swing horizons.',
  SCALPER: 'Scalper fusion — front-loads short-term conviction for rapid reactions.',
  SWING: 'Swing fusion — emphasises higher timeframes for positional trades.',
}

const CATEGORY_LABELS: Record<string, { title: string; description: string }> = {
  trend: {
    title: 'Trend',
    description: 'EMA/MA structure and directional bias.',
  },
  momentum: {
    title: 'Momentum',
    description: 'MACD, RSI and stochastic inflection.',
  },
  adx: {
    title: 'ADX',
    description: 'Trend strength confirmation.',
  },
  microstructure: {
    title: 'Microstructure',
    description: 'Order book imbalance and CVD thrust.',
  },
  contrarian: {
    title: 'Contrarian',
    description: 'Funding, OI and crowding extremes.',
  },
  onchain: {
    title: 'On-chain',
    description: 'Exchange flows and whale activity.',
  },
  vol_regime: {
    title: 'Volatility regime',
    description: 'ATR regime and IV vs RV spread.',
  },
  markov: {
    title: 'Markov regime',
    description: 'State machine prior with smoothing.',
  },
  cross_tf: {
    title: 'Cross timeframe',
    description: 'Agreement bonus across horizons.',
  },
}

const PIPELINE_STAGES: Array<{
  id: string
  label: string
  description: string
  points: string[]
  icon: string
}> = [
  {
    id: 'data',
    label: '1) Data adapters',
    description: 'Live market structure and derivatives flow.',
    icon: '🛰️',
    points: [
      'fetchOHLCV() with 300-bar warmup per timeframe.',
      'Top-5 order book depth + 1s trade delta buckets.',
      'Funding, open interest and IV/RV surfaces.',
      'Session & daily anchored VWAP distances.',
      'On-chain netflow and whale footprint.',
    ],
  },
  {
    id: 'features',
    label: '2-3) Feature engineering',
    description: 'Normalize momentum, structure and flow.',
    icon: '🧮',
    points: [
      'EMA/MA stack, RSI, StochRSI and MACD lattice.',
      'ADX, ATR, CCI, ROC, Bollinger + Keltner envelopes.',
      'Order book imbalance, CVD slope and VWAP drift.',
      'Funding bias, OI velocity and IV-RV z-scores.',
      'Z-score normalization with ±3σ clipping.',
    ],
  },
  {
    id: 'regime',
    label: '4-5) Regime awareness',
    description: 'Blend volatility state with Markov priors.',
    icon: '🧭',
    points: [
      'Markov states D/R/B/U smoothed over 10 bars.',
      'Volatility bias from ATR regime and IV vs RV.',
      'Dynamic modifiers react to RV>IV, ADX60 and crowding.',
      'Liquidity session filters throttle microstructure weight.',
    ],
  },
  {
    id: 'scoring',
    label: '6-8) Scoring & fusion',
    description: 'Category weights sum into per-TF conviction.',
    icon: '⚖️',
    points: [
      'Trend, momentum, microstructure and contrarian stacks.',
      'On-chain, volatility and Markov priors inject context.',
      'Scores clipped to ±10 with 5m noise guardrails.',
      'Preset fusion mixes align composite conviction.',
      'Cross-timeframe agreement bonus (W.cross_tf).',
    ],
  },
  {
    id: 'execution',
    label: '9-11) Execution loop',
    description: 'Risk-managed orders and actionable alerts.',
    icon: '🚀',
    points: [
      'Guards enforce liquidity, spread and cooldown filters.',
      'ATR-based sizing with VWAP anchored entries.',
      'Multi-target ladder & ATR trail manager.',
      'Alert payload broadcasts composite context.',
      'Loop sleeps to next TF0 close (5m).',
    ],
  },
]

const PRESET_OPTIONS: Array<{ value: PresetKey; label: string }> = [
  { value: 'BALANCED', label: 'Balanced' },
  { value: 'SCALPER', label: 'Scalper' },
  { value: 'SWING', label: 'Swing' },
]

function normalizeTimeframeKey(value: string): string {
  const numeric = value.replace(/[^0-9]/g, '')
  if (numeric.length > 0) {
    return numeric
  }
  return value
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function buildTimeframeLabelMap(options: TimeframeOption[]): Record<string, string> {
  return options.reduce((accumulator, option) => {
    const normalized = normalizeTimeframeKey(option.value)
    if (!(normalized in accumulator)) {
      accumulator[normalized] = option.label
    }
    return accumulator
  }, {} as Record<string, string>)
}

function formatTimeframeLabel(key: string, map: Record<string, string>): string {
  return map[key] ?? `${key}m`
}

function computeNormalizedWeights(weights: FusionWeights, order?: string[]): FusionWeights {
  const keys = order ?? Object.keys(weights)
  const entries = keys.map((key) => [key, weights[key] ?? 0] as const)
  const sum = entries.reduce((accumulator, [, value]) => accumulator + value, 0)

  if (sum === 0) {
    return Object.fromEntries(entries.map(([key]) => [key, 0])) as FusionWeights
  }

  return Object.fromEntries(
    entries.map(([key, value]) => [key, value / sum]),
  ) as FusionWeights
}

function formatPercent(value: number | null, decimals = 0): string {
  if (value == null || !Number.isFinite(value)) {
    return '—'
  }
  const factor = 10 ** decimals
  const normalized = Math.round(value * factor) / factor
  return `${normalized.toFixed(decimals)}%`
}

function formatSignedNumber(value: number | null, decimals = 2): string {
  if (value == null || !Number.isFinite(value)) {
    return '—'
  }
  const factor = 10 ** decimals
  let normalized = Math.round(value * factor) / factor
  if (Object.is(normalized, -0)) {
    normalized = 0
  }
  const formatted = normalized.toFixed(decimals).replace(/\.0+$/, '')
  return normalized > 0 ? `+${formatted}` : formatted
}

type ExpertSignalsPanelProps = {
  snapshots: TimeframeSignalSnapshot[]
  isLoading: boolean
  symbol: string
  timeframe: string
  timeframeOptions: TimeframeOption[]
  resolvedBarLimit: number
  macdLabel: string
  adxLabel: string
  rsiLengthDescription: string
  stochasticLengthDescription: string
}

export function ExpertSignalsPanel({
  snapshots,
  isLoading,
  symbol,
  timeframe,
  timeframeOptions,
  resolvedBarLimit,
  macdLabel,
  adxLabel,
  rsiLengthDescription,
  stochasticLengthDescription,
}: ExpertSignalsPanelProps) {
  const [activePreset, setActivePreset] = useState<PresetKey>('BALANCED')

  const orderedSnapshots = useMemo(
    () => sortSnapshotsByTimeframe(snapshots),
    [snapshots],
  )

  const snapshotByTimeframe = useMemo(() => {
    const initial = snapshotsToMap(orderedSnapshots)
    const map = new Map<string, TimeframeSignalSnapshot>()
    for (const [key, snapshot] of initial.entries()) {
      const normalized = normalizeTimeframeKey(key)
      if (!map.has(normalized)) {
        map.set(normalized, snapshot)
      }
    }
    return map
  }, [orderedSnapshots])

  const multiSignal = useMemo(
    () => getMultiTimeframeSignal(orderedSnapshots),
    [orderedSnapshots],
  )

  const timeframeLabelMap = useMemo(
    () => buildTimeframeLabelMap(timeframeOptions),
    [timeframeOptions],
  )

  const baseWeights = useMemo(
    () => computeNormalizedWeights(getBaseTimeframeWeights()),
    [],
  )

  const selectedTimeframeKey = useMemo(
    () => normalizeTimeframeKey(timeframe),
    [timeframe],
  )

  const timeframeKeys = useMemo(() => {
    const keys = new Set<string>()
    Object.keys(baseWeights).forEach((key) => keys.add(key))
    snapshotByTimeframe.forEach((_, key) => keys.add(key))
    multiSignal?.contributions.forEach((contribution) => {
      keys.add(normalizeTimeframeKey(contribution.timeframe))
    })

    const ordered = timeframeOptions
      .map(({ value }) => normalizeTimeframeKey(value))
      .filter((value) => keys.has(value))
    const remaining = Array.from(keys).filter((value) => !ordered.includes(value))

    remaining.sort((a, b) => Number(a) - Number(b))

    return [...ordered, ...remaining]
  }, [baseWeights, multiSignal, snapshotByTimeframe, timeframeOptions])

  const presetWeights = useMemo(() => {
    const override = activePreset === 'BALANCED' ? null : PRESET_WEIGHT_OVERRIDES[activePreset]
    const raw: FusionWeights = {}

    timeframeKeys.forEach((key) => {
      const baseValue = baseWeights[key] ?? 0
      if (override) {
        raw[key] = override[key] ?? baseValue
      } else {
        raw[key] = baseValue
      }
    })

    return computeNormalizedWeights(raw, timeframeKeys)
  }, [activePreset, baseWeights, timeframeKeys])

  const contributions = useMemo(() => {
    const rows: ContributionRow[] = []
    let combinedScore = 0

    timeframeKeys.forEach((key) => {
      const snapshot = snapshotByTimeframe.get(key) ?? null
      const signalStrength = snapshot?.combined.breakdown.signalStrength ?? null
      const presetWeight = presetWeights[key] ?? 0
      const weightedScore =
        signalStrength != null && Number.isFinite(signalStrength)
          ? signalStrength * presetWeight
          : null
      if (weightedScore != null) {
        combinedScore += weightedScore
      }

      rows.push({
        key,
        label: formatTimeframeLabel(key, timeframeLabelMap),
        baseWeight: baseWeights[key] ?? 0,
        presetWeight,
        signalStrength: signalStrength ?? null,
        weightedScore,
        direction: snapshot?.combined.direction ?? 'Neutral',
        markovPrior: snapshot?.combined.breakdown.markov.priorScore ?? null,
      })
    })

    const available = rows.filter((row) => row.signalStrength != null && row.signalStrength !== 0)
    const bullish = available.filter((row) => (row.signalStrength ?? 0) > 0).length
    const bearish = available.filter((row) => (row.signalStrength ?? 0) < 0).length
    const considered = available.length
    const majority = considered === 0 ? 0 : Math.max(bullish, bearish)
    const agreement = considered === 0 ? 0.5 : majority / considered
    const crossContribution = (agreement - 0.5) * ENGINE_METADATA.categoryWeights.cross_tf
    const compositeScore = clamp(combinedScore + crossContribution, -10, 10)
    const compositeDirection = resolveBiasDirection(compositeScore)
    const strength = clampPercentage(Math.min(Math.abs(compositeScore) / 10, 1) * 100)

    return {
      rows,
      combinedScore,
      compositeScore,
      crossContribution,
      agreement,
      direction: compositeDirection,
      strength,
    }
  }, [baseWeights, presetWeights, snapshotByTimeframe, timeframeKeys])

  const categoryInsights = useMemo(() => {
    const entries = Object.entries(ENGINE_METADATA.categoryMultipliers).map(
      ([timeframe, multipliers]) => {
        const key = normalizeTimeframeKey(timeframe)
        const resolved = Object.entries(multipliers).map(([categoryKey, multiplier]) => {
          const normalizedKey = categoryKey === 'micro' ? 'microstructure' : categoryKey
          const base =
            ENGINE_METADATA.categoryWeights[
              normalizedKey as keyof typeof ENGINE_METADATA.categoryWeights
            ] ?? 0
          return {
            key: normalizedKey,
            weight: base * (multiplier + 0),
          }
        })

        const ranked = resolved
          .filter((entry) => entry.key !== 'cross_tf')
          .sort((a, b) => b.weight - a.weight)
          .slice(0, 3)

        return {
          key,
          label: formatTimeframeLabel(key, timeframeLabelMap),
          ranked,
        }
      },
    )

    return entries.filter((entry): entry is NonNullable<typeof entry> => entry != null)
  }, [timeframeLabelMap])

  const compositeGradient =
    contributions.direction === 'Bullish'
      ? 'from-emerald-400/80 via-emerald-500/80 to-emerald-600/80'
      : contributions.direction === 'Bearish'
      ? 'from-rose-400/80 via-rose-500/80 to-rose-600/80'
      : 'from-slate-500/70 via-slate-400/70 to-slate-300/70'

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/70 shadow-xl">
      <header className="flex flex-col gap-4 border-b border-white/5 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Expert composite signal engine
          </span>
          <span className="text-sm text-slate-300">
            Multi-layer fusion that mirrors the execution pseudocode.
          </span>
          <span className="text-xs text-slate-400">
            Symbol {symbol} • Focus {formatTimeframeLabel(selectedTimeframeKey, timeframeLabelMap)} • Window{' '}
            {resolvedBarLimit} bars • Warmup {ENGINE_METADATA.warmupBars} bars • Anchored VWAP: {ENGINE_METADATA.vwapAnchors.join(', ')}
          </span>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
            <Badge tone="muted">Window {resolvedBarLimit} bars</Badge>
            <Badge tone="muted">MACD {macdLabel}</Badge>
            <Badge tone="muted">ADX {adxLabel}</Badge>
            <Badge tone="muted">RSI {rsiLengthDescription}</Badge>
            <Badge tone="muted">Stoch RSI {stochasticLengthDescription}</Badge>
          </div>
        </div>
        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
          <span>CONFIG.active_preset</span>
          <select
            className="min-w-[180px] rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm font-semibold text-white shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={activePreset}
            onChange={(event) => setActivePreset(event.target.value as PresetKey)}
          >
            {PRESET_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="text-[11px] font-normal normal-case tracking-normal text-slate-400">
            {PRESET_DESCRIPTIONS[activePreset]}
          </span>
        </label>
      </header>

      <div className="flex flex-col gap-6 px-6 py-6">
        <section className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-950/60 p-5">
          <header className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Composite bias snapshot</span>
            <span className="text-sm text-slate-300">
              Preset-adjusted weighting applied to live timeframe snapshots.
            </span>
          </header>

          {isLoading ? (
            <p className="text-sm text-slate-400">Blending contributions…</p>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-3 text-xs text-slate-300">
                <div className="flex flex-col">
                  <span className="text-[11px] uppercase tracking-wide text-slate-400">Composite score</span>
                  <span className="text-base font-semibold text-white">
                    {formatSignedNumber(contributions.compositeScore, 2)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] uppercase tracking-wide text-slate-400">Bias</span>
                  <span className="text-base font-semibold text-white">{contributions.direction}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] uppercase tracking-wide text-slate-400">Cross-TF boost</span>
                  <span className="text-base font-semibold text-white">
                    {formatSignedNumber(contributions.crossContribution, 2)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] uppercase tracking-wide text-slate-400">Agreement</span>
                  <span className="text-base font-semibold text-white">
                    {formatPercent(contributions.agreement * 100, 0)}
                  </span>
                </div>
              </div>

              <PercentageBar
                value={contributions.strength}
                gradient={compositeGradient}
                label={`${contributions.strength}%`}
              />

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10 text-left text-xs text-slate-200">
                  <thead className="text-[11px] uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Timeframe</th>
                      <th className="px-3 py-2">Base weight</th>
                      <th className="px-3 py-2">Preset weight</th>
                      <th className="px-3 py-2">Signal score</th>
                      <th className="px-3 py-2">Weighted</th>
                      <th className="px-3 py-2">Markov</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {contributions.rows.map((row) => {
                      const weightDelta = row.presetWeight - row.baseWeight
                      const deltaLabel = formatSignedNumber(weightDelta, 2)
                      const directionBadgeClass =
                        row.direction === 'Bullish'
                          ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-100'
                          : row.direction === 'Bearish'
                          ? 'border-rose-400/60 bg-rose-500/10 text-rose-100'
                          : 'border-slate-400/40 bg-slate-500/10 text-slate-100'
                      const isFocused = row.key === selectedTimeframeKey
                      const rowClassName = isFocused
                        ? 'bg-indigo-500/10 ring-1 ring-inset ring-indigo-400/60'
                        : 'hover:bg-slate-900/50'

                      return (
                        <tr key={row.key} className={rowClassName}>
                          <td className="whitespace-nowrap px-3 py-2">
                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-semibold text-white">{row.label}</span>
                              <Badge className={directionBadgeClass}>{row.direction}</Badge>
                            </div>
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] text-slate-300">
                            {formatPercent(row.baseWeight * 100, 1)}
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] text-slate-300">
                            <div className="flex items-center gap-2">
                              <span>{formatPercent(row.presetWeight * 100, 1)}</span>
                              {weightDelta !== 0 && (
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                    weightDelta > 0
                                      ? 'bg-emerald-500/10 text-emerald-200'
                                      : 'bg-rose-500/10 text-rose-200'
                                  }`}
                                >
                                  {deltaLabel}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] text-slate-200">
                            {row.signalStrength != null
                              ? formatSignedValue(row.signalStrength, 2)
                              : '—'}
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] text-slate-200">
                            {row.weightedScore != null
                              ? formatSignedValue(row.weightedScore, 2)
                              : '—'}
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] text-slate-200">
                            {row.markovPrior != null
                              ? formatSignedNumber(row.markovPrior, 2)
                              : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-950/60 p-5">
          <header className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Category weighting</span>
            <span className="text-sm text-slate-300">
              Base category weights (W) blended with timeframe multipliers (CATMUL).
            </span>
          </header>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(ENGINE_METADATA.categoryWeights).map(([key, weight]) => {
              const meta = CATEGORY_LABELS[key] ?? { title: key, description: '' }
              return (
                <div
                  key={key}
                  className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-3"
                >
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="text-[11px] uppercase tracking-wide text-slate-400">{meta.title}</span>
                    <span className="font-mono text-[11px] text-slate-200">{weight.toFixed(1)}x</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-400">{meta.description}</p>
                </div>
              )
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {categoryInsights.map((entry) => (
              <div
                key={`insight-${entry.key}`}
                className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-3"
              >
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {entry.label}
                </span>
                <div className="flex flex-col gap-2">
                  {entry.ranked.map((category) => {
                    const label = CATEGORY_LABELS[category.key] ?? {
                      title: category.key,
                      description: '',
                    }
                    return (
                      <div key={`${entry.key}-${category.key}`} className="flex items-center justify-between">
                        <span className="text-xs text-slate-300">{label.title}</span>
                        <span className="font-mono text-[11px] text-slate-200">
                          {(category.weight).toFixed(2)}x
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 rounded-3xl border border-white/10 bg-slate-950/60 p-5 lg:grid-cols-2">
          {PIPELINE_STAGES.map((stage) => (
            <article
              key={stage.id}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-3"
            >
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="text-[11px] uppercase tracking-wide text-slate-400">
                  {stage.label}
                </span>
                <span className="text-lg">{stage.icon}</span>
              </div>
              <p className="text-sm font-semibold text-white">{stage.description}</p>
              <ul className="flex list-disc flex-col gap-1 pl-4 text-[11px] leading-relaxed text-slate-400">
                {stage.points.map((point) => (
                  <li key={`${stage.id}-${point}`}>{point}</li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      </div>
    </section>
  )
}
