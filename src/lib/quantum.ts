import type { TimeframeSignalSnapshot } from '../types/signals'

const TREND_STATES = ['Down', 'Base', 'Reversal', 'Up'] as const

export type TrendState = (typeof TREND_STATES)[number]

const STATE_INDEX: Record<TrendState, number> = {
  Down: 0,
  Base: 1,
  Reversal: 2,
  Up: 3,
}

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

export type OhlcvCandle = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type OHLCV = OhlcvCandle[]

type MarkovProb = {
  pDown: number
  pBase: number
  pReversal: number
  pUp: number
}

export type Indicators = {
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

export type ConfigQuantum = {
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

export type QuantumFlipThresholdBias = 'LONG' | 'SHORT' | 'NEUTRAL'

export type QuantumFlipThresholdState = 'BASE' | 'BEARISH' | 'REVERSAL'

export type QuantumFlipThresholdSignal =
  | 'ENTER LONG'
  | 'WATCH FOR LONG'
  | 'ENTER SHORT'
  | 'WATCH FOR SHORT'
  | 'SIDEWAYS / BASE-BUILDING'

export type QuantumFlipThresholdDiagnostics = {
  P_base: number
  P_down: number
  P_reversal: number
  longEdge: number
  shortEdge: number
  markovProjection: number
  quantumProjection: number
  phaseProjection: number
}

export type QuantumFlipThreshold = {
  state: QuantumFlipThresholdState
  bias: QuantumFlipThresholdBias
  biasStrength: number
  compositeBias: number
  phaseAngle: number
  signal: QuantumFlipThresholdSignal
  diagnostics: QuantumFlipThresholdDiagnostics
}

export type QuantumCompositeSignal = {
  state: TrendState
  confidence: number
  probabilities: QuantumProbability[]
  components: QuantumComponent[]
  phases: QuantumPhase[]
  flipThreshold: QuantumFlipThreshold
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

export type RiskTarget = {
  label: string
  multiple: number
  price: number | null
  weight: number
}

export type RiskPlan = {
  direction: 'LONG' | 'SHORT' | 'NEUTRAL'
  directionSign: -1 | 0 | 1
  size: number
  entryPrice: number | null
  stopLoss: number | null
  targets: RiskTarget[]
  trailing: { type: 'ATR'; multiple: number } | null
  meta: QuantumCompositeSignal['debug'] | null
}

type PhaseMapKey = keyof PhaseMap

function clonePhaseMap(map: PhaseMap): PhaseMap {
  return {
    rsi: { ...map.rsi },
    macd_hist: { ...map.macd_hist },
    adx: { ...map.adx },
    stoch_rsi_k: { ...map.stoch_rsi_k },
  }
}

function cloneInterferenceMatrix(matrix: number[][]): number[][] {
  return matrix.map((row) => row.slice())
}

function normalizeInterferenceMatrix(matrix: number[][]): number[][] {
  return matrix.map((row) => {
    const sanitized = row.map((value) => {
      if (!Number.isFinite(value)) {
        return 0
      }
      return Math.max(0, value)
    })
    const sum = sanitized.reduce((total, value) => total + value, 0)
    if (sum <= 0) {
      return Array.from({ length: TREND_STATES.length }, () => 1 / TREND_STATES.length)
    }
    return sanitized.map((value) => value / sum)
  })
}

function withNormalizedInterference(
  matrix: number[][],
  updater: (draft: number[][]) => void,
): number[][] {
  const draft = cloneInterferenceMatrix(matrix)
  updater(draft)
  return normalizeInterferenceMatrix(draft)
}

function applyDelta(
  matrix: number[][],
  fromStates: TrendState[],
  toStates: TrendState[],
  delta: number,
): void {
  for (const from of fromStates) {
    const fromIndex = STATE_INDEX[from]
    const row = matrix[fromIndex]
    if (!row) {
      continue
    }
    for (const to of toStates) {
      const toIndex = STATE_INDEX[to]
      if (typeof row[toIndex] !== 'number') {
        continue
      }
      row[toIndex] += delta
    }
  }
}

function amplifyTransitions(
  matrix: number[][],
  fromStates: TrendState[],
  toStates: TrendState[],
  delta: number,
): number[][] {
  if (fromStates.length === 0 || toStates.length === 0 || delta === 0) {
    return normalizeInterferenceMatrix(matrix)
  }
  return withNormalizedInterference(matrix, (draft) => {
    applyDelta(draft, fromStates, toStates, delta)
  })
}

function amplifyDiagonal(matrix: number[][], states: TrendState[], delta: number): number[][] {
  if (states.length === 0 || delta === 0) {
    return normalizeInterferenceMatrix(matrix)
  }
  return withNormalizedInterference(matrix, (draft) => {
    for (const state of states) {
      const index = STATE_INDEX[state]
      if (draft[index] && typeof draft[index][index] === 'number') {
        draft[index][index] += delta
      }
    }
  })
}

function redistributeColumns(matrix: number[][], toStates: TrendState[], delta: number): number[][] {
  if (toStates.length === 0 || delta === 0) {
    return normalizeInterferenceMatrix(matrix)
  }
  return withNormalizedInterference(matrix, (draft) => {
    for (const row of draft) {
      for (const state of toStates) {
        const columnIndex = STATE_INDEX[state]
        if (typeof row[columnIndex] === 'number') {
          row[columnIndex] += delta
        }
      }
    }
  })
}

function scalePhaseMap(map: PhaseMap, keys: PhaseMapKey[], factor: number): PhaseMap {
  if (!Number.isFinite(factor) || factor === 1) {
    return clonePhaseMap(map)
  }
  const updated = clonePhaseMap(map)
  for (const key of keys) {
    if (updated[key]) {
      updated[key] = {
        ...updated[key],
        scale: updated[key].scale * factor,
      }
    }
  }
  return updated
}

function cloneConfig(config: ConfigQuantum): ConfigQuantum {
  return {
    ...config,
    phase_map: clonePhaseMap(config.phase_map),
    interference: {
      matrix4x4: cloneInterferenceMatrix(config.interference.matrix4x4),
      regime_rules: config.interference.regime_rules.slice(),
    },
    entanglement: {
      ...config.entanglement,
      peers: config.entanglement.peers.slice(),
      timeframes: config.entanglement.timeframes.slice(),
    },
    q_anneal: { ...config.q_anneal },
  }
}

type PhaseMapOverrides = Partial<Record<PhaseMapKey, Partial<PhaseMapEntry>>>

type ConfigOverrides = Partial<
  Omit<ConfigQuantum, 'phase_map' | 'interference' | 'entanglement' | 'q_anneal'>
> & {
  phase_map?: PhaseMapOverrides
  interference?: Partial<Pick<InterferenceConfig, 'matrix4x4' | 'regime_rules'>>
  entanglement?: Partial<EntanglementConfig>
  q_anneal?: Partial<AnnealConfig>
}

function buildConfig(base: ConfigQuantum, overrides: ConfigOverrides): ConfigQuantum {
  const next = cloneConfig(base)

  if (overrides.steps !== undefined) next.steps = overrides.steps
  if (overrides.alpha_markov_prior !== undefined) next.alpha_markov_prior = overrides.alpha_markov_prior
  if (overrides.beta_quantum_probs !== undefined) next.beta_quantum_probs = overrides.beta_quantum_probs
  if (overrides.gamma_indicator_bias !== undefined) next.gamma_indicator_bias = overrides.gamma_indicator_bias
  if (overrides.delta_news_sentiment !== undefined) next.delta_news_sentiment = overrides.delta_news_sentiment
  if (overrides.epsilon_vol_entropy !== undefined) next.epsilon_vol_entropy = overrides.epsilon_vol_entropy
  if (overrides.normalize_weights !== undefined) next.normalize_weights = overrides.normalize_weights

  if (overrides.phase_map) {
    const updated = clonePhaseMap(next.phase_map)
    for (const key of Object.keys(overrides.phase_map) as PhaseMapKey[]) {
      const entryOverride = overrides.phase_map[key]
      if (!entryOverride) {
        continue
      }
      updated[key] = {
        ...updated[key],
        ...entryOverride,
      }
    }
    next.phase_map = updated
  }

  if (overrides.interference) {
    const updated: InterferenceConfig = {
      matrix4x4: cloneInterferenceMatrix(next.interference.matrix4x4),
      regime_rules: next.interference.regime_rules.slice(),
    }
    if (overrides.interference.matrix4x4) {
      updated.matrix4x4 = overrides.interference.matrix4x4.map((row) => row.slice())
    }
    if (overrides.interference.regime_rules) {
      updated.regime_rules = overrides.interference.regime_rules.slice()
    }
    next.interference = updated
  }

  if (overrides.entanglement) {
    next.entanglement = {
      ...next.entanglement,
      ...overrides.entanglement,
      peers: overrides.entanglement.peers
        ? overrides.entanglement.peers.slice()
        : next.entanglement.peers.slice(),
      timeframes: overrides.entanglement.timeframes
        ? overrides.entanglement.timeframes.slice()
        : next.entanglement.timeframes.slice(),
    }
  }

  if (overrides.q_anneal) {
    next.q_anneal = {
      ...next.q_anneal,
      ...overrides.q_anneal,
    }
  }

  return next
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

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function weightedAverage(pairs: Array<[number, number]>): number {
  let weightedSum = 0
  let weightTotal = 0

  for (const [value, weight] of pairs) {
    if (!Number.isFinite(value) || !Number.isFinite(weight) || weight <= 0) {
      continue
    }

    weightedSum += value * weight
    weightTotal += weight
  }

  if (weightTotal <= 0) {
    return 0
  }

  return weightedSum / weightTotal
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

function computeQuantumMarkovFlipThreshold(
  fused: QuantumVector,
  markov: QuantumVector,
  quantum: QuantumVector,
  phases: Record<TrendState, number>,
): QuantumFlipThreshold {
  const TH_FLIP_MAJOR = 5
  const TH_PHASE_LONG = 45
  const TH_PHASE_SHORT = -45

  const P_base = clamp01(fused.Base)
  const P_down = clamp01(fused.Down)
  const P_reversal = clamp01(fused.Reversal)

  const phaseAngle = clamp((phases.Up ?? 0) * (180 / Math.PI), -180, 180)

  let state: QuantumFlipThresholdState = 'BASE'
  if (P_base >= Math.max(P_down, P_reversal)) {
    state = 'BASE'
  } else if (P_down > P_reversal) {
    state = 'BEARISH'
  } else {
    state = 'REVERSAL'
  }

  const shortEdge = (P_down - P_reversal) * 100
  const longEdge = (P_reversal - P_down) * 100

  let bias: QuantumFlipThresholdBias = 'NEUTRAL'
  if (shortEdge > TH_FLIP_MAJOR && phaseAngle < TH_PHASE_SHORT) {
    bias = 'SHORT'
  } else if (longEdge > TH_FLIP_MAJOR && phaseAngle > TH_PHASE_LONG) {
    bias = 'LONG'
  }

  const markovProjection = clamp(markov.Up - markov.Down, -1, 1)
  const quantumProjection = clamp(quantum.Up - quantum.Down, -1, 1)
  const phaseProjection = clamp(phaseAngle / 180, -1, 1)

  const compositeBias = weightedAverage([
    [markovProjection, 0.4],
    [quantumProjection, 0.4],
    [phaseProjection, 0.2],
  ])

  let biasStrength = 0
  if (bias === 'LONG') {
    biasStrength = clamp01(Math.max(0, compositeBias))
  } else if (bias === 'SHORT') {
    biasStrength = clamp01(Math.max(0, -compositeBias))
  } else {
    biasStrength = clamp01(Math.abs(compositeBias))
  }

  let signal: QuantumFlipThresholdSignal = 'SIDEWAYS / BASE-BUILDING'
  if (bias === 'LONG') {
    signal = biasStrength > 0.55 ? 'ENTER LONG' : 'WATCH FOR LONG'
  } else if (bias === 'SHORT') {
    signal = biasStrength > 0.55 ? 'ENTER SHORT' : 'WATCH FOR SHORT'
  }

  return {
    state,
    bias,
    biasStrength,
    compositeBias,
    phaseAngle,
    signal,
    diagnostics: {
      P_base,
      P_down,
      P_reversal,
      longEdge,
      shortEdge,
      markovProjection,
      quantumProjection,
      phaseProjection,
    },
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

export const LowADXRangeRule: RegimeRule = {
  when: (indicators) => {
    const adx = indicators.adx
    return typeof adx === 'number' && adx < 18
  },
  adjust_interference: (matrix) => amplifyTransitions(matrix, ['Down', 'Up'], ['Base', 'Reversal'], 0.05),
  adjust_phase: (phaseMap) => scalePhaseMap(phaseMap, ['rsi', 'macd_hist'], 0.85),
}

export const HighTrendRule: RegimeRule = {
  when: (indicators) => {
    const adx = indicators.adx
    const macdHist = indicators.macd_hist
    const macdStd = indicators.macd_hist_std
    if (typeof adx !== 'number' || adx <= 28) {
      return false
    }
    if (typeof macdHist !== 'number') {
      return false
    }
    const threshold = typeof macdStd === 'number' && macdStd > SMALL_EPSILON ? macdStd * 0.5 : 0.5
    return Math.abs(macdHist) > threshold
  },
  adjust_interference: (matrix) => amplifyDiagonal(matrix, ['Down', 'Up'], 0.06),
  adjust_phase: (phaseMap) => scalePhaseMap(phaseMap, ['rsi', 'macd_hist'], 1.1),
}

export const HighEntropyShockRule: RegimeRule = {
  when: (indicators) => {
    const entropy = indicators.vol_entropy
    return typeof entropy === 'number' && entropy > 0.65
  },
  adjust_interference: (matrix) => redistributeColumns(matrix, ['Reversal', 'Base'], 0.06),
  adjust_phase: (phaseMap) => scalePhaseMap(phaseMap, ['stoch_rsi_k'], 1.15),
}

export const BASE_QUANTUM_CONFIG: ConfigQuantum = {
  steps: 4,
  alpha_markov_prior: 0.4,
  beta_quantum_probs: 0.4,
  gamma_indicator_bias: 0.15,
  delta_news_sentiment: 0.03,
  epsilon_vol_entropy: 0.02,
  normalize_weights: true,
  phase_map: {
    rsi: { center: 50, scale: (Math.PI / 2) / 25 },
    macd_hist: { center: 0, scale: Math.PI / 3 },
    adx: { center: 25, scale: (Math.PI / 4) / 25 },
    stoch_rsi_k: { center: 50, scale: (Math.PI / 2) / 25 },
  },
  interference: {
    matrix4x4: [
      [0.62, 0.22, 0.1, 0.06],
      [0.18, 0.52, 0.2, 0.1],
      [0.08, 0.24, 0.38, 0.3],
      [0.06, 0.12, 0.22, 0.6],
    ],
    regime_rules: [LowADXRangeRule, HighTrendRule, HighEntropyShockRule],
  },
  entanglement: {
    enabled: true,
    strength: 0.3,
    peers: ['ETH', 'TOTAL', 'DXY_inv'],
    timeframes: ['1h', '4h'],
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

export const CONFIG_5M = buildConfig(BASE_QUANTUM_CONFIG, {
  steps: 5,
  alpha_markov_prior: 0.32,
  beta_quantum_probs: 0.46,
  gamma_indicator_bias: 0.17,
  delta_news_sentiment: 0.03,
  epsilon_vol_entropy: 0.02,
  phase_map: {
    rsi: { scale: (Math.PI / 2) / 20 },
    macd_hist: { scale: Math.PI / 2.8 },
    stoch_rsi_k: { scale: (Math.PI / 2) / 20 },
  },
  interference: {
    matrix4x4: [
      [0.58, 0.24, 0.11, 0.07],
      [0.16, 0.5, 0.22, 0.12],
      [0.08, 0.22, 0.36, 0.34],
      [0.07, 0.12, 0.24, 0.57],
    ],
  },
  entanglement: {
    strength: 0.38,
    timeframes: ['15m', '1h'],
  },
})

export const CONFIG_15M = buildConfig(BASE_QUANTUM_CONFIG, {
  steps: 4,
  alpha_markov_prior: 0.35,
  beta_quantum_probs: 0.4,
  gamma_indicator_bias: 0.2,
  delta_news_sentiment: 0.03,
  epsilon_vol_entropy: 0.02,
  interference: {
    matrix4x4: [
      [0.6, 0.25, 0.1, 0.05],
      [0.18, 0.5, 0.22, 0.1],
      [0.08, 0.24, 0.36, 0.32],
      [0.06, 0.1, 0.24, 0.6],
    ],
  },
})

export const CONFIG_30M = buildConfig(BASE_QUANTUM_CONFIG, {
  steps: 4,
  alpha_markov_prior: 0.38,
  beta_quantum_probs: 0.38,
  gamma_indicator_bias: 0.2,
  delta_news_sentiment: 0.03,
  epsilon_vol_entropy: 0.01,
  phase_map: {
    macd_hist: { scale: Math.PI / 3.2 },
    rsi: { scale: (Math.PI / 2) / 26 },
  },
  interference: {
    matrix4x4: [
      [0.61, 0.24, 0.09, 0.06],
      [0.17, 0.53, 0.2, 0.1],
      [0.08, 0.22, 0.38, 0.32],
      [0.06, 0.1, 0.22, 0.62],
    ],
  },
})

export const CONFIG_60M = buildConfig(BASE_QUANTUM_CONFIG, {
  steps: 4,
  alpha_markov_prior: 0.4,
  beta_quantum_probs: 0.37,
  gamma_indicator_bias: 0.18,
  delta_news_sentiment: 0.03,
  epsilon_vol_entropy: 0.02,
  phase_map: {
    macd_hist: { scale: Math.PI / 3.5 },
    rsi: { scale: (Math.PI / 2) / 28 },
  },
  interference: {
    matrix4x4: [
      [0.63, 0.22, 0.08, 0.07],
      [0.16, 0.54, 0.2, 0.1],
      [0.07, 0.22, 0.37, 0.34],
      [0.06, 0.1, 0.2, 0.64],
    ],
  },
  entanglement: {
    strength: 0.28,
    timeframes: ['1h', '4h'],
  },
})

export const CONFIG_120M = buildConfig(BASE_QUANTUM_CONFIG, {
  steps: 4,
  alpha_markov_prior: 0.42,
  beta_quantum_probs: 0.35,
  gamma_indicator_bias: 0.18,
  phase_map: {
    macd_hist: { scale: Math.PI / 4 },
    rsi: { scale: (Math.PI / 2) / 30 },
  },
  interference: {
    matrix4x4: [
      [0.64, 0.21, 0.07, 0.08],
      [0.15, 0.55, 0.2, 0.1],
      [0.07, 0.21, 0.37, 0.35],
      [0.06, 0.1, 0.18, 0.66],
    ],
  },
  entanglement: {
    strength: 0.26,
    timeframes: ['2h', '4h'],
  },
})

export const CONFIG_240M = buildConfig(BASE_QUANTUM_CONFIG, {
  steps: 5,
  alpha_markov_prior: 0.45,
  beta_quantum_probs: 0.35,
  gamma_indicator_bias: 0.15,
  phase_map: {
    macd_hist: { scale: Math.PI / 4.5 },
    rsi: { scale: (Math.PI / 2) / 32 },
  },
  interference: {
    matrix4x4: [
      [0.66, 0.2, 0.06, 0.08],
      [0.14, 0.56, 0.19, 0.11],
      [0.06, 0.2, 0.36, 0.38],
      [0.05, 0.08, 0.18, 0.69],
    ],
  },
  entanglement: {
    strength: 0.24,
    timeframes: ['4h', '1d'],
  },
})

export const CONFIG_360M = buildConfig(BASE_QUANTUM_CONFIG, {
  steps: 5,
  alpha_markov_prior: 0.48,
  beta_quantum_probs: 0.32,
  gamma_indicator_bias: 0.15,
  phase_map: {
    macd_hist: { scale: Math.PI / 5 },
    rsi: { scale: (Math.PI / 2) / 34 },
  },
  interference: {
    matrix4x4: [
      [0.68, 0.19, 0.05, 0.08],
      [0.13, 0.58, 0.18, 0.11],
      [0.05, 0.19, 0.36, 0.4],
      [0.04, 0.08, 0.17, 0.71],
    ],
  },
  entanglement: {
    strength: 0.22,
    timeframes: ['6h', '1d'],
  },
})

export const CONFIG_420M = buildConfig(BASE_QUANTUM_CONFIG, {
  steps: 5,
  alpha_markov_prior: 0.5,
  beta_quantum_probs: 0.3,
  gamma_indicator_bias: 0.15,
  phase_map: {
    macd_hist: { scale: Math.PI / 5.2 },
    rsi: { scale: (Math.PI / 2) / 35 },
  },
  interference: {
    matrix4x4: [
      [0.69, 0.18, 0.05, 0.08],
      [0.12, 0.59, 0.18, 0.11],
      [0.05, 0.18, 0.35, 0.42],
      [0.04, 0.07, 0.16, 0.73],
    ],
  },
  entanglement: {
    strength: 0.2,
    timeframes: ['7h', '1d'],
  },
})

export const CONFIG_1D = buildConfig(BASE_QUANTUM_CONFIG, {
  steps: 6,
  alpha_markov_prior: 0.54,
  beta_quantum_probs: 0.28,
  gamma_indicator_bias: 0.15,
  delta_news_sentiment: 0.02,
  epsilon_vol_entropy: 0.01,
  phase_map: {
    macd_hist: { scale: Math.PI / 6 },
    rsi: { scale: (Math.PI / 2) / 38 },
    stoch_rsi_k: { scale: (Math.PI / 2) / 28 },
  },
  interference: {
    matrix4x4: [
      [0.72, 0.16, 0.04, 0.08],
      [0.1, 0.62, 0.16, 0.12],
      [0.04, 0.16, 0.34, 0.46],
      [0.03, 0.06, 0.15, 0.76],
    ],
    regime_rules: [HighTrendRule, HighEntropyShockRule],
  },
  entanglement: {
    strength: 0.18,
    peers: ['ETH', 'TOTAL', 'NQ100', 'DXY_inv'],
    timeframes: ['4h', '1d'],
  },
})

export const QUANTUM_CONFIG_TEMPLATES: Record<string, ConfigQuantum> = {
  base: BASE_QUANTUM_CONFIG,
  '5m': CONFIG_5M,
  '15m': CONFIG_15M,
  '30m': CONFIG_30M,
  '60m': CONFIG_60M,
  '1h': CONFIG_60M,
  '120m': CONFIG_120M,
  '2h': CONFIG_120M,
  '240m': CONFIG_240M,
  '4h': CONFIG_240M,
  '360m': CONFIG_360M,
  '6h': CONFIG_360M,
  '420m': CONFIG_420M,
  '7h': CONFIG_420M,
  '1d': CONFIG_1D,
  '1D': CONFIG_1D,
}

export const DEFAULT_CONFIG: ConfigQuantum = BASE_QUANTUM_CONFIG

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
    const configuredScale = phaseMap.macd_hist.scale
    phaseMap.macd_hist = {
      ...phaseMap.macd_hist,
      scale: configuredScale / indicators.macd_hist_std,
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

  const flipThreshold = computeQuantumMarkovFlipThreshold(normalizedFused, markovVector, quantumVector, phases)

  return {
    state: dominant,
    confidence,
    probabilities,
    components,
    phases: phaseDiagnostics,
    flipThreshold,
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

type TimeframeQuantumEntry = {
  timeframe: string
  result: QuantumCompositeSignal
}

type WeightOverrides = Partial<Record<string, number>>

const STATE_PRIORITY: TrendState[] = ['Up', 'Down', 'Reversal', 'Base']

function buildTimeframeWeights(
  timeframes: string[],
  overrides: WeightOverrides,
  validTimeframes: Set<string>,
): Record<string, number> {
  const weights: Record<string, number> = {}
  let total = 0

  for (const timeframe of timeframes) {
    if (!validTimeframes.has(timeframe)) {
      weights[timeframe] = 0
      continue
    }

    const override = overrides[timeframe]
    const weight = typeof override === 'number' && Number.isFinite(override) && override > 0 ? override : 1
    weights[timeframe] = weight
    total += weight
  }

  if (total <= 0) {
    const fallback = validTimeframes.size > 0 ? 1 / validTimeframes.size : 0
    for (const timeframe of timeframes) {
      weights[timeframe] = validTimeframes.has(timeframe) ? fallback : 0
    }
    return weights
  }

  for (const timeframe of timeframes) {
    if (validTimeframes.has(timeframe)) {
      weights[timeframe] = weights[timeframe] / total
    } else {
      weights[timeframe] = 0
    }
  }

  return weights
}

function majorityVoteWithPriority(
  voteCounts: Record<TrendState, number>,
  weightedVotes: Record<TrendState, number>,
): TrendState {
  let bestState: TrendState = 'Base'
  let bestScore = -Infinity

  for (const state of TREND_STATES) {
    const score = weightedVotes[state]
    if (score > bestScore + SMALL_EPSILON) {
      bestState = state
      bestScore = score
      continue
    }

    if (Math.abs(score - bestScore) <= SMALL_EPSILON) {
      if (voteCounts[state] > voteCounts[bestState]) {
        bestState = state
      } else if (voteCounts[state] === voteCounts[bestState]) {
        const statePriority = STATE_PRIORITY.indexOf(state)
        const bestPriority = STATE_PRIORITY.indexOf(bestState)
        if (bestPriority === -1 || (statePriority !== -1 && statePriority < bestPriority)) {
          bestState = state
        }
      }
    }
  }

  return bestState
}

function aggregateComponentsAcrossTimeframes(
  entries: TimeframeQuantumEntry[],
  weights: Record<string, number>,
): QuantumComponent[] {
  const accumulator: Record<QuantumComponent['key'], { label: string; weight: number; value: number; total: number }> = {
    markov: { label: 'Markov prior', weight: 0, value: 0, total: 0 },
    quantum: { label: 'Quantum walk', weight: 0, value: 0, total: 0 },
    bias: { label: 'Indicator bias', weight: 0, value: 0, total: 0 },
  }

  let totalWeight = 0

  for (const entry of entries) {
    const timeframeWeight = weights[entry.timeframe] ?? 0
    if (timeframeWeight <= 0) {
      continue
    }

    totalWeight += timeframeWeight

    for (const component of entry.result.components) {
      const bucket = accumulator[component.key]
      bucket.label = component.label
      bucket.weight += timeframeWeight * component.weight
      bucket.value += timeframeWeight * component.value
      bucket.total += timeframeWeight
    }
  }

  if (totalWeight <= 0) {
    return [
      { key: 'markov', label: 'Markov prior', weight: 0, value: 0 },
      { key: 'quantum', label: 'Quantum walk', weight: 0, value: 0 },
      { key: 'bias', label: 'Indicator bias', weight: 0, value: 0 },
    ]
  }

  return (['markov', 'quantum', 'bias'] as QuantumComponent['key'][]).map((key) => {
    const bucket = accumulator[key]
    const divisor = bucket.total > 0 ? bucket.total : totalWeight
    return {
      key,
      label: bucket.label,
      weight: divisor > 0 ? bucket.weight / divisor : 0,
      value: divisor > 0 ? bucket.value / divisor : 0,
    }
  })
}

function aggregatePhasesAcrossTimeframes(
  entries: TimeframeQuantumEntry[],
  weights: Record<string, number>,
): QuantumPhase[] {
  const phaseAccumulator: Record<TrendState, {
    label: string
    shift: number
    magnitude: number
    weight: number
    reading: number
    readingWeight: number
  }> = {
    Down: { label: 'Down state phase', shift: 0, magnitude: 0, weight: 0, reading: 0, readingWeight: 0 },
    Base: { label: 'Base state phase', shift: 0, magnitude: 0, weight: 0, reading: 0, readingWeight: 0 },
    Reversal: { label: 'Reversal state phase', shift: 0, magnitude: 0, weight: 0, reading: 0, readingWeight: 0 },
    Up: { label: 'Up state phase', shift: 0, magnitude: 0, weight: 0, reading: 0, readingWeight: 0 },
  }

  for (const entry of entries) {
    const timeframeWeight = weights[entry.timeframe] ?? 0
    if (timeframeWeight <= 0) {
      continue
    }

    for (const phase of entry.result.phases) {
      const state = TREND_STATES.find((candidate) => candidate.toLowerCase() === phase.key) ?? null
      if (!state) {
        continue
      }
      const bucket = phaseAccumulator[state]
      bucket.label = phase.label
      bucket.shift += phase.shift * timeframeWeight
      bucket.magnitude += phase.magnitude * timeframeWeight
      bucket.weight += timeframeWeight
      if (phase.reading !== null) {
        bucket.reading += phase.reading * timeframeWeight
        bucket.readingWeight += timeframeWeight
      }
    }
  }

  return TREND_STATES.map((state) => {
    const bucket = phaseAccumulator[state]
    const total = bucket.weight
    const avgShift = total > 0 ? bucket.shift / total : 0
    const avgMagnitude = total > 0 ? clamp(bucket.magnitude / total, 0, 1) : 0
    const avgReading = bucket.readingWeight > 0 ? bucket.reading / bucket.readingWeight : null
    const direction: 'bullish' | 'bearish' | 'neutral' = avgShift > 0 ? 'bullish' : avgShift < 0 ? 'bearish' : 'neutral'

    return {
      key: state.toLowerCase(),
      label: bucket.label,
      shift: avgShift,
      reading: avgReading,
      direction,
      magnitude: avgMagnitude,
    }
  })
}

function aggregateInsights(
  entries: TimeframeQuantumEntry[],
  weights: Record<string, number>,
  limit = 6,
): string[] {
  const ordered = entries
    .slice()
    .sort((a, b) => (weights[b.timeframe] ?? 0) - (weights[a.timeframe] ?? 0))

  const insights: string[] = []

  for (const entry of ordered) {
    for (const insight of entry.result.insights) {
      if (!insights.includes(insight)) {
        insights.push(insight)
      }
      if (insights.length >= limit) {
        return insights
      }
    }
  }

  return insights
}

function vectorFromProbabilities(probabilities: QuantumProbability[]): QuantumVector {
  const vector = initializeVector()
  for (const probability of probabilities) {
    vector[probability.state] = probability.probability
  }
  return normalizeVector(vector)
}

export type MultiTfQuantumComposite = {
  symbol: string
  state: TrendState
  confidence: number
  probabilities: QuantumProbability[]
  components: QuantumComponent[]
  phases: QuantumPhase[]
  insights: string[]
  perTimeframe: Record<string, QuantumCompositeSignal | null>
  votes: Record<TrendState, number>
  debug: {
    weights: Record<string, number>
    weightedVotes: Record<TrendState, number>
    aggregatedVector: QuantumVector
  }
}

export function deriveMultiTfQuantumComposite(
  symbol: string,
  timeframes: string[],
  snapshotsByTimeframe: Record<string, TimeframeSignalSnapshot[]>,
  configByTimeframe: Partial<Record<string, ConfigQuantum>> = {},
  weightOverrides: WeightOverrides = {},
): MultiTfQuantumComposite | null {
  const perTimeframe: Record<string, QuantumCompositeSignal | null> = {}
  const entries: TimeframeQuantumEntry[] = []
  const validTimeframes = new Set<string>()

  for (const timeframe of timeframes) {
    const snapshots = snapshotsByTimeframe[timeframe] ?? []
    const template = QUANTUM_CONFIG_TEMPLATES[timeframe]
    const config = configByTimeframe[timeframe] ?? template ?? DEFAULT_CONFIG
    const result = deriveQuantumCompositeSignal(snapshots, config)
    perTimeframe[timeframe] = result
    if (result) {
      validTimeframes.add(timeframe)
      entries.push({ timeframe, result })
    }
  }

  if (entries.length === 0) {
    return null
  }

  const weights = buildTimeframeWeights(timeframes, weightOverrides, validTimeframes)

  const voteCounts: Record<TrendState, number> = { Down: 0, Base: 0, Reversal: 0, Up: 0 }
  const weightedVotes: Record<TrendState, number> = { Down: 0, Base: 0, Reversal: 0, Up: 0 }

  for (const entry of entries) {
    const weight = weights[entry.timeframe] ?? 0
    voteCounts[entry.result.state] += 1
    weightedVotes[entry.result.state] += weight
  }

  const majorityState = majorityVoteWithPriority(voteCounts, weightedVotes)

  const aggregatedVector = initializeVector()
  for (const entry of entries) {
    const weight = weights[entry.timeframe] ?? 0
    if (weight <= 0) {
      continue
    }

    const fused = entry.result.debug?.fusedVector ?? vectorFromProbabilities(entry.result.probabilities)
    for (const state of TREND_STATES) {
      aggregatedVector[state] += weight * fused[state]
    }
  }

  const normalizedAggregated = normalizeVector(aggregatedVector)

  let dominantState: TrendState = majorityState
  let bestProbability = normalizedAggregated[majorityState]
  for (const state of TREND_STATES) {
    if (normalizedAggregated[state] > bestProbability + 0.1) {
      dominantState = state
      bestProbability = normalizedAggregated[state]
    }
  }

  const confidence = Confidence.compute(normalizedAggregated)

  const probabilities: QuantumProbability[] = TREND_STATES.map((state) => ({
    state,
    probability: normalizedAggregated[state],
    amplitude: Math.sqrt(Math.max(0, normalizedAggregated[state])),
  }))

  const components = aggregateComponentsAcrossTimeframes(entries, weights)
  const phases = aggregatePhasesAcrossTimeframes(entries, weights)
  const insights = aggregateInsights(entries, weights)

  return {
    symbol,
    state: dominantState,
    confidence,
    probabilities,
    components,
    phases,
    insights,
    perTimeframe,
    votes: voteCounts,
    debug: {
      weights,
      weightedVotes,
      aggregatedVector: normalizedAggregated,
    },
  }
}

type AtrRiskProfile = 'conservative' | 'balanced' | 'aggressive'

const ATR_LADDER_PROFILES: Record<
  AtrRiskProfile,
  { stopMultiple: number; targetMultiples: number[]; trailingMultiple: number }
> = {
  conservative: { stopMultiple: 1.25, targetMultiples: [0.75, 1.5, 2.5], trailingMultiple: 1 },
  balanced: { stopMultiple: 1.5, targetMultiples: [1, 2, 3], trailingMultiple: 1.5 },
  aggressive: { stopMultiple: 1.8, targetMultiples: [1.5, 2.5, 4], trailingMultiple: 2 },
}

function deriveAtrFromOhlcv(ohlcv: OHLCV, period = 14): number | null {
  if (!Array.isArray(ohlcv) || ohlcv.length < 2) {
    return null
  }

  const startIndex = Math.max(0, ohlcv.length - (period + 1))
  const segment = ohlcv.slice(startIndex)
  if (segment.length < 2) {
    return null
  }

  const trueRanges: number[] = []
  for (let i = 1; i < segment.length; i += 1) {
    const current = segment[i]
    const prev = segment[i - 1]
    if (!current || !prev) {
      continue
    }

    const high = Number.isFinite(current.high) ? current.high : null
    const low = Number.isFinite(current.low) ? current.low : null
    const prevClose = Number.isFinite(prev.close) ? prev.close : null
    if (high === null || low === null || prevClose === null) {
      continue
    }

    const range = high - low
    const highClose = Math.abs(high - prevClose)
    const lowClose = Math.abs(low - prevClose)
    const tr = Math.max(range, highClose, lowClose)
    if (Number.isFinite(tr)) {
      trueRanges.push(tr)
    }
  }

  if (trueRanges.length === 0) {
    return null
  }

  const atr = average(trueRanges)
  return atr !== null && Number.isFinite(atr) ? atr : null
}

const PositionSizer = {
  sizeFromConfidence(
    confidence: number,
    adx: number | null,
    atr: number | null,
    price: number | null,
  ): number {
    if (!Number.isFinite(confidence)) {
      return 0
    }

    const base = clamp(confidence, 0, 1)

    const adxStrength =
      adx !== null && Number.isFinite(adx)
        ? clamp((adx - 20) / 40, -0.5, 1)
        : 0
    const adxFactor = 1 + adxStrength * 0.5

    let atrFactor = 1
    if (
      atr !== null &&
      Number.isFinite(atr) &&
      atr > 0 &&
      price !== null &&
      Number.isFinite(price) &&
      price > 0
    ) {
      const atrPct = atr / price
      atrFactor = clamp(1 - clamp(atrPct, 0, 0.12) * 4, 0.3, 1)
    }

    const size = base * adxFactor * atrFactor
    if (!Number.isFinite(size)) {
      return 0
    }

    return clamp(size, 0, 1)
  },
}

const ATRLadder = {
  build(
    price: number | null,
    atr: number | null,
    direction: -1 | 0 | 1,
    riskProfile: AtrRiskProfile = 'balanced',
  ): { stopLoss: number | null; targets: RiskTarget[]; trailingMultiple: number | null } {
    const profile = ATR_LADDER_PROFILES[riskProfile] ?? ATR_LADDER_PROFILES.balanced

    if (
      !Number.isFinite(price ?? NaN) ||
      !Number.isFinite(atr ?? NaN) ||
      atr === null ||
      atr <= 0 ||
      !Number.isFinite(direction) ||
      direction === 0
    ) {
      return { stopLoss: null, targets: [], trailingMultiple: null }
    }

    const normalizedDirection: -1 | 1 = direction > 0 ? 1 : -1
    const resolvedPrice = price as number
    const resolvedAtr = atr as number

    const stopLoss =
      normalizedDirection === 1
        ? Math.max(resolvedPrice - profile.stopMultiple * resolvedAtr, 0)
        : Math.max(resolvedPrice + profile.stopMultiple * resolvedAtr, 0)

    const targets = profile.targetMultiples.map((multiple, idx) => {
      const rawPrice =
        normalizedDirection === 1
          ? resolvedPrice + multiple * resolvedAtr
          : resolvedPrice - multiple * resolvedAtr
      const priceValue = Number.isFinite(rawPrice) ? Math.max(rawPrice, 0) : null
      const weight = profile.targetMultiples.length > 0 ? 1 / profile.targetMultiples.length : 0
      return {
        label: `TP${idx + 1}`,
        multiple,
        price: priceValue,
        weight,
      }
    })

    return {
      stopLoss,
      targets,
      trailingMultiple: profile.trailingMultiple,
    }
  },
}

export function toRiskManagerInput(
  signal: QuantumCompositeSignal | null,
  indicators: Indicators,
  ohlcv: OHLCV,
): RiskPlan | null {
  if (!signal) {
    return null
  }

  const lastBar = Array.isArray(ohlcv) && ohlcv.length > 0 ? ohlcv[ohlcv.length - 1] : null
  const closePrice =
    lastBar && Number.isFinite(lastBar.close) ? (lastBar.close as number) : null

  const atrCandidate =
    indicators.atr !== null && Number.isFinite(indicators.atr)
      ? (indicators.atr as number)
      : deriveAtrFromOhlcv(ohlcv)
  const atrValue = atrCandidate !== null && Number.isFinite(atrCandidate) ? atrCandidate : null
  const adxValue = indicators.adx !== null && Number.isFinite(indicators.adx) ? indicators.adx : null

  const directionSign: -1 | 0 | 1 =
    signal.state === 'Up' || signal.state === 'Reversal'
      ? 1
      : signal.state === 'Down'
        ? -1
        : 0

  const direction: RiskPlan['direction'] =
    directionSign > 0 ? 'LONG' : directionSign < 0 ? 'SHORT' : 'NEUTRAL'

  const computedSize = PositionSizer.sizeFromConfidence(signal.confidence, adxValue, atrValue, closePrice)
  const size = directionSign === 0 ? 0 : computedSize

  const ladder = ATRLadder.build(closePrice, atrValue, directionSign, 'balanced')

  return {
    direction,
    directionSign,
    size,
    entryPrice: closePrice,
    stopLoss: ladder.stopLoss,
    targets: ladder.targets,
    trailing: ladder.trailingMultiple !== null ? { type: 'ATR', multiple: ladder.trailingMultiple } : null,
    meta: signal.debug ?? null,
  }
}
