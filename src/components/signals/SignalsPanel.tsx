import { useMemo, useState } from 'react'
import { TIMEFRAMES } from '../../constants/timeframes'
import { getMultiTimeframeSignal } from '../../lib/signals'
import type { TimeframeSignalSnapshot, TradingSignal } from '../../types/signals'
import { MultiTimeframeSummary } from './MultiTimeframeSummary'
import { PlaceholderCard } from './PlaceholderCard'
import { SignalHighlights } from './SignalHighlights'
import { TimeframeOverviewCard } from './TimeframeOverviewCard'
import { snapshotsToMap, sortSnapshotsByTimeframe } from './utils'

type SignalsPanelProps = {
  signals: TradingSignal[]
  snapshots: TimeframeSignalSnapshot[]
  isLoading: boolean
}

export function SignalsPanel({ signals, snapshots, isLoading }: SignalsPanelProps) {
  const [collapsed, setCollapsed] = useState(false)

  const sortedSignals = useMemo(
    () => signals.slice().sort((a, b) => b.confluenceScore - a.confluenceScore),
    [signals],
  )

  const primaryHighlights = useMemo(() => sortedSignals.slice(0, 6), [sortedSignals])
  const multiTimeframeSignal = useMemo(() => getMultiTimeframeSignal(snapshots), [snapshots])
  const normalizedSnapshots = useMemo(() => sortSnapshotsByTimeframe(snapshots), [snapshots])
  const snapshotsByTimeframe = useMemo(() => snapshotsToMap(normalizedSnapshots), [normalizedSnapshots])

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
          {multiTimeframeSignal && <MultiTimeframeSummary signal={multiTimeframeSignal} />}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {TIMEFRAMES.map(({ value, label }) => {
              const snapshot = snapshotsByTimeframe.get(value)
              return snapshot ? (
                <TimeframeOverviewCard key={`${snapshot.timeframe}-${snapshot.timeframeLabel}`} snapshot={snapshot} />
              ) : (
                <PlaceholderCard key={`placeholder-${value}`} label={label} value={value} />
              )
            })}
          </div>

          {isLoading ? (
            <p className="text-sm text-slate-400">Calculating signals…</p>
          ) : primaryHighlights.length === 0 ? (
            <p className="text-sm text-slate-400">No qualified signals yet. Check back soon.</p>
          ) : (
            <SignalHighlights signals={primaryHighlights} />
          )}
        </div>
      )}
    </section>
  )
}
