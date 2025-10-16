import { Badge } from './Badge'
import { PercentageBar } from './PercentageBar'
import type {
  QuantumCompositeSignal,
  QuantumProbability,
  TrendState,
} from '../../lib/quantum'

const STATE_LABELS: Record<TrendState, string> = {
  Down: 'Downtrend',
  Base: 'Base-building',
  Reversal: 'Reversal window',
  Up: 'Uptrend',
}

const STATE_BADGE_CLASS: Record<TrendState, string> = {
  Down: 'border-rose-400/40 bg-rose-500/10 text-rose-200',
  Base: 'border-slate-400/40 bg-slate-500/10 text-slate-200',
  Reversal: 'border-amber-400/40 bg-amber-500/10 text-amber-200',
  Up: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
}

const STATE_GRADIENT: Record<TrendState, string> = {
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

type DirectionalBias = 'LONG' | 'SHORT' | 'NEUTRAL'

const DIRECTIONAL_BADGE_CLASS: Record<DirectionalBias, string> = {
  LONG: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
  SHORT: 'border-rose-400/40 bg-rose-500/10 text-rose-200',
  NEUTRAL: 'border-slate-400/40 bg-slate-500/10 text-slate-200',
}

const DIRECTIONAL_TEXT_CLASS: Record<DirectionalBias, string> = {
  LONG: 'text-emerald-300',
  SHORT: 'text-rose-300',
  NEUTRAL: 'text-slate-200',
}

type DirectionalCall = {
  bias: DirectionalBias
  label: string
  summary: string
  anchorProbability: number
  counterProbability: number
  spread: number
}

function describeConfidenceLevel(confidence: number): string {
  if (!Number.isFinite(confidence)) {
    return 'low conviction'
  }

  if (confidence >= 0.85) {
    return 'strong conviction'
  }

  if (confidence >= 0.7) {
    return 'constructive conviction'
  }

  if (confidence >= 0.55) {
    return 'balanced conviction'
  }

  return 'cautious conviction'
}

function describeSampleDensity(sampleCount: number): string {
  if (!Number.isFinite(sampleCount) || sampleCount <= 0) {
    return 'sparse'
  }

  if (sampleCount >= 12) {
    return 'rich'
  }

  if (sampleCount >= 6) {
    return 'healthy'
  }

  if (sampleCount >= 3) {
    return 'developing'
  }

  return 'limited'
}

function generateQuantumInterpretation(signal: QuantumCompositeSignal): string {
  const dominantStateLabel = STATE_LABELS[signal.state].toLowerCase()
  const confidenceLabel = formatConfidence(signal.confidence)
  const confidenceDescriptor = describeConfidenceLevel(signal.confidence)
  const directionalCall = evaluateDirectionalCall(signal)

  const sortedProbabilities = [...signal.probabilities].sort((a, b) => b.probability - a.probability)
  const topProbability = sortedProbabilities[0] ?? null
  const secondaryProbability = sortedProbabilities[1] ?? null
  const topProbabilityLabel = topProbability ? formatProbability(topProbability.probability) : null
  const topProbabilityStateLabel = topProbability
    ? STATE_LABELS[topProbability.state].toLowerCase()
    : dominantStateLabel
  const probabilitySpread =
    topProbability && secondaryProbability
      ? Math.max(0, Math.round((topProbability.probability - secondaryProbability.probability) * 1000) / 10)
      : null
  const probabilityBreakdown = sortedProbabilities
    .slice(0, 3)
    .map((probability) => `${STATE_LABELS[probability.state].toLowerCase()} ${formatProbability(probability.probability)}`)
    .join(', ')

  const sortedComponents = [...signal.components].sort((a, b) => b.weight - a.weight)
  const primaryComponents = sortedComponents.slice(0, 2)
  const componentHighlights = primaryComponents
    .filter((component) => component.weight >= 0.15)
    .map((component) => {
      const weightLabel = `${Math.round(component.weight * 100)}%`
      const valueLabel = formatProbability(component.value)
      return `${component.label.toLowerCase()} (${weightLabel} influence, projecting ${valueLabel})`
    })
  const componentSentence =
    componentHighlights.length > 0
      ? `Fusion components: ${componentHighlights.join(' • ')}.`
      : 'Fusion components: influence is evenly shared with no standout driver yet.'

  const sampleCount = signal.debug.sampleCount
  const sampleDescriptor = describeSampleDensity(sampleCount)

  const notablePhase = signal.phases.reduce<QuantumCompositeSignal['phases'][number] | null>((current, candidate) => {
    if (!current) {
      return candidate
    }
    if (candidate.magnitude > current.magnitude) {
      return candidate
    }
    return current
  }, signal.phases[0] ?? null)

  const phaseSentence = notablePhase
    ? notablePhase.magnitude >= 0.35
      ? `Phase diagnostic: ${notablePhase.label} is humming the loudest with a ${notablePhase.direction} lean and a ${formatPhaseShiftRadians(notablePhase.shift)} shift.`
      : `Phase diagnostic: ${notablePhase.label} is drifting ${notablePhase.direction} (${formatPhaseShiftRadians(notablePhase.shift)} shift).`
    : 'Phase diagnostic: telemetry is quiet, so no dominant interference lane is defined yet.'

  const paragraphs: string[] = []
  paragraphs.push(
    `Here’s the quantum readout in plain language.`,
  )

  paragraphs.push(
    `Dominant state: the field is leaning toward a ${dominantStateLabel} with ${confidenceDescriptor} (${confidenceLabel} confidence, ${
      topProbabilityLabel ?? 'n/a'
    } concentration around ${topProbabilityStateLabel}${probabilitySpread !== null ? `, ${probabilitySpread}% ahead of the next scenario` : ''}).`,
  )

  paragraphs.push(
    probabilityBreakdown
      ? `State probabilities: ${probabilityBreakdown}.`
      : 'State probabilities: distribution is too flat to call out leaders yet.',
  )

  if (directionalCall.bias === 'NEUTRAL') {
    paragraphs.push(`Trade posture: staying patient — ${directionalCall.summary}`)
  } else {
    paragraphs.push(
      `Trade posture: leaning ${directionalCall.bias.toLowerCase()} — ${directionalCall.summary}`,
    )
  }

  paragraphs.push(componentSentence)

  paragraphs.push(
    `Signal depth: the composite pulled from a ${sampleDescriptor} archive of ${sampleCount} timeframe snapshot${sampleCount === 1 ? '' : 's'}, which gives this take the necessary texture.`,
  )

  paragraphs.push(phaseSentence)

  return paragraphs.join(' ')
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

function evaluateDirectionalCall(signal: QuantumCompositeSignal): DirectionalCall {
  const upProbability =
    signal.probabilities.find((probability) => probability.state === 'Up')?.probability ?? 0
  const downProbability =
    signal.probabilities.find((probability) => probability.state === 'Down')?.probability ?? 0
  const anchorIsLong = upProbability >= downProbability
  const anchorProbability = anchorIsLong ? upProbability : downProbability
  const counterProbability = anchorIsLong ? downProbability : upProbability
  const spread = Math.round(Math.abs(anchorProbability - counterProbability) * 1000) / 10

  let bias: DirectionalBias = 'NEUTRAL'
  if (spread >= 2) {
    bias = anchorIsLong ? 'LONG' : 'SHORT'
  }

  const anchorLabel = formatProbability(anchorProbability)
  const counterLabel = formatProbability(counterProbability)

  const summary =
    bias === 'NEUTRAL'
      ? `longs and shorts are effectively balanced (${formatProbability(upProbability)} vs ${formatProbability(
          downProbability,
        )}).`
      : anchorIsLong
        ? `longs carry a ${spread}% edge (${anchorLabel} vs ${counterLabel}).`
        : `shorts carry a ${spread}% edge (${anchorLabel} vs ${counterLabel}).`

  const label =
    bias === 'NEUTRAL'
      ? 'Neutral balance'
      : anchorIsLong
        ? 'Long bias'
        : 'Short bias'

  return {
    bias,
    label,
    summary,
    anchorProbability,
    counterProbability,
    spread,
  }
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
  const quantumInterpretation = data ? generateQuantumInterpretation(data) : null
  const directionalCall = data ? evaluateDirectionalCall(data) : null
  const directionalBadgeClass = directionalCall
    ? DIRECTIONAL_BADGE_CLASS[directionalCall.bias]
    : DIRECTIONAL_BADGE_CLASS.NEUTRAL
  const directionalTextClass = directionalCall
    ? DIRECTIONAL_TEXT_CLASS[directionalCall.bias]
    : DIRECTIONAL_TEXT_CLASS.NEUTRAL

  return (
    <article className="rounded-3xl border border-white/10 bg-slate-950/70 shadow-lg">
      <header className="flex items-start justify-between gap-3 rounded-t-3xl border-b border-white/5 bg-slate-900/60 px-5 py-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Quantum prediction engine</span>
          <span className="text-sm text-slate-300">
            Hybrid fusion of Markov priors, indicator bias and interference-aware probabilities
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={badgeClass}>{stateLabel}</Badge>
          {directionalCall && <Badge className={directionalBadgeClass}>{directionalCall.label}</Badge>}
        </div>
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
                {directionalCall && (
                  <div className="flex flex-col text-right">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Trade posture
                    </span>
                    <span className={`text-lg font-semibold ${directionalTextClass}`}>
                      {directionalCall.label}
                    </span>
                    <span className="text-[11px] text-slate-400">{directionalCall.summary}</span>
                  </div>
                )}
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

            {quantumInterpretation && (
              <section className="flex flex-col gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Quantum interpretation
                </span>
                <p className="rounded-2xl border border-white/10 bg-slate-900/40 p-4 text-sm text-slate-200">
                  {quantumInterpretation}
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </article>
  )
}
