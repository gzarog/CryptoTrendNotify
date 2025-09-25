import http from 'node:http'
import { URL } from 'node:url'
import webpush from 'web-push'

import { PushSubscriptionStore } from './push-subscription-store.js'

const PORT = Number.parseInt(process.env.PUSH_SERVER_PORT ?? process.env.PORT ?? '4000', 10)
let vapidPublicKey = process.env.VAPID_PUBLIC_KEY
let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com'
const ALLOWED_ORIGIN = process.env.PUSH_ALLOWED_ORIGIN ?? '*'
const SUBSCRIPTION_FILE = process.env.PUSH_SUBSCRIPTIONS_FILE

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

function normalizeNotificationPayload(input) {
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

      if (!isValidSubscription(payload)) {
        sendJson(res, 400, { error: 'Invalid subscription payload' })
        return
      }

      await store.upsert(payload)
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

      const subscriptions = store.list()

      if (subscriptions.length === 0) {
        sendJson(res, 202, { success: true, delivered: 0 })
        return
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
        } else if (result.reason) {
          const statusCode = result.reason.statusCode

          if (statusCode === 404 || statusCode === 410) {
            staleEndpoints.push(result.reason.endpoint)
          } else {
            console.error('Push delivery failed', result.reason)
          }
        }
      }

      await Promise.all(staleEndpoints.map((endpoint) => store.remove(endpoint)))
      sendJson(res, 200, { success: true, delivered: deliveredCount, stale: staleEndpoints.length })
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
}

start().catch((error) => {
  console.error('Fatal error while starting the push server', error)
  process.exit(1)
})
