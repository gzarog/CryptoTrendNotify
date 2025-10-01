import { type ChangeEvent, type Dispatch, type SetStateAction } from 'react'

type RiskManagementPanelProps = {
  currentEquity: string
  onCurrentEquityChange: Dispatch<SetStateAction<string>>
  isCollapsed: boolean
  onToggleCollapse: () => void
}

type TypeDefinition = {
  name: string
  description: string
  fields: Array<{ name: string; description: string }>
}

const TYPE_DEFINITIONS: TypeDefinition[] = [
  {
    name: 'CandleSet',
    description: 'OHLC candles used to evaluate volatility and indicator context.',
    fields: [
      { name: 'close[]', description: 'Array of candle close prices.' },
      { name: 'high[]', description: 'Array of session highs for each bar.' },
      { name: 'low[]', description: 'Array of session lows for each bar.' },
      { name: 'time[]', description: 'Optional timestamps tracking each bar close.' },
    ],
  },
  {
    name: 'SignalContext',
    description:
      'Snapshot of the triggering signal with directional bias, volatility and filter context.',
    fields: [
      { name: 'symbol', description: 'Instrument identifier, e.g. "BYBIT:BTCUSDT".' },
      { name: 'side', description: 'Proposed trade direction: LONG or SHORT.' },
      { name: 'entryTF', description: 'Entry timeframe used for sizing calculations.' },
      { name: 'price', description: 'Latest close price acting as the entry anchor.' },
      { name: 'atr / atrPct', description: 'Volatility metrics in absolute and percentage terms.' },
      { name: 'bias', description: 'Higher timeframe directional bias.' },
      { name: 'votes', description: 'Momentum vote distribution across timeframes.' },
      {
        name: 'rsiHTF / rsiLTF',
        description: 'RSI readings split across higher and lower timeframes.',
      },
      { name: 'stochrsi', description: 'Stochastic RSI readings and crossing events.' },
      { name: 'filters', description: 'Moving average filters including MA200 distance.' },
      { name: 'barTimeISO', description: 'ISO timestamp of the triggering bar.' },
      { name: 'strengthHint', description: 'Optional pre-computed strength classification.' },
    ],
  },
  {
    name: 'RiskConfig',
    description: 'Configuration inputs controlling base risk, ladders and throttles.',
    fields: [
      { name: 'baseRiskWeak/Std/StrongPct', description: 'Baseline risk budget per signal strength.' },
      { name: 'ladders', description: 'Step weights and quantities for scaling into positions.' },
      { name: 'slMultipliers', description: 'Stop-loss distance multipliers per ladder add.' },
      { name: 'tpMultipliers', description: 'Take-profit brackets assigned to each ladder.' },
      { name: 'useHardTPs', description: 'Toggle between static and trailing take-profit logic.' },
      { name: 'volMin/MaxAtrPct', description: 'ATR bounds that throttle or boost risk exposure.' },
      { name: 'equityTiers', description: 'Equity bands that cap maximum risk allocation.' },
      { name: 'maxOpenRiskPctPortfolio', description: 'Portfolio level cap on simultaneous open risk.' },
      { name: 'maxOpenPositions', description: 'Guard rail on concurrent positions.' },
      { name: 'maxDailyLossPct', description: 'Daily loss stopper before halting new trades.' },
      { name: 'instrumentRiskCapPct', description: 'Instrument-specific maximum allocation.' },
      { name: 'allowPyramiding / pyramidMaxAdds', description: 'Controls additional adds after ladder completion.' },
      { name: 'contractRoundMode', description: 'Exchange specific rounding mode for orders.' },
      { name: 'minOrderQty / qtyStep', description: 'Minimum order size and contract increments.' },
      { name: 'tickSize', description: 'Minimum price increment for the venue.' },
      { name: 'drawdownThrottle', description: 'Dynamic risk reductions applied during drawdowns.' },
    ],
  },
  {
    name: 'AccountState',
    description: 'Live account snapshot used for budgeting new trades.',
    fields: [
      { name: 'equity', description: 'Current account equity used for percent based sizing.' },
      { name: 'openPositions[]', description: 'Active positions contributing to open risk.' },
      { name: 'todayRealizedPnLPct', description: 'Realised PnL relative to start-of-day equity.' },
      { name: 'equityPeak', description: 'Peak equity for drawdown throttle calculations.' },
    ],
  },
  {
    name: 'OpenPosition',
    description: 'Records an existing position and its original risk.',
    fields: [
      { name: 'symbol / side', description: 'Instrument and direction currently held.' },
      { name: 'entryPrice', description: 'Average entry price of the position.' },
      { name: 'qty', description: 'Quantity or contracts held.' },
      { name: 'riskAtOpenPct', description: 'Initial risk as a percent of account equity.' },
    ],
  },
  {
    name: 'RiskPlanStep',
    description: 'Individual entry or add leg that composes the final position.',
    fields: [
      { name: 'stepIndex', description: 'Execution order of the step (1..n).' },
      { name: 'intent', description: 'ENTER or ADD to signal scaling behaviour.' },
      { name: 'qty', description: 'Quantity allocated to this ladder step.' },
      { name: 'entryTrigger', description: 'Trigger condition such as breakout or retest.' },
      { name: 'slPrice', description: 'Stop-loss price attached to the step.' },
      { name: 'tp1Price / tp2Price', description: 'Primary take-profit objectives.' },
    ],
  },
  {
    name: 'RiskPlan',
    description: 'Full execution plan after applying volatility and drawdown throttles.',
    fields: [
      { name: 'finalRiskPct', description: 'Resulting percent risk after throttles.' },
      { name: 'riskGrade', description: 'Weak, standard or strong signal classification.' },
      { name: 'throttleFactor', description: 'Combined multiplier from volatility and drawdown guards.' },
      { name: 'positionSizeTotal', description: 'Total contracts planned across all steps.' },
      { name: 'notional', description: 'Monetary exposure considering contract multiplier.' },
      { name: 'steps[]', description: 'Ordered list of RiskPlanStep entries.' },
      { name: 'trailingPlan', description: 'Optional trailing stop configuration.' },
    ],
  },
  {
    name: 'AlertPayload',
    description: 'Notification payload delivered to the automation layer.',
    fields: [
      { name: 'signal / symbol / entry_tf', description: 'Signal direction and metadata.' },
      { name: 'strength / bias', description: 'Momentum classification and directional bias.' },
      { name: 'votes / rsi_htf / rsi_ltf', description: 'Momentum scores embedded in the alert.' },
      { name: 'stochrsi / filters', description: 'Stochastic RSI state and MA filter context.' },
      { name: 'risk_plan', description: 'Full risk plan attached to the alert.' },
      {
        name: 'portfolio_check',
        description: 'Portfolio guard status and reason when trades are blocked.',
      },
      { name: 'timestamp / version', description: 'Alert timestamp and schema version.' },
    ],
  },
]

export function RiskManagementPanel({
  currentEquity,
  onCurrentEquityChange,
  isCollapsed,
  onToggleCollapse,
}: RiskManagementPanelProps) {
  const handleEquityChange = (event: ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.target.value
    const sanitised = rawValue.replace(/[^0-9.,]/g, '')
    onCurrentEquityChange(sanitised)
  }

  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-white/5 bg-slate-900/60 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-white">Risk management</h2>
          <p className="text-xs text-slate-400">
            Configure sizing inputs, throttles and execution guards for automation.
          </p>
        </div>
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
            <p className="text-[11px] text-slate-500">
              Persisted locally to reuse between sessions and position calculations.
            </p>
          </div>
          <div className="flex flex-col gap-5">
            {TYPE_DEFINITIONS.map((definition) => (
              <div key={definition.name} className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-slate-950/50 p-4">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-white">{definition.name}</span>
                  <p className="text-xs text-slate-400">{definition.description}</p>
                </div>
                <ul className="flex flex-col gap-1 text-[11px] text-slate-300">
                  {definition.fields.map((field) => (
                    <li key={field.name} className="flex items-start gap-2">
                      <span className="mt-0.5 text-slate-500">•</span>
                      <span>
                        <span className="font-semibold text-white/90">{field.name}</span>
                        <span className="text-slate-400"> — {field.description}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
