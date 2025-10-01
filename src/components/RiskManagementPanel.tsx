import { type ChangeEvent, type Dispatch, type SetStateAction } from 'react'

import type { HeatmapResult } from '../types/heatmap'

type RiskManagementPanelProps = {
  currentEquity: string
  onCurrentEquityChange: Dispatch<SetStateAction<string>>
  riskBudgetPercent: string
  onRiskBudgetPercentChange: Dispatch<SetStateAction<string>>
  atrMultiplier: string
  onAtrMultiplierChange: Dispatch<SetStateAction<string>>
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

const parseNumericInput = (value: string): number | null => {
  const normalised = value.trim()
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
  riskBudgetPercent,
  onRiskBudgetPercentChange,
  atrMultiplier,
  onAtrMultiplierChange,
  isCollapsed,
  onToggleCollapse,
  results,
}: RiskManagementPanelProps) {
  const handleEquityChange = (event: ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.target.value
    const sanitised = rawValue.replace(/[^0-9.,]/g, '')
    onCurrentEquityChange(sanitised)
  }

  const handleRiskBudgetChange = (event: ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.target.value
    const sanitised = rawValue.replace(/[^0-9.]/g, '')
    onRiskBudgetPercentChange(sanitised)
  }

  const handleAtrMultiplierChange = (event: ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.target.value
    const sanitised = rawValue.replace(/[^0-9.]/g, '')
    onAtrMultiplierChange(sanitised)
  }

  const equityValue = parseEquity(currentEquity)
  const riskBudgetPercentValue = parseNumericInput(riskBudgetPercent)
  const riskBudgetDecimal =
    riskBudgetPercentValue != null ? riskBudgetPercentValue / 100 : null
  const atrMultiplierValue = parseNumericInput(atrMultiplier) ?? 1

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
    <section
      className={`flex h-full flex-col gap-4 rounded-3xl border border-white/5 bg-slate-900/60 transition-[padding,opacity,transform] duration-300 ${
        isCollapsed ? 'items-center gap-3 px-3 py-4' : 'p-6'
      }`}
    >
      <div
        className={`flex w-full items-center ${
          isCollapsed ? 'justify-center' : 'justify-between'
        } gap-3`}
      >
        {!isCollapsed && <h2 className="text-base font-semibold text-white">Risk management</h2>}
        <button
          type="button"
          onClick={onToggleCollapse}
          className={`flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/60 text-xs font-semibold text-slate-200 transition hover:border-indigo-400 hover:text-white ${
            isCollapsed ? 'px-2 py-2' : 'px-3 py-1'
          }`}
          aria-expanded={!isCollapsed}
        >
          <span className="sr-only">
            {isCollapsed ? 'Show risk management panel' : 'Hide risk management panel'}
          </span>
          <span aria-hidden="true" className="text-lg leading-none">
            {isCollapsed ? '⟨' : '⟩'}
          </span>
          {!isCollapsed && <span aria-hidden="true">Hide</span>}
          {isCollapsed && <span aria-hidden="true" className="text-[11px]">Show</span>}
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="risk-budget-percent"
                className="text-xs font-semibold uppercase tracking-wider text-slate-400"
              >
                Risk budget %
              </label>
              <input
                id="risk-budget-percent"
                inputMode="decimal"
                value={riskBudgetPercent}
                onChange={handleRiskBudgetChange}
                placeholder="e.g. 0.75"
                className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-medium text-white shadow focus:border-indigo-400 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="atr-multiplier"
                className="text-xs font-semibold uppercase tracking-wider text-slate-400"
              >
                ATR multiplier
              </label>
              <input
                id="atr-multiplier"
                inputMode="decimal"
                value={atrMultiplier}
                onChange={handleAtrMultiplierChange}
                placeholder="e.g. 1"
                className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-medium text-white shadow focus:border-indigo-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {sortedResults.length === 0 ? (
              <p className="text-xs text-slate-400">No calculated risk levels available.</p>
            ) : (
              sortedResults.map((result) => {
                const riskCapital =
                  equityValue != null && riskBudgetDecimal != null
                    ? equityValue * riskBudgetDecimal
                    : null
                const riskBudgetPercentLabel =
                  riskBudgetPercentValue != null
                    ? `${riskBudgetPercentValue.toFixed(2)}%`
                    : null

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
                          {formatNumber(
                            result.risk.atr != null
                              ? result.risk.atr * atrMultiplierValue
                              : null,
                          )}
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
                            {riskCapital != null && riskBudgetDecimal != null
                              ? `${formatCurrency(riskCapital)} (${riskBudgetPercentLabel ?? '—'})`
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
