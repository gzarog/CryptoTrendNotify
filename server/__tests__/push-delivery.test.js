import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('web-push', () => ({
  default: {
    sendNotification: vi.fn(),
  },
}))

import webpush from 'web-push'
import { broadcastNotification, normalizeNotificationPayload } from '../push-delivery.js'

const subscription = {
  endpoint: 'https://example.com/endpoint',
  expirationTime: null,
  keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
}

describe('normalizeNotificationPayload', () => {
  it('returns null for invalid input', () => {
    expect(normalizeNotificationPayload(null)).toBeNull()
    expect(normalizeNotificationPayload({})).toBeNull()
    expect(normalizeNotificationPayload({ title: 'Only title' })).toBeNull()
  })

  it('keeps known fields and drops unknown ones', () => {
    const payload = normalizeNotificationPayload({
      title: 'Alert',
      body: 'Price increased',
      tag: 'btc',
      icon: '/icon.png',
      badge: '/badge.png',
      renotify: true,
      data: { symbol: 'BTC' },
      extra: 'ignore-me',
    })

    expect(payload).toEqual({
      title: 'Alert',
      body: 'Price increased',
      tag: 'btc',
      icon: '/icon.png',
      badge: '/badge.png',
      renotify: true,
      data: { symbol: 'BTC' },
    })
  })
})

describe('broadcastNotification', () => {
  beforeEach(() => {
    webpush.sendNotification.mockReset()
  })

  it('returns zero counts when there are no subscriptions', async () => {
    const store = {
      list: () => [],
      remove: vi.fn(),
    }

    const result = await broadcastNotification(store, { title: 't', body: 'b' })

    expect(result).toEqual({ delivered: 0, stale: 0 })
    expect(webpush.sendNotification).not.toHaveBeenCalled()
  })

  it('delivers notifications to eligible subscriptions', async () => {
    webpush.sendNotification.mockResolvedValue({ success: true })

    const store = {
      list: () => [
        {
          subscription,
          filters: {
            symbols: ['BTC'],
            momentumTimeframes: ['15'],
          },
        },
        {
          subscription: { ...subscription, endpoint: 'https://example.com/other' },
          filters: {
            symbols: ['ETH'],
          },
        },
      ],
      remove: vi.fn(),
    }

    const notification = {
      title: 'Momentum alert',
      body: 'BTC gaining momentum',
      data: {
        symbol: 'btc',
        type: 'momentum',
        timeframes: ['15', '30'],
      },
    }

    const result = await broadcastNotification(store, notification)

    expect(result).toEqual({ delivered: 1, stale: 0 })
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1)
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      subscription,
      JSON.stringify(notification),
      { TTL: 60 },
    )
  })

  it('removes stale subscriptions and reports counts', async () => {
    const error = new Error('Gone')
    error.statusCode = 410
    error.endpoint = 'https://example.com/stale'

    webpush.sendNotification.mockRejectedValue(error)

    const store = {
      list: () => [
        {
          subscription: { ...subscription, endpoint: error.endpoint },
          filters: undefined,
        },
      ],
      remove: vi.fn().mockResolvedValue(true),
    }

    const result = await broadcastNotification(store, { title: 't', body: 'b' })

    expect(result).toEqual({ delivered: 0, stale: 1 })
    expect(store.remove).toHaveBeenCalledWith(error.endpoint)
  })
})
