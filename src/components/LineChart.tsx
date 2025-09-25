import { useId, useMemo, useState } from 'react'

type GuideLine = {
  value: number
  label: string
  color: string
}

type LineChartProps = {
  title: string
  data: Array<number | null>
  labels: string[]
  color?: string
  yDomain?: {
    min?: number
    max?: number
  }
  guideLines?: GuideLine[]
}

const DEFAULT_WIDTH = 640
const DEFAULT_HEIGHT = 260
const PADDING = 24

function buildPath(points: Array<{ x: number; y: number } | null>): string {
  let path = ''
  let isSegmentOpen = false

  points.forEach((point) => {
    if (!point) {
      isSegmentOpen = false
      return
    }

    const { x, y } = point
    if (!isSegmentOpen) {
      path += `M ${x.toFixed(2)} ${y.toFixed(2)}`
      isSegmentOpen = true
    } else {
      path += ` L ${x.toFixed(2)} ${y.toFixed(2)}`
    }
  })

  return path
}

function formatAxisLabel(label: string): string {
  return label
}

export function LineChart({
  title,
  data,
  labels,
  color = '#818cf8',
  yDomain,
  guideLines = [],
}: LineChartProps) {
  const gradientId = useId()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const chart = useMemo(() => {
    const validValues = data.filter((value): value is number => value != null)

    if (validValues.length === 0) {
      return null
    }

    const minValue =
      yDomain?.min ?? Math.min(...validValues, guideLines.length ? Math.min(...guideLines.map((line) => line.value)) : Infinity)
    const maxValue =
      yDomain?.max ?? Math.max(...validValues, guideLines.length ? Math.max(...guideLines.map((line) => line.value)) : -Infinity)

    const resolvedMin = Number.isFinite(minValue) ? minValue : Math.min(...validValues)
    const resolvedMax = Number.isFinite(maxValue) ? maxValue : Math.max(...validValues)

    const range = resolvedMax - resolvedMin || 1

    const innerWidth = DEFAULT_WIDTH - PADDING * 2
    const innerHeight = DEFAULT_HEIGHT - PADDING * 2

    const points = data.map((value, index) => {
      if (value == null) {
        return null
      }

      const x = PADDING + (innerWidth * index) / Math.max(data.length - 1, 1)
      const y = PADDING + innerHeight - ((value - resolvedMin) / range) * innerHeight

      return { x, y }
    })

    const ticks = [resolvedMin, resolvedMin + range / 2, resolvedMax].map((value) =>
      Number.isInteger(value) ? value : Number(value.toFixed(2)),
    )

    const labelIndexes = new Set<number>()
    if (labels.length > 0) {
      labelIndexes.add(0)
      labelIndexes.add(labels.length - 1)
      labelIndexes.add(Math.floor((labels.length - 1) / 2))
    }

    return {
      min: resolvedMin,
      max: resolvedMax,
      range,
      points,
      ticks,
      labelIndexes: Array.from(labelIndexes).sort((a, b) => a - b),
    }
  }, [data, labels.length, yDomain, guideLines])

  const latestValue = useMemo(() => {
    for (let index = data.length - 1; index >= 0; index -= 1) {
      const value = data[index]
      if (value != null) {
        return value
      }
    }

    return null
  }, [data])

  if (!chart) {
    return (
      <div className="flex h-full flex-col justify-center rounded-2xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-400">
        <p>No data available for this selection.</p>
      </div>
    )
  }

  const { points, ticks, labelIndexes, min, max } = chart

  return (
    <div className="flex h-full w-full flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/60 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-white">{title}</h2>
            {latestValue != null && (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-indigo-200">
                Current {latestValue.toFixed(2)}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsCollapsed((prevState) => !prevState)}
          className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-indigo-400 hover:text-white"
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? 'Expand' : 'Collapse'}
          <span aria-hidden="true">{isCollapsed ? '▾' : '▴'}</span>
        </button>
      </div>
      {!isCollapsed && (
        <svg viewBox={`0 0 ${DEFAULT_WIDTH} ${DEFAULT_HEIGHT}`} className="w-full flex-1 text-white">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
        </defs>
        <rect
          x={PADDING}
          y={PADDING}
          width={DEFAULT_WIDTH - PADDING * 2}
          height={DEFAULT_HEIGHT - PADDING * 2}
          fill={`url(#${gradientId})`}
          opacity="0.1"
        />
        {guideLines.map((line) => {
          const y =
            PADDING + (DEFAULT_HEIGHT - PADDING * 2) -
            ((line.value - min) / (max - min || 1)) * (DEFAULT_HEIGHT - PADDING * 2)
          return (
            <g key={line.label}>
              <line
                x1={PADDING}
                x2={DEFAULT_WIDTH - PADDING}
                y1={y}
                y2={y}
                stroke={line.color}
                strokeDasharray="4 4"
                strokeWidth={1}
                opacity={0.6}
              />
              <text x={DEFAULT_WIDTH - PADDING} y={y - 4} textAnchor="end" className="fill-slate-400 text-[10px]">
                {line.label}
              </text>
            </g>
          )
        })}
        <path d={buildPath(points)} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {ticks.map((value) => {
          const y =
            PADDING + (DEFAULT_HEIGHT - PADDING * 2) -
            ((value - min) / (max - min || 1)) * (DEFAULT_HEIGHT - PADDING * 2)
          return (
            <g key={`tick-${value}`}>
              <line
                x1={PADDING}
                x2={DEFAULT_WIDTH - PADDING}
                y1={y}
                y2={y}
                stroke="rgba(148, 163, 184, 0.2)"
                strokeWidth={1}
              />
              <text x={PADDING - 8} y={y + 3} textAnchor="end" className="fill-slate-500 text-[10px]">
                {value}
              </text>
            </g>
          )
        })}
        {labelIndexes.map((index) => {
          const point = points[index]
          if (!point) {
            return null
          }

          return (
            <text
              key={`label-${index}`}
              x={point.x}
              y={DEFAULT_HEIGHT - PADDING + 14}
              textAnchor="middle"
              className="fill-slate-500 text-[10px]"
            >
              {formatAxisLabel(labels[index])}
            </text>
          )
        })}
        </svg>
      )}
    </div>
  )
}
