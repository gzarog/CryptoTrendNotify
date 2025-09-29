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

export async function broadcastNotification(store, notification) {
  const subscriptions = store.list()

  if (subscriptions.length === 0) {
    return { delivered: 0, stale: 0 }
  }

  const message = JSON.stringify(notification)
  const deliveryResults = await Promise.allSettled(
    subscriptions.map((subscription) =>
      webpush.sendNotification(subscription, message, { TTL: 60 }).catch((error) => {
        error.endpoint = subscription.endpoint
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

