import type { TimeframeSignalSnapshot } from '../../types/signals'

const UNIT_MULTIPLIERS: Record<string, number> = {
  M: 1,
  H: 60,
  D: 60 * 24,
  W: 60 * 24 * 7,
}

export const toDirectionKey = (value: string) => value.toLowerCase()

export const clampPercentage = (value: number) =>
  Math.round(Math.min(Math.max(value, 0), 100))

export const formatSignedValue = (value: number, decimalPlaces = 0): string => {
  if (!Number.isFinite(value)) {
    return '0'
  }

  const factor = 10 ** decimalPlaces
  let normalized =
    decimalPlaces > 0 ? Math.round(value * factor) / factor : Math.round(value)

  if (Object.is(normalized, -0)) {
    normalized = 0
  }

  const formatted =
    decimalPlaces > 0
      ? normalized.toFixed(decimalPlaces).replace(/\.0+$/, '')
      : normalized.toString()

  return normalized > 0 ? `+${formatted}` : formatted
}

export const formatPrice = (value: number | null | undefined, digits = 5) => {
  if (value == null || !Number.isFinite(value)) {
    return '—'
  }

  return value.toFixed(digits)
}

export const parseTimeframeWeight = (value: string) => {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return Number.POSITIVE_INFINITY
  }

  const asNumber = Number(trimmed)
  if (Number.isFinite(asNumber)) {
    return asNumber
  }

  const normalized = trimmed.toUpperCase()
  const unitPrefixMatch = normalized.match(/^([A-Z]+)(\d+)$/)
  if (unitPrefixMatch) {
    const [, unit, amount] = unitPrefixMatch
    const multiplier = UNIT_MULTIPLIERS[unit]
    if (multiplier != null) {
      return multiplier * Number(amount)
    }
  }

  const unitSuffixMatch = normalized.match(/^(\d+)([A-Z]+)$/)
  if (unitSuffixMatch) {
    const [, amount, unit] = unitSuffixMatch
    const multiplier = UNIT_MULTIPLIERS[unit]
    if (multiplier != null) {
      return multiplier * Number(amount)
    }
  }

  return Number.POSITIVE_INFINITY
}

export const sortSnapshotsByTimeframe = (snapshots: TimeframeSignalSnapshot[]) =>
  snapshots
    .slice()
    .sort((a, b) => {
      const aWeight = parseTimeframeWeight(a.timeframe)
      const bWeight = parseTimeframeWeight(b.timeframe)

      if (aWeight === bWeight) {
        return a.timeframe.localeCompare(b.timeframe)
      }

      return aWeight - bWeight
    })

export const snapshotsToMap = (snapshots: TimeframeSignalSnapshot[]) => {
  const map = new Map<string, TimeframeSignalSnapshot>()
  for (const snapshot of snapshots) {
    map.set(snapshot.timeframe, snapshot)
  }
  return map
}

export const resolveBiasDirection = (value: number) => {
  if (value > 0) return 'Bullish'
  if (value < 0) return 'Bearish'
  return 'Neutral'
}

export const formatWeight = (value: number) =>
  Number.isInteger(value) ? value.toString() : value.toFixed(1).replace(/\.0+$/, '')
