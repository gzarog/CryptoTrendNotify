import { type ChangeEvent, type Dispatch, type SetStateAction } from 'react'

import type { HeatmapResult } from '../types/heatmap'

const RISK_PCT_PER_TRADE: Record<string, number> = {
  '5': 0.0075,
  '15': 0.0075,
  '30': 0.0075,
  '60': 0.0075,
  '120': 0.0075,
  '240': 0.0075,
  '360': 0.0075,
}

type RiskManagementPanelProps = {
  currentEquity: string
  onCurrentEquityChange: Dispatch<SetStateAction<string>>
  isCollapsed: boolean
  onToggleCollapse: () => void
  results: HeatmapResult[]
}

const parseEquity = (value: string): number | null => {
  const normalised = value.replace(/,/g, '').trim()
  if (normalised === '') {
    return null
  }

  const parsed = Number(normalised)
  return Number.isFinite(parsed) ? parsed : null
}

const formatNumber = (value: number | null, maximumFractionDigits = 2) =>
  value == null || !Number.isFinite(value)
    ? '—'
    : value.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits,
      })

const formatPercent = (value: number | null) =>
  value == null || !Number.isFinite(value)
    ? '—'
    : `${(value * 100).toFixed(2)}%`

const formatCurrency = (value: number | null) =>
  value == null || !Number.isFinite(value)
    ? '—'
    : value.toLocaleString(undefined, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })

export function RiskManagementPanel({
  currentEquity,
  onCurrentEquityChange,
  isCollapsed,
  onToggleCollapse,
  results,
}: RiskManagementPanelProps) {
  const handleEquityChange = (event: ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.target.value
    const sanitised = rawValue.replace(/[^0-9.,]/g, '')
    onCurrentEquityChange(sanitised)
  }

  const equityValue = parseEquity(currentEquity)

  const sortedResults = [...results]
    .filter((entry) =>
      [
        entry.risk.atr,
        entry.risk.slLong,
        entry.risk.t1Long,
        entry.risk.t2Long,
        entry.risk.slShort,
        entry.risk.t1Short,
        entry.risk.t2Short,
      ].some((value) => value != null && Number.isFinite(value)),
    )
    .sort((a, b) => Number(a.entryTimeframe) - Number(b.entryTimeframe))

  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-white/5 bg-slate-900/60 p-6">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-base font-semibold text-white">Risk management</h2>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-indigo-400 hover:text-white"
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? 'Show' : 'Hide'}
          <span aria-hidden="true">{isCollapsed ? '▾' : '▴'}</span>
        </button>
      </div>
      {!isCollapsed && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="current-equity"
              className="text-xs font-semibold uppercase tracking-wider text-slate-400"
            >
              Current equity
            </label>
            <input
              id="current-equity"
              inputMode="decimal"
              value={currentEquity}
              onChange={handleEquityChange}
              placeholder="e.g. 25,000"
              className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-medium text-white shadow focus:border-indigo-400 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-4">
            {sortedResults.length === 0 ? (
              <p className="text-xs text-slate-400">No calculated risk levels available.</p>
            ) : (
              sortedResults.map((result) => {
                const riskPct = RISK_PCT_PER_TRADE[result.entryTimeframe] ?? null
                const riskCapital =
                  equityValue != null && riskPct != null ? equityValue * riskPct : null

                const longStopDistance =
                  result.price != null && result.risk.slLong != null
                    ? result.price - result.risk.slLong
                    : null
                const shortStopDistance =
                  result.price != null && result.risk.slShort != null
                    ? result.risk.slShort - result.price
                    : null

                return (
                  <article
                    key={`${result.entryTimeframe}-${result.symbol}`}
                    className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-slate-950/60 p-4"
                  >
                    <header className="flex items-start justify-between gap-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-white">{result.entryLabel}</span>
                        <span className="text-[11px] uppercase tracking-wide text-slate-400">
                          {result.signal} · {result.strength}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">ATR</p>
                        <p className="text-sm font-semibold text-slate-200">
                          {formatNumber(result.risk.atr)}
                        </p>
                      </div>
                    </header>

                    <div className="grid gap-3 text-sm text-slate-200">
                      <div className="grid grid-cols-2 gap-3 text-xs text-slate-300">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-slate-400">Price</p>
                          <p className="text-sm font-medium text-slate-200">
                            {formatNumber(result.price)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] uppercase tracking-wide text-slate-400">
                            Risk budget
                          </p>
                          <p className="text-sm font-medium text-slate-200">
                            {riskCapital != null && riskPct != null
                              ? `${formatCurrency(riskCapital)} (${formatPercent(riskPct)})`
                              : '—'}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                          <p className="text-[11px] uppercase tracking-wide text-emerald-200">Long plan</p>
                          <dl className="mt-2 space-y-1">
                            <div className="flex items-center justify-between">
                              <dt>SL</dt>
                              <dd>{formatNumber(result.risk.slLong)}</dd>
                            </div>
                            <div className="flex items-center justify-between">
                              <dt>TP1</dt>
                              <dd>{formatNumber(result.risk.t1Long)}</dd>
                            </div>
                            <div className="flex items-center justify-between">
                              <dt>TP2</dt>
                              <dd>{formatNumber(result.risk.t2Long)}</dd>
                            </div>
                            <div className="flex items-center justify-between text-xs text-emerald-200/80">
                              <dt>Risk distance</dt>
                              <dd>{formatNumber(longStopDistance)}</dd>
                            </div>
                          </dl>
                        </div>
                        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">
                          <p className="text-[11px] uppercase tracking-wide text-rose-200">Short plan</p>
                          <dl className="mt-2 space-y-1">
                            <div className="flex items-center justify-between">
                              <dt>SL</dt>
                              <dd>{formatNumber(result.risk.slShort)}</dd>
                            </div>
                            <div className="flex items-center justify-between">
                              <dt>TP1</dt>
                              <dd>{formatNumber(result.risk.t1Short)}</dd>
                            </div>
                            <div className="flex items-center justify-between">
                              <dt>TP2</dt>
                              <dd>{formatNumber(result.risk.t2Short)}</dd>
                            </div>
                            <div className="flex items-center justify-between text-xs text-rose-200/80">
                              <dt>Risk distance</dt>
                              <dd>{formatNumber(shortStopDistance)}</dd>
                            </div>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </div>
      )}
    </section>
  )
}
