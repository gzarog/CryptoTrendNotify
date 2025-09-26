import { useId, useMemo, useState } from 'react'

type GuideLine = {
  value: number
  label: string
  color: string
}

type LineSeries = {
  name: string
  data: Array<number | null>
  color: string
}

type Marker = {
  index: number
  value: number
  color?: string
  label?: string
}

type MarkerWithCoordinates = Marker & { x: number; y: number }

type LineChartProps = {
  title: string
  labels: string[]
  data?: Array<number | null>
  series?: LineSeries[]
  color?: string
  yDomain?: {
    min?: number
    max?: number
  }
  guideLines?: GuideLine[]
  markers?: Marker[]
  isLoading?: boolean
}

const DEFAULT_WIDTH = 640
const DEFAULT_HEIGHT = 260
const PADDING = 24
const DEFAULT_COLOR = '#818cf8'

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
  series,
  labels,
  color = DEFAULT_COLOR,
  yDomain,
  guideLines = [],
  markers = [],
  isLoading = false,
}: LineChartProps) {
  const gradientId = useId()
  const [isCollapsed, setIsCollapsed] = useState(false)

  const resolvedSeries = useMemo(() => {
    if (series && series.length > 0) {
      return series
    }

    if (data) {
      return [
        {
          name: title,
          data,
          color: color ?? DEFAULT_COLOR,
        },
      ]
    }

    return []
  }, [series, data, color, title])

  const chart = useMemo(() => {
    if (resolvedSeries.length === 0) {
      return null
    }

    const allValues = resolvedSeries.flatMap((entry) =>
      entry.data.filter((value): value is number => value != null),
    )

    if (allValues.length === 0) {
      return null
    }

    const guideValues = guideLines.map((line) => line.value)
    const dataMin = Math.min(...allValues)
    const dataMax = Math.max(...allValues)
    const guideMin = guideValues.length ? Math.min(...guideValues) : dataMin
    const guideMax = guideValues.length ? Math.max(...guideValues) : dataMax

    const minValue = yDomain?.min ?? Math.min(dataMin, guideMin)
    const maxValue = yDomain?.max ?? Math.max(dataMax, guideMax)

    const resolvedMin = Number.isFinite(minValue) ? minValue : dataMin
    const resolvedMax = Number.isFinite(maxValue) ? maxValue : dataMax
    const range = resolvedMax - resolvedMin || 1

    const innerWidth = DEFAULT_WIDTH - PADDING * 2
    const innerHeight = DEFAULT_HEIGHT - PADDING * 2

    const labelsLength = labels.length
    const fallbackLength = resolvedSeries[0]?.data.length ?? 0
    const domainLength = Math.max((labelsLength || fallbackLength) - 1, 1)

    const pointsBySeries = resolvedSeries.map((entry) =>
      entry.data.map((value, index) => {
        if (value == null) {
          return null
        }

        const x = PADDING + (innerWidth * index) / domainLength
        const y = PADDING + innerHeight - ((value - resolvedMin) / range) * innerHeight

        return { x, y }
      }),
    )

    const ticks = [resolvedMin, resolvedMin + range / 2, resolvedMax].map((value) =>
      Number.isInteger(value) ? value : Number(value.toFixed(2)),
    )

    const labelIndexes = new Set<number>()
    if (labelsLength > 0) {
      labelIndexes.add(0)
      labelIndexes.add(labelsLength - 1)
      labelIndexes.add(Math.floor((labelsLength - 1) / 2))
    }

    const markerPoints: MarkerWithCoordinates[] = markers
      .map((marker) => {
        const { index, value } = marker

        if (!Number.isFinite(index) || !Number.isFinite(value)) {
          return null
        }

        const x = PADDING + (innerWidth * index) / domainLength
        const y =
          PADDING + innerHeight - ((value - resolvedMin) / range) * innerHeight

        return { ...marker, x, y }
      })
      .filter((entry): entry is MarkerWithCoordinates => Boolean(entry))

    return {
      min: resolvedMin,
      max: resolvedMax,
      pointsBySeries,
      ticks,
      labelIndexes: Array.from(labelIndexes).sort((a, b) => a - b),
      markerPoints,
    }
  }, [resolvedSeries, labels, yDomain, guideLines, markers])

  const latestSeriesValues = useMemo(
    () =>
      resolvedSeries.map((entry) => {
        for (let index = entry.data.length - 1; index >= 0; index -= 1) {
          const value = entry.data[index]
          if (value != null) {
            return { name: entry.name, value }
          }
        }
        return { name: entry.name, value: null }
      }),
    [resolvedSeries],
  )

  if (!chart) {
    return (
      <div className="flex h-full flex-col justify-center rounded-2xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-400">
        <p>No data available for this selection.</p>
      </div>
    )
  }

  const hasSingleSeries = resolvedSeries.length === 1
  const primaryLatestValue = hasSingleSeries ? latestSeriesValues[0]?.value ?? null : null
  const gradientColor = resolvedSeries[0]?.color ?? color ?? DEFAULT_COLOR
  const { pointsBySeries, ticks, labelIndexes, min, max, markerPoints } = chart

  const getPointForIndex = (index: number) => {
    for (const seriesPoints of pointsBySeries) {
      const point = seriesPoints[index]
      if (point) {
        return point
      }
    }
    return null
  }

  return (
    <div
      className="relative flex h-full w-full flex-col gap-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 p-6"
      aria-busy={isLoading}
    >
      {isLoading && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl bg-slate-950/80 text-indigo-100 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <span className="text-4xl" role="img" aria-hidden="true">
            ⌛
          </span>
          <p className="text-sm font-semibold">Reloading chart data…</p>
        </div>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-white">{title}</h2>
            {hasSingleSeries && primaryLatestValue != null && (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-indigo-200">
                Current {primaryLatestValue.toFixed(2)}
              </span>
            )}
          </div>
          {!hasSingleSeries && (
            <div className="flex flex-wrap gap-2">
              {latestSeriesValues.map(({ name, value }, index) => {
                const seriesColor = resolvedSeries[index]?.color ?? DEFAULT_COLOR
                return (
                  <span
                    key={`${name}-${index}`}
                    className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold"
                    style={{
                      borderColor: seriesColor,
                      color: seriesColor,
                      backgroundColor: `${seriesColor}1a`,
                    }}
                  >
                    <span>{name}</span>
                    <span>{value != null ? value.toFixed(2) : '—'}</span>
                  </span>
                )
              })}
            </div>
          )}
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
        <svg
          viewBox={`0 0 ${DEFAULT_WIDTH} ${DEFAULT_HEIGHT}`}
          className="w-full flex-1 text-white"
          aria-hidden={isLoading}
        >
          {hasSingleSeries && (
            <>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={gradientColor} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={gradientColor} stopOpacity="0" />
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
            </>
          )}
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
          {pointsBySeries.map((points, index) => (
            <path
              key={`series-${index}`}
              d={buildPath(points)}
              fill="none"
              stroke={resolvedSeries[index]?.color ?? DEFAULT_COLOR}
              strokeWidth={0.625}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {markerPoints.map((marker, index) => (
            <g key={`marker-${index}-${marker.index}`}>
              <text
                x={marker.x}
                y={marker.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={12}
                fill={marker.color ?? '#f97316'}
              >
                ✕
                {marker.label ? <title>{marker.label}</title> : null}
              </text>
            </g>
          ))}
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
            const point = getPointForIndex(index)
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
                {formatAxisLabel(labels[index] ?? '')}
              </text>
            )
          })}
        </svg>
      )}
    </div>
  )
}
