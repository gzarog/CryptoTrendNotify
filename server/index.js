import http from 'node:http'
import { URL } from 'node:url'
import webpush from 'web-push'

import { PushSubscriptionStore } from './push-subscription-store.js'
import { broadcastNotification, normalizeNotificationPayload } from './push-delivery.js'
import { startMarketWatch } from './market-watcher.js'

const PORT = Number.parseInt(process.env.PUSH_SERVER_PORT ?? process.env.PORT ?? '4000', 10)
let vapidPublicKey = process.env.VAPID_PUBLIC_KEY
let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com'
const ALLOWED_ORIGIN = process.env.PUSH_ALLOWED_ORIGIN ?? '*'
const SUBSCRIPTION_FILE = process.env.PUSH_SUBSCRIPTIONS_FILE

const KNOWN_TIMEFRAMES = new Set(['5', '15', '30', '60', '120', '240', '360'])
const KNOWN_MOVING_AVERAGE_PAIRS = new Set(['ema10-ema50', 'ema10-ma200', 'ema50-ma200'])

function normalizeStringArray(values, transform = (value) => value) {
  if (!Array.isArray(values)) {
    return undefined
  }

  const normalized = []

  for (const value of values) {
    if (typeof value !== 'string' && typeof value !== 'number') {
      continue
    }

    const transformed = transform(String(value))

    if (typeof transformed === 'string' && transformed.length > 0) {
      normalized.push(transformed)
    }
  }

  if (normalized.length === 0) {
    return undefined
  }

  return Array.from(new Set(normalized))
}

function normalizeSubscriptionFilters(input) {
  if (!input || typeof input !== 'object') {
    return undefined
  }

  const filters = {}

  const symbols = normalizeStringArray(input.symbols, (value) => value.trim().toUpperCase())
  if (symbols && symbols.length > 0) {
    filters.symbols = symbols
  }

  const momentumTimeframes = normalizeStringArray(input.momentumTimeframes, (value) => {
    const trimmed = value.trim()
    return /^\d+$/.test(trimmed) ? trimmed : ''
  })
  if (momentumTimeframes && momentumTimeframes.length > 0) {
    filters.momentumTimeframes = momentumTimeframes.filter((value) => KNOWN_TIMEFRAMES.has(value))
    if (filters.momentumTimeframes.length === 0) {
      delete filters.momentumTimeframes
    }
  }

  const movingAverageTimeframes = normalizeStringArray(input.movingAverageTimeframes, (value) => {
    const trimmed = value.trim()
    return /^\d+$/.test(trimmed) ? trimmed : ''
  })
  if (movingAverageTimeframes && movingAverageTimeframes.length > 0) {
    filters.movingAverageTimeframes = movingAverageTimeframes.filter((value) => KNOWN_TIMEFRAMES.has(value))
    if (filters.movingAverageTimeframes.length === 0) {
      delete filters.movingAverageTimeframes
    }
  }

  const movingAveragePairs = normalizeStringArray(input.movingAveragePairs, (value) => value.trim())
  if (movingAveragePairs && movingAveragePairs.length > 0) {
    filters.movingAveragePairs = movingAveragePairs.filter((value) =>
      KNOWN_MOVING_AVERAGE_PAIRS.has(value),
    )
    if (filters.movingAveragePairs.length === 0) {
      delete filters.movingAveragePairs
    }
  }

  return Object.keys(filters).length > 0 ? filters : undefined
}

function normalizeSubscriptionPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const rawSubscription =
    payload.subscription && typeof payload.subscription === 'object' ? payload.subscription : payload

  if (!rawSubscription || typeof rawSubscription !== 'object') {
    return null
  }

  if (!isValidSubscription(rawSubscription)) {
    return null
  }

  const normalized = {
    subscription: {
      endpoint: rawSubscription.endpoint,
      expirationTime:
        rawSubscription.expirationTime == null ? null : Number(rawSubscription.expirationTime) || null,
      keys: {
        p256dh: rawSubscription.keys.p256dh,
        auth: rawSubscription.keys.auth,
      },
    },
  }

  const filters = normalizeSubscriptionFilters(payload.filters ?? payload.preferences)
  if (filters) {
    normalized.filters = filters
  }

  return normalized
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  })
  res.end(body)
}

async function readBody(req) {
  const chunks = []
  let totalLength = 0
  const limit = 256 * 1024

  for await (const chunk of req) {
    totalLength += chunk.length
    if (totalLength > limit) {
      throw new Error('Payload too large')
    }
    chunks.push(chunk)
  }

  if (chunks.length === 0) {
    return null
  }

  const buffer = Buffer.concat(chunks)
  return buffer.toString('utf8')
}

function isValidSubscription(payload) {
  return (
    payload &&
    typeof payload === 'object' &&
    typeof payload.endpoint === 'string' &&
    payload.endpoint.length > 0 &&
    payload.keys &&
    typeof payload.keys.p256dh === 'string' &&
    typeof payload.keys.auth === 'string'
  )
}

async function handleRequest(req, res, store) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (!req.url) {
    sendJson(res, 404, { error: 'Not found' })
    return
  }

  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`)

  if (req.method === 'GET' && url.pathname === '/api/push/public-key') {
    sendJson(res, 200, { publicKey: vapidPublicKey })
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/push/subscriptions') {
    try {
      const raw = await readBody(req)
      const payload = raw ? JSON.parse(raw) : null

      const normalized = normalizeSubscriptionPayload(payload)

      if (!normalized) {
        sendJson(res, 400, { error: 'Invalid subscription payload' })
        return
      }

      await store.upsert(normalized)
      sendJson(res, 201, { success: true })
    } catch (error) {
      console.error('Failed to store push subscription', error)
      sendJson(res, 500, { error: 'Unable to store subscription' })
    }
    return
  }

  if (req.method === 'DELETE' && url.pathname === '/api/push/subscriptions') {
    try {
      const raw = await readBody(req)
      const payload = raw ? JSON.parse(raw) : null
      const endpoint = payload?.endpoint

      if (typeof endpoint !== 'string') {
        sendJson(res, 400, { error: 'Missing subscription endpoint' })
        return
      }

      const removed = await store.remove(endpoint)
      sendJson(res, removed ? 200 : 404, { success: removed })
    } catch (error) {
      console.error('Failed to remove subscription', error)
      sendJson(res, 500, { error: 'Unable to remove subscription' })
    }
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/push/notifications') {
    try {
      const raw = await readBody(req)
      const payload = raw ? JSON.parse(raw) : null
      const notification = normalizeNotificationPayload(payload)

      if (!notification) {
        sendJson(res, 400, { error: 'Invalid notification payload' })
        return
      }

      const { delivered, stale } = await broadcastNotification(store, notification)
      sendJson(res, 200, { success: true, delivered, stale })
    } catch (error) {
      console.error('Failed to send push notifications', error)
      sendJson(res, 500, { error: 'Unable to send push notification' })
    }
    return
  }

  sendJson(res, 404, { error: 'Not found' })
}

async function start() {
  if (!vapidPublicKey || !vapidPrivateKey) {
    const generatedKeys = webpush.generateVAPIDKeys()
    vapidPublicKey = generatedKeys.publicKey
    vapidPrivateKey = generatedKeys.privateKey

    console.warn(
      'VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY were not set. Generated a temporary pair for local development.',
    )
    console.warn('Public key (use in your frontend .env):', vapidPublicKey)
    console.warn('Private key (do not commit):', vapidPrivateKey)
  }

  webpush.setVapidDetails(VAPID_SUBJECT, vapidPublicKey, vapidPrivateKey)

  const store = new PushSubscriptionStore(SUBSCRIPTION_FILE)
  await store.init()

  const server = http.createServer((req, res) => {
    void handleRequest(req, res, store)
  })

  server.listen(PORT, () => {
    console.log(`Push notification server listening on port ${PORT}`)
  })

  startMarketWatch({ store })
}

start().catch((error) => {
  console.error('Fatal error while starting the push server', error)
  process.exit(1)
})
