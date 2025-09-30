import webpush from 'web-push'

export function normalizeNotificationPayload(input) {
  if (!input || typeof input !== 'object') {
    return null
  }

  if (typeof input.title !== 'string' || typeof input.body !== 'string') {
    return null
  }

  const output = {
    title: input.title,
    body: input.body,
  }

  if (typeof input.tag === 'string') {
    output.tag = input.tag
  }

  if (typeof input.icon === 'string') {
    output.icon = input.icon
  }

  if (typeof input.badge === 'string') {
    output.badge = input.badge
  }

  if (typeof input.renotify === 'boolean') {
    output.renotify = input.renotify
  }

  if (input.data !== undefined) {
    output.data = input.data
  }

  return output
}

function shouldDeliverToSubscription(notification, filters) {
  if (!filters) {
    return true
  }

  const data = notification?.data

  if (!data || typeof data !== 'object') {
    return true
  }

  if (filters.symbols && filters.symbols.length > 0) {
    const symbol = typeof data.symbol === 'string' ? data.symbol.toUpperCase() : null
    if (!symbol || !filters.symbols.includes(symbol)) {
      return false
    }
  }

  const type = data.type

  if (type === 'momentum') {
    if (filters.momentumTimeframes && filters.momentumTimeframes.length > 0) {
      const timeframes = Array.isArray(data.timeframes)
        ? data.timeframes.map((value) => String(value))
        : null

      if (
        timeframes &&
        !timeframes.some((value) => filters.momentumTimeframes.includes(value))
      ) {
        return false
      }
    }
  } else if (type === 'moving-average') {
    if (filters.movingAverageTimeframes && filters.movingAverageTimeframes.length > 0) {
      const timeframe = data.timeframe ? String(data.timeframe) : null

      if (timeframe && !filters.movingAverageTimeframes.includes(timeframe)) {
        return false
      }
    }

    if (filters.movingAveragePairs && filters.movingAveragePairs.length > 0) {
      const pair = typeof data.pair === 'string' ? data.pair : null

      if (pair && !filters.movingAveragePairs.includes(pair)) {
        return false
      }
    }
  }

  return true
}

export async function broadcastNotification(store, notification) {
  const subscriptions = store.list()

  if (subscriptions.length === 0) {
    return { delivered: 0, stale: 0 }
  }

  const eligible = subscriptions.filter((entry) =>
    shouldDeliverToSubscription(notification, entry.filters),
  )

  if (eligible.length === 0) {
    return { delivered: 0, stale: 0 }
  }

  const message = JSON.stringify(notification)
  const deliveryResults = await Promise.allSettled(
    eligible.map((entry) =>
      webpush
        .sendNotification(entry.subscription, message, { TTL: 60 })
        .catch((error) => {
          error.endpoint = entry.subscription.endpoint
          throw error
        }),
    ),
  )

  const staleEndpoints = []
  let deliveredCount = 0

  for (const result of deliveryResults) {
    if (result.status === 'fulfilled') {
      deliveredCount += 1
      continue
    }

    if (!result.reason) {
      continue
    }

    const statusCode = result.reason.statusCode

    if (statusCode === 404 || statusCode === 410) {
      staleEndpoints.push(result.reason.endpoint)
    } else {
      console.error('Push delivery failed', result.reason)
    }
  }

  await Promise.all(staleEndpoints.map((endpoint) => store.remove(endpoint)))

  return { delivered: deliveredCount, stale: staleEndpoints.length }
}

