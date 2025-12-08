
import { useQuery } from '@tanstack/react-query'
import { fetchHeatmapResults } from '../lib/heatmap'
import type { HeatmapResult } from '../types/heatmap'

export function useHeatmapData(
    symbol: string,
    barLimit: number,
    refreshInterval: number | false,
    enabled: boolean
) {
    return useQuery<HeatmapResult[], Error>({
        queryKey: ['heatmap', symbol, barLimit],
        queryFn: () => fetchHeatmapResults(symbol, barLimit),
        refetchInterval: refreshInterval,
        enabled,
        staleTime: refreshInterval ? refreshInterval / 2 : 30000,
    })
}
