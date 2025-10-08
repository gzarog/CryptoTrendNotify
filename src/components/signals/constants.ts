import type { TimeframeSignalSnapshot } from '../../types/signals'

export const STAGE_LABEL: Record<TimeframeSignalSnapshot['stage'], string> = {
  ready: 'Ready',
  cooldown: 'Cooldown',
  gated: 'Gated',
  triggered: 'Triggered',
}

export const STAGE_BADGE_CLASS: Record<TimeframeSignalSnapshot['stage'], string> = {
  ready: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
  cooldown: 'border-amber-400/40 bg-amber-500/10 text-amber-200',
  gated: 'border-slate-400/40 bg-slate-500/10 text-slate-200',
  triggered: 'border-sky-400/40 bg-sky-500/10 text-sky-200',
}

export const DIRECTION_BADGE_CLASS: Record<string, string> = {
  bullish: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
  bearish: 'border-rose-400/40 bg-rose-500/10 text-rose-200',
  neutral: 'border-slate-400/40 bg-slate-500/10 text-slate-200',
}

export const STRENGTH_BADGE_CLASS: Record<string, string> = {
  weak: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100',
  medium: 'border-amber-400/30 bg-amber-500/10 text-amber-100',
  strong: 'border-orange-400/30 bg-orange-500/10 text-orange-100',
}

export const COMBINED_STRENGTH_GRADIENT: Record<string, string> = {
  bullish: 'from-emerald-400 to-emerald-500',
  bearish: 'from-rose-400 to-rose-500',
  neutral: 'from-slate-500 to-slate-400',
}

export const BIAS_STATUS_CLASS: Record<string, string> = {
  bullish: 'border-emerald-400/40 bg-emerald-500/5 text-emerald-200',
  bearish: 'border-rose-400/40 bg-rose-500/5 text-rose-200',
  neutral: 'border-slate-400/30 bg-slate-800/40 text-slate-200',
}

export const DISABLED_CARD_CLASS = 'border-white/5 bg-slate-900/30 text-slate-500'
export const DISABLED_BADGE_CLASS = 'border-slate-600/40 bg-slate-800/40 text-slate-400'
