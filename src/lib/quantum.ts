import type { TimeframeSignalSnapshot } from '../types/signals'

const TREND_STATES = ['Down', 'Base', 'Reversal', 'Up'] as const

export type TrendState = (typeof TREND_STATES)[number]

export type QuantumVector = Record<TrendState, number>

export type QuantumProbability = {
  state: TrendState
  probability: number
  amplitude: number
}

export type QuantumComponent = {
  key: 'markov' | 'quantum' | 'bias'
  label: string
  weight: number
  value: number
}

export type QuantumPhase = {
  key: string
  label: string
  shift: number
  reading: number | null
  direction: 'bullish' | 'bearish' | 'neutral'
  magnitude: number
}

type Complex = {
  re: number
  im: number
}

type ComplexMatrix = Complex[][]

type QuantumAmplitudes = Record<TrendState, Complex>

type QuantumProbabilitiesRecord = QuantumVector

type MarkovProb = {
  pDown: number
  pBase: number
  pReversal: number
  pUp: number
}

type Indicators = {
  ema10: number | null
  ema50: number | null
  ma200: number | null
  rsi: number | null
  stoch_rsi_k: number | null
  stoch_rsi_d: number | null
  macd: number | null
  macd_signal: number | null
  macd_hist: number | null
  macd_hist_std: number | null
  adx: number | null
  atr: number | null
  vol_entropy: number | null
  realized_vol: number | null
  ema_diff: number | null
  signal_strength: number | null
}

type PhaseMapEntry = {
  center: number
  scale: number
}

type PhaseMap = {
  rsi: PhaseMapEntry
  macd_hist: PhaseMapEntry
  adx: PhaseMapEntry
  stoch_rsi_k: PhaseMapEntry
}

type InterferenceConfig = {
  matrix4x4: number[][]
  regime_rules: RegimeRule[]
}

type RegimeRule = {
  when: (indicators: Indicators) => boolean
  adjust_interference: (matrix: number[][]) => number[][]
  adjust_phase: (map: PhaseMap) => PhaseMap
}

type EntanglementConfig = {
  enabled: boolean
  strength: number
  peers: string[]
  timeframes: string[]
  coupling_rule: string
}

type AnnealConfig = {
  enabled: boolean
  iterations: number
  temp_start: number
  temp_end: number
  search_space: Record<string, unknown>
  objective: string
}

type ConfigQuantum = {
  steps: number
  alpha_markov_prior: number
  beta_quantum_probs: number
  gamma_indicator_bias: number
  delta_news_sentiment: number
  epsilon_vol_entropy: number
  normalize_weights: boolean
  phase_map: PhaseMap
  interference: InterferenceConfig
  entanglement: EntanglementConfig
  q_anneal: AnnealConfig
}

export type QuantumCompositeSignal = {
  state: TrendState
  confidence: number
  probabilities: QuantumProbability[]
  components: QuantumComponent[]
  phases: QuantumPhase[]
  insights: string[]
  debug: {
    markovVector: QuantumVector
    quantumVector: QuantumVector
    biasVector: QuantumVector
    fusedVector: QuantumVector
    weights: Record<string, number>
    phaseShifts: Record<TrendState, number>
    matrix: ComplexMatrix
    amplitudes: QuantumAmplitudes
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

const DEFAULT_VECTOR: QuantumVector = {
  Down: 0.25,
  Base: 0.25,
  Reversal: 0.25,
  Up: 0.25,
}

const SMALL_EPSILON = 1e-6

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function complex(re: number, im: number): Complex {
  return { re, im }
}

function complexFromPolar(magnitude: number, angle: number): Complex {
  return {
    re: magnitude * Math.cos(angle),
    im: magnitude * Math.sin(angle),
  }
}

function complexAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im }
}

function complexMul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  }
}

function complexScale(a: Complex, scalar: number): Complex {
  return { re: a.re * scalar, im: a.im * scalar }
}

function complexMagnitude(a: Complex): number {
  return Math.sqrt(a.re * a.re + a.im * a.im)
}

function rotateComplex(a: Complex, angle: number): Complex {
  const rotation = complexFromPolar(1, angle)
  return complexMul(a, rotation)
}

function initializeVector(): QuantumVector {
  return { Down: 0, Base: 0, Reversal: 0, Up: 0 }
}

function normalizeVector(vector: QuantumVector): QuantumVector {
  const total = TREND_STATES.reduce((sum, state) => sum + Math.max(0, vector[state]), 0)
  if (!Number.isFinite(total) || total <= 0) {
    return { ...DEFAULT_VECTOR }
  }
  const normalized = initializeVector()
  for (const state of TREND_STATES) {
    normalized[state] = Math.max(0, vector[state]) / total
  }
  return normalized
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
  const variance = values.reduce((total, value) => total + (value - mean) * (value - mean), 0) / values.length
  return Math.sqrt(variance)
}

const QuantumStateBuilder = {
  initialize_superposition(states: TrendState[]): QuantumAmplitudes {
    const n = states.length
    const amplitude = n > 0 ? 1 / Math.sqrt(n) : 0
    const vector: Partial<QuantumAmplitudes> = {}
    for (const state of states) {
      vector[state] = complex(amplitude, 0)
    }
    return vector as QuantumAmplitudes
  },
}

function macdCrossSignal(indicators: Indicators): number {
  if (
    indicators.macd_hist !== null &&
    Math.abs(indicators.macd_hist) < 0.5 * (indicators.macd_hist_std ?? 1) &&
    indicators.macd !== null &&
    indicators.macd_signal !== null
  ) {
    const diff = indicators.macd - indicators.macd_signal
    if (Math.abs(diff) < SMALL_EPSILON) {
      return 0
    }
    return diff > 0 ? 1 : -1
  }
  return 0
}

const PhaseComputer = {
  compute_phases(indicators: Indicators, phaseMap: PhaseMap): Record<TrendState, number> {
    const rsiPhase = indicators.rsi !== null ? (indicators.rsi - phaseMap.rsi.center) * phaseMap.rsi.scale : 0
    const macdPhase =
      indicators.macd_hist !== null
        ? (indicators.macd_hist - phaseMap.macd_hist.center) * phaseMap.macd_hist.scale
        : 0
    const adxPhase = indicators.adx !== null ? (indicators.adx - phaseMap.adx.center) * phaseMap.adx.scale : 0
    const stochPhase =
      indicators.stoch_rsi_k !== null
        ? (indicators.stoch_rsi_k - phaseMap.stoch_rsi_k.center) * phaseMap.stoch_rsi_k.scale
        : 0

    const phases: Record<TrendState, number> = {
      Up: clamp(rsiPhase + macdPhase + Math.max(0, adxPhase), -Math.PI, Math.PI),
      Down: clamp(-rsiPhase - macdPhase + Math.max(0, adxPhase / 2), -Math.PI, Math.PI),
      Reversal: clamp(Math.sign(macdCrossSignal(indicators)) * (Math.abs(macdPhase) + Math.abs(stochPhase)), -Math.PI, Math.PI),
      Base: clamp(-Math.abs(adxPhase) / 2, -Math.PI / 2, Math.PI / 2),
    }

    return phases
  },
}

function softmaxAbs(row: number[]): number[] {
  if (row.length === 0) {
    return []
  }
  const adjusted = row.map((value) => Math.exp(Math.abs(value)))
  const sum = adjusted.reduce((total, value) => total + value, 0)
  if (!Number.isFinite(sum) || sum <= 0) {
    const fallback = 1 / row.length
    return row.map(() => fallback)
  }
  return adjusted.map((value) => value / sum)
}

function l2RowNormalize(matrix: ComplexMatrix): ComplexMatrix {
  return matrix.map((row, rowIndex) => {
    const norm = Math.sqrt(row.reduce((total, value) => total + complexMagnitude(value) ** 2, 0))
    if (!Number.isFinite(norm) || norm <= 0) {
      const identityRow = matrix[rowIndex]?.map((_, columnIndex) => (rowIndex === columnIndex ? complex(1, 0) : complex(0, 0)))
      return identityRow ?? row
    }
    return row.map((value) => complexScale(value, 1 / norm))
  })
}

function matmulComplexMatrices(a: ComplexMatrix, b: ComplexMatrix): ComplexMatrix {
  const size = a.length
  const result: ComplexMatrix = Array.from({ length: size }, () => Array.from({ length: size }, () => complex(0, 0)))
  for (let i = 0; i < size; i += 1) {
    for (let j = 0; j < size; j += 1) {
      let accumulator = complex(0, 0)
      for (let k = 0; k < size; k += 1) {
        accumulator = complexAdd(accumulator, complexMul(a[i][k], b[k][j]))
      }
      result[i][j] = accumulator
    }
  }
  return result
}

function matmulMatrixVector(matrix: ComplexMatrix, vector: Complex[]): Complex[] {
  const size = matrix.length
  const result: Complex[] = Array.from({ length: size }, () => complex(0, 0))
  for (let i = 0; i < size; i += 1) {
    let accumulator = complex(0, 0)
    for (let j = 0; j < size; j += 1) {
      accumulator = complexAdd(accumulator, complexMul(matrix[i][j], vector[j]))
    }
    result[i] = accumulator
  }
  return result
}

const QuantumWalk = {
  build_unitary_like(interf: number[][], phases: Record<TrendState, number>): ComplexMatrix {
    const size = TREND_STATES.length
    const phaseDiagonal: ComplexMatrix = Array.from({ length: size }, (_, rowIndex) =>
      Array.from({ length: size }, (_, columnIndex) =>
        rowIndex === columnIndex ? complexFromPolar(1, phases[TREND_STATES[rowIndex]]) : complex(0, 0),
      ),
    )

    const mixing: ComplexMatrix = interf.map((row) => {
      const weights = softmaxAbs(row)
      return weights.map((weight, columnIndex) => {
        const theta = row[columnIndex] * (Math.PI / 8)
        return complexFromPolar(weight, theta)
      })
    })

    const normalizedMixing = l2RowNormalize(mixing)
    return matmulComplexMatrices(normalizedMixing, phaseDiagonal)
  },
  evolve(amplitudes: QuantumAmplitudes, matrix: ComplexMatrix): QuantumAmplitudes {
    const orderedStates = TREND_STATES.map((state) => amplitudes[state])
    const evolvedVector = matmulMatrixVector(matrix, orderedStates)
    const next: Partial<QuantumAmplitudes> = {}
    TREND_STATES.forEach((state, index) => {
      next[state] = evolvedVector[index]
    })
    return next as QuantumAmplitudes
  },
}

function aggregateCouplings(couplings: Record<string, number>, rule: string): number {
  const entries = Object.values(couplings)
  if (entries.length === 0) {
    return 0
  }
  const averageCoupling = entries.reduce((total, value) => total + value, 0) / entries.length
  if (rule === 'beta') {
    return clamp(averageCoupling, -1, 1)
  }
  if (rule === 'corr') {
    return clamp(averageCoupling, -1, 1)
  }
  return clamp(averageCoupling, -1, 1)
}

function normalizeAmplitudeVector(vector: QuantumAmplitudes): QuantumAmplitudes {
  const norm = Math.sqrt(
    TREND_STATES.reduce((total, state) => total + complexMagnitude(vector[state]) ** 2, 0),
  )
  if (!Number.isFinite(norm) || norm <= 0) {
    return QuantumStateBuilder.initialize_superposition(TREND_STATES as unknown as TrendState[])
  }
  const normalized: Partial<QuantumAmplitudes> = {}
  for (const state of TREND_STATES) {
    normalized[state] = complexScale(vector[state], 1 / norm)
  }
  return normalized as QuantumAmplitudes
}

const Entangler = {
  apply(
    amplitudes: QuantumAmplitudes,
    couplings: Record<string, number>,
    strength: number,
    rule: string,
  ): QuantumAmplitudes {
    if (strength <= 0) {
      return amplitudes
    }
    const peerEffect = aggregateCouplings(couplings, rule)
    const delta = strength * (Math.PI / 6) * peerEffect
    const adjusted: Partial<QuantumAmplitudes> = { ...amplitudes }
    adjusted.Up = rotateComplex(amplitudes.Up, delta)
    adjusted.Down = rotateComplex(amplitudes.Down, -delta)
    adjusted.Base = rotateComplex(amplitudes.Base, delta / 2)
    adjusted.Reversal = rotateComplex(amplitudes.Reversal, -delta / 2)
    return normalizeAmplitudeVector(adjusted as QuantumAmplitudes)
  },
}

const Measurer = {
  measure(amplitudes: QuantumAmplitudes): {
    amplitudes: QuantumAmplitudes
    probabilities: QuantumProbabilitiesRecord
    phase_shifts: Record<TrendState, number>
  } {
    const probabilities = initializeVector()
    for (const state of TREND_STATES) {
      probabilities[state] = complexMagnitude(amplitudes[state]) ** 2
    }
    return {
      amplitudes,
      probabilities: normalizeVector(probabilities),
      phase_shifts: {
        Down: 0,
        Base: 0,
        Reversal: 0,
        Up: 0,
      },
    }
  },
}

const Weights = {
  normalize_if(doNorm: boolean, weights: Record<string, number>): Record<string, number> {
    if (!doNorm) {
      return weights
    }
    const entries = Object.entries(weights).map(([key, value]) => [key, Math.max(0, value)] as const)
    const sum = entries.reduce((total, [, value]) => total + value, 0)
    if (sum <= 0) {
      return weights
    }
    const normalized: Record<string, number> = {}
    for (const [key, value] of entries) {
      normalized[key] = value / sum
    }
    return normalized
  },
}

const NewsMapper = {
  map(sentiment: number): QuantumVector {
    const positive = Math.max(0, sentiment)
    const negative = Math.max(0, -sentiment)
    const vector = {
      Down: negative,
      Base: positive * 0.3,
      Reversal: negative * 0.7,
      Up: positive,
    }
    return normalizeVector(vector)
  },
}

const EntropyMapper = {
  map(volEntropy: number, adx: number | null): QuantumVector {
    const baseBoost = adx !== null ? Math.max(0, 1 - Math.min(1, adx / 30)) * volEntropy : volEntropy
    const vector = {
      Down: 0.2 * volEntropy,
      Base: 0.4 * baseBoost,
      Reversal: 0.4 * volEntropy,
      Up: 0.2 * volEntropy,
    }
    return normalizeVector(vector)
  },
}

const Confidence = {
  compute(probabilities: QuantumVector): number {
    const ordered = TREND_STATES.map((state) => probabilities[state]).sort((a, b) => b - a)
    const top = ordered[0] ?? 0
    const second = ordered[1] ?? 0
    const margin = top - second
    const entropy = -TREND_STATES.reduce((sum, state) => {
      const value = probabilities[state]
      if (value <= 0) {
        return sum
      }
      return sum + value * Math.log(value)
    }, 0)
    const maxEntropy = Math.log(TREND_STATES.length)
    return clamp(0.6 * margin + 0.4 * (1 - entropy / maxEntropy), 0, 1)
  },
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value))
}

function boolToInt(value: boolean): number {
  return value ? 1 : 0
}

function crossProbStoch(indicators: Indicators): number {
  if (indicators.stoch_rsi_k === null) {
    return 0
  }
  const proximity = 1 - Math.min(1, Math.abs(indicators.stoch_rsi_k - 50) / 50)
  const macdAssist =
    indicators.macd_hist !== null && indicators.macd_hist_std !== null && indicators.macd_hist_std > SMALL_EPSILON
      ? clamp(1 - Math.abs(indicators.macd_hist) / (indicators.macd_hist_std * 2), 0, 1)
      : 0.5
  return clamp(0.7 * proximity + 0.3 * macdAssist, 0, 1)
}

function getIndicatorBias(indicators: Indicators): QuantumVector {
  const bias = initializeVector()

  const macdStd = indicators.macd_hist_std ?? 1
  const macdHistogram = indicators.macd_hist ?? 0
  const macdZ = macdStd > SMALL_EPSILON ? macdHistogram / macdStd : macdHistogram
  const emaFast = indicators.ema10
  const emaSlow = indicators.ema50
  const maLong = indicators.ma200

  const emaDiff = indicators.ema_diff ?? null
  const trendStrength = indicators.signal_strength ?? null

  const bullBias = sigmoid(
    macdZ + ((indicators.rsi ?? 50) - 50) / 10 + boolToInt(emaFast !== null && emaSlow !== null && maLong !== null && emaFast > emaSlow && emaSlow > maLong),
  )

  const bearBias = sigmoid(
    -macdZ + ((50 - (indicators.rsi ?? 50)) / 10) +
      boolToInt(emaFast !== null && emaSlow !== null && maLong !== null && emaFast < emaSlow && emaSlow < maLong),
  )

  const rangeBias = sigmoid(Math.max(0, 25 - (indicators.adx ?? 25)) / 10)

  const reversalBias = sigmoid(
    (Math.abs(macdHistogram) < SMALL_EPSILON ? 1 : 0) + crossProbStoch(indicators),
  )

  bias.Down = bearBias
  bias.Base = rangeBias
  bias.Reversal = reversalBias
  bias.Up = bullBias

  if (emaDiff !== null) {
    const normalized = clamp(emaDiff, -1.5, 1.5)
    bias.Up += Math.max(0, normalized)
    bias.Down += Math.max(0, -normalized)
  }

  if (trendStrength !== null) {
    const normalizedStrength = clamp(trendStrength / 100, -1, 1)
    if (normalizedStrength > 0) {
      bias.Up += normalizedStrength * 0.5
    } else if (normalizedStrength < 0) {
      bias.Down += Math.abs(normalizedStrength) * 0.5
    } else {
      bias.Base += 0.2
    }
  }

  return normalizeVector(bias)
}

function computeMarkovPrior(
  priorScores: number[],
  stateCounts: Record<TrendState, number>,
): { prior: MarkovProb; average: number | null } {
  const base = initializeVector()
  const averagePrior = average(priorScores)
  if (averagePrior !== null) {
    const bullishTilt = clamp(0.5 + averagePrior / 2, 0, 1)
    const bearishTilt = clamp(0.5 - averagePrior / 2, 0, 1)
    const neutralBand = clamp(1 - Math.abs(averagePrior), 0, 1)

    base.Up += bullishTilt * 0.7
    base.Down += bearishTilt * 0.7
    base.Base += neutralBand * 0.45
    base.Reversal += neutralBand * 0.35
  }

  const totalStates = TREND_STATES.reduce((sum, state) => sum + stateCounts[state], 0)
  if (totalStates > 0) {
    for (const state of TREND_STATES) {
      base[state] += (stateCounts[state] / totalStates) * 0.6
    }
  }

  const normalized = normalizeVector(base)
  return {
    prior: {
      pDown: normalized.Down,
      pBase: normalized.Base,
      pReversal: normalized.Reversal,
      pUp: normalized.Up,
    },
    average: averagePrior,
  }
}

function derivePhaseDiagnostics(phases: Record<TrendState, number>, indicators: Indicators): QuantumPhase[] {
  return TREND_STATES.map((state) => {
    const shift = phases[state]
    const magnitude = Math.min(1, Math.abs(shift) / Math.PI)
    let reading: number | null = null
    if (state === 'Up' || state === 'Down') {
      reading = indicators.rsi
    } else if (state === 'Reversal') {
      reading = indicators.macd_hist
    } else if (state === 'Base') {
      reading = indicators.adx
    }
    const direction: 'bullish' | 'bearish' | 'neutral' =
      shift > 0 ? 'bullish' : shift < 0 ? 'bearish' : 'neutral'
    return {
      key: state.toLowerCase(),
      label: `${state} state phase`,
      shift,
      reading,
      direction,
      magnitude,
    }
  })
}

function buildInsights(
  dominant: TrendState,
  fused: QuantumVector,
  indicators: Indicators,
): string[] {
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

  if (indicators.rsi !== null) {
    const rsiValue = indicators.rsi
    if (rsiValue >= 60) {
      insights.push(`RSI elevated at ${rsiValue.toFixed(1)} — momentum skewed bullish.`)
    } else if (rsiValue <= 40) {
      insights.push(`RSI depressed at ${rsiValue.toFixed(1)} — bearish momentum dominates.`)
    } else {
      insights.push(`RSI balanced at ${rsiValue.toFixed(1)} — momentum neutral.`)
    }
  }

  if (indicators.macd_hist !== null) {
    const macdValue = indicators.macd_hist
    if (Math.abs(macdValue) < SMALL_EPSILON) {
      insights.push('MACD histogram near equilibrium — interference can flip quickly.')
    } else if (macdValue > 0) {
      insights.push('MACD impulse positive — constructive with bullish trend states.')
    } else {
      insights.push('MACD impulse negative — reinforces bearish amplitude.')
    }
  }

  if (indicators.adx !== null) {
    const adxValue = indicators.adx
    if (adxValue >= 25) {
      insights.push(`ADX ${adxValue.toFixed(1)} — trend strength amplifies dominant state.`)
    } else {
      insights.push(`ADX ${adxValue.toFixed(1)} — low energy regime, expect range-bound moves.`)
    }
  }

  if (indicators.ema_diff !== null) {
    const emaValue = indicators.ema_diff
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

const DEFAULT_CONFIG: ConfigQuantum = {
  steps: 3,
  alpha_markov_prior: 0.35,
  beta_quantum_probs: 0.4,
  gamma_indicator_bias: 0.25,
  delta_news_sentiment: 0,
  epsilon_vol_entropy: 0,
  normalize_weights: true,
  phase_map: {
    rsi: { center: 50, scale: (Math.PI / 2) / 25 },
    macd_hist: { center: 0, scale: Math.PI / 3 },
    adx: { center: 25, scale: (Math.PI / 4) / 25 },
    stoch_rsi_k: { center: 50, scale: (Math.PI / 2) / 25 },
  },
  interference: {
    matrix4x4: [
      [0.6, -0.2, 0.1, -0.1],
      [-0.2, 0.5, 0.3, 0.1],
      [0.15, 0.2, 0.4, 0.25],
      [-0.1, 0.1, 0.25, 0.55],
    ],
    regime_rules: [],
  },
  entanglement: {
    enabled: false,
    strength: 0,
    peers: [],
    timeframes: [],
    coupling_rule: 'corr',
  },
  q_anneal: {
    enabled: false,
    iterations: 0,
    temp_start: 1,
    temp_end: 0.1,
    search_space: {},
    objective: 'maximize_f1',
  },
}

function deriveIndicators(snapshots: TimeframeSignalSnapshot[]): {
  indicators: Indicators
  averages: {
    rsi: number | null
    stoch: number | null
    macdHistogram: number | null
    macdHistogramStd: number | null
    adx: number | null
    emaDiff: number | null
    signalStrength: number | null
  }
} {
  const macdHistogramValues: number[] = []
  const rsiValues: number[] = []
  const stochValues: number[] = []
  const adxValues: number[] = []
  const emaFastValues: number[] = []
  const emaSlowValues: number[] = []
  const maLongValues: number[] = []
  const macdValues: number[] = []
  const macdSignalValues: number[] = []
  const signalStrengthValues: number[] = []

  for (const snapshot of snapshots) {
    const breakdown = snapshot.combined?.breakdown
    if (!breakdown) {
      continue
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
    if (typeof breakdown.emaFast === 'number' && Number.isFinite(breakdown.emaFast)) {
      emaFastValues.push(breakdown.emaFast)
    }
    if (typeof breakdown.emaSlow === 'number' && Number.isFinite(breakdown.emaSlow)) {
      emaSlowValues.push(breakdown.emaSlow)
    }
    if (typeof breakdown.maLong === 'number' && Number.isFinite(breakdown.maLong)) {
      maLongValues.push(breakdown.maLong)
    }
    if (typeof breakdown.macdValue === 'number' && Number.isFinite(breakdown.macdValue)) {
      macdValues.push(breakdown.macdValue)
    }
    if (typeof breakdown.macdSignal === 'number' && Number.isFinite(breakdown.macdSignal)) {
      macdSignalValues.push(breakdown.macdSignal)
    }
    if (typeof breakdown.signalStrengthRaw === 'number' && Number.isFinite(breakdown.signalStrengthRaw)) {
      signalStrengthValues.push(breakdown.signalStrengthRaw)
    }
  }

  const macdHistogramAvg = average(macdHistogramValues)
  const macdHistogramStd = stdDev(macdHistogramValues)
  const rsiAvg = average(rsiValues)
  const stochAvg = average(stochValues)
  const adxAvg = average(adxValues)
  const emaFastAvg = average(emaFastValues)
  const emaSlowAvg = average(emaSlowValues)
  const maLongAvg = average(maLongValues)
  const macdAvg = average(macdValues)
  const macdSignalAvg = average(macdSignalValues)
  const signalStrengthAvg = average(signalStrengthValues)

  let emaDiff: number | null = null
  if (emaFastAvg !== null && emaSlowAvg !== null && Math.abs(emaSlowAvg) > SMALL_EPSILON) {
    emaDiff = (emaFastAvg - emaSlowAvg) / Math.abs(emaSlowAvg)
  }

  const indicators: Indicators = {
    ema10: emaFastAvg,
    ema50: emaSlowAvg,
    ma200: maLongAvg,
    rsi: rsiAvg,
    stoch_rsi_k: stochAvg,
    stoch_rsi_d: stochAvg,
    macd: macdAvg,
    macd_signal: macdSignalAvg,
    macd_hist: macdHistogramAvg,
    macd_hist_std: macdHistogramStd,
    adx: adxAvg,
    atr: null,
    vol_entropy: null,
    realized_vol: null,
    ema_diff: emaDiff,
    signal_strength: signalStrengthAvg,
  }

  return {
    indicators,
    averages: {
      rsi: rsiAvg,
      stoch: stochAvg,
      macdHistogram: macdHistogramAvg,
      macdHistogramStd,
      adx: adxAvg,
      emaDiff,
      signalStrength: signalStrengthAvg,
    },
  }
}

function deriveMarkovInputs(snapshots: TimeframeSignalSnapshot[]): {
  priorScores: number[]
  stateCounts: Record<TrendState, number>
} {
  const priorScores: number[] = []
  const stateCounts: Record<TrendState, number> = { Down: 0, Base: 0, Reversal: 0, Up: 0 }
  const STATE_FROM_MARKOV: Record<'D' | 'R' | 'B' | 'U', TrendState> = {
    D: 'Down',
    R: 'Reversal',
    B: 'Base',
    U: 'Up',
  }

  for (const snapshot of snapshots) {
    const breakdown = snapshot.combined?.breakdown
    if (!breakdown) {
      continue
    }
    if (typeof breakdown.markov?.priorScore === 'number' && Number.isFinite(breakdown.markov.priorScore)) {
      priorScores.push(breakdown.markov.priorScore)
    }
    const currentState = breakdown.markov?.currentState
    if (currentState && STATE_FROM_MARKOV[currentState]) {
      const mapped = STATE_FROM_MARKOV[currentState]
      stateCounts[mapped] += 1
    }
  }

  return { priorScores, stateCounts }
}

function deriveVolEntropy(signalStrengthValues: number[]): number | null {
  if (signalStrengthValues.length < 2) {
    return null
  }
  const strengthStd = stdDev(signalStrengthValues)
  if (strengthStd === null) {
    return null
  }
  return clamp(strengthStd / 50, 0, 1)
}

function deriveQuantumComponents(
  markovVector: QuantumVector,
  quantumVector: QuantumVector,
  biasVector: QuantumVector,
  dominant: TrendState,
  weights: Record<string, number>,
): QuantumComponent[] {
  const markovWeight = weights.markov ?? 0
  const quantumWeight = weights.quantum ?? 0
  const biasWeight = weights.bias ?? 0

  return [
    {
      key: 'markov',
      label: 'Markov prior',
      weight: markovWeight,
      value: markovVector[dominant],
    },
    {
      key: 'quantum',
      label: 'Quantum walk',
      weight: quantumWeight,
      value: quantumVector[dominant],
    },
    {
      key: 'bias',
      label: 'Indicator bias',
      weight: biasWeight,
      value: biasVector[dominant],
    },
  ]
}

export function deriveQuantumCompositeSignal(
  snapshots: TimeframeSignalSnapshot[],
  config: ConfigQuantum = DEFAULT_CONFIG,
): QuantumCompositeSignal | null {
  const usableSnapshots = snapshots.filter((snapshot) => snapshot.combined?.breakdown)
  if (usableSnapshots.length === 0) {
    return null
  }

  const { indicators, averages } = deriveIndicators(usableSnapshots)
  if (
    indicators.rsi === null &&
    indicators.stoch_rsi_k === null &&
    indicators.macd_hist === null &&
    indicators.adx === null
  ) {
    return null
  }

  const { priorScores, stateCounts } = deriveMarkovInputs(usableSnapshots)
  const { prior: markovPrior, average: priorAverage } = computeMarkovPrior(priorScores, stateCounts)

  const indicatorBias = getIndicatorBias(indicators)

  const phaseMap = { ...config.phase_map }
  if (indicators.macd_hist_std && indicators.macd_hist_std > SMALL_EPSILON) {
    phaseMap.macd_hist = {
      ...phaseMap.macd_hist,
      scale: (Math.PI / 3) / indicators.macd_hist_std,
    }
  }

  let effectivePhaseMap: PhaseMap = { ...phaseMap }
  let effectiveMatrix = config.interference.matrix4x4.map((row) => row.slice())

  for (const rule of config.interference.regime_rules) {
    if (rule.when(indicators)) {
      effectiveMatrix = rule.adjust_interference(effectiveMatrix)
      effectivePhaseMap = rule.adjust_phase(effectivePhaseMap)
    }
  }

  const phases = PhaseComputer.compute_phases(indicators, effectivePhaseMap)

  const markovVector: QuantumVector = {
    Down: markovPrior.pDown,
    Base: markovPrior.pBase,
    Reversal: markovPrior.pReversal,
    Up: markovPrior.pUp,
  }

  const unitary = QuantumWalk.build_unitary_like(effectiveMatrix, phases)

  let amplitudes = QuantumStateBuilder.initialize_superposition(TREND_STATES as unknown as TrendState[])
  if (config.entanglement.enabled) {
    const couplings: Record<string, number> = {}
    amplitudes = Entangler.apply(amplitudes, couplings, config.entanglement.strength, config.entanglement.coupling_rule)
  }

  for (let step = 0; step < config.steps; step += 1) {
    amplitudes = QuantumWalk.evolve(amplitudes, unitary)
  }

  const measurement = Measurer.measure(amplitudes)
  const quantumVector = measurement.probabilities

  const weights = Weights.normalize_if(config.normalize_weights, {
    markov: config.alpha_markov_prior,
    quantum: config.beta_quantum_probs,
    bias: config.gamma_indicator_bias,
    news: config.delta_news_sentiment,
    entropy: config.epsilon_vol_entropy,
  })

  const Pc = markovVector
  const Pq = quantumVector
  const Pb = indicatorBias

  const sentiment: number | null = null
  const newsVector = sentiment !== null ? NewsMapper.map(sentiment) : initializeVector()
  const entropyValue = indicators.vol_entropy ?? deriveVolEntropy(
    usableSnapshots
      .map((snapshot) => snapshot.combined?.breakdown?.signalStrengthRaw)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value)),
  )
  const entropyVector =
    weights.entropy && entropyValue !== null
      ? EntropyMapper.map(entropyValue, indicators.adx)
      : initializeVector()

  const fused = initializeVector()
  for (const state of TREND_STATES) {
    fused[state] =
      (weights.markov ?? 0) * Pc[state] +
      (weights.quantum ?? 0) * Pq[state] +
      (weights.bias ?? 0) * Pb[state] +
      (weights.news ?? 0) * newsVector[state] +
      (weights.entropy ?? 0) * entropyVector[state]
  }

  const normalizedFused = normalizeVector(fused)

  let dominant: TrendState = 'Down'
  for (const state of TREND_STATES) {
    if (normalizedFused[state] > normalizedFused[dominant]) {
      dominant = state
    }
  }

  const confidence = Confidence.compute(normalizedFused)

  const probabilities: QuantumProbability[] = TREND_STATES.map((state) => ({
    state,
    probability: normalizedFused[state],
    amplitude: complexMagnitude(measurement.amplitudes[state]),
  }))

  const components = deriveQuantumComponents(Pc, Pq, Pb, dominant, weights)

  const phaseDiagnostics = derivePhaseDiagnostics(phases, indicators)

  const insights = buildInsights(dominant, normalizedFused, indicators)

  return {
    state: dominant,
    confidence,
    probabilities,
    components,
    phases: phaseDiagnostics,
    insights,
    debug: {
      markovVector: Pc,
      quantumVector: Pq,
      biasVector: Pb,
      fusedVector: normalizedFused,
      weights,
      phaseShifts: phases,
      matrix: unitary,
      amplitudes: measurement.amplitudes,
      markovPriorAverage: priorAverage,
      indicatorAverages: {
        rsi: averages.rsi,
        stoch: averages.stoch,
        macdHistogram: averages.macdHistogram,
        macdHistogramStd: averages.macdHistogramStd,
        adx: averages.adx,
        emaDiff: averages.emaDiff,
        signalStrength: averages.signalStrength,
      },
      sampleCount: usableSnapshots.length,
    },
  }
}
