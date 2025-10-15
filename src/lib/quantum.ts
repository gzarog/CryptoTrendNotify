import type { TimeframeSignalSnapshot } from '../types/signals'

const QUANTUM_STATES = ['Down', 'Base', 'Reversal', 'Up'] as const

export type QuantumState = (typeof QUANTUM_STATES)[number]

export type QuantumVector = Record<QuantumState, number>

export type QuantumPhase = {
  key: string
  label: string
  shift: number
  reading: number | null
  direction: 'bullish' | 'bearish' | 'neutral'
  magnitude: number
}

export type QuantumComponent = {
  key: 'markov' | 'quantum' | 'bias'
  label: string
  weight: number
  value: number
}

export type QuantumProbability = {
  state: QuantumState
  probability: number
  amplitude: number
}

export type QuantumCompositeSignal = {
  state: QuantumState
  confidence: number
  probabilities: QuantumProbability[]
  components: QuantumComponent[]
  phases: QuantumPhase[]
  insights: string[]
  debug: {
    markovVector: QuantumVector
    quantumVector: QuantumVector
    biasVector: QuantumVector
    markovPriorAverage: number | null
    indicatorAverages: {
      rsi: number | null
      stoch: number | null
      macdHistogram: number | null
      macdHistogramStd: number | null
      adx: number | null
      emaDiff: number | null
      signalStrength: number | null
    }
    sampleCount: number
  }
}

const STATE_FROM_MARKOV: Record<'D' | 'R' | 'B' | 'U', QuantumState> = {
  D: 'Down',
  R: 'Reversal',
  B: 'Base',
  U: 'Up',
}

const DEFAULT_VECTOR: QuantumVector = {
  Down: 0.25,
  Base: 0.25,
  Reversal: 0.25,
  Up: 0.25,
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function normalizeVector(vector: QuantumVector): QuantumVector {
  const total = QUANTUM_STATES.reduce((sum, state) => sum + Math.max(0, vector[state]), 0)
  if (!Number.isFinite(total) || total <= 0) {
    return { ...DEFAULT_VECTOR }
  }

  const normalized: QuantumVector = { Down: 0, Base: 0, Reversal: 0, Up: 0 }
  for (const state of QUANTUM_STATES) {
    normalized[state] = Math.max(0, vector[state]) / total
  }
  return normalized
}

function sqrtClamped(value: number): number {
  return Math.sqrt(Math.max(0, value))
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null
  }
  const sum = values.reduce((total, value) => total + value, 0)
  return sum / values.length
}

function stdDev(values: number[]): number | null {
  if (values.length === 0) {
    return null
  }
  const mean = average(values)
  if (mean === null) {
    return null
  }
  const variance =
    values.reduce((total, value) => total + (value - mean) * (value - mean), 0) / values.length
  return Math.sqrt(variance)
}

function formatProbabilityVector(vector: QuantumVector): QuantumProbability[] {
  const normalized = normalizeVector(vector)
  return QUANTUM_STATES.map((state) => ({
    state,
    probability: normalized[state],
    amplitude: sqrtClamped(normalized[state]),
  }))
}

function buildMarkovVector(
  priorScores: number[],
  stateCounts: Record<QuantumState, number>,
): { vector: QuantumVector; priorAverage: number | null } {
  if (priorScores.length === 0 && Object.values(stateCounts).every((value) => value === 0)) {
    return { vector: { ...DEFAULT_VECTOR }, priorAverage: null }
  }

  const priorAverage = average(priorScores)

  const vector: QuantumVector = { Down: 0, Base: 0, Reversal: 0, Up: 0 }

  if (priorAverage !== null) {
    const bullishTilt = clamp(0.5 + priorAverage / 2, 0, 1)
    const bearishTilt = clamp(0.5 - priorAverage / 2, 0, 1)
    const neutralBand = clamp(1 - Math.abs(priorAverage), 0, 1)

    vector.Up += bullishTilt * 0.7
    vector.Down += bearishTilt * 0.7
    vector.Base += neutralBand * 0.45
    vector.Reversal += neutralBand * 0.35
  }

  const totalStates = QUANTUM_STATES.reduce((sum, state) => sum + stateCounts[state], 0)
  if (totalStates > 0) {
    for (const state of QUANTUM_STATES) {
      vector[state] += (stateCounts[state] / totalStates) * 0.6
    }
  }

  return { vector: normalizeVector(vector), priorAverage }
}

function buildIndicatorBiasVector(params: {
  rsi: number | null
  stoch: number | null
  macdHistogram: number | null
  macdHistogramStd: number | null
  adx: number | null
  emaDiff: number | null
  signalStrength: number | null
}): QuantumVector {
  const vector: QuantumVector = { Down: 0, Base: 0, Reversal: 0, Up: 0 }

  const { rsi, stoch, macdHistogram, macdHistogramStd, adx, emaDiff, signalStrength } = params

  if (rsi !== null) {
    const deviation = clamp((rsi - 50) / 50, -1, 1)
    const neutralCompression = 1 - Math.min(Math.abs(deviation) * 1.2, 1)
    if (deviation > 0) {
      vector.Up += deviation * 0.9
    } else {
      vector.Down += Math.abs(deviation) * 0.9
    }
    vector.Base += neutralCompression * 0.4
    vector.Reversal += (1 - neutralCompression) * 0.25
  }

  if (stoch !== null) {
    const deviation = clamp((stoch - 50) / 50, -1, 1)
    const neutralCompression = 1 - Math.min(Math.abs(deviation) * 1.1, 1)
    if (deviation > 0) {
      vector.Up += deviation * 0.6
    } else {
      vector.Down += Math.abs(deviation) * 0.6
    }
    vector.Base += neutralCompression * 0.3
    vector.Reversal += (1 - neutralCompression) * 0.2
  }

  if (macdHistogram !== null) {
    const scale = macdHistogramStd && macdHistogramStd > 1e-6 ? macdHistogramStd * 2 : 1
    const normalized = clamp(macdHistogram / scale, -1.5, 1.5)
    if (normalized > 0) {
      vector.Up += normalized * 0.7
    } else {
      vector.Down += Math.abs(normalized) * 0.7
    }
    if (Math.abs(normalized) < 0.2) {
      vector.Base += 0.3
    } else {
      vector.Reversal += Math.min(1, Math.abs(normalized)) * 0.35
    }
  }

  if (emaDiff !== null) {
    const normalized = clamp(emaDiff, -1.2, 1.2)
    if (normalized > 0) {
      vector.Up += normalized * 0.8
    } else {
      vector.Down += Math.abs(normalized) * 0.8
    }
    if (Math.abs(normalized) < 0.12) {
      vector.Base += 0.25
    } else {
      vector.Reversal += Math.min(1, Math.abs(normalized)) * 0.2
    }
  }

  if (adx !== null) {
    const trendNormalized = clamp(adx / 50, 0, 1)
    const rangeWeight = 1 - trendNormalized
    const dominant = vector.Up >= vector.Down ? 'Up' : 'Down'
    vector[dominant] += trendNormalized * 0.5
    vector.Base += rangeWeight * 0.35
    vector.Reversal += rangeWeight * 0.2
  }

  if (signalStrength !== null) {
    const normalized = clamp(signalStrength / 100, -1, 1)
    if (normalized > 0) {
      vector.Up += normalized * 0.4
    } else if (normalized < 0) {
      vector.Down += Math.abs(normalized) * 0.4
    } else {
      vector.Base += 0.1
    }
  }

  return normalizeVector(vector)
}

function computePhaseShift(value: number | null, center: number, scale: number): number {
  if (value === null) {
    return 0
  }
  return clamp((value - center) * scale, -Math.PI, Math.PI)
}

function resolvePhaseDirection(reading: number | null, bullishThreshold: number, bearishThreshold: number) {
  if (reading === null) {
    return 'neutral'
  }
  if (reading >= bullishThreshold) {
    return 'bullish'
  }
  if (reading <= bearishThreshold) {
    return 'bearish'
  }
  return 'neutral'
}

function buildPhaseDescriptors(params: {
  rsi: number | null
  stoch: number | null
  macdHistogram: number | null
  macdHistogramStd: number | null
  adx: number | null
}): QuantumPhase[] {
  const { rsi, stoch, macdHistogram, macdHistogramStd, adx } = params

  const macdScale = macdHistogramStd && macdHistogramStd > 1e-6 ? (Math.PI / 3) / macdHistogramStd : Math.PI / 3

  return [
    {
      key: 'rsi',
      label: 'RSI phase',
      shift: computePhaseShift(rsi, 50, Math.PI / 50),
      reading: rsi,
      direction: resolvePhaseDirection(rsi, 55, 45),
      magnitude: rsi === null ? 0 : Math.min(1, Math.abs(rsi - 50) / 25),
    },
    {
      key: 'stoch',
      label: 'Stoch RSI phase',
      shift: computePhaseShift(stoch, 50, Math.PI / 50),
      reading: stoch,
      direction: resolvePhaseDirection(stoch, 60, 40),
      magnitude: stoch === null ? 0 : Math.min(1, Math.abs(stoch - 50) / 25),
    },
    {
      key: 'macd',
      label: 'MACD histogram phase',
      shift: computePhaseShift(macdHistogram, 0, macdScale),
      reading: macdHistogram,
      direction: macdHistogram !== null && macdHistogram > 0 ? 'bullish' : macdHistogram !== null && macdHistogram < 0 ? 'bearish' : 'neutral',
      magnitude:
        macdHistogram === null || macdHistogramStd === null || macdHistogramStd < 1e-6
          ? 0
          : clamp(Math.abs(macdHistogram) / (macdHistogramStd * 2), 0, 1),
    },
    {
      key: 'adx',
      label: 'ADX phase',
      shift: computePhaseShift(adx, 25, Math.PI / 100),
      reading: adx,
      direction: adx !== null && adx >= 25 ? 'bullish' : 'neutral',
      magnitude: adx === null ? 0 : clamp(adx / 50, 0, 1),
    },
  ]
}

function buildQuantumVector(params: {
  bias: QuantumVector
  phases: QuantumPhase[]
}): QuantumVector {
  const { bias, phases } = params
  const normalizedBias = normalizeVector(bias)

  const phaseLookup = Object.fromEntries(phases.map((phase) => [phase.key, phase])) as Record<
    string,
    QuantumPhase | undefined
  >

  const rsiShift = phaseLookup.rsi?.shift ?? 0
  const stochShift = phaseLookup.stoch?.shift ?? 0
  const macdShift = phaseLookup.macd?.shift ?? 0
  const adxShift = phaseLookup.adx?.shift ?? 0

  const bullPhase = Math.sin(rsiShift) * 0.5 + Math.sin(stochShift) * 0.5
  const macdPhase = Math.sin(macdShift)
  const adxPhase = Math.sin(adxShift)

  const quantumVector: QuantumVector = {
    Up: Math.max(
      0,
      normalizedBias.Up * (1 + 0.35 * bullPhase + 0.25 * macdPhase + 0.2 * Math.max(0, adxPhase)),
    ),
    Down: Math.max(
      0,
      normalizedBias.Down * (1 - 0.35 * bullPhase - 0.25 * macdPhase + 0.2 * Math.max(0, -adxPhase)),
    ),
    Reversal: Math.max(
      0,
      normalizedBias.Reversal * (1 + 0.25 * Math.abs(macdPhase) + 0.15 * (1 - Math.abs(bullPhase))),
    ),
    Base: Math.max(
      0,
      normalizedBias.Base * (1 + 0.3 * (1 - Math.abs(adxPhase)) + 0.1 * (1 - Math.abs(bullPhase))),
    ),
  }

  return normalizeVector(quantumVector)
}

function buildInsights(params: {
  dominant: QuantumState
  fused: QuantumVector
  indicatorAverages: {
    rsi: number | null
    stoch: number | null
    macdHistogram: number | null
    adx: number | null
    emaDiff: number | null
  }
}): string[] {
  const { dominant, fused, indicatorAverages } = params
  const insights: string[] = []

  const dominantProb = fused[dominant]

  if (dominant === 'Up') {
    insights.push(
      dominantProb > 0.45
        ? 'Quantum fusion favours upside continuation with constructive interference.'
        : 'Upside regime forming, but interference still leaves room for hesitation.',
    )
  } else if (dominant === 'Down') {
    insights.push(
      dominantProb > 0.45
        ? 'Downside path reinforced as destructive interference dampens bullish attempts.'
        : 'Bearish bias emerging as quantum weights lean defensive.',
    )
  } else if (dominant === 'Reversal') {
    insights.push('Reversal probabilities elevated — watch for regime transition setups.')
  } else {
    insights.push('Base probabilities dominant — expect consolidation and mean reversion.')
  }

  if (indicatorAverages.rsi !== null) {
    const rsiValue = indicatorAverages.rsi
    if (rsiValue >= 60) {
      insights.push(`RSI elevated at ${rsiValue.toFixed(1)} — momentum skewed bullish.`)
    } else if (rsiValue <= 40) {
      insights.push(`RSI depressed at ${rsiValue.toFixed(1)} — bearish momentum dominates.`)
    } else {
      insights.push(`RSI balanced at ${rsiValue.toFixed(1)} — momentum neutral.`)
    }
  }

  if (indicatorAverages.macdHistogram !== null) {
    const macdValue = indicatorAverages.macdHistogram
    if (Math.abs(macdValue) < 1e-3) {
      insights.push('MACD histogram near equilibrium — interference can flip quickly.')
    } else if (macdValue > 0) {
      insights.push('MACD impulse positive — constructive with bullish trend states.')
    } else {
      insights.push('MACD impulse negative — reinforces bearish amplitude.')
    }
  }

  if (indicatorAverages.adx !== null) {
    const adxValue = indicatorAverages.adx
    if (adxValue >= 25) {
      insights.push(`ADX ${adxValue.toFixed(1)} — trend strength amplifies dominant state.`)
    } else {
      insights.push(`ADX ${adxValue.toFixed(1)} — low energy regime, expect range-bound moves.`)
    }
  }

  if (indicatorAverages.emaDiff !== null) {
    const emaValue = indicatorAverages.emaDiff
    if (Math.abs(emaValue) < 0.05) {
      insights.push('Moving averages compressed — bias susceptible to reversal noise.')
    } else if (emaValue > 0) {
      insights.push('Fast EMA above slow — structural bias supports bullish outcomes.')
    } else {
      insights.push('Fast EMA below slow — structural bias supports bearish outcomes.')
    }
  }

  return insights.slice(0, 4)
}

export function deriveQuantumCompositeSignal(
  snapshots: TimeframeSignalSnapshot[],
): QuantumCompositeSignal | null {
  if (snapshots.length === 0) {
    return null
  }

  const priorScores: number[] = []
  const macdHistogramValues: number[] = []
  const rsiValues: number[] = []
  const stochValues: number[] = []
  const adxValues: number[] = []
  const emaDiffValues: number[] = []
  const signalStrengthValues: number[] = []
  const stateCounts: Record<QuantumState, number> = { Down: 0, Base: 0, Reversal: 0, Up: 0 }

  for (const snapshot of snapshots) {
    const breakdown = snapshot.combined?.breakdown
    if (!breakdown) {
      continue
    }

    if (typeof breakdown.markov?.priorScore === 'number') {
      priorScores.push(breakdown.markov.priorScore)
    }
    if (breakdown.markov?.currentState && STATE_FROM_MARKOV[breakdown.markov.currentState]) {
      const mapped = STATE_FROM_MARKOV[breakdown.markov.currentState]
      stateCounts[mapped] += 1
    }

    if (typeof breakdown.macdHistogram === 'number' && Number.isFinite(breakdown.macdHistogram)) {
      macdHistogramValues.push(breakdown.macdHistogram)
    }
    if (typeof breakdown.rsiValue === 'number' && Number.isFinite(breakdown.rsiValue)) {
      rsiValues.push(breakdown.rsiValue)
    }
    if (typeof breakdown.stochKValue === 'number' && Number.isFinite(breakdown.stochKValue)) {
      stochValues.push(breakdown.stochKValue)
    }
    if (typeof breakdown.adxValue === 'number' && Number.isFinite(breakdown.adxValue)) {
      adxValues.push(breakdown.adxValue)
    }
    if (
      typeof breakdown.emaFast === 'number' &&
      Number.isFinite(breakdown.emaFast) &&
      typeof breakdown.emaSlow === 'number' &&
      Number.isFinite(breakdown.emaSlow) &&
      Math.abs(breakdown.emaSlow) > 1e-6
    ) {
      const diff = (breakdown.emaFast - breakdown.emaSlow) / Math.abs(breakdown.emaSlow)
      emaDiffValues.push(diff)
    }
    if (typeof breakdown.signalStrengthRaw === 'number' && Number.isFinite(breakdown.signalStrengthRaw)) {
      signalStrengthValues.push(breakdown.signalStrengthRaw)
    }
  }

  if (
    priorScores.length === 0 &&
    macdHistogramValues.length === 0 &&
    rsiValues.length === 0 &&
    stochValues.length === 0 &&
    adxValues.length === 0 &&
    emaDiffValues.length === 0
  ) {
    return null
  }

  const macdHistogramAvg = average(macdHistogramValues)
  const macdHistogramStdValue = stdDev(macdHistogramValues)
  const rsiAvg = average(rsiValues)
  const stochAvg = average(stochValues)
  const adxAvg = average(adxValues)
  const emaDiffAvg = average(emaDiffValues)
  const signalStrengthAvg = average(signalStrengthValues)

  const indicatorAverages = {
    rsi: rsiAvg,
    stoch: stochAvg,
    macdHistogram: macdHistogramAvg,
    macdHistogramStd: macdHistogramStdValue,
    adx: adxAvg,
    emaDiff: emaDiffAvg,
    signalStrength: signalStrengthAvg,
  }

  const { vector: markovVector, priorAverage } = buildMarkovVector(priorScores, stateCounts)

  const biasVector = buildIndicatorBiasVector({
    rsi: rsiAvg,
    stoch: stochAvg,
    macdHistogram: macdHistogramAvg,
    macdHistogramStd: macdHistogramStdValue,
    adx: adxAvg,
    emaDiff: emaDiffAvg,
    signalStrength: signalStrengthAvg,
  })

  const phases = buildPhaseDescriptors({
    rsi: rsiAvg,
    stoch: stochAvg,
    macdHistogram: macdHistogramAvg,
    macdHistogramStd: macdHistogramStdValue,
    adx: adxAvg,
  })

  const quantumVector = buildQuantumVector({ bias: biasVector, phases })

  const weights = { markov: 0.35, quantum: 0.4, bias: 0.25 }
  const fusedVector: QuantumVector = { Down: 0, Base: 0, Reversal: 0, Up: 0 }
  for (const state of QUANTUM_STATES) {
    fusedVector[state] =
      markovVector[state] * weights.markov +
      quantumVector[state] * weights.quantum +
      biasVector[state] * weights.bias
  }

  const normalizedFused = normalizeVector(fusedVector)
  let dominantState: QuantumState = 'Down'
  for (const state of QUANTUM_STATES) {
    if (normalizedFused[state] > normalizedFused[dominantState]) {
      dominantState = state
    }
  }

  const sortedProbs = [...QUANTUM_STATES]
    .map((state) => normalizedFused[state])
    .sort((a, b) => b - a)
  const primary = sortedProbs[0] ?? 0
  const secondary = sortedProbs[1] ?? 0
  const confidence = clamp(primary - secondary, 0, 1)

  const probabilities = formatProbabilityVector(normalizedFused)

  const components: QuantumComponent[] = [
    {
      key: 'markov',
      label: 'Markov prior',
      weight: weights.markov,
      value: markovVector[dominantState],
    },
    {
      key: 'quantum',
      label: 'Quantum walk',
      weight: weights.quantum,
      value: quantumVector[dominantState],
    },
    {
      key: 'bias',
      label: 'Indicator bias',
      weight: weights.bias,
      value: biasVector[dominantState],
    },
  ]

  const insights = buildInsights({
    dominant: dominantState,
    fused: normalizedFused,
    indicatorAverages: {
      rsi: rsiAvg,
      stoch: stochAvg,
      macdHistogram: macdHistogramAvg,
      adx: adxAvg,
      emaDiff: emaDiffAvg,
    },
  })

  return {
    state: dominantState,
    confidence,
    probabilities,
    components,
    phases,
    insights,
    debug: {
      markovVector,
      quantumVector,
      biasVector,
      markovPriorAverage: priorAverage,
      indicatorAverages,
      sampleCount: snapshots.length,
    },
  }
}
