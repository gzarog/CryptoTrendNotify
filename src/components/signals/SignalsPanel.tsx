import { useEffect, useMemo, useRef, useState } from 'react'
import { TIMEFRAMES } from '../../constants/timeframes'
import { showAppNotification } from '../../lib/notifications'
import { deriveQuantumCompositeSignal, type TrendState } from '../../lib/quantum'
import { getMultiTimeframeSignal } from '../../lib/signals'
import type { TimeframeSignalSnapshot, TradingSignal } from '../../types/signals'
import { PlaceholderCard } from './PlaceholderCard'
import { QuantumPredictionPanel } from './QuantumPredictionPanel'
import { QuantumFlipThresholdCard } from './QuantumFlipThresholdCard'
import { SignalHighlights } from './SignalHighlights'
import { TimeframeOverviewCard } from './TimeframeOverviewCard'
import { snapshotsToMap, sortSnapshotsByTimeframe } from './utils'
import { SignalCardSkeleton } from '../skeletons'

type SignalsPanelProps = {
  signals: TradingSignal[]
  snapshots: TimeframeSignalSnapshot[]
  isLoading: boolean
  symbol: string
}

export function SignalsPanel({ signals, snapshots, isLoading, symbol }: SignalsPanelProps) {
  const [collapsed, setCollapsed] = useState(false)

  const sortedSignals = useMemo(
    () => signals.slice().sort((a, b) => b.confluenceScore - a.confluenceScore),
    [signals],
  )

  const primaryHighlights = useMemo(() => sortedSignals.slice(0, 6), [sortedSignals])
  const multiTimeframeSignal = useMemo(() => getMultiTimeframeSignal(snapshots), [snapshots])
  const quantumSignal = useMemo(() => deriveQuantumCompositeSignal(snapshots), [snapshots])
  const normalizedSnapshots = useMemo(() => sortSnapshotsByTimeframe(snapshots), [snapshots])
  const snapshotsByTimeframe = useMemo(() => snapshotsToMap(normalizedSnapshots), [normalizedSnapshots])

  // Multi-timeframe bias calculations continue to run even though the panel is hidden.
  void multiTimeframeSignal

  const lastQuantumStateRef = useRef<TrendState | null>(null)

  useEffect(() => {
    lastQuantumStateRef.current = null
  }, [symbol])

  useEffect(() => {
    if (!quantumSignal) {
      lastQuantumStateRef.current = null
      return
    }

    const previousState = lastQuantumStateRef.current
    const nextState = quantumSignal.state
    const meetsConfidence = Number.isFinite(quantumSignal.confidence) && quantumSignal.confidence >= 0.72

    if (previousState && previousState !== nextState && meetsConfidence) {
      const quantumVector = quantumSignal.debug?.quantumVector
      const markovVector = quantumSignal.debug?.markovVector

      const safeValues = (values: number[] | undefined): number[] =>
        Array.isArray(values) ? values.filter((value) => Number.isFinite(value)) : []

      const maxFromVector = (vector: typeof quantumVector): number => {
        if (!vector) {
          return 0
        }
        const values = safeValues(Object.values(vector))
        return values.length > 0 ? Math.max(...values) : 0
      }

      const clamp01 = (value: number): number =>
        Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0

      const formatPercent = (value: number): string => `${Math.round(clamp01(value) * 1000) / 10}%`

      const maxQuantumProb = maxFromVector(quantumVector)
      const maxMarkovProb = maxFromVector(markovVector)

      const debugSnippet = {
        state: nextState,
        confidence: quantumSignal.confidence,
        fused: quantumSignal.debug?.fusedVector ?? null,
        quantum: quantumVector ?? null,
        markov: markovVector ?? null,
        weights: quantumSignal.debug?.weights ?? null,
        phases: quantumSignal.phases.map((phase) => ({
          key: phase.key,
          shift: phase.shift,
          direction: phase.direction,
          magnitude: phase.magnitude,
        })),
      }

      void showAppNotification({
        title: `[Quantum] Strong ${nextState}`,
        body: `Conf=${formatPercent(quantumSignal.confidence)} | Pq=${formatPercent(maxQuantumProb)} | Pc=${formatPercent(maxMarkovProb)} | TF=Composite`,
        tag: `quantum-${symbol.toLowerCase()}`,
        data: {
          type: 'quantum-signal',
          symbol,
          timeframe: 'composite',
          state: nextState,
          confidence: quantumSignal.confidence,
          debug: debugSnippet,
        },
      })
    }

    lastQuantumStateRef.current = nextState
  }, [quantumSignal, symbol])

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 shadow-xl">
      <header className="flex items-center justify-between gap-3 border-b border-white/5 px-6 py-4">
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Signals</span>
          <span className="text-sm text-slate-300">Actionable insight across every trading horizon</span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((previous) => !previous)}
          className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-100 transition hover:border-white/20 hover:text-white"
        >
          {collapsed ? 'Expand' : 'Collapse'}
          <span className={`transition-transform ${collapsed ? '' : 'rotate-180'}`}>⌃</span>
        </button>
      </header>

      {!collapsed && (
        <div className="flex flex-col gap-5 px-6 py-6">
          <QuantumFlipThresholdCard threshold={quantumSignal?.flipThreshold ?? null} isLoading={isLoading} />

          <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-950/60 p-5">
            <header className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Qualified signals
              </span>
              <span className="text-sm text-slate-300">
                Highest scoring setups surfaced by the confluence engine
              </span>
            </header>

            {isLoading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 2 }).map((_, index) => (
                  <SignalCardSkeleton key={`signal-card-skeleton-${index}`} />
                ))}
              </div>
            ) : primaryHighlights.length === 0 ? (
              <p className="text-sm text-slate-400">No qualified signals yet. Check back soon.</p>
            ) : (
              <SignalHighlights signals={primaryHighlights} />
            )}
          </div>

          <QuantumPredictionPanel data={quantumSignal} isLoading={isLoading} />

          <div className="grid gap-4 md:grid-cols-2">
            {TIMEFRAMES.map(({ value, label }) => {
              const snapshot = snapshotsByTimeframe.get(value)
              return snapshot ? (
                <TimeframeOverviewCard key={`${snapshot.timeframe}-${snapshot.timeframeLabel}`} snapshot={snapshot} />
              ) : (
                <PlaceholderCard key={`placeholder-${value}`} label={label} value={value} />
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
