import { Badge } from './Badge'
import { PercentageBar } from './PercentageBar'
import type { QuantumCompositeSignal, QuantumProbability, QuantumState } from '../../lib/quantum'

const STATE_LABELS: Record<QuantumState, string> = {
  Down: 'Downtrend',
  Base: 'Base-building',
  Reversal: 'Reversal window',
  Up: 'Uptrend',
}

const STATE_BADGE_CLASS: Record<QuantumState, string> = {
  Down: 'border-rose-400/40 bg-rose-500/10 text-rose-200',
  Base: 'border-slate-400/40 bg-slate-500/10 text-slate-200',
  Reversal: 'border-amber-400/40 bg-amber-500/10 text-amber-200',
  Up: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
}

const STATE_GRADIENT: Record<QuantumState, string> = {
  Down: 'from-rose-400 to-rose-500',
  Base: 'from-slate-500 to-slate-400',
  Reversal: 'from-amber-400 to-amber-500',
  Up: 'from-emerald-400 to-emerald-500',
}

const COMPONENT_GRADIENT: Record<'markov' | 'quantum' | 'bias', string> = {
  markov: 'from-sky-500 to-sky-400',
  quantum: 'from-indigo-400 to-violet-500',
  bias: 'from-emerald-400 to-emerald-500',
}

const PHASE_DIRECTION_CLASS: Record<'bullish' | 'bearish' | 'neutral', string> = {
  bullish: 'text-emerald-300',
  bearish: 'text-rose-300',
  neutral: 'text-slate-300',
}

type QuantumPredictionPanelProps = {
  data: QuantumCompositeSignal | null
  isLoading: boolean
}

function formatProbability(probability: number): string {
  return `${Math.round(probability * 1000) / 10}%`
}

function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 1000) / 10}%`
}

function formatPhaseShiftRadians(shift: number): string {
  const degrees = Math.round((shift * 180) / Math.PI)
  if (!Number.isFinite(degrees)) {
    return '0°'
  }
  return degrees > 0 ? `+${degrees}°` : `${degrees}°`
}

function renderProbability(probability: QuantumProbability) {
  const label = STATE_LABELS[probability.state]
  const gradient = STATE_GRADIENT[probability.state]
  const value = Math.round(probability.probability * 1000) / 10
  const amplitudeLabel = (Math.round(probability.amplitude * 100) / 100).toFixed(2)
  return (
    <div key={`prob-${probability.state}`} className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-slate-900/30 p-3">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400">
        <span>{label}</span>
        <span className="font-mono text-xs text-slate-200">Amp {amplitudeLabel}</span>
      </div>
      <PercentageBar gradient={gradient} value={value} label={formatProbability(probability.probability)} />
    </div>
  )
}

export function QuantumPredictionPanel({ data, isLoading }: QuantumPredictionPanelProps) {
  const dominantState = data?.state ?? null
  const badgeClass = dominantState ? STATE_BADGE_CLASS[dominantState] : 'border-slate-400/40 bg-slate-500/10 text-slate-200'
  const stateLabel = dominantState ? STATE_LABELS[dominantState] : 'Pending synthesis'
  const confidenceLabel = data ? formatConfidence(data.confidence) : null
  const sampleCount = data?.debug.sampleCount ?? 0
  const sampleLabel = sampleCount === 1 ? 'timeframe snapshot' : 'timeframe snapshots'

  return (
    <article className="rounded-3xl border border-white/10 bg-slate-950/70 shadow-lg">
      <header className="flex items-start justify-between gap-3 rounded-t-3xl border-b border-white/5 bg-slate-900/60 px-5 py-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Quantum prediction engine</span>
          <span className="text-sm text-slate-300">
            Hybrid fusion of Markov priors, indicator bias and interference-aware probabilities
          </span>
        </div>
        <Badge className={badgeClass}>{stateLabel}</Badge>
      </header>

      <div className="flex flex-col gap-6 px-5 py-5">
        {isLoading && !data && <p className="text-sm text-slate-400">Synthesizing quantum state…</p>}

        {!isLoading && !data && (
          <p className="text-sm text-slate-400">
            More indicator coverage is required before the quantum module can emit a directional state.
          </p>
        )}

        {data && (
          <>
            <section className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Dominant state</span>
                  <span className="text-lg font-semibold text-white">{stateLabel}</span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Confidence</span>
                  <span className="text-lg font-semibold text-white">{confidenceLabel}</span>
                </div>
              </div>
              <div className="text-xs text-slate-300">
                Derived from {sampleCount} {sampleLabel} with hybrid weighting across quantum, Markov and
                indicator inputs.
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">State probabilities</span>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {data.probabilities.map((probability) => renderProbability(probability))}
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Fusion components</span>
              <div className="grid gap-3 md:grid-cols-3">
                {data.components.map((component) => {
                  const gradient = COMPONENT_GRADIENT[component.key]
                  const weightLabel = `${Math.round(component.weight * 100)}%`
                  const valueLabel = formatProbability(component.value)

                  return (
                    <div
                      key={`component-${component.key}`}
                      className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-slate-900/40 p-4"
                    >
                      <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400">
                        <span>{component.label}</span>
                        <span className="font-mono text-[11px] text-slate-300">Weight {weightLabel}</span>
                      </div>
                      <PercentageBar gradient={gradient} value={Math.round(component.value * 1000) / 10} label={valueLabel} />
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Phase diagnostics</span>
              <div className="grid gap-3 md:grid-cols-2">
                {data.phases.map((phase) => {
                  const width = Math.round(phase.magnitude * 100)
                  const directionClass = PHASE_DIRECTION_CLASS[phase.direction]
                  return (
                    <div
                      key={`phase-${phase.key}`}
                      className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-slate-900/40 p-4"
                    >
                      <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400">
                        <span>{phase.label}</span>
                        <span className={`font-mono text-xs ${directionClass}`}>{formatPhaseShiftRadians(phase.shift)}</span>
                      </div>
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="font-semibold text-white">{phase.reading !== null ? phase.reading.toFixed(1) : '—'}</span>
                        <span className={`text-xs uppercase tracking-wide ${directionClass}`}>{phase.direction}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-violet-500 to-indigo-500" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {data.insights.length > 0 && (
              <section className="flex flex-col gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Quantum commentary</span>
                <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-slate-200">
                  {data.insights.map((insight, index) => (
                    <li key={`insight-${index}`} className="marker:text-indigo-300">
                      {insight}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </article>
  )
}
