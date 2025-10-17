import { Card as TremorCard, Flex, Metric, Text, Title, BadgeDelta, Switch } from '@tremor/react'

type DashboardMetricsProps = {
  lastUpdatedLabel: string
  refreshLabel: string
  resolvedBarLimit: number
  latestCandle?: { close: number } | null
  priceChange: { difference: number; percent: number } | null
  collapsed: boolean
  onToggle: () => void
}

function formatPrice(price: number | null | undefined) {
  if (!Number.isFinite(price)) {
    return '—'
  }
  return Number(price).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 5,
  })
}

function getDeltaType(change: DashboardMetricsProps['priceChange']): 'increase' | 'moderateIncrease' | 'moderateDecrease' | 'decrease' | 'unchanged' {
  if (!change) {
    return 'unchanged'
  }

  if (change.percent >= 5) return 'increase'
  if (change.percent > 0) return 'moderateIncrease'
  if (change.percent <= -5) return 'decrease'
  if (change.percent < 0) return 'moderateDecrease'
  return 'unchanged'
}

export function DashboardMetrics({
  lastUpdatedLabel,
  refreshLabel,
  resolvedBarLimit,
  latestCandle,
  priceChange,
  collapsed,
  onToggle,
}: DashboardMetricsProps) {
  const deltaType = getDeltaType(priceChange)

  return (
    <TremorCard decoration="top" decorationColor="indigo" className="rounded-3xl border border-white/10 bg-slate-950/60">
      <div className="space-y-6">
        <Flex className="items-center justify-between gap-4">
          <div>
            <Title className="text-white">Market snapshot</Title>
            <Text className="text-xs text-slate-400">Applied across all charts</Text>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Text className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              {collapsed ? 'Show' : 'Hide'}
            </Text>
            <Switch
              aria-label={collapsed ? 'Show market snapshot' : 'Hide market snapshot'}
              checked={!collapsed}
              onChange={() => onToggle()}
              className="data-[state=checked]:bg-indigo-500"
            />
          </div>
        </Flex>
        {!collapsed && (
          <div className="grid gap-6 text-sm sm:grid-cols-2">
            <div className="space-y-2">
              <Text className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Last auto refresh
              </Text>
              <Metric className="text-white">{lastUpdatedLabel}</Metric>
              <Text className="text-xs text-slate-400">{refreshLabel}</Text>
            </div>
            <div className="space-y-2">
              <Text className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Data window
              </Text>
              <Metric className="text-white">Last {resolvedBarLimit} bars</Metric>
              <Text className="text-xs text-slate-400">Refresh applies to RSI and Stochastic RSI panels</Text>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Text className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Last close</Text>
              <Flex className="items-center gap-3">
                <Metric className="text-white">{formatPrice(latestCandle?.close ?? null)}</Metric>
                {priceChange ? (
                  <BadgeDelta
                    deltaType={deltaType}
                    className="rounded-full border border-white/10 bg-slate-900/70 px-3 py-1 text-xs font-semibold text-white"
                  >
                    {`${priceChange.difference >= 0 ? '+' : ''}${priceChange.difference.toFixed(5)} (${priceChange.percent.toFixed(2)}%)`}
                  </BadgeDelta>
                ) : (
                  <Text className="text-xs text-slate-500">Waiting for additional price data…</Text>
                )}
              </Flex>
            </div>
          </div>
        )}
      </div>
    </TremorCard>
  )
}
