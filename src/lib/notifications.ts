const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'
const DEFAULT_ICON = '/icons/pwa-icon.svg'

export type AppNotificationPayload = {
  title: string
  body: string
  tag?: string
  icon?: string
  data?: NotificationOptions['data']
}

type PushSubscriptionJSON = {
  endpoint: string
  expirationTime: number | null
  keys: { p256dh: string; auth: string }
}

type PushNotificationPayload = AppNotificationPayload & {
  badge?: string
  renotify?: boolean
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })

  if (!response.ok) {
    throw new Error(`Request to ${path} failed with status ${response.status}`)
  }

  return (await response.json()) as T
}

async function sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
  const payload = subscription.toJSON() as PushSubscriptionJSON

  try {
    await fetchJson<{ success: true }>('/api/push/subscriptions', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  } catch (error) {
    console.error('Failed to store push subscription', error)
  }
}

async function requestVapidPublicKey(): Promise<string | null> {
  try {
    const data = await fetchJson<{ publicKey: string }>('/api/push/public-key')
    return data.publicKey
  } catch (error) {
    console.error('Failed to load VAPID public key', error)
    return null
  }
}

export async function checkPushServerConnection(): Promise<boolean> {
  try {
    const data = await fetchJson<{ publicKey?: string }>('/api/push/public-key')
    return typeof data.publicKey === 'string' && data.publicKey.length > 0
  } catch (error) {
    console.error('Push server connectivity check failed', error)
    return false
  }
}

export async function ensurePushSubscription(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false
  }

  try {
    const registration = await navigator.serviceWorker.ready
    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      const publicKey = await requestVapidPublicKey()

      if (!publicKey) {
        return false
      }

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
    }

    await sendSubscriptionToServer(subscription)
    return true
  } catch (error) {
    console.error('Failed to initialize push subscription', error)
    return false
  }
}

async function sendPushNotification(payload: PushNotificationPayload): Promise<void> {
  try {
    await fetchJson<{ success: true }>('/api/push/notifications', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  } catch (error) {
    console.error('Failed to send push notification', error)
  }
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) {
    return 'denied'
  }

  if (Notification.permission !== 'default') {
    return Notification.permission
  }

  try {
    return await Notification.requestPermission()
  } catch (error) {
    console.error('Failed to request notification permission', error)
    return Notification.permission
  }
}

export async function showAppNotification({
  title,
  body,
  tag,
  icon,
  data,
}: AppNotificationPayload): Promise<boolean> {
  void sendPushNotification({
    title,
    body,
    tag,
    icon: icon ?? DEFAULT_ICON,
    badge: icon ?? DEFAULT_ICON,
    data,
  })

  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return false
  }

  const options: NotificationOptions & { renotify?: boolean; timestamp?: number } = {
    body,
    tag,
    data,
    renotify: true,
    timestamp: Date.now(),
  }

  if (icon) {
    options.icon = icon
    options.badge = icon
  } else {
    options.icon = DEFAULT_ICON
    options.badge = DEFAULT_ICON
  }

  try {
    const registration = await navigator.serviceWorker?.getRegistration()

    if (!registration) {
      new Notification(title, options)
      return true
    }

    const subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      await registration.showNotification(title, options)
      return true
    }

    return true
  } catch (error) {
    console.error('Failed to display notification', error)
    return false
  }
}
