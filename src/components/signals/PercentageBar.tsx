type PercentageBarProps = {
  value: number
  gradient: string
  label?: string
}

export function PercentageBar({ value, gradient, label }: PercentageBarProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
        <div className={`absolute inset-y-0 left-0 bg-gradient-to-r ${gradient}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-200">{label ?? `${value}%`}</span>
    </div>
  )
}
