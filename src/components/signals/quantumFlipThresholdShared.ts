import type { QuantumFlipThreshold } from '../../lib/quantum'

export type DirectionalBias = 'LONG' | 'SHORT' | 'NEUTRAL'

export const FLIP_ZONE_LABELS: Record<QuantumFlipThreshold['state'], string> = {
  BASE: 'Base zone hold',
  BEARISH: 'Bearish pressure',
  REVERSAL: 'Reversal attempt',
}

export const FLIP_ZONE_BADGE_CLASS: Record<QuantumFlipThreshold['state'], string> = {
  BASE: 'border-slate-400/40 bg-slate-500/10 text-slate-200',
  BEARISH: 'border-rose-400/40 bg-rose-500/10 text-rose-200',
  REVERSAL: 'border-amber-400/40 bg-amber-500/10 text-amber-200',
}

export const FLIP_SIGNAL_CATEGORY: Record<QuantumFlipThreshold['signal'], 'long' | 'short' | 'neutral'> = {
  'ENTER LONG': 'long',
  'WATCH FOR LONG': 'long',
  'ENTER SHORT': 'short',
  'WATCH FOR SHORT': 'short',
  'SIDEWAYS / BASE-BUILDING': 'neutral',
}

export const FLIP_SIGNAL_BADGE_CLASS: Record<'long' | 'short' | 'neutral', string> = {
  long: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
  short: 'border-rose-400/40 bg-rose-500/10 text-rose-200',
  neutral: 'border-slate-400/40 bg-slate-500/10 text-slate-200',
}

export const FLIP_BIAS_LABELS: Record<QuantumFlipThreshold['bias'], string> = {
  LONG: 'Long bias',
  SHORT: 'Short bias',
  NEUTRAL: 'Neutral bias',
}

export const FLIP_BIAS_TEXT_CLASS: Record<QuantumFlipThreshold['bias'], string> = {
  LONG: 'text-emerald-200',
  SHORT: 'text-rose-200',
  NEUTRAL: 'text-slate-200',
}

export const DIRECTIONAL_BADGE_CLASS: Record<DirectionalBias, string> = {
  LONG: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
  SHORT: 'border-rose-400/40 bg-rose-500/10 text-rose-200',
  NEUTRAL: 'border-slate-400/40 bg-slate-500/10 text-slate-200',
}

export const DIRECTIONAL_TEXT_CLASS: Record<DirectionalBias, string> = {
  LONG: 'text-emerald-300',
  SHORT: 'text-rose-300',
  NEUTRAL: 'text-slate-200',
}

export const BIAS_GRADIENT: Record<DirectionalBias, string> = {
  LONG: 'from-emerald-400 to-emerald-500',
  SHORT: 'from-rose-500 to-rose-400',
  NEUTRAL: 'from-slate-500 to-slate-400',
}

export function formatSignedPercent(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) {
    return '0%'
  }

  const multiplier = 10 ** decimals
  const rounded = Math.round(value * multiplier) / multiplier
  const normalized = Object.is(rounded, -0) ? 0 : rounded
  const formatted = Number(normalized.toFixed(decimals))

  return normalized > 0 ? `+${formatted}%` : `${formatted}%`
}

export function formatDegrees(value: number): string {
  if (!Number.isFinite(value)) {
    return '0°'
  }

  const rounded = Math.round(value)
  return rounded > 0 ? `+${rounded}°` : `${rounded}°`
}

export function toSentenceCase(value: string): string {
  if (!value) {
    return ''
  }

  const lower = value.toLowerCase()
  return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`
}

export function getPhaseAngleClass(angle: number | null | undefined): string {
  if (typeof angle !== 'number' || Number.isNaN(angle)) {
    return 'text-slate-200'
  }

  if (angle > 45) {
    return 'text-emerald-200'
  }

  if (angle < -45) {
    return 'text-rose-200'
  }

  return 'text-slate-200'
}
