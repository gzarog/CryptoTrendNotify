
import { useEffect, useState, useCallback, useMemo } from 'react'
import {
    checkPushServerConnection,
    ensurePushSubscription,
    isNotificationSupported,
    requestNotificationPermission,
    type PushSubscriptionFilters,
} from '../lib/notifications'

export function usePushNotifications(
    symbol: string,
    momentumTimeframes: string[],
    movingAverageTimeframes: string[],
    movingAveragePairs: string[]
) {
    const supportsNotifications = isNotificationSupported()
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() =>
        supportsNotifications ? Notification.permission : 'denied',
    )
    const [pushServerConnected, setPushServerConnected] = useState<boolean | null>(null)

    const normalizedSymbol = symbol.trim().toUpperCase()
    const canSubscribe = normalizedSymbol.length > 0

    const subscriptionFilters = useMemo<PushSubscriptionFilters | undefined>(() => {
        if (!canSubscribe) {
            return undefined
        }

        return {
            symbols: [normalizedSymbol],
            momentumTimeframes: [...momentumTimeframes],
            movingAverageTimeframes: [...movingAverageTimeframes],
            movingAveragePairs: [...movingAveragePairs],
        }
    }, [canSubscribe, normalizedSymbol, momentumTimeframes, movingAverageTimeframes, movingAveragePairs])

    const fetchPushServerStatus = useCallback(async () => checkPushServerConnection(), [])

    const updatePushServerStatus = useCallback(async () => {
        const connected = await fetchPushServerStatus()
        setPushServerConnected(connected)
        return connected
    }, [fetchPushServerStatus])

    useEffect(() => {
        if (!supportsNotifications) {
            setNotificationPermission('denied')
            return
        }
        setNotificationPermission(Notification.permission)
    }, [supportsNotifications])

    const pushNotificationsEnabled = supportsNotifications && notificationPermission === 'granted'

    useEffect(() => {
        let cancelled = false
        const checkStatus = async () => {
            const connected = await fetchPushServerStatus()
            if (!cancelled) setPushServerConnected(connected)
        }
        void checkStatus()
        return () => { cancelled = true }
    }, [fetchPushServerStatus])

    useEffect(() => {
        if (!pushNotificationsEnabled) return

        let cancelled = false
        const initializeSubscription = async () => {
            const subscriptionEstablished = await ensurePushSubscription(subscriptionFilters)
            if (cancelled) return

            setPushServerConnected(subscriptionEstablished)
            if (subscriptionEstablished) {
                await updatePushServerStatus()
            }
        }

        void initializeSubscription()
        return () => { cancelled = true }
    }, [pushNotificationsEnabled, subscriptionFilters, updatePushServerStatus])

    const requestPermission = async () => {
        if (!supportsNotifications) return
        const permission = await requestNotificationPermission()
        setNotificationPermission(permission)
        return permission
    }

    return {
        supportsNotifications,
        notificationPermission,
        pushServerConnected,
        requestPermission,
        pushNotificationsEnabled
    }
}
