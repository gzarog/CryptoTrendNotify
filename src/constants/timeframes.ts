export type TimeframeOption = {
  value: string
  label: string
}

export const TIMEFRAMES: TimeframeOption[] = [
  { value: '5', label: '5m' },
  { value: '15', label: '15m' },
  { value: '30', label: '30m' },
  { value: '60', label: '60m' },
  { value: '120', label: '120m' },
  { value: '240', label: '240m (4h)' },
  { value: '360', label: '360m (6h)' },
]
