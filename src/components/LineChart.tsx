import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

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
  tooltipLabelFormatter?: (label: string, index: number) => string
  tooltipValueFormatter?: (value: number | null, series: LineSeries, index: number) => string
}

const DEFAULT_WIDTH = 640
const DEFAULT_HEIGHT = 260
const PADDING = 24
const DEFAULT_COLOR = '#818cf8'

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

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

function formatValue(value: number): string {
  const abs = Math.abs(value)

  if (abs >= 1000) {
    return value.toFixed(0)
  }

  if (abs >= 100) {
    return value.toFixed(1)
  }

  if (abs >= 1) {
    return value.toFixed(2)
  }

  if (abs >= 0.01) {
    return value.toFixed(4)
  }

  if (abs >= 0.0001) {
    return value.toFixed(6)
  }

  return value.toExponential(2)
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
  tooltipLabelFormatter,
  tooltipValueFormatter,
}: LineChartProps) {
  const gradientId = useId()
  const sliderId = useId()
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

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

  useEffect(() => {
    if (isCollapsed) {
      setActiveIndex(null)
    }
  }, [isCollapsed])

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
      domainLength,
    }
  }, [resolvedSeries, labels, yDomain, guideLines, markers])

  const latestSeriesValues = useMemo(
    () =>
      resolvedSeries.map((entry) => {
        for (let index = entry.data.length - 1; index >= 0; index -= 1) {
          const value = entry.data[index]
          if (value != null) {
            return { name: entry.name, value, index }
          }
        }
        return { name: entry.name, value: null, index: null }
      }),
    [resolvedSeries],
  )

  const hasChart = chart != null
  const pointsBySeries = chart?.pointsBySeries ?? []
  const ticks = chart?.ticks ?? []
  const labelIndexes = chart?.labelIndexes ?? []
  const markerPoints = chart?.markerPoints ?? []
  const domainLength = chart?.domainLength ?? 1
  const min = chart?.min ?? 0
  const max = chart?.max ?? 0

  const hasSingleSeries = resolvedSeries.length === 1
  const primaryLatestValue = hasSingleSeries ? latestSeriesValues[0]?.value ?? null : null
  const gradientColor = resolvedSeries[0]?.color ?? color ?? DEFAULT_COLOR

  const getPointForIndex = useCallback(
    (index: number) => {
      for (const seriesPoints of pointsBySeries) {
        const point = seriesPoints[index]
        if (point) {
          return point
        }
      }
      return null
    },
    [pointsBySeries],
  )

  const totalPoints = pointsBySeries[0]?.length ?? 0

  const findNearestValidIndex = useCallback(
    (targetIndex: number) => {
      if (totalPoints === 0) {
        return null
      }

      const clampedIndex = clamp(Math.round(targetIndex), 0, totalPoints - 1)

      if (getPointForIndex(clampedIndex)) {
        return clampedIndex
      }

      for (let offset = 1; offset < totalPoints; offset += 1) {
        const previousIndex = clampedIndex - offset
        if (previousIndex >= 0 && getPointForIndex(previousIndex)) {
          return previousIndex
        }

        const nextIndex = clampedIndex + offset
        if (nextIndex < totalPoints && getPointForIndex(nextIndex)) {
          return nextIndex
        }
      }

      return null
    },
    [getPointForIndex, totalPoints],
  )

  const firstValidIndex = useMemo(
    () => (totalPoints > 0 ? findNearestValidIndex(0) : null),
    [findNearestValidIndex, totalPoints],
  )

  const lastValidIndex = useMemo(
    () => (totalPoints > 0 ? findNearestValidIndex(totalPoints - 1) : null),
    [findNearestValidIndex, totalPoints],
  )

  const controlIndex = activeIndex ?? lastValidIndex ?? null

  const formatTooltipValueForSeries = useCallback(
    (value: number | null, entry: LineSeries, index: number | null) => {
      if (value == null) {
        return '—'
      }

      const resolvedIndex = index ?? 0

      return tooltipValueFormatter?.(value, entry, resolvedIndex) ?? formatValue(value)
    },
    [tooltipValueFormatter],
  )

  const inspectedSingleSeriesValue =
    hasSingleSeries && activeIndex != null
      ? resolvedSeries[0]?.data[activeIndex] ?? null
      : primaryLatestValue

  const displaySeriesValues = resolvedSeries.map((entry, seriesIndex) => {
    const activeValue = activeIndex != null ? entry.data[activeIndex] ?? null : null
    const fallback = latestSeriesValues[seriesIndex]
    const value = activeValue ?? fallback?.value ?? null
    const valueIndex = activeIndex != null ? activeIndex : fallback?.index ?? null

    return {
      name: entry.name,
      color: entry.color ?? DEFAULT_COLOR,
      value,
      formattedValue: formatTooltipValueForSeries(value, entry, valueIndex),
      isActive: activeIndex != null && entry.data[activeIndex] != null,
    }
  })

  const singleSeriesValueIndex =
    hasSingleSeries && activeIndex != null
      ? activeIndex
      : latestSeriesValues[0]?.index ?? null

  const formattedSingleSeriesValue =
    inspectedSingleSeriesValue != null && hasSingleSeries
      ? formatTooltipValueForSeries(
          inspectedSingleSeriesValue,
          resolvedSeries[0]!,
          singleSeriesValueIndex,
        )
      : null

  const activePoint = activeIndex != null ? getPointForIndex(activeIndex) : null
  const tooltipLabel =
    activeIndex != null
      ? tooltipLabelFormatter
        ? tooltipLabelFormatter(labels[activeIndex] ?? '', activeIndex)
        : formatAxisLabel(labels[activeIndex] ?? `#${activeIndex + 1}`)
      : null

  const tooltipSeriesEntries =
    activeIndex != null
      ? resolvedSeries.map((entry) => {
          const rawValue = entry.data[activeIndex] ?? null
          return {
            name: entry.name,
            color: entry.color ?? DEFAULT_COLOR,
            formattedValue: formatTooltipValueForSeries(rawValue, entry, activeIndex),
            rawValue,
          }
        })
      : []

  const tooltipPosition = useMemo(() => {
    if (!activePoint) {
      return null
    }

    const leftPercent = (activePoint.x / DEFAULT_WIDTH) * 100
    const topPercent = (activePoint.y / DEFAULT_HEIGHT) * 100

    return {
      leftPercent: clamp(leftPercent, 8, 92),
      topPercent: clamp(topPercent, 18, 82),
    }
  }, [activePoint])

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (!svgRef.current || totalPoints === 0) {
        return
      }

      const rect = svgRef.current.getBoundingClientRect()
      const innerWidth = DEFAULT_WIDTH - PADDING * 2
      const relativeX = event.clientX - rect.left - PADDING
      const clampedX = clamp(relativeX, 0, innerWidth)
      const approximateIndex = (clampedX / innerWidth) * domainLength
      const nearestIndex = findNearestValidIndex(approximateIndex)

      if (nearestIndex != null) {
        setActiveIndex(nearestIndex)
      }
    },
    [domainLength, findNearestValidIndex, totalPoints],
  )

  const handlePointerLeave = useCallback(() => {
    setActiveIndex(null)
  }, [])

  const handleStep = useCallback(
    (direction: -1 | 1) => {
      if (lastValidIndex == null) {
        return
      }

      const baseIndex = controlIndex ?? lastValidIndex
      const nextIndex = findNearestValidIndex(baseIndex + direction)

      if (nextIndex != null && nextIndex !== baseIndex) {
        setActiveIndex(nextIndex)
      }
    },
    [controlIndex, findNearestValidIndex, lastValidIndex],
  )

  const handleSliderChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextIndex = Number(event.target.value)
      const resolvedIndex = findNearestValidIndex(nextIndex)

      if (resolvedIndex != null) {
        setActiveIndex(resolvedIndex)
      }
    },
    [findNearestValidIndex],
  )

  const canStepBackward =
    controlIndex != null && firstValidIndex != null && controlIndex > firstValidIndex
  const canStepForward =
    controlIndex != null && lastValidIndex != null && controlIndex < lastValidIndex
  const showControls = !isCollapsed && totalPoints > 0
  const sliderMin = firstValidIndex ?? 0
  const sliderMax = lastValidIndex ?? 0
  const sliderValue = controlIndex ?? sliderMax ?? 0
  const sliderValueLabel =
    controlIndex != null
      ? tooltipLabelFormatter
        ? tooltipLabelFormatter(labels[controlIndex] ?? '', controlIndex)
        : formatAxisLabel(labels[controlIndex] ?? `#${controlIndex + 1}`)
      : null

  if (!hasChart) {
    return (
      <div className="flex h-full flex-col justify-center rounded-2xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-400">
        <p>No data available for this selection.</p>
      </div>
    )
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
            {hasSingleSeries && formattedSingleSeriesValue != null && (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-indigo-200">
                {activeIndex != null ? 'Selected' : 'Current'} {formattedSingleSeriesValue}
              </span>
            )}
          </div>
          {!hasSingleSeries && (
            <div className="flex flex-wrap gap-2">
              {displaySeriesValues.map(({ name, color: seriesColor, formattedValue, isActive }, index) => {
                return (
                  <span
                    key={`${name}-${index}`}
                    className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold"
                    style={{
                      borderColor: seriesColor,
                      color: seriesColor,
                      backgroundColor: `${seriesColor}1a`,
                      boxShadow: isActive ? `0 0 0 2px ${seriesColor}33` : undefined,
                    }}
                    aria-current={isActive ? 'true' : undefined}
                  >
                    <span>{name}</span>
                    <span>{formattedValue}</span>
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
      {showControls && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] uppercase tracking-wide text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Inspect</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleStep(-1)}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-semibold text-slate-200 transition hover:border-indigo-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!canStepBackward}
                aria-label="Inspect previous data point"
              >
                ◀
              </button>
              <button
                type="button"
                onClick={() => handleStep(1)}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-semibold text-slate-200 transition hover:border-indigo-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!canStepForward}
                aria-label="Inspect next data point"
              >
                ▶
              </button>
            </div>
          </div>
          {sliderValueLabel && (
            <span className="text-xs font-medium normal-case text-slate-300">{sliderValueLabel}</span>
          )}
        </div>
      )}
      {showControls &&
        firstValidIndex != null &&
        lastValidIndex != null &&
        lastValidIndex > firstValidIndex && (
          <div className="sr-only">
            <label htmlFor={sliderId}>Inspect chart data point</label>
            <input
              id={sliderId}
              type="range"
              min={sliderMin}
              max={sliderMax}
              value={sliderValue}
              onChange={handleSliderChange}
              step={1}
              aria-valuemin={sliderMin}
              aria-valuemax={sliderMax}
              aria-valuenow={sliderValue}
              aria-valuetext={sliderValueLabel ?? undefined}
            />
          </div>
        )}
      {!isCollapsed && (
        <svg
          ref={svgRef}
          viewBox={`0 0 ${DEFAULT_WIDTH} ${DEFAULT_HEIGHT}`}
          className="w-full flex-1 cursor-crosshair text-white"
          aria-hidden={isLoading}
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerMove}
          onPointerLeave={handlePointerLeave}
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
          {activePoint && (
            <g pointerEvents="none">
              <line
                x1={activePoint.x}
                x2={activePoint.x}
                y1={PADDING}
                y2={DEFAULT_HEIGHT - PADDING}
                stroke="rgba(129, 140, 248, 0.7)"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r={3.5}
                fill="#6366f1"
                stroke="#c7d2fe"
                strokeWidth={1}
              />
            </g>
          )}
          {ticks.map((value, tickIndex) => {
            const y =
              PADDING + (DEFAULT_HEIGHT - PADDING * 2) -
              ((value - min) / (max - min || 1)) * (DEFAULT_HEIGHT - PADDING * 2)
            return (
              <g key={`tick-${tickIndex}-${value}`}>
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
            const isActiveLabel = activeIndex === index

            return (
              <text
                key={`label-${index}`}
                x={point.x}
                y={DEFAULT_HEIGHT - PADDING + 14}
                textAnchor="middle"
                className={`text-[10px] ${isActiveLabel ? 'fill-indigo-200 font-semibold' : 'fill-slate-500'}`}
              >
                {formatAxisLabel(labels[index] ?? '')}
              </text>
            )
          })}
        </svg>
      )}
      {!isCollapsed &&
        activePoint &&
        tooltipPosition &&
        tooltipSeriesEntries.length > 0 &&
        tooltipLabel && (
          <div
            className="pointer-events-none absolute z-20 flex w-52 flex-col gap-2 rounded-2xl border border-indigo-400/40 bg-slate-950/90 p-3 text-xs text-slate-200 shadow-xl"
            style={{
              left: `${tooltipPosition.leftPercent}%`,
              top: `${tooltipPosition.topPercent}%`,
              transform: 'translate(-50%, -110%)',
            }}
            role="status"
            aria-live="polite"
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-200">{tooltipLabel}</span>
            <ul className="flex flex-col gap-1">
              {tooltipSeriesEntries.map((entry) => (
                <li key={entry.name} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    ></span>
                    <span>{entry.name}</span>
                  </span>
                  <span className="font-mono text-[11px] text-slate-100">{entry.formattedValue}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
    </div>
  )
}
