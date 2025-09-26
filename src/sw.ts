/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'
import type { PrecacheEntry } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<PrecacheEntry | string>
}

type ExtendedNotificationOptions = NotificationOptions & { renotify?: boolean; timestamp?: number }

clientsClaim()
precacheAndRoute(self.__WB_MANIFEST)

registerRoute(
  ({ request }) => request.destination === 'document',
  new NetworkFirst({
    cacheName: 'html-cache',
    networkTimeoutSeconds: 10,
  }),
)

registerRoute(
  ({ request }) => ['style', 'script', 'worker'].includes(request.destination ?? ''),
  new StaleWhileRevalidate({
    cacheName: 'asset-cache',
  }),
)

registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'image-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  }),
)

registerRoute(
  ({ url }) => /^https:\/\/api\.coingecko\.com\//.test(url.href),
  new NetworkFirst({
    cacheName: 'market-data-cache',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 10,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  }),
  'GET',
)

self.addEventListener('push', (event) => {
  const payload = (() => {
    if (!event.data) {
      return null
    }

    try {
      return event.data.json() as {
        title?: string
        body?: string
        tag?: string
        icon?: string
        badge?: string
        data?: NotificationOptions['data']
        renotify?: boolean
      }
    } catch (error) {
      console.error('Failed to parse push payload', error)
      return null
    }
  })()

  const title = payload?.title ?? 'Momentum alert'
  const options: ExtendedNotificationOptions = {
    body: payload?.body ?? 'Open the app to view the latest trend insights.',
    tag: payload?.tag,
    icon: payload?.icon ?? '/icons/pwa-icon.svg',
    badge: payload?.badge ?? payload?.icon ?? '/icons/pwa-icon.svg',
    data: payload?.data,
    renotify: payload?.renotify ?? true,
    timestamp: Date.now(),
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  const targetUrl = (event.notification.data as { url?: string } | undefined)?.url ?? '/'
  event.notification.close()

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const absoluteTarget = new URL(targetUrl, self.registration.scope).href
      const matchingClient = allClients.find((client) => 'focus' in client && client.url === absoluteTarget)

      if (matchingClient && 'focus' in matchingClient) {
        return matchingClient.focus()
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(absoluteTarget)
      }

      return undefined
    })(),
  )
})

self.addEventListener('pushsubscriptionchange', (event) => {
  console.warn('Push subscription expired; a refresh is required.', event)
})
