import { useState } from 'react'
import type { QuantumFlipThreshold } from '../../lib/quantum'
import { Badge } from './Badge'
import { PercentageBar } from './PercentageBar'
import { Skeleton } from '../skeletons'
import {
  BIAS_GRADIENT,
  DIRECTIONAL_BADGE_CLASS,
  FLIP_BIAS_LABELS,
  FLIP_BIAS_TEXT_CLASS,
  FLIP_SIGNAL_BADGE_CLASS,
  FLIP_SIGNAL_CATEGORY,
  FLIP_ZONE_BADGE_CLASS,
  FLIP_ZONE_LABELS,
  formatDegrees,
  formatSignedPercent,
  getPhaseAngleClass,
  toSentenceCase,
} from './quantumFlipThresholdShared'

function formatProbability(probability: number): string {
  if (!Number.isFinite(probability)) {
    return '0%'
  }

  return `${Math.round(probability * 1000) / 10}%`
}

type QuantumFlipThresholdCardProps = {
  threshold: QuantumFlipThreshold | null
  isLoading: boolean
}

export function QuantumFlipThresholdCard({ threshold, isLoading }: QuantumFlipThresholdCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const signalCategory = threshold ? FLIP_SIGNAL_CATEGORY[threshold.signal] : 'neutral'
  const zoneLabel = threshold ? FLIP_ZONE_LABELS[threshold.state] : FLIP_ZONE_LABELS.BASE
  const zoneBadgeClass = threshold ? FLIP_ZONE_BADGE_CLASS[threshold.state] : FLIP_ZONE_BADGE_CLASS.BASE
  const biasLabel = threshold ? FLIP_BIAS_LABELS[threshold.bias] : FLIP_BIAS_LABELS.NEUTRAL
  const biasBadgeClass = threshold ? DIRECTIONAL_BADGE_CLASS[threshold.bias] : DIRECTIONAL_BADGE_CLASS.NEUTRAL
  const biasTextClass = threshold ? FLIP_BIAS_TEXT_CLASS[threshold.bias] : FLIP_BIAS_TEXT_CLASS.NEUTRAL
  const signalLabel = threshold ? toSentenceCase(threshold.signal) : 'Pending signal'
  const signalBadgeClass = FLIP_SIGNAL_BADGE_CLASS[signalCategory]
  const phaseAngleLabel = formatDegrees(threshold?.phaseAngle ?? 0)
  const phaseAngleClass = getPhaseAngleClass(threshold?.phaseAngle)
  const biasStrengthPercentValue = threshold ? Math.round(threshold.biasStrength * 1000) / 10 : 0
  const compositePercent = threshold ? Math.round(threshold.compositeBias * 1000) / 10 : 0
  const markovTiltPercent = threshold ? Math.round(threshold.diagnostics.markovProjection * 1000) / 10 : 0
  const quantumTiltPercent = threshold ? Math.round(threshold.diagnostics.quantumProjection * 1000) / 10 : 0
  const phaseProjectionPercent = threshold ? Math.round(threshold.diagnostics.phaseProjection * 1000) / 10 : 0
  const downVsReversalPercent = threshold ? Math.round(threshold.diagnostics.shortEdge * 10) / 10 : 0
  const baseProbabilityLabel = threshold ? formatProbability(threshold.diagnostics.P_base) : '0%'
  const compositeLabel = formatSignedPercent(compositePercent)
  const markovTiltLabel = formatSignedPercent(markovTiltPercent)
  const quantumTiltLabel = formatSignedPercent(quantumTiltPercent)
  const phaseProjectionLabel = formatSignedPercent(phaseProjectionPercent)
  const downVsReversalLabel = formatSignedPercent(downVsReversalPercent)
  const downVsReversalClass = downVsReversalPercent > 0
    ? 'text-rose-200'
    : downVsReversalPercent < 0
      ? 'text-emerald-200'
      : 'text-slate-200'
  const markovTiltClass = markovTiltPercent > 0 ? 'text-emerald-200' : markovTiltPercent < 0 ? 'text-rose-200' : 'text-slate-200'
  const quantumTiltClass = quantumTiltPercent > 0 ? 'text-emerald-200' : quantumTiltPercent < 0 ? 'text-rose-200' : 'text-slate-200'

  return (
    <article className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-lg">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Quantum–Markov flip threshold
          </span>
          <span className="text-sm text-slate-300">
            Confluence gating between Markov priors and quantum interference
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsCollapsed((previous) => !previous)}
          className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200 transition hover:border-white/20 hover:text-white"
        >
          {isCollapsed ? 'Expand details' : 'Collapse details'}
        </button>
      </header>

      {isLoading && !threshold && (
        <div className="flex flex-col gap-3" role="status" aria-live="polite">
          <Skeleton className="h-4 w-48 rounded-md" />
          <Skeleton className="h-3 w-32 rounded-md" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      )}

      {!isLoading && !threshold && (
        <p className="text-sm text-slate-400">
          Quantum module requires additional indicator coverage before the flip threshold can be derived.
        </p>
      )}

      {threshold && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={zoneBadgeClass}>{zoneLabel}</Badge>
            <Badge className={biasBadgeClass}>{biasLabel}</Badge>
            <Badge className={signalBadgeClass}>{signalLabel}</Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Signal call</span>
              <span className={`text-sm font-semibold ${biasTextClass}`}>{signalLabel}</span>
            </div>
            <div className="flex flex-col gap-1 text-right">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Bias</span>
              <span className="text-sm font-semibold text-slate-200">{biasLabel}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <div className="flex items-center gap-2">
              <span className="font-semibold uppercase tracking-wide">Phase angle</span>
              <span className={`text-sm font-semibold ${phaseAngleClass}`}>{phaseAngleLabel}</span>
            </div>
            <span>Needs ±45° trigger.</span>
          </div>

          {!isCollapsed && (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Composite conviction</span>
                <PercentageBar
                  gradient={BIAS_GRADIENT[threshold.bias]}
                  value={biasStrengthPercentValue}
                  label={formatProbability(threshold.biasStrength)}
                />
              </div>

              <p className="text-xs text-slate-300">
                Weighted bias {compositeLabel} (Markov {markovTiltLabel}, Quantum {quantumTiltLabel}, Phase {phaseProjectionLabel}).
              </p>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-1 rounded-xl bg-slate-900/60 p-3">
                  <span className="text-[11px] uppercase tracking-wide text-slate-400">Down vs reversal spread</span>
                  <span className={`text-sm font-semibold ${downVsReversalClass}`}>{downVsReversalLabel}</span>
                  <span className="text-[11px] text-slate-400">Bearish trigger above +5%.</span>
                </div>
                <div className="flex flex-col gap-1 rounded-xl bg-slate-900/60 p-3">
                  <span className="text-[11px] uppercase tracking-wide text-slate-400">Base probability</span>
                  <span className="text-sm font-semibold text-white">{baseProbabilityLabel}</span>
                  <span className="text-[11px] text-slate-400">Comparing against down & reversal.</span>
                </div>
                <div className="flex flex-col gap-1 rounded-xl bg-slate-900/60 p-3">
                  <span className="text-[11px] uppercase tracking-wide text-slate-400">Markov tilt</span>
                  <span className={`text-sm font-semibold ${markovTiltClass}`}>{markovTiltLabel}</span>
                  <span className="text-[11px] text-slate-400">Up minus down prior.</span>
                </div>
                <div className="flex flex-col gap-1 rounded-xl bg-slate-900/60 p-3">
                  <span className="text-[11px] uppercase tracking-wide text-slate-400">Quantum tilt</span>
                  <span className={`text-sm font-semibold ${quantumTiltClass}`}>{quantumTiltLabel}</span>
                  <span className="text-[11px] text-slate-400">Interference walk bias.</span>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </article>
  )
}
