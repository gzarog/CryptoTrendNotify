import { useQuery, useQueries } from '@tanstack/react-query'
import type { Candle, BybitKlineResponse } from '../types/app'

const DEFAULT_BAR_LIMIT = 200
const MAX_BAR_LIMIT = 5000
const BYBIT_REQUEST_LIMIT = 200

async function fetchBybitOHLCV(symbol: string, interval: string, limit: number): Promise<Candle[]> {
    const sanitizedLimit = Math.min(Math.max(Math.floor(limit), 1), MAX_BAR_LIMIT)
    const collected: Candle[] = []
    let nextEndTime: number | undefined

    while (collected.length < sanitizedLimit) {
        const url = new URL('https://api.bybit.com/v5/market/kline')
        url.searchParams.set('category', 'linear')
        url.searchParams.set('symbol', symbol)
        url.searchParams.set('interval', interval)

        const batchLimit = Math.min(sanitizedLimit - collected.length, BYBIT_REQUEST_LIMIT)
        url.searchParams.set('limit', batchLimit.toString())

        if (nextEndTime !== undefined) {
            url.searchParams.set('end', nextEndTime.toString())
        }

        const response = await fetch(url.toString(), {
            headers: {
                Accept: 'application/json',
            },
        })

        if (!response.ok) {
            throw new Error(`Unable to load data (status ${response.status})`)
        }

        const payload = (await response.json()) as BybitKlineResponse

        if (payload.retCode !== 0 || !payload.result?.list) {
            throw new Error(payload.retMsg || 'Bybit API returned an error')
        }

        const candles = payload.result.list.map((entry) => ({
            openTime: Number(entry[0]),
            open: Number(entry[1]),
            high: Number(entry[2]),
            low: Number(entry[3]),
            close: Number(entry[4]),
            volume: Number(entry[5]),
            turnover: Number(entry[6] ?? 0),
            closeTime: Number(entry[0]) + 1,
        }))

        if (candles.length === 0) {
            break
        }

        collected.push(...candles)

        if (candles.length < batchLimit) {
            break
        }

        const oldestCandle = candles.reduce((oldest, candle) =>
            candle.openTime < oldest.openTime ? candle : oldest,
            candles[0])

        nextEndTime = oldestCandle.openTime - 1
    }

    const deduped = Array.from(
        collected
            .reduce((acc, candle) => acc.set(candle.openTime, candle), new Map<number, Candle>())
            .values(),
    )

    return deduped.sort((a, b) => a.openTime - b.openTime).slice(-sanitizedLimit)
}

export function useMarketData(
    symbol: string,
    timeframe: string,
    barLimit: number,
    refreshInterval: number | false,
    enabled: boolean
) {
    const normalizedSymbol = symbol.trim().toUpperCase()

    return useQuery<Candle[]>({
        queryKey: ['bybit-kline', normalizedSymbol, timeframe, barLimit],
        queryFn: () => fetchBybitOHLCV(normalizedSymbol, timeframe, barLimit),
        refetchInterval: refreshInterval,
        refetchIntervalInBackground: true,
        retry: 1,
        enabled,
        placeholderData: (previousData) => previousData,
    })
}

export function useMultiFrameMarketData(
    symbol: string,
    timeframes: string[],
    barLimit: number,
    refreshInterval: number | false,
    enabled: boolean
) {
    const normalizedSymbol = symbol.trim().toUpperCase()

    return useQueries({
        queries: timeframes.map((value) => ({
            queryKey: ['bybit-kline', normalizedSymbol, value, barLimit],
            queryFn: () => fetchBybitOHLCV(normalizedSymbol, value, barLimit),
            refetchInterval: refreshInterval,
            refetchIntervalInBackground: true,
            retry: 1,
            enabled,
            placeholderData: (previousData: Candle[] | undefined) => previousData,
        })),
    })
}
